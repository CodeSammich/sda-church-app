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
// Usage:
//   YOUTUBE_API_KEY=... node scripts/map-english-hymnal-piano-youtube.mjs
//   node scripts/map-english-hymnal-piano-youtube.mjs --input playlist.json [--output file.json]
//
// The key is a YouTube Data API v3 key; the API has a free daily quota. The
// input file is a JSON array of { "videoId": "...", "title": "..." }.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

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

const parseVideoTitle = (title) => {
  const number = [...title.matchAll(/SDA\s*HYMNAL\s*(\d{1,3})\b/gi)].at(-1)?.[1];
  if (!number) return undefined;
  const [videoTitle] = title.split(/\s+(?:hymn\s+)?instrumental\b/i);
  return { number: Number(number), videoTitle: videoTitle.trim() };
};

const mapVideos = (videos, hymnal, current = {}) => {
  const mapped = {};
  const needsReview = [];
  for (const { videoId, title } of videos) {
    const parsed = parseVideoTitle(title);
    if (!parsed) continue;
    const { number, videoTitle } = parsed;
    const hymn = hymnal[number];
    if (!hymn) continue;
    const matches =
      normalizeTitle(videoTitle).startsWith(normalizeTitle(hymn.title)) ||
      REVIEWED_TITLES[number] === videoTitle;
    if (!matches) {
      needsReview.push(`${number}: "${videoTitle}" (hymnal: "${hymn.title}") https://youtu.be/${videoId}`);
      continue;
    }
    // Keep the video already mapped, else the first one in playlist order.
    if (!mapped[number] || current[number] === videoId) mapped[number] = videoId;
  }
  return { mapped, needsReview };
};

const fetchPlaylist = async (playlistId, key) => {
  const videos = [];
  let pageToken = '';
  do {
    const url = new URL('https://www.googleapis.com/youtube/v3/playlistItems');
    url.search = new URLSearchParams({
      part: 'snippet',
      maxResults: '50',
      playlistId,
      key,
      ...(pageToken ? { pageToken } : {}),
    }).toString();
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`YouTube Data API returned HTTP ${response.status}`);
    }
    const page = await response.json();
    for (const { snippet } of page.items) {
      videos.push({ videoId: snippet.resourceId.videoId, title: snippet.title });
    }
    pageToken = page.nextPageToken ?? '';
  } while (pageToken);
  return videos;
};

const ranges = (numbers) =>
  numbers
    .reduce((all, number) => {
      const last = all.at(-1);
      if (last && last[1] === number - 1) last[1] = number;
      else all.push([number, number]);
      return all;
    }, [])
    .map(([first, last]) => (first === last ? `${first}` : `${first}–${last}`))
    .join(', ');

const args = process.argv.slice(2);
const valueAfter = (flag) => {
  const index = args.indexOf(flag);
  return index === -1 ? undefined : args[index + 1];
};

const main = async () => {
  const inputPath = valueAfter('--input');
  const outputPath = resolve(valueAfter('--output') || MAPPING);
  const current = JSON.parse(await readFile(MAPPING, 'utf8'));
  const hymnal = await readHymnal();

  let videos;
  if (inputPath) {
    videos = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  } else if (process.env.YOUTUBE_API_KEY) {
    videos = await fetchPlaylist(current.playlistId, process.env.YOUTUBE_API_KEY);
  } else {
    throw new Error('Set YOUTUBE_API_KEY or pass --input playlist.json.');
  }

  const { mapped, needsReview } = mapVideos(videos, hymnal, current.videos);
  const numbers = Object.keys(hymnal).map(Number);
  const missing = numbers.filter((number) => !mapped[number]);
  const videosByNumber = Object.fromEntries(
    Object.entries(mapped).sort(([a], [b]) => Number(a) - Number(b)),
  );

  await writeFile(
    outputPath,
    `${JSON.stringify({ playlistId: current.playlistId, videos: videosByNumber }, null, 2)}\n`,
    'utf8',
  );

  console.log(`Mapped ${Object.keys(mapped).length} of ${numbers.length} hymns from ${videos.length} videos.`);
  if (missing.length) console.log(`No video for: ${ranges(missing)}`);
  if (needsReview.length) {
    console.log('\nThese titles differ from the hymnal. Compare each with the hymn, then add the');
    console.log('ones that match to REVIEWED_TITLES and run this again:');
    for (const line of needsReview) console.log(`  ${line}`);
  }
};

await main();
