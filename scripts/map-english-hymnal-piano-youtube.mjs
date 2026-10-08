#!/usr/bin/env node

// Maps SDA Hymnal (1985) numbers to piano accompaniment videos in a YouTube
// playlist, so an English hymn's Piano only button can open its accompaniment
// for a church without a pianist.
//
// The videos are titled like "Praise to the Lord the Almighty instrumental with
// lyrics | SDA HYMNAL 1". A video is mapped only when its number and title
// match the hymn:
// - the title, apart from case, punctuation, and a tune name in parentheses,
//   starts with the hymnal's title, which often keeps only a hymn's first
//   words; or
// - the number is in REVIEWED_TITLES and the video's title is exactly the one a
//   person compared against the hymn. A changed title needs a new review.
//
// Usage, as for every playlist mapping (scripts/youtube-hymn-playlist.mjs):
//   YOUTUBE_API_KEY=... node scripts/map-english-hymnal-piano-youtube.mjs
//   node scripts/map-english-hymnal-piano-youtube.mjs --input playlist.json [--output file.json]

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { runPlaylistMapping } from './youtube-hymn-playlist.mjs';

const MAPPING = resolve('features/hymnal/EnglishHymnalPianoYouTube.json');
const HYMNAL = resolve('features/hymnal/EnglishHymnal.ts');

// Same hymn and number, different wording: the hymn's first line, an older
// "ye" where the hymnal has "you", or a typo in the video's title.
const REVIEWED_TITLES = {
  59: 'Great Our Joys as Now We Gather',
  115: 'O Come, O Come Emmanuel',
  143: 'Silent Night',
  160: 'Ride On Ride On In Majesty',
  165: 'Look Ye Saints The Sight Is Glorious',
  169: 'Come Ye Faithful',
  170: 'Come Ye Faithful',
  195: 'There Shall Be Showers Of Blessing',
  210: 'Wake Awake For The Night Is Flying',
  273: 'Lord I Have Made The Word My Choice',
  278: 'Lord Jesus Once You Spoke To Me',
  282: 'Hear Thy Welcome Voice',
  299: 'Forgive Us Our Sins As We Forgive',
  368: 'Watchmen Blow The Gospel Trumpet',
  671: 'Now Dear Lord As We Pray',
};

const normalizeTitle = (title) =>
  title
    .replace(/\s*\([^)]*\)\s*$/, '')
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

// The hymn titles in EnglishHymnal.ts, which is TypeScript, so this reads its
// `1: { title: '...' }` entries instead of importing it.
const readHymnal = async () => {
  const source = await readFile(HYMNAL, 'utf8');
  const hymnal = {};
  for (const [, number, title] of source.matchAll(/^ {4}(\d+): \{\s*title: '((?:[^'\\]|\\.)*)'/gm)) {
    hymnal[number] = { title: title.replace(/\\(.)/g, '$1') };
  }
  const entries = source.match(/^ {4}\d+: \{/gm).length;
  if (Object.keys(hymnal).length !== entries) {
    throw new Error(`Read ${Object.keys(hymnal).length} of ${entries} hymn titles in ${HYMNAL}.`);
  }
  return hymnal;
};

await runPlaylistMapping({
  mappingPath: MAPPING,
  hymnal: await readHymnal(),
  parseTitle: (title) => {
    const number = [...title.matchAll(/SDA\s*HYMNAL\s*(\d{1,3})\b/gi)].at(-1)?.[1];
    if (!number) return undefined;
    const [videoTitle] = title.split(/\s+(?:hymn\s+)?instrumental\b/i);
    return { number: Number(number), videoTitle: videoTitle.trim() };
  },
  matches: (number, videoTitle, hymnTitle) =>
    normalizeTitle(videoTitle).startsWith(normalizeTitle(hymnTitle)) ||
    REVIEWED_TITLES[number] === videoTitle,
});
