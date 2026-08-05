import {
  BIBLE_BOOK_NAMES,
  formatScriptureReference,
  getScriptureReaderParams,
  parseScriptureReference,
  resolveScriptureReference,
} from '@/services/BibleService';

describe('Bible scripture references', () => {
  it('parses an English verse range into canonical reader coordinates', () => {
    expect(parseScriptureReference('Psalms 15:1-5')).toEqual({
      bookId: 'PSA',
      chapter: 15,
      verseStart: 1,
      verseEnd: 5,
    });
  });

  it('parses numbered books and an optional translation suffix', () => {
    expect(parseScriptureReference('1 John 3:16 (KJV)')).toEqual({
      bookId: '1JN',
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
    });
  });

  it('accepts localized book names and punctuation', () => {
    expect(parseScriptureReference('詩篇 15：1–5')).toEqual({
      bookId: 'PSA',
      chapter: 15,
      verseStart: 1,
      verseEnd: 5,
    });
    expect(parseScriptureReference('Salmos 15:1-5')).toEqual({
      bookId: 'PSA',
      chapter: 15,
      verseStart: 1,
      verseEnd: 5,
    });
  });

  it('localizes a parsed reference without changing its coordinates', () => {
    const reference = parseScriptureReference('Psalms 15:1-5');
    expect(reference).not.toBeNull();
    expect(formatScriptureReference(reference!, 'zh')).toBe('詩篇 15:1-5');
    expect(formatScriptureReference(reference!, 'zh-cn')).toBe('诗篇 15:1-5');
    expect(formatScriptureReference(reference!, 'es')).toBe('Salmos 15:1-5');
  });

  it('routes non-English users to the corresponding translated verse range', () => {
    const reference = parseScriptureReference('Psalms 15:1-5');
    expect(getScriptureReaderParams(reference!, 'zh')).toEqual({
      translationId: 'cmn_cuv',
      bookId: 'PSA',
      chapter: '15',
      verseStart: '1',
      verseEnd: '5',
    });
    expect(getScriptureReaderParams(reference!, 'zh-cn').translationId).toBe(
      'cmn_cu1',
    );
    expect(getScriptureReaderParams(reference!, 'es').translationId).toBe('spa_r09');
  });

  it('provides a parseable name in every app language for all 66 books', () => {
    expect(Object.keys(BIBLE_BOOK_NAMES)).toHaveLength(66);
    Object.entries(BIBLE_BOOK_NAMES).forEach(([bookId, names]) => {
      Object.values(names).forEach((name) => {
        expect(parseScriptureReference(`${name} 1:1`)?.bookId).toBe(bookId);
      });
    });
  });

  it('rejects unsupported or cross-chapter input before fallback resolution', () => {
    expect(parseScriptureReference('Psalms 15:1-16:2')).toBeNull();
    expect(parseScriptureReference('Unknown 1:1')).toBeNull();
    expect(parseScriptureReference('John 3:16-10')).toBeNull();
  });

  it('resolves malformed user input to Genesis 1:1', () => {
    expect(resolveScriptureReference('not a valid reference')).toEqual({
      bookId: 'GEN',
      chapter: 1,
      verseStart: 1,
      verseEnd: 1,
    });
    expect(getScriptureReaderParams(resolveScriptureReference('???'), 'zh-cn')).toEqual({
      translationId: 'cmn_cu1',
      bookId: 'GEN',
      chapter: '1',
      verseStart: '1',
      verseEnd: '1',
    });
  });
});
