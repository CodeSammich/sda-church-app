import { getSortedChinese505Hymns } from '@/features/hymnal/Chinese505Hymnal';
import { PRIMARY_BULLETIN_HYMNALS } from '@/features/hymnal/BulletinHymnalConfig';
import { SDA_HYMNAL_1985 } from '@/features/hymnal/EnglishHymnal';
import { getHymnalShortLabel, type HymnalBookId } from '@/features/hymnal/HymnalLabels';
import { getHymnalCrossReferences } from '@/features/hymnal/HymnalNumberMappings';
import { HYMNALS } from '@/features/hymnal/Hymnals';
import { normalizeHymnalSearchText } from '@/features/hymnal/HymnalSearch';

export type BulletinHymnText = {
  english: string;
  chinese: string;
};

type HymnalId = HymnalBookId;

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
  /** The hymnal's own route, such as /home/english-hymnal. */
  route: string;
};

export type BulletinHymnPresentation = {
  displayText: string;
  destination?: BulletinHymnDestination;
  /**
   * What to search YouTube for when no hymnal has the hymn: the text as
   * typed. Some hymns aren't in a hymnal at all.
   */
  youtubeSearchQuery?: string;
};

type SourceCandidate = {
  available: boolean;
  hymnNumber: number;
  hymnalId: HymnalId;
  score: number;
};

type HymnCatalogEntry = {
  hymnalId: HymnalId;
  number: number;
  title: string;
};

