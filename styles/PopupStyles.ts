import type { AppTheme } from '@/constants/Themes';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Keeps every Paper dialog/modal flush with the app canvas in both themes. */
export const getPopupSurfaceStyle = (theme: AppTheme) => ({
  backgroundColor: theme.colors.background,
});

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

export const usePopupMaxHeight = (fraction: number) => {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return getPopupMaxHeight(height, insets, fraction);
};
