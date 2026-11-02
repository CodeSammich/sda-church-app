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
  ['zh', '?ui=tc', '跪下的基督徒'],
  ['zh-cn', '?ui=cn', '跪下的基督徒'],
])("the Chinese shelf with the app in %s", (language, script, firstTitle) => {
  it("lists thirteen of them, with the reader's covers, opening in the app's script", async () => {
    const books = (await shelfBooks(language)).getShelfBooks('chinese');
    expect(books).toHaveLength(13);
    expect(books[0].title).toBe(firstTitle);

    for (const book of books) {
      const item = LIBRARY_CATALOG.sdaBibleBooks.find(({ id }) => id === book.key)!;
      expect(book.coverUrls).toEqual([item.coverUrl]);
      expect(book.byEllenWhite).toBe(false);
      jest.mocked(openURL).mockClear();
      book.onPress();
      expect(openURL).toHaveBeenCalledWith(`${item.sourceUrl}${script}`, expect.any(String), expect.any(String));
    }
  });

  it("puts Ellen White Under Fire on her shelf, after Sabbath Encouragement and her own books' leaders", async () => {
    const keys = (await shelfBooks(language)).getShelfBooks('egw').map(({ key }) => key);
    expect(keys).toContain('lake-ellen-white-under-fire');
    expect(keys.indexOf('lake-ellen-white-under-fire')).toBeGreaterThan(keys.indexOf('egw:education'));
  });
});

describe.each<SupportedLanguage>(['en', 'es'])('the library with the app in %s', (language) => {
  it('leaves the Chinese shelf empty, so the library page hides it', async () => {
    const library = await shelfBooks(language);
    expect(library.getShelfBooks('chinese')).toEqual([]);
    expect(library.getShelfBooks('egw').map(({ key }) => key)).not.toContain('lake-ellen-white-under-fire');
  });
});
