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
 *
 * Image gives a bundled image its file's size ahead of the style passed in.
 * Clearing width and height, as React Native's own version did, lets the four
 * edges size it instead. A percentage wouldn't do: on an absolutely positioned
 * view it leaves out the parent's padding, which the heroes have plenty of.
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
      <Image source={source} resizeMode={resizeMode} style={styles.image} />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    width: undefined,
    height: undefined,
  },
});
