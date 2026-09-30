import { BIBLE_BOOK_NAMES, parseScriptureReference } from '@/services/BibleService';
import {
  VERSES_OF_THE_DAY,
  balanceQuotationMarks,
  getVerseOfTheDay,
  getVerseOfTheDayDateKey,
  getVerseOfTheDayStride,
  parseVerseReference,
} from '@/services/VerseOfTheDay';

// Each verse was checked against the live BSB, CUV, CUVS, and RVR 1909 text
// when it was added: it exists in all four and reads well on its own, not
// ending partway through a sentence. Check any verse added later the same way.
describe('the curated verses', () => {
  const bookOrder = Object.keys(BIBLE_BOOK_NAMES);
  const references = VERSES_OF_THE_DAY.map(parseVerseReference);

  it('are references to books the app knows', () => {
    for (const reference of references) {
      expect(bookOrder).toContain(reference.bookId);
      expect(reference.chapter).toBeGreaterThan(0);
      expect(reference.verse).toBeGreaterThan(0);
    }
  });

  it('are in Bible order with no repeats, so the list stays easy to review', () => {
    const position = (ref: (typeof references)[number]) => [
      bookOrder.indexOf(ref.bookId),
      ref.chapter,
      ref.verse,
    ];
    const sorted = [...references].sort((a, b) => {
      const [x, y] = [position(a), position(b)];
      return x[0] - y[0] || x[1] - y[1] || x[2] - y[2];
    });
    expect(references).toEqual(sorted);
    expect(new Set(VERSES_OF_THE_DAY).size).toBe(VERSES_OF_THE_DAY.length);
  });

  it('cover close to a year before any repeats', () => {
    expect(VERSES_OF_THE_DAY.length).toBeGreaterThanOrEqual(300);
  });
});

describe('the verse of the day', () => {
  it('is the same all day, for everyone, and changes at 6 AM', () => {
    const morning = getVerseOfTheDay(new Date(2026, 8, 29, 6, 0));
    expect(getVerseOfTheDay(new Date(2026, 8, 29, 23, 59))).toEqual(morning);
    expect(getVerseOfTheDay(new Date(2026, 8, 30, 5, 59))).toEqual(morning);
    expect(getVerseOfTheDay(new Date(2026, 8, 30, 6, 0))).not.toEqual(morning);
  });

  it('belongs to the previous day before 6 AM', () => {
    expect(getVerseOfTheDayDateKey(new Date(2026, 8, 29, 5, 59))).toBe('2026-9-28');
    expect(getVerseOfTheDayDateKey(new Date(2026, 8, 29, 6, 0))).toBe('2026-9-29');
    expect(getVerseOfTheDayDateKey(new Date(2026, 0, 1, 1, 0))).toBe('2025-12-31');
  });

  it('shows every verse once before any repeats', () => {
    const seen = new Set<string>();
    for (let day = 0; day < VERSES_OF_THE_DAY.length; day += 1) {
      const { bookId, chapter, verse } = getVerseOfTheDay(new Date(2026, 0, 1 + day, 12));
      seen.add(`${bookId} ${chapter}:${verse}`);
    }
    expect(seen.size).toBe(VERSES_OF_THE_DAY.length);
  });

  it('comes from a different book than the day before, almost always', () => {
    let sameBook = 0;
    for (let day = 0; day < 365; day += 1) {
      const today = getVerseOfTheDay(new Date(2026, 0, 1 + day, 12));
      const tomorrow = getVerseOfTheDay(new Date(2026, 0, 2 + day, 12));
      if (today.bookId === tomorrow.bookId) sameBook += 1;
    }
    // The Psalms alone are about a third of the list.
    expect(sameBook).toBeLessThan(365 * 0.2);
  });

  it('steps through the list with a stride that shares no factor with its length', () => {
    for (const length of [300, 350, 351, 97 * 4]) {
      const stride = getVerseOfTheDayStride(length);
      const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
      expect(gcd(stride, length)).toBe(1);
    }
  });
});

describe('quotation marks in a verse shown alone', () => {
  it('drops a closing mark whose quote opened in an earlier verse', () => {
    expect(balanceQuotationMarks('The LORD will fight for you; you need only to be still.”')).toBe(
      'The LORD will fight for you; you need only to be still.',
    );
  });

  it('drops an opening mark whose quote closes in a later verse', () => {
    expect(balanceQuotationMarks('“I know that You can do all things')).toBe(
      'I know that You can do all things',
    );
  });

  it('closes a quote the verse opens partway through', () => {
    expect(balanceQuotationMarks('Jesus answered, “I am the way and the truth and the life.')).toBe(
      'Jesus answered, “I am the way and the truth and the life.”',
    );
    expect(balanceQuotationMarks('耶穌說：「我就是道路、真理、生命。')).toBe(
      '耶穌說：「我就是道路、真理、生命。」',
    );
  });

  it('opens a quote the verse closes partway through', () => {
    expect(balanceQuotationMarks('My covenant will not be broken,” says the LORD.')).toBe(
      '“My covenant will not be broken,” says the LORD.',
    );
  });

  it('leaves balanced quotes and apostrophes alone', () => {
    const verse = '“Come now, let us reason together,” says the LORD. God’s word stands.';
    expect(balanceQuotationMarks(verse)).toBe(verse);
  });
});

describe('Nahum', () => {
  it('uses the book code the Bible services use', () => {
    // The services call Nahum NAM; NAH found no chapters, audio, or original text.
    expect(parseScriptureReference('Nahum 1:7')).toEqual({
      bookId: 'NAM',
      chapter: 1,
      verseStart: 7,
      verseEnd: 7,
    });
    expect(BIBLE_BOOK_NAMES.NAM.en).toBe('Nahum');
  });
});
