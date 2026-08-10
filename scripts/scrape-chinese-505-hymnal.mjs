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
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();

const linkPattern =
  /<a\s+href="\/index\.php\?m=content(?:&amp;|&)c=index(?:&amp;|&)a=show(?:&amp;|&)catid=59(?:&amp;|&)id=(\d+)"[^>]*>(\d+)\.([^<]+)<\/a>/g;

const entries = [...html.matchAll(linkPattern)].map((match) => {
  const pageId = Number.parseInt(match[1], 10);
  const sourceNumber = Number.parseInt(match[2], 10);

  // The source's ID 6291 sits between 482 and 484 but is labeled as a second
  // 383. The detail title is "荣美之山", so normalize the obvious typo to 483.
  const number = pageId === 6291 && sourceNumber === 383 ? 483 : sourceNumber;

  return {
    number,
    title: decodeHtml(match[3]),
    pageId,
  };
});

if (entries.length < 500) {
  throw new Error(`Expected at least 500 hymn links, found ${entries.length}.`);
}

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
