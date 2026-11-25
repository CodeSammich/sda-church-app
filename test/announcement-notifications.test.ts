import { CHURCH_LATITUDE, CHURCH_LONGITUDE } from '@/constants/ExternalLinks';
import {
  ANNOUNCEMENT_NOTICE_URL,
  ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY,
  checkAnnouncementNotice,
  declineAnnouncementNotifications,
  getAnnouncementNoticeSabbath,
  getAnnouncementNoticeText,
  getAnnouncementNoticeTime,
  getAnnouncementNoticeWindow,
  getAnnouncementNotificationsOn,
  loadAnnouncementNotifications,
  resetAnnouncementNotificationsForTests,
  setAnnouncementNotificationsEnabled,
  shouldOfferAnnouncementNotifications,
} from '@/services/AnnouncementNotifications';
import type { Bulletin, BulletinLocation } from '@/services/BulletinService';
import { getSunTimes } from '@/services/SunTimesService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'node:fs';

// The notice of a week's announcements (#709): only of one staff published,
// once a Sabbath at most, in the daytime, and not during the Sabbath; off
// until the member turns it on, and never asked at launch. docs/UI_UX.md,
// "Notifications", is the policy.

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.10.0' } } }));

const mockPermission = { status: 'undetermined', granted: false, canAskAgain: true };
const mockPhone = {
  available: true,
  channelOn: true,
  posted: [] as string[],
  setChannel: jest.fn(async () => undefined),
  getPermission: jest.fn(async () => ({ ...mockPermission })),
  requestPermission: jest.fn(async (): Promise<typeof mockPermission> => {
    Object.assign(mockPermission, { status: 'granted', granted: true, canAskAgain: false });
    return { ...mockPermission };
  }),
  isChannelOn: jest.fn(async (): Promise<boolean> => mockPhone.channelOn),
  schedule: jest.fn(async () => 'scheduled'),
  cancel: jest.fn(async () => undefined),
  getPosted: jest.fn(async (): Promise<string[]> => mockPhone.posted),
  openSettings: jest.fn(async () => undefined),
};
jest.mock('@/modules/announcement-notifications', () => ({ getAnnouncementNotifications: () => mockPhone }));
const mockCheck = { start: jest.fn(async () => undefined), stop: jest.fn(async () => undefined) };
jest.mock('@/services/AnnouncementNotificationTask', () => ({
  startAnnouncementCheck: () => mockCheck.start(),
  stopAnnouncementCheck: () => mockCheck.stop(),
}));

const sunset = (year: number, month: number, day: number) =>
  getSunTimes(CHURCH_LATITUDE, CHURCH_LONGITUDE, new Date(year, month - 1, day, 12))!.sunset.getTime();
const at = (year: number, month: number, day: number, hour: number, minute = 0) =>
  new Date(year, month - 1, day, hour, minute).getTime();

// The Sabbath of 2026-11-28: Tuesday the 24th is in its week.
const SABBATH = '2026-11-28';
const TUESDAY_10_AM = at(2026, 11, 24, 10);

const place = (overrides: Partial<BulletinLocation> = {}): BulletinLocation => ({
  hymnOfPraise: { english: '', chinese: '' },
  sermonTitle: { english: '', chinese: '' },
  hymnOfResponse: { english: '', chinese: '' },
  bibleVerses: '',
  sermon: '',
  chairPastoralPrayer: '',
  offeringPrayer: '',
  ...overrides,
});
const LUNCH = { english: 'Fellowship lunch after the service.', chinese: '崇拜後有愛筵。', spanish: 'Almuerzo después del culto.' };
const PUBLISHED = '2026-11-24T14:02:11.000Z';
const bulletin = (queens: Partial<BulletinLocation>, brooklyn: Partial<BulletinLocation> = {}): Bulletin => ({
  date: SABBATH,
  quarter: '',
  specialRemark: '',
  tithePurpose: '',
  pastorTravel: '',
  queens: place(queens),
  brooklyn: place(brooklyn),
});

const answerApi = (answer: Bulletin) =>
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true, bulletin: answer }) } as Response);

