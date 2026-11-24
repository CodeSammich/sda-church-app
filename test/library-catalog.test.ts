import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  getLibraryItemDisplayText,
  getLibraryItemShelf,
  getLibraryItemSource,
  getLibraryItemsForLanguage,
  LIBRARY_CATALOG,
} from '@/features/library/LibraryCatalog';
import {
  isLibraryShelf,
  LIBRARY_SHELF_TITLES,
  LIBRARY_SHELVES,
} from '@/features/library/LibraryShelves';

describe('library catalog', () => {
  it('ties public-domain works to explicit Gutenberg or Internet Archive records', () => {
    expect(LIBRARY_CATALOG.publicDomainWorks.length).toBeGreaterThan(0);

    for (const work of LIBRARY_CATALOG.publicDomainWorks) {
      expect(work.rights).toBe('public-domain-us');
      expect(work.publicationYear).toBeLessThan(1928);
      if (work.sourceName === 'Internet Archive') {
        // A scan's own edition must be public domain, not just the original work.
        expect(work.editionYear).toBeLessThan(1928);
        expect(work.sourceUrl).toMatch(/^https:\/\/archive\.org\/details\/[A-Za-z0-9._-]+$/);
      } else {
        expect(work.sourceName).toBe('Project Gutenberg');
        expect(work.sourceUrl).toMatch(/^https:\/\/(www\.)?gutenberg\.org\/ebooks\/\d+$/);
      }
    }
  });

  it('uses EGW Writings reading links for books not on Project Gutenberg', () => {
    expect(
      LIBRARY_CATALOG.officialCollections.map(({ collection }) => collection).sort(),
    ).toEqual(['adventist-pioneers', 'children']);
    for (const work of LIBRARY_CATALOG.officialCollections) {
      expect(work.rights).toBe('official-external');
      expect(work.sourceName).toBe('EGW Writings');
      expect(work.sourceUrl).toMatch(/^https:\/\/text\.egwwritings\.org\/read\/\d+\.\d+$/);
    }
  });

  it('separates Adventist pioneers from broader Christian classics', () => {
    expect(
      LIBRARY_CATALOG.publicDomainWorks.filter(
        ({ collection }) => collection === 'adventist-pioneers',
      ),
    ).toHaveLength(3);
    expect(
      LIBRARY_CATALOG.publicDomainWorks.filter(
        ({ collection }) => collection === 'christian-classics',
      ),
    ).toHaveLength(5);
  });

  it('puts every book on a shelf the library screens can open', () => {
    const shelves = Object.values(LIBRARY_CATALOG)
      .flat()
      .map((work) => [work.id, getLibraryItemShelf(work)]);

    for (const [, shelf] of shelves) {
      expect(LIBRARY_SHELVES).toContain(shelf);
    }
    expect(Object.fromEntries(shelves)).toMatchObject({
      'bates-seventh-day-sabbath': 'pioneers',
      'andrews-history-sabbath': 'pioneers',
      'smith-state-dead-destiny-wicked': 'pioneers',
      'smith-daniel-revelation': 'pioneers',
      'murray-humility': 'classics',
      'murray-abide-in-christ': 'classics',
      'sibbes-bruised-reed': 'classics',
      'story-of-jesus': 'children',
      'sabbath-encouragement': 'egw',
      'kneeling-christian': 'classics',
      'batchelor-richest-caveman': 'contemporary',
      // About Ellen G. White, so it sits with her books (#554).
      'lake-ellen-white-under-fire': 'egw',
    });
  });

  it('shows the general Christian shelf first and names every shelf in every language', () => {
    // A visitor should meet the wider Christian shelf before Adventist writers.
    expect(LIBRARY_SHELVES[0]).toBe('classics');
    expect(LIBRARY_SHELVES.indexOf('egw')).toBeGreaterThan(LIBRARY_SHELVES.indexOf('children'));
    for (const shelf of LIBRARY_SHELVES) {
      expect(Object.keys(LIBRARY_SHELF_TITLES[shelf]).sort()).toEqual(['en', 'es', 'zh', 'zh-cn']);
      expect(isLibraryShelf(shelf)).toBe(true);
    }
    expect(isLibraryShelf('topics')).toBe(false);
  });

  it('ships a cover for every book, so none shows the blank placeholder', () => {
    for (const work of [
      ...LIBRARY_CATALOG.publicDomainWorks,
      ...LIBRARY_CATALOG.officialCollections,
      ...LIBRARY_CATALOG.churchDocuments,
    ]) {
      expect(existsSync(join(process.cwd(), 'assets/images/library', `${work.id}.png`))).toBe(true);
    }
  });

  it('serves each church document from the web app and ships its file', () => {
    expect(LIBRARY_CATALOG.churchDocuments.length).toBeGreaterThan(0);
    for (const work of LIBRARY_CATALOG.churchDocuments) {
      const url = new URL(work.sourceUrl);
      expect(work.rights).toBe('church-hosted');
      expect(url.origin).toBe('https://app.nyccsda.org');
      // Files in public/ deploy at the web app's root.
      expect(existsSync(join(process.cwd(), 'public', url.pathname))).toBe(true);
    }
  });

  it('prioritizes Chinese sources for Chinese readers without hiding English works', () => {
    const catalog = getLibraryItemsForLanguage('zh');

    expect(catalog.officialCollections).toHaveLength(
      LIBRARY_CATALOG.officialCollections.length,
    );
    expect(catalog.publicDomainWorks).toHaveLength(
      LIBRARY_CATALOG.publicDomainWorks.length,
    );
  });

  it('lists Sabbath Encouragement only for Chinese readers until it has an English translation', () => {
    const lists = (language: 'en' | 'es' | 'zh' | 'zh-cn') =>
      getLibraryItemsForLanguage(language).churchDocuments.map(({ id }) => id);
    expect(lists('zh')).toContain('sabbath-encouragement');
    expect(lists('zh-cn')).toContain('sabbath-encouragement');
    expect(lists('en')).not.toContain('sabbath-encouragement');
    expect(lists('es')).not.toContain('sabbath-encouragement');
  });

  it('opens the Spanish edition of a book for Spanish readers', () => {
    const books = Object.values(LIBRARY_CATALOG).flat();
    const withSpanish = books.filter((item) => item.spanish);
    const amazingFacts = 'https://www.amazingfacts.org/es';
    expect(Object.fromEntries(withSpanish.map((item) => [item.id, item.spanish?.sourceUrl]))).toEqual({
      'andrews-history-sabbath': 'https://text.egwwritings.org/read/14404.2',
      'bunyan-pilgrims-progress': 'https://www.chapellibrary.org/pdf/books/ppfes.pdf',
      'story-of-jesus': 'https://text.egwwritings.org/read/1747.3',
      'crews-last-night-on-earth': `${amazingFacts}/estudiar/biblioteca-de-libros-gratuitos/la-ultima-noche-en-la-tierra/`,
      'jesske-deathwatch-in-siberia': `${amazingFacts}/estudiar/biblioteca-de-libros-gratuitos/deathwatch-en-siberia/`,
      'crews-remember-lots-wife': `${amazingFacts}/estudiar/biblioteca-de-libros-gratuitos/recuerda-a-la-mujer-de-lot/`,
      'batchelor-bible-and-evolution': `${amazingFacts}/noticias-y-eventos/informe-interno/la-biblia-y-la-evolucion/`,
      'batchelor-pharisee-or-tax-collector': `${amazingFacts}/noticias-y-eventos/informe-interno/soy-un-fariseo-o-un-publicano/`,
      'crews-baptized-paganism': `${amazingFacts}/estudiar/biblioteca-de-libros-gratuitos/paganismo-bautizado/`,
    });

    const pilgrim = books.find((item) => item.id === 'bunyan-pilgrims-progress')!;
    expect(getLibraryItemDisplayText(pilgrim, 'es').title).toBe(
      'El progreso del peregrino para todos (condensado)',
    );
    expect(getLibraryItemSource(pilgrim, 'es')).toEqual({
      rights: 'permission-to-copy',
      sourceName: 'Chapel Library',
      sourceUrl: 'https://www.chapellibrary.org/pdf/books/ppfes.pdf',
    });
    // English readers keep the English edition.
    expect(getLibraryItemSource(pilgrim, 'en').sourceUrl).toBe('https://www.gutenberg.org/ebooks/131');
    expect(getLibraryItemDisplayText(pilgrim, 'en').title).toBe("The Pilgrim's Progress");

    for (const item of withSpanish) {
      const spanish = item.spanish!;
      // Official editions open on EGW Writings or Amazing Facts; the rest in
      // the publisher's own copy.
      if (spanish.rights === 'official-external') {
        expect(spanish.sourceUrl).toMatch(
          /^https:\/\/(text\.egwwritings\.org\/read\/\d+\.\d+|www\.amazingfacts\.org\/es\/[a-z0-9/-]+\/)$/,
        );
      } else {
        expect(spanish.rights).toBe('permission-to-copy');
      }
      expect(existsSync(join(process.cwd(), 'assets/images/library', `${item.id}-es.png`))).toBe(true);
    }
  });

  it('opens the Chinese edition of a book for Chinese readers, in either script', () => {
    const books = Object.values(LIBRARY_CATALOG).flat();
    // Editions in the Chinese Union Mission's reader are checked with its
    // other books, below.
    const withChinese = books.filter(
      (item) => item.chineseEdition && item.chineseEdition.sourceName !== 'SDA Bible',
    );
    expect(Object.fromEntries(withChinese.map((item) => [item.id, item.chineseEdition?.sourceUrl]))).toEqual({
      'bunyan-pilgrims-progress': 'https://babel.hathitrust.org/cgi/pt?id=uc1.b3399258',
    });

    const pilgrim = books.find((item) => item.id === 'bunyan-pilgrims-progress')!;
    for (const [language, title] of [['zh', '天路歷程'], ['zh-cn', '天路历程']] as const) {
      expect(getLibraryItemDisplayText(pilgrim, language).title).toBe(title);
      expect(getLibraryItemSource(pilgrim, language)).toEqual({
        rights: 'public-domain-us',
        sourceName: 'HathiTrust',
        sourceUrl: 'https://babel.hathitrust.org/cgi/pt?id=uc1.b3399258',
      });
    }

    for (const item of withChinese) {
      // Titled in both scripts, with its own cover, and listed first for Chinese readers.
      expect(item.traditionalChinese?.title).toMatch(/[\u3400-\u9fff]/);
      expect(item.simplifiedChinese?.title).toMatch(/[\u3400-\u9fff]/);
      expect(existsSync(join(process.cwd(), 'assets/images/library', `${item.id}-zh.png`))).toBe(true);
      for (const language of ['zh', 'zh-cn'] as const) {
        const works = getLibraryItemsForLanguage(language).publicDomainWorks.map(({ id }) => id);
        expect(works.indexOf(item.id)).toBeLessThan(withChinese.length);
      }
    }
  });

  describe("books in the Chinese Union Mission's reader (#554)", () => {
    const books = LIBRARY_CATALOG.sdaBibleBooks;

    // A book written in English and free there has the reader's copy as its
    // Chinese edition; the others are the reader's copy.
    const readerEdition = (book: (typeof books)[number]) => ({
      ...(book.chineseEdition ?? book),
      coverUrl: book.chineseEdition ? book.chineseEdition.coverUrl : book.coverUrl,
    });

    it('links the fourteen books the church chose, with the reader\'s own covers', () => {
      expect(books).toHaveLength(14);
      expect(new Set(books.map((book) => readerEdition(book).sourceUrl)).size).toBe(books.length);
      for (const book of books) {
        const edition = readerEdition(book);
        expect(edition.rights).toBe('official-external');
        expect(edition.sourceName).toBe('SDA Bible');
        expect(edition.sourceUrl).toMatch(/^https:\/\/read\.sdabible\.org\/library\/work\/m-\d+$/);
        expect(edition.coverUrl).toMatch(/^https:\/\/read\.sdabible\.org\/api\/library\/assets\/\d+\/thumb$/);
        expect(book.traditionalChinese?.title).toMatch(/[\u3400-\u9fff]/);
        expect(book.simplifiedChinese?.title).toMatch(/[\u3400-\u9fff]/);
        expect(book.traditionalChinese?.author).toMatch(/[\u3400-\u9fff]/);
        expect(book.simplifiedChinese?.author).toMatch(/[\u3400-\u9fff]/);
      }
    });

    it("shows all of them to Chinese readers, and the seven free in English to everyone, on today's Adventist writers' shelf but two", () => {
      const ids = (language: 'en' | 'es' | 'zh' | 'zh-cn') =>
        getLibraryItemsForLanguage(language).sdaBibleBooks.map(({ id }) => id);
      const freeInEnglish = [
        'kneeling-christian',
        'crews-last-night-on-earth',
        'jesske-deathwatch-in-siberia',
        'crews-remember-lots-wife',
        'batchelor-bible-and-evolution',
        'batchelor-pharisee-or-tax-collector',
        'crews-baptized-paganism',
      ];
      expect(ids('zh')).toHaveLength(14);
      expect(ids('zh-cn')).toHaveLength(14);
      expect(ids('en')).toEqual(freeInEnglish);
      // Spanish editions first, then The Kneeling Christian, which has none.
      expect(ids('es')).toEqual([...freeInEnglish.slice(1), 'kneeling-christian']);
      // The rest are sold in English, so they stay Chinese only (#703).
      expect(books.filter((book) => book.onlyForChineseReaders).map(({ id }) => id)).toEqual(
        books.map(({ id }) => id).filter((id) => !freeInEnglish.includes(id)),
      );
      expect(books.filter((book) => getLibraryItemShelf(book) !== 'contemporary').map(({ id }) => id)).toEqual([
        'kneeling-christian',
        'lake-ellen-white-under-fire',
      ]);
    });

    it("opens each book in the reader in the app's script", () => {
      const [kneeling] = books;
      expect(getLibraryItemSource(kneeling, 'zh').sourceUrl).toBe(
        'https://read.sdabible.org/library/work/m-162?ui=tc',
      );
      expect(getLibraryItemSource(kneeling, 'zh-cn').sourceUrl).toBe(
        'https://read.sdabible.org/library/work/m-162?ui=cn',
      );
      expect(getLibraryItemDisplayText(kneeling, 'zh').title).toBe('跪下的基督徒');
      const lastNight = books.find(({ id }) => id === 'crews-last-night-on-earth')!;
      expect(getLibraryItemDisplayText(lastNight, 'zh').title).toBe('地上的最後一夜');
      expect(getLibraryItemDisplayText(lastNight, 'zh-cn').title).toBe('地上的最后一夜');
    });

    it('opens the free originals for English and Spanish readers, with covers of their own', () => {
      const [kneeling] = books;
      // Public domain in the U.S., on CCEL, with no Spanish edition.
      for (const language of ['en', 'es'] as const) {
        expect(getLibraryItemSource(kneeling, language)).toEqual({
          rights: 'public-domain-us',
          sourceName: 'Christian Classics Ethereal Library',
          sourceUrl: 'https://www.ccel.org/ccel/unknown/kneeling.html',
        });
        expect(getLibraryItemDisplayText(kneeling, language).title).toBe('The Kneeling Christian');
      }
      const lotsWife = books.find(({ id }) => id === 'crews-remember-lots-wife')!;
      expect(getLibraryItemSource(lotsWife, 'en').sourceUrl).toBe(
        'https://www.amazingfacts.org/study/free-books/remember-lots-wife/',
      );
      expect(getLibraryItemDisplayText(lotsWife, 'es')).toMatchObject({
        title: 'Recuerda a la mujer de Lot',
        author: 'Joe Crews',
      });
      // Its Chinese edition credits Doug Batchelor; the chapters are Joe Crews's.
      expect(getLibraryItemDisplayText(lotsWife, 'zh').author).toBe('喬·克魯斯');

      for (const book of books.filter(({ onlyForChineseReaders }) => !onlyForChineseReaders)) {
        expect(book.language).toBe('en');
        expect(book.sourceUrl).toMatch(/^https:\/\/www\.(amazingfacts|ccel)\.org\//);
        expect(existsSync(join(process.cwd(), 'assets/images/library', `${book.id}.png`))).toBe(true);
        if (book.spanish) {
          expect(book.spanish.sourceUrl).toMatch(/^https:\/\/www\.amazingfacts\.org\/es\//);
        }
      }
    });
  });

  it('lists books with a Spanish edition first for Spanish readers', () => {
    const [first] = getLibraryItemsForLanguage('es').officialCollections;
    expect(first.id).toBe('story-of-jesus');
    const works = getLibraryItemsForLanguage('es').publicDomainWorks.map(({ id }) => id);
    expect(works.slice(0, 2).sort()).toEqual(['andrews-history-sabbath', 'bunyan-pilgrims-progress']);
  });

  it('shows each title in one language: Chinese, Spanish, or English', () => {
    const [sabbathEncouragement] = LIBRARY_CATALOG.churchDocuments;
    const title = (language: 'en' | 'es' | 'zh' | 'zh-cn') =>
      getLibraryItemDisplayText(sabbathEncouragement, language).title;
    expect(title('en')).toBe('Sabbath Encouragement');
    // No Spanish edition, so Spanish shows the English text.
    expect(title('es')).toBe('Sabbath Encouragement');
    expect(title('zh')).toBe('安息日勉言');
    expect(title('zh-cn')).toBe('安息日勉言');
    // A compilation of Bible verses and Ellen G. White quotations.
    expect(sabbathEncouragement.author).toBe('Various');

    // The English text, which every non-Chinese language shows, has no Chinese in it.
    const chinese = /[\u3400-\u9fff]/;
    for (const item of Object.values(LIBRARY_CATALOG).flat()) {
      expect(`${item.id}: ${item.title} ${item.author}`).not.toMatch(chinese);
      if (item.spanish) {
        expect(`${item.id}: ${item.spanish.title} ${item.spanish.author}`).not.toMatch(chinese);
      }
    }
  });
});
