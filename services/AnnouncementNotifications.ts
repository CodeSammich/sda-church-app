import { CHURCH_LATITUDE, CHURCH_LONGITUDE } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { getAnnouncementNotifications } from '@/modules/announcement-notifications';
import {
  BULLETIN_LOCATION_STORAGE_KEY,
  fetchBulletin,
  getBulletinAnnouncements,
  getUpcomingSabbathDates,
  readCachedBulletin,
  type Bulletin,
} from '@/services/BulletinService';
import { getSunTimes } from '@/services/SunTimesService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

/**
 * The notice of a week's announcements (#709), the app's second kind of
 * notification. docs/UI_UX.md has the policy every notification follows, and
 * docs/feature_designs/announcements.md the design.
 *
 * - Only of a published announcement: staff press Publish & Notify Phones in
 *   the bulletin sheet, and the bulletin API says when
 *   (`announcementsPublishedAt`). A cell that changes notifies no one.
 * - Off until the member turns it on: the bulletin offers it below the
 *   announcements, once, and You → Announcement notifications turns it on or
 *   off. Never asked at launch.
 * - At most one a Sabbath, for the member's bulletin location (the tab they
 *   last chose), in the app's language, in the daytime (9 am to 8 pm), and
 *   from sunset at the end of one Sabbath to sunset on the Friday before the
 *   next, so none comes during the Sabbath. Quiet: no sound or vibration.
 * - Made on the phone: the app checks the bulletin when it opens, and every
 *   few hours in the background (services/AnnouncementNotificationTask.ts),
 *   and hands the notice to the phone (modules/announcement-notifications),
 *   which posts it at its time, even with the app closed. Nothing about the
 *   member leaves the phone.
 */

export const ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY = 'announcementNotifications';
// The bulletin's offer: shown until the member answers it, then never.
export const ANNOUNCEMENT_OFFER_STORAGE_KEY = 'announcementNotificationsOffer';
// The app's language, as the root layout saves it.
const LANGUAGE_STORAGE_KEY = 'user-language';

/** A tap opens the bulletin, through the app's own link (app/+native-intent.tsx). */
export const ANNOUNCEMENT_NOTICE_URL = 'sdachurchapp://home/bulletin';

// The daytime a notice may come in, in the phone's hours.
export const ANNOUNCEMENT_DAY_START_HOUR = 9;
export const ANNOUNCEMENT_DAY_END_HOUR = 20;

type Words = Readonly<{
  channel: string;
  channelDescription: string;
  title: (location: string) => string;
  queens: string;
  brooklyn: string;
}>;

const WORDS: Readonly<Record<SupportedLanguage, Words>> = {
  en: {
    channel: 'Announcements',
    channelDescription: 'The church’s announcements, once a week at most',
    title: (location) => `Announcements · ${location}`,
    queens: 'Queens',
    brooklyn: 'Brooklyn',
  },
  zh: {
    channel: '報告事項',
    channelDescription: '教會的報告事項，每週最多一次',
    title: (location) => `報告事項 · ${location}`,
    queens: '皇后區',
    brooklyn: '布魯克林',
  },
  'zh-cn': {
    channel: '报告事项',
    channelDescription: '教会的报告事项，每周最多一次',
    title: (location) => `报告事项 · ${location}`,
    queens: '皇后区',
    brooklyn: '布鲁克林',
  },
  es: {
    channel: 'Anuncios',
    channelDescription: 'Los anuncios de la iglesia, una vez por semana como máximo',
    title: (location) => `Anuncios · ${location}`,
    queens: 'Queens',
    brooklyn: 'Brooklyn',
  },
};

const words = (language: SupportedLanguage) => WORDS[language] ?? WORDS.en;

type Location = 'queens' | 'brooklyn';

/** The notice's title, as "Announcements · Queens", in the app's language. */
export const getAnnouncementNoticeTitle = (language: SupportedLanguage, location: Location) =>
  words(language).title(words(language)[location]);

// Sunset at the church on a day, or 6 pm there where it can't be worked out.
const sunsetOn = (day: Date) => {
  const sunset = getSunTimes(CHURCH_LATITUDE, CHURCH_LONGITUDE, day)?.sunset;
  if (sunset) return sunset.getTime();
  const fallback = new Date(day);
  fallback.setHours(18, 0, 0, 0);
  return fallback.getTime();
};

