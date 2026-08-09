import mappingData from '@/constants/HymnalNumberMappings.json';
import chinese505Data from '@/constants/Chinese505Hymnal.json';
import { SDA_HYMNAL_1985 } from '@/constants/EnglishHymnal';
import {
  getChinese505NumbersForSDAH1985,
  getSDAH1985NumbersForChinese505,
} from '@/constants/HymnalNumberMappings';

describe('hymnal number mappings', () => {
  type NumberMap = Record<string, number[] | null | undefined>;
  const forwardMapping = mappingData.mappings.find(
    ({ sourceHymnalId, targetHymnalId }) =>
      sourceHymnalId === 'sdah-1985-en' && targetHymnalId === 'chinese-hymnal-505',
  );
  const reverseMapping = mappingData.mappings.find(
    ({ sourceHymnalId, targetHymnalId }) =>
      sourceHymnalId === 'chinese-hymnal-505' && targetHymnalId === 'sdah-1985-en',
  );

  it('contains the photographed English 1985 to Chinese 505 cross-reference', () => {
    expect(forwardMapping).toBeDefined();
    expect(forwardMapping?.numberMap).toMatchObject({
      '1': [5],
      '2': null,
      '86': null,
      '663': [505],
      '694': [497],
    });
    expect(forwardMapping?.transcriptionReview).toMatchObject({
      status: 'confirmed',
      uncertainCells: [],
      confirmations: [
        expect.objectContaining({ sourceNumber: 461, transcribedTargetNumbers: null }),
      ],
    });
  });

  it('only references hymn numbers in the declared editions', () => {
    expect(forwardMapping).toBeDefined();

    for (const [sourceNumber, targetNumbers] of Object.entries(
      forwardMapping!.numberMap,
    )) {
      expect(SDA_HYMNAL_1985.en[Number(sourceNumber)]).toBeDefined();

      for (const targetNumber of targetNumbers ?? []) {
        expect(targetNumber).toBeGreaterThanOrEqual(1);
        expect(targetNumber).toBeLessThanOrEqual(505);
      }
    }
  });

  it('distinguishes explicit asterisks from missing source rows', () => {
    expect(forwardMapping?.numberMap['2']).toBeNull();
    expect(forwardMapping?.numberMap).not.toHaveProperty('3');
    expect(getChinese505NumbersForSDAH1985(2)).toBeNull();
    expect(getChinese505NumbersForSDAH1985(3)).toBeUndefined();
  });

  it('looks up photographed pairs in both directions', () => {
    expect(reverseMapping).toBeDefined();
    expect(reverseMapping?.numberMap).toMatchObject({
      '1': [82],
      '5': [1],
      '497': [694],
      '505': [663],
    });
    expect(getChinese505NumbersForSDAH1985(1)).toEqual([5]);
    expect(getSDAH1985NumbersForChinese505(5)).toEqual([1]);
    expect(getChinese505NumbersForSDAH1985(663)).toEqual([505]);
    expect(getSDAH1985NumbersForChinese505(505)).toEqual([663]);
    expect(getChinese505NumbersForSDAH1985(694)).toEqual([497]);
    expect(getSDAH1985NumbersForChinese505(497)).toEqual([694]);
  });

  it('keeps the two explicit mapping entries as exact inverses', () => {
    expect(forwardMapping).toBeDefined();
    expect(reverseMapping).toBeDefined();

    for (const [englishNumber, chineseNumbers] of Object.entries(
      forwardMapping!.numberMap,
    )) {
      for (const chineseNumber of chineseNumbers ?? []) {
        expect(
          (reverseMapping!.numberMap as NumberMap)[chineseNumber.toString()],
        ).toContain(
          Number(englishNumber),
        );
      }
    }

    for (const [chineseNumber, englishNumbers] of Object.entries(
      reverseMapping!.numberMap,
    )) {
      for (const englishNumber of englishNumbers ?? []) {
        expect(
          (forwardMapping!.numberMap as NumberMap)[englishNumber.toString()],
        ).toContain(
          Number(chineseNumber),
        );
      }
    }
  });

  it('permits source mappings to Chinese hymns whose online page is unavailable', () => {
    const unavailableOnlineHymns = new Set(['90', '193', '201', '206', '307']);
    const mappedTargetNumbers = Object.values(forwardMapping!.numberMap)
      .flatMap((targetNumbers) => targetNumbers ?? [])
      .map(String);

    expect(mappedTargetNumbers.some((number) => unavailableOnlineHymns.has(number))).toBe(
      true,
    );
    expect(Object.keys(chinese505Data)).toHaveLength(500);
  });
});