const turnedOn = async () => {
  await AsyncStorage.setItem(ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY, 'on');
  Object.assign(mockPermission, { status: 'granted', granted: true, canAskAgain: false });
};

beforeEach(async () => {
  resetAnnouncementNotificationsForTests();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  Object.assign(mockPermission, { status: 'undetermined', granted: false, canAskAgain: true });
  mockPhone.available = true;
  mockPhone.channelOn = true;
  mockPhone.posted = [];
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('when the notice may come', () => {
  it('opens at sunset as the Sabbath before ends, and closes at sunset on Friday', () => {
    expect(getAnnouncementNoticeWindow(SABBATH)).toEqual({ opens: sunset(2026, 11, 21), closes: sunset(2026, 11, 27) });
  });

  it('is for the coming Sabbath until it begins, then the next', () => {
    expect(getAnnouncementNoticeSabbath(TUESDAY_10_AM)).toBe(SABBATH);
    expect(getAnnouncementNoticeSabbath(sunset(2026, 11, 27) - 60_000)).toBe(SABBATH);
    expect(getAnnouncementNoticeSabbath(sunset(2026, 11, 27) + 60_000)).toBe('2026-12-05');
    expect(getAnnouncementNoticeSabbath(at(2026, 11, 28, 10))).toBe('2026-12-05');
  });

  it('is at once in the daytime, or else at the next 9 am', () => {
    expect(getAnnouncementNoticeTime(TUESDAY_10_AM, SABBATH)).toBe(TUESDAY_10_AM);
    expect(getAnnouncementNoticeTime(at(2026, 11, 24, 6), SABBATH)).toBe(at(2026, 11, 24, 9));
    expect(getAnnouncementNoticeTime(at(2026, 11, 24, 20), SABBATH)).toBe(at(2026, 11, 25, 9));
    expect(getAnnouncementNoticeTime(at(2026, 11, 24, 23, 30), SABBATH)).toBe(at(2026, 11, 25, 9));
  });

  it('never comes during the Sabbath, or once it has begun', () => {
    expect(getAnnouncementNoticeTime(sunset(2026, 11, 27) + 60_000, SABBATH)).toBeNull();
    // Published during the Sabbath for the next one: not before this one ends,
    // and in the daytime.
    const next = getAnnouncementNoticeTime(at(2026, 11, 28, 10), '2026-12-05')!;
    expect(next).toBeGreaterThanOrEqual(sunset(2026, 11, 28));
    expect(new Date(next).getHours()).toBeGreaterThanOrEqual(9);
    expect(new Date(next).getHours()).toBeLessThan(20);
    expect(next - sunset(2026, 11, 28)).toBeLessThan(24 * 60 * 60 * 1000);
  });
});

describe('what the notice says', () => {
  it('is only of a published announcement, in the reader’s language, for their location', () => {
    expect(getAnnouncementNoticeText(bulletin({ announcements: [LUNCH] }), 'queens', 'en')).toBeNull();
    expect(getAnnouncementNoticeText(bulletin({ announcements: [LUNCH], announcementsPublishedAt: '' }), 'queens', 'en')).toBeNull();
    expect(getAnnouncementNoticeText(bulletin({ announcementsPublishedAt: PUBLISHED }), 'queens', 'en')).toBeNull();

    const published = bulletin({ announcements: [LUNCH], announcementsPublishedAt: PUBLISHED });
    expect(getAnnouncementNoticeText(published, 'queens', 'en')).toEqual({
      title: 'Announcements · Queens',
      body: 'Fellowship lunch after the service.',
    });
    expect(getAnnouncementNoticeText(published, 'queens', 'zh')).toEqual({ title: '報告事項 · 皇后區', body: '崇拜後有愛筵。' });
    expect(getAnnouncementNoticeText(published, 'queens', 'zh-cn')).toEqual({ title: '报告事项 · 皇后区', body: '崇拜后有爱筵。' });
    expect(getAnnouncementNoticeText(published, 'queens', 'es')).toEqual({
      title: 'Anuncios · Queens',
      body: 'Almuerzo después del culto.',
    });
    // Brooklyn's own, published or not.
    expect(getAnnouncementNoticeText(published, 'brooklyn', 'en')).toBeNull();
  });
});

describe('the check', () => {
  it('does nothing until the member turns it on, and takes away any waiting', async () => {
    const fetch = answerApi(bulletin({ announcements: [LUNCH], announcementsPublishedAt: PUBLISHED }));
    expect(await checkAnnouncementNotice(TUESDAY_10_AM)).toBe('off');
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPhone.cancel).toHaveBeenCalled();
    expect(mockPhone.schedule).not.toHaveBeenCalled();
  });

  it('sets the notice for a published announcement, in the member’s language and location, opening the bulletin', async () => {
    await turnedOn();
    await AsyncStorage.multiSet([
      ['user-language', 'zh'],
      ['preferred-bulletin-location', 'brooklyn'],
    ]);
    answerApi(bulletin({}, { announcements: [LUNCH], announcementsPublishedAt: PUBLISHED }));

    expect(await checkAnnouncementNotice(at(2026, 11, 24, 22))).toBe('scheduled');
    expect(mockPhone.schedule).toHaveBeenCalledWith({
      id: `announcements:${SABBATH}`,
      title: '報告事項 · 布魯克林',
      body: '崇拜後有愛筵。',
      url: ANNOUNCEMENT_NOTICE_URL,
      at: at(2026, 11, 25, 9),
      until: sunset(2026, 11, 27),
    });
    expect(ANNOUNCEMENT_NOTICE_URL).toBe('sdachurchapp://home/bulletin');
  });

  it('sets none for an announcement not yet published, and takes away one waiting', async () => {
    await turnedOn();
    answerApi(bulletin({ announcements: [LUNCH] }));
    expect(await checkAnnouncementNotice(TUESDAY_10_AM)).toBe('none');
    expect(mockPhone.schedule).not.toHaveBeenCalled();
    expect(mockPhone.cancel).toHaveBeenCalled();
  });

  it('asks nothing once this Sabbath’s was posted: one a Sabbath at most', async () => {
    await turnedOn();
    mockPhone.posted = [`announcements:${SABBATH}`];
    const fetch = answerApi(bulletin({ announcements: [LUNCH], announcementsPublishedAt: PUBLISHED }));
    expect(await checkAnnouncementNotice(TUESDAY_10_AM)).toBe('posted');
    expect(fetch).not.toHaveBeenCalled();
    expect(mockPhone.schedule).not.toHaveBeenCalled();
  });

  it('sets none where the phone doesn’t allow them, or the member turned the channel off', async () => {
    await AsyncStorage.setItem(ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY, 'on');
    answerApi(bulletin({ announcements: [LUNCH], announcementsPublishedAt: PUBLISHED }));
    expect(await checkAnnouncementNotice(TUESDAY_10_AM)).toBe('not-allowed');

    await turnedOn();
    mockPhone.channelOn = false;
    expect(await checkAnnouncementNotice(TUESDAY_10_AM)).toBe('not-allowed');
    expect(mockPhone.schedule).not.toHaveBeenCalled();
  });

  it('keeps what waits when the bulletin can’t be had', async () => {
    await turnedOn();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await checkAnnouncementNotice(TUESDAY_10_AM)).toBe('no-bulletin');
    expect(mockPhone.cancel).not.toHaveBeenCalled();
    expect(mockPhone.schedule).not.toHaveBeenCalled();
  });

  it('does nothing on the web, or on a phone that can’t show them', async () => {
    mockPhone.available = false;
    await turnedOn();
    expect(await checkAnnouncementNotice(TUESDAY_10_AM)).toBe('unavailable');
    expect(mockPhone.cancel).not.toHaveBeenCalled();
  });
});