const dayBefore = (sabbath: string, days: number) => {
  const day = new Date(`${sabbath}T12:00:00`);
  day.setDate(day.getDate() - days);
  return day;
};

/**
 * When a Sabbath's notice may come: from sunset on the Sabbath before, when
 * that one ends, to sunset on the Friday before it, when it begins.
 */
export const getAnnouncementNoticeWindow = (sabbath: string) => ({
  opens: sunsetOn(dayBefore(sabbath, 7)),
  closes: sunsetOn(dayBefore(sabbath, 1)),
});

/** The Sabbath a notice now is for: the coming one, or the next once it has begun. */
export const getAnnouncementNoticeSabbath = (now = Date.now()) => {
  const [coming, next] = getUpcomingSabbathDates(new Date(now));
  return now < getAnnouncementNoticeWindow(coming).closes ? coming : next;
};

/**
 * When a Sabbath's notice goes out, found at `now`: at once, in the daytime,
 * or else at the next 9 am, and never before its window opens. Null once it's
 * too late.
 */
export const getAnnouncementNoticeTime = (now: number, sabbath: string): number | null => {
  const { opens, closes } = getAnnouncementNoticeWindow(sabbath);
  const at = new Date(Math.max(now, opens));
  if (at.getHours() < ANNOUNCEMENT_DAY_START_HOUR) {
    at.setHours(ANNOUNCEMENT_DAY_START_HOUR, 0, 0, 0);
  } else if (at.getHours() >= ANNOUNCEMENT_DAY_END_HOUR) {
    at.setDate(at.getDate() + 1);
    at.setHours(ANNOUNCEMENT_DAY_START_HOUR, 0, 0, 0);
  }
  return at.getTime() < closes ? at.getTime() : null;
};

/** The notice for a location's published announcement in a bulletin, in the app's language, or none. */
export const getAnnouncementNoticeText = (bulletin: Bulletin, location: Location, language: SupportedLanguage) => {
  const place = bulletin[location];
  const published = typeof place?.announcementsPublishedAt === 'string' && place.announcementsPublishedAt.trim();
  const [text] = place && published ? getBulletinAnnouncements(place, language) : [];
  return text ? { title: getAnnouncementNoticeTitle(language, location), body: text } : null;
};

export const getAnnouncementNoticeId = (sabbath: string) => `announcements:${sabbath}`;

const system = () => getAnnouncementNotifications();

const readLocation = async (): Promise<Location> =>
  (await AsyncStorage.getItem(BULLETIN_LOCATION_STORAGE_KEY).catch(() => null)) === 'brooklyn' ? 'brooklyn' : 'queens';

const readLanguage = async (): Promise<SupportedLanguage> => {
  const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).catch(() => null);
  return saved === 'zh' || saved === 'zh-cn' || saved === 'es' ? saved : 'en';
};

const readEnabled = async () =>
  (await AsyncStorage.getItem(ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY).catch(() => null)) === 'on';

/**
 * Looks at the coming Sabbath's bulletin and sets the notice, or takes away
 * the one waiting when there's nothing to notify of. From the app's root when
 * it opens or comes back, and from the background check. The stored copy does
 * while it's current, so this asks the API at most every half hour.
 */
export const checkAnnouncementNotice = async (now = Date.now()) => {
  const notices = system();
  if (!notices?.available) return 'unavailable';
  if (!(await readEnabled())) {
    await notices.cancel();
    return 'off';
  }
  const permission = await notices.getPermission().catch(() => null);
  if (!permission?.granted || !(await notices.isChannelOn().catch(() => false))) return 'not-allowed';

  const sabbath = getAnnouncementNoticeSabbath(now);
  const id = getAnnouncementNoticeId(sabbath);
  if ((await notices.getPosted()).includes(id)) return 'posted';
  const at = getAnnouncementNoticeTime(now, sabbath);
  if (at === null) {
    await notices.cancel();
    return 'too-late';
  }

  const stored = await readCachedBulletin(sabbath, now);
  const bulletin = stored?.fresh ? stored.bulletin : await fetchBulletin(sabbath).catch(() => stored?.bulletin);
  // Offline, with nothing stored: whatever waits stays.
  if (!bulletin) return 'no-bulletin';
  const [location, language] = await Promise.all([readLocation(), readLanguage()]);
  const notice = getAnnouncementNoticeText(bulletin, location, language);
  if (!notice) {
    await notices.cancel();
    return 'none';
  }
  return notices.schedule({
    id,
    ...notice,
    url: ANNOUNCEMENT_NOTICE_URL,
    at,
    until: getAnnouncementNoticeWindow(sabbath).closes,
  });
};

