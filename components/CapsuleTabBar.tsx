import { getBarSurfaceColor, getSelectedTabTint, getTabItems, TABLET_TAB_BAR_MIN_WIDTH, type TabBarProps } from '@/components/TabBarItems';
import type { AppTheme } from '@/constants/Themes';
import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

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
 * The capsule's gap from the bottom edge, given the safe area's bottom inset.
 * On iOS, like iOS's own floating bar, it sits partly within a Face ID
 * iPhone's 34-point home indicator inset (20 points up), and 12 points up
 * where there's no inset. On Android it stays wholly above the gesture bar or
 * the three navigation buttons, 8 points clear of them, so taps never land on
 * the system's.
 */
export const getCapsuleBottomGap = (bottomInset: number, os: string = Platform.OS) =>
  os === 'android' ? Math.max(bottomInset + 8, 12) : Math.max(Math.round(bottomInset * 0.6), 12);

// The halo around a floating bar, a boxShadow in the page's colour: about
// three-quarters opaque at the bar's edge, half HALO_SPREAD points out, and
// gone about 25 points out (a blur of HALO_BLUR is a Gaussian of half that).
export const HALO_SPREAD = 6;
export const HALO_BLUR = 20;

/**
 * A soft halo of the page's colour around a floating bar's shape, drawn behind
 * it, so text scrolling under the bar fades out just around it rather than
 * across the whole row (#681). The caller places it, with the bar's corners.
 */
export function FloatingHalo({
  background,
  style,
}: {
  background: string;
  style?: Animated.WithAnimatedValue<StyleProp<ViewStyle>>;
}) {
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', backgroundColor: background, boxShadow: `0 0 ${HALO_BLUR}px ${HALO_SPREAD}px ${background}` },
        style,
      ]}
    />
  );
}

// How long the selection pill takes to slide to a newly pressed tab (#704).
export const TAB_SLIDE_MS = 250;
// How long the pill stays on a pressed tab, waiting for the router to switch
// to it, before it goes back to the tab still selected. A tab's first visit
// took about a second to draw on the Pixel 9a emulator.
export const TAB_PRESS_SETTLE_MS = 2000;

/**
 * Whether iOS's Reduce Motion or Android's Remove animations is on, kept in a
 * ref so a press reads it at once.
 */
function useReduceMotion() {
  const reduceMotion = useRef(false);
  useEffect(() => {
    let live = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((on) => {
        if (live) reduceMotion.current = on;
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      reduceMotion.current = on;
    });
    return () => {
      live = false;
      subscription.remove();
    };
  }, []);
  return reduceMotion;
}

type TabSpan = { x: number; width: number };

/**
 * The selected tab's pill, drawn once behind the tabs, which slides to a tab
 * the moment it's pressed (#704), on the native driver, so it moves smoothly
 * even while the JavaScript draws the tab's page. Before #704 each tab drew
 * its own pill, and Android's touch ripple flashed a square behind the
 * pressed tab, since it ignored the pill's rounded corners. With Reduce
 * Motion or Remove animations on, the pill moves at once. Where no visible
 * tab is selected, as on Home's own pages, there's no pill, and it appears at
 * the next selected tab without sliding.
 */
