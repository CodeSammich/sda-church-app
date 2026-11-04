import type { AppTheme } from '@/constants/Themes';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

/**
 * The tab bar's look on each platform (#589): on iOS, a floating capsule like
 * the system's own iOS 26 tab bar, in Liquid Glass where the iPhone or iPad
 * has it, but at the bottom on an iPad too, where the system's would sit at
 * the top over the app's header; on Android, Material 3's navigation bar, with
 * its pill behind the selected tab's icon. Both draw the app's own icons and
 * labels, so the labels follow the app's text size, as members who enlarge
 * text rely on.
 */
export type AppTabBarVariant = 'glass' | 'material';

export const getAppTabBarVariant = (platform: string): AppTabBarVariant =>
  platform === 'android' ? 'material' : 'glass';

/** A screen at least this wide, such as a tablet's, gets the larger tab bar. */
export const WIDE_TAB_BAR_MIN_WIDTH = 600;

// The glass capsule's widest, on a tablet: about 130 points a tab.
const WIDE_CAPSULE_MAX_WIDTH = 520;
// Its gap from the screen's sides on a phone, and its inner padding.
const CAPSULE_SIDE_MARGIN = 16;
const CAPSULE_PADDING = 4;

type TabRoute = { key: string; name: string; params?: object };
type TabBarProps = {
  state: { index: number; routes: TabRoute[] };
  descriptors: Record<string, { options: any }>;
  navigation: { emit: (event: any) => { defaultPrevented: boolean }; navigate: (name: string, params?: object) => void };
};

export function AppTabBar({
  bottomInset,
  descriptors,
  navigation,
  sideInset,
  state,
  theme,
  variant,
  wide,
  windowWidth,
}: TabBarProps & {
  bottomInset: number;
  sideInset: number;
  theme: AppTheme;
  variant: AppTabBarVariant;
  wide: boolean;
  windowWidth: number;
}) {
  const focusedKey = state.routes[state.index]?.key;
  // The routes the tab bar shows: not the hidden ones, such as Home's pages.
  const routes = state.routes.filter((route) => descriptors[route.key]?.options.tabBarItemStyle?.display !== 'none');

  const items = routes.map((route) => {
    const { options } = descriptors[route.key];
    const focused = route.key === focusedKey;
    const color = String(focused ? options.tabBarActiveTintColor : options.tabBarInactiveTintColor);
    const label = typeof options.tabBarLabel === 'function'
      ? options.tabBarLabel({ focused, color, position: 'below-icon', children: options.title })
      : options.title;
    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
    };
    const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });
    return (
      <Pressable
        key={route.key}
        accessibilityLabel={options.tabBarAccessibilityLabel ?? options.title}
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        onLongPress={onLongPress}
        onPress={onPress}
        style={[
          variant === 'glass' ? styles.glassItem : styles.materialItem,
          variant === 'glass' && focused && { backgroundColor: glassSelectionColor(theme) },
        ]}
        testID={options.tabBarButtonTestID}
      >
        {options.tabBarIcon?.({ focused, color, size: 24 })}
        {label}
      </Pressable>
    );
  });

  if (variant === 'material') {
    return (
      <View
        style={[
          styles.materialBar,
          {
            backgroundColor: theme.colors.elevation.level1,
            paddingBottom: bottomInset,
            paddingHorizontal: sideInset,
          },
        ]}
      >
        {items}
      </View>
    );
  }

  const capsuleWidth = wide
    ? Math.min(windowWidth - 2 * 24, WIDE_CAPSULE_MAX_WIDTH)
    : windowWidth - 2 * CAPSULE_SIDE_MARGIN;
  return (
    <View style={[styles.glassOuter, { paddingBottom: Math.max(bottomInset, 8) }]}>
      <View
        style={[
          styles.capsule,
          {
            width: capsuleWidth,
            borderColor: theme.dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
          },
        ]}
      >
        <CapsuleBackground theme={theme} />
        {items}
      </View>
    </View>
  );
}

/** The selected tab's lighter pill inside the glass capsule. */
const glassSelectionColor = (theme: AppTheme) => (theme.dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.07)');

/**
 * The capsule's background: Liquid Glass on iOS 26 and later, frosted blur
 * on earlier iOS and the web, both over the page behind the bar.
 */
function CapsuleBackground({ theme }: { theme: AppTheme }) {
  if (Platform.OS === 'ios' && isLiquidGlassAvailable()) {
    return (
      <GlassView
        colorScheme={theme.dark ? 'dark' : 'light'}
        glassEffectStyle="regular"
        isInteractive
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return (
    <>
      <BlurView intensity={60} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: theme.dark ? 'rgba(30,28,22,0.72)' : 'rgba(255,255,255,0.72)' },
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  glassOuter: {
    alignItems: 'center',
  },
  capsule: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    overflow: 'hidden',
    padding: CAPSULE_PADDING,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 4 } },
      default: {},
    }),
  },
  glassItem: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 2,
  },
  materialBar: {
    flexDirection: 'row',
    paddingTop: 12,
  },
  materialItem: {
    alignItems: 'center',
    flex: 1,
    gap: 4,
    minWidth: 0,
    paddingBottom: 12,
  },
});
