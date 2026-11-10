import { readFileSync } from 'node:fs';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { buildBibleSearchRows } from '@/hooks/useBibleSearch';
import { getBookPillAbbreviation } from '@/services/BibleBookAbbreviations';
import {
  formatBookName,
  formatBookReference,
  formatReference,
  formatTwoLanguageName,
  getBookListName,
  getBookPillName,
  getPickerItemName,
  getSearchBooks,
  readsInAppLanguage,
} from '@/services/BibleNames';
import { searchBible } from '@/services/BibleSearch';
import { fetchBooks, SUPPORTED_TRANSLATIONS } from '@/services/BibleService';

// A Bible read in another language than the app's names its books in both
// (#723): the pill in the app's language, the lists in the translation's with
// the app's in parentheses.
const languageOf = (translationId: string) =>
  SUPPORTED_TRANSLATIONS.find(({ id }) => id === translationId)!.lang;

// A line of text with its no-break spaces and word joiners as plain text.
const plain = (text: string) => text.replace(/\u00a0/g, ' ').replace(/\u2060/g, '');

const bookIn = async (translationId: string, bookId: string) =>
  (await fetchBooks(translationId)).find(({ id }) => id === bookId)!;

const names = async (translationId: string, bookId: string, app: SupportedLanguage) => {
  const book = await bookIn(translationId, bookId);
  const language = languageOf(translationId);
  return {
    pill: getBookPillName(book, language, app),
    list: formatTwoLanguageName(getBookListName(book, language, app)),
  };
};

