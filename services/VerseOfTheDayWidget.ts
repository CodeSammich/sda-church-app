import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * Only Android has the home screen widget (#235), in
 * VerseOfTheDayWidget.android.ts. iOS and the web have nothing to update.
 */
export async function updateVerseOfTheDayWidget(
  _language: SupportedLanguage,
  _title: string,
): Promise<void> {}
