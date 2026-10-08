import OpenCC from 'opencc-js/t2cn';
import { getSortedChinese505Hymns } from './Chinese505Hymnal';
import { getSortedChinese506Hymns } from './Chinese506Hymnal';
import { getSortedChinese707Hymns } from './Chinese707Hymnal';
import { getSortedHymns } from './EnglishHymnal';
import { getHymnalLabel, type HymnalBookId } from './HymnalLabels';
import { getHymnEquivalents, HYMNAL_CROSS_REFERENCE_TABLES } from './HymnalNumberMappings';

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

/** One hymnal's matches in the search across the other hymnals. */
export type HymnalSearchGroup = Readonly<{
  hymnalId: HymnalBookId;
  /** By number, with the hymn of exactly the number searched for first. */
  hymns: readonly HymnalSearchItem[];
}>;

// The hymnals a cross-reference table pairs with this one, such as the 505 for
// the 1985.
const getPairedHymnalIds = (hymnalId: HymnalBookId) =>
  new Set(
    HYMNAL_CROSS_REFERENCE_TABLES.filter(({ hymnalIds }) => hymnalIds.includes(hymnalId))
      .flatMap(({ hymnalIds }) => hymnalIds)
      .filter((id) => id !== hymnalId),
  );

// Hymn numbers in order, with 707's "12B" after 12.
const compareHymnNumbers = (a: number | string, b: number | string) =>
  Number.parseInt(a.toString(), 10) - Number.parseInt(b.toString(), 10) ||
  a.toString().localeCompare(b.toString());

/**
 * The other hymnals' matches for the hymnal page's search, one group per
 * hymnal: first the hymnals a cross-reference table pairs with the open one,
 * then the rest in `hymnalOrder`. A group also holds the same hymn as any match
 * in another hymnal, from the cross-reference tables, so a 1985 title search
 * finds the 505 hymn and a Chinese one finds the 1985 hymn.
 */
export const getOtherHymnalSearchGroups = (
  items: readonly HymnalSearchItem[],
  query: string,
  {
    activeHymnalId,
    hymnalOrder,
  }: { activeHymnalId: HymnalBookId; hymnalOrder: readonly HymnalBookId[] },
): HymnalSearchGroup[] => {
  const normalizedQuery = normalizeHymnalSearchText(query);
  if (!normalizedQuery) return [];
  const itemsByKey = getItemsByKey(items);
  const hymnsByHymnal = new Map<HymnalBookId, Map<string, HymnalSearchItem>>();
  const add = (item: HymnalSearchItem) => {
    if (item.hymnalId === activeHymnalId) return;
    let hymns = hymnsByHymnal.get(item.hymnalId);
    if (!hymns) hymnsByHymnal.set(item.hymnalId, (hymns = new Map()));
    hymns.set(item.hymnNumber.toString(), item);
  };
  for (const item of items) {
    if (!isNormalizedHymnalSearchMatch(item, normalizedQuery)) continue;
    add(item);
    for (const key of getEquivalentKeys(item)) {
      const equivalent = itemsByKey.get(key);
      if (equivalent) add(equivalent);
    }
  }

  // A number someone was given, such as "100", leads with each hymnal's 100
  // rather than the hymns whose titles or scripture mention it.
  const isExactNumber = (item: HymnalSearchItem) =>
    item.hymnNumber.toString().toLocaleLowerCase() === normalizedQuery;
  const paired = getPairedHymnalIds(activeHymnalId);
  return [
    ...hymnalOrder.filter((id) => paired.has(id)),
    ...hymnalOrder.filter((id) => !paired.has(id)),
  ].flatMap((hymnalId) => {
    const hymns = hymnsByHymnal.get(hymnalId);
    if (!hymns) return [];
    return [
      {
        hymnalId,
        hymns: [...hymns.values()].sort(
          (a, b) =>
            Number(isExactNumber(b)) - Number(isExactNumber(a)) ||
            compareHymnNumbers(a.hymnNumber, b.hymnNumber),
        ),
      },
    ];
  });
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
