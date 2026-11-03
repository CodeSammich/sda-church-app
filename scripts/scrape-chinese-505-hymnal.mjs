#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SOURCE_URL =
  'https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=59';
const DEFAULT_OUTPUT = resolve('features/hymnal/Chinese505Hymnal.json');

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const inputPath = valueAfter('--input');
const outputPath = resolve(valueAfter('--output') || DEFAULT_OUTPUT);

const html = inputPath
  ? await readFile(resolve(inputPath), 'utf8')
  : await fetch(SOURCE_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`Could not download ${SOURCE_URL}: HTTP ${response.status}`);
      }
      return response.text();
    });

const decodeHtml = (value) =>
  value
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    // Decode ampersands last so an encoded entity such as &amp;quot; is not
    // decoded twice in one pass.
    .replaceAll('&amp;', '&')
    .trim();

const linkPattern =
  /<a\s+href="\/index\.php\?m=content(?:&amp;|&)c=index(?:&amp;|&)a=show(?:&amp;|&)catid=59(?:&amp;|&)id=(\d+)"[^>]*>(\d+)\.([^<]+)<\/a>/g;

// Pages whose title has another number than the score they show. The score's
// number wins; each was checked against the score image. ID 6291 sits between
// 482 and 484 but is labeled as a second 383, and its title is "荣美之山".
const NUMBER_BY_PAGE_ID = new Map([
  [5992, 193], // "194.万福根源", whose score is 第193首
  [6003, 206], // "207.将进天乡", whose score is 第206首
  [6291, 483],
]);

// "370.黄昏求恩" shows 第37首, the score already listed as 37, so there is no
// page for 370. "362.我愿见耶稣" shows 第36首's score, but its number and title
// are right, so it stays.
const DUPLICATE_PAGE_IDS = new Set([6177]);

// Titles the directory has wrong, as printed at the top of each hymn's score
// (第N首 and the title). The church's own hymn list found them (#606); a title
// changes only where the score agrees with it.
const TITLE_BY_NUMBER = new Map([
  [7, '主慈爱如河流'], // "主慈爱如流水"
  [11, '赞美三一真神'], // a dash, "三—真神"
  [27, '赞主圣名'], // "赞主盛名"
  [63, '美哉小城'], // "没哉小城"
  [71, '巍然乘驴'], // "魏然乘驴"
  [78, '请往客西马尼'], // "前往客西马尼"
  [79, '愿钉十架'], // "愿钉十字架"
  [86, '神圣纯爱'], // "圣神纯爱"
  [88, '我有一好友'], // "我有一好朋友"
  [99, '快来拥祂为王'], // "快来拥他为王"
  [109, '公义审判之主'], // "公益审判之主"
  [113, '信徒须宣告'], // "信徒需宣告"
  [114, '儆醒预备'], // "僸醒预备"
  [127, '务要忠心'], // "勿要忠心"
  [142, '主施鸿恩'], // "主施洪恩"
  [146, '上帝圣言万古存'], // "上帝圣言万古传"
  [160, '只要靠祂'], // "只要靠他"
  [183, '卸罪与主'], // "缷罪与主"
  [203, '世上城邑'], // "世上呈邑"
  [235, '圣明洞鉴'], // "圣名洞鉴"
  [239, '先求真光'], // "先求真观"
  [248, '主照祢旨意'], // "主照你旨意"
  [249, '我要跟从祢'], // "我要跟从你"
  [260, '披主义袍'], // "批主义袍"
  [291, '抛碇于灵磐'], // "抛碇灵磐"
  [298, '我甚爱祂'], // "我甚爱他"
  [306, '至宝圣名'], // "至宝盛名"
  [317, '流泪作工'], // "流泪做工"
  [325, '因爱作工'], // "因爱做工"
  [338, '务要提防'], // "勿要提防"
  [344, '洪福之望'], // "洪福之愿"
  [381, '上主是我牧者'], // "上主是我牧场"
  [453, '谨守十诫'], // "觐守十诫"
  [492, '赞美天上真神'], // "赞美天山真神"
]);

// Hymns with no page in the directory, titled as printed on their score
// images. They're listed without a page ID, so the app opens the directory for
// them. The image for 90 shows 第89首, so 90's title is the church's hymn list's,
// which its English twin, AH 254 The Great Physician Now Is Near, bears out.
const UNLINKED_TITLES = new Map([
  [90, '至大神医'],
  [194, '罪人良友'],
  [201, '将有大喜乐'],
  [207, '感恩信徒一齐来'],
  [307, '我爱说主的故事'],
  [370, '求主启示'],
]);

const links = [...html.matchAll(linkPattern)];
if (links.length < 500) {
  throw new Error(`Expected at least 500 hymn links, found ${links.length}.`);
}

const entries = links
  .map((match) => {
    const pageId = Number.parseInt(match[1], 10);
    const number = NUMBER_BY_PAGE_ID.get(pageId) ?? Number.parseInt(match[2], 10);
    return { number, title: TITLE_BY_NUMBER.get(number) ?? decodeHtml(match[3]), pageId };
  })
  .filter(({ pageId }) => !DUPLICATE_PAGE_IDS.has(pageId));

const uniqueNumbers = new Set(entries.map(({ number }) => number));
const uniquePageIds = new Set(entries.map(({ pageId }) => pageId));
if (uniqueNumbers.size !== entries.length || uniquePageIds.size !== entries.length) {
  throw new Error('The scraped directory contains duplicate hymn numbers or page IDs.');
}

// A page the directory adds later wins over its unlinked title.
for (const [number, title] of UNLINKED_TITLES) {
  if (!uniqueNumbers.has(number)) entries.push({ number, title });
}

entries.sort((a, b) => a.number - b.number);

const data = Object.fromEntries(
  entries.map(({ number, title, pageId }) => [number, pageId ? { title, pageId } : { title }]),
);

await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const listed = new Set(entries.map(({ number }) => number));
const missing = Array.from({ length: 505 }, (_, index) => index + 1).filter(
  (number) => !listed.has(number),
);
const unlinked = entries.filter(({ pageId }) => !pageId).map(({ number }) => number);

console.log(
  `Wrote ${entries.length} Chinese 505 hymns to ${outputPath}. Without a page: ${unlinked.join(', ') || 'none'}. Missing: ${missing.join(', ') || 'none'}.`,
);