describe('Bible book names in two languages (#723)', () => {
  it('names a book once when the translation is in the app language', async () => {
    expect(await names('BSB', '1SA', 'en')).toEqual({ pill: '1 Samuel', list: '1 Samuel' });
    expect(await names('cmn_cuv', '1SA', 'zh')).toEqual({ pill: '撒母耳記上', list: '撒母耳記上' });
    expect(await names('cmn_cu1', '1SA', 'zh-cn')).toEqual({ pill: '撒母耳记上', list: '撒母耳记上' });
    expect(await names('spa_r09', 'MAT', 'es')).toEqual({ pill: 'San Mateo', list: 'San Mateo' });
    // The translation's own name, as before: the BSB says "Song".
    expect(await names('BSB', 'SNG', 'en')).toEqual({ pill: 'Song', list: 'Song' });
  });

  it('puts the app language on the pill and both languages in the list when they differ', async () => {
    // The issue's example: an English app reading the CUV.
    expect(await names('cmn_cuv', '1SA', 'en')).toEqual({ pill: '1 Samuel', list: '撒母耳記上 (1 Samuel)' });
    expect(await names('cmn_cu1', '1SA', 'en')).toEqual({ pill: '1 Samuel', list: '撒母耳记上 (1 Samuel)' });
    expect(await names('BSB', '1SA', 'zh')).toEqual({ pill: '撒母耳記上', list: '1 Samuel (撒母耳記上)' });
    expect(await names('BSB', '1SA', 'zh-cn')).toEqual({ pill: '撒母耳记上', list: '1 Samuel (撒母耳记上)' });
    expect(await names('cmn_cuv', 'PSA', 'es')).toEqual({ pill: 'Salmos', list: '詩篇 (Salmos)' });
    expect(await names('spa_r09', 'PSA', 'en')).toEqual({ pill: 'Psalms', list: 'Salmos (Psalms)' });
    expect(await names('spa_r09', 'MAT', 'zh')).toEqual({ pill: '馬太福音', list: 'San Mateo (馬太福音)' });
    // A name both languages share is said once.
    expect(await names('spa_r09', '1SA', 'en')).toEqual({ pill: '1 Samuel', list: '1 Samuel' });
  });

  it('counts Traditional and Simplified Chinese as one language', async () => {
    expect(readsInAppLanguage('zh-cn', 'zh')).toBe(true);
    expect(readsInAppLanguage('zh', 'zh-cn')).toBe(true);
    expect(readsInAppLanguage('zh', 'en')).toBe(false);
    // The list keeps the text's script; the pill is the app's.
    expect(await names('cmn_cu1', '1SA', 'zh')).toEqual({ pill: '撒母耳記上', list: '撒母耳记上' });
    expect(await names('cmn_cuv', '1SA', 'zh-cn')).toEqual({ pill: '撒母耳记上', list: '撒母耳記上' });
  });

  it('keeps the two names apart, so a long pair can wrap between them', async () => {
    const thessalonians = await bookIn('cmn_cuv', '1TH');
    expect(getBookListName(thessalonians, 'zh', 'en')).toEqual({ name: '帖撒羅尼迦前書', appName: '1 Thessalonians' });
    expect(getBookListName(thessalonians, 'zh', 'zh')).toEqual({ name: '帖撒羅尼迦前書' });
    // The pill's one name still shortens, in the app's language, when the card is tight.
    const pill = getBookPillName(thessalonians, 'zh', 'en');
    expect(getBookPillAbbreviation(thessalonians.id, 'en', pill)).toBe('1 Thess');
    expect(getBookPillAbbreviation('1TH', 'zh', getBookPillName(await bookIn('BSB', '1TH'), 'en', 'zh'))).toBe('帖前');
  });

  it('names verse references, as saved verses and the verse popup show them', async () => {
    const john = await bookIn('cmn_cuv', 'JHN');
    expect(plain(formatBookReference(john, 'zh', 'en', '3:16'))).toBe('約翰福音 3:16 (John)');
    expect(plain(formatBookReference(await bookIn('BSB', 'JHN'), 'en', 'zh', '3:16'))).toBe('John 3:16 (約翰福音)');
    // One name, as before.
    expect(formatBookReference(await bookIn('BSB', 'JHN'), 'en', 'en', '3:16')).toBe('John 3:16');
    expect(formatBookReference(john, 'zh', 'zh', '3:16')).toBe('約翰福音 3:16');
  });

  it('lets a narrow line break only before the name in parentheses', async () => {
    // A verse's popup broke "帖撒羅尼迦前書 (1" from "Thessalonians) 4:3".
    const breaks = (text: string) => text.split(' ');
    expect(breaks(formatBookReference(await bookIn('cmn_cuv', '1TH'), 'zh', 'en', '4:3'))).toEqual([
      '帖\u2060撒\u2060羅\u2060尼\u2060迦\u2060前\u2060書\u00a04:3',
      '(1\u00a0Thessalonians)',
    ]);
    const thessalonians = getBookListName(await bookIn('BSB', '1TH'), 'en', 'zh');
    expect(breaks(formatReference(thessalonians, '4:3'))).toEqual([
      '1\u00a0Thessalonians\u00a04:3',
      '(帖\u2060撒\u2060羅\u2060尼\u2060迦\u2060前\u2060書)',
    ]);
    expect(breaks(formatBookName(thessalonians))).toEqual([
      '1\u00a0Thessalonians',
      '(帖\u2060撒\u2060羅\u2060尼\u2060迦\u2060前\u2060書)',
    ]);
    // One name breaks as it always has.
    expect(formatBookName({ name: '1 Thessalonians' })).toBe('1 Thessalonians');
  });
});

describe('Bible chapter and verse lists in two languages (#723)', () => {
  const item = (kind: 'chapter' | 'verse', translationId: string, app: SupportedLanguage) =>
    formatTwoLanguageName(getPickerItemName(kind, 3, languageOf(translationId), app));

  it("uses the app's words alone when the translation is in its language", () => {
    expect(item('verse', 'BSB', 'en')).toBe('Verse 3');
    expect(item('chapter', 'cmn_cuv', 'zh')).toBe('第 3 章');
    expect(item('verse', 'cmn_cu1', 'zh-cn')).toBe('第 3 节');
    expect(item('verse', 'spa_r09', 'es')).toBe('Versículo 3');
    // Simplified text in a Traditional app: the app's, as before.
    expect(item('verse', 'cmn_cu1', 'zh')).toBe('第 3 節');
  });

  it("puts the translation's words first, then the app's, when they differ", () => {
    expect(item('verse', 'cmn_cuv', 'en')).toBe('第 3 節 (Verse 3)');
    expect(item('chapter', 'cmn_cuv', 'en')).toBe('第 3 章 (Chapter 3)');
    expect(item('verse', 'BSB', 'zh')).toBe('Verse 3 (第 3 節)');
    expect(item('chapter', 'BSB', 'zh-cn')).toBe('Chapter 3 (第 3 章)');
    expect(item('verse', 'cmn_cu1', 'es')).toBe('第 3 节 (Versículo 3)');
    expect(item('verse', 'spa_r09', 'en')).toBe('Versículo 3 (Verse 3)');
    expect(getPickerItemName('verse', 3, 'zh', 'en')).toEqual({ name: '第 3 節', appName: 'Verse 3' });
  });
});

