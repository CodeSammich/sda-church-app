import { scaleTypographyMetric, type TextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { Platform, type StyleProp, StyleSheet, View, type ViewStyle } from 'react-native';
import { IconButton, Text } from 'react-native-paper';

type PopupHeaderProps = Readonly<{
  /**
   * Center the title, with an empty space opposite the X to balance it. On
   * iOS the title is always centred, as in a sheet's toolbar there.
   */
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
 * height. Tapping outside the popup, or swiping a sheet down, closes it too.
 *
 * The X sits where each platform puts a sheet's close button (#867):
 * - iOS and iPadOS: the leading (left) edge, with the title centred. Apple's
 *   Human Interface Guidelines, Sheets → Platform considerations → iOS,
 *   iPadOS (updated 2026-03-24): "for sheets with a single view, the Cancel
 *   button belongs on the leading edge of the top
 *   toolbar" (https://developer.apple.com/design/human-interface-guidelines/sheets).
 * - Android: the trailing (right) edge. A Material 3 bottom sheet has no
 *   close button: its anatomy is a container, an optional drag handle, and
 *   the scrim, and it closes by a tap on the scrim, a swipe down, or Back
 *   (Material Components' BottomSheet docs,
 *   https://github.com/material-components/material-components-android/blob/master/docs/components/BottomSheet.md).
 *   The app keeps an X anyway for older members, who don't all know those
 *   (the close rule in docs/UI_UX.md). It goes where Material 3's modal side
 *   sheet, the sheet with a title row, puts its close icon button: at the
 *   header's trailing end, opposite an optional back button (SideSheet docs'
 *   anatomy,
 *   https://github.com/material-components/material-components-android/blob/master/docs/components/SideSheet.md).
 * - The web keeps today's centred popups, with the X at the end.
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
  const leading = getPopupClosePlacement() === 'leading';
  const centeredTitle = centered || leading;
  const spacer = <View style={{ width: buttonSize }} />;
  const close = (
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
  );

  return (
    <View style={[styles.header, style]}>
      {leading ? close : centeredTitle && spacer}
      <Text
        accessibilityRole="header"
        variant={variant}
        style={[
          styles.title,
          centeredTitle && styles.centeredTitle,
          { color: theme.colors.onSurface },
        ]}
      >
        {title}
      </Text>
      {leading ? spacer : close}
    </View>
  );
}

/** Which edge of a popup's title row its X sits at, by platform (see PopupHeader). */
export const getPopupClosePlacement = (os: string = Platform.OS) =>
  os === 'ios' ? ('leading' as const) : ('trailing' as const);

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
