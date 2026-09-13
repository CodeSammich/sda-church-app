import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { Image } from 'react-native';

interface ExternalBrandIconProps {
  source: ImageSourcePropType;
  darkSource?: ImageSourcePropType;
  size: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Renders an unmodified provider asset at the same scaled dimensions used by
 * AppIcon. The containing control supplies the accessible name and click target.
 */
export function ExternalBrandIcon({
  source,
  darkSource,
  size,
  style,
}: ExternalBrandIconProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const resolvedSize = scaleTypographyMetric(size, textScale);

  return (
    <Image
      accessible={false}
      pointerEvents="none"
      resizeMode="contain"
      source={theme.dark && darkSource ? darkSource : source}
      style={[{ width: resolvedSize, height: resolvedSize }, style]}
    />
  );
}
