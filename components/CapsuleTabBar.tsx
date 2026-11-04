import { getSelectedTabTint, getTabItems, TABLET_TAB_BAR_MIN_WIDTH, type TabBarProps } from '@/components/TabBarItems';
import type { AppTheme } from '@/constants/Themes';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

// The capsule's widest: about 130 points a tab, so the four stay near each
// other rather than spread across a tablet.
export const CAPSULE_TAB_BAR_MAX_WIDTH = 520;
// Its gap from the screen's sides when the screen is narrower than that, as a
// phone is.
const SIDE_MARGIN = 16;
// The gap between the capsule and a floating card above it, such as the
// Bible's dock.
export const CAPSULE_STACK_GAP = 8;

/** How wide the capsule is in a window this wide. */
export const getCapsuleTabBarWidth = (windowWidth: number) =>
  Math.min(windowWidth - 2 * SIDE_MARGIN, CAPSULE_TAB_BAR_MAX_WIDTH);

/**
 * The capsule's gap from the bottom edge. Like iOS's own floating bar, it sits
 * partly within a Face ID iPhone's 34-point home indicator inset (20 points up),
 * and 12 points up where there's no inset.
 */
export const getCapsuleBottomGap = (bottomInset: number) =>
  Math.max(Math.round(bottomInset * 0.6), 12);

// How far above a floating bar the page starts to fade, so text scrolling
// under it fades out rather than meeting a line.
const FADE_HEIGHT = 32;

/** `color` at this opacity (0–1), for a six-digit hex colour. */
const withOpacity = (color: string, opacity: number) =>
  /^#[0-9a-f]{6}$/i.test(color)
    ? `${color}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`
    : color;

/**
 * The page's colour behind a floating bar, as iOS fades a page's edge under its
 * bars: clear at the top, 95% solid by FADE_HEIGHT down, so text that
 * scrolls under the bar stays out of the way of its buttons. It reaches
 * FADE_HEIGHT above the box it's placed in.
 */
export function ScrollEdgeFade({ background, style }: { background: string; style?: StyleProp<ViewStyle> }) {
  return (
    <View pointerEvents="none" style={[styles.fade, style]}>
      <LinearGradient
        colors={[withOpacity(background, 0), withOpacity(background, 0.95)]}
        style={styles.fadeGradient}
      />
      <View style={[styles.fadeSolid, { backgroundColor: withOpacity(background, 0.95) }]} />
    </View>
  );
}

/**
 * The tab bar on iPhone, iPad and the web (#589, #324): the four tabs sit in
 * a rounded capsule floating above the bottom edge, as iOS's own bar does, in
 * the app's warm card colour like its other cards and pills, with a lighter
 * pill behind the selected tab. Pages run to the bottom edge and scroll under
 * it (TabBarSpacer leaves room for their last lines). The icons and labels are
 * the app's own, so they follow its text size, which iOS's own bar wouldn't.
 */
export function CapsuleTabBar({
  bottomInset,
  fade = true,
  theme,
  windowWidth,
  ...props
}: TabBarProps & { bottomInset: number; fade?: boolean; theme: AppTheme; windowWidth: number }) {
  const tablet = windowWidth >= TABLET_TAB_BAR_MIN_WIDTH;
  return (
    <View style={[styles.outer, { paddingBottom: getCapsuleBottomGap(bottomInset) }]}>
      {fade && <ScrollEdgeFade background={theme.colors.background} />}
      <View
        style={[
          styles.capsule,
          {
            width: getCapsuleTabBarWidth(windowWidth),
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.outlineVariant,
          },
        ]}
      >
        {getTabItems(props).map((item) => (
          <Pressable
            key={item.key}
            accessibilityLabel={item.accessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.focused }}
            onLongPress={item.onLongPress}
            onPress={item.onPress}
            style={[styles.item, !tablet && styles.phoneItem, item.focused && { backgroundColor: getSelectedTabTint(theme) }]}
            testID={item.testID}
          >
            {item.icon(tablet ? 30 : 28)}
            {item.label}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

/** The shadow of the capsule, and of a floating card that goes with it. */
export const CAPSULE_SHADOW = Platform.select<ViewStyle>({
  ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 },
  default: { boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
});

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
  },
  fade: {
    position: 'absolute',
    top: -FADE_HEIGHT,
    bottom: 0,
    left: 0,
    right: 0,
  },
  fadeGradient: {
    height: FADE_HEIGHT,
  },
  fadeSolid: {
    flex: 1,
  },
  capsule: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    padding: 4,
    ...CAPSULE_SHADOW,
  },
  item: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    paddingVertical: 4,
  },
  phoneItem: {
    paddingVertical: 0,
  },
});
