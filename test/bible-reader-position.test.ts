import {
  getTopVisibleVerse,
  getTranslationSwitchPosition,
  isNewReaderLink,
  isSameChapter,
} from '@/services/BibleReaderPosition';

// Verse positions as the reader records them: each verse's top, in the scroll
// view's content coordinates.
const positions = { 1: 120, 2: 180, 3: 260, 4: 400, 5: 470 };

describe('the verse at the top of the Bible reader', () => {
  it('is the verse that starts closest above the top edge', () => {
    expect(getTopVisibleVerse(positions, 260)).toBe(3);
    expect(getTopVisibleVerse(positions, 399)).toBe(3);
    expect(getTopVisibleVerse(positions, 10_000)).toBe(5);
  });

  it('is none at the top of the chapter, where there is nothing to restore', () => {
    expect(getTopVisibleVerse(positions, 0)).toBeNull();
    expect(getTopVisibleVerse(positions, 150)).toBeNull();
    expect(getTopVisibleVerse({}, 500)).toBeNull();
  });

  it('does not depend on the order verses were laid out', () => {
    expect(getTopVisibleVerse({ 5: 470, 2: 180, 4: 400 }, 420)).toBe(4);
  });
});

describe('the position a translation switch keeps', () => {
  const romans8 = { bookId: 'ROM', chapter: 8 };

  it('is the verse at the top of the reader, in the new translation', () => {
    expect(getTranslationSwitchPosition('BSB', romans8, 28, null, true)).toEqual({
      translationId: 'BSB',
      bookId: 'ROM',
      chapter: 8,
      verse: 28,
    });
  });

  it('is none at the top of the chapter', () => {
    expect(getTranslationSwitchPosition('BSB', romans8, null, null, true)).toBeNull();
  });

  it('carries over to a second switch made before the chapter loads', () => {
    const first = { translationId: 'BSB', bookId: 'ROM', chapter: 8, verse: 28 };
    // No verse is on screen while the chapter loads.
    expect(getTranslationSwitchPosition('cmn_cuv', romans8, null, first, false)).toEqual({
      ...first,
      translationId: 'cmn_cuv',
    });
  });

  it('is none after moving to another chapter that is still loading', () => {
    const first = { translationId: 'BSB', bookId: 'ROM', chapter: 8, verse: 28 };
    expect(
      getTranslationSwitchPosition('cmn_cuv', { bookId: 'ROM', chapter: 9 }, null, first, false),
    ).toBeNull();
  });

  it('comes from the screen, not an older switch, once the chapter shows', () => {
    const older = { translationId: 'BSB', bookId: 'ROM', chapter: 8, verse: 28 };
    expect(getTranslationSwitchPosition('cmn_cuv', romans8, 31, older, true)?.verse).toBe(31);
    expect(getTranslationSwitchPosition('cmn_cuv', romans8, null, older, true)).toBeNull();
  });

  it('compares book and chapter only', () => {
    expect(isSameChapter({ bookId: 'ROM', chapter: 8 }, { bookId: 'ROM', chapter: 8 })).toBe(true);
    expect(isSameChapter({ bookId: 'ROM', chapter: 8 }, { bookId: 'JHN', chapter: 8 })).toBe(false);
  });
});

describe('links into the Bible reader', () => {
  it('open their book and chapter once, so a later book reload keeps the reader where it is', () => {
    const link = 'BSB:JHN:3:request-1';
    expect(isNewReaderLink(link, null)).toBe(true);
    // Applied; the books reload after a translation switch.
    expect(isNewReaderLink(link, link)).toBe(false);
  });

  it('open again when followed again, since each tap has its own request token', () => {
    expect(isNewReaderLink('BSB:JHN:3:request-2', 'BSB:JHN:3:request-1')).toBe(true);
  });

  it('are ignored when the reader was opened without one', () => {
    expect(isNewReaderLink(null, null)).toBe(false);
  });
});
