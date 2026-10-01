#!/usr/bin/env node

import { appendFile, readFile, writeFile } from 'node:fs/promises';

const REPORT_PATH = process.env.EXTERNAL_CHECK_REPORT || 'external-dependency-report.json';
const TIMEOUT_MS = Number(process.env.EXTERNAL_CHECK_TIMEOUT_MS || 20_000);
const RETRIES = Number(process.env.EXTERNAL_CHECK_RETRIES || 2);
const day = Math.floor(Date.now() / 86_400_000);
const checks = [];

const describeError = (error) => {
  const details = [];
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    const code = typeof current === 'object' && current && 'code' in current
      ? ` [${current.code}]`
      : '';
    const message = current instanceof Error ? current.message : String(current);
    details.push(`${message}${code}`);
    current = typeof current === 'object' && current && 'cause' in current
      ? current.cause
      : undefined;
  }
  return details.join(' <- ');
};

// The alarm (an issue, from the workflow) is for failures only. A check can
// also warn: one odd item, such as a single moved hymn page or audio file, or
// lessons published late at the start of a quarter. Warnings show in the run's
// summary and report without raising the alarm.
const failedRuns = new Map();

const runCheck = async (entry, run) => {
  const started = Date.now();
  const warnings = [];
  try {
    const detail = await run((message) => warnings.push(message));
    Object.assign(entry, { status: warnings.length ? 'warned' : 'passed', durationMs: Date.now() - started, detail });
    delete entry.error;
    if (warnings.length) entry.warnings = warnings;
    else delete entry.warnings;
    if (warnings.length) console.warn(`WARN ${entry.provider}: ${entry.name} — ${warnings.join('; ')}`);
    else console.log(`PASS ${entry.provider}: ${entry.name}`);
    failedRuns.delete(entry);
  } catch (error) {
    const message = describeError(error);
    Object.assign(entry, { status: 'failed', durationMs: Date.now() - started, error: message });
    console.error(`FAIL ${entry.provider}: ${entry.name} — ${message}`);
    failedRuns.set(entry, run);
  }
};

const record = async (name, provider, run) => {
  const entry = { name, provider };
  checks.push(entry);
  await runCheck(entry, run);
};

const request = async (url, options = {}) => {
  const { accept429 = false, ...fetchOptions } = options;
  let lastError;
  for (let attempt = 0; attempt <= RETRIES; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        redirect: 'follow',
        ...fetchOptions,
        headers: {
          'user-agent': 'NYCCSDA-PWA-dependency-monitor/1.0 (+https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app)',
          ...fetchOptions.headers,
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      // Fetch follows ordinary redirects. A surfaced retryable status can
      // indicate a temporary provider challenge or an unusable response.
      const retryableStatus =
        (response.status >= 300 && response.status < 400) ||
        response.status === 400 ||
        response.status === 408 ||
        response.status === 425 ||
        (response.status === 429 && !accept429) ||
        response.status === 403 ||
        response.status >= 500;
      if (retryableStatus && attempt < RETRIES) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
        continue;
      }
      return response;
    } catch (error) {
      clearTimeout(timeout);
      const reason = describeError(error);
      const timedOut = error instanceof Error && error.name === 'AbortError';
      lastError = new Error(
        `${url} ${timedOut ? `timed out after ${TIMEOUT_MS}ms` : `failed: ${reason}`} (attempt ${attempt + 1}/${RETRIES + 1})`,
        error instanceof Error ? { cause: error } : undefined,
      );
      if (attempt < RETRIES) {
        await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
        continue;
      }
    }
  }
  throw lastError;
};

const expectOk = (response, url, allowed = []) => {
  if (!response.ok && !allowed.includes(response.status)) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
};

const expectFinalHost = (response, url, expectedHosts = []) => {
  if (!expectedHosts.length) return;
  const finalHost = new URL(response.url || url).hostname;
  if (!expectedHosts.includes(finalHost)) {
    throw new Error(`${url} redirected to unexpected host ${finalHost}`);
  }
};

const describeResponse = (response) =>
  `HTTP ${response.status}${response.redirected ? ` -> ${response.url}` : ''}`;

const getTextPage = async (url, { allowed = [], expectedHosts = [] } = {}) => {
  const response = await request(url);
  expectOk(response, url, allowed);
  expectFinalHost(response, url, expectedHosts);
  return { response, text: await response.text() };
};

const getText = async (url, options) => (await getTextPage(url, options)).text;

const getJson = async (url) => {
  const response = await request(url, { headers: { accept: 'application/json' } });
  expectOk(response, url);
  return response.json();
};

