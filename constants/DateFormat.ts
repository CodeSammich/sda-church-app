import type { SupportedLanguage } from './LanguageContext';

const CHINESE_WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/**
 * A date in the app's language, such as "November 7, 2026" or "Saturday,
 * November 7" in English, and 2026年11月7日 or 11月7日星期六 in either Chinese
 * script.
 *
 * Chinese is written out by hand. On Android, Hermes, the app's JavaScript
 * engine, formats Intl dates for zh-TW, zh-CN, and zh-cn in English; only a
 * bare zh comes out in Chinese. Node, which runs the tests, formats them all in
 * Chinese, so no test would notice. Format app dates here rather than with
 * Intl.DateTimeFormat directly; test/date-format.test.ts checks.
 */
export const formatAppDate = (
  date: Date,
  language: SupportedLanguage,
  { year = false, weekday = false }: { year?: boolean; weekday?: boolean } = {},
) => {
  if (language === 'zh' || language === 'zh-cn') {
    return `${year ? `${date.getFullYear()}年` : ''}${date.getMonth() + 1}月${date.getDate()}日${weekday ? `星期${CHINESE_WEEKDAYS[date.getDay()]}` : ''}`;
  }
  return new Intl.DateTimeFormat(language, {
    weekday: weekday ? 'long' : undefined,
    year: year ? 'numeric' : undefined,
    month: 'long',
    day: 'numeric',
  }).format(date);
};
