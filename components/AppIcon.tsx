import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import {
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';

export type MaterialCommunityIconName = ComponentProps<
  typeof MaterialCommunityIcons
>['name'];
export type IoniconName = ComponentProps<typeof Ionicons>['name'];

type SharedIconProps = Pick<
  ComponentProps<typeof MaterialCommunityIcons>,
  'accessibilityLabel' | 'color' | 'pointerEvents' | 'style' | 'testID'
> & {
  scaleWithText?: boolean;
  size?: number;
  textScale?: TextScale;
};

export type AppIconProps = SharedIconProps &
  (
    | {
        family?: 'material-community';
        name: MaterialCommunityIconName;
      }
    | {
        family: 'ionicons';
        name: IoniconName;
      }
  );

/**
 * The app-wide icon boundary. Most icons use Material Community shorthand;
 * other Expo-native icon families can be added here without coupling screens
 * and reusable components to a particular icon package.
 */
export function AppIcon({
  family,
  name,
  scaleWithText = true,
  size,
  textScale: textScaleOverride,
  ...props
}: AppIconProps) {
  const { textScale } = useTextSize();
  const resolvedSize =
    typeof size === 'number' && scaleWithText
      ? scaleTypographyMetric(size, textScaleOverride ?? textScale)
      : size;

  if (family === 'ionicons') {
    return <Ionicons name={name} size={resolvedSize} {...props} />;
  }

  return <MaterialCommunityIcons name={name} size={resolvedSize} {...props} />;
}
