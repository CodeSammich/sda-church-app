/**
 * Keeps the Bible reader on the same verse when the translation changes.
 * Every translation uses the same book IDs and verse numbers, so a position
 * found in one translation can be restored in another.
 */
export interface BibleReaderPosition {
  /** The translation the position is restored in. */
  translationId: string;
  bookId: string;
  chapter: number;
  verse: number;
}

interface BibleReaderLocation {
  bookId: string;
  chapter: number;
}

/**
 * Returns the verse at the top of the reader: the one that starts closest
 * above `topY`, in the same coordinates as `versePositions`. Returns null at
 * the top of the chapter, where there's nothing to restore.
 */
export function getTopVisibleVerse(
  versePositions: Record<number, number>,
  topY: number,
): number | null {
  let topVerse: number | null = null;
  let topVerseY = -Infinity;
  for (const [verse, y] of Object.entries(versePositions)) {
    if (y <= topY && y > topVerseY) {
      topVerse = Number(verse);
      topVerseY = y;
    }
  }
  return topVerse !== null && topVerse > 1 ? topVerse : null;
}

/**
 * Picks the position to restore after switching to `translationId`: the
 * verse at the top of the reader. While the chapter is still loading, no
 * verse is on screen, so a second quick switch keeps the position the first
 * one was restoring.
 */
export function getTranslationSwitchPosition(
  translationId: string,
  location: BibleReaderLocation,
  topVerse: number | null,
  pending: BibleReaderPosition | null,
  isChapterShown: boolean,
): BibleReaderPosition | null {
  if (topVerse !== null && isChapterShown) {
    return { translationId, ...location, verse: topVerse };
  }
  if (!isChapterShown && pending && isSameChapter(pending, location)) {
    return { ...pending, translationId };
  }
  return null;
}

export function isSameChapter(a: BibleReaderLocation, b: BibleReaderLocation) {
  return a.bookId === b.bookId && a.chapter === b.chapter;
}

/**
 * A link to the reader, such as the verse of the day, opens its book and
 * chapter once. Returns true when `signature` is a link not yet applied.
 * Applying it again whenever the book list reloads, as it does after a
 * translation switch, would undo the reader's own navigation since then.
 */
export function isNewReaderLink(signature: string | null, handledSignature: string | null) {
  return signature !== null && signature !== handledSignature;
}
