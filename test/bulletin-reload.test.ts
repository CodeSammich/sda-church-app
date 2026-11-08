import { act, fireEvent, screen } from '@testing-library/react-native';
import { createElement, type ComponentType } from 'react';
import { AppState } from 'react-native';

import { customLightTheme } from '@/constants/Themes';
import {
  type Bulletin,
  type BulletinLocation,
  cacheBulletin,
  getRefreshAvailableAt,
} from '@/services/BulletinService';
import { renderWithPreferences } from './helpers/render-preferences';

// When the bulletin page asks the Bulletin API again (#702): it shows a stored
// copy at once and asks for a newer one only once that copy is out of date.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.6.0' } },
}));

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: { Screen: () => null },
}));

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('@/features/sabbath-school/AdultLesson', () => ({
  findAdultLesson: async () => null,
  formatAdultLesson: () => '',
}));

const WeeklyBulletinScreen: ComponentType = require('@/app/(tabs)/home/bulletin').default;

const MINUTE = 60 * 1000;
// A Tuesday, with this Sabbath on 2026-08-08.
const TUESDAY = new Date(2026, 7, 4, 10).getTime();

const location = (sermonTitle: string): BulletinLocation => ({
  hymnOfPraise: { english: '', chinese: '' },
  sermonTitle: { english: sermonTitle, chinese: '' },
  hymnOfResponse: { english: '', chinese: '' },
  bibleVerses: '',
  sermon: 'Avery Lin',
  chairPastoralPrayer: '',
  offeringPrayer: '',
});

const bulletinWith = (sermonTitle: string, date = '2026-08-08'): Bulletin => ({
  date,
  quarter: '',
  specialRemark: '',
  tithePurpose: '',
  pastorTravel: '',
  queens: location(sermonTitle),
  brooklyn: location(sermonTitle),
});

// Each request waits until the test answers it.
let requests: { url: string; answer: (bulletin: Bulletin) => void; fail: () => void }[];
let appStateListeners: ((state: string) => void)[];

beforeEach(() => {
  jest.useFakeTimers({ now: TUESDAY });
  requests = [];
  jest.spyOn(global, 'fetch').mockImplementation(
    (url) =>
      new Promise((resolve, reject) => {
        requests.push({
          url: String(url),
          answer: (bulletin) =>
            resolve({ ok: true, json: async () => ({ ok: true, bulletin }) } as Response),
          fail: () => reject(new Error('Bulletin request failed (503)')),
        });
      }),
  );
  appStateListeners = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListeners.push(listener as (state: string) => void);
    return {
      remove: () => {
        appStateListeners = appStateListeners.filter((other) => other !== listener);
      },
    } as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
});

// Lets the stored-copy reads and the state updates after them finish.
const settle = () => act(async () => {
  for (let step = 0; step < 20; step += 1) await Promise.resolve();
});

const openBulletin = async () => {
  await renderWithPreferences(createElement(WeeklyBulletinScreen), { theme: customLightTheme });
  await settle();
};

const comeBackToTheApp = async () => {
  await act(async () => appStateListeners.forEach((listener) => listener('active')));
  await settle();
};

const wait = async (ms: number) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await settle();
};

const isShowing = (text: string) => screen.queryAllByText(text).length > 0;
const spinnerShowing = () => isShowing('Loading bulletin…');

