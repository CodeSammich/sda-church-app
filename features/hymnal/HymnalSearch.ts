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
