import type { MaterialCommunityIconName } from '@/components/AppIcon';
import { getSortedChinese505Hymns } from './Chinese505Hymnal';
import { getSortedChinese506Hymns } from './Chinese506Hymnal';
import { getSortedChinese707Hymns } from './Chinese707Hymnal';
import {
  formatHymnalScriptureReference,
  getSortedHymns,
} from './EnglishHymnal';

export interface HymnalSearchItem {
  title: string;
  keywords: string[];
  icon: MaterialCommunityIconName;
  route: string;
  subtitle?: string;
  isHymn: true;
}

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
  const normalizedQuery = query.toLocaleLowerCase().trim();
  if (!normalizedQuery) return false;
  if (item.title.toLocaleLowerCase().includes(normalizedQuery)) return true;
  if (
    item.keywords.some((keyword) =>
      keyword.toLocaleLowerCase().includes(normalizedQuery),
    )
  ) {
    return true;
  }
  return (
    /^\d+$/.test(normalizedQuery) &&
    item.title.split('.')[0] === normalizedQuery
  );
};

export const getHymnalSearchSubtitle = (language: string) =>
  getLabels(language).goToHymn;

export const getHymnalSearchItems = (
  language: string,
): HymnalSearchItem[] => {
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
  }));

  const chinese505 = getSortedChinese505Hymns().map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese505],
    route: `/home/chinese-505-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
  }));

  const chinese506 = getSortedChinese506Hymns().map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese506],
    route: `/home/chinese-506-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
  }));

  const chinese707V1 = getSortedChinese707Hymns(1).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese707V1],
    route: `/home/chinese-707-new-simplified-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
  }));

  const chinese707V2 = getSortedChinese707Hymns(2).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese707V2],
    route: `/home/chinese-707-four-part-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
  }));

  const chinese707V3 = getSortedChinese707Hymns(3).map((hymn) => ({
    ...common,
    title: `${hymn.number}. ${hymn.title}`,
    keywords: [hymn.number.toString(), hymn.title, labels.chinese707V3],
    route: `/home/chinese-707-standard-hymnal?hymnNum=${hymn.number}&backTo=/home/hymnal-selection`,
  }));

  return [
    ...english,
    ...chinese505,
    ...chinese506,
    ...chinese707V1,
    ...chinese707V2,
    ...chinese707V3,
  ];
};
