import type { SupportedLanguage } from '@/constants/LanguageContext';
import { DEFAULT_TRANSLATION_MAP, getScriptureReaderParams } from '@/services/BibleService';
import {
  getVerseOfTheDay,
  getVerseOfTheDayDate,
  getVerseOfTheDayDateKey,
  type VerseReference,
} from '@/services/VerseOfTheDay';
import {
  formatVerseOfTheDayShare,
  getTranslationName,
  loadVerseOfTheDayText,
} from '@/services/VerseOfTheDayText';

/**
 * What the Android home screen widget shows (#235).
 *
 * Android only redraws the widget; it can't run the app to fetch a new verse.
 * So the app hands the widget a week of verses whenever the home page loads,
 * and the widget picks the day's verse each time Android redraws it, about
 * once an hour. Someone who doesn't open the app for a week keeps the last
 * verse until they do.
 */
export const VERSE_WIDGET_DAYS = 7;

/** The app's link scheme, from app.json. */
export const APP_LINK_SCHEME = 'sdachurchapp';

export interface VerseWidgetDay {
  /** The verse's day, as getVerseOfTheDayDateKey gives it, such as `2026-11-2`. */
  day: string;
  text: string;
  reference: string;
  /** The verse's number, which the widget shows before the text, as `[16]`. */
  verse: number;
  /** Opens the verse in the Bible reader, as the home page's Read button does. */
  url: string;
  /** What the share button shares, as the home page's Share button does. */
  share: string;
}

/** The theme colors the widget uses, from constants/ThemeColors.ts. */
export interface VerseWidgetColors {
  background: string;
  primary: string;
  onSurface: string;
  onSurfaceVariant: string;
}

/** The week of verses and the labels around them, in the app's language. */
export interface VerseWidgetWeek {
  /** The home page's heading for the verse. */
  title: string;
  /** The home page's label for sharing the verse, for screen readers. */
  shareLabel: string;
  /** The name of the translation the verses are from, such as `BSB`. */
  translation: string;
  days: VerseWidgetDay[];
}

export interface VerseWidgetProps extends VerseWidgetWeek {
  colors: { light: VerseWidgetColors; dark: VerseWidgetColors };
}

export function getVerseWidgetUrl(verse: VerseReference, language: SupportedLanguage): string {
  const params: Record<string, string> = {
    ...getScriptureReaderParams(
      {
        bookId: verse.bookId,
        chapter: verse.chapter,
        verseStart: verse.verse,
        verseEnd: verse.verse,
      },
      language,
    ),
    backTo: '/',
  };
  const query = Object.entries(params)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');
  return `${APP_LINK_SCHEME}://bible?${query}`;
}

/** The home page's labels the widget shows, in the app's language. */
export interface VerseWidgetLabels {
  title: string;
  share: string;
}

/** The verses of the day from today on, and the widget's labels, in the app's language. */
export async function loadVerseWidgetWeek(
  language: SupportedLanguage,
  labels: VerseWidgetLabels,
  now: Date = new Date(),
): Promise<VerseWidgetWeek> {
  const translationId = DEFAULT_TRANSLATION_MAP[language] || 'BSB';
  const translation = getTranslationName(translationId);
  const today = getVerseOfTheDayDate(now);
  const days: VerseWidgetDay[] = [];

  for (let offset = 0; offset < VERSE_WIDGET_DAYS; offset += 1) {
    // Noon keeps each day clear of the 6 AM change and of daylight saving.
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset, 12);
    const verse = await loadVerseOfTheDayText(translationId, getVerseOfTheDay(date));
    if (!verse) continue;
    days.push({
      day: getVerseOfTheDayDateKey(date),
      text: verse.text,
      reference: verse.reference,
      verse: verse.verse,
      url: getVerseWidgetUrl(verse, language),
      share: formatVerseOfTheDayShare(verse, translation),
    });
  }
  return { title: labels.title, shareLabel: labels.share, translation, days };
}
