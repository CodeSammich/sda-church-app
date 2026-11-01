jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  CANTONESE_CUV_READER,
  CUV_AUDIO_READERS,
  RV1909_READER,
} from '@/services/BibleAudioSources';
import {
  fetchVerseStartTimes,
  getVerseAtAudioTime,
  VERSE_MARK_LEAD_SECONDS,
} from '@/services/BibleAudioTimings';

const readJson = (path: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'assets/bible', `${path}.biblejson`), 'utf8'));

const HELLOAO_NARRATORS = ['david', 'hays', 'souer'];
// The church's copies, with times made by aligning the bundled text with each recording.
const CHURCH_NARRATORS = [
  ['cuv-mandarin', 'cuv1919/hans'],
  ['cuv-cantonese', 'cuv1919/hant'],
  ['rv1909', 'rv1909'],
] as const;
const MANDARIN_READER = Object.keys(CUV_AUDIO_READERS).find(
  (reader) => CUV_AUDIO_READERS[reader].language === 'mandarin',
)!;

/** scripts/build-bible-audio-timings.mjs's timesByVerseNumber, run in Node. */
const timesByVerseNumber = (verseNumbers: number[], times: number[]): (number | null)[] | null =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import { timesByVerseNumber } from ${JSON.stringify(resolve('scripts/build-bible-audio-timings.mjs'))};
         console.log(JSON.stringify(timesByVerseNumber(${JSON.stringify(verseNumbers)}, ${JSON.stringify(times)})));`,
      ],
      { encoding: 'utf8' },
    ),
  );

describe('verse being read aloud', () => {
  const times = [5, 10, null, 20];

  it('marks no verse while the chapter is announced', () => {
    expect(getVerseAtAudioTime(times, 0)).toBeNull();
    expect(getVerseAtAudioTime(times, 4.4)).toBeNull();
  });

  it('marks each verse half a second before it starts, and keeps it until the next', () => {
    expect(VERSE_MARK_LEAD_SECONDS).toBe(0.5);
    expect(getVerseAtAudioTime(times, 4.5)).toBe(1);
    expect(getVerseAtAudioTime(times, 9.4)).toBe(1);
    expect(getVerseAtAudioTime(times, 9.5)).toBe(2);
  });

  it('skips a verse with no time, and keeps the last verse to the end', () => {
    expect(getVerseAtAudioTime(times, 15)).toBe(2);
    expect(getVerseAtAudioTime(times, 19.5)).toBe(4);
    expect(getVerseAtAudioTime(times, 600)).toBe(4);
  });
});

describe('verse start times that ship with the app', () => {
  it("files HelloAO's times under verse numbers, leaving out a verse the text skips", () => {
    // The BSB's Matthew 17 has no verse 21; HelloAO times the 26 verses it prints.
    const numbers = [...Array(20).keys()].map((i) => i + 1).concat([22, 23, 24, 25, 26, 27]);
    const byNumber = timesByVerseNumber(numbers, numbers.map((n) => n * 10 + 0.123));
    expect(byNumber).toHaveLength(27);
    expect(byNumber?.[19]).toBe(200.12);
    expect(byNumber?.[20]).toBeNull();
    expect(byNumber?.[21]).toBe(220.12);
    expect(timesByVerseNumber(numbers, [1, 2])).toBeNull();
  });

  it("has HelloAO's times for John 3 for each English narrator it times", async () => {
    const souer = await fetchVerseStartTimes('BSB', 'souer', 'JHN', 3);
    expect(souer).toHaveLength(36);
    // HelloAO's published start of John 3:1 and 3:16, read by Bob Souer.
    expect(souer?.[0]).toBe(5.15);
    expect(souer?.[15]).toBe(106.78);
    for (const narrator of ['david', 'hays']) {
      expect(await fetchVerseStartTimes('BSB', narrator, 'JHN', 3)).toHaveLength(36);
    }
    expect((await fetchVerseStartTimes('BSB', 'souer', 'MAT', 17))?.[20]).toBeNull();
  });

  it('has no times for a narrator or chapter without them', async () => {
    expect(await fetchVerseStartTimes('BSB', 'gilbert', 'JHN', 3)).toBeNull();
    expect(await fetchVerseStartTimes('BSB', 'souer', 'LEV', 19)).toBeNull();
    expect(await fetchVerseStartTimes('spa_r09', 'Someone else', 'JHN', 3)).toBeNull();
    expect(await fetchVerseStartTimes('cmn_cuv', 'Someone else', 'JHN', 3)).toBeNull();
  });

  it('has the John 3 times that speech recognizers confirmed, for both CUV editions', async () => {
    // John 3:1 and 3:16 (#561). The Cantonese narrator also reads the CUV's notes aloud.
    const mandarin = await fetchVerseStartTimes('cmn_cuv', MANDARIN_READER, 'JHN', 3);
    expect([mandarin?.length, mandarin?.[0], mandarin?.[15]]).toEqual([36, 6.96, 134.14]);
    expect(await fetchVerseStartTimes('cmn_cu1', MANDARIN_READER, 'JHN', 3)).toEqual(mandarin);
    const cantonese = await fetchVerseStartTimes('cmn_cu1', CANTONESE_CUV_READER, 'JHN', 3);
    expect([cantonese?.length, cantonese?.[0], cantonese?.[15]]).toEqual([36, 5.74, 138.06]);
    const spanish = await fetchVerseStartTimes('spa_r09', RV1909_READER, 'JHN', 3);
    expect([spanish?.length, spanish?.[0], spanish?.[15]]).toEqual([36, 2.96, 117.16]);
  });

  it.each(CHURCH_NARRATORS)(
    "%s: every chapter's times, one per verse of the bundled text, in order, from a recording on file",
    (narrator, text) => {
      const sources = JSON.parse(
        readFileSync(join(process.cwd(), 'scripts/bible-audio-timing-sources', `${narrator}.json`), 'utf8'),
      );
      let timed = 0;
      for (const { id } of readJson(`${text}/books`)) {
        const { contents } = readJson(`${text}/${id.toLowerCase()}`);
        const { chapters } = readJson(`audio-timings/${narrator}/${id.toLowerCase()}`);
        expect([id, chapters.length]).toEqual([id, contents.length]);
        chapters.forEach((times: (number | null)[] | null, number: number) => {
          if (!times) return;
          timed += 1;
          expect([id, number, times.length]).toEqual([id, number, contents[number].length - 1]);
          const starts = times.filter((time): time is number => time !== null);
          const outOfOrder = starts.filter((time, index) => index > 0 && time <= starts[index - 1]);
          expect([id, number, outOfOrder]).toEqual([id, number, []]);
          expect(sources[`${id} ${number}`]).toEqual({
            bytes: expect.any(Number),
            sha256: expect.stringMatching(/^[0-9a-f]{64}$/),
          });
        });
      }
      expect(timed).toBe(1189);
    },
  );

  it.each(HELLOAO_NARRATORS)(
    "%s: every book's times match the bundled BSB's chapters and verse numbers, in order",
    (narrator) => {
      const books = readJson('bsb/books');
      expect(readdirSync(join(process.cwd(), 'assets/bible/audio-timings', narrator))).toHaveLength(66);
      let timed = 0;
      for (const { id } of books) {
        const text = readJson(`bsb/${id.toLowerCase()}`);
        const { chapters } = readJson(`audio-timings/${narrator}/${id.toLowerCase()}`);
        expect([id, chapters.length]).toEqual([id, text.chapters.length]);
        chapters.forEach((times: (number | null)[] | null, number: number) => {
          if (!times) return;
          timed += 1;
          const verseNumbers = text.chapters[number].chapter.content
            .filter((item: { type: string }) => item.type === 'verse')
            .map((item: { number: number }) => item.number);
          const timedNumbers = times.flatMap((time, index) => (time === null ? [] : [index + 1]));
          expect([id, number, timedNumbers]).toEqual([id, number, verseNumbers]);
          const starts = times.filter((time): time is number => time !== null);
          const outOfOrder = starts.filter((time, index) => index > 0 && time < starts[index - 1]);
          expect([id, number, outOfOrder]).toEqual([id, number, []]);
        });
      }
      // HelloAO times all but a few of the 1,189 chapters.
      expect(timed).toBeGreaterThanOrEqual(1185);
    },
  );
});
