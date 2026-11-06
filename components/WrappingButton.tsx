import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { type ReactNode, useMemo, useState } from 'react';
import {
  type AccessibilityRole,
  type AccessibilityState,
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type TextLayoutEvent,
  type TextStyle,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';

/**
 * A label split into two even lines, for a label that wrapped with its second
 * line less than half as long as its first (#681): 發送電子郵件 wrapped as five
 * characters and one on a Pixel 9a. Text with spaces splits at the space
 * nearest its middle; Chinese, whose characters are all one width, at its
 * middle character, without starting the second line with punctuation.
 */
export const balanceLabel = (label: string) => {
  const middle = label.length / 2;
  const spaces = [...label.matchAll(/ /g)].map((match) => match.index ?? 0);
  if (spaces.length) {
    const at = spaces.reduce((best, index) => (Math.abs(index - middle) < Math.abs(best - middle) ? index : best));
    return `${label.slice(0, at)}\n${label.slice(at + 1)}`;
  }
  let at = Math.ceil(middle);
  while (at < label.length - 1 && /[、，。：；！？）」』]/.test(label[at])) at += 1;
  return `${label.slice(0, at)}\n${label.slice(at)}`;
};

/** Whether a label's two lines are uneven enough to balance: the second less than half the first. */
export const isUnevenWrap = (lines: readonly { text: string }[]) =>
  lines.length === 2 && lines[1].text.trim().length * 2 < lines[0].text.trim().length;

interface WrappingButtonProps {
  accessibilityHint?: string;
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
  accessibilityHint,
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
  const { fontScale, width: windowWidth } = useWindowDimensions();
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
  // A label that wrapped unevenly, split in two even lines, for this window
  // width and text size. Turning the phone or changing the size measures it
  // afresh, as it may fit on one line then. Not the button's own width: a
  // button as wide as its label narrows once the label is balanced.
  const [balanced, setBalanced] = useState<{ key: string; text: string } | null>(null);
  const label = typeof children === 'string' ? children : null;
  const key = `${label}|${windowWidth}|${textScale}|${fontScale}`;
  const shownLabel = balanced && balanced.key === key ? balanced.text : children;
  const onTextLayout = (event: TextLayoutEvent) => {
    if (label && shownLabel === label && isUnevenWrap(event.nativeEvent.lines)) {
      setBalanced({ key, text: balanceLabel(label) });
    }
  };

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
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
        onTextLayout={label ? onTextLayout : undefined}
        pointerEvents="none"
        style={[styles.label, { color: resolvedTextColor }, labelStyle]}
        // Android balances a wrapped label's lines itself.
        textBreakStrategy="balanced"
      >
        {shownLabel}
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
