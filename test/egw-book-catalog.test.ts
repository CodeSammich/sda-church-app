import {
  EGW_COVER_BASE_URL,
  EGW_BOOK_CATEGORIES,
  EGW_BOOKS,
  getEgwBookUrlForLanguage,
  getEgwCoverUrlsForLanguage,
  getEgwEditionForLanguage,
} from '@/features/library/EgwBookCatalog';

describe('EGW book catalog', () => {
  it('groups every curated work into a visible category', () => {
    expect(EGW_BOOKS.length).toBeGreaterThanOrEqual(9);

    for (const work of EGW_BOOKS) {
      expect(EGW_BOOK_CATEGORIES).toContain(work.category);
    }
  });

  it('provides one verified deep link for each initial language', () => {
    for (const work of EGW_BOOKS) {
      expect(work.editions.map((edition) => edition.language).sort()).toEqual([
        'en',
        'es',
        'zh',
      ]);

      for (const edition of work.editions) {
        if (edition.language === 'zh') {
          // The Chinese edition opens in the Chinese Union Mission's reader
          // (#554), at the Mission's book id.
          expect(edition.url).toBe(
            `https://read.sdabible.org/library/work/egw-${edition.bookId}`,
          );
          continue;
        }
        expect(edition.firstParagraph.startsWith(`${edition.bookId}.`)).toBe(
          true,
        );
        expect(edition.url).toBe(
          `https://text.egwwritings.org/read/${edition.firstParagraph}`,
        );
      }
    }
  });

  it('opens the Chinese edition in the app\'s script, and the others as they are', () => {
    const work = EGW_BOOKS.find((candidate) => candidate.id === 'desire-of-ages')!;

    expect(getEgwBookUrlForLanguage(work, 'zh')).toBe(
      'https://read.sdabible.org/library/work/egw-55?ui=tc',
    );
    expect(getEgwBookUrlForLanguage(work, 'zh-cn')).toBe(
      'https://read.sdabible.org/library/work/egw-55?ui=cn',
    );
    expect(getEgwBookUrlForLanguage(work, 'en')).toBe(
      'https://text.egwwritings.org/read/130.4',
    );
    expect(getEgwBookUrlForLanguage(work, 'es')).toBe(
      'https://text.egwwritings.org/read/174.2',
    );
  });

  it('opens the edition in the app language, with one Chinese edition for both scripts', () => {
    for (const work of EGW_BOOKS) {
      expect(getEgwEditionForLanguage(work, 'en').language).toBe('en');
      expect(getEgwEditionForLanguage(work, 'zh').language).toBe('zh');
      expect(getEgwEditionForLanguage(work, 'zh-cn').language).toBe('zh');
      expect(getEgwEditionForLanguage(work, 'es').language).toBe('es');
    }
  });

  it('selects language covers with English and bundled-art fallbacks', () => {
    const work = EGW_BOOKS[0];

    expect(getEgwCoverUrlsForLanguage(work, 'en')).toEqual([
      `${EGW_COVER_BASE_URL}84?type=small`,
    ]);
    expect(getEgwCoverUrlsForLanguage(work, 'es')).toEqual([
      `${EGW_COVER_BASE_URL}1704?type=small`,
      `${EGW_COVER_BASE_URL}84?type=small`,
    ]);
    expect(
      getEgwCoverUrlsForLanguage(
        work,
        'zh',
        'https://cms.sdabible.site/storage/egw-book/current/pp.jpg',
      ),
    ).toEqual([
      'https://cms.sdabible.site/storage/egw-book/current/pp.jpg',
      `${EGW_COVER_BASE_URL}84?type=small`,
    ]);
    expect(getEgwCoverUrlsForLanguage(work, 'zh-cn')).toEqual([
      `${EGW_COVER_BASE_URL}84?type=small`,
    ]);
  });

  it('uses the documented Acts of the Apostles edition IDs', () => {
    const work = EGW_BOOKS.find(
      (candidate) => candidate.id === 'acts-of-the-apostles',
    );

    expect(work?.editions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ language: 'en', firstParagraph: '127.5' }),
        expect.objectContaining({ language: 'zh', bookId: 81 }),
        expect.objectContaining({ language: 'es', firstParagraph: '198.2' }),
      ]),
    );
  });
});
