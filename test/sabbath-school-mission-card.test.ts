import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { createElement } from 'react';

import SabbathSchoolScreen from '@/app/(tabs)/explore/sabbath-school';
import { openMissionSpotlight, openYouTubeVideo } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { CHINESE_MISSION_SPOTLIGHT_KEY } from '@/features/sabbath-school/ChineseMissionSpotlight';
import { renderWithPreferences } from './helpers/render-preferences';

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useIsFocused: () => true,
  useLocalSearchParams: () => ({}),
  useRouter: () => ({ push: jest.fn(), back: jest.fn() }),
}));

let mockSabbath = new Date(2026, 9, 31);
jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  getMissionSpotlightSabbath: () => mockSabbath,
  openMissionSpotlight: jest.fn(),
  openYouTubeVideo: jest.fn(),
}));

const FEED = `<feed>
  <entry><yt:videoId>Hk98GzA4qPE</yt:videoId><title>【聖工剪影】2026 第四季 10月31日 三扇窗的視野</title></entry>
  <entry><yt:videoId>SV8mL9YrrFo</yt:videoId><title>【聖工剪影】2026 第四季 10月24日 城堡裡的學校</title></entry>
</feed>`;

const feedAnswers = (ok: boolean) =>
  jest.spyOn(global, 'fetch').mockImplementation(async () => ({ ok, text: async () => (ok ? FEED : 'Not Found') }) as Response);

const show = (language: SupportedLanguage) =>
  renderWithPreferences(createElement(SabbathSchoolScreen), { language });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe("Sabbath School's mission video card", () => {
  it.each([
    ['en', 'This Week’s Mission Video', 'Mission Spotlight for Sabbath, October 31'],
    ['es', 'Video misionero de esta semana', 'Mission Spotlight del sábado 31 de octubre'],
  ] as const)('in %s opens its own Mission Spotlight page and never asks YouTube', async (language, title, description) => {
    mockSabbath = new Date(2026, 9, 31);
    const fetchFeed = feedAnswers(true);
    const screen = await show(language);

    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
    await fireEvent.press(screen.getByText(title));
    expect(openMissionSpotlight).toHaveBeenCalledWith(language);
    expect(fetchFeed).not.toHaveBeenCalled();
  });

  it.each([
    ['zh', '本週聖工剪影', '10月31日安息日：三扇窗的視野（普通話）'],
    ['zh-cn', '本周圣工剪影', '10月31日安息日：三扇窗的视野（普通话）'],
  ] as const)("in %s opens this week's Mandarin video once CHTV has posted it", async (language, title, description) => {
    mockSabbath = new Date(2026, 9, 31);
    feedAnswers(true);
    const screen = await show(language);

    expect(await screen.findByText(description)).toBeTruthy();
    await fireEvent.press(screen.getByText(title));
    expect(openYouTubeVideo).toHaveBeenCalledWith('https://www.youtube.com/watch?v=Hk98GzA4qPE');
    expect(openMissionSpotlight).not.toHaveBeenCalled();
  });

  it.each([
    ['zh', '10月31日聖工剪影', '三扇窗的視野（普通話）。本週的影片出來後會換上。'],
    ['zh-cn', '10月31日圣工剪影', '三扇窗的视野（普通话）。本周的视频出来后会换上。'],
  ] as const)('in %s opens the last video found, named by its Sabbath, until this week’s is posted', async (language, title, description) => {
    mockSabbath = new Date(2026, 10, 7);
    feedAnswers(false);
    await AsyncStorage.setItem(
      CHINESE_MISSION_SPOTLIGHT_KEY,
      JSON.stringify({ sabbath: '2026-10-31', id: 'Hk98GzA4qPE', story: '三扇窗的視野' }),
    );
    const screen = await show(language);

    expect(await screen.findByText(title)).toBeTruthy();
    expect(screen.getByText(description)).toBeTruthy();
    await fireEvent.press(screen.getByText(title));
    expect(openYouTubeVideo).toHaveBeenCalledWith('https://www.youtube.com/watch?v=Hk98GzA4qPE');
  });

  it.each([
    ['zh', '本週聖工剪影'],
    ['zh-cn', '本周圣工剪影'],
  ] as const)('in %s opens the English page when the phone has no Chinese video', async (language, title) => {
    mockSabbath = new Date(2026, 11, 12);
    const fetchFeed = feedAnswers(false);
    const screen = await show(language);

    await waitFor(() => expect(fetchFeed).toHaveBeenCalled());
    expect(screen.getByText(title)).toBeTruthy();
    expect(screen.getByText('12月12日安息日的 Mission Spotlight（英文）')).toBeTruthy();
    await fireEvent.press(screen.getByText(title));
    expect(openMissionSpotlight).toHaveBeenCalledWith(language);
    expect(openYouTubeVideo).not.toHaveBeenCalled();
  });
});