describe('turning it on and off', () => {
  it('is off until the member turns it on, and never asks at launch', async () => {
    await loadAnnouncementNotifications('es');
    expect(getAnnouncementNotificationsOn()).toBe(false);
    expect(mockPhone.requestPermission).not.toHaveBeenCalled();
    expect(mockPhone.openSettings).not.toHaveBeenCalled();
    expect(mockPhone.setChannel).toHaveBeenCalledWith('Anuncios', 'Los anuncios de la iglesia, una vez por semana como máximo');
    expect(mockCheck.start).not.toHaveBeenCalled();
    expect(mockCheck.stop).toHaveBeenCalled();
    // And nothing in the code that runs at launch asks.
    const source = readFileSync('services/AnnouncementNotifications.ts', 'utf8');
    const load = source.slice(source.indexOf('export const loadAnnouncementNotifications'), source.indexOf('export const setAnnouncementNotificationsEnabled'));
    expect(load).not.toMatch(/requestPermission|openSettings/);
  });

  it('asks the phone at once when turned on, and starts the background check', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    await setAnnouncementNotificationsEnabled(true);
    expect(mockPhone.requestPermission).toHaveBeenCalledTimes(1);
    expect(mockCheck.start).toHaveBeenCalled();
    expect(getAnnouncementNotificationsOn()).toBe(true);
    expect(await AsyncStorage.getItem(ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY)).toBe('on');

    await setAnnouncementNotificationsEnabled(false);
    expect(getAnnouncementNotificationsOn()).toBe(false);
    expect(mockPhone.cancel).toHaveBeenCalled();
    expect(mockCheck.stop).toHaveBeenCalled();
  });

  it('opens the settings where the phone won’t ask again, or the channel is off', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    Object.assign(mockPermission, { status: 'denied', granted: false, canAskAgain: false });
    await setAnnouncementNotificationsEnabled(true);
    expect(mockPhone.requestPermission).not.toHaveBeenCalled();
    expect(mockPhone.openSettings).toHaveBeenCalledTimes(1);
    expect(getAnnouncementNotificationsOn()).toBe(false);

    Object.assign(mockPermission, { status: 'granted', granted: true, canAskAgain: false });
    mockPhone.channelOn = false;
    await setAnnouncementNotificationsEnabled(true);
    expect(mockPhone.openSettings).toHaveBeenCalledTimes(2);
    expect(getAnnouncementNotificationsOn()).toBe(false);
  });

  it('offers it in the bulletin once: until the member answers, and not where it can’t be had', async () => {
    expect(await shouldOfferAnnouncementNotifications()).toBe(true);
    await declineAnnouncementNotifications();
    expect(await shouldOfferAnnouncementNotifications()).toBe(false);

    await AsyncStorage.clear();
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
    await setAnnouncementNotificationsEnabled(true);
    await setAnnouncementNotificationsEnabled(false);
    expect(await shouldOfferAnnouncementNotifications()).toBe(false);

    await AsyncStorage.clear();
    mockPhone.available = false;
    expect(await shouldOfferAnnouncementNotifications()).toBe(false);
  });
});

