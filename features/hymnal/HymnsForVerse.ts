/**
 * The English hymns whose scripture reference covers a Bible verse, for the
 * Bible's verse details: the reverse of a hymn's verse chip. A reference to a
 * whole chapter, such as "Psalm 23", covers every verse in it.
 */

import { parseScriptureReference } from '@/services/BibleService';
import { getSortedHymns, type HydratedHymn } from './EnglishHymnal';

type HymnPassage = Readonly<{
  hymn: HydratedHymn;
  bookId: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}>;

let passages: readonly HymnPassage[] | undefined;

// Read once, the first time a verse's details open.
const getPassages = () =>
  (passages ??= getSortedHymns().flatMap((hymn) => {
    const passage = parseScriptureReference(hymn.scriptureReference);
    return passage ? [{ hymn, ...passage }] : [];
  }));

/** The hymns on a verse, in hymn-number order. `bookId` is a USFM ID, such as "PSA". */
export const getEnglishHymnsForVerse = (bookId: string, chapter: number, verse: number) =>
  getPassages()
    .filter(
      (passage) =>
        passage.bookId === bookId &&
        passage.chapter === chapter &&
        (passage.verseStart === undefined ||
          (verse >= passage.verseStart && verse <= (passage.verseEnd ?? passage.verseStart))),
    )
    .map(({ hymn }) => hymn);
