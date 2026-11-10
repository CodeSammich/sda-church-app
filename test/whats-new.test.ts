import { ContrastStep } from '@/components/ContrastChoice';
import { SetupRoomContext } from '@/components/SetupScreen';
import { WhatsNewDialog } from '@/components/WhatsNewDialog';
import {
  CONTRAST_HIGH,
  CONTRAST_STANDARD,
  DEFAULT_CONTRAST_MODES,
  ThemeContext,
  THEME_LIGHT,
  type ContrastMode,
  type ThemeKind,
} from '@/constants/Themes';
import { compareVersions, shouldShowWhatsNew, WHATS_NEW_VERSION } from '@/constants/WhatsNew';
import { fireEvent } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { readFileSync } from 'node:fs';
import { createElement, useState } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

// The dialog with its choices kept, as the app keeps them, so a choice shows.
function StatefulWhatsNew({
  onDone,
  save,
}: Readonly<{ onDone: () => void; save: (kind: ThemeKind, mode: ContrastMode) => void }>) {
  const [contrastModes, setContrastModes] = useState(DEFAULT_CONTRAST_MODES);
  const setContrastMode = (kind: ThemeKind, mode: ContrastMode) => {
    save(kind, mode);
    setContrastModes((current) => ({ ...current, [kind]: mode }));
  };
  return createElement(
    ThemeContext.Provider,
    { value: { contrastModes, setContrastMode, setThemeMode: jest.fn(), themeMode: THEME_LIGHT, toggleTheme: jest.fn() } },
    createElement(WhatsNewDialog, { onDone }),
  );
}

const checked = (screen: Awaited<ReturnType<typeof renderWithPreferences>>) =>
  screen.getAllByRole('radio').map((option) => option.props.accessibilityState.checked);

