#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SOURCE_URL =
  'https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=90';
const DEFAULT_OUTPUT = resolve('features/hymnal/Chinese506Hymnal.json');

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
  /<a\s+href="\/index\.php\?m=content(?:&amp;|&)c=index(?:&amp;|&)a=show(?:&amp;|&)catid=90(?:&amp;|&)id=(\d+)"[^>]*>(\d+)[、.]([^<]+)<\/a>/g;

const entries = [...html.matchAll(linkPattern)].map((match) => ({
  number: Number.parseInt(match[2], 10),
  title: decodeHtml(match[3]),
  pageId: Number.parseInt(match[1], 10),
}));

if (entries.length !== 506) {
  throw new Error(`Expected 506 hymn links, found ${entries.length}.`);
}

const uniqueNumbers = new Set(entries.map(({ number }) => number));
const uniquePageIds = new Set(entries.map(({ pageId }) => pageId));
if (uniqueNumbers.size !== 506 || uniquePageIds.size !== 506) {
  throw new Error('The scraped directory contains duplicate hymn numbers or page IDs.');
}

const missing = Array.from({ length: 506 }, (_, index) => index + 1).filter(
  (number) => !uniqueNumbers.has(number),
);
if (missing.length > 0) {
  throw new Error(`The scraped directory is missing hymn numbers: ${missing.join(', ')}.`);
}

entries.sort((a, b) => a.number - b.number);

const data = Object.fromEntries(
  entries.map(({ number, title, pageId }) => [number, { title, pageId }]),
);

await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

console.log(`Wrote all 506 Chinese hymnal links to ${outputPath}.`);
