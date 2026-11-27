import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { CHINESE_CHARACTER } from '@/constants/LineBreaks';
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

// The label's and icon's sizes at 100% text, and what the button takes besides
// them: padding and border on both sides, and the gap after the icon. The icon
// grows with the app's text size, as AppIcon's do: at 150% it's 33 points, so
// counting it at 22 left a Chinese label 11 points short, and it broke (#797).
const LABEL_FONT_SIZE = 14;
const ICON_SIZE = 22;
const BUTTON_PADDING_WIDTH = 2 * 16 + 2 * 1 + 8;
// A letter of the bold label is at most about 0.55 em wide, measured on
// "Compartir", "Versículo", and "Share" in Plus Jakarta Sans Bold; 0.6 leaves a
// margin. A Chinese character is 1 em.
const LETTER_EM = 0.6;
// Two points spare, since a word exactly as wide as its line broke on Android,
// as with Home's cards' titles.
const SPARE = 2;

/**
 * Whether every word of `label` fits on one line of a WrappingActionButton
 * `width` points wide, with text at `textScale` (the app's size times the
 * device's) and its icon at `iconScale` (the app's size, which AppIcon
 * follows; the text's, if not given). Where a word doesn't, it would break
 * mid-word, as "Compartir" did at 125% on a 375-point iPhone, "Share" at 150%
 * in a 320-point iPad window (#324), and 分享經文 as 分享經 / 文 at 150% on an
 * Android phone (#797), so a caller can give the button a row of its own.
 */
export const labelWordsFit = (label: string, width: number, textScale: number, iconScale = textScale) =>
  widestWordWidth(label, LABEL_FONT_SIZE * Math.max(1, textScale)) + SPARE <=
  width - BUTTON_PADDING_WIDTH - ICON_SIZE * Math.max(1, iconScale);

// Chinese has no spaces between its words, so a label such as 分享經文 is one
// word: a line may break anywhere in it, and did, leaving 文 on a line of its
// own (#797). It counts whole, each character 1 em.
const wordEms = (word: string) =>
  [...word].reduce((ems, character) => ems + (CHINESE_CHARACTER.test(character) ? 1 : LETTER_EM), 0);

/**
 * About how wide the widest word of `text` is, in points, at `em` points a
 * letter's height: LETTER_EM a letter, and 1 em a Chinese character. A run of
 * Chinese between spaces counts as one word.
 */
export const widestWordWidth = (text: string, em: number) =>
  Math.max(0, ...text.split(/\s+/u).map(wordEms)) * em;

/**
 * Whether WrappingActionButtons with these labels fit side by side, sharing a
 * row `rowWidth` points wide with `gap` between them, without breaking a word.
 */
export const labelsFitSideBySide = (
  labels: string[],
  rowWidth: number,
  gap: number,
  textScale: number,
  iconScale = textScale,
) => {
  const width = (rowWidth - gap * (labels.length - 1)) / labels.length;
  return labels.every((label) => labelWordsFit(label, width, textScale, iconScale));
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
        size={ICON_SIZE}
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
