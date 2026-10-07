/**
 * Bidirectional hymn-number cross references.
 *
 * Each supported direction is explicit in the JSON so non-TypeScript consumers
 * can use the same data directly. The app reads it all through
 * HYMNAL_CROSS_REFERENCE_TABLES, so a new mapping in the JSON needs no code:
 * see "Adding a cross-reference" in
 * docs/feature_designs/hymnal_integration_design.md.
 */

import { HYMNAL_LABELS, type HymnalBookId } from './HymnalLabels';
import mappingData from './HymnalNumberMappings.json';

export type HymnalId = keyof typeof mappingData.hymnals;
/** A hymn number: 707 has a few, such as 260B, that aren't plain numbers. */
export type HymnNumber = number | string;
export type HymnalCrossReference = readonly HymnNumber[] | null | undefined;

type NumberMap = Readonly<Record<string, readonly HymnNumber[] | null>>;
type HymnalMapping = {
  sourceHymnalId: string;
  targetHymnalId: string;
  numberMap: NumberMap;
};

/**
 * One cross-reference table: two hymnals, and each one's numbers in the
 * other. A number maps to a list, which may hold several hymns, or to `null`
 * where the source prints an asterisk.
 */
export type HymnalCrossReferenceTable = Readonly<{
  hymnalIds: readonly [HymnalBookId, HymnalBookId];
  /** The first hymnal's numbers in the second, then the second's in the first. */
  numberMaps: readonly [NumberMap, NumberMap];
}>;

const isHymnalBookId = (value: string): value is HymnalBookId =>
  Object.prototype.hasOwnProperty.call(HYMNAL_LABELS, value);

const readNumbers = (map: NumberMap, hymnNumber: HymnNumber) => {
  const key = hymnNumber.toString();
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
};

/** The other direction of a mapping, for a table whose source gives only one. */
export const invertNumberMap = (map: NumberMap): NumberMap => {
  const inverse: Record<string, HymnNumber[]> = {};
  for (const [sourceNumber, targetNumbers] of Object.entries(map)) {
    for (const targetNumber of targetNumbers ?? []) {
      (inverse[targetNumber.toString()] ??= []).push(
        /^\d+$/.test(sourceNumber) ? Number(sourceNumber) : sourceNumber,
      );
    }
  }
  return inverse;
};

/**
 * Every cross-reference table: each pair of hymnals the JSON maps, both ways.
 * A pair mapped only one way gets the inverse for the other way. Mappings
 * between hymnals the app doesn't list are left out.
 */
export const HYMNAL_CROSS_REFERENCE_TABLES: HymnalCrossReferenceTable[] = (() => {
  const pairs: {
    hymnalIds: [HymnalBookId, HymnalBookId];
    numberMaps: [NumberMap | undefined, NumberMap | undefined];
  }[] = [];
  for (const { sourceHymnalId, targetHymnalId, numberMap } of
    mappingData.mappings as unknown as HymnalMapping[]) {
    if (!isHymnalBookId(sourceHymnalId) || !isHymnalBookId(targetHymnalId)) continue;
    let pair = pairs.find(({ hymnalIds }) =>
      hymnalIds.includes(sourceHymnalId) && hymnalIds.includes(targetHymnalId),
    );
    if (!pair) {
      pair = { hymnalIds: [sourceHymnalId, targetHymnalId], numberMaps: [undefined, undefined] };
      pairs.push(pair);
    }
    pair.numberMaps[pair.hymnalIds[0] === sourceHymnalId ? 0 : 1] = numberMap;
  }
  return pairs.map(({ hymnalIds, numberMaps: [forward, backward] }) => ({
    hymnalIds,
    numberMaps: [forward ?? invertNumberMap(backward!), backward ?? invertNumberMap(forward!)],
  }));
})();

/**
 * Returns mapped hymn numbers, `null` for a photographed asterisk, or
 * `undefined` when the table has no row for the supplied number, or there's
 * no table for the two hymnals.
 */
export const getHymnalCrossReferences = (
  sourceHymnalId: HymnalBookId,
  sourceNumber: HymnNumber,
  targetHymnalId: HymnalBookId,
): HymnalCrossReference => {
  for (const { hymnalIds, numberMaps } of HYMNAL_CROSS_REFERENCE_TABLES) {
    const side =
      hymnalIds[0] === sourceHymnalId && hymnalIds[1] === targetHymnalId
        ? 0
        : hymnalIds[1] === sourceHymnalId && hymnalIds[0] === targetHymnalId
          ? 1
          : -1;
    if (side !== -1) return readNumbers(numberMaps[side], sourceNumber);
  }
  return undefined;
};

export type HymnEquivalent = Readonly<{ hymnalId: HymnalBookId; number: HymnNumber }>;

/**
 * The same hymn in every other hymnal a table pairs with this one, each
 * mapped number once.
 */
export const getHymnEquivalents = (
  hymnalId: HymnalBookId,
  hymnNumber: HymnNumber,
): HymnEquivalent[] => {
  const equivalents: HymnEquivalent[] = [];
  const seen = new Set<string>();
  for (const { hymnalIds, numberMaps } of HYMNAL_CROSS_REFERENCE_TABLES) {
    const side = hymnalIds[0] === hymnalId ? 0 : hymnalIds[1] === hymnalId ? 1 : -1;
    if (side === -1) continue;
    const targetHymnalId = hymnalIds[1 - side];
    for (const number of readNumbers(numberMaps[side], hymnNumber) ?? []) {
      const key = `${targetHymnalId}:${number}`;
      if (seen.has(key)) continue;
      seen.add(key);
      equivalents.push({ hymnalId: targetHymnalId, number });
    }
  }
  return equivalents;
};
