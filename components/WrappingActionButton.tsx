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

// The label's size at 100% text, and what the button takes besides its label:
// padding and border on both sides, the icon, and the gap after it.
const LABEL_FONT_SIZE = 14;
const BUTTON_CHROME_WIDTH = 2 * 16 + 2 * 1 + 22 + 8;
// A letter of the bold label is at most about 0.55 em wide, measured on
// "Compartir", "Versículo", and "Share" in Plus Jakarta Sans Bold; 0.6 leaves a
// margin. Chinese can break between any two characters, so it counts one.
const LETTER_EM = 0.6;
const CJK = /[\u3400-\u9fff\uf900-\ufaff]/u;

/**
 * Whether every word of `label` fits on one line of a WrappingActionButton
 * `width` points wide, with text at `textScale` (the app's size times the
 * device's). Where a word doesn't, it would break mid-word, as "Compartir" did
 * at 125% on a 375-point iPhone and "Share" at 150% in a 320-point iPad window
 * (#324), so a caller can give the button a row of its own.
 */
export const labelWordsFit = (label: string, width: number, textScale: number) => {
  const em = LABEL_FONT_SIZE * Math.max(1, textScale);
  const longest = CJK.test(label)
    ? em
    : Math.max(0, ...label.split(/\s+/u).map((word) => [...word].length)) * LETTER_EM * em;
  return longest <= width - BUTTON_CHROME_WIDTH;
};

/**
 * Whether WrappingActionButtons with these labels fit side by side, sharing a
 * row `rowWidth` points wide with `gap` between them, without breaking a word.
 */
export const labelsFitSideBySide = (
  labels: string[],
  rowWidth: number,
  gap: number,
  textScale: number,
) => {
  const width = (rowWidth - gap * (labels.length - 1)) / labels.length;
  return labels.every((label) => labelWordsFit(label, width, textScale));
};

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
      fontSize: scaleTypographyMetric(LABEL_FONT_SIZE, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(20, textScale),
      textAlign: 'center',
    },
    webPressable: {
      cursor: 'pointer',
    },
  });
