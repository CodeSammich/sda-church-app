import { WhatsNewDialog } from '@/components/WhatsNewDialog';
import { CONTRAST_STANDARD } from '@/constants/Themes';
import { compareVersions, shouldShowWhatsNew, WHATS_NEW_VERSION } from '@/constants/WhatsNew';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

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

  it('asks only the contrast, for light mode and then dark mode, and closes after both', async () => {
    const onDone = jest.fn();
    const setContrastMode = jest.fn();
    const screen = await renderWithPreferences(createElement(WhatsNewDialog, { onDone }), {
      language: 'zh',
      setContrastMode,
    });
    expect(screen.getByText('淺色模式下，哪一個看得比較清楚？')).toBeTruthy();
    // No other text: the question, the hint, and the two pictures.
    expect(screen.queryByText('新功能')).toBeNull();
    let options = screen.getAllByRole('radio');
    expect(options.map((option) => option.props.accessibilityState.checked)).toEqual([true, false]);
    // A question: no X.
    expect(screen.queryByRole('button', { name: '關閉' })).toBeNull();
    await fireEvent.press(options[1]);
    expect(setContrastMode).toHaveBeenCalledWith('light', CONTRAST_STANDARD);
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByText('深色模式下，哪一個看得比較清楚？')).toBeTruthy();
    options = screen.getAllByRole('radio');
    await fireEvent.press(options[0]);
    expect(setContrastMode).toHaveBeenCalledWith('dark', 'high');
    expect(onDone).toHaveBeenCalledTimes(1);
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
