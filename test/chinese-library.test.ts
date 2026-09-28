import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CHINESE_LIBRARY_CATALOG_URL,
  CHINESE_LIBRARY_REFRESH_MS,
  getCachedChineseLibraryCoverUrls,
  getChineseLibraryCoverUrls,
  loadChineseLibraryCoverUrls,
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

describe('Chinese Union Mission library cache', () => {
  const catalogResponse = (thumbnail: string) =>
    ({
      ok: true,
      json: async () => ({ childCategories: [{ book_id: 127, thumbnail }] }),
    }) as Response;

  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it('uses the cached catalog for a day before refreshing', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(catalogResponse('egw-book/current/pp.jpg'));
    const onCoverUrls = jest.fn();
    const now = new Date(2026, 9, 1, 9).getTime();

    await loadChineseLibraryCoverUrls(onCoverUrls, undefined, now);
    await loadChineseLibraryCoverUrls(onCoverUrls, undefined, now + 60_000);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await loadChineseLibraryCoverUrls(
      onCoverUrls,
      undefined,
      now + CHINESE_LIBRARY_REFRESH_MS,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps showing the cached covers when a refresh fails', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce(catalogResponse('egw-book/current/pp.jpg'))
      .mockRejectedValueOnce(new Error('offline'));
    const now = new Date(2026, 9, 1, 9).getTime();
    await loadChineseLibraryCoverUrls(() => undefined, undefined, now);

    const onCoverUrls = jest.fn();
    await expect(
      loadChineseLibraryCoverUrls(
        onCoverUrls,
        undefined,
        now + CHINESE_LIBRARY_REFRESH_MS,
      ),
    ).rejects.toThrow('offline');
    expect(onCoverUrls).toHaveBeenCalledTimes(1);
    expect(onCoverUrls).toHaveBeenCalledWith({
      'patriarchs-and-prophets':
        'https://cms.sdabible.site/storage/egw-book/current/pp.jpg',
    });
  });

  it('drops cached cover URLs that point off the official host', async () => {
    await AsyncStorage.setItem(
      'chinese-library-covers-v1',
      JSON.stringify({
        coverUrls: {
          'patriarchs-and-prophets': 'https://example.com/pp.jpg',
          'prophets-and-kings': 'https://cms.sdabible.site/storage/pk.jpg',
        },
        fetchedAt: 1,
      }),
    );

    expect((await getCachedChineseLibraryCoverUrls())?.coverUrls).toEqual({
      'prophets-and-kings': 'https://cms.sdabible.site/storage/pk.jpg',
    });
  });
});
