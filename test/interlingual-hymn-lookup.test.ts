import {
  getHymnLookupMaximum,
  lookupEquivalentHymnNumbers,
} from '@/features/hymnal/InterlingualHymnLookup';

describe('interlingual hymn lookup', () => {
  it('looks up equivalents in both directions', () => {
    expect(lookupEquivalentHymnNumbers('englishToChinese', '1')).toEqual({
      status: 'matched',
      targetNumbers: [5],
    });
    expect(lookupEquivalentHymnNumbers('chineseToEnglish', '5')).toEqual({
      status: 'matched',
      targetNumbers: [1],
    });
  });

  it('keeps high-numbered matches from the source sheets', () => {
    expect(lookupEquivalentHymnNumbers('englishToChinese', '694')).toEqual({
      status: 'matched',
      targetNumbers: [497],
    });
  });

  it('distinguishes missing equivalents from invalid numbers', () => {
    expect(lookupEquivalentHymnNumbers('englishToChinese', '2').status).toBe(
      'notListed',
    );
    expect(lookupEquivalentHymnNumbers('englishToChinese', '3').status).toBe(
      'notListed',
    );
    expect(lookupEquivalentHymnNumbers('englishToChinese', '696').status).toBe(
      'outOfRange',
    );
    expect(lookupEquivalentHymnNumbers('chineseToEnglish', '506').status).toBe(
      'outOfRange',
    );
  });

  it('exposes the source edition limits', () => {
    expect(getHymnLookupMaximum('englishToChinese')).toBe(695);
    expect(getHymnLookupMaximum('chineseToEnglish')).toBe(505);
  });
});
