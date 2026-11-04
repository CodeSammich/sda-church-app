import type { AppTheme } from '@/constants/Themes';
import type React from 'react';
import { Platform } from 'react-native';

/**
 * A window at least this wide, such as a tablet's, gets the tab bar's larger
 * tablet sizes; a phone, and a narrow iPad window beside another app, keep
 * the phone's.
 */
export const TABLET_TAB_BAR_MIN_WIDTH = 600;

/**
 * Each system's own kind of tab bar (#589): Android's follows Material 3, a
 * full-width bar along the bottom; iPhone, iPad and the web get iOS's
 * floating capsule (CapsuleTabBar), in the app's colours. The Bible's dock
 * follows the same system.
 */
export type TabBarStyleName = 'capsule' | 'material';
export const getTabBarStyle = (os: string = Platform.OS): TabBarStyleName =>
  os === 'android' ? 'material' : 'capsule';

/** The tint behind the selected tab, on the bar's warm card colour. */
export const getSelectedTabTint = (theme: AppTheme) =>
  theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';

type TabRoute = { key: string; name: string; params?: object };
export type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: any }>;
  navigation: {
    emit: (event: any) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

export type TabItem = {
  key: string;
  accessibilityLabel: string;
  focused: boolean;
  icon: (size: number) => React.ReactNode;
  label: React.ReactNode;
  onLongPress: () => void;
  onPress: () => void;
  testID?: string;
};

/**
 * The tabs a bar shows, not the routes it hides (such as Home's pages), with
 * their icons, labels and presses as React Navigation's own bar has them.
 */
export const getTabItems = ({ descriptors, navigation, state }: TabBarProps): TabItem[] => {
  const focusedKey = state.routes[state.index]?.key;
  return state.routes
    .filter((route) => descriptors[route.key]?.options.tabBarItemStyle?.display !== 'none')
    .map((route) => {
      const { options } = descriptors[route.key];
      const focused = route.key === focusedKey;
      const color = String(focused ? options.tabBarActiveTintColor : options.tabBarInactiveTintColor);
      return {
        key: route.key,
        accessibilityLabel: options.tabBarAccessibilityLabel ?? options.title,
        focused,
        icon: (size: number) => options.tabBarIcon?.({ focused, color, size }),
        label:
          typeof options.tabBarLabel === 'function'
            ? options.tabBarLabel({ focused, color, position: 'below-icon', children: options.title })
            : options.title,
        onLongPress: () => {
          navigation.emit({ type: 'tabLongPress', target: route.key });
        },
        // As React Navigation's own tab bar: the screen's tabPress listeners
        // can take over, as the Bible and You tabs do to reset their stacks.
        onPress: () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
        },
        testID: options.tabBarButtonTestID,
      };
    });
};
