import AsyncStorage from '@react-native-async-storage/async-storage';

export const SAVED_VERSES_STORAGE_KEY = 'saved-bible-verses-v1';

export interface SavedVerseReference {
  bookId: string;
  chapter: number;
  verse: number;
  savedAt: number;
}

export const getSavedVerseKey = (
  verse: Pick<SavedVerseReference, 'bookId' | 'chapter' | 'verse'>,
) => `${verse.bookId}:${verse.chapter}:${verse.verse}`;

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
