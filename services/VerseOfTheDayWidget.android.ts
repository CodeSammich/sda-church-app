import { createWidget } from 'expo-widgets';

import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  VERSE_WIDGET_NAME,
  VerseOfTheDayWidgetLayout,
} from '@/features/verse-of-the-day/VerseOfTheDayWidgetLayout';
import { redrawVerseWidget } from '@/modules/verse-widget';
import { readCachedText, writeCachedText } from '@/services/CacheStore';
import { getVerseOfTheDayDateKey } from '@/services/VerseOfTheDay';
import { loadVerseWidgetDays, type VerseWidgetProps } from '@/services/VerseOfTheDayWidgetData';

// The week of verses the widget last got, and the day, language, and title
// it was made for.
const LAST_WEEK = { folder: 'verse-of-the-day', name: 'widget.json', key: 'votd_widget' };

let latestUpdate = 0;
let storedThisRun = false;

/**
 * Hands the home screen widget (#235) a week of verses in the app's language,
 * then redraws it. The home page calls it after loading the verse of the day;
 * a widget that isn't on the home screen just keeps them.
 *
 * - Reading a week of verses can open seven books of the Bible, so it's done
 *   once a day, or again when the language changes. Otherwise the app hands
 *   the widget the week it last made, once each time the app runs, which also
 *   gives the widget the layout of a new version of the app.
 * - The week goes in as the widget's initial props, which expo-widgets stores
 *   without drawing the widget. Its own redraw would give the colors no
 *   dark-mode version, so the app's receiver draws it instead
 *   (modules/verse-widget).
 * - If the language changes while the verses load, only the newest
 *   language's reach the widget.
 */
export async function updateVerseOfTheDayWidget(
  language: SupportedLanguage,
  title: string,
): Promise<void> {
  const update = ++latestUpdate;
  try {
    const made = [getVerseOfTheDayDateKey(new Date()), language, title].join('\n');
    const last = parseLastWeek(await readCachedText(LAST_WEEK));
    let props: VerseWidgetProps;
    if (last?.made === made) {
      if (storedThisRun) return;
      props = last.props;
    } else {
      const days = await loadVerseWidgetDays(language);
      if (update !== latestUpdate || days.length === 0) return;
      props = { title, days };
      await writeCachedText(LAST_WEEK, JSON.stringify({ made, props }));
    }
    if (update !== latestUpdate) return;
    createWidget(VERSE_WIDGET_NAME, VerseOfTheDayWidgetLayout, props);
    storedThisRun = true;
    await redrawVerseWidget();
  } catch (e) {
    console.warn('Failed to update the verse of the day widget:', e);
  }
}

function parseLastWeek(text: string | null): { made: string; props: VerseWidgetProps } | null {
  if (!text) return null;
  try {
    const last = JSON.parse(text);
    return typeof last?.made === 'string' && Array.isArray(last?.props?.days) ? last : null;
  } catch {
    return null;
  }
}
