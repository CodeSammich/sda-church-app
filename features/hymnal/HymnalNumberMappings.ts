/**
 * Bidirectional hymn-number cross references.
 *
 * Each supported direction is explicit in the JSON so non-TypeScript consumers
 * can use the same data directly.
 */

import mappingData from './HymnalNumberMappings.json';

export type HymnalId = keyof typeof mappingData.hymnals;
export type HymnalCrossReference = readonly number[] | null | undefined;

type NumberMap = Record<string, number[] | null>;
type HymnalMapping = {
  sourceHymnalId: HymnalId;
  targetHymnalId: HymnalId;
  numberMap: NumberMap;
};

const mappings = mappingData.mappings as unknown as HymnalMapping[];

/**
 * Returns mapped hymn numbers, `null` for a photographed asterisk, or
 * `undefined` when the photographed table has no row for the supplied number.
 */
export const getHymnalCrossReferences = (
  sourceHymnalId: HymnalId,
  sourceNumber: number,
  targetHymnalId: HymnalId,
): HymnalCrossReference => {
  const mapping = mappings.find(
    (mapping) =>
      mapping.sourceHymnalId === sourceHymnalId &&
      mapping.targetHymnalId === targetHymnalId,
  );

  if (mapping) {
    const key = sourceNumber.toString();
    return Object.prototype.hasOwnProperty.call(mapping.numberMap, key)
      ? mapping.numberMap[key]
      : undefined;
  }

  return undefined;
};

export const getChinese505NumbersForSDAH1985 = (englishNumber: number) =>
  getHymnalCrossReferences('sdah-1985-en', englishNumber, 'chinese-hymnal-505');

export const getSDAH1985NumbersForChinese505 = (chineseNumber: number) =>
  getHymnalCrossReferences('chinese-hymnal-505', chineseNumber, 'sdah-1985-en');
