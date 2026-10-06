import type { SupportedLanguage } from '@/constants/LanguageContext';

/** Every hymnal the app lists, by the ID its search, routes, and mappings use. */
export type HymnalBookId =
  | 'sdah-1985-en'
  | 'chinese-hymnal-505'
  | 'chinese-hymnal-506'
  | 'chinese-hymnal-707-v1'
  | 'chinese-hymnal-707-v2'
  | 'chinese-hymnal-707-v3';

/**
 * Each hymnal's name, as "Title — Edition". The hymnal page shows the two
 * parts on separate lines; search results show the whole name.
 */
export const HYMNAL_LABELS: Record<HymnalBookId, Record<SupportedLanguage, string>> = {
  'sdah-1985-en': {
    en: 'SDA Hymnal — 1985 Edition',
    zh: '英文 SDA 詩歌本 — 1985 年版',
    'zh-cn': '英文 SDA 诗歌本 — 1985 年版',
    es: 'Himnario ASD — Edición 1985',
  },
  'chinese-hymnal-505': {
    en: 'Chinese Hymnal — 505 Edition',
    zh: '中文讚美詩 — 505 版',
    'zh-cn': '中文赞美诗 — 505 版',
    es: 'Himnario Chino — Edición 505',
  },
  'chinese-hymnal-506': {
    en: 'Chinese Hymnal — 506 Edition',
    zh: '中文讚美詩 — 506 版',
    'zh-cn': '中文赞美诗 — 506 版',
    es: 'Himnario Chino — Edición 506',
  },
  'chinese-hymnal-707-v1': {
    en: 'Hymns of Praise — 707 New Simplified Notation',
    zh: '頌讚詩歌 — 707 新編簡譜版',
    'zh-cn': '颂赞诗歌 — 707 新编简谱版',
    es: 'Himnos de Alabanza — Edición 707 de Notación Simplificada Nueva',
  },
  'chinese-hymnal-707-v2': {
    en: 'Hymns of Praise — 707 Four-Part Harmony',
    zh: '頌讚詩歌 — 707 簡譜四聲部版',
    'zh-cn': '颂赞诗歌 — 707 简谱四声部版',
    es: 'Himnos de Alabanza — Edición 707 a Cuatro Voces',
  },
  'chinese-hymnal-707-v3': {
    en: 'Hymns of Praise — 707 Standard Edition',
    zh: '頌讚詩歌 — 707 標準版',
    'zh-cn': '颂赞诗歌 — 707 标准版',
    es: 'Himnos de Alabanza — Edición 707 Estándar',
  },
};

export const getHymnalLabel = (hymnalId: HymnalBookId, language: string) =>
  HYMNAL_LABELS[hymnalId][language as SupportedLanguage] ||
  HYMNAL_LABELS[hymnalId].en;

/** A hymnal's name split into its title and edition, such as "SDA Hymnal" and "1985 Edition". */
export const getHymnalTitleParts = (hymnalId: HymnalBookId, language: string) => {
  const [title, edition = ''] = getHymnalLabel(hymnalId, language).split(' — ');
  return { title, edition };
};