type HymnalAdapter = {
  hymns: () => readonly HymnCatalogEntry[];
  getHymn: (number: number) => HymnCatalogEntry | undefined;
  includesNumber: (number: number) => boolean;
  route: string;
  /** The church's own two hymnals, which the bulletin's columns name. */
  primary: boolean;
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

// Every other hymnal on the hymnal page, such as the 506 and the 707s, built
// the first time a bulletin hymn isn't in the church's own two. A 707 number
// with a letter, such as 260B, can't be typed as a plain number, so it's left out.
const createOtherHymnalAdapter = (hymnalId: HymnalId): HymnalAdapter => {
  let hymns: HymnCatalogEntry[] | undefined;
  let byNumber: Map<number, HymnCatalogEntry> | undefined;
  const load = () => {
    if (!hymns) {
      hymns = HYMNALS[hymnalId]
        .getHymns()
        .filter((hymn) => typeof hymn.number === 'number')
        .map((hymn) => ({ hymnalId, number: Number(hymn.number), title: hymn.title }));
      byNumber = new Map(hymns.map((hymn) => [hymn.number, hymn]));
    }
    return { hymns, byNumber: byNumber! };
  };
  return {
    hymns: () => load().hymns,
    getHymn: (number) => load().byNumber.get(number),
    includesNumber: (number) => load().byNumber.has(number),
    route: HYMNALS[hymnalId].route,
    primary: false,
  };
};

const primaryHymnalAdapters: Partial<Record<HymnalId, HymnalAdapter>> = {
  [ENGLISH_HYMNAL_ID]: {
    hymns: () => englishHymns,
    getHymn: (number: number) =>
      englishHymns.find((hymn) => hymn.number === number),
    includesNumber: (number: number) => number >= 1 && number <= 695,
    route: HYMNALS[ENGLISH_HYMNAL_ID].route,
    primary: true,
  },
  [CHINESE_HYMNAL_ID]: {
    hymns: () => chineseHymns,
    getHymn: (number: number) => chineseHymnsByNumber.get(number),
    // Some mapped 1–505 numbers lack a currently usable source page.
    includesNumber: (number: number) => number >= 1 && number <= 505,
    route: HYMNALS[CHINESE_HYMNAL_ID].route,
    primary: true,
  },
};

const hymnalAdapters = Object.fromEntries(
  (Object.keys(HYMNALS) as HymnalId[]).map((hymnalId) => [
    hymnalId,
    primaryHymnalAdapters[hymnalId] ?? createOtherHymnalAdapter(hymnalId),
  ]),
) as Record<HymnalId, HymnalAdapter>;

// The church's own hymnals first, then the rest in the hymnal page's order.
const activeHymnalIds = [
  ENGLISH_HYMNAL_ID,
  CHINESE_HYMNAL_ID,
  ...(Object.keys(HYMNALS) as HymnalId[]).filter(
    (hymnalId) => !hymnalAdapters[hymnalId].primary,
  ),
];

// A title match in a hymnal other than the church's two must be close, since
// thousands of titles make a loose match likely to be wrong.
const PRIMARY_TITLE_MATCH = 0.55;
const OTHER_TITLE_MATCH = 0.8;

const isChineseHymnal = (hymnalId: HymnalId) => HYMNALS[hymnalId].language === 'zh';

// Traditional and Simplified titles compare as one, and hymnal words and
// numbers ("AH 73", "第12首", "SDAH no. 5") aren't part of a title.
const normalizeTitle = (value: string) =>
  normalizeHymnalSearchText(value)
    .normalize('NFKD')
    .replace(/\p{Mark}/gu, '')
    .toLocaleLowerCase()
    .replace(/第\s*\d{1,4}\s*首/gu, ' ')
    .replace(/\b(?:sdah?|ah|hymnal?|number|no)\b/giu, ' ')
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

const getTitleSimilarity = (submitted: string, canonical: string) =>
  getNormalizedTitleSimilarity(normalizeTitle(submitted), normalizeTitle(canonical));

/** A normalized title with its bigram counts, worked out once per hymn. */
type TitleKey = { title: string; bigrams: Map<string, number>; bigramCount: number };

const toTitleKey = (normalizedTitle: string): TitleKey => {
  const list = getBigrams(normalizedTitle);
  const bigrams = new Map<string, number>();
  for (const bigram of list) bigrams.set(bigram, (bigrams.get(bigram) || 0) + 1);
  return { title: normalizedTitle, bigrams, bigramCount: list.length };
};

const titleKeys = new WeakMap<HymnCatalogEntry, TitleKey>();
const getTitleKey = (hymn: HymnCatalogEntry) => {
  let key = titleKeys.get(hymn);
  if (!key) {
    key = toTitleKey(normalizeTitle(hymn.title));
    titleKeys.set(hymn, key);
  }
  return key;
};

/**
 * The same similarity as getNormalizedTitleSimilarity, or 0 once it can't
 * reach `minimum`. A title search compares thousands of hymns, so this skips
 * the edit distance whenever the length difference or the bigrams settle it.
 */
const getTitleKeySimilarity = (submitted: TitleKey, canonical: TitleKey, minimum: number) => {
  const left = submitted.title;
  const right = canonical.title;
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.95;

  const longestLength = Math.max(left.length, right.length);
  // An edit distance is at least the difference in length.
  const levenshteinBound = 1 - Math.abs(left.length - right.length) / longestLength;
  const bigramTotal = submitted.bigramCount + canonical.bigramCount;
  let overlap = 0;
  for (const [bigram, count] of submitted.bigrams) {
    overlap += Math.min(count, canonical.bigrams.get(bigram) || 0);
  }
  const diceSimilarity = bigramTotal === 0 ? 0 : (2 * overlap) / bigramTotal;
  if (levenshteinBound <= diceSimilarity) {
    return diceSimilarity >= minimum ? diceSimilarity : 0;
  }
  if (levenshteinBound < minimum) return 0;

  const similarity = Math.max(
    1 - levenshteinDistance(left, right) / longestLength,
    diceSimilarity,
  );
  return similarity >= minimum ? similarity : 0;
};

const getNormalizedTitleSimilarity = (
  normalizedSubmitted: string,
  normalizedCanonical: string,
) => {
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

  if (containsHanCharacters && isChineseHymnal(hymnalId)) return 25;
  if (!containsHanCharacters && containsLatinCharacters && !isChineseHymnal(hymnalId)) {
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
    .filter((number) => number >= 1 && number <= 707);

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

  const submittedTitle = toTitleKey(normalizeTitle(normalizedValue));
  const titleCandidates = activeHymnalIds
    .flatMap((hymnalId) => hymnalAdapters[hymnalId].hymns())
    .map((hymn) => {
      const similarity = getTitleKeySimilarity(
        submittedTitle,
        getTitleKey(hymn),
        hymnalAdapters[hymn.hymnalId].primary ? PRIMARY_TITLE_MATCH : OTHER_TITLE_MATCH,
      );
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
    .filter(
      ({ hymnalId, similarity }) =>
        similarity >=
        (hymnalAdapters[hymnalId].primary ? PRIMARY_TITLE_MATCH : OTHER_TITLE_MATCH),
    )
    .sort((left, right) => right.score - left.score);

  return titleCandidates[0];
};

// The bulletin redraws often (its refresh countdown ticks every second), and a
// title search is slow, so each answer is looked up once.
const sourceCandidates = new Map<string, SourceCandidate | undefined>();
const resolveSourceCandidateOnce = (value: string, declaredHymnalId: HymnalId) => {
  const key = `${declaredHymnalId}\u0000${value.trim()}`;
  if (!sourceCandidates.has(key)) {
    if (sourceCandidates.size >= 500) sourceCandidates.clear();
    sourceCandidates.set(key, resolveSourceCandidate(value, declaredHymnalId));
  }
  return sourceCandidates.get(key);
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
    Boolean(hymnalAdapters[targetHymnalId].getHymn(Number(number))),
  );
  if (!targetNumber) return undefined;

  return {
    hymnalId: targetHymnalId,
    hymnNumber: Number(targetNumber),
    route: getRoute(targetHymnalId),
  };
};

const prefersChineseHymnal = (preferredLanguage: string) =>
  preferredLanguage === 'zh' || preferredLanguage === 'zh-cn';

// "12. Title", with the hymnal's name after a hymn from outside the church's
// two hymnals, so no one looks for it in the pew hymnal.
const formatHymn = (
  hymnalId: HymnalId,
  hymnNumber: number,
  title: string,
  preferredLanguage: string,
) => {
  const text = `${hymnNumber}. ${title}`;
  if (hymnalAdapters[hymnalId].primary) return text;
  const label = getHymnalShortLabel(hymnalId, preferredLanguage);
  return prefersChineseHymnal(preferredLanguage) ? `${text}（${label}）` : `${text} (${label})`;
};

/**
 * One Sabbath School hymn, typed in either language in its own cell. Chinese
 * text or a bare number is read as a Chinese hymnal number; anything else in
 * Latin letters as English.
 */
export const toBulletinHymnText = (value: string): BulletinHymnText => {
  const text = value.trim();
  const isEnglish = /\p{Script=Latin}/u.test(text) && !/\p{Script=Han}/u.test(text);
  return isEnglish ? { english: text, chinese: '' } : { english: '', chinese: text };
};

const selectBulletinHymnSubmission = (
  value: BulletinHymnText,
  preferredLanguage: string,
) => {
  const prefersChinese = prefersChineseHymnal(preferredLanguage);
  const preferred = prefersChinese
    ? { text: value.chinese.trim(), declaredHymnalId: CHINESE_HYMNAL_ID }
    : { text: value.english.trim(), declaredHymnalId: ENGLISH_HYMNAL_ID };
  const alternate = prefersChinese
    ? { text: value.english.trim(), declaredHymnalId: ENGLISH_HYMNAL_ID }
    : { text: value.chinese.trim(), declaredHymnalId: CHINESE_HYMNAL_ID };

  return preferred.text ? preferred : alternate;
};

/**
 * Resolves both the visible bulletin label and its reader destination from the
 * same selected form answer, looking in every hymnal the app has. Numbers are
 * primary evidence; titles and scripts disambiguate overlapping ranges, and
 * the church's own two hymnals win a tie. If only the other-language answer
 * exists, a known cross-reference supplies the preferred-language number and
 * title. With no mapping, the canonical source entry is retained. Unrecognized
 * text remains raw, with no reader action: it gets a YouTube search instead.
 */
export const resolveBulletinHymnPresentation = (
  value: BulletinHymnText,
  preferredLanguage: string,
): BulletinHymnPresentation => {
  const prefersChinese = prefersChineseHymnal(preferredLanguage);
  const preferredHymnalId = prefersChinese
    ? CHINESE_HYMNAL_ID
    : ENGLISH_HYMNAL_ID;
  const submission = selectBulletinHymnSubmission(value, preferredLanguage);
  if (!submission.text) return { displayText: '' };

  const source = resolveSourceCandidateOnce(
    submission.text,
    submission.declaredHymnalId,
  );
  if (!source) return { displayText: submission.text, youtubeSearchQuery: submission.text };

  if (source.hymnalId !== preferredHymnalId) {
    const mappedPreferred = getMappedDestination(source, preferredHymnalId);
    if (mappedPreferred?.hymnNumber) {
      const preferredTitle = hymnalAdapters[preferredHymnalId].getHymn(
        mappedPreferred.hymnNumber,
      )?.title;
      if (preferredTitle) {
        return {
          displayText: `${mappedPreferred.hymnNumber}. ${preferredTitle}`,
          destination: mappedPreferred,
        };
      }
    }
  }

  const title = hymnalAdapters[source.hymnalId].getHymn(source.hymnNumber)?.title;

  if (source.available && title) {
    return {
      displayText: formatHymn(source.hymnalId, source.hymnNumber, title, preferredLanguage),
      destination: {
        hymnalId: source.hymnalId,
        hymnNumber: source.hymnNumber,
        route: getRoute(source.hymnalId),
      },
    };
  }

  const alternateHymnalId =
    source.hymnalId === ENGLISH_HYMNAL_ID ? CHINESE_HYMNAL_ID : ENGLISH_HYMNAL_ID;
  const mappedAlternate = getMappedDestination(source, alternateHymnalId);
  if (mappedAlternate?.hymnNumber) {
    const alternateTitle = hymnalAdapters[alternateHymnalId].getHymn(
      mappedAlternate.hymnNumber,
    )?.title;
    return {
      displayText: alternateTitle
        ? `${mappedAlternate.hymnNumber}. ${alternateTitle}`
        : submission.text,
      destination: mappedAlternate,
    };
  }

  return {
    displayText: submission.text,
    destination: {
      hymnalId: source.hymnalId,
      route: getRoute(source.hymnalId),
    },
  };
};

/** Compatibility helpers for consumers that need only one presentation field. */
export const resolveBulletinHymnDisplayText = (
  value: BulletinHymnText,
  preferredLanguage: string,
) => resolveBulletinHymnPresentation(value, preferredLanguage).displayText;

export const resolveBulletinHymnDestination = (
  value: BulletinHymnText,
  preferredLanguage: string,
) => resolveBulletinHymnPresentation(value, preferredLanguage).destination;
