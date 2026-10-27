import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fetchOriginalLanguageVerse, ORIGINAL_VERSE_NUMBERING } from '@/services/BibleService';

// The verse popup's Hebrew and Greek ship with the app, built by
// scripts/build-bundled-bibles.mjs from fetch(bible): the Solid Rock Hebrew
// Bible (hbo_sr) and the Statistical Restoration Greek New Testament (grc_sr).
const readJson = (path: string) => JSON.parse(readFileSync(join(process.cwd(), 'assets/bible', path), 'utf8'));
const books: { id: string }[] = readJson('bsb/books.biblejson');

describe('original-language texts in the app', () => {
  it('opens a Hebrew and a Greek verse with no network request, with the credit and license CC BY 4.0 asks for', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const genesis = await fetchOriginalLanguageVerse('GEN', 1, 1);
    const john = await fetchOriginalLanguageVerse('JHN', 1, 1);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(genesis).toMatchObject({
      language: 'Hebrew / Aramaic',
      textDirection: 'rtl',
      edition: 'Solid Rock Hebrew Bible',
      attribution: 'Edited by Stephen L. Brown.',
      sourceUrl: 'https://github.com/jjmccollum/solid-rock-hb',
      license: 'CC BY 4.0',
      licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    });
    expect(genesis.text).toBe('בְּרֵאשִׁית בָּרָא אֱלֹהִים אֵת הַשָּׁמַיִם וְאֵת הָאָרֶץ');
    expect(john).toMatchObject({
      language: 'Koine Greek',
      textDirection: 'ltr',
      edition: 'Statistical Restoration Greek New Testament',
      sourceUrl: 'https://github.com/Center-for-New-Testament-Restoration/SR',
      license: 'CC BY 4.0',
    });
    // The Greek is a word per line; the popup reads it as one line.
    expect(john.text).toBe('Ἐν ἀρχῇ ἦν ὁ λόγος, καὶ ὁ λόγος ἦν πρὸς τὸν ˚Θεόν, καὶ ˚Θεὸς ἦν ὁ λόγος.');
  });

  it('has the Old Testament in Hebrew and the New in Greek, a file for each book', () => {
    const ids = books.map(({ id }) => id.toLowerCase());
    const { BUNDLED_BIBLE_ASSETS } = require('@/assets/bible');
    expect(Object.keys(BUNDLED_BIBLE_ASSETS['original/hbo_sr']).sort()).toEqual(ids.slice(0, 39).sort());
    expect(Object.keys(BUNDLED_BIBLE_ASSETS['original/grc_sr']).sort()).toEqual(ids.slice(39).sort());
  });

  // The passages the critical editions leave out, as the oldest manuscripts
  // lack them. The popup says the original-language text is unavailable there.
  const range = (book: string, chapter: number, from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => `${book} ${chapter}:${from + i}`);
  const leftOut = [
    'EZK 40:30',
    'MAT 16:3',
    ...range('MRK', 16, 9, 20),
    'LUK 22:43',
    'LUK 22:44',
    'JHN 7:53',
    ...range('JHN', 8, 1, 11),
  ];
  // Verses the BSB also leaves out, as the critical text does, but the 1919
  // CUV and the Reina-Valera 1909 have.
  const alsoLeftOut = [
    'MAT 17:21', 'MAT 18:11', 'MAT 23:14', 'MRK 7:16', 'MRK 9:44', 'MRK 9:46', 'MRK 11:26', 'MRK 15:28',
    'LUK 17:36', 'LUK 23:17', 'JHN 5:4', 'ACT 8:37', 'ACT 15:34', 'ACT 24:7', 'ACT 28:29', 'ROM 16:24',
  ];
  const order = (refs: string[]) =>
    [...refs].sort((a, b) => {
      const at = (ref: string) => {
        const [book, cv] = ref.split(' ');
        const [chapter, verse] = cv.split(':').map(Number);
        return [books.findIndex(({ id }) => id === book), chapter, verse];
      };
      const [x, y] = [at(a), at(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    });

  // Each translation's verses, as text by chapter and verse number.
  const versesOf = (translationId: string, id: string): Record<number, Record<number, string>> => {
    const verses: Record<number, Record<number, string>> = {};
    if (translationId === 'BSB') {
      readJson(`bsb/${id.toLowerCase()}.biblejson`).chapters.forEach(
        (chapter: { chapter: { content: { type: string; number?: number; content?: unknown[] }[] } } | null, number: number) => {
          for (const item of chapter?.chapter.content ?? []) {
            if (item.type !== 'verse') continue;
            (verses[number] ??= {})[item.number!] = (item.content ?? [])
              .map((part) => (typeof part === 'string' ? part : ((part as { text?: string }).text ?? '')))
              .join('')
              .trim();
          }
        },
      );
    } else {
      const folder = { cmn_cuv: 'cuv1919/hant', cmn_cu1: 'cuv1919/hans', spa_r09: 'rv1909' }[translationId];
      readJson(`${folder}/${id.toLowerCase()}.biblejson`).contents.forEach((chapter: unknown[][] | null, number: number) => {
        chapter?.forEach((parts, verse) => {
          if (!verse || !Array.isArray(parts)) return;
          (verses[number] ??= {})[verse] = parts.filter((part) => typeof part === 'string').join('').trim();
        });
      });
    }
    return verses;
  };
  const originalOf = (index: number, id: string): unknown[][][] =>
    readJson(`original/${index < 39 ? 'hbo_sr' : 'grc_sr'}/${id.toLowerCase()}.biblejson`).contents;
  const hasText = (parts: unknown) =>
    Array.isArray(parts) && parts.some((part) => typeof part === 'string' && part.trim());

  it.each(['BSB', 'cmn_cuv', 'cmn_cu1', 'spa_r09'])(
    'gives every %s verse its original-language verse, and leaves no original verse out',
    (translationId) => {
      const numbering = ORIGINAL_VERSE_NUMBERING[translationId];
      const empty: string[] = [];
      const uncovered: string[] = [];
      books.forEach(({ id }, index) => {
        const original = originalOf(index, id);
        const covered = new Set<string>();
        for (const [chapter, verses] of Object.entries(versesOf(translationId, id))) {
          for (const [verse, text] of Object.entries(verses)) {
            if (!text) continue;
            const refs = numbering[`${id} ${chapter}:${verse}`] ?? [[Number(chapter), Number(verse)]];
            for (const [c, v] of refs) covered.add(`${c}:${v}`);
            if (!refs.some(([c, v]) => hasText(original[c]?.[v]))) empty.push(`${id} ${chapter}:${verse}`);
          }
        }
        original.forEach((chapter, c) =>
          chapter?.forEach((parts, v) => {
            if (v && hasText(parts) && !covered.has(`${c}:${v}`)) uncovered.push(`${id} ${c}:${v}`);
          }),
        );
      });
      expect(empty).toEqual(order(translationId === 'BSB' ? leftOut : [...leftOut, ...alsoLeftOut]));
      expect(uncovered).toEqual([]);
    },
  );

  it('lists only verses each translation has', () => {
    for (const [translationId, numbering] of Object.entries(ORIGINAL_VERSE_NUMBERING)) {
      for (const ref of Object.keys(numbering)) {
        const [id, cv] = ref.split(' ');
        const [chapter, verse] = cv.split(':').map(Number);
        expect([translationId, ref, Boolean(versesOf(translationId, id)[chapter]?.[verse])]).toEqual([translationId, ref, true]);
      }
    }
  });

  it('shows the original verse that holds a verse the translation numbers differently, and says which', async () => {
    const greek = (translationId: string, book: string, chapter: number, verse: number) =>
      fetchOriginalLanguageVerse(book, chapter, verse, translationId);

    // 2 Corinthians 13: the BSB and the CUV number "All the saints greet you"
    // 13:13, which the Greek and the Reina-Valera put in 13:12.
    expect(await greek('BSB', '2CO', 13, 13)).toMatchObject({ reference: '13:12', text: expect.stringContaining('Ἀσπάζονται ὑμᾶς οἱ ἅγιοι πάντες') });
    expect(await greek('BSB', '2CO', 13, 14)).toMatchObject({ reference: '13:13', text: expect.stringMatching(/^Ἡ χάρις/) });
    expect(await greek('cmn_cuv', '2CO', 13, 14)).toMatchObject({ reference: '13:13', text: expect.stringMatching(/^Ἡ χάρις/) });
    const spanish = await greek('spa_r09', '2CO', 13, 13);
    expect(spanish.text).toMatch(/^Ἡ χάρις/);
    expect(spanish.reference).toBeUndefined();

    // The BSB's Revelation 12:17 ends with the dragon on the shore, the Greek's 12:18;
    // the Reina-Valera opens 13:1 with it.
    expect(await greek('BSB', 'REV', 12, 17)).toMatchObject({ reference: '12:17–18', text: expect.stringMatching(/Καὶ ἐστάθη ἐπὶ τὴν ἄμμον τῆς θαλάσσης\.$/) });
    expect(await greek('cmn_cuv', 'REV', 12, 18)).toMatchObject({ text: 'Καὶ ἐστάθη ἐπὶ τὴν ἄμμον τῆς θαλάσσης.' });
    expect(await greek('spa_r09', 'REV', 13, 1)).toMatchObject({ reference: '12:18–13:1', text: expect.stringMatching(/^Καὶ ἐστάθη ἐπὶ τὴν ἄμμον/) });
    expect(await greek('BSB', '3JN', 1, 14)).toMatchObject({ reference: '1:14–15', text: expect.stringContaining('Εἰρήνη σοι') });

    // Isaiah 64:1 is the end of the Hebrew's 63:19, and Nehemiah 7:68's horses
    // and mules are in its 7:69.
    expect(await greek('BSB', 'ISA', 64, 1)).toMatchObject({ reference: '63:19', text: expect.stringContaining('קָרַעְתָּ שָׁמַיִם') });
    // (The data writes the vowel and dagesh in another order, so compare them
    // normalized.)
    const nehemiah = await greek('spa_r09', 'NEH', 7, 68);
    expect(nehemiah.reference).toBe('7:69');
    expect(nehemiah.text.normalize('NFC')).toContain('סוּסִים'.normalize('NFC'));
    // The Reina-Valera's 2 Samuel 20:25 also holds 20:26, "Ira the Jairite".
    expect(await greek('spa_r09', '2SA', 20, 25)).toMatchObject({ reference: '20:25–26', text: expect.stringContaining('עִירָא') });

    // Elsewhere the numbers are the same, with no reference shown.
    expect((await greek('BSB', 'JHN', 3, 16)).reference).toBeUndefined();
  });

  it('turns down a chapter or verse that isn’t a positive whole number', async () => {
    await expect(fetchOriginalLanguageVerse('GEN', 0, 1)).rejects.toThrow('Chapter and verse must be positive integers');
    await expect(fetchOriginalLanguageVerse('GEN', 1, 1.5)).rejects.toThrow('Chapter and verse must be positive integers');
  });
});
