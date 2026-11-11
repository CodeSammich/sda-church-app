import Constants from 'expo-constants';

import { getBulletinApiUrl } from '@/constants/ExternalLinks';
import { type CachedText, pruneCachedTexts, readCachedText, writeCachedText } from '@/services/CacheStore';

/**
 * A key-screens build's made-up bulletin (#456), in place of the Bulletin
 * API's answer, so the key screens' shots, the text read from them, and the
 * run's downloads hold no member's name. Expo writes EXPO_PUBLIC_KEY_SCREENS
 * into the app when it's built, so in a store build the condition is false
 * when Metro bundles it, and the made-up data is left out.
 */
const keyScreensFixtures: typeof import('./KeyScreensFixtures') | null =
  process.env.EXPO_PUBLIC_KEY_SCREENS === '1' ? require('./KeyScreensFixtures') : null;

/**
 * A state a key-screen path can ask the bulletin for (#456): `load-failed`,
 * the API out of service, which no tap can bring about.
 */
export type KeyScreensBulletinState = 'load-failed';

export type BilingualBulletinText = {
  english: string;
  chinese: string;
};

export type BulletinMetadataTranslation = {
  en: string;
  zh: string;
  'zh-cn': string;
  es: string;
};

export type BulletinLocation = {
  hymnOfPraise: BilingualBulletinText;
  sermonTitle: BilingualBulletinText;
  hymnOfResponse: BilingualBulletinText;
  bibleVerses: string;
  /**
   * The Sabbath School's opening hymns, each as typed in either language.
   * They're sung again as the closing hymns. Missing from bulletins served
   * before #558.
   */
  sabbathSchoolHymns?: string[];
  /** The special music piece; specialMusic is who performs it. */
  specialMusicTitle?: string;
  sermon: string;
  chairPastoralPrayer: string;
  offeringPrayer: string;
  translation?: string;
  chineseTeacher?: string;
  englishTeacher?: string;
  youthTeacher?: string;
  kidsTeacher?: string;
  specialMusic?: string;
  pianist?: string;
  ssChair?: string;
  ssOpeningPrayer?: string;
  closingPrayer?: string;
  flowerOffering?: string;
  sabbathSchool?: string;
  chair?: string;
  songLeader?: string;
  sabbathMessage?: string;
  sabbathMessageTitle?: string;
  technician?: string;
  encouragement?: string;
};

export type Bulletin = {
  date: string;
  quarter: string;
  specialRemark: string;
  tithePurpose: string;
  pastorTravel: string;
  metadataTranslations?: {
    specialRemark: BulletinMetadataTranslation;
    tithePurpose: BulletinMetadataTranslation;
    pastorTravel: BulletinMetadataTranslation;
  };
  queens: BulletinLocation;
  brooklyn: BulletinLocation;
  /**
   * The Sabbath Calendar has no schedule for this date (#580): the tab, its
   * Date column, or the date's row is missing, so every schedule field is
   * blank. Sent only to app versions that show it.
   */
  scheduleNotSet?: boolean;
};

type BulletinApiResponse =
  | { ok: true; bulletin: Bulletin }
  | { ok: false; error: string };

export type CachedBulletin = {
  bulletin: Bulletin;
  /** When the app downloaded it. */
  fetchedAt: number;
  /** The app version that downloaded it. Copies saved before #702 have none. */
  appVersion?: string;
};

/** How long a downloaded bulletin counts as current (#702). */
export const BULLETIN_MAX_AGE_MS = 30 * 60 * 1000;

const BULLETIN_CACHE_PREFIX = 'bulletin-cache-v2:';
const BULLETIN_REFRESH_PREFIX = 'bulletin-refresh-v1:';

// Each Sabbath's bulletin, and when it may next be refreshed, are copies the
// app can download again, so they're kept out of the phone's backup (#524).
type StoredKind = 'bulletin' | 'refresh';
const stored = (kind: StoredKind, date: string): CachedText => ({
  folder: 'bulletins',
  name: `${date}.${kind === 'bulletin' ? 'json' : 'refresh'}`,
  key: `${kind === 'bulletin' ? BULLETIN_CACHE_PREFIX : BULLETIN_REFRESH_PREFIX}${date}`,
});

// The app only shows this Sabbath's bulletin and the next, so copies dated more
// than two weeks before the newest go, rather than piling up week after week.
const KEEP_DAYS = 14;
const pruneStored = (newestDate: string) => {
  const cutoff = toLocalIsoDate(new Date(sabbathStart(newestDate) - KEEP_DAYS * 24 * 60 * 60 * 1000));
  return pruneCachedTexts('bulletins', [BULLETIN_CACHE_PREFIX, BULLETIN_REFRESH_PREFIX], (name) => {
    const date = name.replace(/\.(json|refresh)$/, '');
    return /^\d{4}-\d{2}-\d{2}$/.test(date) && date < cutoff;
  });
};

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Local calendar-day precision is intentional here. These dates only trigger a
 * bulletin refresh around the Sabbath transition; unlike the Home countdown,
 * they do not need to track the exact start of Sabbath.
 */
export const getUpcomingSabbathDates = (from = new Date()): [string, string] => {
  const first = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const daysUntilSaturday = (6 - first.getDay() + 7) % 7;
  first.setDate(first.getDate() + daysUntilSaturday);

  const second = new Date(first);
  second.setDate(second.getDate() + 7);

  return [toLocalIsoDate(first), toLocalIsoDate(second)];
};

/** The first local midnight after the currently displayed Sabbath. */
export const getNextBulletinRolloverAt = (from = new Date()) => {
  const [currentSabbath] = getUpcomingSabbathDates(from);
  const rollover = new Date(`${currentSabbath}T00:00:00`);
  rollover.setDate(rollover.getDate() + 1);
  return rollover.getTime();
};

