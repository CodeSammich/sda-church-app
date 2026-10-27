/**
 * Downloads two other copies of the 1919 Chinese Union Version, verse by
 * verse, for test/cuv-1919-witnesses.test.ts, which checks the app's text
 * against them (#517):
 *
 * - Wikisource's transcription, 聖經 (和合本), at the revision of each book
 *   recorded in docs/rights-records/cuv-1919-2026-10-27/wikisource-revisions.json.
 * - open-bibles' chi-cuv (Traditional) and chi-cuv-simp (Simplified), checked
 *   against the SHA-256 below.
 *
 * Neither is the app's source (WordProject; see scripts/build-cuv-1919.mjs),
 * so where the app's text matches them, it matches independent copies. Both
 * are public domain; see the rights record.
 *
 * It writes test/fixtures/cuv-1919-witnesses/<copy>.json, each verse's text as
 * that copy has it, without cross-references, Psalm titles, or markup. Usage:
 *   node scripts/cuv-1919-witnesses.mjs
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOOK_IDS } from './build-cuv-1919.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'test/fixtures/cuv-1919-witnesses');
const RECORD = 'docs/rights-records/cuv-1919-2026-10-27/wikisource-revisions.json';

// Wikisource's book pages, in Bible order: 聖經 (和合本)/<title>.
const WIKISOURCE_TITLES = [
  '創世記', '出埃及記', '利未記', '民數記', '申命記', '約書亞記', '士師記', '路得記', '撒母耳記上',
  '撒母耳記下', '列王紀上', '列王紀下', '歷代志上', '歷代志下', '以斯拉記', '尼希米記', '以斯帖記',
  '約伯記', '詩篇', '箴言', '傳道書', '雅歌', '以賽亞書', '耶利米書', '耶利米哀歌', '以西結書',
  '但以理書', '何西阿書', '約珥書', '阿摩司書', '俄巴底亞書', '約拿書', '彌迦書', '那鴻書', '哈巴谷書',
  '西番雅書', '哈該書', '撒迦利亞書', '瑪拉基書', '馬太福音', '馬可福音', '路加福音', '約翰福音',
  '使徒行傳', '羅馬書', '哥林多前書', '哥林多後書', '加拉太書', '以弗所書', '腓立比書', '歌羅西書',
  '帖撒羅尼迦前書', '帖撒羅尼迦後書', '提摩太前書', '提摩太後書', '提多書', '腓利門書', '希伯來書',
  '雅各書', '彼得前書', '彼得後書', '約翰一書', '約翰二書', '約翰三書', '猶大書', '啟示錄',
];

const OPEN_BIBLES = [
  {
    name: 'open-bibles',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/chi-cuv.usfx.xml',
    sha256: '049e36ec3ee1b5c9bc2c8bfd2ca07f9f1f30398838f692d12ea38a092d41fe4b',
  },
  {
    name: 'open-bibles-simplified',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/chi-cuv-simp.usfx.xml',
    sha256: 'bea9f6e4fd35b70a67e3978ce8b9dc0ad853078e67472653cf1b34f357ae3abf',
  },
];

// Wikimedia asks scripts to say who they are.
const USER_AGENT =
  'sda-church-app CUV check (https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app)';

const download = async (url) => {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
};

/**
 * One verse of Wikisource's wikitext as plain text. Notes ({{*|…}}) become
 * 〔…〕 and Selah ({{-|細拉}}) 〔細拉〕, as in the 1919 print. Other small text
 * ({{-|…}}) is a Psalm title, and cross-references are <sup> links or lines
 * starting with ":"; those are dropped. Templates nest, as in Isaiah 30:16's
 * {{udots|牲{{!|𤘘|牛口}}}}, so the innermost go first.
 */
