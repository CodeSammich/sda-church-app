import type { MaterialCommunityIconName } from '@/components/AppIcon';
import OpenCC from 'opencc-js/t2cn';
import { getSortedChinese505Hymns } from './Chinese505Hymnal';
import { getSortedChinese506Hymns } from './Chinese506Hymnal';
import { getSortedChinese707Hymns } from './Chinese707Hymnal';
import {
  formatHymnalScriptureReference,
  getSortedHymns,
} from './EnglishHymnal';
import {
  getChinese505NumbersForSDAH1985,
  getSDAH1985NumbersForChinese505,
  type HymnalId,
} from './HymnalNumberMappings';

export interface HymnalSearchItem {
  title: string;
  keywords: string[];
  icon: MaterialCommunityIconName;
  route: string;
  subtitle?: string;
  isHymn: true;
  hymnalId: HymnalId | 'chinese-hymnal-506' | `chinese-hymnal-707-v${1 | 2 | 3}`;
  hymnalLabel: string;
  hymnNumber: number | string;
  normalizedSearchText: string;
}

const traditionalToSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });

export const normalizeHymnalSearchText = (value: string) =>
  traditionalToSimplified(value.normalize('NFKC').toLocaleLowerCase()).trim();

export const HYMNAL_SEARCH_RESULT_LIMIT = 60;

const HYMNAL_SEARCH_LABELS = {
  en: {
    goToHymn: 'Go directly to hymn',
    english: 'SDA Hymnal — 1985 Edition',
    chinese505: 'Chinese Hymnal — 505 Edition',
    chinese506: 'Chinese Hymnal — 506 Edition',
    chinese707V1: 'Hymns of Praise — 707 New Simplified Notation',
    chinese707V2: 'Hymns of Praise — 707 Four-Part Harmony',
    chinese707V3: 'Hymns of Praise — 707 Standard Edition',
  },
  zh: {
    goToHymn: '直接前往讚美詩',
    english: '英文 SDA 詩歌本 — 1985 年版',
    chinese505: '中文讚美詩 — 505 版',
    chinese506: '中文讚美詩 — 506 版',
    chinese707V1: '頌讚詩歌 — 707 新編簡譜版',
    chinese707V2: '頌讚詩歌 — 707 簡譜四聲部版',
    chinese707V3: '頌讚詩歌 — 707 標準版',
  },
  'zh-cn': {
    goToHymn: '直接前往赞美诗',
    english: '英文 SDA 诗歌本 — 1985 年版',
    chinese505: '中文赞美诗 — 505 版',
    chinese506: '中文赞美诗 — 506 版',
    chinese707V1: '颂赞诗歌 — 707 新编简谱版',
    chinese707V2: '颂赞诗歌 — 707 简谱四声部版',
    chinese707V3: '颂赞诗歌 — 707 标准版',
  },
  es: {
    goToHymn: 'Ir directamente al himno',
    english: 'Himnario ASD — Edición 1985',
    chinese505: 'Himnario Chino — Edición 505',
    chinese506: 'Himnario Chino — Edición 506',
    chinese707V1: 'Himnos de Alabanza — Edición 707 de Notación Nueva',
    chinese707V2: 'Himnos de Alabanza — Edición 707 a Cuatro Voces',
    chinese707V3: 'Himnos de Alabanza — Edición 707 Estándar',
  },
} as const;

const getLabels = (language: string) =>
  HYMNAL_SEARCH_LABELS[
    language as keyof typeof HYMNAL_SEARCH_LABELS
  ] || HYMNAL_SEARCH_LABELS.en;

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

/**
 * Search every hymnal, keeping the open hymnal's direct matches first. Known
 * English/Chinese equivalents are placed beside the matching hymn so either
 * language can be used as the starting point.
 */
export const getHymnalSearchResults = (
  items: HymnalSearchItem[],
  query: string,
  activeRoute?: string,
) => {
  const normalizedQuery = normalizeHymnalSearchText(query);
  if (!normalizedQuery) return [];
  const directMatches = items.filter((item) =>
    isNormalizedHymnalSearchMatch(item, normalizedQuery),
  );
  const buckets = new Map<HymnalSearchItem['hymnalId'], HymnalSearchItem[]>();
  for (const item of directMatches) {
    const bucket = buckets.get(item.hymnalId);
    if (bucket) bucket.push(item);
    else buckets.set(item.hymnalId, [item]);
  }
  const activeHymnalId = items.find(
    (item) => item.route.split('?')[0] === activeRoute,
  )?.hymnalId;
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
  const itemsByKey = new Map(
    items.map((item) => [`${item.hymnalId}:${item.hymnNumber}`, item]),
  );
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
      if (!seen.has(key)) {
        seen.add(key);
        results.push(item);
        if (results.length >= HYMNAL_SEARCH_RESULT_LIMIT) return results;
      }
    }
  }

  return results;
};

export const getHymnalSearchSubtitle = (language: string) =>
  getLabels(language).goToHymn;

const hymnalSearchItemsByLanguage = new Map<string, HymnalSearchItem[]>();

export const getHymnalSearchItems = (
  language: string,
): HymnalSearchItem[] => {
  const cachedItems = hymnalSearchItemsByLanguage.get(language);
  if (cachedItems) return cachedItems;

  const labels = getLabels(language);
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
      labels.english,
    ],
    route: `/home/english-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'sdah-1985-en' as const,
    hymnalLabel: labels.english,
    hymnNumber: hymn.number,
  }));

  const chinese505 = getSortedChinese505Hymns().map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese505],
    route: `/home/chinese-505-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-505' as const,
    hymnalLabel: labels.chinese505,
    hymnNumber: hymn.number,
  }));

  const chinese506 = getSortedChinese506Hymns().map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese506],
    route: `/home/chinese-506-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-506' as const,
    hymnalLabel: labels.chinese506,
    hymnNumber: hymn.number,
  }));

  const chinese707V1 = getSortedChinese707Hymns(1).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese707V1],
    route: `/home/chinese-707-new-simplified-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-707-v1' as const,
    hymnalLabel: labels.chinese707V1,
    hymnNumber: hymn.number,
  }));

  const chinese707V2 = getSortedChinese707Hymns(2).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese707V2],
    route: `/home/chinese-707-four-part-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-707-v2' as const,
    hymnalLabel: labels.chinese707V2,
    hymnNumber: hymn.number,
  }));

  const chinese707V3 = getSortedChinese707Hymns(3).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese707V3],
    route: `/home/chinese-707-standard-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
    hymnalId: 'chinese-hymnal-707-v3' as const,
    hymnalLabel: labels.chinese707V3,
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