function useSelectionPill(selectedKey: string | undefined) {
  const x = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  // Each tab's place in the row, as measured.
  const spans = useRef(new Map<string, TabSpan>()).current;
  // The tab the pill is on or sliding to.
  const pillKey = useRef<string | undefined>(undefined);
  // A pressed tab the router hasn't switched to yet.
  const pressedKey = useRef<string | undefined>(undefined);
  const settleTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const latestSelectedKey = useRef(selectedKey);
  latestSelectedKey.current = selectedKey;
  // The pill's width, unknown until the tabs are measured; until then the
  // selected tab draws the pill itself.
  const [width, setWidth] = useState<number>();
  const [measured, setMeasured] = useState(0);
  const reduceMotion = useReduceMotion();

  const moveTo = (key: string | undefined) => {
    const span = key === undefined ? undefined : spans.get(key);
    if (!span) {
      opacity.setValue(0);
      pillKey.current = undefined;
      return;
    }
    setWidth(span.width);
    if (pillKey.current === key) return;
    if (pillKey.current === undefined || reduceMotion.current) x.setValue(span.x);
    else {
      Animated.timing(x, {
        toValue: span.x,
        duration: TAB_SLIDE_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
    opacity.setValue(1);
    pillKey.current = key;
  };

  useEffect(() => {
    if (pressedKey.current !== undefined) {
      // On its way to the pressed tab: don't slide back to the tab the
      // router is leaving.
      if (selectedKey !== pressedKey.current) return;
      pressedKey.current = undefined;
      clearTimeout(settleTimer.current);
    }
    moveTo(selectedKey);
  }, [selectedKey, measured]);

  useEffect(() => () => clearTimeout(settleTimer.current), []);

  return {
    opacity,
    width,
    x,
    onPress: (key: string) => {
      pressedKey.current = key;
      moveTo(key);
      clearTimeout(settleTimer.current);
      settleTimer.current = setTimeout(() => {
        pressedKey.current = undefined;
        moveTo(latestSelectedKey.current);
      }, TAB_PRESS_SETTLE_MS);
    },
    onTabLayout: (key: string) => (event: LayoutChangeEvent) => {
      const { x: spanX, width: spanWidth } = event.nativeEvent.layout;
      const old = spans.get(key);
      if (old?.x === spanX && old.width === spanWidth) return;
      spans.set(key, { x: spanX, width: spanWidth });
      // A new text size or window width: the pill keeps to its tab at once.
      if (pillKey.current === key) {
        x.setValue(spanX);
        setWidth(spanWidth);
      }
      setMeasured((count) => count + 1);
    },
  };
}

/**
 * The tab bar on every system (#589, #324), one design on iPhone, iPad and
 * Android: the four tabs sit in a rounded capsule floating above the bottom
 * edge, as iOS's own bar does, raised a shade off the page with a hairline
 * and a soft shadow, with the selected tab in blue, or gold in the dark theme,
 * on its selection pill, which slides to a tab as it's pressed. Pages run to
 * the bottom edge and scroll under it, fading out only in a soft halo around
 * it (FloatingHalo), so the page shows beside it and below it on every
 * screen, phones included, and it floats over the page (#681); TabBarSpacer
 * leaves room for their last lines. The Bible draws its card's halo around
 * the capsule too, so there the capsule has none of its own (halo false). The
 * icons and labels are the app's own, so they follow its text size, which the
 * systems' own bars wouldn't.
 */
export function CapsuleTabBar({
  bottomInset,
  halo = true,
  theme,
  windowWidth,
  ...props
}: TabBarProps & { bottomInset: number; halo?: boolean; theme: AppTheme; windowWidth: number }) {
  const tablet = windowWidth >= TABLET_TAB_BAR_MIN_WIDTH;
  const items = getTabItems(props);
  const pill = useSelectionPill(items.find((item) => item.focused)?.key);
  return (
    <View style={[styles.outer, { paddingBottom: getCapsuleBottomGap(bottomInset) }]}>
      {halo && (
        <FloatingHalo
          background={theme.colors.background}
          style={[
            styles.capsuleHalo,
            {
              bottom: getCapsuleBottomGap(bottomInset),
              left: (windowWidth - getCapsuleTabBarWidth(windowWidth)) / 2,
              width: getCapsuleTabBarWidth(windowWidth),
            },
          ]}
        />
      )}
      <View
        style={[
          styles.capsule,
          getFloatingSurfaceStyle(theme),
          { width: getCapsuleTabBarWidth(windowWidth) },
        ]}
      >
        <View style={styles.tabs}>
          <Animated.View
            pointerEvents="none"
            style={[
              styles.pill,
              {
                backgroundColor: getSelectedTabTint(theme),
                opacity: pill.opacity,
                transform: [{ translateX: pill.x }],
                width: pill.width ?? 0,
              },
            ]}
            testID="tab-selection-pill"
          />
          {items.map((item) => (
            // No android_ripple: it flashed a square behind the tab (#704).
            // The pill sliding to the tab is the press's feedback.
            <Pressable
              key={item.key}
              accessibilityLabel={item.accessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={{ selected: item.focused }}
              onLayout={pill.onTabLayout(item.key)}
              onLongPress={item.onLongPress}
              onPress={() => {
                if (!item.focused) pill.onPress(item.key);
                item.onPress();
              }}
              style={[
                styles.item,
                !tablet && styles.phoneItem,
                item.focused && pill.width === undefined && { backgroundColor: getSelectedTabTint(theme) },
              ]}
              testID={item.testID}
            >
              {item.icon(tablet ? 30 : 28)}
              {item.label}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

/** The soft shadow of everything that floats over a page. */
const CAPSULE_SHADOW = Platform.select<ViewStyle>({
  ios: { shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 14, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 3 },
  default: { boxShadow: '0 4px 14px rgba(0,0,0,0.1)' },
});

/**
 * The surface of everything that floats over a page: the capsule, the Bible's
 * card, and the header's pills and round buttons, so a page's top matches its
 * bottom. White, or the brand's night blue in the dark theme, with a faint
 * hairline and a soft shadow.
 */
export const getFloatingSurfaceStyle = (theme: AppTheme): ViewStyle => ({
  backgroundColor: getBarSurfaceColor(theme),
  borderColor: theme.colors.outlineVariant,
  borderWidth: StyleSheet.hairlineWidth,
  ...CAPSULE_SHADOW,
});

const styles = StyleSheet.create({
  outer: {
    alignItems: 'center',
  },
  capsuleHalo: {
    borderRadius: 999,
    top: 0,
  },
  capsule: {
    borderRadius: 999,
    flexDirection: 'row',
    padding: 4,
  },
  // The tabs' row, which the pill's place is measured in.
  tabs: {
    flex: 1,
    flexDirection: 'row',
  },
  // As tall as the tabs, at the left, moved to its tab by translateX.
  pill: {
    borderRadius: 999,
    bottom: 0,
    left: 0,
    position: 'absolute',
    top: 0,
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
