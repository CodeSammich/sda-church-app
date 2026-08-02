import { formatHymnalScriptureReference } from '@/constants/EnglishHymnal';

describe('English hymnal scripture references', () => {
  it('keeps the visible reference concise without appending BSB', () => {
    expect(formatHymnalScriptureReference('Psalm 103:2-5')).toBe(
      'Psalm 103:2-5',
    );
    expect(formatHymnalScriptureReference(undefined)).toBeUndefined();
  });
});
