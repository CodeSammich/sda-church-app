import {
  BIBLE_SECTIONS,
  BIBLE_TESTAMENT_NAMES,
  getBibleSectionOfBook,
  getBookListRows,
  isBookListHeading,
} from '@/constants/BibleSections';
import { BIBLE_AUDIO_BOOKS } from '@/services/BibleAudioSources';
import { BIBLE_BOOK_NAMES } from '@/services/BibleService';
import { readFileSync } from 'node:fs';

// The Bible's sections, as Offline Bible Audio groups its books (#556).
const LANGUAGES = ['en', 'zh', 'zh-cn', 'es'] as const;

describe('Bible sections', () => {
  it('hold every one of the 66 books once, in canonical order', () => {
    const books = BIBLE_SECTIONS.flatMap((section) => section.books);
    expect(books).toHaveLength(66);
    expect(new Set(books).size).toBe(66);
    expect(books).toEqual(BIBLE_AUDIO_BOOKS.map(([bookId]) => bookId));
    expect(books).toEqual(Object.keys(BIBLE_BOOK_NAMES));
  });

  it('split the Testaments at Matthew, and keep each section in one', () => {
    const old = BIBLE_SECTIONS.filter(({ testament }) => testament === 'old').flatMap(({ books }) => books);
    expect(old).toHaveLength(39);
    expect(old.at(-1)).toBe('MAL');
    expect(BIBLE_SECTIONS.filter(({ testament }) => testament === 'new').flatMap(({ books }) => books)[0]).toBe('MAT');
    // Sections run in order, Old Testament first.
    expect(BIBLE_SECTIONS.map(({ testament }) => testament).join(' ')).toMatch(/^(old )+(new ?)+$/);
  });

  it('use the usual grouping', () => {
    expect(BIBLE_SECTIONS.map(({ id, books }) => [id, books.length, books[0]])).toEqual([
      ['law', 5, 'GEN'],
      ['history', 12, 'JOS'],
      ['poetry', 5, 'JOB'],
      ['major-prophets', 5, 'ISA'],
      ['minor-prophets', 12, 'HOS'],
      ['gospels', 4, 'MAT'],
      ['acts', 1, 'ACT'],
      ['pauls-letters', 13, 'ROM'],
      ['general-letters', 8, 'HEB'],
      ['revelation', 1, 'REV'],
    ]);
    expect(getBibleSectionOfBook('JHN')?.id).toBe('gospels');
    expect(getBibleSectionOfBook('LAM')?.id).toBe('major-prophets');
    expect(getBibleSectionOfBook('PHM')?.id).toBe('pauls-letters');
    expect(getBibleSectionOfBook('XYZ')).toBeUndefined();
  });

  it('name each section and Testament in every language, and a one-book section as its book', () => {
    for (const section of BIBLE_SECTIONS) {
      for (const language of LANGUAGES) expect(section.name[language]).toBeTruthy();
      if (section.books.length === 1) expect(section.name).toEqual(BIBLE_BOOK_NAMES[section.books[0]]);
    }
    for (const testament of Object.values(BIBLE_TESTAMENT_NAMES)) {
      for (const language of LANGUAGES) expect(testament.name[language]).toBeTruthy();
    }
    expect(BIBLE_SECTIONS.map(({ name }) => name.zh)).toEqual([
      '摩西五經',
      '歷史書',
      '詩歌智慧書',
      '大先知書',
      '小先知書',
      '福音書',
      '使徒行傳',
      '保羅書信',
      '普通書信',
      '啟示錄',
    ]);
  });

  // The Bible's book list, under the same headings (#807): reaching John took
  // five drags through 66 names with none.
  describe('in the book list', () => {
    const books = Object.keys(BIBLE_BOOK_NAMES).map((id) => ({ id }));
    const shown = (rows: ReturnType<typeof getBookListRows<{ id: string }>>) =>
      rows.map((row) => (isBookListHeading(row) ? `${row.heading}: ${row.name}` : row.id));

    it('put each Testament’s heading, then each section’s, above its books', () => {
      const rows = shown(getBookListRows(books, 'en'));
      expect(rows.slice(0, 8)).toEqual(['testament: Old Testament', 'section: Law', 'GEN', 'EXO', 'LEV', 'NUM', 'DEU', 'section: History']);
      expect(rows.slice(rows.indexOf('MAL'), rows.indexOf('ROM') + 1)).toEqual([
        'MAL',
        'testament: New Testament',
        'section: Gospels',
        'MAT',
        'MRK',
        'LUK',
        'JHN',
        // A section of one book is just the book, as in the downloads: a
        // heading would repeat its name.
        'ACT',
        'section: Paul’s Letters',
        'ROM',
      ]);
      expect(rows.slice(-2)).toEqual(['JUD', 'REV']);
      // Every book once, in order, under 2 Testament and 8 section headings.
      expect(rows.filter((row) => !row.includes(': '))).toEqual(books.map(({ id }) => id));
      expect(rows.filter((row) => row.startsWith('testament: '))).toHaveLength(2);
      expect(rows.filter((row) => row.startsWith('section: '))).toHaveLength(8);
    });

    it('name them in the app’s language', () => {
      const headings = (language: 'zh' | 'zh-cn' | 'es') =>
        shown(getBookListRows(books, language)).filter((row) => row.includes(': ')).slice(0, 3);
      expect(headings('zh')).toEqual(['testament: 舊約', 'section: 摩西五經', 'section: 歷史書']);
      expect(headings('zh-cn')).toEqual(['testament: 旧约', 'section: 摩西五经', 'section: 历史书']);
      expect(headings('es')).toEqual(['testament: Antiguo Testamento', 'section: Pentateuco', 'section: Libros históricos']);
    });

    it('give each heading a key no book has, and head only the books a translation has', () => {
      const rows = getBookListRows(books, 'en');
      const ids = rows.map((row) => row.id);
      expect(new Set(ids).size).toBe(ids.length);
      // A New Testament alone starts with its own heading; a book in no
      // section follows the one before it.
      expect(shown(getBookListRows([{ id: 'MAT' }, { id: 'XYZ' }, { id: 'MRK' }], 'en'))).toEqual([
        'testament: New Testament',
        'section: Gospels',
        'MAT',
        'XYZ',
        'MRK',
      ]);
    });

    it('are rows of the book list, small and with no tap target', () => {
      const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
      expect(bible).toContain('getBookListRows(books, language)');
      // In the same popup list as the books, so its ⌄ and fades (#521, #794)
      // cover them too, not a SectionList of its own.
      expect(bible).not.toMatch(/<SectionList\b/);
      const heading = bible.slice(bible.indexOf('isBookListHeading(item)'), bible.indexOf('// A book, chapter, or verse'));
      expect(heading).toContain('accessibilityRole="header"');
      expect(heading).not.toMatch(/onPress|Touchable|Pressable/);
      // Smaller than the books' 16-point names; the Testament's a point larger.
      const fontSize = (style: string) =>
        Number(bible.match(new RegExp(`${style}: \\{[^}]*fontSize: scaleTypographyMetric\\((\\d+)`))?.[1]);
      expect([fontSize('bookListTestament'), fontSize('bookListSection'), fontSize('pressRowNamePart')]).toEqual([14, 13, 16]);
    });
  });
});
