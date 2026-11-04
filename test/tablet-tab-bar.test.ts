import React from 'react';
import { readFileSync } from 'node:fs';
import { fireEvent, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import {
  getTabletTabBarWidth,
  TABLET_TAB_BAR_MAX_WIDTH,
  TABLET_TAB_BAR_MIN_WIDTH,
  TabletTabBar,
} from '@/components/TabletTabBar';
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

const renderBar = (navigation: any, index = 0) =>
  render(
    React.createElement(TabletTabBar, {
      bottomInset: 20,
      descriptors,
      navigation,
      state: { index, routes },
      theme: customLightTheme,
      windowWidth: 1032,
    }),
  );

describe('the tablet tab bar (#589)', () => {
  it('is a capsule at most 520 points wide, on screens at least 600 points wide', () => {
    expect(TABLET_TAB_BAR_MIN_WIDTH).toBe(600);
    expect(getTabletTabBarWidth(1032)).toBe(TABLET_TAB_BAR_MAX_WIDTH);
    expect(getTabletTabBarWidth(1376)).toBe(TABLET_TAB_BAR_MAX_WIDTH);
    // Narrower than that plus its margins, it keeps 24 points from each side.
    expect(getTabletTabBarWidth(560)).toBe(512);
  });

  it("shows the visible tabs, and marks the selected one, not Home's hidden pages", async () => {
    const { getAllByRole, queryByText } = await renderBar({ emit: () => ({ defaultPrevented: false }), navigate: jest.fn() });
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

  it("is used on a tablet only: a phone keeps React Navigation's full-width bar", () => {
    const layout = readFileSync('app/(tabs)/_layout.tsx', 'utf8');
    expect(layout).toContain('const tablet = windowWidth >= TABLET_TAB_BAR_MIN_WIDTH;');
    expect(layout).toMatch(/\{tablet \? \(\s*<TabletTabBar[\s\S]*?\) : \(\s*<BottomTabBar \{\.\.\.\(props as any\)\} \/>\s*\)\}/);
    // A phone's icons and labels keep their sizes.
    expect(layout).toContain('size={props.tablet ? 30 : DESIGN_TOKENS.ICON_SIZE_TAB}');
    expect(layout).toContain('const fontSize = props.tablet ? 12 : DESIGN_TOKENS.BOTTOM_TAB_LABEL_FONT_SIZE;');
  });
});
