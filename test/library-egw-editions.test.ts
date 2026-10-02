import { renderHook } from '@testing-library/react-native';

import { openURL } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { EGW_BOOKS, type EgwEditionLanguage } from '@/features/library/EgwBookCatalog';
import { useLibraryShelfBooks } from '@/features/library/useLibraryShelfBooks';

jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  openURL: jest.fn(),
}));

// Ellen G. White's books open like every other Library book: straight to the
// app language's edition, with no dialog to choose one.
describe.each<[SupportedLanguage, EgwEditionLanguage]>([
  ['en', 'en'],
  ['zh', 'zh'],
  ['zh-cn', 'zh'],
  ['es', 'es'],
])('Ellen G. White books with the app in %s', (language, editionLanguage) => {
  it(`open the ${editionLanguage} edition directly`, () => {
    const { result } = renderHook(() => useLibraryShelfBooks(language, { loadEgwCovers: false }));
    const books = result.current.getShelfBooks('egw').filter(({ key }) => key.startsWith('egw:'));
    expect(books).toHaveLength(EGW_BOOKS.length);

    for (const book of books) {
      const work = EGW_BOOKS.find(({ id }) => book.key === `egw:${id}`)!;
      const edition = work.editions.find((candidate) => candidate.language === editionLanguage)!;
      jest.mocked(openURL).mockClear();
      book.onPress();
      expect(openURL).toHaveBeenCalledTimes(1);
      expect(openURL).toHaveBeenCalledWith(edition.url, work.workTitle[language], expect.any(String));
    }
  });
});
