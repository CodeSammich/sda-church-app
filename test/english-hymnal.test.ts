import {
  formatHymnalScriptureReference,
  getEnglishHymnUrl,
} from '@/constants/EnglishHymnal';

describe('English hymnal scripture references', () => {
  it('keeps the visible reference concise without appending BSB', () => {
    expect(formatHymnalScriptureReference('Psalm 103:2-5')).toBe(
      'Psalm 103:2-5',
    );
    expect(formatHymnalScriptureReference(undefined)).toBeUndefined();
  });

  it('opens a hymn page at its sheet-music section', () => {
    expect(getEnglishHymnUrl(1)).toBe(
      'https://hymnsforworship.org/sdah-001#hymn-score',
    );
    expect(getEnglishHymnUrl('214')).toBe(
      'https://hymnsforworship.org/sdah-214#hymn-score',
    );
  });

  it('keeps the hymnal directory as the fallback destination', () => {
    expect(getEnglishHymnUrl()).toBe(
      'https://hymnsforworship.org/sda-hymnal/the-seventh-day-adventist-hymnal-1985-edition/',
    );
  });
});
