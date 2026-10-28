import { useEffect, useMemo, useState } from 'react';

import type { SupportedLanguage } from '@/constants/LanguageContext';
import { searchBible, type BibleSearchHit } from '@/services/BibleSearch';
import {
  formatScriptureReference,
  parseScriptureReference,
  type ParsedScriptureReference,
} from '@/services/BibleService';

/**
 * The Bible reader's search box (#516): the whole Bible, with the open
 * chapter's matches first, and a reference such as "Jn 3:16" or 約3:16 to jump
 * to. services/BibleSearch.ts does the matching.
 */

/** What the Bible screen gives the header's search. */
export type BibleSearchOptions = Readonly<{
  /** The translations on screen: the main one, then the second in dual-language reading. */
  translationIds: readonly string[];
  /** The main translation's books, for their names and chapter counts. */
  books: readonly Readonly<{ id: string; name: string; numberOfChapters: number }>[];
  bookId?: string;
  chapter?: number;
  onOpen: (reference: ParsedScriptureReference) => void;
}>;

export type BibleSearchRow =
  | { kind: 'reference'; key: string; title: string; reference: ParsedScriptureReference }
  | { kind: 'header'; key: string; title: string }
  | { kind: 'verse'; key: string; title: string; subtitle: string; reference: ParsedScriptureReference }
  | { kind: 'status'; key: string; title: string };

export const BIBLE_SEARCH_LABELS = {
  en: {
    placeholder: 'Search the Bible...',
    goTo: (reference: string) => `Go to ${reference}`,
    thisChapter: 'This chapter',
    wholeBible: 'Whole Bible',
    verses: (count: number) => (count === 1 ? '1 verse' : `${count} verses`),
    searching: 'Searching…',
    noResults: 'No verses found',
  },
  zh: {
    placeholder: '搜尋聖經...',
    goTo: (reference: string) => `前往 ${reference}`,
    thisChapter: '本章',
    wholeBible: '全本聖經',
    verses: (count: number) => `${count} 節`,
    searching: '搜尋中…',
    noResults: '找不到經文',
  },
  'zh-cn': {
    placeholder: '搜索圣经...',
    goTo: (reference: string) => `前往 ${reference}`,
    thisChapter: '本章',
    wholeBible: '全本圣经',
    verses: (count: number) => `${count} 节`,
    searching: '搜索中…',
    noResults: '找不到经文',
  },
  es: {
    placeholder: 'Buscar en la Biblia...',
    goTo: (reference: string) => `Ir a ${reference}`,
    thisChapter: 'Este capítulo',
    wholeBible: 'Toda la Biblia',
    verses: (count: number) => (count === 1 ? '1 versículo' : `${count} versículos`),
    searching: 'Buscando…',
    noResults: 'No se encontraron versículos',
  },
} as const;

/**
 * The query as a reference to open, if it reads as one with a chapter number,
 * such as "Jn 3:16" or "Sal 23". A book's abbreviation alone, like 可 or 路,
 * is an ordinary word in Chinese, so it stays a word search.
 */
const referenceIn = (query: string, books: BibleSearchOptions['books']) => {
  if (!/\d/.test(query.normalize('NFKC'))) return null;
  const reference = parseScriptureReference(query);
  const book = reference && books.find(({ id }) => id === reference.bookId);
  if (!reference || !book || reference.chapter > book.numberOfChapters) return null;
  return reference;
};

/** The rows the results list shows, in order. */
export const buildBibleSearchRows = ({
  query,
  hits,
  options,
  language,
}: {
  query: string;
  /** null while the first search is still reading the translations. */
  hits: readonly BibleSearchHit[] | null;
  options: BibleSearchOptions;
  language: SupportedLanguage;
}): BibleSearchRow[] => {
  const labels = BIBLE_SEARCH_LABELS[language] ?? BIBLE_SEARCH_LABELS.en;
  const rows: BibleSearchRow[] = [];
  if (!query.trim()) return rows;

  const reference = referenceIn(query, options.books);
  const formatted = reference && formatScriptureReference(reference, language);
  if (reference && formatted) {
    rows.push({ kind: 'reference', key: 'reference', title: labels.goTo(formatted), reference });
  }
  if (!hits) {
    rows.push({ kind: 'status', key: 'searching', title: labels.searching });
    return rows;
  }
  if (!hits.length) {
    if (!reference) rows.push({ kind: 'status', key: 'none', title: labels.noResults });
    return rows;
  }

  const bookNames = new Map(options.books.map(({ id, name }) => [id, name]));
  const verseRow = (hit: BibleSearchHit, section: string): BibleSearchRow => ({
    kind: 'verse',
    key: `${section}-${hit.bookId}-${hit.chapter}-${hit.verse}`,
    title: `${bookNames.get(hit.bookId) ?? hit.bookId} ${hit.chapter}:${hit.verse}`,
    subtitle: hit.supportingText ? `${hit.text}\n${hit.supportingText}` : hit.text,
    reference: { bookId: hit.bookId, chapter: hit.chapter, verseStart: hit.verse, verseEnd: hit.verse },
  });

  const inChapter = hits.filter(
    (hit) => hit.bookId === options.bookId && hit.chapter === options.chapter,
  );
  if (inChapter.length) {
    rows.push({
      kind: 'header',
      key: 'chapter',
      title: `${labels.thisChapter} · ${labels.verses(inChapter.length)}`,
    });
    rows.push(...inChapter.map((hit) => verseRow(hit, 'chapter')));
  }

  rows.push({ kind: 'header', key: 'bible', title: `${labels.wholeBible} · ${labels.verses(hits.length)}` });
  for (let start = 0; start < hits.length; ) {
    const { bookId } = hits[start];
    let end = start;
    while (end < hits.length && hits[end].bookId === bookId) end += 1;
    rows.push({ kind: 'header', key: `book-${bookId}`, title: `${bookNames.get(bookId) ?? bookId} · ${end - start}` });
    rows.push(...hits.slice(start, end).map((hit) => verseRow(hit, 'bible')));
    start = end;
  }
  return rows;
};

/** The results list's rows for a query, searched as it changes. */
export const useBibleSearchRows = (
  query: string,
  options: BibleSearchOptions | undefined,
  language: SupportedLanguage,
): BibleSearchRow[] => {
  const [found, setFound] = useState<{ query: string; key: string; hits: BibleSearchHit[] } | null>(null);
  const translationKey = options?.translationIds.join('+') ?? '';

  useEffect(() => {
    if (!options || !query.trim()) return;
    let cancelled = false;
    searchBible(query, options.translationIds)
      .then((hits) => {
        if (!cancelled) setFound({ query, key: translationKey, hits });
      })
      .catch((error) => {
        console.error('Bible search failed', error);
        if (!cancelled) setFound({ query, key: translationKey, hits: [] });
      });
    return () => {
      cancelled = true;
    };
    // Only the query and the translations change what's found.
  }, [query, translationKey]);

  return useMemo(() => {
    if (!options) return [];
    // Until this query's results come, the last ones stay up, so typing
    // doesn't flicker; before any, the list says it's searching.
    const hits = found && found.key === translationKey ? found.hits : null;
    return buildBibleSearchRows({ query, hits, options, language });
  }, [query, found, translationKey, options, language]);
};
