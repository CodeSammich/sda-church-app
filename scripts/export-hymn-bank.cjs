#!/usr/bin/env node
/**
 * Writes the bulletin spreadsheet's Hymn Bank tab (#606): every hymn in the
 * church's two hymnals, the 505 Chinese Hymnal and the 1985 SDA Hymnal, each
 * in one cell written the way Weekly Data's hymn cells take it, such as
 * `第12首 讚美上帝大君王` or `AH 73 Holy, Holy, Holy`. Whoever fills in the
 * week copies a cell instead of typing the hymn.
 *
 * A row pairs a 505 hymn with the same hymn in the 1985 where
 * features/hymnal/HymnalNumberMappings.json pairs them. The 505 comes first,
 * in number order, then the 1985 hymns with no 505 pair. The app stores
 * Chinese titles in Simplified and the printed bulletin is Traditional, so
 * they're converted with opencc-js (Mainland to Taiwan), then corrected by
 * TRADITIONAL_FIXES where it picks the wrong character.
 *
 * Nothing reads the tab: the bulletin scripts ignore tabs they don't know, so
 * refreshing it needs no Apps Script deploy.
 *
 * Usage:
 *   node scripts/export-hymn-bank.cjs --output hymn-bank.tsv
 * Then open the file, select everything, copy, and paste into cell A1 of the
 * Hymn Bank tab. Without --output, it writes to standard output.
 */
const { readFileSync, writeFileSync } = require('node:fs');
const { join } = require('node:path');
const OpenCC = require('opencc-js/cn2t');

const HYMNAL_DIR = join(__dirname, '..', 'features', 'hymnal');

const HEADERS = ['Chinese Hymnal 505 中文赞美诗', 'SDA Hymnal 1985 英文诗歌本'];

// Characters opencc-js gets wrong in these titles, as [converted, correct]:
// the church's hymn list and slides both use the second.
const TRADITIONAL_FIXES = [
  ['禰', '祢'], // 祢 is "you" for God; 禰 is an ancestral tablet
  ['揹', '背'],
  ['迴天家', '回天家'],
  ['贊主', '讚主'],
  ['同贊', '同讚'],
  ['洞鑑', '洞鑒'],
  ['舍我命', '捨我命'],
];

const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

const toTraditional = (title) => {
  let traditional = converter(title);
  for (const [from, to] of TRADITIONAL_FIXES) traditional = traditional.split(from).join(to);
  return traditional;
};

// EnglishHymnal.ts is TypeScript, so this reads its `1: { title: '...' }`
// entries instead of importing it, as scripts/map-english-hymnal-piano-youtube.mjs does.
const readEnglishHymnal = (source) => {
  const hymnal = {};
  for (const [, number, title] of source.matchAll(/^ {4}(\d+): \{\s*title: '((?:[^'\\]|\\.)*)'/gm)) {
    hymnal[number] = title.replace(/\\(.)/g, '$1');
  }
  const entries = source.match(/^ {4}\d+: \{/gm).length;
  if (Object.keys(hymnal).length !== entries) {
    throw new Error(`Read ${Object.keys(hymnal).length} of ${entries} hymn titles in EnglishHymnal.ts.`);
  }
  return hymnal;
};

const readHymnals = () => {
  const { hymnals, mappings } = require(join(HYMNAL_DIR, 'HymnalNumberMappings.json'));
  return {
    english: readEnglishHymnal(readFileSync(join(HYMNAL_DIR, 'EnglishHymnal.ts'), 'utf8')),
    chinese: Object.fromEntries(
      Object.entries(require(join(HYMNAL_DIR, 'Chinese505Hymnal.json'))).map(([number, { title }]) => [
        number,
        title,
      ]),
    ),
    chineseCount: hymnals['chinese-hymnal-505'].numberRange[1],
    chineseToEnglish: mappings.find((mapping) => mapping.id === 'chinese-hymnal-505-to-sdah-1985-en')
      .numberMap,
  };
};

const formatChinese = (number, title) => (title ? `第${number}首 ${toTraditional(title)}` : `第${number}首`);
const formatEnglish = (number, title) => (title ? `AH ${number} ${title}` : `AH ${number}`);

const byNumber = (a, b) => Number(a) - Number(b);

/**
 * The tab's rows, headers first, as [505 cell, 1985 cell]. Every 505 number
 * gets a row, with only its number where the app has no title for it.
 */
const buildHymnBank = ({ english, chinese, chineseCount, chineseToEnglish }) => {
  const rows = [HEADERS];
  const paired = new Set();
  for (let number = 1; number <= chineseCount; number += 1) {
    const [englishNumber] = chineseToEnglish[number] || [];
    if (englishNumber) paired.add(String(englishNumber));
    rows.push([
      formatChinese(number, chinese[number]),
      englishNumber ? formatEnglish(englishNumber, english[englishNumber]) : '',
    ]);
  }
  for (const number of Object.keys(english).sort(byNumber)) {
    if (!paired.has(number)) rows.push(['', formatEnglish(number, english[number])]);
  }
  return rows;
};

// Tab-separated, which Google Sheets splits into columns on paste.
const toTsv = (rows) => {
  for (const cell of rows.flat()) {
    if (/[\t\n]/.test(cell)) throw new Error(`A hymn cell has a tab or line break: ${cell}`);
  }
  return `${rows.map((row) => row.join('\t')).join('\n')}\n`;
};

if (require.main === module) {
  const outputIndex = process.argv.indexOf('--output');
  const tsv = toTsv(buildHymnBank(readHymnals()));
  if (outputIndex === -1) process.stdout.write(tsv);
  else writeFileSync(process.argv[outputIndex + 1], tsv);
}

module.exports = { buildHymnBank, readEnglishHymnal, readHymnals, toTraditional, toTsv };
