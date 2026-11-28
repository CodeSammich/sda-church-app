import { AppSheet } from '@/components/AppSheet';
import {
  DEFAULT_SHEET_DETENTS,
  getSheetDetents,
  getSheetFraction,
  getSheetLargeHeight,
  getVisibleSheetHeight,
  sameSheetDetents,
  type SheetFrame,
} from '@/components/SheetDetents';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { fireEvent } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { Platform, Text } from 'react-native';
import { renderWithPreferences } from './helpers/render-preferences';
import { getSheetHosts } from './helpers/sheets';

// An iPhone's sheet: 780 points of content at the large detent. An Android
// phone's: 800 at the large detent, in an 853-point window (status bar,
// navigation bar and drag handle take the rest).
const IPHONE: SheetFrame = { platform: 'ios', largeHeight: 780, windowHeight: 844 };
const ANDROID: SheetFrame = { platform: 'android', largeHeight: 760, windowHeight: 853 };

describe('sheet detents (#867)', () => {
  it('sizes a short sheet to its content', () => {
    expect(getSheetDetents(300, IPHONE)).toBe('fitToContents');
    expect(getSheetDetents(300, ANDROID)).toBe('fitToContents');
    // A little over half still fits in one detent.
    expect(getSheetDetents(0.55 * 780, IPHONE)).toBe('fitToContents');
  });

  it('opens taller content at half, expandable to its own height', () => {
    const [medium, large] = getSheetDetents(600, IPHONE) as number[];
    expect(medium).toBe(0.5);
    expect(large).toBeCloseTo(600 / 780, 2);
    expect(getVisibleSheetHeight(IPHONE, large)).toBeGreaterThanOrEqual(600);

    const [androidMedium, androidLarge] = getSheetDetents(600, ANDROID) as number[];
    expect(androidMedium).toBe(0.5);
    expect(getVisibleSheetHeight(ANDROID, androidLarge)).toBeGreaterThanOrEqual(600);
    expect(getVisibleSheetHeight(ANDROID, androidLarge)).toBeLessThan(602);
  });

  it('expands content taller than the screen to full height, where it scrolls', () => {
    expect(getSheetDetents(2000, IPHONE)).toEqual([0.5, 1]);
    expect(getSheetDetents(2000, ANDROID)).toEqual([0.5, 1]);
    // Nearly full is full.
    expect(getSheetDetents(0.98 * 780, IPHONE)).toEqual([0.5, 1]);
  });

  it('opens at medium, expandable to large, before anything is measured', () => {
    expect(getSheetDetents(0, IPHONE)).toBe(DEFAULT_SHEET_DETENTS);
    expect(getSheetDetents(400, null)).toBe(DEFAULT_SHEET_DETENTS);
    expect(DEFAULT_SHEET_DETENTS).toEqual([0.5, 1]);
  });

  it('gives Text size numbers, so it keeps its height as its text grows', () => {
    const [short] = getSheetDetents(300, IPHONE, { fixed: true }) as number[];
    expect(getVisibleSheetHeight(IPHONE, short)).toBeGreaterThanOrEqual(300);
    expect(getSheetDetents(600, IPHONE, { fixed: true })).toEqual([0.5, expect.any(Number)]);
  });

  it('opens Share the App at its whole height', () => {
    expect(getSheetDetents(600, IPHONE, { full: true })).toBe('fitToContents');
  });

  it("works out the room from the sheet's own content", () => {
    // iOS: the content is the detent's height.
    expect(getSheetLargeHeight('ios', 390, 0.5, 844)).toBe(780);
    // Android: the content keeps the largest detent's height.
    expect(getSheetLargeHeight('android', 760, 1, 853)).toBe(760);
    expect(getSheetLargeHeight('android', 760 - 0.2 * 853, 0.8, 853)).toBeCloseTo(760);
    // At half, Android shows less of it by half the window.
    expect(getVisibleSheetHeight(ANDROID, 0.5)).toBeCloseTo(760 - 853 / 2);
    expect(getSheetFraction(ANDROID, getVisibleSheetHeight(ANDROID, 0.7))).toBeCloseTo(0.7);
  });

  it('compares detents by value', () => {
    expect(sameSheetDetents([0.5, 0.8], [0.5, 0.8])).toBe(true);
    expect(sameSheetDetents([0.5, 0.8], [0.5, 1])).toBe(false);
    expect(sameSheetDetents('fitToContents', 'fitToContents')).toBe(true);
    expect(sameSheetDetents('fitToContents', [0.5, 1])).toBe(false);
  });
});

