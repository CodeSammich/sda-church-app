import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { PaperProvider } from 'react-native-paper';

import AboutChurchHistoryScreen from '@/app/(tabs)/home/about-my-church';
import DiscoverScreen from '@/app/(tabs)/home/discover';
import FellowshipsScreen from '@/app/(tabs)/home/fellowship';
import { ADDRESS_AND_SERVICE_TIMES_LABELS } from '@/components/AddressAndServiceTimes';
import {
  CHURCH_LOCATIONS,
  CHURCH_SERVICE_TIMES,
  getLocationNames,
  getServiceTimes,
} from '@/constants/ChurchData';
import { openInMaps } from '@/constants/ExternalLinks';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';

const mockScreenOptions: Array<Record<string, unknown>> = [];

jest.mock('expo-router', () => ({
  router: { push: jest.fn() },
  Stack: {
    Screen: ({ options }: { options: Record<string, unknown> }) => {
      mockScreenOptions.push(options);
      return null;
    },
  },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  openInMaps: jest.fn(),
}));
jest.mock('@/components/VerseHero', () => ({ VerseHero: () => null }));
jest.mock('@/components/ImageBackground', () => ({
  ImageBackground: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
jest.mock('@/components/GridMenuCard', () => {
  const { Text } = require('react-native');
  return {
    GridMenuCard: ({ title }: { title: string }) => require('react').createElement(Text, { testID: 'grid-card' }, title),
  };
});
jest.mock('@/hooks/useHeroHeaderTitle', () => ({
  useHeroHeaderTitle: () => ({ showHeaderTitle: false, handleHeroScroll: jest.fn() }),
}));
jest.mock('@/hooks/useGlobalHeaderHeight', () => ({ useGlobalHeaderHeight: () => 100 }));
jest.mock('@/constants/Themes', () => ({
  useAppTheme: () => ({
    dark: false,
    gradients: { heroOverlay: ['#000000', '#000000'] },
    colors: new Proxy({}, { get: () => '#000000' }),
  }),
}));
jest.mock('@/styles/DocumentStyles', () => ({
  useDocumentStyles: () => new Proxy({}, { get: () => ({}) }),
}));
jest.mock('@/styles/NavigationStyles', () => ({
  useNavigationStyles: () => new Proxy({}, { get: () => ({}) }),
}));

const LANGUAGES: SupportedLanguage[] = ['en', 'zh', 'zh-cn', 'es'];

const renderIn = async (language: SupportedLanguage, Screen: React.ComponentType) =>
  await render(
    React.createElement(
      PaperProvider,
      null,
      React.createElement(
        LanguageContext.Provider,
        { value: { language, languageSelectionRevision: 0, setLanguage: () => {} } },
        React.createElement(Screen),
      ),
    ),
  );

/** Every rendered string, in the order the page shows it. */
const textsOf = (node: unknown): string[] => {
  if (node == null || typeof node === 'boolean') return [];
  if (typeof node === 'string' || typeof node === 'number') return [String(node)];
  if (Array.isArray(node)) return node.flatMap(textsOf);
  const element = node as { type?: string; children?: unknown[] };
  if (element.type === 'Text') return [(element.children || []).flatMap(textsOf).join('')];
  return (element.children || []).flatMap(textsOf);
};

beforeEach(() => {
  mockScreenOptions.length = 0;
});

describe('Address & Service Times on New Member & Visitor (#793)', () => {
  it.each(LANGUAGES)('comes first in %s, above the cards, with each location', async (language) => {
    const view = await renderIn(language, DiscoverScreen);
    const labels = ADDRESS_AND_SERVICE_TIMES_LABELS[language];
    const texts = textsOf(view.toJSON());
    const heading = texts.indexOf(labels.title);
    const firstCard = texts.indexOf(view.getAllByTestId('grid-card')[0].props.children);
    expect(heading).toBeGreaterThan(-1);
    expect(heading).toBeLessThan(firstCard);

    const names = getLocationNames(language);
    const times = getServiceTimes(language);
    expect(view.getAllByTestId('church-location')).toHaveLength(CHURCH_LOCATIONS.length);
    CHURCH_LOCATIONS.forEach((location, index) => {
      const at = texts.indexOf(names[index]);
      // The name, then the day and hours alone, then the English address.
      expect(at).toBeGreaterThan(heading);
      expect(texts[at + 1]).toBe(times[index]);
      expect(texts[at + 2]).toBe(location.address);
      expect(at).toBeLessThan(firstCard);
    });
    expect(view.getAllByText(labels.getDirections)).toHaveLength(CHURCH_LOCATIONS.length);
  });

  it.each<[SupportedLanguage, string, string]>([
    ['en', 'Saturdays, 10:00 AM – 1:00 PM', 'Thursdays, 6:30 – 9:00 PM'],
    ['zh', '每週六 上午10:00–下午1:00', '每週四 晚上6:30–9:00'],
    ['zh-cn', '每周六 上午10:00–下午1:00', '每周四 晚上6:30–9:00'],
    ['es', 'Sábados, 10:00 a. m. – 1:00 p. m.', 'Jueves, 6:30 – 9:00 p. m.'],
  ])('gives the day and hours in %s without naming the gathering (#808)', async (language, saturday, thursday) => {
    // The no-break spaces read as spaces.
    const shown = getServiceTimes(language).map((time) => time.replace(/ /g, ' '));
    expect(shown).toEqual([saturday, saturday, thursday]);
    const texts = textsOf((await renderIn(language, DiscoverScreen)).toJSON());
    expect(texts.filter((text) => /Sabbath Worship|Adoración|崇拜/.test(text))).toEqual([]);
  });

  it('keeps "10:00 AM" and "a. m." whole on a line', () => {
    expect(CHURCH_SERVICE_TIMES.en[0]).toContain('10:00 AM');
    expect(CHURCH_SERVICE_TIMES.es[0]).toContain('10:00 a. m.');
  });

  it('keeps the English street address in Chinese, for maps and drivers, and lets it be copied', async () => {
    const view = await renderIn('zh', DiscoverScreen);
    for (const location of CHURCH_LOCATIONS) {
      expect(view.getByText(location.address).props.selectable).toBe(true);
    }
    expect(view.getByText('艾姆赫斯特教會')).toBeTruthy();
  });

  it('opens each location in Maps from its Get Directions button', async () => {
    const view = await renderIn('zh', DiscoverScreen);
    const buttons = view.getAllByText(ADDRESS_AND_SERVICE_TIMES_LABELS.zh.getDirections);
    for (const button of buttons) await fireEvent.press(button);
    expect(openInMaps).toHaveBeenCalledTimes(CHURCH_LOCATIONS.length);
    CHURCH_LOCATIONS.forEach((location, index) => {
      expect(openInMaps).toHaveBeenNthCalledWith(index + 1, location.searchQuery);
    });
  });

  it('has hours for every location in every language', () => {
    for (const language of LANGUAGES) {
      expect(CHURCH_SERVICE_TIMES[language]).toHaveLength(CHURCH_LOCATIONS.length);
      for (const time of CHURCH_SERVICE_TIMES[language]) expect(time).toMatch(/\d{1,2}:\d\d/);
    }
    expect(getServiceTimes('ko')).toBe(CHURCH_SERVICE_TIMES.en);
  });
});

describe('the Saturday service is Sabbath worship, 安息日崇拜 (#793)', () => {
  it.each(['zh', 'zh-cn'] as const)('says 安息日崇拜 on Fellowships in %s', async (language) => {
    const view = await renderIn(language, FellowshipsScreen);
    const texts = textsOf(view.toJSON());
    const worship = texts.find((text) => text.startsWith('星期六上午 10:00 - 下午 1:00 • '));
    expect(worship).toContain('安息日崇拜');
    // Under its title, Sabbath worship too.
    expect(texts[texts.indexOf(worship as string) - 1]).toBe('安息日崇拜');
    expect(texts.filter((text) => text.includes('主日崇拜'))).toEqual([]);
  });

  it('never says 主日崇拜, which reads as Sunday worship, anywhere in the app or the bulletin scripts', () => {
    const root = resolve(__dirname, '..');
    const walk = (directory: string): string[] =>
      readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) return walk(path);
        return /\.(tsx?|js|gs|html|json)$/.test(entry.name) ? [path] : [];
      });
    const sources = ['app', 'components', 'constants', 'features', 'services', 'google-apps-script', 'public'].flatMap(walk);
    expect(sources.length).toBeGreaterThan(50);
    const saying = sources.filter((path) => readFileSync(join(root, path), 'utf8').includes('主日崇拜'));
    expect(saying).toEqual([]);
  });
});

describe('the Locations & History page’s title (#793)', () => {
  it.each(LANGUAGES)('names both its parts in %s, as its card on New Member & Visitor does', async (language) => {
    const discover = await renderIn(language, DiscoverScreen);
    const cards = discover.getAllByTestId('grid-card').map((card) => card.props.children as string);
    mockScreenOptions.length = 0;
    await renderIn(language, AboutChurchHistoryScreen);
    const title = mockScreenOptions.at(-1)?.title;
    // The card that opens it, the second.
    expect(title).toBe(cards[1]);
  });

  it('no longer says only History while the reader is in the locations', async () => {
    await renderIn('zh', AboutChurchHistoryScreen);
    expect(mockScreenOptions.at(-1)?.title).toBe('地點與歷史');
  });
});
