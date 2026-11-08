import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { act, fireEvent, render } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet, Text } from 'react-native';

import {
  CAPSULE_TAB_BAR_MAX_WIDTH,
  CapsuleTabBar,
  getCapsuleBottomGap,
  getCapsuleTabBarWidth,
  getFloatingSurfaceStyle,
  TAB_PRESS_SETTLE_MS,
  TAB_SLIDE_MS,
} from '@/components/CapsuleTabBar';
import {
  getBarSurfaceColor,
  getDockControlBorderColor,
  getDockControlColor,
  getDockControlContentColor,
  getSelectedTabTint,
  TABLET_TAB_BAR_MIN_WIDTH,
} from '@/components/TabBarItems';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';

// Three tabs and one hidden route, as app/(tabs)/_layout.tsx hides Home's pages.
const routes = [
  { key: 'index-1', name: 'index' },
  { key: 'home-1', name: 'home' },
  { key: 'bible-1', name: 'bible' },
  { key: 'you-1', name: 'you' },
];
const option = (title: string) => ({
  title,
  tabBarActiveTintColor: '#111111',
  tabBarInactiveTintColor: '#777777',
  tabBarLabel: ({ color }: { color: string }) => React.createElement(Text, { style: { color } }, title),
  tabBarIcon: () => null,
});
const descriptors = {
  'index-1': { options: option('Home') },
  'home-1': { options: { tabBarItemStyle: { display: 'none' }, tabBarButton: () => null } },
  'bible-1': { options: option('Bible') },
  'you-1': { options: option('You') },
};

// What Expo Router's tabs pass a custom bar: an emitter and navigateToTab,
// not React Navigation's `navigation`, which 1.7.0's first builds called and
// crashed on every tab press.
const barElement = (
  emit: () => { defaultPrevented: boolean },
  navigateToTab: (routeKey: string) => void,
  index = 0,
  windowWidth = 1032,
) =>
  React.createElement(CapsuleTabBar as any, {
    bottomInset: 20,
    descriptors,
    emitter: { emit },
    navigateToTab,
    state: { index, routes },
    theme: customLightTheme,
    windowWidth,
  });
const renderBar = (...args: Parameters<typeof barElement>) => render(barElement(...args));

