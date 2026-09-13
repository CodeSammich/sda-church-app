import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import type { ImageSourcePropType, ImageStyle, StyleProp } from 'react-native';
import { Image } from 'react-native';

interface ExternalBrandIconProps {
  source: ImageSourcePropType;
  size: number;
  style?: StyleProp<ImageStyle>;
}

/**
 * Renders an unmodified provider asset at the same scaled dimensions used by
 * AppIcon. The containing control supplies the accessible name and click target.
 */
export function ExternalBrandIcon({ source, size, style }: ExternalBrandIconProps) {
  const { textScale } = useTextSize();
  const resolvedSize = scaleTypographyMetric(size, textScale);

  return (
    <Image
      accessible={false}
      pointerEvents="none"
      resizeMode="contain"
      source={source}
      style={[{ width: resolvedSize, height: resolvedSize }, style]}
    />
  );
}
