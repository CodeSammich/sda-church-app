import React from 'react';
import { readdirSync, readFileSync } from 'node:fs';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  CAPSULE_TAB_BAR_MAX_WIDTH,
  CapsuleTabBar,
  getCapsuleBottomGap,
  getCapsuleTabBarWidth,
} from '@/components/CapsuleTabBar';
import { MaterialTabBar } from '@/components/MaterialTabBar';
import { getTabBarStyle, TABLET_TAB_BAR_MIN_WIDTH } from '@/components/TabBarItems';
import { customLightTheme } from '@/constants/Themes';

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

const bars = {
  capsule: CapsuleTabBar,
  material: (props: any) => React.createElement(MaterialTabBar, { ...props, sideInset: 0 }),
};

const renderBar = (navigation: any, index = 0, bar: keyof typeof bars = 'capsule', windowWidth = 1032) =>
  render(
    React.createElement(bars[bar] as any, {
      bottomInset: 20,
      descriptors,
      navigation,
      state: { index, routes },
      theme: customLightTheme,
      windowWidth,
    }),
  );

describe('the tab bars (#589)', () => {
  it("follows each system: Material's bar on Android, the capsule on iPhone, iPad and the web", () => {
    expect(getTabBarStyle('android')).toBe('material');
    expect(getTabBarStyle('ios')).toBe('capsule');
    expect(getTabBarStyle('web')).toBe('capsule');
  });

  it('is a capsule at most 520 points wide, 16 points from the sides of a phone', () => {
    expect(TABLET_TAB_BAR_MIN_WIDTH).toBe(600);
    expect(getCapsuleTabBarWidth(1032)).toBe(CAPSULE_TAB_BAR_MAX_WIDTH);
    expect(getCapsuleTabBarWidth(1376)).toBe(CAPSULE_TAB_BAR_MAX_WIDTH);
    expect(getCapsuleTabBarWidth(390)).toBe(358);
    expect(getCapsuleTabBarWidth(320)).toBe(288);
  });

  it("floats partly within a Face ID iPhone's home indicator inset, as iOS's own bar does", () => {
    expect(getCapsuleBottomGap(34)).toBe(20);
    expect(getCapsuleBottomGap(20)).toBe(12);
    expect(getCapsuleBottomGap(0)).toBe(12);
  });

  it.each([
    ['capsule', 1032],
    ['capsule', 390],
    ['material', 412],
    ['material', 1280],
  ] as const)("%s at %p points shows the visible tabs, and marks the selected one, not Home's hidden pages", async (bar, width) => {
    const { getAllByRole, queryByText } = await renderBar({ emit: () => ({ defaultPrevented: false }), navigate: jest.fn() }, 0, bar, width);
    const tabs = getAllByRole('tab');
    expect(tabs.map((tab) => tab.props.accessibilityLabel)).toEqual(['Home', 'Bible', 'You']);
    expect(tabs.map((tab) => tab.props.accessibilityState.selected)).toEqual([true, false, false]);
    expect(queryByText('Home')).not.toBeNull();
  });

  it.each(['capsule', 'material'] as const)("%s emits tabPress like React Navigation's bar, so a screen's listener can take over", async (bar) => {
    const emit = jest.fn(() => ({ defaultPrevented: false }));
    const navigate = jest.fn();
    const { getAllByRole } = await renderBar({ emit, navigate }, 0, bar);
    await fireEvent.press(getAllByRole('tab')[1]);
    expect(emit).toHaveBeenCalledWith({ type: 'tabPress', target: 'bible-1', canPreventDefault: true });
    expect(navigate).toHaveBeenCalledWith('bible', undefined);
    // The Bible and You tabs prevent the default and navigate themselves.
    const prevented = jest.fn();
    const { getAllByRole: tabsAgain } = await renderBar({ emit: () => ({ defaultPrevented: true }), navigate: prevented }, 0, bar);
    await fireEvent.press(tabsAgain('tab')[2]);
    expect(prevented).not.toHaveBeenCalled();
    // Pressing the selected tab doesn't navigate.
    const again = jest.fn();
    const { getAllByRole: third } = await renderBar({ emit: () => ({ defaultPrevented: false }), navigate: again }, 0, bar);
    await fireEvent.press(third('tab')[0]);
    expect(again).not.toHaveBeenCalled();
  });

  it('lets pages run under the capsule, with room at their ends, and stop above Android\'s bar', () => {
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    expect(layout).toContain("const capsule = getTabBarStyle() === 'capsule';");
    expect(layout).toContain('paddingBottom: capsule ? 0 : tabBarHeight,');
    expect(layout).toContain('<TabBarClearanceContext.Provider value={capsule ? tabBarHeight : 0}>');
    expect(layout).toMatch(/\{capsule \? \(\s*<CapsuleTabBar[\s\S]*?\) : \(\s*<MaterialTabBar[\s\S]*?\)\}/);
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
