import { getSortedHymns } from '@/features/hymnal/EnglishHymnal';
import {
  formatHymnScriptureReference,
  getHymnScriptureReference,
  getHymnsForVerse,
} from '@/features/hymnal/HymnScripture';
import { parseScriptureReference } from '@/services/BibleService';

describe('the hymns on a Bible verse', () => {
  // The English hymns' numbers, as from an English translation.
  const numbers = (bookId: string, chapter: number, verse: number) =>
    getHymnsForVerse(bookId, chapter, verse, 'en')
      .filter(({ hymnalId }) => hymnalId === 'sdah-1985-en')
      .map(({ number }) => number);
  // Every hymn, as "hymnal:number".
  const listed = (bookId: string, chapter: number, verse: number, language: string) =>
    getHymnsForVerse(bookId, chapter, verse, language).map(
      ({ hymnalId, number }) => `${hymnalId}:${number}`,
    );

  it("reads every English hymn's scripture reference", () => {
    const references = getSortedHymns().filter(({ scriptureReference }) => scriptureReference);
    expect(references.length).toBeGreaterThan(150);
    for (const { number, scriptureReference } of references) {
      expect([number, parseScriptureReference(scriptureReference)]).not.toEqual([number, null]);
    }
  });

  it('finds the English hymns whose verses include it, in number order', () => {
    // SDAH 1 is on Psalm 103:2-5, and SDAH 4 on all of Psalm 103.
    expect(numbers('PSA', 103, 3)).toEqual([1, 4]);
    expect(numbers('PSA', 103, 1)).toEqual([4]);
    // Revelation 21:4 itself, and 21:1-4.
    expect(numbers('REV', 21, 4)).toEqual([436, 437, 443, 446]);
    expect(numbers('REV', 21, 5)).toEqual([]);
    expect(getHymnsForVerse('PSA', 103, 3, 'en')[0]).toEqual({
      hymnalId: 'sdah-1985-en',
      number: 1,
      title: 'Praise to the Lord',
      scriptureReference: 'Psalm 103:2-5',
    });
  });

  it('counts a whole-chapter reference for every verse in the chapter', () => {
    expect(numbers('PSA', 23, 1)).toEqual([104, 197, 513, 546, 552]);
    expect(numbers('PSA', 23, 6)).toEqual([104, 197, 513, 546, 552]);
    expect(numbers('PSA', 24, 1)).not.toContain(104);
  });

  it('adds the same hymns in the 505, the hymnal of the translation first', () => {
    // SDAH 1 is 505's 5; SDAH 4 has no 505 number.
    expect(listed('PSA', 103, 3, 'en')).toEqual([
      'sdah-1985-en:1',
      'sdah-1985-en:4',
      'chinese-hymnal-505:5',
    ]);
    expect(listed('PSA', 103, 3, 'zh')).toEqual([
      'chinese-hymnal-505:5',
      'sdah-1985-en:1',
      'sdah-1985-en:4',
    ]);
    expect(getHymnsForVerse('PSA', 103, 3, 'zh')[0]).toEqual({
      hymnalId: 'chinese-hymnal-505',
      number: 5,
      title: '赞美上主',
      scriptureReference: 'Psalm 103:2-5',
    });
    expect(listed('PSA', 23, 1, 'zh-cn').slice(0, 2)).toEqual([
      'chinese-hymnal-505:381',
      'chinese-hymnal-505:476',
    ]);
    // None of the four Revelation 21:4 hymns is in the 505.
    expect(listed('REV', 21, 4, 'zh')).toEqual(listed('REV', 21, 4, 'en'));
  });

  it('lists the English hymnal first for a translation with no hymnal of its own', () => {
    expect(listed('PSA', 103, 3, 'es')).toEqual(listed('PSA', 103, 3, 'en'));
  });

  it('finds nothing for a verse no hymn names', () => {
    expect(numbers('JHN', 3, 16)).toEqual([]);
  });
});

describe("a hymn's verse", () => {
  it("is an English hymn's own reference, or a 505 hymn's 1985 equivalent's", () => {
    expect(getHymnScriptureReference('sdah-1985-en', 1)).toBe('Psalm 103:2-5');
    expect(getHymnScriptureReference('sdah-1985-en', 2)).toBeUndefined();
    expect(getHymnScriptureReference('chinese-hymnal-505', 5)).toBe('Psalm 103:2-5');
    expect(getHymnScriptureReference('chinese-hymnal-505', 1)).toBe('Psalm 100');
    // The other Chinese hymnals have no cross-reference table yet.
    expect(getHymnScriptureReference('chinese-hymnal-506', 1)).toBeUndefined();
  });

  it("reads as written on an English hymn, and in the app's language on a 505 hymn", () => {
    expect(formatHymnScriptureReference('sdah-1985-en', 'Psalm 103:2-5', 'zh')).toBe('Psalm 103:2-5');
    expect(formatHymnScriptureReference('chinese-hymnal-505', 'Psalm 103:2-5', 'zh')).toBe('詩篇 103:2-5');
    expect(formatHymnScriptureReference('chinese-hymnal-505', 'Psalm 23', 'zh-cn')).toBe('诗篇 23');
    expect(formatHymnScriptureReference('chinese-hymnal-505', '1 Timothy 1:17', 'en')).toBe('1 Timothy 1:17');
  });
});
