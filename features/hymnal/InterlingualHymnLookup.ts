import {
  getChinese505NumbersForSDAH1985,
  getSDAH1985NumbersForChinese505,
} from './HymnalNumberMappings';

export type HymnLookupDirection = 'englishToChinese' | 'chineseToEnglish';

export type HymnLookupResult =
  | { status: 'empty'; targetNumbers: [] }
  | { status: 'outOfRange'; targetNumbers: [] }
  | { status: 'notListed'; targetNumbers: [] }
  | { status: 'matched'; targetNumbers: number[] };

export const getHymnLookupMaximum = (direction: HymnLookupDirection) =>
  direction === 'englishToChinese' ? 695 : 505;

export const lookupEquivalentHymnNumbers = (
  direction: HymnLookupDirection,
  query: string,
): HymnLookupResult => {
  if (!query) return { status: 'empty', targetNumbers: [] };

  const sourceNumber = Number(query);
  if (
    !Number.isInteger(sourceNumber) ||
    sourceNumber < 1 ||
    sourceNumber > getHymnLookupMaximum(direction)
  ) {
    return { status: 'outOfRange', targetNumbers: [] };
  }

  const targetNumbers =
    direction === 'englishToChinese'
      ? getChinese505NumbersForSDAH1985(sourceNumber)
      : getSDAH1985NumbersForChinese505(sourceNumber);

  return Array.isArray(targetNumbers) && targetNumbers.length > 0
    ? { status: 'matched', targetNumbers: [...targetNumbers] }
    : { status: 'notListed', targetNumbers: [] };
};
