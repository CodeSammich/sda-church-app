import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { fetchBooks, fetchChapter, isSelahMarker, SUPPORTED_TRANSLATIONS } from '@/services/BibleService';

// The BSB, the American Standard Version (1901), and the Reina-Valera 1909
// ship with the app, built by scripts/build-bundled-bibles.mjs, like the
// Chinese Union Version.
const readJson = (collection: string, name: string) =>
  JSON.parse(readFileSync(join(process.cwd(), 'assets/bible', collection, `${name}.biblejson`), 'utf8'));

const verseText = (chapter: Awaited<ReturnType<typeof fetchChapter>>, number: number) =>
  chapter.chapter.content
    .filter((item) => item.type === 'verse' && 'number' in item && item.number === number)
    .flatMap((item) => ('content' in item ? item.content : []))
    // Plain text, or { text, wordsOfJesus } for red-letter words.
    .map((part) => (typeof part === 'string' ? part : (part as { text?: string }).text ?? ''))
    .join('');

describe('bundled English and Spanish Bibles', () => {
  it.each([
    ['bsb', 31086],
    ['asv', 31102],
    ['rv1909', 31102],
  ])('%s has all 66 books, and its book list matches them', (collection, verses) => {
    const books = readJson(collection, 'books');
    expect(books).toHaveLength(66);
    expect(books.reduce((sum: number, book: { totalNumberOfVerses: number }) => sum + book.totalNumberOfVerses, 0)).toBe(verses);
    for (const { id, numberOfChapters } of books) {
      const book = readJson(collection, id.toLowerCase());
      const chapters = collection === 'rv1909' ? book.contents : book.chapters;
      expect([id, chapters.length - 1]).toEqual([id, numberOfChapters]);
    }
  });

  it('opens BSB chapters with their narrators and no network request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const chapter = await fetchChapter('BSB', 'GEN', 1);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(chapter.translation.id).toBe('BSB');
    expect(chapter.chapter.content[0]).toEqual({ type: 'heading', content: ['The Creation'] });
    expect(verseText(chapter, 1)).toBe('In the beginning God created the heavens and the earth.');
    expect(Object.keys(chapter.thisChapterAudioLinks).sort()).toEqual(['david', 'gilbert', 'hays', 'souer']);
    expect(chapter.thisChapterAudioLinks.david).toBe('https://audio.bible.helloao.org/api/BSB/GEN/1/audio/david.mp3');
    expect(chapter.nextChapterAudioLinks?.david).toBe('https://audio.bible.helloao.org/api/BSB/GEN/2/audio/david.mp3');
    expect(chapter.previousChapterAudioLinks).toBeNull();
  });

  it('opens ASV chapters with no network request, and no narrators', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const john = await fetchChapter('eng_asv', 'JHN', 3);
    const daniel = await fetchChapter('eng_asv', 'DAN', 8);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(john.translation.id).toBe('eng_asv');
    expect(verseText(john, 16)).toContain('For God so loved the world, that he gave his only begotten Son');
    expect(verseText(daniel, 14)).toContain('then shall the sanctuary be cleansed');
    expect(john.thisChapterAudioLinks).toEqual({});
  });

  it('gives each of the ASV’s 74 Selahs its own item, which the reader right-aligns', async () => {
    const psalm = await fetchChapter('eng_asv', 'PSA', 3);
    expect(psalm.chapter.content.find((item) => item.type === 'verse' && item.number === 2)).toMatchObject({
      content: [
        { text: 'Many there are that say of my soul,', poem: 1 },
        { lineBreak: true },
        { text: 'There is no help for him in God.', poem: 1 },
        'Selah',
        { lineBreak: true },
      ],
    });

    const markers: string[] = [];
    for (const [book, chapters] of [['PSA', 150], ['HAB', 3]] as const) {
      for (let number = 1; number <= chapters; number++) {
        const chapter = await fetchChapter('eng_asv', book, number);
        for (const item of chapter.chapter.content) {
          for (const part of item.type === 'verse' ? item.content : []) {
            const text = typeof part === 'string' ? part : 'text' in part ? part.text : '';
            expect(text).not.toContain('[');
            if (isSelahMarker('eng_asv', text)) markers.push(text);
          }
        }
      }
    }
    expect(markers).toHaveLength(74);
    expect(markers.filter((marker) => marker !== 'Selah')).toEqual(['Higgaion. Selah']);
  });

  it('opens Reina-Valera chapters with no network request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const rv = await fetchChapter('spa_r09', 'JHN', 3);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(verseText(rv, 16)).toContain('Porque de tal manera amó Dios al mundo');
  });

  it('no longer has the KJV, which the church dropped', () => {
    expect(SUPPORTED_TRANSLATIONS.map(({ id }) => id)).not.toContain('eng_kjv');
    expect(readdirSync(join(process.cwd(), 'assets/bible'))).not.toContain('kjv');
  });

  it('lists the books from the app', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    for (const translation of ['BSB', 'eng_asv', 'spa_r09']) {
      await expect(fetchBooks(translation)).resolves.toHaveLength(66);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('has every translation the reader offers, and nothing to download', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    for (const { id } of SUPPORTED_TRANSLATIONS) {
      await expect(fetchBooks(id)).resolves.toHaveLength(66);
      expect((await fetchChapter(id, 'GEN', 1)).chapter.content.length).toBeGreaterThan(0);
    }
    expect(fetchSpy).not.toHaveBeenCalled();

    jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(fetchBooks('eng_kjv')).rejects.toThrow('No Bible text ships with the app for eng_kjv');
    await expect(fetchChapter('eng_kjv', 'GEN', 1)).rejects.toThrow('No Bible text ships with the app for eng_kjv');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('gives the same chapter every time, without changing the bundled book', async () => {
    const first = await fetchChapter('BSB', 'PSA', 23);
    const second = await fetchChapter('BSB', 'PSA', 23);
    expect(second.chapter.content).toEqual(first.chapter.content);
  });
});

describe('scripts/build-bundled-bibles.mjs', () => {
  it('keeps each HelloAO chapter’s text and narrators, and drops the audio timings', () => {
    const book = JSON.parse(
      execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '-e',
          `import { helloaoBook } from ${JSON.stringify(resolve('scripts/build-bundled-bibles.mjs'))};
           console.log(JSON.stringify(helloaoBook({ id: 'BSB' }, {
             id: 'OBA', name: 'Obadiah', commonName: 'Obadiah', title: 'Obadiah', order: 31,
             numberOfChapters: 1, totalNumberOfVerses: 21,
             chapters: [{ numberOfVerses: 21, thisChapterAudioLinks: { hays: 'h.mp3' },
               thisChapterAudioTimings: { hays: [1, 2] }, chapter: { number: 1, content: [], footnotes: [] } }],
           })));`,
        ],
        { encoding: 'utf8' },
      ),
    );
    expect(book).toEqual({
      translation: { id: 'BSB' },
      book: { id: 'OBA', name: 'Obadiah', commonName: 'Obadiah', title: 'Obadiah', numberOfChapters: 1, totalNumberOfVerses: 21 },
      chapters: [null, { numberOfVerses: 21, thisChapterAudioLinks: { hays: 'h.mp3' }, chapter: { number: 1, content: [], footnotes: [] } }],
    });
  });
});
