import type { SupportedLanguage } from '@/constants/LanguageContext';
import { buildBibleSearchRows, type BibleSearchOptions } from '@/hooks/useBibleSearch';
import { foldChineseText, loadSearchableTranslation, parseSearchTerms, searchBible } from '@/services/BibleSearch';
import { fetchBooks, readTranslationVerseTexts } from '@/services/BibleService';

// Whole-Bible search (#516) over the texts that ship with the app.
const refs = (hits: { bookId: string; chapter: number; verse: number }[]) =>
  hits.map(({ bookId, chapter, verse }) => `${bookId} ${chapter}:${verse}`);

describe('whole-Bible search', () => {
  it('searches every verse with no network request', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const hits = await searchBible('sabbath', ['BSB']);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(hits).toHaveLength(144);
    expect(refs(hits).slice(0, 2)).toEqual(['EXO 16:23', 'EXO 16:25']);
    expect(refs(hits)).toContain('MRK 2:27');
  });

  it('matches English and Spanish words from their start, ignoring case and accents', async () => {
    const love = await searchBible('Love', ['BSB']);
    const texts = love.map(({ text }) => text).join('\n');
    expect(texts).toMatch(/\bloved\b/);
    // "love" doesn't find "beloved" or "unloved" unless the verse has love too.
    expect(love.every(({ text }) => /(^|[^\p{L}])love/iu.test(text))).toBe(true);

    const sabado = refs(await searchBible('sabado', ['spa_r09']));
    expect(sabado).toHaveLength(137);
    expect(sabado).toContain('EXO 16:23');
    expect(refs(await searchBible('sábado', ['spa_r09']))).toEqual(sabado);
  });

  it('finds every word of a search, in any order', async () => {
    const hits = await searchBible('neighbor love', ['BSB']);
    expect(refs(hits)).toEqual(expect.arrayContaining(['LEV 19:18', 'MAT 22:39', 'ROM 13:9']));
    expect(hits.length).toBeLessThan(30);
    // A footnote between two phrases is a space, as in the reader.
    expect(hits.find(({ bookId, chapter, verse }) => `${bookId} ${chapter}:${verse}` === 'LEV 19:18')?.text).toMatch(
      /as yourself\. I am the LORD\.$/,
    );
  });

  it('matches Chinese in either script, across the space before 神 and punctuation', async () => {
    // Traditional in the Simplified text, and Simplified in the Traditional.
    expect(refs(await searchBible('愛', ['cmn_cu1']))).toContain('JHN 3:16');
    const love = refs(await searchBible('爱', ['cmn_cuv']));
    expect(love).toHaveLength(822);
    expect(love).toContain('JHN 3:16');
    expect(refs(await searchBible('愛', ['cmn_cuv']))).toEqual(love);
    // Typed in Simplified, which the Traditional converter would change again
    // (么 alone to 幺); 1919 writes "what" 甚麼.
    expect(refs(await searchBible('甚么', ['cmn_cu1'])).length).toBeGreaterThan(100);
    expect(refs(await searchBible('甚么', ['cmn_cuv']))).toEqual(refs(await searchBible('甚麼', ['cmn_cuv'])));
    expect(refs(await searchBible('果子么', ['cmn_cu1']))).toEqual(['GEN 3:1', 'GEN 3:11']);
    // The CUV's own spelling of a rare character, as the CUVS has it (陈).
    const wormwood = refs(await searchBible('茵蔯', ['cmn_cuv']));
    expect(wormwood).toHaveLength(9);
    expect(wormwood).toEqual(refs(await searchBible('茵陈', ['cmn_cuv'])));
    // 1919 puts a full-width space before 神: 耶和華你的　神.
    expect(refs(await searchBible('你的神', ['cmn_cu1']))).toContain('GEN 27:20');
    // And 、 between phrases: 我兒、你如何.
    expect(refs(await searchBible('我兒你如何', ['cmn_cuv']))).toEqual(['GEN 27:20']);
    expect(refs(await searchBible('安息日', ['cmn_cuv']))).toContain('EXO 20:8');
  });

  it('converts a Chinese query as the CUVS was converted, so every CUV verse folds to its CUVS verse', async () => {
    const simplified = new Map(
      (await readTranslationVerseTexts('cmn_cu1')).map((verse) => [`${verse.bookId} ${verse.chapter}:${verse.verse}`, verse.text]),
    );
    const differ = (await readTranslationVerseTexts('cmn_cuv'))
      .filter((verse) => {
        const copy = simplified.get(`${verse.bookId} ${verse.chapter}:${verse.verse}`) ?? '';
        return foldChineseText(verse.text) !== copy.replace(/[^\p{Script=Han}\p{L}\p{N}]/gu, '');
      })
      .map(({ bookId, chapter, verse }) => `${bookId} ${chapter}:${verse}`);
    expect(differ).toEqual([]);
  });

  it('finds a verse from any of its characters, as the CUV or the CUVS prints it, in either reader', async () => {
    // The CUVS converted these in context, unlike one typed alone: 藉著 借着,
    // 彷彿 仿佛, 鍊子 链子, 回覆 回复, 甦醒 苏醒, 籌畫 筹划.
    for (const [typed, ref] of [
      ['藉', 'GEN 23:20'], ['彷', 'EXO 20:4'], ['鍊', 'GEN 41:42'],
      ['覆', 'EXO 19:8'], ['甦', 'GEN 45:27'], ['畫', '1SA 25:17'],
    ]) {
      expect(refs(await searchBible(typed, ['cmn_cuv']))).toContain(ref);
      expect(refs(await searchBible(typed, ['cmn_cu1']))).toContain(ref);
    }
    const translations = await Promise.all(['cmn_cuv', 'cmn_cu1'].map(loadSearchableTranslation));
    const formsOf = new Map<string, readonly string[]>();
    const missed: string[] = [];
    for (const { verses } of translations) {
      for (const searched of translations) {
        verses.forEach((verse) => {
          const folded = searched.folded[searched.indexOf.get(`${verse.bookId} ${verse.chapter}:${verse.verse}`) ?? -1] ?? '';
          for (const character of new Set(verse.text.match(/\p{Script=Han}/gu))) {
            if (!formsOf.has(character)) {
              const [term] = parseSearchTerms(character);
              formsOf.set(character, term?.kind === 'han' ? term.forms : []);
            }
            if (!formsOf.get(character)?.some((form) => folded.includes(form))) {
              missed.push(`${verse.bookId} ${verse.chapter}:${verse.verse} ${character}`);
            }
          }
        });
      }
    }
    expect(missed).toEqual([]);
  });

  it('searches both translations in dual-language reading, showing both', async () => {
    expect(await searchBible('love neighbor', ['cmn_cuv', 'BSB'])).toHaveLength(14);
    const hits = await searchBible('Moriah', ['cmn_cuv', 'BSB']);
    expect(refs(hits)).toEqual(['GEN 22:2', '2CH 3:1']);
    expect(hits[0].text).toContain('摩利亞');
    expect(hits[0].supportingText).toContain('Moriah');
  });

  it('finds nothing for an empty search', async () => {
    expect(await searchBible('  ', ['BSB'])).toEqual([]);
    expect(parseSearchTerms(' , ')).toEqual([]);
    expect(parseSearchTerms('果子么 愛')).toEqual([
      { kind: 'han', forms: ['果子么', '果子幺'] },
      { kind: 'han', forms: ['愛', '爱'] },
    ]);
    expect(foldChineseText('起初　神創造天地。')).toBe('起初神创造天地');
  });
});

