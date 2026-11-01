/**
 * Writes the verse start times the Bible reader uses to mark the verse being
 * read aloud (#561), one file per narrator and book:
 *   assets/bible/audio-timings/<narrator>/<book>.biblejson
 *
 * Each file is { chapters: [null, chapter 1, chapter 2, ...] }. A chapter is a
 * list of start times in seconds, one per verse number (index 0 is verse 1),
 * or null when there are none. A verse the text leaves out, such as the BSB's
 * Matthew 17:21, is null in its chapter's list.
 *
 * The English narrators' times are HelloAO's own, published with its BSB
 * recordings. HelloAO lets apps store them ("Cache, store and download
 * without expiry"; see docs/LEGAL.md). A narrator's times are kept only for
 * a chapter whose recording HelloAO links is the one the app plays, so the
 * times always belong to the file that's heard.
 *
 * It needs the network:
 *   node scripts/build-bible-audio-timings.mjs
 * then rewrites assets/bible/index.ts.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { writeBibleAssetIndex } from './write-bible-asset-index.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const HELLOAO_BSB = 'https://bible.helloao.org/api/BSB/complete.json';
/** The narrators HelloAO hosts and times. Its fourth BSB narrator, Gilbert, has no times. */
export const HELLOAO_TIMED_NARRATORS = ['david', 'hays', 'souer'];

/** Hundredths of a second are finer than a reader can see. */
const round = (seconds) => Math.round(seconds * 100) / 100;

/**
 * One chapter's start times by verse number, from HelloAO's list, which has one
 * time per verse in the order the chapter prints them.
 */
export const timesByVerseNumber = (verseNumbers, times) => {
  if (!Array.isArray(times) || times.length !== verseNumbers.length) return null;
  const byNumber = Array(Math.max(...verseNumbers)).fill(null);
  verseNumbers.forEach((number, index) => {
    byNumber[number - 1] = round(times[index]);
  });
  return byNumber;
};

const main = async () => {
  const response = await fetch(HELLOAO_BSB);
  if (!response.ok) throw new Error(`${HELLOAO_BSB}: HTTP ${response.status}`);
  const { books } = await response.json();
  if (books.length !== 66) throw new Error(`BSB: ${books.length} books`);

  const counts = Object.fromEntries(HELLOAO_TIMED_NARRATORS.map((narrator) => [narrator, 0]));
  const skipped = [];
  for (const narrator of HELLOAO_TIMED_NARRATORS) {
    rmSync(join(root, 'assets/bible/audio-timings', narrator), { recursive: true, force: true });
  }
  for (const book of books) {
    const id = book.id.toLowerCase();
    const bundled = JSON.parse(readFileSync(join(root, 'assets/bible/bsb', `${id}.biblejson`), 'utf8'));
    for (const narrator of HELLOAO_TIMED_NARRATORS) {
      const chapters = [null];
      for (const chapter of book.chapters) {
        const number = chapter.chapter.number;
        const verseNumbers = chapter.chapter.content
          .filter((item) => item.type === 'verse')
          .map((item) => item.number);
        const bundledChapter = bundled.chapters[number];
        const bundledVerseNumbers = (bundledChapter?.chapter.content ?? [])
          .filter((item) => item.type === 'verse')
          .map((item) => item.number);
        const played = bundledChapter?.thisChapterAudioLinks?.[narrator];
        const timed = chapter.thisChapterAudioLinks?.[narrator];
        const times = played && played === timed && `${bundledVerseNumbers}` === `${verseNumbers}`
          ? timesByVerseNumber(verseNumbers, chapter.thisChapterAudioTimings?.[narrator])
          : null;
        if (times) counts[narrator] += 1;
        else skipped.push(`${narrator} ${book.id} ${number}`);
        chapters.push(times);
      }
      const folder = join(root, 'assets/bible/audio-timings', narrator);
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, `${id}.biblejson`), `${JSON.stringify({ chapters })}\n`);
    }
  }
  writeBibleAssetIndex();
  console.log(
    `Chapters timed: ${Object.entries(counts).map(([narrator, count]) => `${narrator} ${count}`).join(', ')}.`,
  );
  if (skipped.length) console.log(`No times for: ${skipped.join('; ')}.`);
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
