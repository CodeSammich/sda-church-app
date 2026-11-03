import { BIBLE_SECTIONS, BIBLE_TESTAMENT_NAMES, getBibleSectionOfBook } from '@/constants/BibleSections';
import { BIBLE_AUDIO_BOOKS } from '@/services/BibleAudioSources';
import { BIBLE_BOOK_NAMES } from '@/services/BibleService';

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
});
