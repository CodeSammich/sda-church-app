import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The library's shelves, in the order the library page shows them. General
 * Christian books come first, then books for children and young people, then
 * Adventist writers, so a visitor meets the wider Christian shelf before the
 * denomination's own.
 */
export const LIBRARY_SHELVES = ['classics', 'children', 'youth', 'egw', 'pioneers'] as const;
export type LibraryShelf = (typeof LIBRARY_SHELVES)[number];

export const LIBRARY_SHELF_TITLES: Readonly<
  Record<LibraryShelf, Readonly<Record<SupportedLanguage, string>>>
> = {
  classics: { en: 'Christian Classics', zh: '基督教經典', 'zh-cn': '基督教经典', es: 'Clásicos cristianos' },
  children: { en: 'Children', zh: '兒童', 'zh-cn': '儿童', es: 'Niños' },
  youth: { en: 'Youth / Young Adults', zh: '青年／青年成人', 'zh-cn': '青年／青年成人', es: 'Jóvenes / Adultos jóvenes' },
  egw: { en: 'Ellen G. White', zh: '懷愛倫', 'zh-cn': '怀爱伦', es: 'Elena G. de White' },
  pioneers: { en: 'Adventist Pioneers', zh: '復臨先驅', 'zh-cn': '复临先驱', es: 'Pioneros adventistas' },
};

export const isLibraryShelf = (value: unknown): value is LibraryShelf =>
  LIBRARY_SHELVES.includes(value as LibraryShelf);

/** Ellen G. White's books that also sit on another shelf. */
export const EGW_BOOK_IDS_BY_SHELF: Readonly<Partial<Record<LibraryShelf, readonly string[]>>> = {
  children: ['child-guidance', 'messages-to-young-people', 'christs-object-lessons'],
  youth: ['education', 'messages-to-young-people'],
};

/**
 * Books featured at the top of the library page, in order. The first is a
 * general Christian classic.
 * Keys are `LibraryShelfBook` keys: a catalog id, or `egw:` and a book id.
 */
export const FEATURED_LIBRARY_BOOKS = [
  'sibbes-bruised-reed',
  'egw:steps-to-christ',
  'murray-abide-in-christ',
  'egw:desire-of-ages',
  'sabbath-encouragement',
] as const;

/**
 * Books that lead a shelf, in this order; the rest follow in catalog order.
 * Keys are `LibraryShelfBook` keys.
 */
export const LIBRARY_SHELF_LEADERS: Readonly<Partial<Record<LibraryShelf, readonly string[]>>> = {
  classics: ['sibbes-bruised-reed'],
  // Sabbath Encouragement always comes first, then her most-read books.
  egw: [
    'sabbath-encouragement',
    'egw:desire-of-ages',
    'egw:steps-to-christ',
    'egw:great-controversy',
    'egw:patriarchs-and-prophets',
    'egw:ministry-of-healing',
    'egw:education',
  ],
};

/** Puts a shelf's leading books first and keeps the others in their order. */
export const orderShelfBooks = <T extends { key: string }>(
  shelf: LibraryShelf,
  books: readonly T[],
): T[] => {
  const leaders = LIBRARY_SHELF_LEADERS[shelf] ?? [];
  const rank = (key: string) => {
    const index = leaders.indexOf(key);
    return index < 0 ? leaders.length : index;
  };
  return books
    .map((book, index) => ({ book, index, rank: rank(book.key) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ book }) => book);
};