describe('Bible search results in two languages (#723)', () => {
  const rowsFor = async (query: string, translationId: string, app: SupportedLanguage) =>
    buildBibleSearchRows({
      query,
      hits: await searchBible(query, [translationId]),
      options: {
        translationIds: [translationId],
        books: getSearchBooks(await fetchBooks(translationId), languageOf(translationId), app),
        bookId: 'GEN',
        chapter: 22,
        onOpen: () => undefined,
      },
      language: app,
    }).map(({ kind, title }) => `${kind}: ${plain(title)}`);

  it('names each result in the translation and the app language, and Go to in the app language', async () => {
    expect(await rowsFor('摩利亞', 'cmn_cuv', 'en')).toEqual([
      'header: This chapter · 1 verse',
      'verse: 創世記 22:2 (Genesis)',
      'header: Whole Bible · 2 verses',
      'header: 創世記 (Genesis) · 1',
      'verse: 創世記 22:2 (Genesis)',
      'header: 歷代志下 (2 Chronicles) · 1',
      'verse: 歷代志下 3:1 (2 Chronicles)',
    ]);
    expect((await rowsFor('Moriah', 'BSB', 'en'))[1]).toBe('verse: Genesis 22:2');
    expect((await rowsFor('Moriah', 'BSB', 'zh'))[1]).toBe('verse: Genesis 22:2 (創世記)');
    // "Go to" is the app's control, so it stays in the app's language.
    expect((await rowsFor('Jn 3:16', 'cmn_cuv', 'en'))[0]).toBe('reference: Go to John 3:16');
  });
});

describe('the Bible screen names books as #723 asks', () => {
  const source = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');

  it('puts the app language on the pill and both in the lists, after the main translation', () => {
    // The pill, its abbreviation, and what screen readers hear: the app's language.
    expect(source).toContain("const bookName = book ? getBookPillName(book, supportedTranslation.lang, language) : '...';");
    expect(source).toContain('getBookPillAbbreviation(book.id, language, bookName)');
    // In dual-language reading, the main translation's language is the one
    // named first; the second translation adds no third name.
    expect(source).toContain('getBookListName(item, supportedTranslation.lang, language)');
    expect(source).toContain('formatBookReference(savedBook, supportedTranslation.lang, language, verses)');
    expect(source).toContain('getSearchBooks(books, supportedTranslation.lang, language)');
    expect(source).toContain('formatBookReference(book, supportedTranslation.lang, language,');
    expect(source).not.toMatch(/(getBook\w+Name|formatBook\w+)\([^)]*supportingTranslation/);
    // The chapter and verse lists too.
    expect(source.match(/getPickerItemName\(/g)).toHaveLength(1);
    expect(source).not.toMatch(/labels\.(verse|chapter)Item/);
  });

  it("shares a verse as it always has, with only the translation's own book name", () => {
    // Shared text goes to someone else, so it quotes the verse and cites it in
    // the translation's language alone: no added name in the app's language.
    const share = source.slice(source.indexOf('const handleShare = async'), source.indexOf('Share.share('));
    expect(share).toContain('const reference = `${book.name} ${chapterNum}:${rangeString}`;');
    expect(share).toContain('const message = `"${fullText}"\\n\\n— ${reference} (${translation})`;');
    expect(share).not.toMatch(/getBook\w+Name|formatBook\w+|formatReference|formatTwoLanguageName/);
    // So does the lock screen's Now Playing title, which names the recording.
    expect(source).toContain('`${book?.name || labels.bible} ${chapterNum}`,');
  });
});
