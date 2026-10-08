import mappingData from '@/features/hymnal/HymnalNumberMappings.json';
import chinese505Data from '@/features/hymnal/Chinese505Hymnal.json';
import { SDA_HYMNAL_1985 } from '@/features/hymnal/EnglishHymnal';
import {
  getHymnalCrossReferences,
  getHymnEquivalents,
  HYMNAL_CROSS_REFERENCE_TABLES,
  invertNumberMap,
} from '@/features/hymnal/HymnalNumberMappings';

const toChinese505 = (englishNumber: number) =>
  getHymnalCrossReferences('sdah-1985-en', englishNumber, 'chinese-hymnal-505');
const toSDAH1985 = (chineseNumber: number) =>
  getHymnalCrossReferences('chinese-hymnal-505', chineseNumber, 'sdah-1985-en');

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
    expect(toChinese505(2)).toBeNull();
    expect(toChinese505(3)).toBeUndefined();
  });

  it('looks up photographed pairs in both directions', () => {
    expect(reverseMapping).toBeDefined();
    expect(reverseMapping?.numberMap).toMatchObject({
      '1': [82],
      '5': [1],
      '497': [694],
      '505': [663],
    });
    expect(toChinese505(1)).toEqual([5]);
    expect(toSDAH1985(5)).toEqual([1]);
    expect(toChinese505(663)).toEqual([505]);
    expect(toSDAH1985(505)).toEqual([663]);
    expect(toChinese505(694)).toEqual([497]);
    expect(toSDAH1985(497)).toEqual([694]);
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
    const unavailableOnlineHymns = new Set(['90', '194', '201', '207', '307', '370']);
    const mappedTargetNumbers = Object.values(forwardMapping!.numberMap)
      .flatMap((targetNumbers) => targetNumbers ?? [])
      .map(String);

    expect(mappedTargetNumbers.some((number) => unavailableOnlineHymns.has(number))).toBe(
      true,
    );
    expect(Object.keys(chinese505Data)).toHaveLength(499);
  });

  it('reads both directions as one table in the registry', () => {
    expect(HYMNAL_CROSS_REFERENCE_TABLES).toHaveLength(1);
    expect(HYMNAL_CROSS_REFERENCE_TABLES[0].hymnalIds).toEqual([
      'sdah-1985-en',
      'chinese-hymnal-505',
    ]);
    expect(getHymnEquivalents('sdah-1985-en', 694)).toEqual([
      { hymnalId: 'chinese-hymnal-505', number: 497 },
    ]);
    expect(getHymnEquivalents('chinese-hymnal-505', '497')).toEqual([
      { hymnalId: 'sdah-1985-en', number: 694 },
    ]);
    // An asterisk, a missing row, and a hymnal no table has.
    expect(getHymnEquivalents('sdah-1985-en', 2)).toEqual([]);
    expect(getHymnEquivalents('sdah-1985-en', 3)).toEqual([]);
    expect(getHymnEquivalents('chinese-hymnal-506', 1)).toEqual([]);
    expect(getHymnalCrossReferences('chinese-hymnal-506', 1, 'sdah-1985-en')).toBeUndefined();
  });

  it('inverts a mapping given only one way, keeping several numbers and B arrangements', () => {
    expect(invertNumberMap({ '1': [5], '2': null, '3': [5, '260B'] })).toEqual({
      '5': [1, 3],
      '260B': [3],
    });
  });
});
