import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fireEvent } from '@testing-library/react-native';
import { createElement } from 'react';
import { openURL, openYouTubeSearch } from '@/constants/ExternalLinks';
import {
  getChinese506YouTubeUrl,
  getSortedChinese506Hymns,
} from '@/features/hymnal/Chinese506Hymnal';
import youtubeData from '@/features/hymnal/Chinese506YouTube.json';
import { createHymnRowStyles, HymnRow } from '@/features/hymnal/HymnRow';
import { renderWithPreferences } from './helpers/render-preferences';

jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  openURL: jest.fn(),
  openYouTubeSearch: jest.fn(),
}));

describe('Chinese 506 hymnal recordings', () => {
  const hymnNumbers = new Set(getSortedChinese506Hymns().map(({ number }) => String(number)));
  const videos = Object.entries(youtubeData.videos);

  it('maps only real hymn numbers to distinct YouTube videos', () => {
    expect(videos.length).toBeGreaterThanOrEqual(450);
    for (const [number, videoId] of videos) {
      expect(hymnNumbers.has(number)).toBe(true);
      expect(videoId).toMatch(/^[\w-]{11}$/);
    }
    expect(new Set(videos.map(([, videoId]) => videoId)).size).toBe(videos.length);
  });

  it('links a mapped hymn to its video and leaves the rest to search', () => {
    expect(getChinese506YouTubeUrl(1)).toBe('https://www.youtube.com/watch?v=wKCtkPLdAYM');
    // Not uploaded to the playlist yet; see scripts/map-chinese-506-youtube.mjs.
    expect(getChinese506YouTubeUrl(506)).toBeUndefined();
  });

  it('opens the recording when there is one and searches YouTube otherwise', () => {
    const row = (hymn: { number: number; title: string }) =>
      createElement(HymnRow, {
        key: hymn.number,
        hymnalId: 'chinese-hymnal-506',
        hymn,
        highlighted: false,
        labels: {
          withSinging: 'With singing',
          pianoOnly: 'Piano only',
          youtubeHint: '',
          scriptureHint: '',
          crossReference: () => '',
          crossReferenceLabel: () => '',
          crossReferenceHint: '',
        },
        styles: createHymnRowStyles(1, 1, false),
        onOpenScripture: jest.fn(),
        onOpenCrossReference: jest.fn(),
      });
    const screen = renderWithPreferences(
      createElement(
        'View',
        null,
        row({ number: 1, title: '圣哉真神' }),
        row({ number: 506, title: '阿门' }),
      ),
    );
    // The 506 hymnal has no piano accompaniments yet.
    expect(screen.queryByText('Piano only')).toBeNull();
    const [first, last] = screen.getAllByText('With singing');

    fireEvent.press(first);
    expect(openURL).toHaveBeenCalledWith(
      'https://www.youtube.com/watch?v=wKCtkPLdAYM',
      'Error',
      'Could not open the YouTube video.',
    );
    expect(openYouTubeSearch).not.toHaveBeenCalled();

    fireEvent.press(last);
    expect(openYouTubeSearch).toHaveBeenCalledWith('506版赞美诗 506 阿门');
  });
});

describe('scripts/map-chinese-506-youtube.mjs', () => {
  const run = (playlist: { videoId: string; title: string }[]) => {
    const dir = mkdtempSync(join(tmpdir(), 'hymnal-506-youtube-'));
    const input = join(dir, 'playlist.json');
    const output = join(dir, 'mapping.json');
    writeFileSync(input, JSON.stringify(playlist));
    const log = execFileSync(
      process.execPath,
      [resolve('scripts/map-chinese-506-youtube.mjs'), '--input', input, '--output', output],
      { encoding: 'utf8' },
    );
    return { log, mapping: JSON.parse(readFileSync(output, 'utf8')) };
  };

  it('maps a video only when its number and title match the hymn', () => {
    const { log, mapping } = run([
      // Hymn 1 twice: the video already mapped wins over a newer upload.
      { videoId: 'newUpload01', title: '001 聖哉真神' },
      { videoId: 'wKCtkPLdAYM', title: '001聖哉真神' },
      // Traditional characters and a reverential form (祢 for 你).
      { videoId: 'traditional', title: '299 更加愛祢' },
      // Hymn 7 has a reviewed title difference: 王 for 主.
      { videoId: 'reviewed007', title: '007 萬有之王' },
      // A different hymn under hymn 2's number is left for review.
      { videoId: 'wrongHymn02', title: '002 奇異恩典' },
      { videoId: 'notAHymn123', title: 'Playlist introduction' },
    ]);

    expect(mapping.playlistId).toBe(youtubeData.playlistId);
    expect(mapping.videos).toEqual({ 1: 'wKCtkPLdAYM', 7: 'reviewed007', 299: 'traditional' });
    expect(log).toContain('Mapped 3 of 506 hymns from 6 videos.');
    expect(log).toContain('2: "奇異恩典" (hymnal: "在主宝座前")');
  });
});
