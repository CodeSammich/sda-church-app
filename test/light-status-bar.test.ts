import { readFileSync } from 'node:fs';
import React from 'react';
import { act, render, renderHook } from '@testing-library/react-native';

import {
  getScreenStatusBarStyle,
  LightStatusBar,
  useLightStatusBarRequested,
} from '@/components/LightStatusBar';

const read = (file: string) => readFileSync(file, 'utf8');

// On iOS the screens set the status bar's style, from Expo's 58.0.32 template
// on (#733), so the light icons over the launch splash and the heroes go
// through the root Stack's statusBarStyle.
describe('light status bar', () => {
  it("gives the root Stack the app's style, or light while one is shown", () => {
    expect(getScreenStatusBarStyle('dark-content', false)).toBe('dark');
    expect(getScreenStatusBarStyle('light-content', false)).toBe('light');
    expect(getScreenStatusBarStyle('default', false)).toBe('auto');
    expect(getScreenStatusBarStyle('dark-content', true)).toBe('light');
  });

  it('asks for light icons while any LightStatusBar is shown', async () => {
    const { result } = await renderHook(() => useLightStatusBarRequested());
    expect(result.current).toBe(false);

    const first = await render(React.createElement(LightStatusBar));
    expect(result.current).toBe(true);

    const second = await render(React.createElement(LightStatusBar));
    await act(() => first.unmount());
    expect(result.current).toBe(true);

    await act(() => second.unmount());
    expect(result.current).toBe(false);
  });

  it('is used for the launch splash and the heroes under the status bar', () => {
    // React Native's own StatusBar still sets Android's, and a full-screen Modal's.
    expect(read('components/LightStatusBar.tsx')).toContain('<StatusBar barStyle="light-content" />');
    expect(read('components/LaunchSplash.tsx')).toContain('<LightStatusBar />');
    expect(read('app/(tabs)/explore/library.tsx')).toContain(
      '{isFocused && isCarouselBehindStatusBar && <LightStatusBar />}',
    );
    expect(read('features/hymnal/HymnalScreen.tsx')).toContain(
      '{isFocused && heroUnderStatusBar && <LightStatusBar />}',
    );
    for (const file of [
      'components/LaunchSplash.tsx',
      'app/(tabs)/explore/library.tsx',
      'features/hymnal/HymnalScreen.tsx',
    ]) {
      // React Native's StatusBar alone doesn't reach the iPhone's status bar.
      expect(read(file)).not.toContain('<StatusBar barStyle="light-content"');
    }
  });

  it("sets the style on the root Stack's screens only, on iOS", () => {
    const layout = read('app/_layout.tsx');
    expect(layout).toContain(
      "Platform.OS === 'ios' ? { statusBarStyle: screenStatusBarStyle } : undefined",
    );
    expect(layout).toContain('<RootStack statusBarStyle={statusBarStyle} />');
    // A screen further down with its own style would win over the root's,
    // and through the tabs it can be one the person isn't looking at.
    for (const file of [
      'app/(tabs)/_layout.tsx',
      'app/(tabs)/bible/_layout.tsx',
      'app/(tabs)/explore/_layout.tsx',
      'app/(tabs)/home/_layout.tsx',
      'app/(tabs)/you/_layout.tsx',
      'components/StackScreenOptions.tsx',
      'app/(tabs)/explore/library.tsx',
      'features/hymnal/HymnalScreen.tsx',
    ]) {
      expect(read(file)).not.toContain('statusBarStyle');
    }
  });
});
