/**
 * The hymnals on the hymnal page, in one place: each one's hymns, cover,
 * links, own route, and the 1985 ↔ 505 cross-references between rows.
 */

import { openURL, openYouTubeSearch } from '@/constants/ExternalLinks';
import type { ImageSourcePropType } from 'react-native';
import {
  getSortedChinese505Hymns,
  openChinese505Hymn,
} from './Chinese505Hymnal';
import {
  getChinese506YouTubeUrl,
  getSortedChinese506Hymns,
  openChinese506Hymn,
} from './Chinese506Hymnal';
import {
  type Chinese707Version,
  getSortedChinese707Hymns,
  openChinese707Hymn,
} from './Chinese707Hymnal';
import { getSortedHymns, openHymnal } from './EnglishHymnal';
import type { HymnalBookId } from './HymnalLabels';
import {
  getChinese505NumbersForSDAH1985,
  getSDAH1985NumbersForChinese505,
} from './HymnalNumberMappings';
import { getRoutedHymns } from './HymnalRouting';
import { normalizeHymnalSearchText } from './HymnalSearch';

export type HymnalHymn = Readonly<{
  number: number | string;
  title: string;
  /** English hymns only; the row links it to the Bible. */
  scriptureReference?: string;
}>;

export type HymnalDefinition = Readonly<{
  id: HymnalBookId;
  language: 'en' | 'zh';
  /** The hymnal's own route, which opens the hymnal page with it selected. */
  route: string;
  cover: ImageSourcePropType;
  getHymns: () => readonly HymnalHymn[];
  /** Opens the hymn's sheet music in the browser. */
  openHymn: (hymnNumber: number | string) => void;
  /** Opens the hymn's own recording, or else a YouTube search for it. */
  openRecording: (hymn: HymnalHymn) => void;
}>;

export const HYMNAL_SELECTION_ROUTE = '/home/hymnal-selection';

// Each catalog is built once, the first time its hymnal is shown.
const once = <T,>(load: () => T) => {
  let value: T | undefined;
  return () => (value ??= load());
};

const chineseRecording =
  (edition: number, getYouTubeUrl?: (hymnNumber: number) => string | undefined) =>
  (hymn: HymnalHymn) => {
    const youtubeUrl = getYouTubeUrl?.(Number(hymn.number));
    if (youtubeUrl) {
      openURL(youtubeUrl, 'Error', 'Could not open the YouTube video.');
    } else {
      openYouTubeSearch(`${edition}版赞美诗 ${hymn.number} ${hymn.title}`);
    }
  };

const chinese707 = (
  id: HymnalBookId,
  version: Chinese707Version,
  route: string,
  cover: ImageSourcePropType,
): HymnalDefinition => ({
  id,
  language: 'zh',
  route,
  cover,
  getHymns: once(() => getSortedChinese707Hymns(version)),
  openHymn: (hymnNumber) => openChinese707Hymn(version, hymnNumber),
  openRecording: chineseRecording(707),
});

export const HYMNALS: Record<HymnalBookId, HymnalDefinition> = {
  'sdah-1985-en': {
    id: 'sdah-1985-en',
    language: 'en',
    route: '/home/english-hymnal',
    cover: require('../../assets/images/hymnals/sdah-1985.jpg'),
    getHymns: once(() => getSortedHymns('en')),
    openHymn: openHymnal,
    openRecording: (hymn) => openYouTubeSearch(`SDA Hymnal 1985 ${hymn.title}`),
  },
  'chinese-hymnal-505': {
    id: 'chinese-hymnal-505',
    language: 'zh',
    route: '/home/chinese-505-hymnal',
    cover: require('../../assets/images/hymnals/chinese-505-hymnal.jpg'),
    getHymns: once(getSortedChinese505Hymns),
    openHymn: (hymnNumber) => openChinese505Hymn(Number(hymnNumber)),
    openRecording: chineseRecording(505),
  },
  'chinese-hymnal-506': {
    id: 'chinese-hymnal-506',
    language: 'zh',
    route: '/home/chinese-506-hymnal',
    cover: require('../../assets/images/hymnals/chinese-506-hymnal.jpg'),
    getHymns: once(getSortedChinese506Hymns),
    openHymn: (hymnNumber) => openChinese506Hymn(Number(hymnNumber)),
    openRecording: chineseRecording(506, getChinese506YouTubeUrl),
  },
  'chinese-hymnal-707-v3': chinese707(
    'chinese-hymnal-707-v3',
    3,
    '/home/chinese-707-standard-hymnal',
    require('../../assets/images/hymnals/chinese-707-leather-bound.jpg'),
  ),
  'chinese-hymnal-707-v2': chinese707(
    'chinese-hymnal-707-v2',
    2,
    '/home/chinese-707-four-part-hymnal',
    require('../../assets/images/hymnals/chinese-707-four-part-harmony.jpg'),
  ),
  'chinese-hymnal-707-v1': chinese707(
    'chinese-hymnal-707-v1',
    1,
    '/home/chinese-707-new-simplified-hymnal',
    require('../../assets/images/hymnals/chinese-707-simplified-notation.jpg'),
  ),
};