export const wikisourceVerse = (wikitext) => {
  let text = wikitext
    .split(/\n==/)[0]
    .split('\n')
    .filter((line) => !line.startsWith(':'))
    .join('\n')
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>|<ref[^>]*\/>/g, '')
    .replace(/<sup>[\s\S]*?<\/sup>/g, '')
    .replace(/\{\{-\|細拉\}\}/g, '〔細拉〕');
  // The templates that hold text first, until none is left, then the rest
  // (verse numbers, anchors), so an outer template isn't dropped before its
  // inner one gives up its text.
  for (let previous = ''; previous !== text; ) {
    previous = text;
    text = text
      .replace(/\{\{udots\|([^{}|]*)\}\}/g, '$1')
      .replace(/\{\{\*\|([^{}]*)\}\}/g, '〔$1〕')
      .replace(/\{\{!\|([^{}|]*)\|[^{}]*\}\}/g, '$1')
      .replace(/\{\{\+\|([^{}]*)\}\}/g, '$1')
      .replace(/\{\{-\|[^{}]*\}\}/g, '');
  }
  for (let previous = ''; previous !== text; ) {
    previous = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, '');
  }
  return text
    .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/'''|''/g, '')
    .replace(/[ \t\r\n ]+/g, '')
    .replace(/^　+|　+$/g, '');
};

export const wikisourceBook = (book, wikitext) => {
  const verses = {};
  const parts = wikitext.split(/\{\{verse\|(\d+)\|(\d+)\}\}/);
  for (let i = 1; i < parts.length; i += 3) {
    verses[`${book} ${Number(parts[i])}:${Number(parts[i + 1])}`] = wikisourceVerse(parts[i + 2]);
  }
  return verses;
};

/** open-bibles' USFX: <book id> <c id/> <v id/>text<ve/>, books in Bible order. */
export const usfxVerses = (xml) => {
  const verses = {};
  const books = [...xml.matchAll(/<book id="[A-Z0-9]+">([\s\S]*?)<\/book>/g)];
  if (books.length !== BOOK_IDS.length) throw new Error(`USFX has ${books.length} books`);
  books.forEach(([, body], index) => {
    let chapter = 0;
    for (const [, c, v, text] of body.matchAll(/<c id="(\d+)"\/>|<v id="(\d+)"\/>([\s\S]*?)<ve\/>/g)) {
      if (c) chapter = Number(c);
      else verses[`${BOOK_IDS[index]} ${chapter}:${Number(v)}`] = text.replace(/<[^>]+>/g, '').trim();
    }
  });
  return verses;
};

// One verse per line, so a change to a copy shows verse by verse in a diff.
const write = (name, about, verses) => {
  mkdirSync(out, { recursive: true });
  const lines = Object.entries(verses).map(([ref, text]) => `  ${JSON.stringify(ref)}: ${JSON.stringify(text)}`);
  writeFileSync(join(out, `${name}.json`), `{"about": ${JSON.stringify(about)}, "verses": {\n${lines.join(',\n')}\n}}\n`);
  return `${name}: ${lines.length} verses`;
};

const main = async () => {
  const revisions = JSON.parse(readFileSync(join(root, RECORD), 'utf8'));
  const wikisource = {};
  for (const [index, title] of WIKISOURCE_TITLES.entries()) {
    const { revision } = revisions[title];
    const api = `https://zh.wikisource.org/w/api.php?action=parse&format=json&prop=wikitext&oldid=${revision}`;
    const { parse } = JSON.parse(await download(api));
    if (parse.title !== `聖經 (和合本)/${title}`) throw new Error(`${revision} is ${parse.title}`);
    Object.assign(wikisource, wikisourceBook(BOOK_IDS[index], parse.wikitext['*']));
  }
  const log = [
    write('wikisource', `Wikisource, 聖經 (和合本), at the revisions in ${RECORD}`, wikisource),
  ];
  for (const { name, url, sha256 } of OPEN_BIBLES) {
    const xml = await download(url);
    const hash = createHash('sha256').update(xml).digest('hex');
    if (hash !== sha256) throw new Error(`${url} changed: SHA-256 ${hash}`);
    log.push(write(name, `${url}, SHA-256 ${sha256}`, usfxVerses(xml)));
  }
  console.log(log.join('\n'));
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
