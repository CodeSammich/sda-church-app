#!/usr/bin/env node

// Maps 506 hymn numbers to recordings in a YouTube playlist of the 506 hymnal,
// so the hymnal's YouTube button can open the hymn itself instead of a search.
//
// A video is mapped only when its number and title match the hymn:
// - the title, converted to Simplified Chinese, equals the hymnal's title,
//   apart from punctuation, spaces, and the reverential forms 祢, 祂, and 阿; or
// - the number is in REVIEWED_TITLES and the video's title is exactly the one a
//   person compared against the hymn. A changed title needs a new review.
//
// Usage:
//   YOUTUBE_API_KEY=... node scripts/map-chinese-506-youtube.mjs
//   node scripts/map-chinese-506-youtube.mjs --input playlist.json [--output file.json]
//
// The key is a YouTube Data API v3 key; the API has a free daily quota. The
// input file is a JSON array of { "videoId": "...", "title": "..." }.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import OpenCC from 'opencc-js/t2cn';

const MAPPING = resolve('features/hymnal/Chinese506YouTube.json');
const HYMNAL = resolve('features/hymnal/Chinese506Hymnal.json');

// Same hymn and number, different wording. Some are typos in the video titles
// and some in the hymnal's source directory.
const REVIEWED_TITLES = {
  7: '萬有之王',
  49: '主愛越久越寶',
  59: '昨日 今日 直到永遠',
  88: '榮耀天君',
  89: '到各山嶺去傳揚',
  119: '耶穌必快來',
  124: '未日回天家',
  129: '我們回天家',
  151: '遵守十誡',
  159: '我聽主聲歡迎',
  168: '當轉眼仰望耶穌 1',
  203: '寶血大權能',
  213: '黃金之邦',
  274: '主的什一',
  299: '更加愛祢',
  308: '倚靠主臂膀',
  313: '華冠代替塵灰',
  319: '主永不離你',
  337: '禱告良辰',
  344: '得福良辰',
  427: '求主導我',
  443: '感恩信徒一齊來',
};

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

const normalizeTitle = (title) =>
  toSimplified(title)
    .replace(/[祢妳]/g, '你')
    .replace(/祂/g, '他')
    .replace(/阿/g, '啊')
    .replace(/[\s\p{P}]/gu, '');

const mapVideos = (videos, hymnal, current = {}) => {
  const mapped = {};
  const needsReview = [];
  for (const { videoId, title } of videos) {
    const match = title.trim().match(/^(\d{1,3})\s*(.+)$/);
    if (!match) continue;
    const number = Number(match[1]);
    const videoTitle = match[2].trim();
    const hymn = hymnal[number];
    if (!hymn) continue;
    const matches =
      normalizeTitle(videoTitle) === normalizeTitle(hymn.title) ||
      REVIEWED_TITLES[number] === videoTitle;
    if (!matches) {
      needsReview.push(`${number}: "${videoTitle}" (hymnal: "${hymn.title}") https://youtu.be/${videoId}`);
      continue;
    }
    // Some hymns were uploaded twice. Keep the video already mapped, else the
    // first one in playlist order.
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
  const hymnal = JSON.parse(await readFile(HYMNAL, 'utf8'));

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
