import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import type { ImageSourcePropType, StyleProp, ViewStyle } from 'react-native';
import { Image, View } from 'react-native';

interface ExternalBrandIconProps {
  source: ImageSourcePropType;
  darkSource?: ImageSourcePropType;
  size: number;
  /** Scales the source before clipping transparent margins at render time. */
  contentScale?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Renders an unmodified provider asset at the same scaled dimensions used by
 * AppIcon. The containing control supplies the accessible name and click target.
 */
export function ExternalBrandIcon({
  source,
  darkSource,
  size,
  contentScale = 1,
  style,
}: ExternalBrandIconProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const resolvedSize = scaleTypographyMetric(size, textScale);
  const safeContentScale =
    Number.isFinite(contentScale) && contentScale > 0 ? contentScale : 1;
  const imageSize = resolvedSize * safeContentScale;
  const image = (
    <Image
      accessible={false}
      pointerEvents="none"
      resizeMode="contain"
      source={theme.dark && darkSource ? darkSource : source}
      style={{ width: imageSize, height: imageSize }}
    />
  );

  if (safeContentScale === 1) {
    return (
      <View style={[{ width: resolvedSize, height: resolvedSize }, style]}>
        {image}
      </View>
    );
  }

  return (
    <View
      pointerEvents="none"
      style={[
        {
          alignItems: 'center',
          height: resolvedSize,
          justifyContent: 'center',
          overflow: 'hidden',
          width: resolvedSize,
        },
        style,
      ]}
    >
      {image}
    </View>
  );
}