const ENGLISH_HYMNALS: readonly HymnalBookId[] = ['sdah-1985-en'];
const CHINESE_HYMNALS: readonly HymnalBookId[] = [
  'chinese-hymnal-505',
  'chinese-hymnal-506',
  'chinese-hymnal-707-v3',
  'chinese-hymnal-707-v2',
  'chinese-hymnal-707-v1',
];

/** The hymnals in the app language's order: its own hymnals first. */
export const getHymnalOrder = (language: string): readonly HymnalBookId[] =>
  language === 'zh' || language === 'zh-cn'
    ? [...CHINESE_HYMNALS, ...ENGLISH_HYMNALS]
    : [...ENGLISH_HYMNALS, ...CHINESE_HYMNALS];

export const isHymnalBookId = (value: unknown): value is HymnalBookId =>
  typeof value === 'string' && Object.prototype.hasOwnProperty.call(HYMNALS, value);

const hymnNumbersByHymnal = new Map<HymnalBookId, Set<string>>();

const hasHymn = (hymnalId: HymnalBookId, hymnNumber: number | string) => {
  let numbers = hymnNumbersByHymnal.get(hymnalId);
  if (!numbers) {
    numbers = new Set(HYMNALS[hymnalId].getHymns().map((hymn) => hymn.number.toString()));
    hymnNumbersByHymnal.set(hymnalId, numbers);
  }
  return numbers.has(hymnNumber.toString());
};

export type HymnCrossReference = Readonly<{
  hymnalId: HymnalBookId;
  number: number;
  /** Whether the other hymnal's catalog has the hymn to show. */
  available: boolean;
}>;

/**
 * The same hymn in the other primary hymnal: 505 numbers for a 1985 hymn,
 * and 1985 numbers for a 505 hymn, from the curated cross-reference table.
 */
export const getHymnCrossReferences = (
  hymnalId: HymnalBookId,
  hymnNumber: number | string,
): readonly HymnCrossReference[] => {
  const number = Number(hymnNumber);
  const [targetHymnalId, targetNumbers] =
    hymnalId === 'sdah-1985-en'
      ? (['chinese-hymnal-505', getChinese505NumbersForSDAH1985(number)] as const)
      : hymnalId === 'chinese-hymnal-505'
        ? (['sdah-1985-en', getSDAH1985NumbersForChinese505(number)] as const)
        : [undefined, undefined];
  if (!targetHymnalId || !targetNumbers) return [];

  return targetNumbers.map((targetNumber) => ({
    hymnalId: targetHymnalId,
    number: targetNumber,
    available: hasHymn(targetHymnalId, targetNumber),
  }));
};

const searchTextByHymn = new WeakMap<HymnalHymn, string>();

const getSearchText = (hymn: HymnalHymn) => {
  let text = searchTextByHymn.get(hymn);
  if (text === undefined) {
    text = normalizeHymnalSearchText(`${hymn.title}\n${hymn.scriptureReference || ''}`);
    searchTextByHymn.set(hymn, text);
  }
  return text;
};

/**
 * The hymns a hymnal shows. A routed hymn number shows just that hymn, as the
 * old hymnal pages did (see getRoutedHymns). Otherwise the search matches the
 * number, the title, and an English hymn's scripture reference, with
 * Traditional and Simplified Chinese alike, and an exact number comes first.
 */
export const getDisplayedHymns = (
  hymns: readonly HymnalHymn[],
  hymnNum: string | undefined,
  query: string,
): readonly HymnalHymn[] => {
  const normalizedQuery = normalizeHymnalSearchText(query);
  if (!hymnNum && !normalizedQuery) return hymns;
  const numberText = (hymn: HymnalHymn) => hymn.number.toString().toLocaleLowerCase();
  const matches = getRoutedHymns(hymns, hymnNum, (hymn) =>
    !normalizedQuery ||
      numberText(hymn).includes(normalizedQuery) ||
      getSearchText(hymn).includes(normalizedQuery),
  );
  if (!normalizedQuery) return matches;

  const exactIndex = matches.findIndex((hymn) => numberText(hymn) === normalizedQuery);
  return exactIndex > 0
    ? [matches[exactIndex], ...matches.slice(0, exactIndex), ...matches.slice(exactIndex + 1)]
    : matches;
};