describe('whole-Bible search results', () => {
  const optionsFor = async (translationId: string, bookId: string, chapter: number): Promise<BibleSearchOptions> => ({
    translationIds: [translationId],
    books: await fetchBooks(translationId),
    bookId,
    chapter,
    onOpen: () => undefined,
  });
  const rowsFor = async (
    query: string,
    translationId: string,
    bookId: string,
    chapter: number,
    language: SupportedLanguage = 'en',
  ) =>
    buildBibleSearchRows({
      query,
      hits: await searchBible(query, [translationId]),
      options: await optionsFor(translationId, bookId, chapter),
      language,
    });

  it('show the open chapter first, then the whole Bible by book, with counts', async () => {
    const rows = await rowsFor('Moriah', 'BSB', 'GEN', 22);
    expect(rows.map(({ kind, title }) => `${kind}: ${title}`)).toEqual([
      'header: This chapter · 1 verse',
      'verse: Genesis 22:2',
      'header: Whole Bible · 2 verses',
      'header: Genesis · 1',
      'verse: Genesis 22:2',
      'header: 2 Chronicles · 1',
      'verse: 2 Chronicles 3:1',
    ]);
    expect(rows[1]).toMatchObject({ reference: { bookId: 'GEN', chapter: 22, verseStart: 2, verseEnd: 2 } });
  });

  it('offer a reference to open, in the short forms people type', async () => {
    const rows = await rowsFor('約3：16', 'cmn_cuv', 'GEN', 1, 'zh');
    expect(rows[0]).toMatchObject({
      kind: 'reference',
      title: '前往 約翰福音 3:16',
      reference: { bookId: 'JHN', chapter: 3, verseStart: 16 },
    });
    expect((await rowsFor('Jn 3:16', 'BSB', 'GEN', 1))[0]).toMatchObject({ title: 'Go to John 3:16' });
    expect((await rowsFor('Sal 23', 'spa_r09', 'GEN', 1, 'es'))[0]).toMatchObject({ title: 'Ir a Salmos 23' });
    // A chapter the book doesn't have isn't offered.
    expect((await rowsFor('Jude 2:1', 'BSB', 'GEN', 1)).some(({ kind }) => kind === 'reference')).toBe(false);
  });

  it('treat a book abbreviation with no number as a word, as 可 and 路 are in Chinese', async () => {
    const rows = await rowsFor('路', 'cmn_cuv', 'GEN', 1, 'zh');
    expect(rows.some(({ kind }) => kind === 'reference')).toBe(false);
    expect(rows.filter(({ kind }) => kind === 'verse').length).toBeGreaterThan(100);
  });

  it('say when nothing is found, and when the first search is still reading', async () => {
    const options = await optionsFor('BSB', 'GEN', 1);
    expect(buildBibleSearchRows({ query: 'xyzzy', hits: [], options, language: 'en' })).toEqual([
      { kind: 'status', key: 'none', title: 'No verses found' },
    ]);
    expect(buildBibleSearchRows({ query: 'love', hits: null, options, language: 'es' })).toEqual([
      { kind: 'status', key: 'searching', title: 'Buscando…' },
    ]);
  });
});
