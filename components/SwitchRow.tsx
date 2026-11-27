import { MenuCardSwitchVisual } from '@/components/MenuCard';
import { useAppTheme } from '@/constants/Themes';
import {
  Platform,
  Pressable,
  type StyleProp,
  StyleSheet,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';

type SwitchRowProps = Readonly<{
  label: string;
  /** A line under the label about what the setting does, which a screen reader hears as the hint. */
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
  descriptionStyle?: StyleProp<TextStyle>;
}>;

/**
 * A setting that's on or off: its name, a line about it, and a switch, all
 * one control, so a tap on the words turns it on or off as a tap on the
 * switch does (#798). Older members tap the words, not the small switch. A
 * screen reader hears one switch, with its name and whether it's on. The
 * switch is MenuCard's, as on Offline Bible Audio's Download notifications row.
 */
export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  style,
  labelStyle,
  descriptionStyle,
}: SwitchRowProps) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={() => onValueChange(!value)}
      style={({ pressed }) => [
        styles.row,
        style,
        { opacity: pressed ? 0.78 : 1 },
        Platform.OS === 'web' ? styles.webPressable : null,
      ]}
    >
      <View style={styles.copy}>
        <Text style={[{ color: theme.colors.onSurface }, labelStyle]}>{label}</Text>
        {description ? (
          <Text style={[{ color: theme.colors.onSurfaceVariant }, descriptionStyle]}>
            {description}
          </Text>
        ) : null}
      </View>
      <MenuCardSwitchVisual
        active={value}
        activeColor={theme.colors.primary}
        inactiveColor={theme.colors.outline}
        thumbColor={theme.colors.onPrimary}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  copy: { flex: 1, minWidth: 0 },
  webPressable: { cursor: 'pointer' },
});
