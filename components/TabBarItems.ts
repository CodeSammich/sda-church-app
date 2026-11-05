import type { AppTheme } from '@/constants/Themes';
import type React from 'react';

/**
 * A window at least this wide, such as a tablet's, gets the tab bar's larger
 * tablet sizes; a phone, and a narrow iPad window beside another app, keep
 * the phone's.
 */
export const TABLET_TAB_BAR_MIN_WIDTH = 600;

/**
 * The colour of everything that floats over a page (#589): the tab bar, the
 * Bible's dock card and the header's buttons. White in the light theme and the
 * brand's night blue in the dark. Older members with presbyopia couldn't tell
 * a surface a shade off the page from the page itself; only white and blue
 * read to them as on top and pressable. Keep them that distinct.
 */
export const getBarSurfaceColor = (theme: AppTheme) => theme.colors.floatingSurface;

/**
 * The colour of the dock card's pills and round buttons: the selected tab's
 * light blue, or its deeper night blue in the dark theme, so the card's
 * controls match the tab bar below them. The page's own warm pink, or black,
 * looked out of place on the white or night blue card.
 */
export const getDockControlColor = (theme: AppTheme) => theme.colors.floatingSelected;

/**
 * The words and icons on the dock card's pills and round buttons: the selected
 * tab's blue, or its gold in the dark theme, so each control looks like the
 * selected tab below it, and the header's translation button matches them.
 * Blue stands out 5.2:1 on the light blue and gold 7.1:1 on the night blue;
 * gold on the light blue would be unreadable (1.8:1).
 */
export const getDockControlContentColor = (theme: AppTheme) => theme.colors.primary;

/**
 * The edge of the dock card's pills and round buttons: the theme's outline, or
 * in the dark theme a brighter gold. On the card's night blue the outline's
 * gold stood out only 2.8:1, below the 3:1 a control's edge needs; this one
 * stands out 4.2:1, so older eyes can find the buttons.
 */
export const getDockControlBorderColor = (theme: AppTheme) =>
  theme.dark ? theme.colors.metallicGold.mid : theme.colors.outline;

/**
 * The pill behind the selected tab: light blue behind the blue tab, or a
 * deeper night blue behind the gold one in the dark theme.
 */
export const getSelectedTabTint = (theme: AppTheme) => theme.colors.floatingSelected;

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
