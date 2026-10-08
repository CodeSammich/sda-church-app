import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  getChinese505PianoUrl,
  getSortedChinese505Hymns,
} from '@/features/hymnal/Chinese505Hymnal';
import piano505Data from '@/features/hymnal/Chinese505PianoYouTube.json';
import { getEnglishHymnPianoUrl, getSortedHymns } from '@/features/hymnal/EnglishHymnal';
import pianoData from '@/features/hymnal/EnglishHymnalPianoYouTube.json';

type PlaylistVideo = { videoId: string; title: string };

// Runs a mapping script on a made-up playlist and returns its log and mapping.
const runScript = (script: string, playlist: PlaylistVideo[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'hymn-piano-youtube-'));
  const input = join(dir, 'playlist.json');
  const output = join(dir, 'mapping.json');
  writeFileSync(input, JSON.stringify(playlist));
  const log = execFileSync(
    process.execPath,
    [resolve(script), '--input', input, '--output', output],
    { encoding: 'utf8' },
  );
  return { log, mapping: JSON.parse(readFileSync(output, 'utf8')) };
};

const expectDistinctVideosForRealHymns = (
  videos: [string, string][],
  hymnNumbers: Set<string>,
) => {
  for (const [number, videoId] of videos) {
    expect(hymnNumbers.has(number)).toBe(true);
    expect(videoId).toMatch(/^[\w-]{11}$/);
  }
  expect(new Set(videos.map(([, videoId]) => videoId)).size).toBe(videos.length);
};

describe('English hymn piano accompaniments', () => {
  const hymnNumbers = new Set(getSortedHymns().map(({ number }) => String(number)));
  const videos = Object.entries(pianoData.videos);

  it('maps only real hymn numbers to distinct YouTube videos', () => {
    expect(videos.length).toBeGreaterThanOrEqual(650);
    expectDistinctVideosForRealHymns(videos, hymnNumbers);
  });

  it('links a mapped hymn to its accompaniment and leaves the rest without one', () => {
    expect(getEnglishHymnPianoUrl(1)).toBe('https://www.youtube.com/watch?v=Uoi3zhcXZrM');
    expect(getEnglishHymnPianoUrl('12')).toBe('https://www.youtube.com/watch?v=NCIYV5vWaSc');
    // Not in the playlist; see scripts/map-english-hymnal-piano-youtube.mjs.
    expect(getEnglishHymnPianoUrl(30)).toBeUndefined();
  });
});

describe('scripts/map-english-hymnal-piano-youtube.mjs', () => {
  it('maps a video only when its number and title match the hymn', () => {
    const { log, mapping } = runScript('scripts/map-english-hymnal-piano-youtube.mjs', [
      // Hymn 1 twice: the video already mapped wins over a newer upload.
      { videoId: 'newUpload01', title: 'Praise to the Lord instrumental with lyrics | SDA HYMNAL 1' },
      { videoId: 'Uoi3zhcXZrM', title: 'Praise to the lord the almighty instrumental with lyrics | SDA HYMNAL 1' },
      // Another title format, and the hymnal's tune name in parentheses.
      {
        videoId: 'hamburg0154',
        title: 'When I Survey the Wondrous Cross Instrumental With Lyrics   SDA HYMNAL 154',
      },
      // Hymn 671 has a reviewed title: its first line.
      { videoId: 'reviewed671', title: 'Now Dear Lord As We Pray Hymn Instrumental With Lyrics   SDA HYMNAL 671' },
      // A different hymn under hymn 64's number is left for review.
      { videoId: 'wrongHymn64', title: 'Abide With Me Tis Eventide Instrumental with lyrics  | SDA HYMNAL 64' },
      { videoId: 'notAHymn123', title: 'When in our music God is glorified instrumental with lyrics' },
    ]);

    expect(mapping.playlistId).toBe(pianoData.playlistId);
    expect(mapping.videos).toEqual({ 1: 'Uoi3zhcXZrM', 154: 'hamburg0154', 671: 'reviewed671' });
    expect(log).toContain('Mapped 3 of 695 hymns from 6 videos.');
    expect(log).toContain('64: "Abide With Me Tis Eventide" (hymnal: "Lord, Dismiss Us With Thy Blessing")');
  });
});

describe('505 hymn piano accompaniments', () => {
  const hymnNumbers = new Set(getSortedChinese505Hymns().map(({ number }) => String(number)));
  const videos = Object.entries(piano505Data.videos);

  it('maps only real hymn numbers to distinct YouTube videos', () => {
    expect(videos.length).toBeGreaterThanOrEqual(490);
    expectDistinctVideosForRealHymns(videos, hymnNumbers);
  });

  it('links a mapped hymn to its accompaniment and leaves the rest without one', () => {
    expect(getChinese505PianoUrl(1)).toBe('https://www.youtube.com/watch?v=JxR9rqNut-s');
    // The playlist's 493 and 494 have each other's numbers.
    expect(getChinese505PianoUrl(493)).toBeUndefined();
  });
});

describe('scripts/map-chinese-505-piano-youtube.mjs', () => {
  it('maps a video only when its number and Chinese title match the hymn', () => {
    const { log, mapping } = runScript('scripts/map-chinese-505-piano-youtube.mjs', [
      // Hymn 1 twice: the video already mapped wins over a newer upload.
      { videoId: 'newUpload01', title: '001 在主寶座前' },
      { videoId: 'JxR9rqNut-s', title: "01 在主寶座前Before Jehovah's Awful Throne" },
      // Cut short, after a parenthesis: the hymnal's title is 主在锡安掌王权.
      { videoId: 'cutShort048', title: '48)主在錫安掌The Lord in Zion reigneth' },
      // Hymn 63 has a reviewed title: the hymnal's has a typo (没 for 美).
      { videoId: 'reviewed063', title: '63)美哉小城O little town of Bethlehem' },
      // Another hymn under hymn 493's number is left for review.
      { videoId: 'otherHym493', title: '493)靠主得勝Conquering now and still to conquer' },
      { videoId: 'notAHymn123', title: 'Hymns piano lyrics' },
    ]);

    expect(mapping.playlistId).toBe(piano505Data.playlistId);
    expect(mapping.videos).toEqual({ 1: 'JxR9rqNut-s', 48: 'cutShort048', 63: 'reviewed063' });
    expect(log).toContain('Mapped 3 of 499 hymns from 6 videos.');
    expect(log).toContain('493: "靠主得勝" (hymnal: "赞美耶和华")');
  });
});
