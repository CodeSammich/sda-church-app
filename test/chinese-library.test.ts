import {
  CHINESE_LIBRARY_CATALOG_URL,
  getChineseLibraryCoverUrls,
  shouldLoadChineseLibraryCovers,
} from '@/features/library/ChineseLibrary';

describe('Chinese Union Mission library', () => {
  it('keeps the live cover catalog on the official HTTPS host', () => {
    expect(CHINESE_LIBRARY_CATALOG_URL).toBe(
      'https://api.sdabible.org/getResourceCategory/egw/cn',
    );
  });

  it('loads live covers only for Chinese app languages', () => {
    expect(shouldLoadChineseLibraryCovers('zh')).toBe(true);
    expect(shouldLoadChineseLibraryCovers('zh-cn')).toBe(true);
    expect(shouldLoadChineseLibraryCovers('en')).toBe(false);
    expect(shouldLoadChineseLibraryCovers('es')).toBe(false);
  });

  it('maps curated works to trusted current thumbnails and ignores unknown hosts', () => {
    expect(
      getChineseLibraryCoverUrls({
        childCategories: [
          { book_id: 127, thumbnail: 'egw-book/current/pp.jpg' },
          { book_id: 128, thumbnail: 'https://example.com/pk.jpg' },
          { book_id: 999, thumbnail: 'egw-book/current/unknown.jpg' },
        ],
      }),
    ).toEqual({
      'patriarchs-and-prophets':
        'https://cms.sdabible.site/storage/egw-book/current/pp.jpg',
    });
  });

  it('falls back cleanly when the provider response is malformed', () => {
    expect(getChineseLibraryCoverUrls(null)).toEqual({});
    expect(getChineseLibraryCoverUrls({ childCategories: null })).toEqual({});
    expect(
      getChineseLibraryCoverUrls({
        childCategories: [{ book_id: 127, thumbnail: 'https://%' }],
      }),
    ).toEqual({});
  });
});