describe('the tab bars (#589)', () => {
  it('is white, or the brand blue in the dark theme, with the selected tab on its own pill', () => {
    expect(getBarSurfaceColor(customLightTheme)).toBe('#FFFFFF');
    expect(getBarSurfaceColor(customDarkTheme)).toBe('#00405C');
    expect(getSelectedTabTint(customLightTheme)).toBe(customLightTheme.colors.primaryContainer);
    expect(getSelectedTabTint(customDarkTheme)).toBe('#0B2C3D');
    // The card's pills and round buttons look like the selected tab: its pill
    // colour, with its blue words, or gold in the dark theme.
    for (const theme of [customLightTheme, customDarkTheme]) {
      expect(getDockControlColor(theme)).toBe(getSelectedTabTint(theme));
    }
    expect(getDockControlContentColor(customLightTheme)).toBe(customLightTheme.colors.primary);
    expect(getDockControlContentColor(customDarkTheme)).toBe('#D2B258');
    // The card's pills and round buttons: a brighter gold edge on the dark
    // theme's night blue, 4.2:1 where the outline's was 2.8.
    expect(getDockControlBorderColor(customLightTheme)).toBe(customLightTheme.colors.outline);
    expect(getDockControlBorderColor(customDarkTheme)).toBe('#B89C4D');
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    expect(layout).toMatch(/tabBarActiveTintColor: theme\.dark\s*\? theme\.colors\.metallicGold\.main\s*: theme\.colors\.primary,/);
    expect(layout).toContain('tabBarInactiveTintColor: theme.colors.onSurfaceVariant,');
  });

  it('draws the house a tenth larger, as it fills less of its square than the other tab icons', () => {
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    expect(layout).toContain('const TAB_ICON_OPTICAL_SCALE: Partial<Record<MaterialCommunityIconName, number>> = { home: 1.1 };');
    expect(layout).toContain('* (TAB_ICON_OPTICAL_SCALE[props.name] ?? 1)}');
  });

  it("gives the capsule, the Bible's card and the header's pills one opaque floating surface, so a page's top matches its bottom", () => {
    for (const theme of [customLightTheme, customDarkTheme]) {
      const surface = getFloatingSurfaceStyle(theme);
      expect(surface).toMatchObject({ backgroundColor: theme.colors.floatingSurface, borderColor: theme.colors.outlineVariant });
      // Opaque, so page text scrolling under the header never shows through.
      expect(surface.backgroundColor).toMatch(/^#[\dA-F]{6}$/i);
    }
    expect(readFileSync('components/CapsuleTabBar.tsx', 'utf8')).toMatch(/styles\.capsule,\s+getFloatingSurfaceStyle\(theme\),/);
    expect(readFileSync('app/(tabs)/bible/index.tsx', 'utf8')).toContain('<View style={[styles.dockCard, getFloatingSurfaceStyle(theme)]}>');
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    // The back button, the page title, the search bar, the Bible's translation
    // and three round buttons, and the other pages' search button.
    expect(header.match(/getFloatingSurfaceStyle\(theme\),/g)).toHaveLength(8);
    // None keeps an outline or a shadow of its own.
    for (const name of ['circleBackButton', 'floatingTitleChip', 'floatingSearchbar', 'translationChip', 'collapsedSearchButton']) {
      const block = header.slice(header.indexOf(`\n  ${name}: {`) + 1);
      expect(block.slice(0, block.indexOf('\n  },'))).not.toMatch(/border(Width|Color)|shadow|elevation/);
    }
  });

  it('is a capsule at most 520 points wide, 16 points from the sides of a phone', () => {
    expect(TABLET_TAB_BAR_MIN_WIDTH).toBe(600);
    expect(getCapsuleTabBarWidth(1032)).toBe(CAPSULE_TAB_BAR_MAX_WIDTH);
    expect(getCapsuleTabBarWidth(1376)).toBe(CAPSULE_TAB_BAR_MAX_WIDTH);
    expect(getCapsuleTabBarWidth(390)).toBe(358);
    expect(getCapsuleTabBarWidth(320)).toBe(288);
  });

  it("floats partly within a Face ID iPhone's home indicator inset, and wholly above Android's navigation", () => {
    expect(getCapsuleBottomGap(34, 'ios')).toBe(20);
    expect(getCapsuleBottomGap(20, 'ios')).toBe(12);
    expect(getCapsuleBottomGap(0, 'ios')).toBe(12);
    // The gesture bar's inset, and the three buttons'.
    expect(getCapsuleBottomGap(24, 'android')).toBe(32);
    expect(getCapsuleBottomGap(48, 'android')).toBe(56);
    expect(getCapsuleBottomGap(0, 'android')).toBe(12);
  });

  it.each([1032, 390, 412, 1280])("at %p points shows the visible tabs, and marks the selected one, not Home's hidden pages", async (width) => {
    const { getAllByRole, queryByText } = await renderBar(() => ({ defaultPrevented: false }), jest.fn(), 0, width);
    const tabs = getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Home', 'Bible', 'You']);
    expect(tabs.map((tab) => tab.props.accessibilityState.selected)).toEqual([true, false, false]);
    expect(queryByText('Home')).not.toBeNull();
  });

  it("emits tabPress like Expo Router's own bar, so a screen's listener can take over", async () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigateToTab = jest.fn();
    const { getAllByRole } = await renderBar(emit, navigateToTab);
    await fireEvent.press(getAllByRole('tab')[1]);
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'bible-1', canPreventDefault: true });
    expect(navigateToTab).toHaveBeenCalledWith('bible-1');
    await fireEvent(getAllByRole('tab')[2], 'longPress');
    expect(emit).toHaveBeenCalledWith({ type: 'tabLongPress', target: 'you-1' });
    // The Bible and You tabs prevent the default and navigate themselves.
    const prevented = jest.fn();
    const { getAllByRole: tabsAgain } = await renderBar(() => ({ defaultPrevented: true }), prevented);
    await fireEvent.press(tabsAgain('tab')[2]);
    expect(prevented).not.toHaveBeenCalled();
    // Pressing the selected tab doesn't navigate.
    const again = jest.fn();
    const { getAllByRole: third } = await renderBar(() => ({ defaultPrevented: false }), again);
    await fireEvent.press(third('tab')[0]);
    expect(again).not.toHaveBeenCalled();
  });

  it('presses each tab on the iPhone and iPad runners, and on the Android emulator, failing if the app stops', () => {
    const { findTabs, TAB_PRESS_ORDER } = require('../scripts/capture-ios-screens.cjs');
    // Vision's lines, as fractions of the screen: the tab labels are the
    // lowest that read exactly each label, not a word higher up the page.
    const line = (text: string, x: number, y: number) => ({ text, box: [x, y, 0.1, 0.02] });
    expect(
      findTabs([line('Bible', 0.4, 0.1), line('Home', 0.1, 0.93), line('Bible', 0.35, 0.93), line('Explore', 0.6, 0.93), line('You', 0.85, 0.93)]),
    ).toEqual({
      Home: { x: expect.closeTo(0.15), y: expect.closeTo(0.94) },
      Bible: { x: expect.closeTo(0.4), y: expect.closeTo(0.94) },
      Explore: { x: expect.closeTo(0.65), y: expect.closeTo(0.94) },
      You: { x: expect.closeTo(0.9), y: expect.closeTo(0.94) },
    });
    expect(findTabs([line('Home', 0.1, 0.93)]).You).toBeUndefined();
    expect(TAB_PRESS_ORDER).toEqual(['Bible', 'Explore', 'You', 'Home', 'Bible']);
    const ios = readFileSync('.github/workflows/ios-key-screens.yml', 'utf8');
    expect(ios).toContain('run: node scripts/capture-ios-screens.cjs --press-tabs --out "$RUNNER_TEMP/ios-pr-preview"');
    expect(ios).toContain('run: node scripts/capture-ios-screens.cjs --platform ipad --press-tabs --out "$RUNNER_TEMP/ipad-part"');
    expect(ios.match(/matrix\.group == 'worship-and-you' \}\}/g)).toHaveLength(2);
    const android = readFileSync('scripts/e2e/android-bible-audio.sh', 'utf8');
    expect(android).toContain('run tab-presses scenario_tab_presses');
  });

  it("takes Expo Router's tab bar props as they are, so the typecheck catches a mismatch", () => {
    // A cast here hid that Expo Router passes no `navigation`, and every tab
    // press crashed in 1.7.0's first test builds.
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    expect(layout).toMatch(/<CapsuleTabBar\s+\{\.\.\.props\}/);
    expect(layout).not.toMatch(/\{\.\.\.\(props as any\)\}/);
    expect(readFileSync('components/TabBarItems.ts', 'utf8')).toContain(
      "export type TabBarProps = Pick<BottomTabBarProps, 'descriptors' | 'emitter' | 'navigateToTab' | 'state'>;",
    );
    // And Expo Router's tabs still hand a custom bar these.
    const view = readFileSync('node_modules/expo-router/build/react-navigation/bottom-tabs/views/BottomTabView.js', 'utf8');
    expect(view).toMatch(/tabBar\(\{\s*state,\s*descriptors,\s*emitter,\s*navigateToTab,/);
  });

  it('is the one tab bar on every system, with pages running under it and room at their ends', () => {
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    expect(layout).toMatch(/tabBar=\{\(props\) => \(\s*<Animated\.View[\s\S]*?<CapsuleTabBar[\s\S]*?<\/Animated\.View>\s*\)\}/);
    expect(layout).not.toContain('BottomTabBar ');
    expect(layout).toContain('paddingBottom: 0,');
    expect(layout).toContain('<TabBarClearanceContext.Provider value={tabBarHeight}>');
  });

  describe("the selected tab's pill (#704)", () => {
    const tint = getSelectedTabTint(customLightTheme);
    const noop = () => ({ defaultPrevented: false });
    // The three tabs' places in the row, as onLayout reports them.
    const layOut = async (tabs: ReturnType<Awaited<ReturnType<typeof renderBar>>['getAllByRole']>) => {
      for (const [i, tab] of tabs.entries()) {
        await fireEvent(tab, 'layout', { nativeEvent: { layout: { x: i * 117, y: 0, width: 117, height: 60 } } });
      }
    };
    const pillStyle = (screen: Awaited<ReturnType<typeof renderBar>>) =>
      StyleSheet.flatten(screen.getByTestId('tab-selection-pill').props.style);
    const tabBackgrounds = (screen: Awaited<ReturnType<typeof renderBar>>) =>
      screen.getAllByRole('tab').map((tab) => StyleSheet.flatten(tab.props.style).backgroundColor);
    // React Native's own mock of it is a jest.fn, which restoreMocks leaves
    // as the last test set it.
    beforeEach(() => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    });

    it('has no Android ripple, which flashed a square behind a pressed tab', () => {
      expect(readFileSync('components/CapsuleTabBar.tsx', 'utf8')).not.toMatch(/android_ripple=/);
    });

    it('slides to a tab the moment it is pressed, on the native driver', async () => {
      const timing = jest.spyOn(Animated, 'timing');
      const navigateToTab = jest.fn();
      const screen = await renderBar(noop, navigateToTab, 0, 390);
      // Until the tabs are measured, the selected tab draws its own pill.
      expect(tabBackgrounds(screen)).toEqual([tint, undefined, undefined]);
      expect(pillStyle(screen)).toMatchObject({ opacity: 0 });
      await layOut(screen.getAllByRole('tab'));
      // Then one pill behind the tabs, the selected tab's size and place.
      expect(tabBackgrounds(screen)).toEqual([undefined, undefined, undefined]);
      expect(pillStyle(screen)).toMatchObject({ backgroundColor: tint, borderRadius: 999, opacity: 1, transform: [{ translateX: 0 }], width: 117 });
      await fireEvent.press(screen.getAllByRole('tab')[1]);
      // It starts sliding before the router switches tabs.
      expect(timing).toHaveBeenCalledTimes(1);
      expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 117, duration: TAB_SLIDE_MS, useNativeDriver: true });
      expect(navigateToTab).toHaveBeenCalledWith('bible-1');
      // The router's switch to the tab doesn't slide it again.
      await screen.rerender(barElement(noop, navigateToTab, 2, 390));
      expect(timing).toHaveBeenCalledTimes(1);
      // Pressing the selected tab leaves it where it is.
      await fireEvent.press(screen.getAllByRole('tab')[1]);
      expect(timing).toHaveBeenCalledTimes(1);
    });

    it('moves at once with Reduce Motion or Remove animations on', async () => {
      jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
      const timing = jest.spyOn(Animated, 'timing');
      const screen = await renderBar(noop, jest.fn(), 0, 390);
      await act(async () => {});
      await layOut(screen.getAllByRole('tab'));
      await fireEvent.press(screen.getAllByRole('tab')[2]);
      expect(timing).not.toHaveBeenCalled();
      expect(pillStyle(screen)).toMatchObject({ opacity: 1, transform: [{ translateX: 234 }] });
    });

    it("waits on the pressed tab while the router switches, and goes back if it doesn't", async () => {
      jest.useFakeTimers();
      try {
        const timing = jest.spyOn(Animated, 'timing');
        const screen = await renderBar(noop, jest.fn(), 0, 390);
        await layOut(screen.getAllByRole('tab'));
        await fireEvent.press(screen.getAllByRole('tab')[2]);
        expect(timing.mock.calls.map((call) => call[1].toValue)).toEqual([234]);
        // A render while the router is still on Home doesn't slide it back.
        await screen.rerender(barElement(noop, jest.fn(), 0, 390));
        expect(timing.mock.calls.map((call) => call[1].toValue)).toEqual([234]);
        // But if the router never switches, it goes back to the selected tab.
        await act(async () => {
          jest.advanceTimersByTime(TAB_PRESS_SETTLE_MS);
        });
        expect(timing.mock.calls.map((call) => call[1].toValue)).toEqual([234, 0]);
      } finally {
        jest.useRealTimers();
      }
    });

    it("isn't shown on Home's own pages, where no tab is selected, and appears without sliding", async () => {
      const timing = jest.spyOn(Animated, 'timing');
      // The hidden `home` route, as on the bulletin.
      const screen = await renderBar(noop, jest.fn(), 1, 390);
      await layOut(screen.getAllByRole('tab'));
      expect(tabBackgrounds(screen)).toEqual([undefined, undefined, undefined]);
      expect(pillStyle(screen)).toMatchObject({ opacity: 0 });
      await fireEvent.press(screen.getAllByRole('tab')[1]);
      expect(timing).not.toHaveBeenCalled();
      expect(pillStyle(screen)).toMatchObject({ opacity: 1, transform: [{ translateX: 117 }], width: 117 });
    });

    it('keeps to its tab when the tabs change size, as with a new text size', async () => {
      const screen = await renderBar(noop, jest.fn(), 2, 390);
      await layOut(screen.getAllByRole('tab'));
      expect(pillStyle(screen)).toMatchObject({ transform: [{ translateX: 117 }], width: 117 });
      await fireEvent(screen.getAllByRole('tab')[1], 'layout', { nativeEvent: { layout: { x: 100, y: 0, width: 100, height: 80 } } });
      expect(pillStyle(screen)).toMatchObject({ transform: [{ translateX: 100 }], width: 100 });
    });
  });

  it('fades the page out only in a soft halo behind the capsule and the Bible card (#681)', () => {
    // Before #681, a fade and a band of the page's colour hid the whole row.
    const capsule = readFileSync('components/CapsuleTabBar.tsx', 'utf8');
    expect(capsule).not.toContain('LinearGradient');
    expect(capsule).not.toMatch(/ScrollEdgeFade|FADE_HEIGHT/);
    expect(capsule).toContain('boxShadow: `0 0 ${HALO_BLUR}px ${HALO_SPREAD}px ${background}`');
    expect(capsule).toContain('{halo && (');
    const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
    expect(bible).not.toContain('ScrollEdgeFade');
    // The card's halo and the capsule's place below it, hugging them on every
    // screen, phones included: the page shows beside them as it scrolls.
    expect(bible.match(/<FloatingHalo\b/g)).toHaveLength(2);
    expect(capsule).not.toMatch(/haloFillsRow|HALO_PAST_EDGE/);
    expect(bible).not.toMatch(/haloFillsRow|HALO_PAST_EDGE/);
    // The bar's wrapper has no background of its own.
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    const wrapper = layout.match(/<Animated\.View\s+onLayout=\{handleTabBarLayout\}[\s\S]*?>/)?.[0] ?? '';
    expect(wrapper).toContain("position: 'absolute'");
    expect(wrapper).not.toContain('backgroundColor');
    // On the Bible the card draws the capsule's halo, under the card.
    expect(layout).toContain('halo={!isBibleRoute}');
  });


  it("leaves room at the end of every tab page's scrolling for the capsule (TabBarSpacer)", () => {
    const pages = (readdirSync('app/(tabs)', { recursive: true }) as string[])
      .filter((file) => file.endsWith('.tsx'))
      .map((file) => `app/(tabs)/${file}`)
      .concat('components/OfflineBibleAudio.tsx');
    const scrolling = pages.filter((file) => readFileSync(file, 'utf8').includes('</ScrollView>'));
    expect(scrolling.length).toBeGreaterThan(15);
    for (const file of scrolling) {
      const source = readFileSync(file, 'utf8');
      // The Bible's reader makes room for its dock and the capsule itself.
      if (file.endsWith('bible/index.tsx')) continue;
      expect([file, /<TabBarSpacer \/>\s*<\/ScrollView>/.test(source)]).toEqual([file, true]);
    }
    expect(readFileSync('features/hymnal/HymnalScreen.tsx', 'utf8')).toContain('paddingBottom: insets.bottom + 50 + tabBarClearance');
  });
});
