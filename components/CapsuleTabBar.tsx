import { getBarSurfaceColor, getSelectedTabTint, getTabItems, TABLET_TAB_BAR_MIN_WIDTH, type TabBarProps } from '@/components/TabBarItems';
import type { AppTheme } from '@/constants/Themes';
import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

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
 * The side gap at or below which a bar's halo runs edge to edge rather than
 * hugging it: a phone's, whose bars leave 16 points a side, or an iPad window
 * the bar nearly fills, such as Slide Over. Text scrolling past in a gap that
 * narrow only shows as fragments, so there the page shows above the bars but
 * not beside them; on a wider screen it shows beside them too (#681).
 */
export const HALO_FILLS_ROW_GAP = 24;
export const haloFillsRow = (sideGap: number) => sideGap <= HALO_FILLS_ROW_GAP;
// How far past the screen's sides an edge-to-edge halo reaches, so its blurred
// corners stay off the screen.
export const HALO_PAST_EDGE = 32;

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

/**
 * The tab bar on every system (#589, #324), one design on iPhone, iPad and
 * Android: the four tabs sit in a rounded capsule floating above the bottom
 * edge, as iOS's own bar does, raised a shade off the page with a hairline
 * and a soft shadow, with the selected tab in blue, or gold in the dark theme,
 * on its selection pill. Pages run to the bottom edge and scroll under it,
 * fading out in a soft halo (FloatingHalo): around it on a wide screen, so the
 * page shows beside it, and edge to edge on a phone (haloFillsRow, #681);
 * TabBarSpacer leaves room for their last lines. The Bible draws its card's halo around the capsule too, so
 * there the capsule has none of its own (halo false). The icons and labels are
 * the app's own, so they follow its text size, which the systems' own bars
 * wouldn't.
 */
export function CapsuleTabBar({
  bottomInset,
  halo = true,
  theme,
  windowWidth,
  ...props
}: TabBarProps & { bottomInset: number; halo?: boolean; theme: AppTheme; windowWidth: number }) {
  const tablet = windowWidth >= TABLET_TAB_BAR_MIN_WIDTH;
  return (
    <View style={[styles.outer, { paddingBottom: getCapsuleBottomGap(bottomInset) }]}>
      {halo && (
        <FloatingHalo
          background={theme.colors.background}
          style={
            haloFillsRow((windowWidth - getCapsuleTabBarWidth(windowWidth)) / 2)
              ? { top: 0, bottom: 0, left: -HALO_PAST_EDGE, right: -HALO_PAST_EDGE }
              : [
                  styles.capsuleHalo,
                  {
                    bottom: getCapsuleBottomGap(bottomInset),
                    left: (windowWidth - getCapsuleTabBarWidth(windowWidth)) / 2,
                    width: getCapsuleTabBarWidth(windowWidth),
                  },
                ]
          }
        />
      )}
      <View
        style={[
          styles.capsule,
          getFloatingSurfaceStyle(theme),
          { width: getCapsuleTabBarWidth(windowWidth) },
        ]}
      >
        {getTabItems(props).map((item) => (
          <Pressable
            key={item.key}
            accessibilityLabel={item.accessibilityLabel}
            accessibilityRole="tab"
            accessibilityState={{ selected: item.focused }}
            // Android's touch ripple, inside the tab's pill.
            android_ripple={{ color: getSelectedTabTint(theme) }}
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
  item: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
    // Keeps Android's ripple within the pill.
    overflow: 'hidden',
    paddingVertical: 4,
  },
  phoneItem: {
    paddingVertical: 0,
  },
});