describe('AppSheet (#867)', () => {
  const renderSheet = (onDismiss = jest.fn(), theme = customLightTheme) =>
    renderWithPreferences(
      createElement(AppSheet, {
        children: createElement(Text, null, '30 minutes'),
        closeLabel: 'Close',
        onDismiss,
        testID: 'test-sheet',
        title: 'Sleep timer',
        visible: true,
      }),
      { theme },
    );

  it.each([customLightTheme, customDarkTheme])(
    "is a native sheet with a grabber, the platform's corners, and the $dark floating bars' colour",
    async (theme) => {
      const screen = await renderSheet(jest.fn(), theme);
      const [sheet] = getSheetHosts(screen);
      expect(sheet.props.isOpen).toBe(true);
      expect(sheet.props.prefersGrabberVisible).toBe(true);
      expect(sheet.props.preferredCornerRadius).toBe(-1);
      expect(sheet.props.nativeContainerBackgroundColor).toBe(theme.colors.floatingSurface);
      expect(screen.getByText('Sleep timer')).toBeTruthy();
      expect(screen.getByText('30 minutes')).toBeTruthy();
    },
  );

  it('closes with the X in its title row', async () => {
    const onDismiss = jest.fn();
    const screen = await renderSheet(onDismiss);
    await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('is a centred popup on the web, which has no native sheets', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const screen = await renderSheet();
    expect(getSheetHosts(screen)).toHaveLength(0);
    expect(screen.getByText('Sleep timer')).toBeTruthy();
    expect(screen.getByTestId('test-sheet')).toBeTruthy();
  });
});

describe('which popups are sheets (#867)', () => {
  const sources = (() => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(path)) files.push(path);
      }
    };
    ['app', 'components', 'features', 'hooks', 'services'].forEach(walk);
    return files.map((file) => [file, readFileSync(file, 'utf8')] as const);
  })();

  it("only AppSheet uses react-native-screens' experimental API, so it's swapped in one place", () => {
    const users = sources.filter(([, source]) => source.includes('react-native-screens/experimental'));
    expect(users.map(([file]) => file)).toEqual(['components/AppSheet.tsx']);
  });

  it('shows settings, pickers and details as sheets', () => {
    const sheets = sources.filter(([, source]) => /<AppSheet\b/.test(source)).map(([file]) => file);
    expect(sheets.sort()).toEqual(
      [
        'app/(tabs)/bible/index.tsx',
        'components/ChildrenLessonDialog.tsx',
        'components/ContrastDialog.tsx',
        'components/DafSponsorsDialog.tsx',
        'components/LanguageDialog.tsx',
        'components/OfflineBibleAudio.tsx',
        'components/ShareAppDialog.tsx',
        'components/TextSizeDialog.tsx',
        'components/ThemeDialog.tsx',
      ].sort(),
    );
  });

  it('keeps centred dialogs for questions and alerts, and full screens on purpose', () => {
    const popups = sources
      .filter(([, source]) => /<(Dialog|Modal)\b/.test(source))
      .map(([file]) => file)
      .sort();
    expect(popups).toEqual(
      [
        // The web's popups in place of sheets.
        'components/AppSheet.tsx',
        // showAppAlert's questions and notices.
        'components/AppAlert.tsx',
        // The Bible's question about interrupted audio, and saved verses,
        // which fill the screen (#750).
        'app/(tabs)/bible/index.tsx',
        // "No connection" (#801): an alert.
        'components/BibleAudioOfflinePopup.tsx',
        // The web's install question.
        'components/InstallPrompt.tsx',
        // First-launch setup and the contrast question after an update (#708).
        'components/SetupScreen.tsx',
      ].sort(),
    );
  });
});
