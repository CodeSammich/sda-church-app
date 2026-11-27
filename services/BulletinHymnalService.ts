import { getSortedChinese505Hymns } from '@/features/hymnal/Chinese505Hymnal';
import { PRIMARY_BULLETIN_HYMNALS } from '@/features/hymnal/BulletinHymnalConfig';
import { SDA_HYMNAL_1985 } from '@/features/hymnal/EnglishHymnal';
import {
  getHymnalShortLabel,
  getHymnTitle,
  type HymnalBookId,
} from '@/features/hymnal/HymnalLabels';
import { getHymnalCrossReferences } from '@/features/hymnal/HymnalNumberMappings';
import { HYMNALS } from '@/features/hymnal/Hymnals';
import { normalizeHymnalSearchText } from '@/features/hymnal/HymnalSearch';
import { traditionalToSimplified } from '@/services/BiblePinyinService';

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

// How close a typed title must be to a hymn's, by edit distance, to be taken
// as that hymn misspelled. A title match in a hymnal other than the church's
// two must be closer, since thousands of titles make a loose match likely to
// be wrong. At 0.55, songs no hymnal has were shown as hymns that share a few
// words, such as "Praise the Lord, O My Soul" as hymn 25, "Praise the Lord,
// His Glories Show" (#751); a misspelling such as "Prais to the Lord" is 0.94.
const PRIMARY_TITLE_MATCH = 0.7;
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
    // "Hymn" too, or the word alone matched "Hark, the Vesper Hymn Is Stealing" (#831).
    .replace(/\b(?:sdah?|ah|hymn(?:al)?|number|no)\b/giu, ' ')
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
 * reach `minimum`. A typed title must be that close by edit distance, as a
 * misspelling is, not just share letter pairs: "Praise the Lord, O My Soul"
 * shares most of "Praise to the Lord"'s pairs but is another song, and was
 * shown as AH 1 (#751). A title search compares thousands of hymns, so this
 * skips the edit distance whenever the length difference settles it.
 */
const getTitleKeySimilarity = (submitted: TitleKey, canonical: TitleKey, minimum: number) => {
  const left = submitted.title;
  const right = canonical.title;
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return 0.95;

  const longestLength = Math.max(left.length, right.length);
  // An edit distance is at least the difference in length.
  if (1 - Math.abs(left.length - right.length) / longestLength < minimum) return 0;

  const levenshteinSimilarity = 1 - levenshteinDistance(left, right) / longestLength;
  if (levenshteinSimilarity < minimum) return 0;

  const bigramTotal = submitted.bigramCount + canonical.bigramCount;
  let overlap = 0;
  for (const [bigram, count] of submitted.bigrams) {
    overlap += Math.min(count, canonical.bigrams.get(bigram) || 0);
  }
  const diceSimilarity = bigramTotal === 0 ? 0 : (2 * overlap) / bigramTotal;
  return Math.max(levenshteinSimilarity, diceSimilarity);
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

type SubmittedNumber = { number: number; marked: boolean };

// Digits, with any thousands separator or decimal point inside them.
const NUMBER_TOKEN = /\d+(?:[,.]\d+)*/gu;
// Nothing but a number: "10", "10." or "#10".
const PLAIN_NUMBER = /^#?\s*(\d{1,4})\s*\.?$/u;
// A hymnal's name or a word for number just before it: "#10", "No. 10", "AH 73", "SDAH #1".
const NUMBER_MARK_BEFORE = /(?:#|\b(?:sdah?|ah|hymn(?:al)?|number|no)\b\.?)\s*#?\s*$/iu;
// A full stop or the like after a number that starts the cell: "10. Title", "10、標題".
const NUMBER_MARK_AFTER_FIRST = /^\s*[.．、:：)）\-–—]/u;
const LATIN_LETTER = /\p{Script=Latin}/u;

/**
 * The numbers typed in a bulletin hymn, each marked when it's clearly a hymn
 * number: alone, after # or a hymnal's name, as 第10首, or first with a full
 * stop after it. An unmarked one, as in "286 Wonderful Words of Life", counts
 * only beside its hymn's title, so "12 Gates to the City" isn't hymn 12. A
 * number that's part of a figure or a word, as in "10,000 Reasons" or "1st",
 * is no hymn number (#830).
 */
const getSubmittedNumbers = (value: string): SubmittedNumber[] =>
  Array.from(value.matchAll(NUMBER_TOKEN)).flatMap((match) => {
    const [token] = match;
    const start = match.index ?? 0;
    const end = start + token.length;
    const before = value.slice(0, start);
    const after = value.slice(end);
    const markedBefore = NUMBER_MARK_BEFORE.test(before) || /第\s*$/u.test(before);
    if (
      /[,.]/u.test(token) ||
      token.length > 4 ||
      LATIN_LETTER.test(after.charAt(0)) ||
      (!markedBefore && LATIN_LETTER.test(before.slice(-1)))
    ) {
      return [];
    }
    const marked =
      PLAIN_NUMBER.test(value) ||
      markedBefore ||
      (!before.trim() && NUMBER_MARK_AFTER_FIRST.test(after));
    return [{ number: Number(token), marked }];
  });

const getTitleMatch = (hymnalId: HymnalId) =>
  hymnalAdapters[hymnalId].primary ? PRIMARY_TITLE_MATCH : OTHER_TITLE_MATCH;

const createNumberCandidate = (
  value: string,
  hymnNumber: number,
  hymnalId: HymnalId,
  declaredHymnalId: HymnalId,
  marked = true,
): SourceCandidate | undefined => {
  const adapter = hymnalAdapters[hymnalId];
  if (!adapter.includesNumber(hymnNumber)) return undefined;

  const hymn = adapter.getHymn(hymnNumber);
  // A number not marked as a hymn's counts only beside that hymn's title,
  // matched as strictly as a title alone is.
  if (
    !marked &&
    !(
      hymn &&
      getTitleKeySimilarity(
        toTitleKey(normalizeTitle(value)),
        getTitleKey(hymn),
        getTitleMatch(hymnalId),
      )
    )
  ) {
    return undefined;
  }

  const canonicalTitle = hymn?.title;
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

  // A plain number in the Chinese cell is the 505's, as 第N首 is, never a
  // 1985 number mapped across. One the 505 hasn't is a hymn no hymnal has (#834).
  const plainNumber = normalizedValue.match(PLAIN_NUMBER)?.[1];
  if (plainNumber && declaredHymnalId === CHINESE_HYMNAL_ID) {
    return createNumberCandidate(
      normalizedValue,
      Number(plainNumber),
      CHINESE_HYMNAL_ID,
      declaredHymnalId,
    );
  }

  const submittedNumbers = getSubmittedNumbers(normalizedValue).filter(
    ({ number }) => number >= 1 && number <= 707,
  );

  if (submittedNumbers.length > 0) {
    const candidates = submittedNumbers.flatMap(({ number, marked }) =>
      activeHymnalIds
        .map((hymnalId) =>
          createNumberCandidate(normalizedValue, number, hymnalId, declaredHymnalId, marked),
        )
        .filter((candidate): candidate is SourceCandidate => Boolean(candidate)),
    );

    // Numbers not marked as a hymn's, with no hymn of that title, leave it to the title.
    if (candidates.length > 0 || submittedNumbers.some(({ marked }) => marked)) {
      return candidates.sort((left, right) => right.score - left.score)[0];
    }
  }

  const submittedTitle = toTitleKey(normalizeTitle(normalizedValue));
  const titleCandidates = activeHymnalIds
    .flatMap((hymnalId) => hymnalAdapters[hymnalId].hymns())
    .map((hymn) => {
      const similarity = getTitleKeySimilarity(
        submittedTitle,
        getTitleKey(hymn),
        getTitleMatch(hymn.hymnalId),
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
    .filter(({ hymnalId, similarity }) => similarity >= getTitleMatch(hymnalId))
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

// Text as the bulletin has it, in the reader's script (#795). Staff type its
// Chinese in Traditional, as the printed bulletin has it, so a Simplified
// reader gets it converted.
const inReaderScript = (text: string, preferredLanguage: string) =>
  preferredLanguage === 'zh-cn' ? traditionalToSimplified(text) : text;

/**
 * A fixed Queens hymn as the church words it, in the reader's language and
 * script: its Chinese, in Simplified for a Simplified reader, or its English.
 */
export const getFixedHymnDisplayText = (hymn: BulletinHymnText, preferredLanguage: string) =>
  prefersChineseHymnal(preferredLanguage)
    ? inReaderScript(hymn.chinese, preferredLanguage)
    : hymn.english;

// "12. Title", in the reader's script, with the hymnal's name after a hymn
// from outside the church's two hymnals, so no one looks for it in the pew
// hymnal.
const formatHymn = (
  hymnalId: HymnalId,
  hymnNumber: number,
  title: string,
  preferredLanguage: string,
) => {
  const text = `${hymnNumber}. ${getHymnTitle(hymnalId, title, preferredLanguage)}`;
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
  if (!source) {
    return {
      displayText: inReaderScript(submission.text, preferredLanguage),
      youtubeSearchQuery: submission.text,
    };
  }

  if (source.hymnalId !== preferredHymnalId) {
    const mappedPreferred = getMappedDestination(source, preferredHymnalId);
    if (mappedPreferred?.hymnNumber) {
      const preferredTitle = hymnalAdapters[preferredHymnalId].getHymn(
        mappedPreferred.hymnNumber,
      )?.title;
      if (preferredTitle) {
        return {
          displayText: formatHymn(
            preferredHymnalId,
            mappedPreferred.hymnNumber,
            preferredTitle,
            preferredLanguage,
          ),
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
        ? formatHymn(alternateHymnalId, mappedAlternate.hymnNumber, alternateTitle, preferredLanguage)
        : inReaderScript(submission.text, preferredLanguage),
      destination: mappedAlternate,
    };
  }

  return {
    displayText: inReaderScript(submission.text, preferredLanguage),
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
