import { getSortedChinese505Hymns } from '@/constants/Chinese505Hymnal';
import { PRIMARY_BULLETIN_HYMNALS } from '@/constants/BulletinHymnalConfig';
import { SDA_HYMNAL_1985 } from '@/constants/EnglishHymnal';
import { getHymnalCrossReferences } from '@/constants/HymnalNumberMappings';

export type BulletinHymnText = {
  english: string;
  chinese: string;
};

type HymnalId =
  (typeof PRIMARY_BULLETIN_HYMNALS)[keyof typeof PRIMARY_BULLETIN_HYMNALS];

/** Congregational responses that are unchanged in the Queens worship service. */
export const QUEENS_FIXED_HYMNS = {
  doxology: {
    english: '694. Praise God, From Whom All Blessings',
    chinese: '497. 讚美上帝',
  },
  pastoralPrayer: {
    english: '684. Hear Our Prayer, O Lord',
    chinese: '498. 請聽我祈求',
  },
  postlude: {
    english: '690. Dismiss Us, Lord, With Blessing',
    chinese: '504. 散會頌',
  },
} as const satisfies Record<string, BulletinHymnText>;

export type BulletinHymnDestination = {
  hymnalId: HymnalId;
  hymnNumber?: number;
  route: '/resources/english-hymnal' | '/resources/chinese-505-hymnal';
};

type SourceCandidate = {
  available: boolean;
  hymnNumber: number;
  hymnalId: HymnalId;
  score: number;
};

type DestinationCandidate = BulletinHymnDestination & {
  score: number;
};

type HymnCatalogEntry = {
  hymnalId: HymnalId;
  number: number;
  title: string;
};

const ENGLISH_HYMNAL_ID = PRIMARY_BULLETIN_HYMNALS.english;
const CHINESE_HYMNAL_ID = PRIMARY_BULLETIN_HYMNALS.chinese;

const englishHymns = Object.entries(SDA_HYMNAL_1985.en).map(([number, hymn]) => ({
  hymnalId: ENGLISH_HYMNAL_ID,
  number: Number(number),
  title: hymn.title,
}));

const chineseHymns = getSortedChinese505Hymns().map((hymn) => ({
  hymnalId: CHINESE_HYMNAL_ID,
  number: hymn.number,
  title: hymn.title,
}));

const chineseHymnsByNumber = new Map(chineseHymns.map((hymn) => [hymn.number, hymn]));

const hymnalAdapters = {
  [ENGLISH_HYMNAL_ID]: {
    hymns: englishHymns,
    getHymn: (number: number) =>
      englishHymns.find((hymn) => hymn.number === number),
    includesNumber: (number: number) => number >= 1 && number <= 695,
    route: '/resources/english-hymnal' as const,
  },
  [CHINESE_HYMNAL_ID]: {
    hymns: chineseHymns,
    getHymn: (number: number) => chineseHymnsByNumber.get(number),
    // Some mapped 1–505 numbers lack a currently usable source page.
    includesNumber: (number: number) => number >= 1 && number <= 505,
    route: '/resources/chinese-505-hymnal' as const,
  },
};

const activeHymnalIds = [ENGLISH_HYMNAL_ID, CHINESE_HYMNAL_ID] as const;

const normalizeTitle = (value: string) =>
  value
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase()
    .replace(/\b(?:sdah?|hymnal?|number|no)\b/giu, ' ')
    .replace(/\d{1,4}/g, ' ')
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');

