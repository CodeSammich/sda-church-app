import { createWidget } from 'expo-widgets';

import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  VERSE_WIDGET_COLORS,
  VERSE_WIDGET_NAME,
  VerseOfTheDayWidgetLayout,
} from '@/features/verse-of-the-day/VerseOfTheDayWidgetLayout';
import { redrawVerseWidget } from '@/modules/verse-widget';
import { readCachedText, writeCachedText } from '@/services/CacheStore';
import { getVerseOfTheDayDateKey } from '@/services/VerseOfTheDay';
import {
  loadVerseWidgetWeek,
  type VerseWidgetLabels,
  type VerseWidgetWeek,
} from '@/services/VerseOfTheDayWidgetData';

// The week of verses the widget last got, and the day, language, and labels
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
 *   gives the widget the layout and colors of a new version of the app.
 * - The week goes in as the widget's initial props, with the theme's colors,
 *   which expo-widgets stores without drawing the widget. Its own redraw would
 *   skip the app's receiver, which gives the widget its dark-mode colors, so
 *   the receiver draws it instead (modules/verse-widget).
 * - If the language changes while the verses load, only the newest
 *   language's reach the widget.
 */
export async function updateVerseOfTheDayWidget(
  language: SupportedLanguage,
  labels: VerseWidgetLabels,
): Promise<void> {
  const update = ++latestUpdate;
  try {
    const made = [getVerseOfTheDayDateKey(new Date()), language, labels.title, labels.share].join('\n');
    const last = parseLastWeek(await readCachedText(LAST_WEEK));
    let week: VerseWidgetWeek;
    if (last?.made === made) {
      if (storedThisRun) return;
      week = last.week;
    } else {
      week = await loadVerseWidgetWeek(language, labels);
      if (update !== latestUpdate || week.days.length === 0) return;
      await writeCachedText(LAST_WEEK, JSON.stringify({ made, week }));
    }
    if (update !== latestUpdate) return;
    createWidget(VERSE_WIDGET_NAME, VerseOfTheDayWidgetLayout, { ...week, colors: VERSE_WIDGET_COLORS });
    storedThisRun = true;
    await redrawVerseWidget();
  } catch (e) {
    console.warn('Failed to update the verse of the day widget:', e);
  }
}

function parseLastWeek(text: string | null): { made: string; week: VerseWidgetWeek } | null {
  if (!text) return null;
  try {
    const last = JSON.parse(text);
    return typeof last?.made === 'string' && Array.isArray(last?.week?.days) ? last : null;
  } catch {
    return null;
  }
}
