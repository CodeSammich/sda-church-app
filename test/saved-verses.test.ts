import {
  groupSavedVerses,
  type SavedVerseReference,
} from '@/services/SavedVersesService';

const saved = (
  bookId: string,
  chapter: number,
  verse: number,
  savedAt: number,
): SavedVerseReference => ({ bookId, chapter, verse, savedAt });

describe('saved verse grouping and sorting', () => {
  const bookOrder = ['GEN', 'EXO', 'JHN'];
  const verses = [
    saved('JHN', 3, 17, 500),
    saved('GEN', 2, 2, 300),
    saved('GEN', 2, 1, 200),
    saved('GEN', 2, 4, 600),
    saved('EXO', 1, 1, 100),
  ];

  it('combines sequential verses from the same book and chapter', () => {
    const groups = groupSavedVerses(verses, bookOrder, 'bible');

    expect(groups.map(({ bookId, chapter, verseStart, verseEnd }) => ({
      bookId,
      chapter,
      verseStart,
      verseEnd,
    }))).toEqual([
      { bookId: 'GEN', chapter: 2, verseStart: 1, verseEnd: 2 },
      { bookId: 'GEN', chapter: 2, verseStart: 4, verseEnd: 4 },
      { bookId: 'EXO', chapter: 1, verseStart: 1, verseEnd: 1 },
      { bookId: 'JHN', chapter: 3, verseStart: 17, verseEnd: 17 },
    ]);
  });

  it('sorts groups by their most recently saved verse by default', () => {
    const groups = groupSavedVerses(verses, bookOrder);

    expect(groups.map((group) => `${group.bookId}:${group.verseStart}-${group.verseEnd}`))
      .toEqual(['GEN:4-4', 'JHN:17-17', 'GEN:1-2', 'EXO:1-1']);
  });
});
