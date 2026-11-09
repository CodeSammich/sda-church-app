import type { SupportedLanguage } from '@/constants/LanguageContext';
import { BIBLE_BOOK_NAMES } from './BibleService';

/**
 * The names the Bible reader gives a book, a chapter, and a verse when the
 * translation being read is in another language than the app's (#723), such
 * as the Chinese Union Version in an English app.
 *
 * - The Bible card's book pill is a control, so it names the book in the app's
 *   language alone: 1 Samuel in an English app reading the CUV. One name keeps
 *   it from overflowing the card; it still shortens as before when the row is
 *   tight (getDockPillLabels).
 * - The book, chapter, and verse lists, and the places that show a verse's
 *   words (search results, saved verses, a verse's popup), name it in the
 *   translation's language, then the app's in parentheses, as a reader of
 *   both would: 撒母耳記上 (1 Samuel), or 1 Samuel (撒母耳記上) in a Chinese
 *   app reading the BSB, and 第 3 節 (Verse 3).
 * - When the translation is in the app's language, everything shows one name,
 *   as before. Traditional and Simplified Chinese count as one language, so a
 *   Traditional app reading the Simplified CUV lists 撒母耳记上 alone, not
 *   撒母耳记上 (撒母耳記上); its pill, in the app's script, says 撒母耳記上.
 * - In dual-language reading, the main translation counts: its names are the
 *   ones the lists and search results show, and its chapters the reader
 *   follows. The second translation's language adds no third name.
 *
 * A book's name in the translation's language is the translation's own, as
 * it has always shown; in the app's language it's BIBLE_BOOK_NAMES, the names
 * the rest of the app uses.
 */

/** Traditional and Simplified Chinese are one language here. */
const languageOf = (language: string) => (language === 'zh-cn' ? 'zh' : language);

/** Whether a translation is in the app's language, so one name will do. */
export const readsInAppLanguage = (translationLanguage: string, appLanguage: SupportedLanguage) =>
  languageOf(translationLanguage) === languageOf(appLanguage);

/** A name in the translation's language, and the app's when it's another. */
export type TwoLanguageName = Readonly<{ name: string; appName?: string }>;

/** "撒母耳記上 (1 Samuel)", or the one name. */
export const formatTwoLanguageName = ({ name, appName }: TwoLanguageName) =>
  appName ? `${name} (${appName})` : name;

const twoLanguageName = (name: string, appName: string | undefined): TwoLanguageName =>
  appName && appName !== name ? { name, appName } : { name };

type NamedBook = Readonly<{ id: string; name: string }>;

/**
 * The book pill's name: the book in the app's language. The translation's
 * own name when the translation is in the app's language, so an English app
 * reading the BSB still says "Song", as the BSB does.
 */
export const getBookPillName = (
  book: NamedBook,
  translationLanguage: string,
  appLanguage: SupportedLanguage,
) =>
  translationLanguage === appLanguage ? book.name : (BIBLE_BOOK_NAMES[book.id]?.[appLanguage] ?? book.name);

/** A book in the lists and in references: 撒母耳記上 (1 Samuel). */
export const getBookListName = (
  book: NamedBook,
  translationLanguage: string,
  appLanguage: SupportedLanguage,
): TwoLanguageName =>
  readsInAppLanguage(translationLanguage, appLanguage)
    ? { name: book.name }
    : twoLanguageName(book.name, BIBLE_BOOK_NAMES[book.id]?.[appLanguage]);

/** A book's reference, as search results, saved verses, and a verse's popup show it. */
export const formatBookReference = (
  book: NamedBook,
  translationLanguage: string,
  appLanguage: SupportedLanguage,
  chapterAndVerses: string,
) => `${formatTwoLanguageName(getBookListName(book, translationLanguage, appLanguage))} ${chapterAndVerses}`;

/** The main translation's books for search, named as its results show them. */
export const getSearchBooks = (
  books: readonly Readonly<{ id: string; name: string; numberOfChapters: number }>[],
  translationLanguage: string,
  appLanguage: SupportedLanguage,
) =>
  books.map((book) => ({
    id: book.id,
    name: formatTwoLanguageName(getBookListName(book, translationLanguage, appLanguage)),
    numberOfChapters: book.numberOfChapters,
  }));

/** The chapter and verse lists' rows, in each language the reader uses. */
const PICKER_ITEM_LABELS: Record<SupportedLanguage, Record<'chapter' | 'verse', string>> = {
  en: { chapter: 'Chapter {n}', verse: 'Verse {n}' },
  zh: { chapter: '第 {n} 章', verse: '第 {n} 節' },
  'zh-cn': { chapter: '第 {n} 章', verse: '第 {n} 节' },
  es: { chapter: 'Capítulo {n}', verse: 'Versículo {n}' },
};

const pickerItemLabel = (kind: 'chapter' | 'verse', number: number, language: string) =>
  PICKER_ITEM_LABELS[language as SupportedLanguage]?.[kind].replace('{n}', String(number));

/**
 * A row of the chapter or verse list: 第 3 節 (Verse 3) in an English app
 * reading the CUV, and Verse 3 alone, in the app's words as before, when the
 * translation is in the app's language.
 */
export const getPickerItemName = (
  kind: 'chapter' | 'verse',
  number: number,
  translationLanguage: string,
  appLanguage: SupportedLanguage,
): TwoLanguageName => {
  const appName = pickerItemLabel(kind, number, appLanguage) ?? pickerItemLabel(kind, number, 'en')!;
  const readingName = pickerItemLabel(kind, number, translationLanguage);
  return readsInAppLanguage(translationLanguage, appLanguage) || !readingName
    ? { name: appName }
    : twoLanguageName(readingName, appName);
};
