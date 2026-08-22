import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_VERSES_STORAGE_KEY = 'saved-bible-verses-v1';

export interface SavedVerseReference {
  bookId: string;
  chapter: number;
  verse: number;
  savedAt: number;
}

export type SavedVerseSort = 'recent' | 'bible';

export interface SavedVerseGroup {
  bookId: string;
  chapter: number;
  verseStart: number;
  verseEnd: number;
  savedAt: number;
  verses: SavedVerseReference[];
}

export const getSavedVerseKey = (
  verse: Pick<SavedVerseReference, 'bookId' | 'chapter' | 'verse'>,
) => `${verse.bookId}:${verse.chapter}:${verse.verse}`;

const compareBibleOrder = (
  left: Pick<SavedVerseReference, 'bookId' | 'chapter' | 'verse'>,
  right: Pick<SavedVerseReference, 'bookId' | 'chapter' | 'verse'>,
  bookOrder: Map<string, number>,
) => {
  const leftBook = bookOrder.get(left.bookId) ?? Number.MAX_SAFE_INTEGER;
  const rightBook = bookOrder.get(right.bookId) ?? Number.MAX_SAFE_INTEGER;
  return (
    leftBook - rightBook ||
    left.bookId.localeCompare(right.bookId) ||
    left.chapter - right.chapter ||
    left.verse - right.verse
  );
};

/** Groups adjacent saved verses while keeping storage references independent. */
export const groupSavedVerses = (
  verses: SavedVerseReference[],
  orderedBookIds: string[],
  sort: SavedVerseSort = 'recent',
): SavedVerseGroup[] => {
  const bookOrder = new Map(orderedBookIds.map((bookId, index) => [bookId, index]));
  const uniqueVerses = Array.from(
    new Map(verses.map((verse) => [getSavedVerseKey(verse), verse])).values(),
  ).sort((left, right) => compareBibleOrder(left, right, bookOrder));

  const groups: SavedVerseGroup[] = [];
  for (const verse of uniqueVerses) {
    const previous = groups.at(-1);
    if (
      previous &&
      previous.bookId === verse.bookId &&
      previous.chapter === verse.chapter &&
      verse.verse === previous.verseEnd + 1
    ) {
      previous.verseEnd = verse.verse;
      previous.savedAt = Math.max(previous.savedAt, verse.savedAt);
      previous.verses.push(verse);
    } else {
      groups.push({
        bookId: verse.bookId,
        chapter: verse.chapter,
        verseStart: verse.verse,
        verseEnd: verse.verse,
        savedAt: verse.savedAt,
        verses: [verse],
      });
    }
  }

  if (sort === 'recent') {
    groups.sort(
      (left, right) =>
        right.savedAt - left.savedAt ||
        compareBibleOrder(
          { ...left, verse: left.verseStart },
          { ...right, verse: right.verseStart },
          bookOrder,
        ),
    );
  }

  return groups;
};

const isSavedVerseReference = (value: unknown): value is SavedVerseReference => {
  if (!value || typeof value !== 'object') return false;
  const verse = value as Partial<SavedVerseReference>;
  return (
    typeof verse.bookId === 'string' &&
    Number.isInteger(verse.chapter) &&
    (verse.chapter || 0) > 0 &&
    Number.isInteger(verse.verse) &&
    (verse.verse || 0) > 0 &&
    typeof verse.savedAt === 'number'
  );
};

export async function loadSavedVerses(): Promise<SavedVerseReference[]> {
  const storedValue = await AsyncStorage.getItem(SAVED_VERSES_STORAGE_KEY);
  if (!storedValue) return [];

  try {
    const parsedValue: unknown = JSON.parse(storedValue);
    if (!Array.isArray(parsedValue)) return [];
    return parsedValue.filter(isSavedVerseReference);
  } catch (error) {
    console.error('Failed to parse saved Bible verses:', error);
    return [];
  }
}

export async function storeSavedVerses(
  verses: SavedVerseReference[],
): Promise<void> {
  await AsyncStorage.setItem(SAVED_VERSES_STORAGE_KEY, JSON.stringify(verses));
}
