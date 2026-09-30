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
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    // Decode ampersands last so an encoded entity such as &amp;quot; is not
    // decoded twice in one pass.
    .replaceAll('&amp;', '&')
    .trim();

const linkPattern =
  /<a\s+href="\/index\.php\?m=content(?:&amp;|&)c=index(?:&amp;|&)a=show(?:&amp;|&)catid=90(?:&amp;|&)id=(\d+)"[^>]*>(\d+)[、.]([^<]+)<\/a>/g;

// Typos in the source directory's titles, found by comparing them with the
// hymn titles in the 506 YouTube recordings (scripts/map-chinese-506-youtube.mjs).
// Each maps the source's title to the corrected one.
const TITLE_CORRECTIONS = {
  59: ['昨日，今日，真到永远', '昨日，今日，直到永远'],
  89: ['到各山领去传扬', '到各山岭去传扬'],
  129: ['我们会天家', '我们回天家'],
  159: ['我听主生欢迎', '我听主声欢迎'],
  203: ['宝血大全能', '宝血大权能'],
  319: ['主用不离你', '主永不离你'],
  337: ['祷告良晨', '祷告良辰'],
  344: ['德福良辰', '得福良辰'],
};

const correctTitle = (number, title) => {
  const correction = TITLE_CORRECTIONS[number];
  if (!correction || title === correction[1]) return title;
  if (title !== correction[0]) {
    throw new Error(
      `Hymn ${number} is now titled "${title}" at the source. Check it and update TITLE_CORRECTIONS.`,
    );
  }
  return correction[1];
};

const entries = [...html.matchAll(linkPattern)].map((match) => {
  const number = Number.parseInt(match[2], 10);
  return {
    number,
    title: correctTitle(number, decodeHtml(match[3])),
    pageId: Number.parseInt(match[1], 10),
  };
});

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
