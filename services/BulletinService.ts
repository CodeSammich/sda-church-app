import { getBulletinApiUrl } from '@/constants/ExternalLinks';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type BilingualBulletinText = {
  english: string;
  chinese: string;
};

export type BulletinLocation = {
  hymnOfPraise: BilingualBulletinText;
  sermonTitle: BilingualBulletinText;
  hymnOfResponse: BilingualBulletinText;
  bibleVerses: string;
  sermon: string;
  chairPastoralPrayer: string;
  offeringPrayer: string;
  translation?: string;
  chineseTeacher?: string;
  englishTeacher?: string;
  childrenTeacher?: string;
  specialMusic?: string;
  pianist?: string;
  ssChair?: string;
  openingPrayer?: string;
  closingPrayer?: string;
  sabbathSchool?: string;
};

export type Bulletin = {
  date: string;
  quarter: string;
  specialRemark: string;
  tithePurpose: string;
  pastorTravel: string;
  queens: BulletinLocation;
  brooklyn: BulletinLocation;
};

type BulletinApiResponse =
  | { ok: true; bulletin: Bulletin }
  | { ok: false; error: string };

type CachedBulletin = {
  bulletin: Bulletin;
  fetchedAt: number;
};

const BULLETIN_CACHE_PREFIX = 'bulletin-cache-v1:';
const BULLETIN_REFRESH_PREFIX = 'bulletin-refresh-v1:';

const toLocalIsoDate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
    location.sermon,
    location.chairPastoralPrayer,
    location.offeringPrayer,
    location.translation,
    location.chineseTeacher,
    location.englishTeacher,
    location.childrenTeacher,
    location.specialMusic,
    location.pianist,
    location.ssChair,
    location.openingPrayer,
    location.closingPrayer,
    location.sabbathSchool,
  ].some(hasBulletinValue);

const sabbathStart = (date: string) => new Date(`${date}T00:00:00`).getTime();

export const isBulletinCacheFresh = (
  date: string,
  fetchedAt: number,
  now = Date.now(),
) => now < sabbathStart(date) || fetchedAt >= sabbathStart(date);

export const getCachedBulletin = async (
  date: string,
  now = Date.now(),
): Promise<Bulletin | undefined> => {
  try {
    const stored = await AsyncStorage.getItem(`${BULLETIN_CACHE_PREFIX}${date}`);
    if (!stored) return undefined;

    const cached = JSON.parse(stored) as CachedBulletin;
    if (
      !cached?.bulletin ||
      cached.bulletin.date !== date ||
      !Number.isFinite(cached.fetchedAt) ||
      !isBulletinCacheFresh(date, cached.fetchedAt, now)
    ) {
      return undefined;
    }
    return cached.bulletin;
  } catch {
    return undefined;
  }
};

export const cacheBulletin = async (bulletin: Bulletin, fetchedAt = Date.now()) => {
  await AsyncStorage.setItem(
    `${BULLETIN_CACHE_PREFIX}${bulletin.date}`,
    JSON.stringify({ bulletin, fetchedAt } satisfies CachedBulletin),
  );
};

export const getRefreshAvailableAt = async (date: string) => {
  try {
    const stored = await AsyncStorage.getItem(`${BULLETIN_REFRESH_PREFIX}${date}`);
    const value = Number(stored);
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
};

export const setRefreshAvailableAt = (date: string, value: number) =>
  AsyncStorage.setItem(`${BULLETIN_REFRESH_PREFIX}${date}`, String(value));

export const fetchBulletin = async (
  date: string,
  signal?: AbortSignal,
) => {
  const response = await fetch(getBulletinApiUrl(date), {
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

  await cacheBulletin(payload.bulletin).catch(() => undefined);
  return payload.bulletin;
};
