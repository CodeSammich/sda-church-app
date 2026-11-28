import { ContrastChoice, getContrastCopy } from '@/components/ContrastChoice';
import { AppSheet } from '@/components/AppSheet';
import { PopupScrollView } from '@/components/PopupScrollView';
import { LanguageContext } from '@/constants/LanguageContext';
import { ThemeContext, useAppTheme, type ThemeKind } from '@/constants/Themes';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

const KINDS: readonly ThemeKind[] = ['light', 'dark'];

/**
 * You → Contrast (#669): high contrast, the default, or standard, for light
 * mode and for dark mode, chosen by pictures of the tab bar in each. Two
 * choices, so it stays open until its X closes it.
 */
export function ContrastDialog({ onDismiss, visible }: Readonly<{ onDismiss: () => void; visible: boolean }>) {
  const { language } = useContext(LanguageContext);
  const { contrastModes, setContrastMode } = useContext(ThemeContext);
  const theme = useAppTheme();
  const copy = getContrastCopy(language);

  return (
    <AppSheet
      visible={visible}
      onDismiss={onDismiss}
      closeLabel={copy.close}
      title={copy.title}
      // A choice made by comparing the pictures: full height (#867).
      height="large"
    >
      <PopupScrollView contentContainerStyle={styles.scrollContent}>
        <Text variant="bodyMedium" style={[styles.help, { color: theme.colors.onSurfaceVariant }]}>
          {copy.help}
        </Text>
        {KINDS.map((kind) => (
          <View key={kind} style={styles.section}>
            <Text accessibilityRole="header" variant="titleMedium" style={{ color: theme.colors.onSurface }}>
              {copy.sections[kind]}
            </Text>
            <ContrastChoice
              kind={kind}
              language={language}
              onChoose={(mode) => void setContrastMode(kind, mode)}
              // The theme showing now: its choice shows when the sheet opens (#867).
              reveal={kind === (theme.dark ? 'dark' : 'light')}
              value={contrastModes[kind]}
            />
          </View>
        ))}
      </PopupScrollView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  help: {
    marginBottom: 8,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  section: {
    gap: 10,
    marginTop: 12,
  },
});
