import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The Bible's sections, in canonical order, each book in exactly one: how
 * Offline Bible Audio groups the books it downloads and deletes (#556). The
 * usual Protestant grouping, as in Bible contents pages and reading plans.
 * test/bible-sections.test.ts checks every book is here once, in order.
 */

export type BibleTestament = 'old' | 'new';

export type BibleSection = Readonly<{
  id: string;
  testament: BibleTestament;
  /** USFM ids, in canonical order. */
  books: readonly string[];
  /** As a heading: "Major Prophets". */
  name: Readonly<Record<SupportedLanguage, string>>;
  /** In a sentence, where it differs: "Delete the Major Prophets?" */
  inSentence?: Readonly<Partial<Record<SupportedLanguage, string>>>;
}>;

export const BIBLE_SECTIONS: readonly BibleSection[] = [
  {
    id: 'law',
    testament: 'old',
    books: ['GEN', 'EXO', 'LEV', 'NUM', 'DEU'],
    name: { en: 'Law', zh: '摩西五經', 'zh-cn': '摩西五经', es: 'Pentateuco' },
    inSentence: { en: 'the Law', es: 'el Pentateuco' },
  },
  {
    id: 'history',
    testament: 'old',
    books: ['JOS', 'JDG', 'RUT', '1SA', '2SA', '1KI', '2KI', '1CH', '2CH', 'EZR', 'NEH', 'EST'],
    name: { en: 'History', zh: '歷史書', 'zh-cn': '历史书', es: 'Libros históricos' },
    inSentence: { en: 'the History books', es: 'los Libros históricos' },
  },
  {
    id: 'poetry',
    testament: 'old',
    books: ['JOB', 'PSA', 'PRO', 'ECC', 'SNG'],
    name: { en: 'Poetry and Wisdom', zh: '詩歌智慧書', 'zh-cn': '诗歌智慧书', es: 'Libros poéticos y sapienciales' },
    inSentence: { en: 'the Poetry and Wisdom books', es: 'los Libros poéticos y sapienciales' },
  },
  {
    id: 'major-prophets',
    testament: 'old',
    books: ['ISA', 'JER', 'LAM', 'EZK', 'DAN'],
    name: { en: 'Major Prophets', zh: '大先知書', 'zh-cn': '大先知书', es: 'Profetas mayores' },
    inSentence: { en: 'the Major Prophets', es: 'los Profetas mayores' },
  },
  {
    id: 'minor-prophets',
    testament: 'old',
    books: ['HOS', 'JOL', 'AMO', 'OBA', 'JON', 'MIC', 'NAM', 'HAB', 'ZEP', 'HAG', 'ZEC', 'MAL'],
    name: { en: 'Minor Prophets', zh: '小先知書', 'zh-cn': '小先知书', es: 'Profetas menores' },
    inSentence: { en: 'the Minor Prophets', es: 'los Profetas menores' },
  },
  {
    id: 'gospels',
    testament: 'new',
    books: ['MAT', 'MRK', 'LUK', 'JHN'],
    name: { en: 'Gospels', zh: '福音書', 'zh-cn': '福音书', es: 'Evangelios' },
    inSentence: { en: 'the Gospels', es: 'los Evangelios' },
  },
  {
    id: 'acts',
    testament: 'new',
    books: ['ACT'],
    name: { en: 'Acts', zh: '使徒行傳', 'zh-cn': '使徒行传', es: 'Hechos' },
  },
  {
    id: 'pauls-letters',
    testament: 'new',
    books: ['ROM', '1CO', '2CO', 'GAL', 'EPH', 'PHP', 'COL', '1TH', '2TH', '1TI', '2TI', 'TIT', 'PHM'],
    name: { en: 'Paul’s Letters', zh: '保羅書信', 'zh-cn': '保罗书信', es: 'Cartas de Pablo' },
    inSentence: { es: 'las Cartas de Pablo' },
  },
  {
    id: 'general-letters',
    testament: 'new',
    books: ['HEB', 'JAS', '1PE', '2PE', '1JN', '2JN', '3JN', 'JUD'],
    name: { en: 'General Letters', zh: '普通書信', 'zh-cn': '普通书信', es: 'Cartas generales' },
    inSentence: { en: 'the General Letters', es: 'las Cartas generales' },
  },
  {
    id: 'revelation',
    testament: 'new',
    books: ['REV'],
    name: { en: 'Revelation', zh: '啟示錄', 'zh-cn': '启示录', es: 'Apocalipsis' },
  },
];

export const BIBLE_TESTAMENT_NAMES: Readonly<
  Record<BibleTestament, Readonly<{ name: Readonly<Record<SupportedLanguage, string>>; inSentence: Readonly<Partial<Record<SupportedLanguage, string>>> }>>
> = {
  old: {
    name: { en: 'Old Testament', zh: '舊約', 'zh-cn': '旧约', es: 'Antiguo Testamento' },
    inSentence: { en: 'the Old Testament', es: 'el Antiguo Testamento' },
  },
  new: {
    name: { en: 'New Testament', zh: '新約', 'zh-cn': '新约', es: 'Nuevo Testamento' },
    inSentence: { en: 'the New Testament', es: 'el Nuevo Testamento' },
  },
};

/** The section a book is in. */
export const getBibleSectionOfBook = (bookId: string) =>
  BIBLE_SECTIONS.find((section) => section.books.includes(bookId));
