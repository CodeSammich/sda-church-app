import type { SupportedLanguage } from '@/constants/LanguageContext';
import type { VerseWidgetLabels } from '@/services/VerseOfTheDayWidgetData';

/**
 * Only Android has the home screen widget (#235), in
 * VerseOfTheDayWidget.android.ts. iOS and the web have nothing to update.
 */
export async function updateVerseOfTheDayWidget(
  _language: SupportedLanguage,
  _labels: VerseWidgetLabels,
): Promise<void> {}