export const hasBulletinValue = (value: string | undefined) => {
  const normalized = value?.trim();
  return Boolean(normalized && normalized.toUpperCase() !== 'TBD');
};

export const isBulletinLocationEmpty = (location: BulletinLocation) =>
  ![
    location.hymnOfPraise.english,
    location.hymnOfPraise.chinese,
    location.sermonTitle.english,
    location.sermonTitle.chinese,
    location.hymnOfResponse.english,
    location.hymnOfResponse.chinese,
    location.bibleVerses,
    ...(location.sabbathSchoolHymns || []),
    location.specialMusicTitle,
    location.sermon,
    location.chairPastoralPrayer,
    location.offeringPrayer,
    location.translation,
    location.chineseTeacher,
    location.englishTeacher,
    location.youthTeacher,
    location.kidsTeacher,
    location.specialMusic,
    location.pianist,
    location.ssChair,
    location.ssOpeningPrayer,
    location.closingPrayer,
    location.flowerOffering,
    location.sabbathSchool,
    location.chair,
    location.songLeader,
    location.sabbathMessage,
    location.sabbathMessageTitle,
    location.technician,
    location.encouragement,
  ].some(hasBulletinValue);

const sabbathStart = (date: string) => new Date(`${date}T00:00:00`).getTime();

/**
 * Whether a stored copy is still current (#702). It's out of date once it's
 * more than 30 minutes old, so staff edits reach phones during the week; once
 * its Sabbath has begun, if it was downloaded before then; and when another
 * app version saved it, or one from before versions were kept, since a newer
 * app may show fields the old copy lacks.
 */
export const isBulletinCacheFresh = (
  { bulletin, fetchedAt, appVersion }: CachedBulletin,
  now = Date.now(),
) => {
  const age = now - fetchedAt;
  const start = sabbathStart(bulletin.date);
  return (
    appVersion !== undefined &&
    appVersion === Constants.expoConfig?.version &&
    age >= 0 &&
    age < BULLETIN_MAX_AGE_MS &&
    (now < start || fetchedAt >= start)
  );
};

/**
 * The stored copy of a date's bulletin, if there is one, and whether it's
 * still current. The bulletin screen shows it either way, at once, and asks
 * for a newer one when it isn't.
 */
export const readCachedBulletin = async (
  date: string,
  now = Date.now(),
): Promise<{ bulletin: Bulletin; fresh: boolean } | undefined> => {
  // A key-screens build keeps no copies, so each shot asks for the made-up
  // bulletin, whichever shot came before it.
  if (keyScreensFixtures) return undefined;
  try {
    const text = await readCachedText(stored('bulletin', date));
    if (!text) return undefined;

    const cached = JSON.parse(text) as CachedBulletin;
    if (!cached?.bulletin || cached.bulletin.date !== date || !Number.isFinite(cached.fetchedAt)) {
      return undefined;
    }
    return { bulletin: cached.bulletin, fresh: isBulletinCacheFresh(cached, now) };
  } catch {
    return undefined;
  }
};

/**
 * Returns the stored bulletin for a date while it is current. With allowStale,
 * it also returns an outdated copy, which the bulletin screen shows when a
 * request fails (for example when the Apps Script API is busy or offline).
 */
export const getCachedBulletin = async (
  date: string,
  now = Date.now(),
  { allowStale = false } = {},
): Promise<Bulletin | undefined> => {
  const cached = await readCachedBulletin(date, now);
  return cached && (allowStale || cached.fresh) ? cached.bulletin : undefined;
};

export const cacheBulletin = async (bulletin: Bulletin, fetchedAt = Date.now()) => {
  if (keyScreensFixtures) return;
  await writeCachedText(
    stored('bulletin', bulletin.date),
    JSON.stringify({
      bulletin,
      fetchedAt,
      appVersion: Constants.expoConfig?.version,
    } satisfies CachedBulletin),
  );
  await pruneStored(bulletin.date).catch(() => undefined);
};

export const getRefreshAvailableAt = async (date: string) => {
  try {
    const value = Number(await readCachedText(stored('refresh', date)));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

export const setRefreshAvailableAt = (date: string, value: number) =>
  writeCachedText(stored('refresh', date), String(value));

/**
 * Downloads a date's bulletin from the Bulletin API and stores it. In a
 * key-screens build, the made-up bulletin's answer, or the failure a path's
 * `state=load-failed` asks for, stands in for the network, and goes through
 * the same checks (#456).
 */
export const fetchBulletin = async (
  date: string,
  signal?: AbortSignal,
  keyScreensState?: KeyScreensBulletinState | null,
) => {
  const response = keyScreensFixtures
    ? keyScreensFixtures.getKeyScreensBulletinResponse(date, keyScreensState)
    : await fetch(getBulletinApiUrl(date, Constants.expoConfig?.version), {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal,
      });

  if (!response.ok) {
    throw new Error(`Bulletin request failed (${response.status})`);
  }

  const payload = (await response.json()) as BulletinApiResponse;
  if (!payload.ok) {
    throw new Error(payload.error || 'Bulletin data is unavailable');
  }

  if (!payload.bulletin?.date || !payload.bulletin.queens || !payload.bulletin.brooklyn) {
    throw new Error('Bulletin response is incomplete');
  }

  // A bulletin without its schedule isn't kept, so it never replaces a
  // stored copy that has one, and the next look asks again.
  if (!payload.bulletin.scheduleNotSet) {
    await cacheBulletin(payload.bulletin).catch(() => undefined);
  }
  return payload.bulletin;
};
