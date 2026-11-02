import * as BibleService from '@/services/BibleService';
import { balanceQuotationMarks, type VerseReference } from '@/services/VerseOfTheDay';

export interface VerseOfTheDayText extends VerseReference {
  text: string;
  /** The book's name in the translation with the chapter and verse, such as `Psalm 23:1`. */
  reference: string;
}

/**
 * Reads a verse of the day from the Bible text that ships with the app, for
 * the home page and the Android widget. Returns null if the translation lacks
 * the book or verse.
 */
export async function loadVerseOfTheDayText(
  translationId: string,
  selection: VerseReference,
): Promise<VerseOfTheDayText | null> {
  const books = await BibleService.fetchBooks(translationId);
  const book = books.find((b) => b.id === selection.bookId);
  if (!book) return null;
  const chapterData = await BibleService.fetchChapter(translationId, book.id, selection.chapter);
  const verseContent = chapterData.chapter.content.find(
    (c) => c.type === 'verse' && c.number === selection.verse,
  ) as BibleService.ChapterVerse | undefined;
  if (!verseContent) return null;

  return {
    // The Bible text keeps its own punctuation. Only quotation marks that
    // open or close in a neighboring verse are balanced.
    text: balanceQuotationMarks(BibleService.renderVerseToPlainText(translationId, verseContent)),
    reference: `${book.name} ${selection.chapter}:${selection.verse}`,
    bookId: book.id,
    chapter: selection.chapter,
    verse: selection.verse,
  };
}
