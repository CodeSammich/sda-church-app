import {
  EGW_COVER_BASE_URL,
  EGW_BOOK_CATEGORIES,
  EGW_BOOKS,
  getEgwCoverUrlsForLanguage,
  getEgwEditionsForLanguage,
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
        expect(edition.firstParagraph.startsWith(`${edition.bookId}.`)).toBe(
          true,
        );
        expect(edition.url).toBe(
          `https://text.egwwritings.org/read/${edition.firstParagraph}`,
        );
      }
    }
  });

  it('puts the reader’s language first while retaining every edition', () => {
    const work = EGW_BOOKS.find(
      (candidate) => candidate.id === 'acts-of-the-apostles',
    );

    expect(work).toBeDefined();
    expect(getEgwEditionsForLanguage(work!, 'zh-cn')[0].language).toBe('zh');
    expect(getEgwEditionsForLanguage(work!, 'es')[0].language).toBe('es');
    expect(getEgwEditionsForLanguage(work!, 'en')).toHaveLength(3);
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
        expect.objectContaining({ language: 'zh', firstParagraph: '14510.1' }),
        expect.objectContaining({ language: 'es', firstParagraph: '198.2' }),
      ]),
    );
  });
});
