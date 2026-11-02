import type { SupportedLanguage } from '@/constants/LanguageContext';
import { readCachedText, writeCachedText } from '@/services/CacheStore';
import { getVerseOfTheDayDateKey } from '@/services/VerseOfTheDay';
import { loadVerseWidgetDays } from '@/services/VerseOfTheDayWidgetData';
import VerseOfTheDayWidget from '@/widgets/VerseOfTheDayWidget';

// The day, language, and title the widget last got its week of verses for.
const LAST_UPDATE = { folder: 'verse-of-the-day', name: 'widget.txt', key: 'votd_widget' };

let latestUpdate = 0;

/**
 * Hands the home screen widget (#235) a week of verses in the app's language.
 * The home page calls it after loading the verse of the day; a widget that
 * isn't on the home screen just keeps them.
 *
 * Reading a week of verses can open seven books of the Bible, so it's done
 * once a day, or again when the language changes. If the language changes
 * while the verses load, only the newest language's reach the widget.
 */
export async function updateVerseOfTheDayWidget(
  language: SupportedLanguage,
  title: string,
): Promise<void> {
  const update = ++latestUpdate;
  try {
    const signature = [getVerseOfTheDayDateKey(new Date()), language, title].join('\n');
    if ((await readCachedText(LAST_UPDATE)) === signature) return;
    const days = await loadVerseWidgetDays(language);
    if (update !== latestUpdate || days.length === 0) return;
    VerseOfTheDayWidget.updateSnapshot({ title, days });
    await writeCachedText(LAST_UPDATE, signature);
  } catch (e) {
    console.warn('Failed to update the verse of the day widget:', e);
  }
}
