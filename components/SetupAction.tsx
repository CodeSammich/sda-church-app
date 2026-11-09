import { useAppTheme } from '@/constants/Themes';
import { Pressable, StyleSheet } from 'react-native';
import { Text } from 'react-native-paper';

/**
 * Setup's buttons (#523, #681): Back outlined, Next filled, each as tall as a
 * thumb. A choice is only chosen by tapping it; these are the way on. First-
 * launch setup and the contrast question after an update (#708) share them,
 * so both go on the same way.
 */
export interface SetupActionProps {
  accessibilityLabel?: string;
  disabled?: boolean;
  kind?: 'contained' | 'outlined';
  label: string;
  onPress: () => void;
  /** stretch: the popup's width; fill: a share of a row of buttons. */
  placement?: 'start' | 'stretch' | 'fill';
}

export const SetupAction = ({
  accessibilityLabel,
  disabled = false,
  kind = 'contained',
  label,
  onPress,
  placement = 'stretch',
}: SetupActionProps) => {
  const theme = useAppTheme();
  const contained = kind === 'contained';

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        placement === 'start' && styles.actionButtonAtStart,
        placement === 'fill' && styles.actionButtonFill,
        {
          backgroundColor: contained ? theme.colors.primary : 'transparent',
          borderColor: contained ? theme.colors.primary : theme.colors.outline,
          opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.actionButtonText,
          {
            color: contained
              ? theme.colors.onPrimary
              : theme.colors.primary,
          },
        ]}
        variant="labelLarge"
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  actionButton: {
    alignItems: 'center',
    alignSelf: 'stretch',
    borderRadius: 26,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  actionButtonAtStart: {
    alignSelf: 'flex-start',
  },
  actionButtonFill: {
    flex: 1,
    marginTop: 0,
  },
  actionButtonText: {
    flexShrink: 1,
    fontWeight: '700',
    textAlign: 'center',
  },
});