describe("What's new (#669)", () => {
  it('compares versions by their numbers', () => {
    expect(compareVersions('1.6.5', '1.7.0')).toBe(-1);
    expect(compareVersions('1.7.0', '1.7.0')).toBe(0);
    expect(compareVersions('1.10.0', '1.9.9')).toBe(1);
    expect(compareVersions('1.7', '1.7.0')).toBe(0);
  });

  it('shows once to members who set up an earlier version, and never during setup', () => {
    expect(WHATS_NEW_VERSION).toBe('1.7.0');
    // Updated from 1.6 or earlier: set up, nothing seen.
    expect(shouldShowWhatsNew(true, null)).toBe(true);
    expect(shouldShowWhatsNew(true, '1.6.5')).toBe(true);
    // Seen, or a later version with nothing new to tell.
    expect(shouldShowWhatsNew(true, '1.7.0')).toBe(false);
    expect(shouldShowWhatsNew(true, '1.8.0')).toBe(false);
    // A new install sets up instead.
    expect(shouldShowWhatsNew(false, null)).toBe(false);
  });

  // As in setup, a tap on a picture only chooses it, and Next, then Done, go
  // on (#708). When a tap went on, a tap on high contrast, chosen already,
  // seemed to do nothing.
  it('asks only the contrast, for light mode and then dark mode, chosen by a tap, with Next and Done', async () => {
    const onDone = jest.fn();
    const save = jest.fn();
    const screen = await renderWithPreferences(createElement(StatefulWhatsNew, { onDone, save }), { language: 'zh' });
    expect(screen.getByText('淺色模式下，哪一個看得比較清楚？')).toBeTruthy();
    // No other text: the question, the hint, the two pictures and the button.
    expect(screen.queryByText('新功能')).toBeNull();
    expect(checked(screen)).toEqual([true, false]);
    // A question: no X, and nothing to go back to yet.
    expect(screen.queryByRole('button', { name: '關閉' })).toBeNull();
    expect(screen.queryByRole('button', { name: '上一步' })).toBeNull();

    await fireEvent.press(screen.getAllByRole('radio')[1]);
    expect(save).toHaveBeenLastCalledWith('light', CONTRAST_STANDARD);
    expect(checked(screen)).toEqual([false, true]);
    expect(screen.getByText('淺色模式下，哪一個看得比較清楚？')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: '下一步' }));
    expect(save).toHaveBeenLastCalledWith('light', CONTRAST_STANDARD);
    expect(screen.getByText('深色模式下，哪一個看得比較清楚？')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '下一步' })).toBeNull();

    // Back and on keep the answer.
    await fireEvent.press(screen.getByRole('button', { name: '上一步' }));
    expect(screen.getByText('淺色模式下，哪一個看得比較清楚？')).toBeTruthy();
    expect(checked(screen)).toEqual([false, true]);
    await fireEvent.press(screen.getByRole('button', { name: '下一步' }));

    // A tap on high contrast, chosen already, only chooses it.
    await fireEvent.press(screen.getAllByRole('radio')[0]);
    expect(save).toHaveBeenLastCalledWith('dark', CONTRAST_HIGH);
    expect(screen.getByText('深色模式下，哪一個看得比較清楚？')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: '完成' }));
    expect(save).toHaveBeenLastCalledWith('dark', CONTRAST_HIGH);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('keeps and saves high contrast, chosen already, with Next and Done', async () => {
    const onDone = jest.fn();
    const setContrastMode = jest.fn();
    const screen = await renderWithPreferences(createElement(WhatsNewDialog, { onDone }), { setContrastMode });
    await fireEvent.press(screen.getByRole('button', { name: 'Next' }));
    expect(setContrastMode).toHaveBeenCalledWith('light', CONTRAST_HIGH);
    expect(screen.getByText('Which is easier to read in dark mode?')).toBeTruthy();
    expect(onDone).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(setContrastMode).toHaveBeenCalledWith('dark', CONTRAST_HIGH);
    expect(setContrastMode).toHaveBeenCalledTimes(2);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  // A full screen, as setup is, so both pictures and the buttons show
  // without a scroll; a popup's height limit hid Standard (#708).
  it("is setup's own full screen and contrast step, not a popup", () => {
    const whatsNew = readFileSync('components/WhatsNewDialog.tsx', 'utf8');
    expect(whatsNew).toContain('<SetupScreen');
    expect(whatsNew).toContain('<ContrastStep');
    expect(whatsNew).not.toMatch(/<Dialog|<Portal|usePopupMaxHeight/);
    const setup = readFileSync('components/InitialSetup.tsx', 'utf8');
    expect(setup).toContain('<SetupScreen');
    expect(setup).toContain('<ContrastStep');
  });

  it('puts the pictures side by side where one above the other would need a scroll', async () => {
    const rowOf = (screen: Awaited<ReturnType<typeof renderWithPreferences>>) =>
      // The pictures' row: the radio buttons' parent.
      StyleSheet.flatten(screen.getAllByRole('radio')[0].parent!.props.style).flexDirection;
    const step = (room: number) =>
      createElement(
        SetupRoomContext.Provider,
        { value: room },
        createElement(ContrastStep, { kind: 'light', language: 'en', onChoose: jest.fn(), value: CONTRAST_HIGH }),
      );
    const layout = (height: number) => ({ nativeEvent: { layout: { height, width: 360, x: 0, y: 0 } } });

    const roomy = await renderWithPreferences(step(900));
    await fireEvent(roomy.getByText('Which is easier to read in light mode?'), 'layout', layout(700));
    expect(rowOf(roomy)).not.toBe('row');

    const short = await renderWithPreferences(step(500));
    await fireEvent(short.getByText('Which is easier to read in light mode?'), 'layout', layout(700));
    expect(rowOf(short)).toBe('row');
    // It stays side by side once it fits.
    await fireEvent(short.getByText('Which is easier to read in light mode?'), 'layout', layout(450));
    expect(rowOf(short)).toBe('row');
  });

  it('is saved as seen when answered, and when setup finishes', () => {
    const layout = readFileSync('app/_layout.tsx', 'utf8');
    expect(layout).toContain("setShowWhatsNew(shouldShowWhatsNew(setupDone === 'true', whatsNewSeen));");
    expect(layout.match(/AsyncStorage\.setItem\(WHATS_NEW_SEEN_KEY, WHATS_NEW_VERSION\)/g)).toHaveLength(2);
    expect(layout).toContain('showWhatsNew={isReady && !showSetup && showWhatsNew}');
    // Every key screen has seen it, except its own.
    const { BASE_SETTINGS, SETTING_KEYS } = require('../scripts/capture-ios-screens.cjs');
    expect(SETTING_KEYS.whatsNewSeen).toBe('whats-new-seen');
    expect(BASE_SETTINGS.ios.whatsNewSeen).toBe(require('../package.json').version);
  });
});
