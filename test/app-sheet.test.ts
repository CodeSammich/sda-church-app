import { AppSheet } from '@/components/AppSheet';
import { getRevealOffset } from '@/components/PopupScrollView';
import {
  ANDROID_DRAG_HANDLE_HEIGHT,
  DEFAULT_SHEET_DETENTS,
  getAndroidSheetFrame,
  getIosSheetFrame,
  getSheetDetents,
  getSheetFraction,
  getVisibleSheetHeight,
  sameSheetDetents,
  SHORT_SHEET_SECOND_DETENT,
} from '@/components/SheetDetents';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';
import { fireEvent } from '@testing-library/react-native';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { Platform, Text } from 'react-native';
import { renderWithPreferences } from './helpers/render-preferences';
import { getSheetHosts } from './helpers/sheets';

// An iPhone's sheet: 780 points at the large detent. The Android phone the
// key screens use: a 923-point screen, a 24-point status bar and navigation
// bar, and the drag handle's 48-point row.
const IPHONE = getIosSheetFrame(780);
const ANDROID = getAndroidSheetFrame(923, { top: 24, bottom: 24 });

describe('sheet detents (#867)', () => {
  it("knows each platform's room", () => {
    expect(ANDROID).toEqual({ largeHeight: 923 - 24 - 24 - ANDROID_DRAG_HANDLE_HEIGHT, windowHeight: 923, chrome: 72 });
    // iOS sizes the content to the detent; Android shows a detent's height
    // less its handle and the navigation bar.
    expect(getVisibleSheetHeight(IPHONE, 0.5)).toBe(390);
    expect(getVisibleSheetHeight(ANDROID, 0.5)).toBeCloseTo(923 / 2 - 72);
    expect(getVisibleSheetHeight(ANDROID, 1)).toBe(ANDROID.largeHeight);
    expect(getSheetFraction(ANDROID, getVisibleSheetHeight(ANDROID, 0.7))).toBeCloseTo(0.7);
  });

  it('sizes a short sheet to its content', () => {
    // Two detents a hair apart, which rest at the content's height.
    const [iphone, iphoneSecond] = getSheetDetents(300, IPHONE) as number[];
    expect(getVisibleSheetHeight(IPHONE, iphone)).toBeGreaterThanOrEqual(300);
    expect(getVisibleSheetHeight(IPHONE, iphone)).toBeLessThan(301);
    expect(iphoneSecond - iphone).toBeCloseTo(SHORT_SHEET_SECOND_DETENT, 3);
    const [android] = getSheetDetents(300, ANDROID) as number[];
    expect(getVisibleSheetHeight(ANDROID, android)).toBeGreaterThanOrEqual(300);
    expect(getVisibleSheetHeight(ANDROID, android)).toBeLessThan(301);
    // A little over half still rests at its own height, not at half.
    expect((getSheetDetents(0.55 * 780, IPHONE) as number[])[0]).toBeGreaterThan(0.54);
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

  it('opens Share the App, Text size, the narrators and Other Sponsors at their whole height', () => {
    // Taller than half, yet one resting height, the content's.
    const [whole, second] = getSheetDetents(600, IPHONE, { full: true }) as number[];
    expect(getVisibleSheetHeight(IPHONE, whole)).toBeGreaterThanOrEqual(600);
    expect(second - whole).toBeCloseTo(SHORT_SHEET_SECOND_DETENT, 3);
    // Taller than the screen: full height, where it scrolls.
    expect(getSheetDetents(2000, ANDROID, { full: true })).toEqual([1]);
  });

  it('compares detents by value', () => {
    expect(sameSheetDetents([0.5, 0.8], [0.5, 0.8])).toBe(true);
    expect(sameSheetDetents([0.5, 0.8], [0.5, 1])).toBe(false);
    expect(sameSheetDetents([1], [0.5, 1])).toBe(false);
  });
});

describe('the current choice shows when a sheet opens (#867)', () => {
  it("doesn't scroll when it already shows", () => {
    expect(getRevealOffset({ top: 100, height: 120, viewport: 400, content: 900 })).toBe(0);
  });

  it('scrolls one below the fold to the middle', () => {
    // Español, the fourth card, below a 400-point view: its middle at 200.
    expect(getRevealOffset({ top: 600, height: 120, viewport: 400, content: 900 })).toBe(460);
  });

  it('never scrolls past the end', () => {
    expect(getRevealOffset({ top: 840, height: 60, viewport: 400, content: 900 })).toBe(500);
  });

  it('marks the current choice in every pick-one sheet', () => {
    // Language and Theme cards, the narrators, the sleep timer, and the
    // Bible's translation, book and chapter lists.
    expect(readFileSync('components/SettingChoices.tsx', 'utf8')).toContain('useRevealWhenSelected(selected)');
    expect(readFileSync('components/OfflineBibleAudio.tsx', 'utf8')).toContain('<RevealIfSelected key={option} selected={selected}>');
    const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
    expect(bible).toContain('selected={option.value === sleepTimerSetting}');
    expect(bible).toContain('selectedIndex={selectionRows.findIndex(isCurrentSelection)}');
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
