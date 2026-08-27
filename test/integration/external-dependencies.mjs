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

const record = async (name, provider, run) => {
  const started = Date.now();
  try {
    const detail = await run();
    checks.push({ name, provider, status: 'passed', durationMs: Date.now() - started, detail });
    console.log(`PASS ${provider}: ${name}`);
  } catch (error) {
    const message = describeError(error);
    checks.push({ name, provider, status: 'failed', durationMs: Date.now() - started, error: message });
    console.error(`FAIL ${provider}: ${name} — ${message}`);
  }
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
      // fetch follows ordinary redirects. A surfaced 3xx usually means the
      // provider returned a temporary challenge or an unusable Location header.
      const retryableStatus =
        (response.status >= 300 && response.status < 400) ||
        response.status === 408 ||
        response.status === 425 ||
        (response.status === 429 && !accept429) ||
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

const probe = async (url, { binary = false, allowed = [], expectedHosts = [] } = {}) => {
  const response = await request(url, {
    ...(binary ? { headers: { range: 'bytes=0-1023' } } : {}),
    accept429: allowed.includes(429),
  });
  expectOk(response, url, allowed);
  expectFinalHost(response, url, expectedHosts);
  if (binary) {
    const contentType = response.headers.get('content-type') || '';
    if (!/(audio|image|octet-stream)/i.test(contentType)) {
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

if (adventistEntries.length > 0) {
  const sample = dailySample(adventistEntries, 11);
  await record(`daily audio sample ${sample.filename}`, 'Adventist Connect', () => probe(sample.url, { binary: true }));
}

let audioPowerUrls = [];
await record('published CUV catalog contains 1,189 recordings', 'Audio Power', async () => {
  const html = await getText('https://theaudiopower.org/translations/cuv/');
  const links = new Set([...html.matchAll(/(?:https?:\/\/theaudiopower\.com)?\/?CUV\/Recordings\/[^"'<>]+\.mp3/gi)].map((match) => match[0]));
  if (links.size !== 1189) throw new Error(`catalog lists ${links.size} recordings`);
  audioPowerUrls = [...links].map((link) => new URL(link, 'https://theaudiopower.com/').href);
  return '1,189 unique recordings';
});

await record('daily CUV audio sample', 'Audio Power', () => {
  if (!audioPowerUrls.length) throw new Error('catalog was unavailable, so no sample can be selected');
  return probe(dailySample(audioPowerUrls, 23), { binary: true });
});

await record('metadata contains every canonical CUV recording', 'Archive.org', async () => {
  const metadata = await getJson('https://archive.org/metadata/CUV_201911');
  const actual = new Set((metadata.files || []).map(({ name }) => name).filter((name) => /^CUV_B\d{2}C\d{3}\.mp3$/.test(name)));
  assertSameSet(actual, new Set(adventistEntries.map(({ filename }) => filename)), 'Archive catalog');
  return '1,189 canonical recordings';
});

await record('daily CUV audio sample', 'Archive.org', () => {
  const sample = dailySample(adventistEntries, 37);
  return probe(`https://archive.org/download/CUV_201911/${sample.filename}`, { binary: true });
});

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

  await record('daily hymn page sample', name, async () => {
    const data = await readJson(path);
    const entry = dailySample(Object.values(data), Number(catId));
    return probe(`https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=${catId}&id=${entry.pageId}`);
  });
}

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

await record('daily English hymn page sample', 'Hymns for Worship', async () => {
  const number = dailySample(Array.from({ length: 695 }, (_, index) => index + 1), 695);
  const paddedNumber = String(number).padStart(3, '0');
  const url = `https://hymnsforworship.org/sdah-${paddedNumber}#hymn-score`;
  const { response, text: html } = await getTextPage(url, {
    expectedHosts: ['hymnsforworship.org'],
  });
  const finalPath = new URL(response.url).pathname;
  if (!finalPath.startsWith(`/sdah-${paddedNumber}`)) {
    throw new Error(`${url} resolved to unexpected hymn path ${finalPath}`);
  }
  if (!html.includes(`SDAH ${paddedNumber}`) || !/id=["']hymn-score["']/.test(html)) {
    throw new Error(`${url} did not publish the expected hymn heading and score anchor`);
  }
  return `${describeResponse(response)} with hymn heading and score anchor`;
});

const libraryCatalogSource = await readFile('features/library/LibraryCatalog.ts', 'utf8');
const gutenbergBooks = [...libraryCatalogSource.matchAll(
  /sourceUrl:\s*'(https:\/\/www\.gutenberg\.org\/ebooks\/(\d+))'/g,
)].map(([, url, ebookId]) => ({ url, ebookId }));

await record('catalog contains three unique public-domain book links', 'Project Gutenberg', async () => {
  if (gutenbergBooks.length !== 3) {
    throw new Error(`found ${gutenbergBooks.length} Project Gutenberg links`);
  }
  if (new Set(gutenbergBooks.map(({ url }) => url)).size !== gutenbergBooks.length) {
    throw new Error('catalog contains duplicate Project Gutenberg links');
  }
  return '3 unique ebook records';
});

await record('daily public-domain book sample', 'Project Gutenberg', () => {
  const sample = dailySample(gutenbergBooks, 131);
  if (!sample) throw new Error('catalog has no Project Gutenberg book to sample');
  return probe(sample.url, { allowed: [429] }).then(
    (detail) => `${detail}: ebook ${sample.ebookId}`,
  );
});

const chineseLibrarySource = await readFile('features/library/ChineseLibrary.ts', 'utf8');
const chineseLibraryCatalogUrl = chineseLibrarySource.match(
  /CHINESE_LIBRARY_CATALOG_URL\s*=\s*\n?\s*'(https:\/\/api\.sdabible\.org\/[^']+)'/,
)?.[1];

await record('current EGW cover catalog', 'Chinese Union Mission library', async () => {
  if (!chineseLibraryCatalogUrl) throw new Error('cover catalog URL is missing');
  const catalog = await getJson(chineseLibraryCatalogUrl);
  const books = Array.isArray(catalog.childCategories) ? catalog.childCategories : [];
  const curatedIds = new Set([127, 128, 55, 81, 75, 120, 34, 16, 50, 13, 23]);
  const availableIds = new Set(books.map(({ book_id }) => book_id));
  assertContainsSet(availableIds, curatedIds, 'Chinese cover catalog');
  const sample = dailySample(
    books.filter(({ book_id, thumbnail }) => curatedIds.has(book_id) && thumbnail),
    149,
  );
  if (!sample) throw new Error('catalog has no curated cover sample');
  const coverUrl = new URL(sample.thumbnail, 'https://cms.sdabible.site/storage/').href;
  return probe(coverUrl, {
    binary: true,
    expectedHosts: ['cms.sdabible.site'],
  });
});

const egwCatalogSource = await readFile('features/library/EgwBookCatalog.ts', 'utf8');
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

for (const language of ['en', 'zh', 'es']) {
  await record(`daily ${language} text edition sample`, 'EGW Writings', async () => {
    const editions = egwEditions.filter((entry) => entry.language === language);
    const sample = dailySample(editions, language.charCodeAt(0));
    if (!sample) throw new Error(`${language} has no edition to sample`);
    const { response, text: html } = await getTextPage(sample.url, {
      expectedHosts: ['text.egwwritings.org'],
    });
    if (
      !html.includes('data-booktype="egwwritings"') ||
      !html.includes('reader-tools-fontsize-increase') ||
      !html.includes('js-btn-set-theme')
    ) {
      throw new Error(`${sample.url} did not publish the expected text reader controls`);
    }
    return `${describeResponse(response)}: ${sample.firstParagraph} with text reader controls`;
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
  ['children ministry image', 'https://assets.adventistconnect.org/newyork2/2026/07/13221357/geng_shuang-1536x1024.jpg', true],
  ['food bank image', 'https://assets.adventistconnect.org/newyork2/2025/09/28035000/mmexport1738506529402.jpg.jpg', true],
  ['Flushing fellowship image', 'https://assets.adventistconnect.org/newyork2/2026/07/01230029/flushing_fellowship_3.jpg', true],
  ['Elmhurst Sabbath image', 'https://assets.adventistconnect.org/newyork2/2026/07/19124827/elmhurst_sabbath.png', true],
  ['English-to-Chinese hymnal lookup image', 'https://assets.adventistconnect.org/newyork2/2026/08/09144957/SDAH_1985_to_Chinese_505_Hymnal_Lookup-scaled.jpg', true],
  ['Chinese-to-English hymnal lookup image', 'https://assets.adventistconnect.org/newyork2/2026/08/09144912/Chinese_505_Hymnal_to_SDAH_1985_Lookup-scaled.jpg', true],
  ['PWA install guide', 'https://youtu.be/5IwrG8BTylw?si=7FW6G4DWiJmLkz89&t=15'],
  ['staff schedule', 'https://docs.google.com/spreadsheets/d/1FqFJ8YvBA-IybOlVU1SW6ynrBGNs8Cd-9xlWz6SkkDA/edit?usp=sharing', false, [401, 403]],
  ['Adventist Giving', 'https://adventistgiving.org/donate/AN48CO'],
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
  ['Atlantic Union', 'https://atlantic-union.org/'],
];

for (const [name, url, binary = false, allowed = []] of navigationLinks) {
  await record(name, 'App navigation', () => probe(url, { binary, allowed: [...allowed, 429] }));
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

const failed = checks.filter(({ status }) => status === 'failed');
const report = {
  generatedAt: new Date().toISOString(),
  summary: { total: checks.length, passed: checks.length - failed.length, failed: failed.length },
  checks,
};
await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
console.log(`\n${report.summary.passed}/${report.summary.total} checks passed. Report: ${REPORT_PATH}`);
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
    `**${report.summary.passed}/${report.summary.total} checks passed; ${report.summary.failed} failed.**`,
  ];
  if (failed.length) {
    lines.push(
      '',
      '| Provider | Check | Error |',
      '| --- | --- | --- |',
      ...failed.map(({ provider, name, error }) => `| ${escapeCell(provider)} | ${escapeCell(name)} | ${escapeCell(error)} |`),
    );
  }
  lines.push('', `Full JSON report: \`${REPORT_PATH}\``);
  await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
}
