import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  CAPSULE_TAB_BAR_MAX_WIDTH,
  CapsuleTabBar,
  getCapsuleBottomGap,
  getCapsuleTabBarWidth,
  getFloatingSurfaceStyle,
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
const renderBar = (
  emit: () => { defaultPrevented: boolean },
  navigateToTab: (routeKey: string) => void,
  index = 0,
  windowWidth = 1032,
) =>
  render(
    React.createElement(CapsuleTabBar as any, {
      bottomInset: 20,
      descriptors,
      emitter: { emit },
      navigateToTab,
      state: { index, routes },
      theme: customLightTheme,
      windowWidth,
    }),
  );

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
    // Android's touch ripple, kept within each tab's pill.
    expect(readFileSync('components/CapsuleTabBar.tsx', 'utf8')).toContain('android_ripple={{ color: getSelectedTabTint(theme) }}');
  });

  it("runs the bars' halo edge to edge on a phone, and hugs them on a wider screen (#681)", () => {
    const { haloFillsRow, getCapsuleTabBarWidth } = require('@/components/CapsuleTabBar');
    const gap = (width: number, bar: number) => (width - bar) / 2;
    // A phone's capsule and card leave 16 points a side.
    expect(haloFillsRow(gap(402, getCapsuleTabBarWidth(402)))).toBe(true);
    expect(haloFillsRow(gap(384, 352))).toBe(true);
    // An iPad window the card nearly fills: Slide Over, or a 678-point Split View.
    expect(haloFillsRow(gap(320, 288))).toBe(true);
    expect(haloFillsRow(gap(678, 640))).toBe(true);
    // The 13-inch iPad: the card is at most 640 and the capsule 520.
    expect(haloFillsRow(gap(1032, 640))).toBe(false);
    expect(haloFillsRow(gap(1032, getCapsuleTabBarWidth(1032)))).toBe(false);
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
    // Edge to edge on a phone; on a wider screen, the card's halo and the
    // capsule's place below it.
    expect(bible.match(/<FloatingHalo\b/g)).toHaveLength(3);
    expect(bible).toContain('haloFillsRow((viewportWidth - dockCardWidth) / 2) ? (');
    expect(capsule).toContain('haloFillsRow((windowWidth - getCapsuleTabBarWidth(windowWidth)) / 2)');
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