const levenshteinDistance = (left: string, right: string) => {
  if (!left) return right.length;
  if (!right) return left.length;

  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    let diagonal = previous[0];
    previous[0] = leftIndex;

    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const above = previous[rightIndex];
      previous[rightIndex] = Math.min(
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + 1,
        diagonal + (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }

  return previous[right.length];
};

const getBigrams = (value: string) => {
  const compact = value.replace(/\s+/g, '');
  if (compact.length < 2) return compact ? [compact] : [];
  return Array.from({ length: compact.length - 1 }, (_, index) =>
    compact.slice(index, index + 2),
  );
};

const getTitleSimilarity = (submitted: string, canonical: string) => {
  const normalizedSubmitted = normalizeTitle(submitted);
  const normalizedCanonical = normalizeTitle(canonical);
  if (!normalizedSubmitted || !normalizedCanonical) return 0;
  if (normalizedSubmitted === normalizedCanonical) return 1;
  if (
    normalizedSubmitted.includes(normalizedCanonical) ||
    normalizedCanonical.includes(normalizedSubmitted)
  ) {
    return 0.95;
  }

  const longestLength = Math.max(normalizedSubmitted.length, normalizedCanonical.length);
  const levenshteinSimilarity =
    1 - levenshteinDistance(normalizedSubmitted, normalizedCanonical) / longestLength;

  const submittedBigrams = getBigrams(normalizedSubmitted);
  const canonicalBigrams = getBigrams(normalizedCanonical);
  const remaining = new Map<string, number>();
  for (const bigram of canonicalBigrams) {
    remaining.set(bigram, (remaining.get(bigram) || 0) + 1);
  }

  let overlap = 0;
  for (const bigram of submittedBigrams) {
    const count = remaining.get(bigram) || 0;
    if (count > 0) {
      overlap += 1;
      remaining.set(bigram, count - 1);
    }
  }

  const diceSimilarity =
    submittedBigrams.length + canonicalBigrams.length === 0
      ? 0
      : (2 * overlap) / (submittedBigrams.length + canonicalBigrams.length);

  return Math.max(levenshteinSimilarity, diceSimilarity);
};

const getLanguageEvidence = (value: string, hymnalId: HymnalId) => {
  const containsHanCharacters = /\p{Script=Han}/u.test(value);
  const containsLatinCharacters = /\p{Script=Latin}/u.test(value);

  if (containsHanCharacters && hymnalId === CHINESE_HYMNAL_ID) return 25;
  if (!containsHanCharacters && containsLatinCharacters && hymnalId === ENGLISH_HYMNAL_ID) {
    return 10;
  }
  return 0;
};

const createNumberCandidate = (
  value: string,
  hymnNumber: number,
  hymnalId: HymnalId,
  declaredHymnalId: HymnalId,
): SourceCandidate | undefined => {
  const adapter = hymnalAdapters[hymnalId];
  if (!adapter.includesNumber(hymnNumber)) return undefined;

  const canonicalTitle = adapter.getHymn(hymnNumber)?.title;
  const titleSimilarity = canonicalTitle ? getTitleSimilarity(value, canonicalTitle) : 0;

  return {
    available: Boolean(canonicalTitle),
    hymnNumber,
    hymnalId,
    score:
      100 +
      (hymnalId === declaredHymnalId ? 20 : 0) +
      getLanguageEvidence(value, hymnalId) +
      titleSimilarity * 60 +
      (canonicalTitle ? 3 : 0),
  };
};

const resolveSourceCandidate = (
  value: string,
  declaredHymnalId: HymnalId,
): SourceCandidate | undefined => {
  const normalizedValue = value.trim();
  if (!normalizedValue) return undefined;

  const submittedNumbers = Array.from(normalizedValue.matchAll(/\d{1,4}/g))
    .map(([number]) => Number(number))
    .filter((number) => number >= 1 && number <= 695);

  if (submittedNumbers.length > 0) {
    const candidates = submittedNumbers.flatMap((hymnNumber) =>
      activeHymnalIds
        .map((hymnalId) =>
          createNumberCandidate(normalizedValue, hymnNumber, hymnalId, declaredHymnalId),
        )
        .filter((candidate): candidate is SourceCandidate => Boolean(candidate)),
    );

    return candidates.sort((left, right) => right.score - left.score)[0];
  }

  const titleCandidates = activeHymnalIds
    .flatMap(
      (hymnalId) =>
        hymnalAdapters[hymnalId].hymns as readonly HymnCatalogEntry[],
    )
    .map((hymn) => {
      const similarity = getTitleSimilarity(normalizedValue, hymn.title);
      return {
        available: true,
        hymnNumber: hymn.number,
        hymnalId: hymn.hymnalId,
        score:
          similarity * 100 +
          (hymn.hymnalId === declaredHymnalId ? 20 : 0) +
          getLanguageEvidence(normalizedValue, hymn.hymnalId) +
          3,
        similarity,
      };
    })
    .filter(({ similarity }) => similarity >= 0.55)
    .sort((left, right) => right.score - left.score);

  return titleCandidates[0];
};

const getRoute = (hymnalId: HymnalId): BulletinHymnDestination['route'] =>
  hymnalAdapters[hymnalId].route;

const getMappedDestination = (
  source: SourceCandidate,
  targetHymnalId: HymnalId,
): BulletinHymnDestination | undefined => {
  if (source.hymnalId === targetHymnalId) return undefined;

  const mappedNumbers = getHymnalCrossReferences(
    source.hymnalId,
    source.hymnNumber,
    targetHymnalId,
  );

  if (!mappedNumbers) return undefined;

  const targetNumber = mappedNumbers.find((number) =>
    Boolean(hymnalAdapters[targetHymnalId].getHymn(number)),
  );
  if (!targetNumber) return undefined;

  return {
    hymnalId: targetHymnalId,
    hymnNumber: targetNumber,
    route: getRoute(targetHymnalId),
  };
};

/**
 * Resolves a bulletin's bilingual, human-entered hymn text to the most useful
 * in-app hymnal destination. Numbers are primary evidence; titles and the field
 * language disambiguate overlapping English/Chinese number ranges.
 */
export const resolveBulletinHymnDestination = (
  value: BulletinHymnText,
  preferredLanguage: string,
): BulletinHymnDestination | undefined => {
  const preferredHymnalId =
    preferredLanguage === 'zh' || preferredLanguage === 'zh-cn'
      ? CHINESE_HYMNAL_ID
      : ENGLISH_HYMNAL_ID;

  const sources = [
    resolveSourceCandidate(value.english, ENGLISH_HYMNAL_ID),
    resolveSourceCandidate(value.chinese, CHINESE_HYMNAL_ID),
  ].filter((candidate): candidate is SourceCandidate => Boolean(candidate));

  const destinations: DestinationCandidate[] = [];
  for (const source of sources) {
    if (source.available) {
      destinations.push({
        hymnalId: source.hymnalId,
        hymnNumber: source.hymnNumber,
        route: getRoute(source.hymnalId),
        score: source.score + (source.hymnalId === preferredHymnalId ? 30 : 0),
      });
    }

    const alternateHymnalId =
      source.hymnalId === ENGLISH_HYMNAL_ID ? CHINESE_HYMNAL_ID : ENGLISH_HYMNAL_ID;
    const mapped = getMappedDestination(source, alternateHymnalId);
    if (mapped) {
      destinations.push({
        ...mapped,
        score: source.score + (mapped.hymnalId === preferredHymnalId ? 35 : 15),
      });
    }

    if (!source.available && !mapped) {
      destinations.push({
        hymnalId: source.hymnalId,
        route: getRoute(source.hymnalId),
        score: source.score - 20,
      });
    }
  }

  const best = destinations.sort((left, right) => right.score - left.score)[0];
  if (!best) return undefined;

  const { score: _score, ...destination } = best;
  return destination;
};

/**
 * Chooses a submitted form answer before considering the app language: the
 * selected-language field wins when both exist, but a lone English or Chinese
 * answer remains in its submitted language. The chosen answer is searched in
 * both catalogs, so content entered in the wrong form field can still resolve.
 * A recognized source hymn gets its canonical source title; cross-references
 * are deliberately not used to translate bulletin display text. Unrecognized
 * submissions remain unchanged.
 */
export const resolveBulletinHymnDisplayText = (
  value: BulletinHymnText,
  preferredLanguage: string,
) => {
  const prefersChinese =
    preferredLanguage === 'zh' || preferredLanguage === 'zh-cn';
  const preferred = prefersChinese
    ? { text: value.chinese.trim(), declaredHymnalId: CHINESE_HYMNAL_ID }
    : { text: value.english.trim(), declaredHymnalId: ENGLISH_HYMNAL_ID };
  const alternate = prefersChinese
    ? { text: value.english.trim(), declaredHymnalId: ENGLISH_HYMNAL_ID }
    : { text: value.chinese.trim(), declaredHymnalId: CHINESE_HYMNAL_ID };
  const submission = preferred.text ? preferred : alternate;
  if (!submission.text) return '';

  const source = resolveSourceCandidate(
    submission.text,
    submission.declaredHymnalId,
  );
  if (!source?.available) return submission.text;

  const title = hymnalAdapters[source.hymnalId].getHymn(source.hymnNumber)?.title;

  return title ? `${source.hymnNumber}. ${title}` : submission.text;
};
