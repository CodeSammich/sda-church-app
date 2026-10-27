import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  fetchBooks,
  fetchChapter,
  isSelahMarker,
  needsSpaceAfterFootnote,
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
const notesOf = (parts: Part[]) =>
  parts.flatMap((part) => (typeof part !== 'string' && part.type === 'note' ? [part.contents] : []));
const partsOf = (script: string, ref: string) => {
  const [book, cv] = ref.split(' ');
  const [c, v] = cv.split(':').map(Number);
  return (readJson(script, book) as Book).contents[c][v];
};
const verse = (script: string, ref: string) => textOf(partsOf(script, ref));

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
      for (const match of [textOf(parts), ...notesOf(parts)].join('').matchAll(/　(.)/gu)) {
        expect([ref, match[1]]).toEqual([ref, '神']);
      }
    }
  });

  it('keeps the fixes made to WordProject’s copy', () => {
    expect(verse('hant', 'gen 1:10').startsWith('神稱旱地為地')).toBe(true);
    expect(notesOf(partsOf('hant', 'gen 33:20'))).toEqual(['就是　神以色列　神的意思']);
    expect(verse('hant', 'gen 33:20')).toBe('在那裡築了一座壇、起名叫伊利伊羅伊以色列。');
    expect(verse('hant', 'neh 10:12')).toBe('撒刻、示利比、示巴尼、');
    expect(verse('hant', '1ch 2:8')).toBe('以探的兒子是亞撒利雅。');
    expect(verse('hant', 'job 3:2')).toBe('說、');
    expect(verse('hant', 'rev 12:18')).toBe('那時龍就站在海邊的沙上。');
    expect(notesOf(partsOf('hant', 'jer 46:20'))).toEqual(['毀滅或作牛虻']);
    // Found by the last check against open-bibles (test/cuv-1919-witnesses.test.ts).
    expect(verse('hant', 'num 13:8')).toBe('屬以法蓮支派的、有嫩的兒子何西阿．');
    expect(notesOf(partsOf('hant', 'pro 31:8'))).toEqual(['或作不能自辯的']);
    expect(verse('hant', 'job 39:19')).toContain('挓挲的騌');
    expect(verse('hant', 'exo 20:20').endsWith('不至犯罪。')).toBe(true);
    // WordProject wrote 撒都該 (Sadducees) into Old Testament names 220 times.
    for (const { ref, book, parts } of ALL.hant) {
      if (OLD_TESTAMENT.includes(book)) expect([ref, textOf(parts).includes('撒都該')]).toEqual([ref, false]);
    }
  });

  it('never starts a verse by repeating the one before', () => {
    // Wikisource's copy starts John 8:1 with 7:53's words; the app keeps them in 7:53.
    expect(verse('hant', 'jhn 7:53')).toBe('於是各人都回家去了．');
    expect(verse('hant', 'jhn 8:1')).toBe('耶穌卻往橄欖山去。');
    const bare = (parts: Part[]) => textOf(parts).replace(/[\s。．、，；：！？]/gu, '');
    ALL.hant.forEach(({ ref, book, parts }, index) => {
      const before = ALL.hant[index - 1];
      if (!before || before.book !== book || bare(before.parts).length < 4) return;
      expect([ref, bare(parts).startsWith(bare(before.parts))]).toEqual([ref, false]);
    });
  });

  it('makes each note inside a verse a footnote, and keeps the verses printed in 〔〕', () => {
    for (const script of SCRIPTS) {
      const notes = ALL[script].flatMap(({ parts }) => notesOf(parts));
      expect(notes).toHaveLength(1012);
      expect(notes.every((note) => note && !/[〔〕]/u.test(note))).toBe(true);
    }
    expect(ALL.hans.map(({ parts }) => notesOf(parts).length)).toEqual(ALL.hant.map(({ parts }) => notesOf(parts).length));
    expect(partsOf('hant', 'gen 4:1')).toEqual([
      '有一日、那人和他妻子夏娃同房、夏娃就懷孕、生了該隱、',
      { type: 'note', contents: '就是得的意思' },
      '便說、耶和華使我得了一個男子。',
    ]);
    // Left in the text: Selah, and the 12 verses that are all in 〔〕.
    const bracketed = ALL.hant.filter(({ parts }) => /〔(?!細拉〕)/u.test(textOf(parts))).map(({ ref }) => ref);
    expect(bracketed).toHaveLength(12);
    expect(bracketed).toEqual(expect.arrayContaining(['exo 16:36', 'mat 18:11', 'jhn 5:4', 'act 8:37']));
    expect(verse('hant', 'mat 18:11')).toBe('〔人子來為要拯救失喪的人〕');
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
    // 著 is zhù only where it means famous (著名) or writing (著書); elsewhere it's
    // zhe, as in 穿著 and 按著名 (by name), which the converter misreads.
    const zhu: string[] = [];
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
          if (tokens.some((t) => t.text === '著' && t.pinyin === 'zhù')) zhu.push(`${script} ${ref}`);
        }
      }
    }
    const famousOrWriting = ['1ch 8:28', '1ch 9:34', '1ch 12:30', 'ecc 12:12', 'amo 6:1'];
    expect(zhu.sort()).toEqual(SCRIPTS.flatMap((script) => famousOrWriting.map((ref) => `${script} ${ref}`)).sort());
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

  it('shows the 1919 notes as footnotes where they stood', async () => {
    const chapter = await fetchChapter('cmn_cuv', 'JHN', 3);
    const verse15 = chapter.chapter.content.find((item) => item.type === 'verse' && item.number === 15);
    const noteId = chapter.chapter.footnotes.find((note) => note.reference?.verse === 15)?.noteId;

    expect(chapter.chapter.footnotes).toContainEqual(
      expect.objectContaining({ text: '或作叫一切信的人在他裡面得永生', reference: { chapter: 3, verse: 15 } }),
    );
    expect(verse15).toMatchObject({ content: ['叫一切信他的都得永生。', { noteId }] });

    // The respectful space before 神 shows as it does in the verse text.
    const genesis = await fetchChapter('cmn_cuv', 'GEN', 33);
    expect(genesis.chapter.footnotes.map((note) => note.text)).toContain('就是 神以色列 神的意思');
  });

  it('puts no space after a footnote marker in Chinese, as it does in English', () => {
    expect(needsSpaceAfterFootnote('with the')).toBe(true);
    for (const text of ['便說、', '、雅各', '．', '『他', '. And', '']) {
      expect([text, needsSpaceAfterFootnote(text)]).toEqual([text, false]);
    }
  });

  it('lists the books of the Simplified text from the app', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const books = await fetchBooks('cmn_cu1');

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(books).toHaveLength(66);
    expect(books[18]).toMatchObject({ id: 'PSA', name: '诗篇', numberOfChapters: 150 });
  });
});