const probe = async (
  url,
  { binary = false, allowed = [], expectedHosts = [], contentTypes = /(audio|image|octet-stream)/i } = {},
) => {
  const response = await request(url, {
    ...(binary ? { headers: { range: 'bytes=0-1023' } } : {}),
    accept429: allowed.includes(429),
  });
  expectOk(response, url, allowed);
  expectFinalHost(response, url, expectedHosts);
  if (binary) {
    const contentType = response.headers.get('content-type') || '';
    if (!contentTypes.test(contentType)) {
      throw new Error(`${url} returned unexpected content-type ${contentType || '(missing)'}`);
    }
  }
  await response.body?.cancel();
  return describeResponse(response);
};

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
// Stable for one UTC day so retries probe the same URL; mixed enough to spread
// samples across a large catalog instead of walking it sequentially.
const dailySample = (values, salt = 0) => {
  let value = (day + salt + 0x9e3779b9) | 0;
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return values[(value >>> 0) % values.length];
};
// Several distinct items for today, also stable for the day. The first is the
// one dailySample picks.
const dailySamples = (values, salt, count = 3) => {
  const picked = [];
  for (let index = 0; picked.length < Math.min(count, values.length) && index < count * 10; index += 1) {
    const value = dailySample(values, salt + index * 7919);
    if (!picked.includes(value)) picked.push(value);
  }
  return picked;
};

// Checks a few of a catalog's items, picked fresh each day. One bad item, such
// as a single moved page or file, is a warning; the check fails only when most
// of the samples fail, which means the provider itself is down or has changed.
const spotCheck = async (items, salt, check, warn, { label = String, count = 3 } = {}) => {
  const picked = dailySamples(items, salt, count);
  if (!picked.length) throw new Error('there is nothing to sample');
  const passed = [];
  const failures = [];
  for (const item of picked) {
    try {
      passed.push(`${label(item)}: ${await check(item)}`);
    } catch (error) {
      failures.push(`${label(item)}: ${describeError(error)}`);
    }
  }
  if (failures.length * 2 > picked.length) {
    throw new Error(`${failures.length} of ${picked.length} samples failed: ${failures.join('; ')}`);
  }
  failures.forEach(warn);
  return `${passed.length} of ${picked.length} samples passed (${passed.join('; ')})`;
};

const normalizedIds = (html, catId) => new Set(
  [...html.matchAll(new RegExp(`catid=${catId}(?:&amp;|&)id=(\\d+)`, 'g'))].map((match) => Number(match[1])),
);

const assertSameSet = (actual, expected, label) => {
  const missing = [...expected].filter((item) => !actual.has(item));
  const extra = [...actual].filter((item) => !expected.has(item));
  if (missing.length || extra.length) {
    throw new Error(`${label} differs (missing ${missing.slice(0, 5).join(', ') || 'none'}; extra ${extra.slice(0, 5).join(', ') || 'none'})`);
  }
};

const assertContainsSet = (actual, expected, label) => {
  const missing = [...expected].filter((item) => !actual.has(item));
  if (missing.length) {
    throw new Error(`${label} is missing ${missing.slice(0, 5).join(', ')}`);
  }
};

