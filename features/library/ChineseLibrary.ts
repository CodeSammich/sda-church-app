import type { SupportedLanguage } from '@/constants/LanguageContext';

export const CHINESE_LIBRARY_CATALOG_URL =
  'https://api.sdabible.org/getResourceCategory/egw/cn';

const CHINESE_LIBRARY_STORAGE_URL = 'https://cms.sdabible.site/storage/';

const CHINESE_LIBRARY_EGW_BOOK_IDS: Readonly<Record<string, number>> = {
  'patriarchs-and-prophets': 127,
  'prophets-and-kings': 128,
  'desire-of-ages': 55,
  'acts-of-the-apostles': 81,
  'great-controversy': 75,
  'steps-to-christ': 120,
  'christs-object-lessons': 34,
  'ministry-of-healing': 16,
  education: 50,
  'child-guidance': 13,
  'messages-to-young-people': 23,
};

type ChineseLibraryBook = Readonly<{
  book_id?: unknown;
  thumbnail?: unknown;
}>;

export type ChineseLibraryCoverUrls = Readonly<Record<string, string>>;

export const shouldLoadChineseLibraryCovers = (language: SupportedLanguage) =>
  language === 'zh' || language === 'zh-cn';

const getTrustedCoverUrl = (thumbnail: unknown) => {
  if (typeof thumbnail !== 'string' || !thumbnail.trim()) return null;

  try {
    const url = new URL(thumbnail, CHINESE_LIBRARY_STORAGE_URL);
    const storageUrl = new URL(CHINESE_LIBRARY_STORAGE_URL);
    if (
      url.protocol !== 'https:' ||
      url.origin !== storageUrl.origin ||
      !url.pathname.startsWith(storageUrl.pathname)
    ) {
      return null;
    }

    return url.href;
  } catch {
    return null;
  }
};

export const getChineseLibraryCoverUrls = (
  response: unknown,
): ChineseLibraryCoverUrls => {
  if (!response || typeof response !== 'object') return {};
  const childCategories = (response as { childCategories?: unknown }).childCategories;
  if (!Array.isArray(childCategories)) return {};

  const booksById = new Map<number, ChineseLibraryBook>();
  for (const entry of childCategories) {
    if (!entry || typeof entry !== 'object') continue;
    const book = entry as ChineseLibraryBook;
    if (typeof book.book_id === 'number') booksById.set(book.book_id, book);
  }

  return Object.fromEntries(
    Object.entries(CHINESE_LIBRARY_EGW_BOOK_IDS).flatMap(([workId, bookId]) => {
      const coverUrl = getTrustedCoverUrl(booksById.get(bookId)?.thumbnail);
      return coverUrl ? [[workId, coverUrl]] : [];
    }),
  );
};

export const fetchChineseLibraryCoverUrls = async (
  signal?: AbortSignal,
): Promise<ChineseLibraryCoverUrls> => {
  const response = await fetch(CHINESE_LIBRARY_CATALOG_URL, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Chinese library catalog returned HTTP ${response.status}`);
  }

  return getChineseLibraryCoverUrls(await response.json());
};
