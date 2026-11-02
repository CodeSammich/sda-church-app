import type { SupportedLanguage } from '@/constants/LanguageContext';
import { loadVerseWidgetDays } from '@/services/VerseOfTheDayWidgetData';
import VerseOfTheDayWidget from '@/widgets/VerseOfTheDayWidget';

let latestUpdate = 0;

/**
 * Hands the home screen widget (#235) a week of verses in the app's language.
 * The home page calls it after loading the verse of the day; a widget that
 * isn't on the home screen just keeps them. If the language changes while the
 * verses load, only the newest language's reach the widget.
 */
export async function updateVerseOfTheDayWidget(
  language: SupportedLanguage,
  title: string,
): Promise<void> {
  const update = ++latestUpdate;
  try {
    const days = await loadVerseWidgetDays(language);
    if (update !== latestUpdate || days.length === 0) return;
    VerseOfTheDayWidget.updateSnapshot({ title, days });
  } catch (e) {
    console.warn('Failed to update the verse of the day widget:', e);
  }
}
