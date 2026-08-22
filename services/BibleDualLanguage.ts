import type { SupportedLanguage } from '@/constants/LanguageContext';

import {
  DEFAULT_TRANSLATION_MAP,
  renderVerseToPlainText,
  SUPPORTED_TRANSLATIONS,
  type ChapterHeading,
  type ChapterHebrewSubtitle,
  type ChapterVerse,
  type TranslationBookChapter,
} from './BibleService';

/**
 * Returns the app-language translation shown beneath a learner's selected
 * translation. Translations in the same language are intentionally not paired:
 * two English (or two Chinese) editions add noise without helping immersion.
 */
export const getSupportingBibleTranslation = (
  selectedTranslationId: string,
  appLanguage: SupportedLanguage,
) => {
  const selected = SUPPORTED_TRANSLATIONS.find(
    (translation) => translation.id === selectedTranslationId,
  );
  const supportingId = DEFAULT_TRANSLATION_MAP[appLanguage];
  const supporting = SUPPORTED_TRANSLATIONS.find(
    (translation) => translation.id === supportingId,
  );

  if (!selected || !supporting || selected.lang === supporting.lang) return null;
  return supporting;
};

/** Verse numbers are the stable alignment key shared by the supported editions. */
export const indexChapterVerses = (chapter: TranslationBookChapter | null) =>
  new Map(
    (chapter?.chapter.content || [])
      .filter((content): content is ChapterVerse => content.type === 'verse')
      .map((verse) => [verse.number, verse]),
  );

/** Returns the aligned primary/supporting text shown in verse-detail surfaces. */
export const getParallelVerseTexts = (
  primaryChapter: TranslationBookChapter | null,
  primaryTranslationId: string,
  supportingChapter: TranslationBookChapter | null,
  supportingTranslationId: string | null,
  verseNumber: number,
) => {
  const primaryVerse = indexChapterVerses(primaryChapter).get(verseNumber);
  if (!primaryVerse) return null;

  const supportingVerse = supportingTranslationId
    ? indexChapterVerses(supportingChapter).get(verseNumber)
    : null;

  return {
    primaryText: renderVerseToPlainText(primaryTranslationId, primaryVerse),
    supportingText:
      supportingVerse && supportingTranslationId
        ? renderVerseToPlainText(supportingTranslationId, supportingVerse)
        : null,
  };
};

type StructuralChapterContent = ChapterHeading | ChapterHebrewSubtitle;

const isStructuralChapterContent = (
  content: TranslationBookChapter['chapter']['content'][number],
): content is StructuralChapterContent =>
  content.type === 'heading' || content.type === 'hebrew_subtitle';

/**
 * Pairs chapter headings and superscriptions by their reading order. Bible
 * sources do not consistently classify Psalm superscriptions: one may call
 * the text a Hebrew subtitle while another exposes it as a second heading.
 */
export const getParallelStructuralContent = (
  primaryChapter: TranslationBookChapter | null,
  supportingChapter: TranslationBookChapter | null,
  primaryIndex: number,
) => {
  const primaryContent = primaryChapter?.chapter.content || [];
  if (!isStructuralChapterContent(primaryContent[primaryIndex])) return null;

  const structuralOrdinal =
    primaryContent
      .slice(0, primaryIndex + 1)
      .filter(isStructuralChapterContent).length - 1;
  if (structuralOrdinal < 0) return null;

  return (
    (supportingChapter?.chapter.content || []).filter(
      isStructuralChapterContent,
    )[structuralOrdinal] || null
  );
};
