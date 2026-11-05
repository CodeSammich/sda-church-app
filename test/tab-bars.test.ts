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
  getDockControlColor,
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

const renderBar = (navigation: any, index = 0, windowWidth = 1032) =>
  render(
    React.createElement(CapsuleTabBar as any, {
      bottomInset: 20,
      descriptors,
      navigation,
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
    for (const theme of [customLightTheme, customDarkTheme]) {
      expect(getDockControlColor(theme)).toBe(theme.colors.background);
    }
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
    const { getAllByRole, queryByText } = await renderBar({ emit: () => ({ defaultPrevented: false }), navigate: jest.fn() }, 0, width);
    const tabs = getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Home', 'Bible', 'You']);
    expect(tabs.map((tab) => tab.props.accessibilityState.selected)).toEqual([true, false, false]);
    expect(queryByText('Home')).not.toBeNull();
  });

  it("emits tabPress like React Navigation's bar, so a screen's listener can take over", async () => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigate = jest.fn();
    const { getAllByRole } = await renderBar({ emit, navigate });
    await fireEvent.press(getAllByRole('tab')[1]);
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'bible-1', canPreventDefault: true });
    expect(navigate).toHaveBeenCalledWith('bible', undefined);
    // The Bible and You tabs prevent the default and navigate themselves.
    const prevented = jest.fn();
    const { getAllByRole: tabsAgain } = await renderBar({ emit: () => ({ defaultPrevented: true }), navigate: prevented });
    await fireEvent.press(tabsAgain('tab')[2]);
    expect(prevented).not.toHaveBeenCalled();
    // Pressing the selected tab doesn't navigate.
    const again = jest.fn();
    const { getAllByRole: third } = await renderBar({ emit: () => ({ defaultPrevented: false }), navigate: again });
    await fireEvent.press(third('tab')[0]);
    expect(again).not.toHaveBeenCalled();
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
