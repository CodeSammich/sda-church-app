import { layoutTrial } from '@/constants/LayoutTrial'; // TRIAL-ONLY (#324)
import type { AppTheme } from '@/constants/Themes';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Every popup's surface: the app canvas in both themes, and the corners Paper's
 * Material 3 Dialog gives itself (7 × the theme's roundness), so the Bible
 * screen's popups, the first-launch setup, and the install prompt, which are
 * Paper Modals, have the same shape as the You tab's dialogs.
 */
export const getPopupSurfaceStyle = (theme: AppTheme) => ({
  backgroundColor: theme.colors.background,
  borderRadius: 7 * theme.roundness,
});

/**
 * The widest a popup grows, on a tablet or other wide screen (#324). On a phone
 * it's 90% of the screen's width, or its margins decide.
 */
export const POPUP_MAX_WIDTH = 560;

/**
 * A popup's width: its width on a phone, up to `maxWidth`, centered.
 *
 * Give a Paper Modal or Dialog this number, not a percentage `width` with a
 * `maxWidth`. On iOS, Paper's Surface puts the width on an outer view and the
 * `maxWidth` on an inner one, so on an iPad the popup filled 90% of the screen
 * with its content in only part of it (#324), as with `maxHeight` below.
 */
export const getPopupWidthStyle = (phoneWidth: number, maxWidth = POPUP_MAX_WIDTH) =>
  // TRIAL-ONLY (#324): the percentage width that filled 90% of the iPad.
  layoutTrial.broken
    ? ({ alignSelf: 'center' as const, width: '90%', maxWidth } as unknown as { alignSelf: 'center'; width: number })
    : {
        alignSelf: 'center' as const,
        width: Math.max(0, Math.round(Math.min(phoneWidth, maxWidth))),
      };

/** A dialog's width: 90% of the screen, up to `maxWidth`. */
export const usePopupWidthStyle = (maxWidth = POPUP_MAX_WIDTH) => {
  const { width } = useWindowDimensions();
  return getPopupWidthStyle(width * 0.9, maxWidth);
};

/**
 * How tall a popup may grow, as a fraction of the space between the safe
 * areas, at any text size: past it, the popup's content scrolls. It leaves
 * room around every popup for a thumb to tap outside and close it. On a
 * Pixel 9a, it's about the Text size dialog's height at the default 125% text,
 * plus 10%.
 */
export const POPUP_MAX_HEIGHT_FRACTION = 0.65;

/**
 * A popup's height limit in points: `fraction` of the space between the safe
 * areas, which is where Paper's Modal places its content.
 *
 * Don't give a Paper Modal or Dialog a percentage `maxHeight`. On iOS, Paper's
 * Surface puts margins on an outer view and `maxHeight` on an inner one, so a
 * percentage is measured against the popup itself instead of the screen, and
 * the popup isn't held to the screen: content spills past it and the list in a
 * short landscape dialog gets clipped. Android uses a single view, so a
 * percentage happened to work there.
 */
export const getPopupMaxHeight = (
  windowHeight: number,
  insets: { top: number; bottom: number },
  fraction: number,
) => Math.max(0, Math.floor((windowHeight - insets.top - insets.bottom) * fraction));

export const usePopupMaxHeight = (fraction = POPUP_MAX_HEIGHT_FRACTION) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return getPopupMaxHeight(height, insets, fraction);
};
