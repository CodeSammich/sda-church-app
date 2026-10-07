import OpenCC from 'opencc-js/t2cn';
import { getSortedChinese505Hymns } from './Chinese505Hymnal';
import { getSortedChinese506Hymns } from './Chinese506Hymnal';
import { getSortedChinese707Hymns } from './Chinese707Hymnal';
import { getSortedHymns } from './EnglishHymnal';
import { getHymnalLabel, type HymnalBookId } from './HymnalLabels';
import { getHymnEquivalents } from './HymnalNumberMappings';

/** One hymn in the search across every hymnal. */
export interface HymnalSearchItem {
  /** "Number. Title", as the hymnal page shows it. */
  title: string;
  /** The number, title, an English hymn's scripture, and the hymnal's name. */
  keywords: string[];
  hymnalId: HymnalBookId;
  hymnNumber: number | string;
  normalizedSearchText: string;
}

const traditionalToSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

export const normalizeHymnalSearchText = (value: string) =>
  traditionalToSimplified(value.normalize('NFKC').toLocaleLowerCase()).trim();

export const HYMNAL_SEARCH_RESULT_LIMIT = 60;

export type HeaderSearchCandidate = {
  searchText?: string;
  subtitle: string;
  title: string;
};

/** The header's own search, which the Library uses for its books. */
export const filterHeaderSearchItems = <Item extends HeaderSearchCandidate>(
  items: readonly Item[],
  query: string,
) => {
  const normalizedQuery = normalizeHymnalSearchText(query);
  if (!normalizedQuery) return [];

  return items
    .filter((item) =>
      normalizeHymnalSearchText(
        `${item.title} ${item.subtitle} ${item.searchText || ''}`,
      ).includes(normalizedQuery),
    )
    .slice(0, HYMNAL_SEARCH_RESULT_LIMIT);
};

const isNormalizedHymnalSearchMatch = (
  item: HymnalSearchItem,
  normalizedQuery: string,
) =>
  item.normalizedSearchText.includes(normalizedQuery) ||
  (/^\d+$/.test(normalizedQuery) &&
    item.hymnNumber.toString() === normalizedQuery);

// The same hymn in the hymnals a cross-reference table pairs with this one.
const getEquivalentKeys = (item: HymnalSearchItem) =>
  getHymnEquivalents(item.hymnalId, item.hymnNumber).map(
    ({ hymnalId, number }) => `${hymnalId}:${number}`,
  );

const itemsByKeyByCatalog = new WeakMap<
  readonly HymnalSearchItem[],
  Map<string, HymnalSearchItem>
>();

const getItemsByKey = (items: readonly HymnalSearchItem[]) => {
  let itemsByKey = itemsByKeyByCatalog.get(items);
  if (!itemsByKey) {
    itemsByKey = new Map(
      items.map((item) => [`${item.hymnalId}:${item.hymnNumber}`, item]),
    );
    itemsByKeyByCatalog.set(items, itemsByKey);
  }
  return itemsByKey;
};

/**
 * Search every hymnal, keeping the open hymnal's direct matches first, and
 * each hymnal's hymn with exactly the number searched for first among its
 * own. Equivalents from the cross-reference tables, such as 1985 ↔ 505, are
 * placed beside the matching hymn so either language can be used as the
 * starting point.
 *
 * With `excludeActive`, the open hymnal's own hymns are left out, for the
 * hymnal page, which lists them above, but the equivalents of its matches
 * still come first: a 1985 search leads with the same hymns in the 505.
 */
