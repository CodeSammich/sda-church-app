import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { type ReactNode, useMemo } from 'react';
import {
  type AccessibilityRole,
  type AccessibilityState,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

interface WrappingButtonProps {
  accessibilityLabel?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  buttonColor?: string;
  children: ReactNode;
  compact?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  icon?: MaterialCommunityIconName;
  labelStyle?: StyleProp<TextStyle>;
  mode?: 'contained' | 'contained-tonal' | 'outlined' | 'text';
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}

export const WrappingButton = ({
  accessibilityLabel,
  accessibilityRole = 'button',
  accessibilityState,
  buttonColor,
  children,
  compact = false,
  contentStyle,
  disabled = false,
  icon,
  labelStyle,
  mode = 'text',
  onPress,
  style,
  textColor,
}: WrappingButtonProps) => {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(textScale, Math.max(1, fontScale * textScale), compact),
    [compact, fontScale, textScale],
  );
  const contained = mode === 'contained';
  const tonal = mode === 'contained-tonal';
  const outlined = mode === 'outlined';
  const resolvedBackground =
    buttonColor ??
    (contained
      ? theme.colors.primary
      : tonal
        ? theme.colors.secondaryContainer
        : 'transparent');
  const resolvedTextColor =
    textColor ??
    (contained
      ? theme.colors.onPrimary
      : tonal
        ? theme.colors.onSecondaryContainer
        : theme.colors.primary);
  const resolvedBorderColor = outlined
    ? theme.colors.outline
    : resolvedBackground;
  const spokenLabel =
    accessibilityLabel ?? (typeof children === 'string' ? children : undefined);
  const isDisabled = disabled || !onPress;

  return (
    <Pressable
      accessibilityLabel={spokenLabel}
      accessibilityRole={accessibilityRole}
      accessibilityState={{ ...accessibilityState, disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: resolvedBackground,
          borderColor: resolvedBorderColor,
          borderWidth: outlined ? 1 : 0,
          opacity: isDisabled ? 0.5 : pressed ? 0.75 : 1,
        },
        !isDisabled && Platform.OS === 'web' ? styles.webPressable : null,
        style,
        contentStyle,
      ]}
    >
      {icon ? (
        <AppIcon
          color={resolvedTextColor}
          name={icon}
          pointerEvents="none"
          size={20}
        />
      ) : null}
      <Text
        pointerEvents="none"
        style={[styles.label, { color: resolvedTextColor }, labelStyle]}
      >
        {children}
      </Text>
    </Pressable>
  );
};

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveTextScale: number,
  compact: boolean,
) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      borderRadius: 20,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: Math.ceil(44 + Math.max(0, effectiveTextScale - 1) * 20),
      paddingHorizontal: compact ? 10 : 16,
      paddingVertical: compact ? 6 : 10,
    },
    label: {
      flexShrink: 1,
      fontSize: scaleTypographyMetric(14, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(20, textScale),
      textAlign: 'center',
    },
    webPressable: {
      cursor: 'pointer',
    },
  });
