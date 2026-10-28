import { traditionalToSimplified } from './BiblePinyinService';
import { readTranslationVerseTexts, type BibleVerseText } from './BibleService';

/**
 * Whole-Bible search (#516), on the phone, over the texts that ship with the
 * app, so it works offline. A translation's verses are read once, the first
 * time it's searched, and kept in memory (well under half a second in Node); a
 * search is then a scan of about 31,000 verses, a few to about 20 ms.
 *
 * Matching, from #516's measurements:
 * - Chinese is matched as a substring, ignoring Traditional or Simplified,
 *   spaces (the 1919 text's space before 神), and punctuation. The CUV and the
 *   CUVS are the same text, verse for verse, so each verse is searched in both
 *   scripts, and only the query needs converting.
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
  /** Each verse folded for matching; a Chinese verse in both scripts, one per line. */
  folded: string[];
  /** A verse's index, by `BOOK chapter:verse`. */
  indexOf: Map<string, number>;
}

// A Chinese term has two forms: as typed, and converted to Simplified. The
// converter is for Traditional text and changes some Simplified characters
// again (么 to 幺), so a query typed in Simplified matches as it is.
type SearchTerm = { kind: 'han'; forms: readonly string[] } | { kind: 'word'; text: string };

const HAN = /\p{Script=Han}/u;
const WORD_CHARACTER = /[\p{L}\p{N}]/u;
// The CUV and the CUVS, each the other's copy in the other script. Each verse
// is searched as both print it: the CUVS converted some characters in context,
// unlike a query typed alone (藉著 to 借着, but 藉 alone stays 藉).
const SCRIPT_COPY: Record<string, string> = { cmn_cuv: 'cmn_cu1', cmn_cu1: 'cmn_cuv' };

const keyOf = ({ bookId, chapter, verse }: Pick<BibleVerseText, 'bookId' | 'chapter' | 'verse'>) =>
  `${bookId} ${chapter}:${verse}`;

/** English and Spanish: case, accents, and curly apostrophes don't matter. */
export const foldLatinText = (text: string) =>
  text.normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase().replace(/[‘’ʼ]/g, "'");

/** Chinese, already Simplified: only the characters matter. */
const foldSimplifiedText = (text: string) =>
  text.normalize('NFKC').replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, '').toLocaleLowerCase();

/**
 * Chinese in either script: Traditional or Simplified doesn't matter either. A
 * query is converted as scripts/cuv-1919-simplified.cjs converted the CUVS:
 * with the phrase fixes, and with 蔯 (茵蔯, wormwood) as 陈 and 鐏 kept, not
 * the rare 𫈟 and 𨱔, which the pinyin keeps for its lookups.
 */
export const foldChineseText = (text: string) =>
  foldSimplifiedText(traditionalToSimplified(text).replace(/𫈟/gu, '陈').replace(/𨱔/gu, '鐏'));

const searchable = new Map<string, Promise<SearchableTranslation>>();

const buildSearchable = async (translationId: string): Promise<SearchableTranslation> => {
  const copyId = SCRIPT_COPY[translationId];
  const [verses, copy] = await Promise.all([
    readTranslationVerseTexts(translationId),
    copyId ? readTranslationVerseTexts(copyId) : undefined,
  ]);
  const indexOf = new Map(verses.map((verse, index) => [keyOf(verse), index]));
  let folded: string[];
  if (copy) {
    const copyText = new Map(copy.map((verse) => [keyOf(verse), verse.text]));
    // A query's forms have no line breaks, so a match can't run from one script into the other.
    folded = verses.map((verse) =>
      [verse.text, copyText.get(keyOf(verse))]
        .filter((text): text is string => Boolean(text))
        .map(foldSimplifiedText)
        .join('\n'),
    );
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
        ? { kind: 'han', forms: [...new Set([foldSimplifiedText(raw), foldChineseText(raw)])].filter(Boolean) }
        : { kind: 'word', text: foldLatinText(raw).replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '') },
    )
    .filter((term) => (term.kind === 'han' ? term.forms.length > 0 : term.text));

const hasWordStartingWith = (text: string, word: string) => {
  for (let at = text.indexOf(word); at !== -1; at = text.indexOf(word, at + 1)) {
    if (at === 0 || !WORD_CHARACTER.test(text[at - 1])) return true;
  }
  return false;
};

const matchesEvery = (folded: string, terms: readonly SearchTerm[]) =>
  terms.every((term) =>
    term.kind === 'han'
      ? term.forms.some((form) => folded.includes(form))
      : hasWordStartingWith(folded, term.text),
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
