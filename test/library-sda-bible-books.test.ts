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
// reader (#554). Chinese readers open all of them there; English and Spanish
// readers see the ones free in their language, and open those instead (#703).
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
      const reader = item.chineseEdition ?? item;
      expect(book.coverUrls).toEqual([reader.coverUrl]);
      expect(book.byEllenWhite).toBe(false);
      jest.mocked(openURL).mockClear();
      book.onPress();
      expect(openURL).toHaveBeenCalledWith(`${reader.sourceUrl}${script}`, expect.any(String), expect.any(String));
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

describe.each<[SupportedLanguage, string, RegExp]>([
  ['en', 'The Last Night on Earth', /^https:\/\/www\.amazingfacts\.org\/(?!es\/)/],
  ['es', 'La última noche en la Tierra', /^https:\/\/www\.amazingfacts\.org\/es\//],
])("today's Adventist writers with the app in %s", (language, firstTitle, amazingFacts) => {
  it('lists the six free on Amazing Facts, with covers of their own, opening there', async () => {
    const books = (await shelfBooks(language)).getShelfBooks('contemporary');
    expect(books.map(({ key }) => key)).toEqual([
      'crews-last-night-on-earth',
      'jesske-deathwatch-in-siberia',
      'crews-remember-lots-wife',
      'batchelor-bible-and-evolution',
      'batchelor-pharisee-or-tax-collector',
      'crews-baptized-paganism',
    ]);
    expect(books[0].title).toBe(firstTitle);
    for (const book of books) {
      expect(book.title).not.toMatch(/[\u3400-\u9fff]/);
      expect(book.coverSource).toBeDefined();
      expect(book.coverUrls).toBeUndefined();
      jest.mocked(openURL).mockClear();
      book.onPress();
      expect(jest.mocked(openURL).mock.calls[0][0]).toMatch(amazingFacts);
    }
  });

  it('puts The Kneeling Christian second among the Christian classics, opening on CCEL', async () => {
    const books = (await shelfBooks(language)).getShelfBooks('classics');
    expect(books.slice(0, 2).map(({ key }) => key)).toEqual(['sibbes-bruised-reed', 'kneeling-christian']);
    jest.mocked(openURL).mockClear();
    books[1].onPress();
    expect(openURL).toHaveBeenCalledWith(
      'https://www.ccel.org/ccel/unknown/kneeling.html',
      expect.any(String),
      expect.any(String),
    );
  });

  it('leaves out the books sold in English', async () => {
    const library = await shelfBooks(language);
    const keys = ['classics', 'contemporary', 'egw'].flatMap((shelf) =>
      library.getShelfBooks(shelf as 'classics').map(({ key }) => key),
    );
    expect(keys).not.toContain('batchelor-richest-caveman');
    expect(keys).not.toContain('lake-ellen-white-under-fire');
  });
});
