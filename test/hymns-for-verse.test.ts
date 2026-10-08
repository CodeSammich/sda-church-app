import { getSortedHymns } from '@/features/hymnal/EnglishHymnal';
import { getEnglishHymnsForVerse } from '@/features/hymnal/HymnsForVerse';
import { parseScriptureReference } from '@/services/BibleService';

describe('the hymns on a Bible verse', () => {
  const numbers = (bookId: string, chapter: number, verse: number) =>
    getEnglishHymnsForVerse(bookId, chapter, verse).map(({ number }) => number);

  it("reads every English hymn's scripture reference", () => {
    const references = getSortedHymns().filter(({ scriptureReference }) => scriptureReference);
    expect(references.length).toBeGreaterThan(150);
    for (const { number, scriptureReference } of references) {
      expect([number, parseScriptureReference(scriptureReference)]).not.toEqual([number, null]);
    }
  });

  it('finds the hymns whose verses include it, in number order', () => {
    // SDAH 1 is on Psalm 103:2-5, and SDAH 4 on all of Psalm 103.
    expect(numbers('PSA', 103, 3)).toEqual([1, 4]);
    expect(numbers('PSA', 103, 1)).toEqual([4]);
    // Revelation 21:4 itself, and 21:1-4.
    expect(numbers('REV', 21, 4)).toEqual([436, 437, 443, 446]);
    expect(numbers('REV', 21, 5)).toEqual([]);
  });

  it('counts a whole-chapter reference for every verse in the chapter', () => {
    expect(numbers('PSA', 23, 1)).toEqual([104, 197, 513, 546, 552]);
    expect(numbers('PSA', 23, 6)).toEqual([104, 197, 513, 546, 552]);
    expect(numbers('PSA', 24, 1)).not.toContain(104);
  });

  it('finds nothing for a verse no hymn names', () => {
    expect(numbers('JHN', 3, 16)).toEqual([]);
  });
});
