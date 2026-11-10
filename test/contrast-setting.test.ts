import { ContrastDialog } from '@/components/ContrastDialog';
import { getDockControlBorderColor } from '@/components/TabBarItems';
import {
  CONTRAST_HIGH,
  CONTRAST_STANDARD,
  CONTRAST_STORAGE_KEYS,
  customDarkTheme,
  customLightTheme,
  getAppTheme,
  parseContrastMode,
} from '@/constants/Themes';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

const luminance = (hex: string) => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4));
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrastRatio = (foreground: string, background: string) => {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
};

describe('the contrast setting (#669)', () => {
  it('is high contrast unless the member chose standard', () => {
    expect(parseContrastMode(null)).toBe(CONTRAST_HIGH);
    expect(parseContrastMode('high')).toBe(CONTRAST_HIGH);
    expect(parseContrastMode('standard')).toBe(CONTRAST_STANDARD);
    expect(parseContrastMode('soft')).toBe(CONTRAST_HIGH);
    // High contrast: white, or night blue in the dark theme (#593).
    expect(getAppTheme(false).colors.floatingSurface).toBe('#FFFFFF');
    expect(getAppTheme(true).colors.floatingSurface).toBe('#00405C');
    expect(getAppTheme(false, false, 1, CONTRAST_HIGH).colors).toEqual(customLightTheme.colors);
    expect(getAppTheme(true, false, 1, CONTRAST_HIGH).colors).toEqual(customDarkTheme.colors);
  });

  it('is a shade off the page in standard: L1 in the light theme, the D3 warm brown in the dark', () => {
    const light = getAppTheme(false, false, 1, CONTRAST_STANDARD).colors;
    const dark = getAppTheme(true, false, 1, CONTRAST_STANDARD).colors;
    expect([light.floatingSurface, light.floatingSelected]).toEqual(['#FAF4EF', '#E3F2FD']);
    expect([dark.floatingSurface, dark.floatingSelected]).toEqual(['#211F18', '#3B3423']);
    // Only the floating surfaces change.
    expect({ ...light, floatingSurface: '', floatingSelected: '' }).toEqual({
      ...customLightTheme.colors,
      floatingSurface: '',
      floatingSelected: '',
    });
  });

  it.each([false, true])('keeps text and icons readable on standard (dark: %p)', (dark) => {
    const colors = getAppTheme(dark, false, 1, CONTRAST_STANDARD).colors;
    const selectedTab = dark ? colors.metallicGold.main : colors.primary;
    // The header's translation names and blue or gold icons, the grey icons
    // and tab labels, and the selected tab and the card's pills.
    expect(contrastRatio(colors.primary, colors.floatingSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onSurfaceVariant, colors.floatingSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.onSurface, colors.floatingSurface)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(selectedTab, colors.floatingSelected)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(colors.primary, colors.floatingSelected)).toBeGreaterThanOrEqual(4.5);
    // The card's buttons' edges.
    const theme = getAppTheme(dark, false, 1, CONTRAST_STANDARD);
    expect(contrastRatio(getDockControlBorderColor(theme), colors.floatingSurface)).toBeGreaterThanOrEqual(dark ? 3 : 1.4);
  });

  it('is chosen under You → Contrast by pictures, for light mode and dark mode, high contrast first', async () => {
    const onDismiss = jest.fn();
    const setContrastMode = jest.fn();
    const screen = await renderWithPreferences(createElement(ContrastDialog, { onDismiss, visible: true }), {
      contrastModes: { light: CONTRAST_HIGH, dark: CONTRAST_STANDARD },
      setContrastMode,
    });
    expect(screen.getByText('Light mode')).toBeTruthy();
    expect(screen.getByText('Dark mode')).toBeTruthy();
    const options = screen.getAllByRole('radio');
    expect(options.map((option) => option.props.accessibilityLabel)).toEqual([
      'High contrast, Bars and buttons that stand out clearly',
      'Standard, Soft colors, close to the page',
      'High contrast, Bars and buttons that stand out clearly',
      'Standard, Soft colors, close to the page',
    ]);
    expect(options.map((option) => option.props.accessibilityState.checked)).toEqual([true, false, false, true]);
    // Each theme's own, and it stays open for the other: a setting, with an X.
    await fireEvent.press(options[1]);
    expect(setContrastMode).toHaveBeenCalledWith('light', CONTRAST_STANDARD);
    await fireEvent.press(options[2]);
    expect(setContrastMode).toHaveBeenCalledWith('dark', CONTRAST_HIGH);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.queryByText('Close')).toBeNull();
  });

  it('is saved and applied to every theme the app makes', () => {
    const layout = readFileSync('app/_layout.tsx', 'utf8');
    // One for each theme, since a member may switch between them.
    expect(CONTRAST_STORAGE_KEYS).toEqual({ light: 'user-contrast-light', dark: 'user-contrast-dark' });
    expect(layout).toContain('AsyncStorage.getItem(CONTRAST_STORAGE_KEYS.light),');
    expect(layout).toContain('AsyncStorage.getItem(CONTRAST_STORAGE_KEYS.dark),');
    expect(layout).toContain('await AsyncStorage.setItem(CONTRAST_STORAGE_KEYS[kind], mode);');
    // Finishing setup saves both, so high contrast kept with Next is saved as
    // chosen, as the language, theme and text size are (#708).
    const onCompleteSetup = layout.slice(layout.indexOf('const onCompleteSetup = async'), layout.indexOf('setShowSetup(false);'));
    expect(onCompleteSetup).toContain('AsyncStorage.setItem(CONTRAST_STORAGE_KEYS.light, contrasts.light),');
    expect(onCompleteSetup).toContain('AsyncStorage.setItem(CONTRAST_STORAGE_KEYS.dark, contrasts.dark),');
    // Each theme the app makes after loading takes the one for its light or
    // dark; only the first, before the saved settings load, is the default.
    expect(layout.match(/getAppTheme\(/g)).toHaveLength(5);
    expect(
      layout.match(/contrasts\[isDark \? 'dark' : 'light'\]|contrastFor\((theme|currentTheme)\.dark\)|preferredContrasts\[preferredDark \? 'dark' : 'light'\]/g),
    ).toHaveLength(4);
    const you = readFileSync('app/(tabs)/you/index.tsx', 'utf8');
    expect(you).toContain('<ContrastDialog visible={showContrast} onDismiss={() => setShowContrast(false)} />');
    expect(you).toContain('contrastModes.light === contrastModes.dark');
    // The key screens take them like any other setting.
    const capture = readFileSync('scripts/capture-ios-screens.cjs', 'utf8');
    expect(capture).toContain("contrastLight: 'user-contrast-light',");
    expect(capture).toContain("contrastDark: 'user-contrast-dark',");
  });
});
