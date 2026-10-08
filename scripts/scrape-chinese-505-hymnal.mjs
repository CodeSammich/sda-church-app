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

const links = [...html.matchAll(linkPattern)];
if (links.length < 500) {
  throw new Error(`Expected at least 500 hymn links, found ${links.length}.`);
}

const entries = links
  .map((match) => {
    const pageId = Number.parseInt(match[1], 10);
    return {
      number: NUMBER_BY_PAGE_ID.get(pageId) ?? Number.parseInt(match[2], 10),
      title: decodeHtml(match[3]),
      pageId,
    };
  })
  .filter(({ pageId }) => !DUPLICATE_PAGE_IDS.has(pageId));

const uniqueNumbers = new Set(entries.map(({ number }) => number));
const uniquePageIds = new Set(entries.map(({ pageId }) => pageId));
if (uniqueNumbers.size !== entries.length || uniquePageIds.size !== entries.length) {
  throw new Error('The scraped directory contains duplicate hymn numbers or page IDs.');
}

entries.sort((a, b) => a.number - b.number);

const data = Object.fromEntries(
  entries.map(({ number, title, pageId }) => [number, { title, pageId }]),
);

await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const missing = Array.from({ length: 505 }, (_, index) => index + 1).filter(
  (number) => !uniqueNumbers.has(number),
);

console.log(
  `Wrote ${entries.length} Chinese 505 hymnal links to ${outputPath}. Missing source entries: ${missing.join(', ') || 'none'}.`,
);
