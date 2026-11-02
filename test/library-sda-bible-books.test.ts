import { renderHook } from '@testing-library/react-native';

import { openURL } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { LIBRARY_CATALOG } from '@/features/library/LibraryCatalog';
import { useLibraryShelfBooks } from '@/features/library/useLibraryShelfBooks';

jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  openURL: jest.fn(),
}));

const shelfBooks = async (language: SupportedLanguage) => {
  const { result } = await renderHook(() => useLibraryShelfBooks(language, { loadEgwCovers: false }));
  return result.current;
};

// The books the church's leaders chose from the Chinese Union Mission's
// reader (#554) are Chinese, so only Chinese readers see them.
describe.each<[SupportedLanguage, string, string]>([
  ['zh', '?ui=tc', '地上的最後一夜'],
  ['zh-cn', '?ui=cn', '地上的最后一夜'],
])("today's Adventist writers with the app in %s", (language, script, secondTitle) => {
  it("lists twelve of them, with the reader's covers, opening in the app's script", async () => {
    const books = (await shelfBooks(language)).getShelfBooks('contemporary');
    expect(books).toHaveLength(12);
    expect(books.map(({ title }) => title).slice(0, 2)).toEqual(['最富有的穴居人', secondTitle]);

    for (const book of books) {
      const item = LIBRARY_CATALOG.sdaBibleBooks.find(({ id }) => id === book.key)!;
      expect(book.coverUrls).toEqual([item.coverUrl]);
      expect(book.byEllenWhite).toBe(false);
      jest.mocked(openURL).mockClear();
      book.onPress();
      expect(openURL).toHaveBeenCalledWith(`${item.sourceUrl}${script}`, expect.any(String), expect.any(String));
    }
  });

  it('puts The Kneeling Christian second among the Christian classics', async () => {
    const keys = (await shelfBooks(language)).getShelfBooks('classics').map(({ key }) => key);
    expect(keys.slice(0, 2)).toEqual(['sibbes-bruised-reed', 'kneeling-christian']);
  });

  it("puts Ellen White Under Fire on her shelf, after Sabbath Encouragement and her own books' leaders", async () => {
    const keys = (await shelfBooks(language)).getShelfBooks('egw').map(({ key }) => key);
    expect(keys).toContain('lake-ellen-white-under-fire');
    expect(keys.indexOf('lake-ellen-white-under-fire')).toBeGreaterThan(keys.indexOf('egw:education'));
  });
});

describe.each<SupportedLanguage>(['en', 'es'])('the library with the app in %s', (language) => {
  it("leaves today's Adventist writers' shelf empty, so the library page hides it", async () => {
    const library = await shelfBooks(language);
    expect(library.getShelfBooks('contemporary')).toEqual([]);
    expect(library.getShelfBooks('classics').map(({ key }) => key)).not.toContain('kneeling-christian');
    expect(library.getShelfBooks('egw').map(({ key }) => key)).not.toContain('lake-ellen-white-under-fire');
  });
});
