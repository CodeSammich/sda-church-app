import type { AppTheme } from '@/constants/Themes';
import type React from 'react';

/**
 * A window at least this wide, such as a tablet's, gets the tab bar's larger
 * tablet sizes; a phone, and a narrow iPad window beside another app, keep
 * the phone's.
 */
export const TABLET_TAB_BAR_MIN_WIDTH = 600;

/**
 * The colour of the floating tab bar and the Bible's dock card (#589): the
 * theme's surface, a shade off the page (lighter in the light theme, charcoal
 * in the dark), so with their shadow they read as raised above the text that
 * scrolls under them.
 */
export const getBarSurfaceColor = (theme: AppTheme) => theme.colors.surface;

/**
 * The colour of the dock card's pills and round buttons: the page's own (warm
 * pink, or black in the dark theme), set off from the card's.
 */
export const getDockControlColor = (theme: AppTheme) => theme.colors.background;

/**
 * The pill behind the selected tab: the theme's selection container, light
 * blue behind the blue tab, or gold-brown behind the gold one in the dark theme.
 */
export const getSelectedTabTint = (theme: AppTheme) => theme.colors.primaryContainer;

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
