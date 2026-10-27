import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  fetchBooks,
  fetchChapter,
  isSelahMarker,
  normalizeFetchBibleText,
} from '@/services/BibleService';
import { getBiblePinyinLines } from '@/services/BiblePinyinService';

// The public-domain 1919 Chinese Union Version that ships with the app (#517),
// built by scripts/build-cuv-1919.mjs from WordProject's text and the reviewed
// corrections in scripts/cuv-1919-corrections.json.

type Part = string | { type: string; contents: string; level?: number };
type Book = { book: string; contents: Part[][][] };

const SCRIPTS = ['hant', 'hans'] as const;
const folder = (script: string) => join(process.cwd(), 'assets/bible/cuv1919', script);
const readJson = (script: string, name: string) =>
  JSON.parse(readFileSync(join(folder(script), `${name}.biblejson`), 'utf8'));
// In Bible order, from the book list.
const BOOKS: string[] = readJson('hant', 'books').map((book: { id: string }) => book.id.toLowerCase());
const OLD_TESTAMENT = BOOKS.slice(0, 39);

const versesOf = (script: string) =>
  BOOKS.flatMap((book) => {
    const { contents } = readJson(script, book) as Book;
    return contents.flatMap((chapter, c) =>
      chapter.flatMap((verse, v) => (verse.length ? [{ ref: `${book} ${c}:${v}`, book, parts: verse }] : [])),
    );
  });
const textOf = (parts: Part[]) => parts.filter((part): part is string => typeof part === 'string').join('');
const verse = (script: string, ref: string) => {
  const [book, cv] = ref.split(' ');
  const [c, v] = cv.split(':').map(Number);
  return textOf((readJson(script, book) as Book).contents[c][v]);
};

const ALL = { hant: versesOf('hant'), hans: versesOf('hans') };

describe('1919 Chinese Union Version text', () => {
  it('has every book and verse, numbered the same in both scripts', () => {
    expect(BOOKS).toHaveLength(66);
    for (const script of SCRIPTS) {
      expect(readdirSync(folder(script)).sort()).toEqual([...BOOKS, 'books'].map((name) => `${name}.biblejson`).sort());
    }
    expect(ALL.hant).toHaveLength(31104);
    expect(ALL.hans.map(({ ref }) => ref)).toEqual(ALL.hant.map(({ ref }) => ref));
  });

  it('lists each book with its name and size', () => {
    for (const script of SCRIPTS) {
      const books = readJson(script, 'books');
      expect(books.map((book: { id: string }) => book.id.toLowerCase())).toEqual(BOOKS);
      for (const { id, name, numberOfChapters, totalNumberOfVerses } of books) {
        const { contents } = readJson(script, id.toLowerCase()) as Book;
        expect(name).toMatch(/\p{Script=Han}/u);
        expect(numberOfChapters).toBe(contents.length - 1);
        expect(totalNumberOfVerses).toBe(contents.slice(1).reduce((sum, chapter) => sum + chapter.length - 1, 0));
      }
    }
    expect(readJson('hant', 'books')[0].name).toBe('創世記');
    expect(readJson('hans', 'books')[0].name).toBe('创世记');
  });

  it('has nothing a phone could fail to show and none of WordProject’s markers', () => {
    for (const script of SCRIPTS) {
      for (const { ref, parts } of ALL[script]) {
        const text = parts.map((part) => (typeof part === 'string' ? part : part.contents)).join('');
        // Private-use placeholders, characters outside the Basic Multilingual Plane,
        // and WordProject's "(1:15)"-style markers or stray Latin text.
        expect([ref, /[-]|[\u{10000}-\u{10ffff}]|[A-Za-z0-9()[\]]/u.test(text)]).toEqual([ref, false]);
      }
    }
  });

  it('keeps the 1919 respectful space only before 神', () => {
    for (const { ref, parts } of ALL.hant) {
      for (const match of textOf(parts).matchAll(/　(.)/gu)) {
        expect([ref, match[1]]).toEqual([ref, '神']);
      }
    }
  });

  it('keeps the fixes made to WordProject’s copy', () => {
    expect(verse('hant', 'gen 1:10').startsWith('神稱旱地為地')).toBe(true);
    expect(verse('hant', 'gen 33:20').endsWith('〔就是　神以色列　神的意思〕')).toBe(true);
    expect(verse('hant', 'neh 10:12')).toBe('撒刻、示利比、示巴尼、');
    expect(verse('hant', '1ch 2:8')).toBe('以探的兒子是亞撒利雅。');
    expect(verse('hant', 'job 3:2')).toBe('說、');
    expect(verse('hant', 'rev 12:18')).toBe('那時龍就站在海邊的沙上。');
    // WordProject wrote 撒都該 (Sadducees) into Old Testament names 220 times.
    for (const { ref, book, parts } of ALL.hant) {
      if (OLD_TESTAMENT.includes(book)) expect([ref, textOf(parts).includes('撒都該')]).toEqual([ref, false]);
    }
  });

  it('shows Psalm titles as headings and puts a Selah ending a verse on its own line', () => {
    const psalm3 = (readJson('hant', 'psa') as Book).contents[3];
    expect(psalm3[1][0]).toEqual({ type: 'heading', contents: '〔大衛逃避他兒子押沙龍的時候作的詩。〕', level: 3 });
    expect(textOf(psalm3[2]).split('\n').pop()).toBe('〔細拉〕');
    expect(isSelahMarker('cmn_cuv', '〔細拉〕')).toBe(true);
    expect(isSelahMarker('cmn_cu1', '〔细拉〕')).toBe(true);
    // One inside a verse stays where it is.
    expect(verse('hant', 'hab 3:3')).toContain('〔細拉〕他的榮光遮蔽諸天');
  });

  it('pairs every Han character with one pinyin syllable, as the reader shows it', () => {
    for (const script of SCRIPTS) {
      for (const { ref, parts } of ALL[script]) {
        for (const part of parts) {
          const shown = normalizeFetchBibleText(typeof part === 'string' ? part : part.contents);
          const tokens = getBiblePinyinLines(shown).flat();
          const problems = tokens.filter(
            (token) => /\p{Script=Han}/u.test(token.text) !== Boolean(token.pinyin),
          );
          expect([ref, problems]).toEqual([ref, []]);
          expect(tokens.map((t) => `${t.prefix ?? ''}${t.text}${t.suffix ?? ''}`).join('')).toBe(shown.replace(/\n/g, ''));
        }
      }
    }
  });
});

describe('reading the bundled text', () => {
  it('opens a chapter with no network request and credits the 1919 text', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const chapter = await fetchChapter('cmn_cuv', 'PSA', 23);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chapter.translation.name).toBe('和合本（1919）');
    expect(chapter.translation.attribution).toBe('Public domain (1919). Text adapted from WordProject.');
    expect(chapter.thisChapterLink).toBe('bundled:cuv1919/hant/psa');
    expect(chapter.chapter.content[0]).toEqual({ type: 'heading', content: ['〔大衛的詩。〕'] });
    expect(chapter.chapter.content[1]).toMatchObject({ type: 'verse', number: 1, content: ['耶和華是我的牧者．我必不至缺乏。'] });
    expect(chapter.numberOfVerses).toBe(6);
  });

  it('lists the books of the Simplified text from the app', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const books = await fetchBooks('cmn_cu1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(books).toHaveLength(66);
    expect(books[18]).toMatchObject({ id: 'PSA', name: '诗篇', numberOfChapters: 150 });
  });
});