let enabled = false;
let granted = false;
let channelOn = true;
let language: SupportedLanguage = 'en';
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Whether the phone can show them, so the You tab and the bulletin offer them: not on the web, or before Android 8. */
export const hasAnnouncementNotifications = () => !!system()?.available;

/** What the switch shows: on only if the member wants them and the phone allows them. */
export const getAnnouncementNotificationsOn = () => enabled && granted && channelOn;

export const subscribeAnnouncementNotifications = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Whether the phone allows them, as after the member changed it in Settings. */
export const refreshAnnouncementNotificationPermission = async () => {
  const notices = system();
  const permission = await notices?.getPermission().catch(() => null);
  granted = !!permission?.granted;
  channelOn = (await notices?.isChannelOn().catch(() => true)) ?? true;
  notify();
};

// The background check, loaded only on a phone, so the web and tests needn't
// have Expo's task packages.
const task = () =>
  require('@/services/AnnouncementNotificationTask') as typeof import('@/services/AnnouncementNotificationTask');

/** From the app's root: the member's choice, the channel's words, and a check, as the app opens. */
export const loadAnnouncementNotifications = async (appLanguage: SupportedLanguage) => {
  const notices = system();
  if (!notices?.available) return;
  language = appLanguage;
  enabled = await readEnabled();
  notify();
  await notices.setChannel(words(language).channel, words(language).channelDescription).catch(() => undefined);
  await refreshAnnouncementNotificationPermission();
  await (enabled ? task().startAnnouncementCheck() : task().stopAnnouncementCheck()).catch(() => undefined);
  await checkAnnouncementNotice().catch(() => undefined);
};

/**
 * The switch in the You tab, and the bulletin's offer. Turned on, the phone's
 * question comes at once, or, where the phone won't ask again or the member
 * turned the channel off, its settings open, where the member can allow them.
 */
export const setAnnouncementNotificationsEnabled = async (value: boolean) => {
  const notices = system();
  if (!notices?.available) return;
  enabled = value;
  notify();
  await AsyncStorage.setItem(ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY, value ? 'on' : 'off');
  await AsyncStorage.setItem(ANNOUNCEMENT_OFFER_STORAGE_KEY, 'answered');
  if (!value) {
    await notices.cancel();
    await task().stopAnnouncementCheck().catch(() => undefined);
    return;
  }
  await task().startAnnouncementCheck().catch(() => undefined);
  let permission = await notices.getPermission();
  if (!permission.granted && permission.canAskAgain) {
    permission = await notices.requestPermission();
  } else if (!permission.granted) {
    await notices.openSettings().catch(() => Linking.openSettings());
  } else if (!(await notices.isChannelOn())) {
    await notices.openSettings();
  }
  await refreshAnnouncementNotificationPermission();
  await checkAnnouncementNotice().catch(() => undefined);
};

/** Whether the bulletin still offers them: until the member answers, and while they're off. */
export const shouldOfferAnnouncementNotifications = async () =>
  hasAnnouncementNotifications() &&
  !getAnnouncementNotificationsOn() &&
  (await AsyncStorage.getItem(ANNOUNCEMENT_OFFER_STORAGE_KEY).catch(() => 'answered')) === null;

/** Not now, on the bulletin's offer: it doesn't come back; the You tab's switch stays. */
export const declineAnnouncementNotifications = async () => {
  await AsyncStorage.setItem(ANNOUNCEMENT_OFFER_STORAGE_KEY, 'answered');
};

export const resetAnnouncementNotificationsForTests = () => {
  enabled = false;
  granted = false;
  channelOn = true;
  language = 'en';
  listeners.clear();
};
