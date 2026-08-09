#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const versions = [
  {
    version: 1,
    catId: 15,
    inputFlag: '--input-v1',
    outputFlag: '--output-v1',
    output: 'constants/Chinese707HymnalV1.json',
    expectedEntries: 707,
    alternateLabels: [],
  },
  {
    version: 2,
    catId: 20,
    inputFlag: '--input-v2',
    outputFlag: '--output-v2',
    output: 'constants/Chinese707HymnalV2.json',
    expectedEntries: 715,
    alternateLabels: ['260B', '261B', '657B', '661B', '683B', '700B', '704B', '705B'],
  },
  {
    version: 3,
    catId: 234,
    inputFlag: '--input-v3',
    outputFlag: '--output-v3',
    output: 'constants/Chinese707HymnalV3.json',
    expectedEntries: 715,
    alternateLabels: ['260B', '261B', '657B', '661B', '683B', '700B', '704B', '705B'],
  },
];

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const decodeHtml = (value) =>
  value
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#039;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .trim();

for (const config of versions) {
  const sourceUrl = `https://m.zgaxr.com/index.php?m=content&c=index&a=lists&catid=${config.catId}`;
  const inputPath = valueAfter(config.inputFlag);
  const outputPath = resolve(valueAfter(config.outputFlag) || config.output);
  const html = inputPath
    ? await readFile(resolve(inputPath), 'utf8')
    : await fetch(sourceUrl).then((response) => {
        if (!response.ok) {
          throw new Error(`Could not download ${sourceUrl}: HTTP ${response.status}`);
        }
        return response.text();
      });

  const linkPattern = new RegExp(
    `<a\\s+href="\\/index\\.php\\?m=content(?:&amp;|&)c=index(?:&amp;|&)a=show(?:&amp;|&)catid=${config.catId}(?:&amp;|&)id=(\\d+)"[^>]*>([^<]+)<\\/a>`,
    'g',
  );
  const entries = [...html.matchAll(linkPattern)].map((match) => {
    const textMatch = decodeHtml(match[2]).match(
      /^(\d+(?:B)?)\s*(?:[、.]\s*)?(.*?)\s*$/i,
    );
    if (!textMatch || !textMatch[2]) {
      throw new Error(
        `Could not parse version ${config.version} link text: ${match[2]}`,
      );
    }

    const sourceLabel = textMatch[1].toUpperCase();
    const baseNumber = Number.parseInt(sourceLabel, 10).toString();

    return {
      label: sourceLabel.endsWith('B') ? `${baseNumber}B` : baseNumber,
      title: textMatch[2].trim(),
      pageId: Number.parseInt(match[1], 10),
    };
  });

  if (entries.length !== config.expectedEntries) {
    throw new Error(
      `Expected ${config.expectedEntries} links for version ${config.version}, found ${entries.length}.`,
    );
  }

  const uniqueLabels = new Set(entries.map(({ label }) => label));
  const uniquePageIds = new Set(entries.map(({ pageId }) => pageId));
  if (
    uniqueLabels.size !== config.expectedEntries ||
    uniquePageIds.size !== config.expectedEntries
  ) {
    throw new Error(
      `Version ${config.version} contains duplicate hymn numbers or page IDs.`,
    );
  }

  const missing = Array.from({ length: 707 }, (_, index) => index + 1).filter(
    (number) => !uniqueLabels.has(number.toString()),
  );
  if (missing.length > 0) {
    throw new Error(
      `Version ${config.version} is missing hymn numbers: ${missing.join(', ')}.`,
    );
  }

  const missingAlternates = config.alternateLabels.filter(
    (label) => !uniqueLabels.has(label),
  );
  if (missingAlternates.length > 0) {
    throw new Error(
      `Version ${config.version} is missing alternate arrangements: ${missingAlternates.join(', ')}.`,
    );
  }

  entries.sort((a, b) => {
    const numberDifference = Number.parseInt(a.label, 10) - Number.parseInt(b.label, 10);
    return numberDifference || a.label.localeCompare(b.label);
  });
  const data = Object.fromEntries(
    entries.map(({ label, title, pageId }) => [label, { title, pageId }]),
  );

  await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  console.log(`Wrote all 707 version ${config.version} links to ${outputPath}.`);
}