const manifestSource = await readFile('constants/CuvAdventistAudioManifest.ts', 'utf8');
const adventistEntries = [...manifestSource.matchAll(/["'](CUV_B\d{2}C\d{3}\.mp3)["']:\s*["'](https:\/\/[^"']+)["']/g)]
  .map(([, filename, url]) => ({ filename, url }));

await record('all 1,189 local audio assets are mapped', 'Adventist Connect', async () => {
  if (adventistEntries.length !== 1189) throw new Error(`found ${adventistEntries.length} manifest entries`);
  if (new Set(adventistEntries.map(({ filename }) => filename)).size !== 1189) throw new Error('duplicate canonical filenames');
  if (new Set(adventistEntries.map(({ url }) => url)).size !== 1189) throw new Error('duplicate asset URLs');
  return '1,189 unique mappings';
});

await record('daily audio samples', 'Adventist Connect', (warn) =>
  spotCheck(adventistEntries, 11, ({ url }) => probe(url, { binary: true }), warn, {
    label: ({ filename }) => filename,
  }));

// WordProject's recordings have no fallback host (see docs/LEGAL.md), so a
// failure here means their listeners have no audio.
for (const [label, prefix, manifestPath, salt] of [
  ['Cantonese', 'CANTONESE', 'constants/CantoneseAdventistAudioManifest.ts', 23],
  ['Spanish RV1909', 'RV1909', 'constants/Rv1909AdventistAudioManifest.ts', 29],
]) {
  const source = await readFile(manifestPath, 'utf8');
  const entries = [...source.matchAll(new RegExp(`["'](${prefix}_B\\d{2}C\\d{3}\\.mp3)["']:\\s*["'](https:\\/\\/[^"']+)["']`, 'g'))]
    .map(([, filename, url]) => ({ filename, url }));

  await record(`all 1,189 ${label} audio assets are mapped`, 'Adventist Connect', async () => {
    if (entries.length !== 1189) throw new Error(`found ${entries.length} manifest entries`);
    if (new Set(entries.map(({ url }) => url)).size !== 1189) throw new Error('duplicate asset URLs');
    return '1,189 unique mappings';
  });

  await record(`daily ${label} audio samples`, 'Adventist Connect', (warn) =>
    spotCheck(entries, salt, ({ url }) => probe(url, { binary: true }), warn, {
      label: ({ filename }) => filename,
    }));
}

let audioPowerUrls = [];
await record('published CUV catalog contains 1,189 recordings', 'Audio Power', async () => {
  const html = await getText('https://theaudiopower.org/translations/cuv/');
  const links = new Set([...html.matchAll(/(?:https?:\/\/theaudiopower\.com)?\/?CUV\/Recordings\/[^"'<>]+\.mp3/gi)].map((match) => match[0]));
  if (links.size !== 1189) throw new Error(`catalog lists ${links.size} recordings`);
  audioPowerUrls = [...links].map((link) => new URL(link, 'https://theaudiopower.com/').href);
  return '1,189 unique recordings';
});

await record('daily CUV audio samples', 'Audio Power', (warn) => {
  if (!audioPowerUrls.length) throw new Error('catalog was unavailable, so no sample can be selected');
  return spotCheck(audioPowerUrls, 23, (url) => probe(url, { binary: true }), warn, {
    label: (url) => url.split('/').pop(),
  });
});

await record('metadata contains every canonical CUV recording', 'Archive.org', async () => {
  const metadata = await getJson('https://archive.org/metadata/CUV_201911');
  const actual = new Set((metadata.files || []).map(({ name }) => name).filter((name) => /^CUV_B\d{2}C\d{3}\.mp3$/.test(name)));
  assertSameSet(actual, new Set(adventistEntries.map(({ filename }) => filename)), 'Archive catalog');
  return '1,189 canonical recordings';
});

await record('daily CUV audio samples', 'Archive.org', (warn) =>
  spotCheck(
    adventistEntries,
    37,
    ({ filename }) => probe(`https://archive.org/download/CUV_201911/${filename}`, { binary: true }),
    warn,
    { label: ({ filename }) => filename },
  ));

const hymnCatalogs = [
  ['Chinese 505', 59, 'features/hymnal/Chinese505Hymnal.json'],
  ['Chinese 506', 90, 'features/hymnal/Chinese506Hymnal.json'],
  ['Chinese 707 v1', 15, 'features/hymnal/Chinese707HymnalV1.json'],
  ['Chinese 707 v2', 20, 'features/hymnal/Chinese707HymnalV2.json'],
  ['Chinese 707 v3', 234, 'features/hymnal/Chinese707HymnalV3.json'],
];

for (const [name, catId, path] of hymnCatalogs) {
  await record('directory contains every locally mapped page ID', name, async () => {
    const data = await readJson(path);
    const url = `https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=${catId}`;
    const actual = normalizedIds(await getText(url), catId);
    const expected = new Set(Object.values(data).map(({ pageId }) => pageId));
    assertContainsSet(actual, expected, `${name} directory`);
    return `${expected.size} mapped page IDs present (${actual.size} published)`;
  });

  await record('daily hymn page samples', name, async (warn) => {
    const data = await readJson(path);
    return spotCheck(
      Object.values(data),
      Number(catId),
      ({ pageId }) => probe(`https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=${catId}&id=${pageId}`),
      warn,
      { label: ({ pageId }) => `page ${pageId}` },
    );
  });
}

// oEmbed answers only for public videos, so a removed or private recording fails.
await record('daily 506 hymn recording samples', 'YouTube', async (warn) => {
  const { videos } = await readJson('features/hymnal/Chinese506YouTube.json');
  return spotCheck(Object.entries(videos), 506, async ([number, videoId]) => {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const video = await getJson(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`);
    if (Number(String(video.title).match(/^\s*(\d+)/)?.[1]) !== Number(number)) {
      throw new Error(`${watchUrl} is now titled "${video.title}"`);
    }
    return video.title;
  }, warn, { label: ([number]) => `hymn ${number}` });
});

await record('directory publishes the expected English hymnal links', 'Hymns for Worship', async () => {
  const url = 'https://hymnsforworship.org/sda-hymnal/the-seventh-day-adventist-hymnal-1985-edition/';
  const { response, text: html } = await getTextPage(url, {
    expectedHosts: ['hymnsforworship.org'],
  });
  const numbers = new Set([...html.matchAll(/sdah-(\d{3})/g)].map((match) => Number(match[1])));
  // The provider currently omits #262 from its directory, although the generated page is probed in rotation.
  if (numbers.size < 690 || [...numbers].some((number) => number < 1 || number > 695)) {
    throw new Error(`directory lists ${numbers.size} valid hymn numbers`);
  }
  return `${numbers.size} published hymn links; ${describeResponse(response)}`;
});

// The app links each hymn to its page's #hymn-score anchor. Not every hymn has
// a score on the site (SDAH 509 links to sheet music elsewhere, with no
// anchor), and its link then opens at the top of the hymn page. So the daily
// sample needs only the hymn's heading, and SDAH 001, which has a score, shows
// the anchor still exists.
const getHymnPage = async (number) => {
  const paddedNumber = String(number).padStart(3, '0');
  const url = `https://hymnsforworship.org/sdah-${paddedNumber}#hymn-score`;
  const { response, text: html } = await getTextPage(url, {
    expectedHosts: ['hymnsforworship.org'],
  });
  const finalPath = new URL(response.url).pathname;
  if (!finalPath.startsWith(`/sdah-${paddedNumber}`)) {
    throw new Error(`${url} resolved to unexpected hymn path ${finalPath}`);
  }
  if (!html.includes(`SDAH ${paddedNumber}`)) {
    throw new Error(`${url} did not publish the expected hymn heading`);
  }
  return { url, response, html };
};

await record('daily English hymn page samples', 'Hymns for Worship', (warn) =>
  spotCheck(
    Array.from({ length: 695 }, (_, index) => index + 1),
    695,
    async (number) => describeResponse((await getHymnPage(number)).response),
    warn,
    { label: (number) => `SDAH ${number}` },
  ));

await record('hymn score anchor (SDAH 001)', 'Hymns for Worship', async () => {
  const { url, response, html } = await getHymnPage(1);
  if (!/id=["']hymn-score["']/.test(html)) {
    throw new Error(`${url} no longer has the score anchor the app links to`);
  }
  return `${describeResponse(response)} with score anchor`;
});

const libraryCatalogSource = await readFile('features/library/LibraryCatalog.ts', 'utf8');
const gutenbergBooks = [...libraryCatalogSource.matchAll(
  /sourceUrl:\s*'(https:\/\/(?:www\.)?gutenberg\.org\/ebooks\/(\d+))'/g,
)].map(([, url, ebookId]) => ({ url, ebookId }));

const archiveBooks = [...libraryCatalogSource.matchAll(
  /sourceUrl:\s*'(https:\/\/archive\.org\/details\/([A-Za-z0-9._-]+))'/g,
)].map(([, url, identifier]) => ({ url, identifier }));

// Every public-domain book links to Gutenberg or the Internet Archive, so a
// count mismatch means a link pattern stopped matching the catalog's format.
// Only books count, at the catalog's top level: an edition in another
// language, nested inside its book, is checked with the other editions.
const topLevelCount = (pattern) =>
  [...libraryCatalogSource.matchAll(new RegExp(`^ {4}${pattern}`, 'gm'))].length;
const publicDomainEntryCount = topLevelCount(String.raw`rights:\s*'public-domain-us'`);
const publicDomainBookLinkCount = topLevelCount(
  String.raw`sourceUrl:\s*'https:\/\/(?:(?:www\.)?gutenberg\.org\/ebooks\/\d+|archive\.org\/details\/[A-Za-z0-9._-]+)'`,
);

await record('catalog has one unique link per public-domain book', 'Project Gutenberg', async () => {
  if (
    !gutenbergBooks.length ||
    publicDomainBookLinkCount !== publicDomainEntryCount
  ) {
    throw new Error(
      `found ${publicDomainBookLinkCount} Project Gutenberg and Internet Archive links for ${publicDomainEntryCount} public-domain books`,
    );
  }
  if (new Set(gutenbergBooks.map(({ url }) => url)).size !== gutenbergBooks.length) {
    throw new Error('catalog contains duplicate Project Gutenberg links');
  }
  return `${gutenbergBooks.length} unique ebook records`;
});

await record('daily public-domain book samples', 'Project Gutenberg', (warn) =>
  spotCheck(gutenbergBooks, 131, ({ url }) => probe(url, { allowed: [429] }), warn, {
    label: ({ ebookId }) => `ebook ${ebookId}`,
  }));

// Spanish readers see a book's Spanish edition when it has one. Those open on
// EGW Writings or in the publisher's own free copy.
const spanishEditionUrls = [...libraryCatalogSource.matchAll(
  /spanish:\s*\{[^}]*?sourceUrl:\s*'(https:\/\/[^']+)'/g,
)].map(([, url]) => url);

await record('Spanish editions open', 'Library', async () => {
  if (spanishEditionUrls.length !== 3) {
    throw new Error(`found ${spanishEditionUrls.length} Spanish edition links, expected 3`);
  }
  for (const url of spanishEditionUrls) {
    if (new URL(url).hostname === 'text.egwwritings.org') {
      await getTextPage(url, { expectedHosts: ['text.egwwritings.org'] });
    } else {
      // Chapel Library serves its books as PDFs.
      await probe(url, {
        binary: true,
        expectedHosts: ['www.chapellibrary.org', 'chapellibrary.org'],
        contentTypes: /(pdf|octet-stream)/i,
      });
    }
  }
  return `${spanishEditionUrls.length} Spanish editions`;
});

// Chinese readers see a book's Chinese edition when it has one: so far a
// public-domain scan in HathiTrust's page viewer. The viewer turns away
// scripts, so check HathiTrust's catalog record that the volume is still
// public domain and in full view.
const chineseEditionUrls = [...libraryCatalogSource.matchAll(
  /chineseEdition:\s*\{[^}]*?sourceUrl:\s*'(https:\/\/[^']+)'/g,
)].map(([, url]) => url);

await record('Chinese editions stay public domain', 'HathiTrust', async () => {
  if (chineseEditionUrls.length !== 1) {
    throw new Error(`found ${chineseEditionUrls.length} Chinese edition links, expected 1`);
  }
  for (const url of chineseEditionUrls) {
    const { hostname, searchParams } = new URL(url);
    const htid = searchParams.get('id');
    if (hostname !== 'babel.hathitrust.org' || !htid) {
      throw new Error(`${url} is not a HathiTrust volume`);
    }
    const catalogRecord = await getJson(`https://catalog.hathitrust.org/api/volumes/brief/htid/${htid}.json`);
    const item = catalogRecord?.items?.find((entry) => entry.htid === htid);
    if (!item) throw new Error(`${htid} is missing from HathiTrust's catalog`);
    if (item.rightsCode !== 'pd' || item.usRightsString !== 'Full view') {
      throw new Error(`${htid} is now ${item.rightsCode} (${item.usRightsString})`);
    }
  }
  return `${chineseEditionUrls.length} public-domain Chinese edition(s) in full view`;
});

// An Internet Archive item can later be moved into a lending collection or
// restricted, which usually means someone found it is still under copyright.
// Recheck each linked scan so the library stops pointing at it.
const ARCHIVE_LENDING_COLLECTIONS = ['inlibrary', 'printdisabled', 'lendinglibrary'];

await record('public-domain scans stay openly downloadable', 'Internet Archive', async () => {
  if (!archiveBooks.length) return 'no Internet Archive books in the catalog';
  for (const { identifier } of archiveBooks) {
    const item = await getJson(`https://archive.org/metadata/${identifier}`);
    const metadata = item?.metadata || {};
    const collections = [metadata.collection].flat().filter(Boolean);
    if (!metadata.identifier || item.is_dark) {
      throw new Error(`${identifier} is missing or dark`);
    }
    if (String(metadata['access-restricted-item']) === 'true') {
      throw new Error(`${identifier} is now access-restricted`);
    }
    const lending = collections.filter((name) => ARCHIVE_LENDING_COLLECTIONS.includes(name));
    if (lending.length) {
      throw new Error(`${identifier} is now in lending collection ${lending.join(', ')}`);
    }
    // Catalog dates come as 1838, [1914], c1897, 1909?, or 01-22-1926.
    const year = Number(String(metadata.year || metadata.date || '').match(/(?<!\d)(1[5-9]\d\d|20\d\d)(?!\d)/)?.[1]);
    if (!(year > 0 && year < 1928)) {
      throw new Error(`${identifier} records an edition year of ${year || 'unknown'}`);
    }
  }
  return `${archiveBooks.length} openly downloadable pre-1928 scan(s)`;
});

const chineseLibrarySource = await readFile('features/library/ChineseLibrary.ts', 'utf8');
const chineseLibraryCatalogUrl = chineseLibrarySource.match(
  /CHINESE_LIBRARY_CATALOG_URL\s*=\s*\n?\s*'(https:\/\/api\.sdabible\.org\/[^']+)'/,
)?.[1];

await record('current EGW cover catalog', 'Chinese Union Mission library', async (warn) => {
  if (!chineseLibraryCatalogUrl) throw new Error('cover catalog URL is missing');
  const catalog = await getJson(chineseLibraryCatalogUrl);
  const books = Array.isArray(catalog.childCategories) ? catalog.childCategories : [];
  const curatedIds = [127, 128, 55, 81, 75, 120, 34, 16, 50, 13, 23];
  const availableIds = new Set(books.map(({ book_id }) => book_id));
  // A book or two leaving the catalog shows its cover's fallback; most of them
  // leaving means the catalog changed.
  const missing = curatedIds.filter((id) => !availableIds.has(id));
  if (missing.length * 2 > curatedIds.length) {
    throw new Error(`Chinese cover catalog is missing ${missing.length} of ${curatedIds.length} curated books`);
  }
  if (missing.length) warn(`Chinese cover catalog is missing curated books ${missing.join(', ')}`);
  const covers = books.filter(({ book_id, thumbnail }) => curatedIds.includes(book_id) && thumbnail);
  return spotCheck(
    covers,
    149,
    ({ thumbnail }) => probe(new URL(thumbnail, 'https://cms.sdabible.site/storage/').href, {
      binary: true,
      expectedHosts: ['cms.sdabible.site'],
    }),
    warn,
    { label: ({ book_id }) => `book ${book_id}` },
  );
});

const egwCatalogSource = await readFile('features/library/EgwBookCatalog.ts', 'utf8');
const egwCoverBaseUrl = egwCatalogSource.match(
  /EGW_COVER_BASE_URL\s*=\s*'(https:\/\/[^']+)'/,
)?.[1];
const egwEditions = [...egwCatalogSource.matchAll(
  /edition\(\s*'(en|zh|es)'\s*,\s*'[^']+'\s*,\s*(\d+)\s*,\s*'(\d+\.\d+)'\s*\)/g,
)].map(([, language, bookId, firstParagraph]) => ({
  language,
  bookId: Number(bookId),
  firstParagraph,
  url: `https://text.egwwritings.org/read/${firstParagraph}`,
}));

await record('catalog contains eleven deep links per language', 'EGW Writings', async () => {
  for (const language of ['en', 'zh', 'es']) {
    const editions = egwEditions.filter((entry) => entry.language === language);
    if (editions.length !== 11) throw new Error(`${language} has ${editions.length} editions`);
    if (editions.some(({ bookId, firstParagraph }) => !firstParagraph.startsWith(`${bookId}.`))) {
      throw new Error(`${language} contains a mismatched book and paragraph ID`);
    }
  }
  if (new Set(egwEditions.map(({ url }) => url)).size !== 33) {
    throw new Error('edition deep links are not unique');
  }
  return '33 unique English, Chinese, and Spanish edition links';
});

for (const language of ['en', 'es']) {
  await record(`daily ${language} cover samples`, 'EGW Writings', async (warn) => {
    if (!egwCoverBaseUrl) throw new Error('cover base URL is missing');
    const editions = egwEditions.filter((entry) => entry.language === language);
    return spotCheck(editions, language.charCodeAt(0) + 41, ({ bookId }) => probe(`${egwCoverBaseUrl}${bookId}?type=small`, {
      binary: true,
      // EGW currently redirects cover thumbnails from the public API host to
      // its media CDN. Both hosts are official EGW Writings endpoints.
      expectedHosts: [
        'a.egwwritings.org',
        'media1.egwwritings.org',
        'media2.egwwritings.org',
        'media3.egwwritings.org',
        'media4.egwwritings.org',
      ],
    }), warn, { label: ({ bookId }) => `book ${bookId}` });
  });
}

for (const language of ['en', 'zh', 'es']) {
  await record(`daily ${language} text edition samples`, 'EGW Writings', async (warn) => {
    const editions = egwEditions.filter((entry) => entry.language === language);
    return spotCheck(editions, language.charCodeAt(0), async ({ url }) => {
      const { response, text: html } = await getTextPage(url, {
        expectedHosts: ['text.egwwritings.org'],
      });
      if (
        !html.includes('data-booktype="egwwritings"') ||
        !html.includes('reader-tools-fontsize-increase') ||
        !html.includes('js-btn-set-theme')
      ) {
        throw new Error(`${url} did not publish the expected text reader controls`);
      }
      return `${describeResponse(response)} with text reader controls`;
    }, warn, { label: ({ firstParagraph }) => firstParagraph });
  });
}

await record('translation and audio catalog contract', 'HelloAO', async () => {
  const data = await getJson('https://bible.helloao.org/api/available_translations.json');
  const serialized = JSON.stringify(data);
  for (const id of ['BSB', 'eng_kjv', 'cmn_cuv', 'cmn_cu1', 'spa_r09']) {
    if (!serialized.includes(id)) throw new Error(`translation ${id} is missing`);
  }
  return 'all configured translation IDs present';
});

await record('English chapter contract including audio', 'HelloAO', async () => {
  const data = await getJson('https://bible.helloao.org/api/BSB/GEN/1.json');
  if (!data.chapter || !data.book || !data.thisChapterAudioLinks) throw new Error('chapter/audio fields are missing');
  return 'chapter and audio fields present';
});

for (const resource of ['cmn_cut', 'cmn_cus', 'spa_rv', 'hbo_sr', 'grc_sr']) {
  await record(`${resource} Genesis book contract`, 'fetch(bible)', async () => {
    const book = resource === 'grc_sr' ? 'mat' : 'gen';
    const data = await getJson(`https://v1.fetch.bible/bibles/${resource}/txt/${book}.json`);
    if (!data.book || !Array.isArray(data.contents)) throw new Error('book or contents field is missing');
    return `${data.book} with ${data.contents.length} content entries`;
  });
}

const navigationLinks = [
  ['church building image', 'https://assets.adventistconnect.org/newyork2/2026/07/13221703/church_building.jpg', true],
  ['pastor image', 'https://assets.adventistconnect.org/newyork2/2026/07/13221020/moses_fang-1536x1024.jpg', true],
  ['Bible worker image', 'https://assets.adventistconnect.org/newyork2/2026/07/13221317/sarah_fang-1536x1024.jpg', true],
  ['Flushing fellowship image', 'https://assets.adventistconnect.org/newyork2/2026/07/01230029/flushing_fellowship_3.jpg', true],
  ['Elmhurst Sabbath image', 'https://assets.adventistconnect.org/newyork2/2026/07/19124827/elmhurst_sabbath.png', true],
  ['English-to-Chinese hymnal lookup image', 'https://assets.adventistconnect.org/newyork2/2026/08/09144957/SDAH_1985_to_Chinese_505_Hymnal_Lookup-scaled.jpg', true],
  ['Chinese-to-English hymnal lookup image', 'https://assets.adventistconnect.org/newyork2/2026/08/09144912/Chinese_505_Hymnal_to_SDAH_1985_Lookup-scaled.jpg', true],
  ['PWA install guide', 'https://youtu.be/5IwrG8BTylw?si=7FW6G4DWiJmLkz89&t=15'],
  ['staff schedule', 'https://docs.google.com/spreadsheets/d/1FqFJ8YvBA-IybOlVU1SW6ynrBGNs8Cd-9xlWz6SkkDA/edit?usp=sharing', false, [401, 403]],
  // Its bot protection answers some networks with 403 (seen from a home
  // connection on 2026-10-01), so 403 means "up, but blocking the monitor".
  ['Adventist Giving', 'https://adventistgiving.org/donate/AN48CO', false, [403]],
  ['Spotify podcast', 'https://open.spotify.com/show/6Ig7RqU3A5vivl4x3FJFLV'],
  ['Zoom class', 'https://us06web.zoom.us/j/2541879535?pwd=Rmhsa0pFK3hQVTRHMzVqQ2swZlBodz09'],
  ['sermon archive', 'https://www.youtube.com/playlist?list=PLX85oBoVF4TKC4p0hJ6EK6X_2zXOB53eW'],
  ['Sabbath stream', 'https://www.youtube.com/@newyorkchinesesdachurch1334/streams'],
  ['Sabbath School English', 'https://sabbath-school.adventech.io/en'],
  ['Sabbath School Chinese', 'https://sabbath-school.adventech.io/zh'],
  ['Sabbath School Spanish', 'https://sabbath-school.adventech.io/es'],
  ['Chinese hymnal iOS', 'https://apps.apple.com/us/app/506%E8%AE%9A%E7%BE%8E%E8%A9%A9-traditional-chinese/id6498894032'],
  ['Chinese hymnal Android', 'https://play.google.com/store/apps/details?id=org.chumadventist.hymnal506.next'],
  ['church map', 'https://www.google.com/maps/search/?api=1&query=760%2041st%20Ave%20Elmhurst%20NY%2011373'],
  ['Adventist beliefs', 'https://adventist.org/beliefs#official-beliefs'],
  ['Greater New York Conference', 'https://gnyc.org/'],
];

for (const [name, url, binary = false, allowed = []] of navigationLinks) {
  await record(name, 'App navigation', () => probe(url, { binary, allowed: [...allowed, 429] }));
}

// Children's Sabbath School (#336): each age group opens this week's lesson PDF,
// falling back to English and then to its Alive in Jesus website. These checks
// fail when the English lessons for this quarter can't be found, which means
// the app is showing the website instead. The quarter follows
// features/sabbath-school/ChildrenLessons.ts.
const quarterStart = (weekStartsOn) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const starts = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]
    .flatMap((year) => [1, 2, 3, 4].map((quarter) => {
      const start = new Date(year, (quarter - 1) * 3, 1);
      start.setDate(start.getDate() - (weekStartsOn === 'sunday' ? start.getDay() : (start.getDay() + 1) % 7));
      return { quarter, start, year };
    }))
    .filter(({ start }) => start <= today);
  return { ...starts[starts.length - 1], today };
};
const childrenQuarter = (weekStartsOn) => {
  const { quarter, year } = quarterStart(weekStartsOn);
  return `${year}-${String(quarter).padStart(2, '0')}`;
};

// Adventech often publishes a quarter's lessons late, and the app falls back to
// the English PDF and then the Alive in Jesus website meanwhile (#336). So for
// the quarter's first two weeks, missing lessons are a warning, not a failure.
const QUARTER_GRACE_DAYS = 14;
const withQuarterGrace = (weekStartsOn, run) => async (warn) => {
  try {
    return await run(warn);
  } catch (error) {
    const { start, today } = quarterStart(weekStartsOn);
    const days = Math.round((today - start) / 86_400_000);
    if (days >= QUARTER_GRACE_DAYS) throw error;
    warn(`${describeError(error)} (day ${days + 1} of the quarter, when lessons are often published late)`);
    return 'not published yet';
  }
};

for (const level of ['beginner', 'kindergarten', 'primary', 'junior', 'teen', 'youth']) {
  await record(`Alive in Jesus ${level} website`, 'Children Sabbath School', () =>
    probe(`https://${level}.aliveinjesus.info/`));
}

for (const book of ['bg', 'bg-tg', 'kd', 'kd-tg', 'pr', 'pr-tg']) {
  const id = `${childrenQuarter('sunday')}-${book}`;
  await record(`Alive in Jesus ${id} PDFs`, 'Children Sabbath School', withQuarterGrace('sunday', async () => {
    const pdfs = await getJson(`https://sabbath-school.adventech.io/api/v3/en/aij/${id}/pdf.json`);
    const weeks = pdfs.filter(({ target }) => new RegExp(`^en/aij/${id}/\\d+$`).test(target || ''));
    if (!weeks.length) throw new Error(`en/aij/${id} has no weekly PDFs`);
    return `${weeks.length} weekly PDFs`;
  }));
}

await record('English children\'s quarterlies this quarter', 'Children Sabbath School', withQuarterGrace('saturday', async () => {
  const catalog = await getJson('https://sabbath-school.adventech.io/api/v2/en/quarterlies/index.json');
  const ids = new Set(catalog.map(({ id }) => id));
  const expected = ['pp', 'rt', 'cc'].map((suffix) => `${childrenQuarter('saturday')}-${suffix}`);
  const missing = expected.filter((id) => !ids.has(id));
  if (missing.length) throw new Error(`the catalog doesn't list ${missing.join(', ')}`);
  return expected.join(', ');
}));

// The store listings and printed QR codes point at these pages, so they must
// keep working through the church's own domain. See
// docs/operations/admin-runbook.md#the-app-website-appnyccsdaorg.
const websitePages = [
  ['privacy policy page', 'https://app.nyccsda.org/privacy-policy.html', 'Privacy Policy'],
  ['app support page', 'https://app.nyccsda.org/support.html', 'App Support'],
  ['app download page', 'https://app.nyccsda.org/download', 'play.google.com/store/apps/details?id=org.nyccsda.app'],
];

for (const [name, url, expectedText] of websitePages) {
  await record(name, 'App website', async () => {
    const { response, text } = await getTextPage(url, {
      expectedHosts: ['app.nyccsda.org', 'new-york-chinese-seventh-day-adventist.github.io'],
    });
    if (!text.includes(expectedText)) throw new Error(`${url} no longer contains "${expectedText}"`);
    return describeResponse(response);
  });
}

await record('public bulletin JSON contract', 'Bulletin API', async () => {
  const date = process.env.BULLETIN_TEST_DATE || '2026-08-08';
  const data = await getJson(`https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec?date=${date}`);
  if (data?.ok !== true || data.bulletin?.date !== date || !data.bulletin?.queens || !data.bulletin?.brooklyn) {
    throw new Error('bulletin response fields are missing');
  }
  if (/(email|timestamp)/i.test(JSON.stringify(data))) throw new Error('private field name appears in the public response');
  return `bulletin ${date}`;
});

await record('sunset JSON contract', 'Sunrise-Sunset API', async () => {
  const data = await getJson('https://api.sunrise-sunset.org/json?lat=40.74546&lng=-73.88914&date=today&formatted=0');
  if (data.status !== 'OK' || !data.results?.sunset) throw new Error('sunset response fields are missing');
  return `sunset ${data.results.sunset}`;
});

// A provider can be briefly unreachable, beyond the request's own quick
// retries. Check each failure once more, a minute later, so only failures that
// last raise the alarm.
const RECHECK_DELAY_MS = Number(process.env.EXTERNAL_CHECK_RECHECK_DELAY_MS ?? 60_000);
if (failedRuns.size) {
  console.log(`\nRechecking ${failedRuns.size} failed check${failedRuns.size === 1 ? '' : 's'} in ${RECHECK_DELAY_MS / 1000}s.`);
  await new Promise((resolve) => setTimeout(resolve, RECHECK_DELAY_MS));
  for (const [entry, run] of [...failedRuns]) {
    await runCheck(entry, run);
    entry.rechecked = true;
  }
}

const failed = checks.filter(({ status }) => status === 'failed');
const warned = checks.filter(({ status }) => status === 'warned');
const report = {
  generatedAt: new Date().toISOString(),
  summary: {
    total: checks.length,
    passed: checks.length - failed.length - warned.length,
    warned: warned.length,
    failed: failed.length,
  },
  checks,
};
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.summary.passed}/${report.summary.total} checks passed, ${warned.length} with warnings. Report: ${REPORT_PATH}`);
if (warned.length) {
  console.warn(`\n${warned.length} check${warned.length === 1 ? '' : 's'} passed with warnings (no alarm):`);
  for (const { provider, name, warnings } of warned) {
    console.warn(`- ${provider}: ${name} — ${warnings.join('; ')}`);
  }
}
if (failed.length) {
  console.error(`\n${failed.length} external dependency check${failed.length === 1 ? '' : 's'} failed:`);
  for (const { provider, name, error } of failed) {
    console.error(`- ${provider}: ${name} — ${error}`);
  }
  process.exitCode = 1;
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const escapeCell = (value) => String(value).replaceAll('|', '\\|').replaceAll('\n', '<br>');
  const lines = [
    '## External dependency monitor',
    '',
    `**${report.summary.passed}/${report.summary.total} checks passed; ${report.summary.warned} warned; ${report.summary.failed} failed.**`,
  ];
  if (failed.length) {
    lines.push(
      '',
      '| Provider | Check | Error |',
      '| --- | --- | --- |',
      ...failed.map(({ provider, name, error }) => `| ${escapeCell(provider)} | ${escapeCell(name)} | ${escapeCell(error)} |`),
    );
  }
  if (warned.length) {
    lines.push(
      '',
      'Warnings, which raise no alarm: one odd item, or lessons not yet published early in a quarter.',
      '',
      '| Provider | Check | Warning |',
      '| --- | --- | --- |',
      ...warned.map(({ provider, name, warnings }) => `| ${escapeCell(provider)} | ${escapeCell(name)} | ${escapeCell(warnings.join('; '))} |`),
    );
  }
  lines.push('', `Full JSON report: \`${REPORT_PATH}\``);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