describe('the background check', () => {
  it('is defined when the app’s entry loads, before Expo Router starts it', () => {
    const entry = readFileSync('index.ts', 'utf8');
    expect(entry.indexOf("import './services/AnnouncementNotificationTask';")).toBeGreaterThanOrEqual(0);
    expect(entry.indexOf("import './services/AnnouncementNotificationTask';")).toBeLessThan(entry.indexOf("import 'expo-router/entry';"));
    expect(JSON.parse(readFileSync('package.json', 'utf8')).main).toBe('index.ts');
  });

  it('checks every few hours, once turned on', async () => {
    await jest.isolateModulesAsync(async () => {
      const defineTask = jest.fn();
      const registerTaskAsync = jest.fn(async () => undefined);
      jest.doMock('expo-task-manager', () => ({ defineTask, isTaskRegisteredAsync: async () => false }));
      jest.doMock('expo-background-task', () => ({
        BackgroundTaskResult: { Success: 1, Failed: 2 },
        BackgroundTaskStatus: { Restricted: 1, Available: 2 },
        getStatusAsync: async () => 2,
        registerTaskAsync,
        unregisterTaskAsync: jest.fn(),
      }));
      const task = jest.requireActual('@/services/AnnouncementNotificationTask');
      expect(defineTask).toHaveBeenCalledWith('announcement-notice-check', expect.any(Function));
      expect(task.ANNOUNCEMENT_CHECK_MINUTES).toBe(180);
      await task.startAnnouncementCheck();
      expect(registerTaskAsync).toHaveBeenCalledWith('announcement-notice-check', { minimumInterval: 180 });
    });
  });
});
