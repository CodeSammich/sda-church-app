// Shared by the scripts that map hymn numbers to the videos in a YouTube
// playlist (scripts/map-*-youtube.mjs): reading the playlist, matching its
// videos to hymns, and writing the mapping.
//
// Each script runs as:
//   YOUTUBE_API_KEY=... node scripts/map-<name>-youtube.mjs
//   node scripts/map-<name>-youtube.mjs --input playlist.json [--output file.json]
//
// The key is a YouTube Data API v3 key; the API has a free daily quota. The
// input file is a JSON array of { "videoId": "...", "title": "..." }.

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import OpenCC from 'opencc-js/t2cn';

const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

/**
 * A Chinese title in Simplified characters, without punctuation, spaces, or
 * the reverential forms 祢, 祂, and 阿, so that two spellings compare equal.
 */
export const normalizeChineseTitle = (title) =>
  toSimplified(title)
    .replace(/[祢妳]/g, '你')
    .replace(/祂/g, '他')
    .replace(/阿/g, '啊')
    .replace(/[\s\p{P}]/gu, '');

/**
 * Maps each hymn number to a video. `parseTitle` returns a video's hymn number
 * and its title as the video gives it, or undefined for a video that isn't a
 * hymn. `matches` decides whether that title is the hymn's.
 */
const mapVideos = (videos, hymnal, current, { parseTitle, matches }) => {
  const mapped = {};
  const needsReview = [];
  for (const { videoId, title } of videos) {
    const parsed = parseTitle(title);
    if (!parsed) continue;
    const { number, videoTitle } = parsed;
    const hymn = hymnal[number];
    if (!hymn) continue;
    if (!matches(number, videoTitle, hymn.title)) {
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

/**
 * Reads the playlist named in the mapping file at `mappingPath`, maps its
 * videos to the hymns in `hymnal` ({ [number]: { title } }), writes the
 * mapping, and lists the hymns without a video and the videos to review.
 */
export const runPlaylistMapping = async ({ mappingPath, hymnal, parseTitle, matches }) => {
  const args = process.argv.slice(2);
  const valueAfter = (flag) => {
    const index = args.indexOf(flag);
    return index === -1 ? undefined : args[index + 1];
  };
  const inputPath = valueAfter('--input');
  const outputPath = resolve(valueAfter('--output') || mappingPath);
  const current = JSON.parse(await readFile(mappingPath, 'utf8'));

  let videos;
  if (inputPath) {
    videos = JSON.parse(await readFile(resolve(inputPath), 'utf8'));
  } else if (process.env.YOUTUBE_API_KEY) {
    videos = await fetchPlaylist(current.playlistId, process.env.YOUTUBE_API_KEY);
  } else {
    throw new Error('Set YOUTUBE_API_KEY or pass --input playlist.json.');
  }

  const { mapped, needsReview } = mapVideos(videos, hymnal, current.videos, { parseTitle, matches });
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
