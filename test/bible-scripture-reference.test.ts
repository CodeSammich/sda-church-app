import {
  createScriptureReferenceRequest,
  BIBLE_BOOK_NAMES,
  formatScriptureReference,
  getScriptureReaderParams,
  parseScriptureReference,
  resolveScriptureReference,
} from '@/services/BibleService';

describe('Bible scripture references', () => {
  it('creates a new request token for repeated navigation to the same verse', () => {
    expect(createScriptureReferenceRequest()).not.toBe(
      createScriptureReferenceRequest(),
    );
  });

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

  it('treats bare numbers in one-chapter books as verse references', () => {
    expect(parseScriptureReference('Jude 9')).toEqual({
      bookId: 'JUD',
      chapter: 1,
      verseStart: 9,
      verseEnd: 9,
    });
    expect(parseScriptureReference('猶大書 9–11')).toEqual({
      bookId: 'JUD',
      chapter: 1,
      verseStart: 9,
      verseEnd: 11,
    });
    expect(parseScriptureReference('Philemon 6')).toEqual({
      bookId: 'PHM',
      chapter: 1,
      verseStart: 6,
      verseEnd: 6,
    });
    expect(parseScriptureReference('2 John 4')).toEqual({
      bookId: '2JN',
      chapter: 1,
      verseStart: 4,
      verseEnd: 4,
    });
    expect(parseScriptureReference('Obadiah 12')).toEqual({
      bookId: 'OBA',
      chapter: 1,
      verseStart: 12,
      verseEnd: 12,
    });
    expect(parseScriptureReference('3 John 5')).toEqual({
      bookId: '3JN',
      chapter: 1,
      verseStart: 5,
      verseEnd: 5,
    });
  });

  it('keeps explicit chapter and verse notation authoritative', () => {
    expect(parseScriptureReference('Jude 1:9')).toEqual({
      bookId: 'JUD',
      chapter: 1,
      verseStart: 9,
      verseEnd: 9,
    });
  });

  it('opens chapter one when only a book name is supplied', () => {
    expect(parseScriptureReference('Jude')).toEqual({
      bookId: 'JUD',
      chapter: 1,
    });
    expect(parseScriptureReference('約翰福音')).toEqual({
      bookId: 'JHN',
      chapter: 1,
    });
  });

  it('uses the first passage in compound or cross-chapter input', () => {
    expect(parseScriptureReference('Psalms 15:1-16:2')).toEqual({
      bookId: 'PSA',
      chapter: 15,
      verseStart: 1,
      verseEnd: 1,
    });
    expect(parseScriptureReference('John 3:16; Romans 8:1')).toEqual({
      bookId: 'JHN',
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
    });
    expect(parseScriptureReference('John 3:16, 18, 20')).toEqual({
      bookId: 'JHN',
      chapter: 3,
      verseStart: 16,
      verseEnd: 16,
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

  it('rejects unsupported or backwards input before fallback resolution', () => {
    expect(parseScriptureReference('Unknown 1:1')).toBeNull();
    expect(parseScriptureReference('John 3:16-10')).toBeNull();
    expect(parseScriptureReference('John 3-5')).toBeNull();
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
