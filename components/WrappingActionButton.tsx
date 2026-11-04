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
export const labelWordsFit = (label: string, width: number, textScale: number) =>
  widestWordWidth(label, LABEL_FONT_SIZE * Math.max(1, textScale)) <= width - BUTTON_CHROME_WIDTH;

/**
 * About how wide the widest word of `text` is, in points, at `em` points a
 * letter's height: LETTER_EM a letter, or for Chinese, which can break between
 * any two characters, `cjkChars` em (one, unless a caller wants more on a line).
 */
export const widestWordWidth = (text: string, em: number, cjkChars = 1) =>
  CJK.test(text)
    ? Math.min(cjkChars, [...text].length) * em
    : Math.max(0, ...text.split(/\s+/u).map((word) => [...word].length)) * LETTER_EM * em;

// The Sabbath countdown's widest form, as in "6d 23:59:59", in its monospaced
// font (Courier on iOS, monospace on Android), whose every character is 0.6 em
// wide, at 16 points; its label, date, and place are 12 (labelMedium and
// bodySmall). The card has 16 points of padding on each side, on Home's
// 20-point page margins, and keeps at least 8 between the words and the timer.
const COUNTDOWN_CHARS = 11;
const COUNTDOWN_FONT_SIZE = 16;
const COUNTDOWN_TEXT_FONT_SIZE = 12;
const COUNTDOWN_CARD_INSET = 2 * 20 + 2 * 16;
const COUNTDOWN_GAP = 8;
// Chinese could break after every character, but a column one character wide
// isn't readable: it keeps room for four, as in 安息日還.
const COUNTDOWN_CJK_CHARS = 4;

/**
 * Whether the Sabbath countdown fits beside its label, date, and place on a
 * row `contentWidth` points wide (Home's content column), with text at
 * `textScale` (the app's size times the device's): whether every word of
 * `texts` still fits whole in the room the timer leaves. Only when one
 * doesn't does the timer go below them (#324). On a 375-point iPhone that's
 * above about 170% in Spanish, 180% in English, and 190% in Chinese; on a
 * 440-point one, above about 210% to 230%; in a 320-point iPad window, above
 * about 140%.
 */
export const countdownFitsBeside = (texts: string[], contentWidth: number, textScale: number) => {
  const scale = Math.max(1, textScale);
  const room =
    contentWidth - COUNTDOWN_CARD_INSET - COUNTDOWN_CHARS * 0.6 * COUNTDOWN_FONT_SIZE * scale - COUNTDOWN_GAP;
  return texts.every((text) => widestWordWidth(text, COUNTDOWN_TEXT_FONT_SIZE * scale, COUNTDOWN_CJK_CHARS) <= room);
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
