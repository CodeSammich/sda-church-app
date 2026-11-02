import type { SupportedLanguage } from '@/constants/LanguageContext';
import { readCachedText, writeCachedText } from '@/services/CacheStore';
import { getVerseOfTheDayDateKey } from '@/services/VerseOfTheDay';
import { loadVerseWidgetDays } from '@/services/VerseOfTheDayWidgetData';
import VerseOfTheDayWidget from '@/features/verse-of-the-day/VerseOfTheDayWidget';

// The day, language, and title the widget last got its week of verses for.
const LAST_UPDATE = { folder: 'verse-of-the-day', name: 'widget.txt', key: 'votd_widget' };

let latestUpdate = 0;
let redrawn = false;

/**
 * Hands the home screen widget (#235) a week of verses in the app's language.
 * The home page calls it after loading the verse of the day; a widget that
 * isn't on the home screen just keeps them.
 *
 * Reading a week of verses can open seven books of the Bible, so it's done
 * once a day, or again when the language changes. If the language changes
 * while the verses load, only the newest language's reach the widget.
 *
 * Android redraws the widget with the layout it has, and the app only stores
 * a new layout (after an update) when it starts. So the first call each time
 * the app runs redraws the widget even when its verses are current.
 */
export async function updateVerseOfTheDayWidget(
  language: SupportedLanguage,
  title: string,
): Promise<void> {
  const update = ++latestUpdate;
  try {
    const signature = [getVerseOfTheDayDateKey(new Date()), language, title].join('\n');
    if ((await readCachedText(LAST_UPDATE)) === signature) {
      if (!redrawn) VerseOfTheDayWidget.reload();
      redrawn = true;
      return;
    }
    const days = await loadVerseWidgetDays(language);
    if (update !== latestUpdate || days.length === 0) return;
    VerseOfTheDayWidget.updateSnapshot({ title, days });
    redrawn = true;
    await writeCachedText(LAST_UPDATE, signature);
  } catch (e) {
    console.warn('Failed to update the verse of the day widget:', e);
  }
}
