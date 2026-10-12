import { scaleTypographyMetric, type TextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

type PopupHeaderProps = Readonly<{
  /** Center the title, with an empty space opposite the X to balance it. */
  centered?: boolean;
  closeLabel: string;
  onClose: () => void;
  style?: StyleProp<ViewStyle>;
  /** The X's text scale, where it differs from the app's text size. */
  textScale?: TextScale;
  title: string;
  variant?: 'headlineSmall' | 'titleLarge';
}>;

/**
 * A popup's title row, with an X that closes it. Every popup that doesn't ask
 * a question closes with this X, not a Close button, so closing costs no extra
 * height. Tapping outside the popup closes it too.
 */
export function PopupHeader({
  centered = false,
  closeLabel,
  onClose,
  style,
  textScale,
  title,
  variant = 'titleLarge',
}: PopupHeaderProps) {
  const theme = useAppTheme();
  const { textScale: appTextScale } = useTextSize();
  const iconSize = scaleTypographyMetric(24, textScale ?? appTextScale);
  // Paper pads the icon by 8 on each side; never under a 48-point target.
  const buttonSize = Math.max(48, iconSize + 16);

  return (
    <View style={[styles.header, style]}>
      {centered && <View style={{ width: buttonSize }} />}
      <Text
        variant={variant}
        style={[
          styles.title,
          centered && styles.centeredTitle,
          { color: theme.colors.onSurface },
        ]}
      >
        {title}
      </Text>
      <IconButton
        icon="close"
        size={iconSize}
        onPress={onClose}
        accessibilityLabel={closeLabel}
        style={[
          styles.close,
          { borderRadius: buttonSize / 2, height: buttonSize, width: buttonSize },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  centeredTitle: {
    textAlign: 'center',
  },
  close: {
    margin: 0,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  title: {
    flex: 1,
  },
});
