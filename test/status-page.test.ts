import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import { BULLETIN_API_BASE_URL } from '@/constants/ExternalLinks';
import {
  getAudioPowerCuvChapterLinks,
  getCantoneseCuvChapterUrl,
  getRv1909ChapterLinks,
} from '@/services/BibleAudioSources';

/**
 * The status page (#618) checks the app's audio hosts and bulletin API every
 * 5 minutes, from the table in docs/operations/status-page.md, copied into
 * `.upptimerc.yml` in the sda-church-app-status repository. When the app's own
 * addresses change, such as after the audio is uploaded to Adventist Connect
 * again, this test fails: update the table and `.upptimerc.yml` together.
 */
const repoFile = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const page = repoFile('docs/operations/status-page.md');

/** Each row of the "What it checks" table: its Check and Address columns. */
const rows = page
  .split('## What it checks')[1]
  .split('\n## ')[0]
  .split('\n')
  .map((line) => line.match(/^\| ([^|]+?) \| `(https:\/\/[^`]+)` \|/))
  .filter((match): match is RegExpMatchArray => match !== null)
  .map(([, name, url]) => [name, url] as const);
const checks = new Map(rows);
const check = (name: string) => {
  const url = checks.get(name);
  if (!url) throw new Error(`docs/operations/status-page.md has no "${name}" check`);
  return url;
};

const mandarin = ([] as string[]).concat(Object.values(getAudioPowerCuvChapterLinks('JHN', 3))[0]);
const helloaoBase = repoFile('services/BibleAudioDownloads.ts').match(/const HELLOAO_AUDIO = '([^']+)'/)?.[1];

describe('status page checks', () => {
  it('lists ten checks, each with its own name and address', () => {
    expect(rows).toHaveLength(10);
    expect(checks.size).toBe(10);
    expect(new Set(rows.map(([, url]) => url)).size).toBe(10);
  });

  it("checks John 3 at each of the app's Mandarin sources, in the app's order", () => {
    expect(mandarin).toEqual([
      check('Adventist Connect, Mandarin audio'),
      check('Internet Archive, Mandarin fallback'),
      check('Audio Power, Mandarin fallback'),
    ]);
  });

  it("checks the church's Cantonese and Spanish copies of John 3", () => {
    expect(check('Adventist Connect, Cantonese audio')).toBe(getCantoneseCuvChapterUrl('JHN', 3));
    expect(Object.values(getRv1909ChapterLinks('JHN', 3)).flat()).toEqual([
      check('Adventist Connect, Spanish audio'),
    ]);
  });

  it('checks an English chapter where the app downloads it from HelloAO', () => {
    const url = check('HelloAO, English audio');
    const narrator = url.match(/\/JHN\/3\/audio\/([a-z]+)\.mp3$/)?.[1];
    expect(helloaoBase).toBeDefined();
    expect(url).toBe(`${helloaoBase}/JHN/3/audio/${narrator}.mp3`);
    expect(Object.keys(BIBLE_AUDIO_DOWNLOAD_SIZES)).toContain(narrator);
  });

  it("checks the app's bulletin API, with an answer that needs no date", () => {
    expect(check('Bulletin API')).toBe(`${BULLETIN_API_BASE_URL}?changeovers=1&client=check`);
  });

  it('asks audio hosts for headers only, never the recording', () => {
    const audioRows = page.split('\n').filter((line) => /\| `https:\/\/[^`]+\.mp3` \|/.test(line));
    expect(audioRows).toHaveLength(6);
    for (const row of audioRows) expect(row).toMatch(/\| `HEAD` \|$/);
  });
});
