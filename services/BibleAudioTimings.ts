import { BUNDLED_BIBLE_ASSETS, type BundledBibleCollection } from '@/assets/bible';
import { getBibleAudioNarrator } from '@/services/BibleAudioSources';
import { readBundledBibleFile } from '@/services/BundledBible';

/**
 * When each verse starts in a narrator's recording of a chapter, so the reader
 * can mark the verse being read aloud (#561). They ship with the app in
 * assets/bible/audio-timings/<narrator>/<book>.biblejson: HelloAO's own times
 * for its English narrators (scripts/build-bible-audio-timings.mjs), and times
 * made by aligning the text with the church's copies for the others.
 *
 * Index 0 is verse 1. A verse with no time, such as one the text leaves out,
 * is null.
 */
export type VerseStartTimes = readonly (number | null)[];

interface AudioTimingsBook {
  chapters: (VerseStartTimes | null)[];
}

const timingsCollection = (translationId: string, reader: string) => {
  // Both CUV editions play the same recordings: cuv-mandarin or cuv-cantonese.
  const narrator = getBibleAudioNarrator(translationId, reader);
  const collection = narrator && `audio-timings/${narrator}`;
  return collection && collection in BUNDLED_BIBLE_ASSETS
    ? (collection as BundledBibleCollection)
    : null;
};

/** A chapter's verse start times for one narrator, or null when it has none. */
export async function fetchVerseStartTimes(
  translationId: string,
  reader: string,
  bookId: string,
  chapter: number,
): Promise<VerseStartTimes | null> {
  const collection = timingsCollection(translationId, reader);
  const name = bookId.toLowerCase();
  if (!collection || !(name in BUNDLED_BIBLE_ASSETS[collection])) return null;
  const book = await readBundledBibleFile<AudioTimingsBook>(collection, name);
  return book.chapters[chapter] ?? null;
}

/**
 * How early to mark the next verse. The player reports its position about
 * once a second, so the mark moves up to a second after the time it reads.
 * Starting half a second early puts the change, on average, in the pause
 * before the verse's first word rather than after it.
 */
export const VERSE_MARK_LEAD_SECONDS = 0.5;

/**
 * The verse being read at `seconds` into the recording, or null before the
 * first verse (while the narrator announces the chapter).
 */
export const getVerseAtAudioTime = (
  times: VerseStartTimes,
  seconds: number,
  lead = VERSE_MARK_LEAD_SECONDS,
): number | null => {
  let verse: number | null = null;
  for (let index = 0; index < times.length; index += 1) {
    const start = times[index];
    if (start === null) continue;
    if (start - lead > seconds) break;
    verse = index + 1;
  }
  return verse;
};
