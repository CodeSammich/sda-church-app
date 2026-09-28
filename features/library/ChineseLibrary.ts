import type { SupportedLanguage } from '@/constants/LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

// api.sdabible.org is a single small server with no CDN, and the catalog
// (about 40 KB) rarely changes, so each device refreshes it at most daily.
const CHINESE_LIBRARY_CACHE_KEY = 'chinese-library-covers-v1';
export const CHINESE_LIBRARY_REFRESH_MS = 24 * 60 * 60 * 1000;

type CachedCoverUrls = {
  coverUrls: ChineseLibraryCoverUrls;
  fetchedAt: number;
};

export const fetchChineseLibraryCoverUrls = async (
  signal?: AbortSignal,
  now = Date.now(),
): Promise<ChineseLibraryCoverUrls> => {
  const response = await fetch(CHINESE_LIBRARY_CATALOG_URL, {
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) {
    throw new Error(`Chinese library catalog returned HTTP ${response.status}`);
  }

  const coverUrls = getChineseLibraryCoverUrls(await response.json());
  await AsyncStorage.setItem(
    CHINESE_LIBRARY_CACHE_KEY,
    JSON.stringify({ coverUrls, fetchedAt: now } satisfies CachedCoverUrls),
  ).catch(() => undefined);
  return coverUrls;
};

export const getCachedChineseLibraryCoverUrls = async (): Promise<
  CachedCoverUrls | undefined
> => {
  try {
    const stored = await AsyncStorage.getItem(CHINESE_LIBRARY_CACHE_KEY);
    if (!stored) return undefined;

    const cached = JSON.parse(stored) as Partial<CachedCoverUrls>;
    if (!cached?.coverUrls || !Number.isFinite(cached.fetchedAt)) return undefined;

    // Re-check stored URLs so a tampered cache can't point covers elsewhere.
    const coverUrls = Object.fromEntries(
      Object.entries(cached.coverUrls).flatMap(([workId, url]) => {
        const trustedUrl =
          workId in CHINESE_LIBRARY_EGW_BOOK_IDS ? getTrustedCoverUrl(url) : null;
        return trustedUrl ? [[workId, trustedUrl]] : [];
      }),
    );
    return { coverUrls, fetchedAt: cached.fetchedAt as number };
  } catch {
    return undefined;
  }
};

/**
 * Shows the cached covers first, then refreshes them from the provider when
 * the cache is missing or older than a day. A failed refresh throws, but the
 * cached covers already shown stay in place.
 */
export const loadChineseLibraryCoverUrls = async (
  onCoverUrls: (coverUrls: ChineseLibraryCoverUrls) => void,
  signal?: AbortSignal,
  now = Date.now(),
) => {
  const cached = await getCachedChineseLibraryCoverUrls();
  if (signal?.aborted) return;
  if (cached) onCoverUrls(cached.coverUrls);
  if (
    cached &&
    cached.fetchedAt <= now &&
    now - cached.fetchedAt < CHINESE_LIBRARY_REFRESH_MS
  ) {
    return;
  }

  const coverUrls = await fetchChineseLibraryCoverUrls(signal, now);
  if (!signal?.aborted) onCoverUrls(coverUrls);
};
