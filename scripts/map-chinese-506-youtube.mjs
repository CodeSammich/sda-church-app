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
// Usage, as for every playlist mapping (scripts/youtube-hymn-playlist.mjs):
//   YOUTUBE_API_KEY=... node scripts/map-chinese-506-youtube.mjs
//   node scripts/map-chinese-506-youtube.mjs --input playlist.json [--output file.json]

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { normalizeChineseTitle, runPlaylistMapping } from './youtube-hymn-playlist.mjs';

const MAPPING = resolve('features/hymnal/Chinese506YouTube.json');
const HYMNAL = resolve('features/hymnal/Chinese506Hymnal.json');

// Same hymn and number, different wording, some from typos in the video titles.
// Typos in the hymnal's own titles are corrected in scrape-chinese-506-hymnal.mjs.
const REVIEWED_TITLES = {
  7: '萬有之王',
  49: '主愛越久越寶',
  88: '榮耀天君',
  119: '耶穌必快來',
  124: '未日回天家',
  151: '遵守十誡',
  168: '當轉眼仰望耶穌 1',
  213: '黃金之邦',
  274: '主的什一',
  299: '更加愛祢',
  308: '倚靠主臂膀',
  313: '華冠代替塵灰',
  427: '求主導我',
  443: '感恩信徒一齊來',
};

await runPlaylistMapping({
  mappingPath: MAPPING,
  hymnal: JSON.parse(await readFile(HYMNAL, 'utf8')),
  parseTitle: (title) => {
    const match = title.trim().match(/^(\d{1,3})\s*(.+)$/);
    return match && { number: Number(match[1]), videoTitle: match[2].trim() };
  },
  matches: (number, videoTitle, hymnTitle) =>
    normalizeChineseTitle(videoTitle) === normalizeChineseTitle(hymnTitle) ||
    REVIEWED_TITLES[number] === videoTitle,
});
