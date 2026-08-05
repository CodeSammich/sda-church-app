import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { useMemo } from 'react';
import {
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

interface WrappingActionButtonProps {
  backgroundColor?: string;
  borderColor: string;
  disabled?: boolean;
  icon: MaterialCommunityIconName;
  label: string;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  textColor: string;
}

export const WrappingActionButton = ({
  backgroundColor = 'transparent',
  borderColor,
  disabled = false,
  icon,
  label,
  onPress,
  style,
  textColor,
}: WrappingActionButtonProps) => {
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(textScale, Math.max(1, fontScale * textScale)),
    [fontScale, textScale],
  );

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
        },
        !disabled && Platform.OS === 'web' ? styles.webPressable : null,
        style,
      ]}
    >
      <AppIcon
        color={textColor}
        name={icon}
        pointerEvents="none"
        size={22}
      />
      <Text pointerEvents="none" style={[styles.label, { color: textColor }]}>
        {label}
      </Text>
    </Pressable>
  );
};

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveTextScale: number,
) =>
  StyleSheet.create({
    button: {
      alignItems: 'center',
      borderRadius: 20,
      borderWidth: 1,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: Math.ceil(44 + Math.max(0, effectiveTextScale - 1) * 24),
      paddingHorizontal: 16,
      paddingVertical: 10,
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
