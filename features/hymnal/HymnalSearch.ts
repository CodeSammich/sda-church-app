import type { MaterialCommunityIconName } from '@/components/AppIcon';
import OpenCC from 'opencc-js/t2cn';
import { getSortedChinese505Hymns } from './Chinese505Hymnal';
import { getSortedChinese506Hymns } from './Chinese506Hymnal';
import { getSortedChinese707Hymns } from './Chinese707Hymnal';
import {
  formatHymnalScriptureReference,
  getSortedHymns,
} from './EnglishHymnal';
import { getHymnalLabel, type HymnalBookId } from './HymnalLabels';
import {
  getChinese505NumbersForSDAH1985,
  getSDAH1985NumbersForChinese505,
} from './HymnalNumberMappings';

export interface HymnalSearchItem {
  title: string;
  keywords: string[];
  icon: MaterialCommunityIconName;
  route: string;
  subtitle?: string;
  isHymn: true;
  hymnalId: HymnalBookId;
  hymnalLabel: string;
  hymnNumber: number | string;
  normalizedSearchText: string;
}

const traditionalToSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

export const normalizeHymnalSearchText = (value: string) =>
  traditionalToSimplified(value.normalize('NFKC').toLocaleLowerCase()).trim();

export const HYMNAL_SEARCH_RESULT_LIMIT = 60;

export type HeaderSearchCandidate = {
  searchPriority?: number;
  searchNumber?: string;
  searchText?: string;
  subtitle: string;
  title: string;
};

export const filterHeaderSearchItems = <Item extends HeaderSearchCandidate>(
  items: readonly Item[],
  query: string,
) => {
  const normalizedQuery = normalizeHymnalSearchText(query);
  if (!normalizedQuery) return [];

  return items
    .filter((item) =>
      /^\d+$/.test(normalizedQuery) && item.searchNumber
        ? item.searchNumber === normalizedQuery
        : normalizeHymnalSearchText(
            `${item.title} ${item.subtitle} ${item.searchText || ''}`,
          ).includes(normalizedQuery),
    )
    .sort(
      (left, right) =>
        (right.searchPriority || 0) - (left.searchPriority || 0),
    )
    .slice(0, HYMNAL_SEARCH_RESULT_LIMIT);
};

export const isHymnalSearchMatch = (
  item: HymnalSearchItem,
  query: string,
) => {
  const normalizedQuery = normalizeHymnalSearchText(query);
  if (!normalizedQuery) return false;
  return isNormalizedHymnalSearchMatch(item, normalizedQuery);
};

const isNormalizedHymnalSearchMatch = (
  item: HymnalSearchItem,
  normalizedQuery: string,
) =>
  item.normalizedSearchText.includes(normalizedQuery) ||
  (/^\d+$/.test(normalizedQuery) &&
    item.hymnNumber.toString() === normalizedQuery);

const getCrossLanguageKeys = (item: HymnalSearchItem) => {
  if (item.hymnalId === 'sdah-1985-en') {
    return (getChinese505NumbersForSDAH1985(Number(item.hymnNumber)) || []).map(
      (number) => `chinese-hymnal-505:${number}`,
    );
  }
  if (item.hymnalId === 'chinese-hymnal-505') {
    return (getSDAH1985NumbersForChinese505(Number(item.hymnNumber)) || []).map(
      (number) => `sdah-1985-en:${number}`,
    );
  }
  return [];
};

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
 * Search every hymnal, keeping the open hymnal's direct matches first. Known
 * English/Chinese equivalents are placed beside the matching hymn so either
 * language can be used as the starting point.
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
      ...getCrossLanguageKeys(match)
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
  const common = {
    icon: 'music-note' as const,
    isHymn: true as const,
  };

  const english = getSortedHymns('en').map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    subtitle: formatHymnalScriptureReference(hymn.scriptureReference),
    keywords: [
      hymn.number.toString(),
      hymn.title,
      hymn.scriptureReference || '',
      label('sdah-1985-en'),
    ],
    route: `/home/english-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'sdah-1985-en' as const,
    hymnalLabel: label('sdah-1985-en'),
    hymnNumber: hymn.number,
  }));

  const chinese505 = getSortedChinese505Hymns().map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-505')],
    route: `/home/chinese-505-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-505' as const,
    hymnalLabel: label('chinese-hymnal-505'),
    hymnNumber: hymn.number,
  }));

  const chinese506 = getSortedChinese506Hymns().map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-506')],
    route: `/home/chinese-506-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-506' as const,
    hymnalLabel: label('chinese-hymnal-506'),
    hymnNumber: hymn.number,
  }));

  const chinese707V1 = getSortedChinese707Hymns(1).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-707-v1')],
    route: `/home/chinese-707-new-simplified-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-707-v1' as const,
    hymnalLabel: label('chinese-hymnal-707-v1'),
    hymnNumber: hymn.number,
  }));

  const chinese707V2 = getSortedChinese707Hymns(2).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-707-v2')],
    route: `/home/chinese-707-four-part-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-707-v2' as const,
    hymnalLabel: label('chinese-hymnal-707-v2'),
    hymnNumber: hymn.number,
  }));

  const chinese707V3 = getSortedChinese707Hymns(3).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, label('chinese-hymnal-707-v3')],
    route: `/home/chinese-707-standard-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-707-v3' as const,
    hymnalLabel: label('chinese-hymnal-707-v3'),
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