describe('bulletin page reloads (#702)', () => {
  it('shows a stored copy at once and asks nothing while it is under 30 minutes old', async () => {
    await cacheBulletin(bulletinWith('Grace Abounds'), TUESDAY - 10 * MINUTE);

    await openBulletin();
    expect(isShowing('Grace Abounds')).toBe(true);
    expect(spinnerShowing()).toBe(false);
    expect(requests).toHaveLength(0);

    // Back to the app 19 minutes later: the copy is 29 minutes old.
    await wait(19 * MINUTE);
    await comeBackToTheApp();
    expect(requests).toHaveLength(0);

    // Two minutes after that, it's 31 minutes old.
    await wait(2 * MINUTE);
    await comeBackToTheApp();
    expect(requests).toHaveLength(1);
    expect(requests[0].url).toContain('date=2026-08-08');
  });

  it('shows an out-of-date copy with no spinner, then swaps in the new one', async () => {
    await cacheBulletin(bulletinWith('Grace Abounds'), TUESDAY - 31 * MINUTE);

    await openBulletin();
    expect(requests).toHaveLength(1);
    expect(isShowing('Grace Abounds')).toBe(true);
    expect(spinnerShowing()).toBe(false);

    await act(async () => requests[0].answer(bulletinWith('Faith That Waits')));
    await settle();
    expect(isShowing('Faith That Waits')).toBe(true);
    expect(isShowing('Grace Abounds')).toBe(false);

    // The new copy counts from now, so coming back soon asks nothing.
    await wait(5 * MINUTE);
    await comeBackToTheApp();
    expect(requests).toHaveLength(1);
  });

  it('shows the spinner only when the phone has no copy yet', async () => {
    await openBulletin();
    expect(requests).toHaveLength(1);
    expect(spinnerShowing()).toBe(true);

    await act(async () => requests[0].answer(bulletinWith('Grace Abounds')));
    await settle();
    expect(spinnerShowing()).toBe(false);
    expect(isShowing('Grace Abounds')).toBe(true);
  });

  it('asks again after an app update, since another version saved the copy', async () => {
    await cacheBulletin(bulletinWith('Grace Abounds'), TUESDAY - MINUTE);
    const { mockFiles } = require('./helpers/file-system-mock');
    const path = 'cache/bulletins/2026-08-08.json';
    mockFiles.set(path, JSON.stringify({ ...JSON.parse(mockFiles.get(path)), appVersion: '1.5.0' }));

    await openBulletin();
    expect(requests).toHaveLength(1);
    expect(isShowing('Grace Abounds')).toBe(true);
    expect(spinnerShowing()).toBe(false);
  });

  it('keeps the stored copy when a request fails, and the next look asks again', async () => {
    await cacheBulletin(bulletinWith('Grace Abounds'), TUESDAY - 31 * MINUTE);

    await openBulletin();
    await act(async () => requests[0].fail());
    await settle();
    expect(isShowing('Grace Abounds')).toBe(true);
    expect(isShowing('Bulletin request failed (503)')).toBe(true);

    // The failure didn't make the copy any newer.
    await wait(MINUTE);
    await comeBackToTheApp();
    expect(requests).toHaveLength(2);
  });

  it('checks the age when switching weeks', async () => {
    await cacheBulletin(bulletinWith('Grace Abounds'), TUESDAY - 5 * MINUTE);
    await cacheBulletin(bulletinWith('Next Sabbath', '2026-08-15'), TUESDAY - 40 * MINUTE);

    await openBulletin();
    expect(requests).toHaveLength(0);

    await fireEvent.press(screen.getByText('Next Week'));
    await settle();
    expect(isShowing('Next Sabbath')).toBe(true);
    expect(spinnerShowing()).toBe(false);
    expect(requests.map(({ url }) => url)).toEqual([expect.stringContaining('date=2026-08-15')]);
  });

  it('lets Refresh ask again after 2 minutes', async () => {
    await cacheBulletin(bulletinWith('Grace Abounds'), TUESDAY - MINUTE);
    await openBulletin();
    expect(requests).toHaveLength(0);

    await fireEvent.press(screen.getByLabelText('Refresh'));
    await settle();
    expect(requests).toHaveLength(1);
    expect(spinnerShowing()).toBe(true);
    await act(async () => requests[0].answer(bulletinWith('Faith That Waits')));
    await settle();
    expect(isShowing('Faith That Waits')).toBe(true);
    expect(await getRefreshAvailableAt('2026-08-08')).toBe(TUESDAY + 2 * MINUTE);

    await wait(MINUTE);
    expect(screen.getByLabelText('Refresh (1:00)')).toBeDisabled();

    await wait(MINUTE);
    const refresh = screen.getByLabelText('Refresh');
    expect(refresh).not.toBeDisabled();
    await fireEvent.press(refresh);
    await settle();
    expect(requests).toHaveLength(2);
  });

  it('lets a Refresh during a download already under way wait for it, rather than ask twice', async () => {
    await cacheBulletin(bulletinWith('Grace Abounds'), TUESDAY - 31 * MINUTE);
    await openBulletin();
    expect(requests).toHaveLength(1);
    expect(spinnerShowing()).toBe(false);

    await fireEvent.press(screen.getByLabelText('Refresh'));
    await settle();
    expect(requests).toHaveLength(1);
    expect(spinnerShowing()).toBe(true);

    await act(async () => requests[0].answer(bulletinWith('Faith That Waits')));
    await settle();
    expect(spinnerShowing()).toBe(false);
    expect(isShowing('Faith That Waits')).toBe(true);
  });

  it('asks again at a random moment in the 5 minutes after the Sabbath begins', async () => {
    const fridayNight = new Date(2026, 7, 7, 23, 50).getTime();
    jest.setSystemTime(fridayNight);
    await cacheBulletin(bulletinWith('Grace Abounds'), fridayNight - 5 * MINUTE);
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    await openBulletin();
    expect(requests).toHaveLength(0);

    // The Sabbath begins in 10 minutes; this phone waits 1 second and then
    // half of the 5 minutes more.
    const delay = 10 * MINUTE + 1000 + 2.5 * MINUTE;
    await wait(delay - 1000);
    expect(requests).toHaveLength(0);
    await wait(1000);
    expect(requests).toHaveLength(1);
    expect(spinnerShowing()).toBe(false);
  });

  it('asks within 5 minutes and 1 second of the Sabbath beginning, however late the random pick', async () => {
    const fridayNight = new Date(2026, 7, 7, 23, 50).getTime();
    jest.setSystemTime(fridayNight);
    await cacheBulletin(bulletinWith('Grace Abounds'), fridayNight - 5 * MINUTE);
    jest.spyOn(Math, 'random').mockReturnValue(0.9999999);

    await openBulletin();
    await wait(10 * MINUTE + 5 * MINUTE + 1000);
    expect(requests).toHaveLength(1);
  });
});
