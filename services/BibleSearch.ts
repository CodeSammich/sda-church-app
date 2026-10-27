import { traditionalToSimplified } from './BiblePinyinService';
import { readTranslationVerseTexts, type BibleVerseText } from './BibleService';

/**
 * Whole-Bible search (#516), on the phone, over the texts that ship with the
 * app, so it works offline. A translation's verses are read once, the first
 * time it's searched, and kept in memory; a search is then a scan of about
 * 31,000 verses, a few milliseconds.
 *
 * Matching, from #516's measurements:
 * - Chinese is matched as a substring, ignoring Traditional or Simplified,
 *   spaces (the 1919 text's space before 神), and punctuation. The CUV is
 *   searched through the CUVS, its Simplified copy verse for verse, so only
 *   the query needs converting.
 * - English and Spanish words match from the start of a word ("love" finds
 *   "loved" but not "beloved"), ignoring case and accents ("sabado" finds
 *   "sábado"). A search of several words finds verses with every word, in any
 *   order.
 */

export interface BibleSearchHit {
  bookId: string;
  chapter: number;
  verse: number;
  /** The verse in the translation searched first, as the results show it. */
  text: string;
  /** The same verse in the second translation, in dual-language reading. */
  supportingText?: string;
}

interface SearchableTranslation {
  verses: BibleVerseText[];
  /** Each verse folded for matching. */
  folded: string[];
  /** A verse's index, by `BOOK chapter:verse`. */
  indexOf: Map<string, number>;
}

type SearchTerm = { kind: 'han' | 'word'; text: string };

const HAN = /\p{Script=Han}/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
// The CUV is searched through its Simplified copy, verse for verse.
const SIMPLIFIED_COPY: Record<string, string> = { cmn_cuv: 'cmn_cu1' };
const CHINESE_TRANSLATIONS = new Set(['cmn_cuv', 'cmn_cu1']);

const keyOf = ({ bookId, chapter, verse }: Pick<BibleVerseText, 'bookId' | 'chapter' | 'verse'>) =>
  `${bookId} ${chapter}:${verse}`;

/** English and Spanish: case, accents, and curly apostrophes don't matter. */
export const foldLatinText = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[‘’ʼ]/g, "'");

/** Chinese, already Simplified: only the characters matter. */
const foldSimplifiedText = (text: string) =>
  text.normalize('NFKC').replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, '').toLocaleLowerCase();

/** Chinese in either script: Traditional or Simplified doesn't matter either. */
export const foldChineseText = (text: string) => foldSimplifiedText(traditionalToSimplified(text));

const searchable = new Map<string, Promise<SearchableTranslation>>();

const buildSearchable = async (translationId: string): Promise<SearchableTranslation> => {
  const verses = await readTranslationVerseTexts(translationId);
  const indexOf = new Map(verses.map((verse, index) => [keyOf(verse), index]));
  let folded: string[];
  const copyId = SIMPLIFIED_COPY[translationId];
  if (copyId) {
    const copy = await loadSearchableTranslation(copyId);
    folded = verses.map((verse) => {
      const index = copy.indexOf.get(keyOf(verse));
      return index === undefined ? foldChineseText(verse.text) : copy.folded[index];
    });
  } else if (CHINESE_TRANSLATIONS.has(translationId)) {
    folded = verses.map((verse) => foldSimplifiedText(verse.text));
  } else {
    folded = verses.map((verse) => foldLatinText(verse.text));
  }
  return { verses, folded, indexOf };
};

/** Reads a translation for search, once; later calls share the same copy. */
export const loadSearchableTranslation = (translationId: string): Promise<SearchableTranslation> => {
  let request = searchable.get(translationId);
  if (!request) {
    request = buildSearchable(translationId);
    searchable.set(translationId, request);
    request.catch(() => searchable.delete(translationId));
  }
  return request;
};

/** Starts reading the translations, so the first search doesn't wait as long. */
export const prepareBibleSearch = (translationIds: readonly string[]) =>
  Promise.all(translationIds.map(loadSearchableTranslation)).then(() => undefined);

/** The query's words, folded as the verses are; Chinese without spaces is one term. */
export const parseSearchTerms = (query: string): SearchTerm[] =>
  query
    .normalize('NFKC')
    .split(/\s+/u)
    .map((raw): SearchTerm =>
      HAN.test(raw)
        ? { kind: 'han', text: foldChineseText(raw) }
        : { kind: 'word', text: foldLatinText(raw).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') },
    )
    .filter((term) => term.text);

const hasWordStartingWith = (text: string, word: string) => {
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    if (at === 0 || !WORD_CHARACTER.test(text[at - 1])) return true;
  }
  return false;
};

const matchesEvery = (folded: string, terms: readonly SearchTerm[]) =>
  terms.every((term) =>
    term.kind === 'han' ? folded.includes(term.text) : hasWordStartingWith(folded, term.text),
  );

/**
 * Every verse that has the query, in Bible order. In dual-language reading,
 * pass both translations: a verse matches if either one has every word.
 */
export async function searchBible(
  query: string,
  translationIds: readonly string[],
): Promise<BibleSearchHit[]> {
  const terms = parseSearchTerms(query);
  if (!terms.length || !translationIds.length) return [];
  const [main, supporting] = await Promise.all(translationIds.slice(0, 2).map(loadSearchableTranslation));
  const hits: BibleSearchHit[] = [];
  main.verses.forEach((verse, index) => {
    const supportingIndex = supporting?.indexOf.get(keyOf(verse));
    const matched =
      matchesEvery(main.folded[index], terms) ||
      (supportingIndex !== undefined && matchesEvery(supporting.folded[supportingIndex], terms));
    if (!matched) return;
    hits.push({
      ...verse,
      ...(supportingIndex !== undefined ? { supportingText: supporting.verses[supportingIndex].text } : {}),
    });
  });
  return hits;
}
