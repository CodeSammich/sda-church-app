import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The digital bulletin's Sabbath School hymn rows, as in print (#626, #635):
 * Opening Hymns near the start of the program, one hymn per line, and Closing
 * Hymns near the end. The closing sings the opening hymns again, so its row
 * says so instead of listing them twice.
 */
const LABELS: Record<
  SupportedLanguage,
  {
    opening: [string, string];
    closing: [string, string];
    sameAsOpening: [string, string];
  }
> = {
  // [one hymn, more than one]
  en: {
    opening: ['Opening Hymn', 'Opening Hymns'],
    closing: ['Closing Hymn', 'Closing Hymns'],
    sameAsOpening: ['Same as Opening Hymn', 'Same as Opening Hymns'],
  },
  zh: {
    opening: ['開會詩歌', '開會詩歌'],
    closing: ['結會詩歌', '結會詩歌'],
    sameAsOpening: ['同開會詩歌', '同開會詩歌'],
  },
  'zh-cn': {
    opening: ['开会诗歌', '开会诗歌'],
    closing: ['结会诗歌', '结会诗歌'],
    sameAsOpening: ['同开会诗歌', '同开会诗歌'],
  },
  es: {
    opening: ['Himno de apertura', 'Himnos de apertura'],
    closing: ['Himno de clausura', 'Himnos de clausura'],
    sameAsOpening: ['Igual que el himno de apertura', 'Igual que los himnos de apertura'],
  },
};

/**
 * The two rows' labels, and the Closing Hymns row's text: blank with no
 * hymns, so the row shows Not available, like the opening row.
 */
export const getSabbathSchoolHymnRowText = (language: string, hymnCount: number) => {
  const labels = LABELS[language as SupportedLanguage] || LABELS.en;
  const form = hymnCount > 1 ? 1 : 0;
  return {
    openingLabel: labels.opening[form],
    closingLabel: labels.closing[form],
    closingValue: hymnCount > 0 ? labels.sameAsOpening[form] : '',
  };
};
