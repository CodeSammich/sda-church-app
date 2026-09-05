import {
  DEFAULT_TEXT_SCALE,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { getBottomTabContentHeight } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavigationStyleOptions = Readonly<{
  bottomInset?: number;
  fontScale?: number;
}>;

/**
 * Shared styles for Menu/Navigation-heavy screens.
 * Preference given to the layout logic defined in ExploreScreen.
 */
export const createNavigationStyles = (
  textScale: TextScale,
  options: NavigationStyleOptions = {},
) => {
  const bottomInset = Number.isFinite(options.bottomInset)
    ? Math.max(0, options.bottomInset ?? 0)
    : 0;
  const fontScale = Number.isFinite(options.fontScale)
    ? Math.max(1, options.fontScale ?? 1)
    : 1;

  return StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 20, // Preference: explore/index.tsx
    paddingBottom:
      getBottomTabContentHeight(fontScale * textScale) + bottomInset + 24,
  },
  heroHeader: {
    // Stretch against the ScrollView content width on native Android. A
    // percentage width can resolve against the padded content box and leave
    // a visible strip at the trailing edge.
    alignSelf: 'stretch',
    width: undefined,
    minHeight: 220,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroTitle: {
    fontWeight: 'bold',
    fontSize: scaleTypographyMetric(26, textScale),
    lineHeight: scaleTypographyMetric(34, textScale),
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subheader: {
    fontWeight: 'bold',
    fontSize: scaleTypographyMetric(16, textScale), // Preference: explore/index.tsx
    lineHeight: scaleTypographyMetric(22, textScale),
  },
  });
};

export const NavigationStyles = createNavigationStyles(DEFAULT_TEXT_SCALE);

export const useNavigationStyles = () => {
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return useMemo(
    () =>
      createNavigationStyles(textScale, {
        bottomInset: insets.bottom,
        fontScale,
      }),
    [fontScale, insets.bottom, textScale],
  );
};
