/**
 * Hymns and the Bible verses they're written on, both ways: a hymn's verse
 * chip on the hymnal page, and the hymns on a verse in the Bible's verse
 * details. The references are the English hymns' (EnglishHymnal.ts). A 505
 * hymn has the reference of the 1985 hymn the cross-reference table pairs it
 * with, so a verse lists the Chinese hymn too. A reference to a whole
 * chapter, such as "Psalm 23", covers every verse in it.
 */

import type { SupportedLanguage } from '@/constants/LanguageContext';
import { formatScriptureReference, parseScriptureReference } from '@/services/BibleService';
import { getSortedChinese505Hymns } from './Chinese505Hymnal';
import { getSortedHymns, type HydratedHymn } from './EnglishHymnal';
import type { HymnalBookId } from './HymnalLabels';
import { getHymnEquivalents, type HymnNumber } from './HymnalNumberMappings';

/** A hymn on a verse, in the English hymnal or the 505. */
export type VerseHymn = Readonly<{
  hymnalId: HymnalBookId;
  number: number;
  title: string;
  /** The English hymn's reference that names the verse, such as "Psalm 103:2-5". */
  scriptureReference: string;
}>;

type HymnPassage = Readonly<{
  hymn: HydratedHymn;
  bookId: string;
  chapter: number;
  verseStart?: number;
  verseEnd?: number;
}>;

let passages: readonly HymnPassage[] | undefined;
let englishReferences: ReadonlyMap<string, string> | undefined;
let chinese505Titles: ReadonlyMap<string, string> | undefined;

// Each read once, the first time it's needed.
const getPassages = () =>
  (passages ??= getSortedHymns().flatMap((hymn) => {
    const passage = parseScriptureReference(hymn.scriptureReference);
    return passage ? [{ hymn, ...passage }] : [];
  }));
const getEnglishReferences = () =>
  (englishReferences ??= new Map(
    getPassages().map(({ hymn }) => [hymn.number.toString(), hymn.scriptureReference!]),
  ));
const getChinese505Titles = () =>
  (chinese505Titles ??= new Map(
    getSortedChinese505Hymns().map(({ number, title }) => [number.toString(), title]),
  ));

// The 505 hymns the cross-reference table pairs with a 1985 hymn, where the
// 505's online catalog has them.
const get505Equivalents = (englishNumber: HymnNumber) =>
  getHymnEquivalents('sdah-1985-en', englishNumber).filter(
    ({ hymnalId, number }) =>
      hymnalId === 'chinese-hymnal-505' && getChinese505Titles().has(number.toString()),
  );

/**
 * A hymn's verse: an English hymn's own reference, or a 505 hymn's 1985
 * equivalent's. Other hymnals have none.
 */
export const getHymnScriptureReference = (
  hymnalId: HymnalBookId,
  hymnNumber: HymnNumber,
): string | undefined => {
  if (hymnalId === 'sdah-1985-en') return getEnglishReferences().get(hymnNumber.toString());
  if (hymnalId !== 'chinese-hymnal-505') return undefined;
  for (const { hymnalId: pairedId, number } of getHymnEquivalents(hymnalId, hymnNumber)) {
    const reference =
      pairedId === 'sdah-1985-en' ? getEnglishReferences().get(number.toString()) : undefined;
    if (reference) return reference;
  }
  return undefined;
};

/**
 * A hymn's verse as its row shows it: an English hymn's as written, and a 505
 * hymn's in the app language, such as 詩篇 103:2-5.
 */
export const formatHymnScriptureReference = (
  hymnalId: HymnalBookId,
  reference: string,
  language: string,
) => {
  if (hymnalId === 'sdah-1985-en') return reference;
  const passage = parseScriptureReference(reference);
  return (passage && formatScriptureReference(passage, language as SupportedLanguage)) || reference;
};

/**
 * Every hymn on a verse: the English hymns and their 505 equivalents, each
 * hymnal in number order, the 505 first for a Chinese translation and the
 * English hymnal first for any other. `bookId` is a USFM ID, such as "PSA".
 */
export const getHymnsForVerse = (
  bookId: string,
  chapter: number,
  verse: number,
  translationLanguage: string,
): VerseHymn[] => {
  const english = getPassages().filter(
    (passage) =>
      passage.bookId === bookId &&
      passage.chapter === chapter &&
      (passage.verseStart === undefined ||
        (verse >= passage.verseStart && verse <= (passage.verseEnd ?? passage.verseStart))),
  );
  const englishHymns = english.map(
    ({ hymn }): VerseHymn => ({
      hymnalId: 'sdah-1985-en',
      number: hymn.number,
      title: hymn.title,
      scriptureReference: hymn.scriptureReference!,
    }),
  );
  const chinese = new Map<number, VerseHymn>();
  for (const { hymn } of english) {
    for (const { number } of get505Equivalents(hymn.number)) {
      const key = Number(number);
      if (chinese.has(key)) continue;
      chinese.set(key, {
        hymnalId: 'chinese-hymnal-505',
        number: key,
        title: getChinese505Titles().get(number.toString())!,
        scriptureReference: hymn.scriptureReference!,
      });
    }
  }
  const chineseHymns = [...chinese.values()].sort((a, b) => a.number - b.number);
  return translationLanguage === 'zh' || translationLanguage === 'zh-cn'
    ? [...chineseHymns, ...englishHymns]
    : [...englishHymns, ...chineseHymns];
};
