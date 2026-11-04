import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import type { DownloadSizeRange } from '@/services/FileDownloads';

/**
 * How big each chapter's recording is, for each narrator a member can download
 * for listening offline (#556), from constants/BibleAudioDownloadSizes.json
 * (scripts/build-bible-audio-download-sizes.mjs), as
 * { narrator: { book: [chapter 1's bytes, chapter 2's, …] } }.
 *
 * The sizes show how big a download is before it starts, and say whether a
 * chapter that arrived is the recording: a Wi-Fi's sign-in page, answered as
 * if it were the file, or a file cut off part way, is turned down and tried
 * again, never kept as the chapter (services/BibleAudioDownloads.ts, and the
 * phone's own downloaders in modules/bible-audio-downloads).
 */

const SIZES: Readonly<Record<string, Readonly<Record<string, readonly number[]>>>> = BIBLE_AUDIO_DOWNLOAD_SIZES;

/**
 * How far a chapter may be from its recorded size. Every host served the very
 * file measured, to the byte, Mandarin's two mirrors included (checked
 * November 2026, all 9,500 files), so this only allows for a host that changes
 * a file's tags. A host that replaces a recording needs the sizes measured
 * again.
 */
export const CHAPTER_SIZE_TOLERANCE = 0.02;
/** For a chapter whose size isn't known: the shortest recording is 60 KB. */
export const MIN_UNKNOWN_CHAPTER_BYTES = 20_000;
/** For a chapter whose size isn't known: the longest, David's Psalm 119, is 22 MB. */
export const MAX_UNKNOWN_CHAPTER_BYTES = 60_000_000;

/** The narrators whose sizes are known: those a member can download. */
export const BIBLE_AUDIO_SIZED_NARRATORS: readonly string[] = Object.keys(SIZES);

/** A chapter's size in bytes, or null when it isn't known. */
export const getBibleAudioChapterBytes = (narrator: string, bookId: string, chapter: number): number | null => {
  const bytes = SIZES[narrator]?.[bookId]?.[chapter - 1];
  return typeof bytes === 'number' && bytes > 0 ? bytes : null;
};

const bookTotals = new Map<string, number>();

/** A book's size in bytes for a narrator: all its chapters. */
export const getBibleAudioBookBytes = (narrator: string, bookId: string): number => {
  const key = `${narrator}/${bookId}`;
  let total = bookTotals.get(key);
  if (total === undefined) {
    total = (SIZES[narrator]?.[bookId] ?? []).reduce((sum, bytes) => sum + bytes, 0);
    bookTotals.set(key, total);
  }
  return total;
};

/**
 * The sizes a downloaded chapter is kept at: within CHAPTER_SIZE_TOLERANCE of
 * its recording's, or, for one whose size isn't known, between
 * MIN_UNKNOWN_CHAPTER_BYTES and MAX_UNKNOWN_CHAPTER_BYTES. A download that
 * grows past `max` is stopped then, so a host that sends something endless
 * can't fill the phone.
 */
export const getBibleAudioChapterSizeRange = (
  narrator: string,
  bookId: string,
  chapter: number,
): DownloadSizeRange & { known: boolean } => {
  const bytes = getBibleAudioChapterBytes(narrator, bookId, chapter);
  return bytes
    ? {
        min: Math.floor(bytes * (1 - CHAPTER_SIZE_TOLERANCE)),
        max: Math.ceil(bytes * (1 + CHAPTER_SIZE_TOLERANCE)),
        known: true,
      }
    : { min: MIN_UNKNOWN_CHAPTER_BYTES, max: MAX_UNKNOWN_CHAPTER_BYTES, known: false };
};

/** Whether a downloaded chapter of `bytes` is the recording, as far as its size says. */
export const isBibleAudioChapterSizeRight = (narrator: string, bookId: string, chapter: number, bytes: number) => {
  const { min, max } = getBibleAudioChapterSizeRange(narrator, bookId, chapter);
  return bytes >= min && bytes <= max;
};
