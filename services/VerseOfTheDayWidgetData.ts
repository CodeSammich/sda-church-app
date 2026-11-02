import type { SupportedLanguage } from '@/constants/LanguageContext';
import { DEFAULT_TRANSLATION_MAP, getScriptureReaderParams } from '@/services/BibleService';
import {
  getVerseOfTheDay,
  getVerseOfTheDayDate,
  getVerseOfTheDayDateKey,
  type VerseReference,
} from '@/services/VerseOfTheDay';
import { loadVerseOfTheDayText } from '@/services/VerseOfTheDayText';

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
  /** Opens the verse in the Bible reader, as the home page's Read button does. */
  url: string;
}

export interface VerseWidgetProps {
  /** The home page's heading for the verse, in the app's language. */
  title: string;
  days: VerseWidgetDay[];
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

/** The verses of the day from today on, in the app's language. */
export async function loadVerseWidgetDays(
  language: SupportedLanguage,
  now: Date = new Date(),
): Promise<VerseWidgetDay[]> {
  const translationId = DEFAULT_TRANSLATION_MAP[language] || 'BSB';
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
      url: getVerseWidgetUrl(verse, language),
    });
  }
  return days;
}
