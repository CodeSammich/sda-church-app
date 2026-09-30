import type { ReactNode } from 'react';
import {
  Image,
  StyleSheet,
  View,
  type ImageProps,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

interface ImageBackgroundProps {
  source: ImageSourcePropType;
  style?: StyleProp<ViewStyle>;
  resizeMode?: ImageProps['resizeMode'];
  onLayout?: (event: LayoutChangeEvent) => void;
  children?: ReactNode;
}

/**
 * A view with an image behind its children. React Native 0.88 deprecated its
 * own ImageBackground and recommends this instead: a View with an absolutely
 * positioned Image. The image fills the view, padding included, and the view's
 * `overflow: 'hidden'` clips it to rounded corners.
 */
export function ImageBackground({
  source,
  style,
  resizeMode = 'cover',
  onLayout,
  children,
}: ImageBackgroundProps) {
  return (
    <View accessibilityIgnoresInvertColors style={style} onLayout={onLayout}>
      <Image source={source} resizeMode={resizeMode} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}