export const getHymnalSearchResults = (
  items: readonly HymnalSearchItem[],
  query: string,
  {
    activeHymnalId,
    excludeActive = false,
  }: { activeHymnalId?: HymnalBookId; excludeActive?: boolean } = {},
) => {
  const normalizedQuery = normalizeHymnalSearchText(query);
  if (!normalizedQuery) return [];
  const directMatches = items.filter((item) =>
    isNormalizedHymnalSearchMatch(item, normalizedQuery),
  );
  const buckets = new Map<HymnalBookId, HymnalSearchItem[]>();
  for (const item of directMatches) {
    const bucket = buckets.get(item.hymnalId);
    if (bucket) bucket.push(item);
    else buckets.set(item.hymnalId, [item]);
  }
  // A number someone was given, such as "100", leads with each hymnal's 100
  // rather than the hymns whose titles or scripture mention it.
  for (const bucket of buckets.values()) {
    const exactIndex = bucket.findIndex(
      (item) => item.hymnNumber.toString().toLocaleLowerCase() === normalizedQuery,
    );
    if (exactIndex > 0) bucket.unshift(...bucket.splice(exactIndex, 1));
  }
  const orderedHymnalIds = [
    ...(activeHymnalId && buckets.has(activeHymnalId)
      ? [activeHymnalId]
      : []),
    ...Array.from(buckets.keys()).filter((id) => id !== activeHymnalId),
  ];
  const interleavedMatches: HymnalSearchItem[] = [];
  let matchIndex = 0;
  while (
    interleavedMatches.length < HYMNAL_SEARCH_RESULT_LIMIT &&
    orderedHymnalIds.some((id) => matchIndex < (buckets.get(id)?.length || 0))
  ) {
    for (const id of orderedHymnalIds) {
      const match = buckets.get(id)?.[matchIndex];
      if (match) interleavedMatches.push(match);
      if (interleavedMatches.length >= HYMNAL_SEARCH_RESULT_LIMIT) break;
    }
    matchIndex += 1;
  }
  const itemsByKey = getItemsByKey(items);
  const seen = new Set<string>();
  const results: HymnalSearchItem[] = [];

  for (const match of interleavedMatches) {
    const candidates = [
      match,
      ...getEquivalentKeys(match)
        .map((key) => itemsByKey.get(key))
        .filter((item): item is HymnalSearchItem => Boolean(item)),
    ];
    for (const item of candidates) {
      const key = `${item.hymnalId}:${item.hymnNumber}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (excludeActive && item.hymnalId === activeHymnalId) continue;
      results.push(item);
      if (results.length >= HYMNAL_SEARCH_RESULT_LIMIT) return results;
    }
  }

  return results;
};

const hymnalSearchItemsByLanguage = new Map<string, HymnalSearchItem[]>();

export const getHymnalSearchItems = (
  language: string,
): HymnalSearchItem[] => {
  const cachedItems = hymnalSearchItemsByLanguage.get(language);
  if (cachedItems) return cachedItems;

  const label = (hymnalId: HymnalBookId) => getHymnalLabel(hymnalId, language);

  const english = getSortedHymns('en').map((hymn) => ({
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [
      hymn.number.toString(),
      hymn.title,
      hymn.scriptureReference || '',
      label('sdah-1985-en'),
    ],
    hymnalId: 'sdah-1985-en' as const,
    hymnNumber: hymn.number,
  }));

  const chinese505 = getSortedChinese505Hymns().map((hymn) => ({
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-505')],
    hymnalId: 'chinese-hymnal-505' as const,
    hymnNumber: hymn.number,
  }));

  const chinese506 = getSortedChinese506Hymns().map((hymn) => ({
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-506')],
    hymnalId: 'chinese-hymnal-506' as const,
    hymnNumber: hymn.number,
  }));

  const chinese707V1 = getSortedChinese707Hymns(1).map((hymn) => ({
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-707-v1')],
    hymnalId: 'chinese-hymnal-707-v1' as const,
    hymnNumber: hymn.number,
  }));

  const chinese707V2 = getSortedChinese707Hymns(2).map((hymn) => ({
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-707-v2')],
    hymnalId: 'chinese-hymnal-707-v2' as const,
    hymnNumber: hymn.number,
  }));

  const chinese707V3 = getSortedChinese707Hymns(3).map((hymn) => ({
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-707-v3')],
    hymnalId: 'chinese-hymnal-707-v3' as const,
    hymnNumber: hymn.number,
  }));

  const items = [
    ...english,
    ...chinese505,
    ...chinese506,
    ...chinese707V1,
    ...chinese707V2,
    ...chinese707V3,
  ].map((item) => ({
    ...item,
    normalizedSearchText: normalizeHymnalSearchText(
      [item.title, ...item.keywords].join('\n'),
    ),
  }));

  hymnalSearchItemsByLanguage.set(language, items);
  return items;
};
