import { renderHook } from '@testing-library/react-native';

import type { SupportedLanguage } from '@/constants/LanguageContext';
import { FEATURED_LIBRARY_BOOKS, LIBRARY_SHELVES } from '@/features/library/LibraryShelves';
import { useLibraryShelfBooks } from '@/features/library/useLibraryShelfBooks';

// Every app language gets the same balance (#391): the featured books and the
// shelves meant for everyone don't lead with, or fill up on, Ellen G. White.
describe.each<SupportedLanguage>(['en', 'zh', 'zh-cn', 'es'])('the library in %s', (language) => {
  const { result } = renderHook(() => useLibraryShelfBooks(language, { loadEgwCovers: false }));
  const { getBooks, getShelfBooks } = result.current;

  it('features one Ellen G. White book at most, after a book by someone else', () => {
    const featured = getBooks(FEATURED_LIBRARY_BOOKS);
    expect(featured.filter(({ byEllenWhite }) => byEllenWhite).length).toBeLessThanOrEqual(1);
    expect(featured[0].byEllenWhite).toBe(false);
  });

  it.each(LIBRARY_SHELVES.filter((shelf) => shelf !== 'egw'))(
    'lists other writers before Ellen G. White on %s',
    (shelf) => {
      const books = getShelfBooks(shelf);
      const others = books.filter(({ byEllenWhite }) => !byEllenWhite);
      expect(books.slice(0, others.length)).toEqual(others);
    },
  );

  it.each(['children', 'youth'] as const)(
    'gives %s more books by other writers than by Ellen G. White',
    (shelf) => {
      const books = getShelfBooks(shelf);
      const others = books.filter(({ byEllenWhite }) => !byEllenWhite);
      expect(others.length).toBeGreaterThan(books.length - others.length);
    },
  );
});
