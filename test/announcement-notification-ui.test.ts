import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { createElement, type ComponentType } from 'react';

import type { SupportedLanguage } from '@/constants/LanguageContext';
import { customLightTheme } from '@/constants/Themes';
import {
  ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY,
  ANNOUNCEMENT_OFFER_STORAGE_KEY,
  resetAnnouncementNotificationsForTests,
} from '@/services/AnnouncementNotifications';
import type { Bulletin, BulletinLocation } from '@/services/BulletinService';
import { renderWithPreferences } from './helpers/render-preferences';

// Where the member meets the announcements' notice (#709): offered once below
// the bulletin's announcements, and a switch in the You tab. Phones only.

jest.mock('expo-constants', () => ({ __esModule: true, default: { expoConfig: { version: '1.10.0' } } }));
jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
  useLocalSearchParams: () => ({}),
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/features/sabbath-school/AdultLesson', () => ({ findAdultLesson: async () => null, formatAdultLesson: () => '' }));
jest.mock('@/app/_layout', () => ({
  UpdateContext: require('react').createContext({ onManualCheck: () => undefined, updateStatus: 'idle' }),
}));
jest.mock('@/hooks/useBibleAudioDownloads', () => ({ useDownloadedBibleAudioBytes: () => 0 }));

const mockPhone = {
  available: true,
  granted: false,
  setChannel: jest.fn(async () => undefined),
  getPermission: jest.fn(async () => ({ status: mockPhone.granted ? 'granted' : 'undetermined', granted: mockPhone.granted, canAskAgain: !mockPhone.granted })),
  requestPermission: jest.fn(async () => {
    mockPhone.granted = true;
    return { status: 'granted', granted: true, canAskAgain: false };
  }),
  isChannelOn: jest.fn(async () => true),
  schedule: jest.fn(async () => 'scheduled'),
  cancel: jest.fn(async () => undefined),
  getPosted: jest.fn(async () => []),
  openSettings: jest.fn(async () => undefined),
};
jest.mock('@/modules/announcement-notifications', () => ({
  getAnnouncementNotifications: () => (mockPhone.available ? mockPhone : null),
}));
jest.mock('@/services/AnnouncementNotificationTask', () => ({
  startAnnouncementCheck: async () => undefined,
  stopAnnouncementCheck: async () => undefined,
}));

const WeeklyBulletinScreen: ComponentType = require('@/app/(tabs)/home/bulletin').default;
const YouScreen: ComponentType = require('@/app/(tabs)/you/index').default;

const TUESDAY = new Date(2026, 7, 4, 10).getTime();
const place = (overrides: Partial<BulletinLocation> = {}): BulletinLocation => ({
  hymnOfPraise: { english: '', chinese: '' },
  sermonTitle: { english: 'The Good Shepherd', chinese: '好牧人' },
  hymnOfResponse: { english: '', chinese: '' },
  bibleVerses: '',
  sermon: 'Avery Lin',
  chairPastoralPrayer: '',
  offeringPrayer: '',
  ...overrides,
});
const BULLETIN: Bulletin = {
  date: '2026-08-08',
  quarter: '',
  specialRemark: '',
  tithePurpose: '',
  pastorTravel: '',
  queens: place({ announcements: [{ english: 'Fellowship lunch after the service.', chinese: '崇拜後有愛筵。' }] }),
  brooklyn: place(),
};

// Until the page and what a press started are done: time moves on, as the
// bulletin's stored copy and the check wait on timers.
const settle = async () => {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
};

const open = async (screenComponent: ComponentType, language: SupportedLanguage = 'en') => {
  jest.spyOn(global, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ ok: true, bulletin: BULLETIN }) } as Response);
  await renderWithPreferences(createElement(screenComponent), { theme: customLightTheme, language });
  await settle();
};

const OFFER = 'Get a notification when the church publishes the announcements for Queens? Once a week at most.';

beforeEach(async () => {
  jest.useFakeTimers({ now: TUESDAY, advanceTimers: true });
  resetAnnouncementNotificationsForTests();
  await AsyncStorage.clear();
  mockPhone.available = true;
  mockPhone.granted = false;
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('the bulletin’s offer', () => {
  it('comes below the announcements, for the location shown, and Turn on asks the phone', async () => {
    await open(WeeklyBulletinScreen);
    expect(screen.getByText(OFFER)).toBeTruthy();
    expect(mockPhone.requestPermission).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText('Turn on'));
    await settle();
    expect(mockPhone.requestPermission).toHaveBeenCalledTimes(1);
    expect(await AsyncStorage.getItem(ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY)).toBe('on');
    expect(screen.queryByText(OFFER)).toBeNull();
  });

  it('goes for good after Not now, which asks nothing', async () => {
    await open(WeeklyBulletinScreen);
    await fireEvent.press(screen.getByText('Not now'));
    await settle();
    expect(screen.queryByText(OFFER)).toBeNull();
    expect(await AsyncStorage.getItem(ANNOUNCEMENT_OFFER_STORAGE_KEY)).toBe('answered');
    expect(await AsyncStorage.getItem(ANNOUNCEMENT_NOTIFICATIONS_STORAGE_KEY)).toBeNull();
    expect(mockPhone.requestPermission).not.toHaveBeenCalled();
  });

  it('is in the reader’s language', async () => {
    await open(WeeklyBulletinScreen, 'zh-cn');
    expect(screen.getByText('教会发布皇后区的报告事项时通知您？每周最多一次。')).toBeTruthy();
    expect(screen.getByText('开启')).toBeTruthy();
  });

  it('isn’t there on the web', async () => {
    mockPhone.available = false;
    await open(WeeklyBulletinScreen);
    expect(screen.getByText('Fellowship lunch after the service.')).toBeTruthy();
    expect(screen.queryByText(OFFER)).toBeNull();
  });
});

describe('the You tab’s switch', () => {
  it('is off until turned on, and turning it on asks the phone', async () => {
    await open(YouScreen);
    const row = screen.getByRole('switch', { name: /Announcement notifications/ });
    expect(row.props.accessibilityState).toMatchObject({ checked: false });
    expect(screen.getByText('Once a week at most, when the church publishes them')).toBeTruthy();

    await fireEvent.press(row);
    await settle();
    expect(mockPhone.requestPermission).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('switch', { name: /Announcement notifications/ }).props.accessibilityState).toMatchObject({
      checked: true,
    });
  });

  it('isn’t there on the web', async () => {
    mockPhone.available = false;
    await open(YouScreen);
    expect(screen.queryByText('Announcement notifications')).toBeNull();
  });
});
