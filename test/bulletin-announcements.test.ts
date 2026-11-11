import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, screen } from '@testing-library/react-native';
import { createElement, type ComponentType } from 'react';
import type { ReactTestRendererJSON } from 'react-test-renderer';

import type { SupportedLanguage } from '@/constants/LanguageContext';
import { customLightTheme } from '@/constants/Themes';
import type { Bulletin, BulletinLocation } from '@/services/BulletinService';
import { renderWithPreferences } from './helpers/render-preferences';

// The bulletin page's Announcements section (#562): the week's announcements
// from Weekly Data, the same ones the printed bulletin has, after the program.

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.9.0' } },
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

// A Tuesday, with this Sabbath on 2026-08-08.
const TUESDAY = new Date(2026, 7, 4, 10).getTime();

const location = (announcements?: BulletinLocation['announcements']): BulletinLocation => ({
  hymnOfPraise: { english: '', chinese: '' },
  sermonTitle: { english: 'The Good Shepherd', chinese: '好牧人' },
  hymnOfResponse: { english: '', chinese: '' },
  bibleVerses: '',
  sermon: 'Avery Lin',
  chairPastoralPrayer: '',
  offeringPrayer: '',
  ...(announcements === undefined ? {} : { announcements }),
});

const bulletin = (queens: BulletinLocation): Bulletin => ({
  date: '2026-08-08',
  quarter: '',
  specialRemark: '',
  tithePurpose: '',
  pastorTravel: '',
  queens,
  brooklyn: location(),
});

const openBulletin = async (answer: Bulletin, language: SupportedLanguage = 'en') => {
  jest.spyOn(global, 'fetch').mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, bulletin: answer }),
  } as Response);
  await renderWithPreferences(createElement(WeeklyBulletinScreen), { theme: customLightTheme, language });
  await act(async () => {
    for (let step = 0; step < 20; step += 1) await Promise.resolve();
  });
};

const ANNOUNCEMENTS = [
  { english: 'Fellowship lunch after the service.', chinese: '崇拜後有愛筵，歡迎大家參加。', spanish: 'Almuerzo después del culto.' },
  { english: 'Choir practice at 2 pm.', chinese: '', spanish: '' },
];

// Every text on the page, in order.
const pageText = () => {
  const texts: string[] = [];
  const walk = (node: ReactTestRendererJSON | ReactTestRendererJSON[] | string | null) => {
    if (node === null) return;
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) node.forEach(walk);
    else (node.children || []).forEach(walk);
  };
  walk(screen.toJSON() as ReactTestRendererJSON | ReactTestRendererJSON[] | null);
  return texts;
};

beforeEach(async () => {
  jest.useFakeTimers({ now: TUESDAY });
  await AsyncStorage.clear();
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('bulletin announcements (#562)', () => {
  it('lists them after the program and before the roster', async () => {
    await openBulletin(bulletin(location(ANNOUNCEMENTS)));

    const text = pageText();
    const heading = text.indexOf('Announcements');
    expect(heading).toBeGreaterThan(text.indexOf('Worship Program'));
    expect(text.slice(heading + 1, heading + 3)).toEqual([
      'Fellowship lunch after the service.',
      'Choir practice at 2 pm.',
    ]);
    expect(text.indexOf('Service Roster')).toBeGreaterThan(heading);
  });

  it("shows them in the reader's language, with the other where a translation is missing", async () => {
    await openBulletin(bulletin(location(ANNOUNCEMENTS)), 'zh');

    expect(screen.getByText('報告事項')).toBeTruthy();
    expect(screen.getByText('崇拜後有愛筵，歡迎大家參加。')).toBeTruthy();
    expect(screen.getByText('Choir practice at 2 pm.')).toBeTruthy();
  });

  it.each([
    ['there are none', []],
    ['the bulletin is from before them, with a blank string', ''],
    ['the bulletin is from before them, with nothing', undefined],
  ])('has no section when %s', async (_, announcements) => {
    await openBulletin(bulletin(location(announcements)));
    expect(screen.getByText('Service Roster')).toBeTruthy();
    expect(screen.queryByText('Announcements')).toBeNull();
  });
});
