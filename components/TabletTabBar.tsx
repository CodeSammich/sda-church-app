import type { AppTheme } from '@/constants/Themes';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

/**
 * A screen at least this wide, such as a tablet's, gets TabletTabBar; a
 * phone, and a narrow iPad window beside another app, keep the full-width tab
 * bar.
 */
export const TABLET_TAB_BAR_MIN_WIDTH = 600;

// The capsule's widest: about 130 points a tab, so the four stay near each
// other rather than spread across the screen.
export const TABLET_TAB_BAR_MAX_WIDTH = 520;
// Its gap from the screen's sides when the screen is narrower than that.
const SIDE_MARGIN = 24;

/** How wide the tablet's capsule is in a window this wide. */
export const getTabletTabBarWidth = (windowWidth: number) =>
  Math.min(windowWidth - 2 * SIDE_MARGIN, TABLET_TAB_BAR_MAX_WIDTH);

type TabRoute = { key: string; name: string; params?: object };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: any }>;
  navigation: {
    emit: (event: any) => { defaultPrevented: boolean };
    navigate: (name: string, params?: object) => void;
  };
};

/**
 * The tab bar on a tablet (#324, #589): a phone's full-width bar stretched
 * across an iPad looked like a phone app blown up. Here the four tabs sit in
 * a rounded capsule, centred above the bottom edge, in the app's warm card
 * colour like its other cards and pills, with a lighter pill behind the
 * selected tab. The icons and labels are the app's own, so they follow its
 * text size as on a phone, and the bar is the same on iPad and Android.
 */
export function TabletTabBar({
  bottomInset,
  descriptors,
  navigation,
  state,
  theme,
  windowWidth,
}: TabBarProps & { bottomInset: number; theme: AppTheme; windowWidth: number }) {
  const focusedKey = state.routes[state.index]?.key;
  // Not the routes the tab bar hides, such as Home's pages.
  const routes = state.routes.filter((route) => descriptors[route.key]?.options.tabBarItemStyle?.display !== 'none');

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(bottomInset, 12) }]}>
      <View
        style={[
          styles.capsule,
          {
            width: getTabletTabBarWidth(windowWidth),
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {routes.map((route) => {
          const { options } = descriptors[route.key];
          const focused = route.key === focusedKey;
          const color = String(focused ? options.tabBarActiveTintColor : options.tabBarInactiveTintColor);
          const label =
            typeof options.tabBarLabel === 'function'
              ? options.tabBarLabel({ focused, color, position: 'below-icon', children: options.title })
              : options.title;
          // As React Navigation's own tab bar: the screen's tabPress listeners
          // can take over, as the Bible and You tabs do to reset their stacks.
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          return (
            <Pressable
              key={route.key}
              accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              onPress={onPress}
              style={[styles.item, focused && { backgroundColor: theme.dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }]}
              testID={options.tabBarButtonTestID}
            >
              {options.tabBarIcon?.({ focused, color, size: 30 })}
              {label}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
  },
  capsule: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: 4,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 3 },
      default: { boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
    }),
  },
  item: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 4,
  },
});
