import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { getFloatingSurfaceStyle } from '@/components/CapsuleTabBar';
import { scaleTypographyMetric, TEXT_SCALE_MIN } from '@/constants/AppPreferences';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  getAppTheme,
  THEME_DARK,
  THEME_LIGHT,
  THEME_SUNSET,
  THEME_SYSTEM,
  useAppTheme,
  type ContrastMode,
  type ThemeKind,
  type ThemeMode,
} from '@/constants/Themes';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { RadioButton, Text } from 'react-native-paper';

/**
 * The language and theme choices as pictures (#681), in first-launch setup and
 * in You → Language and You → Theme, as the contrast choice has been (#669):
 * members choose by what each looks like, one card above another, not by a
 * word alone.
 */

// The tab bar's labels in each language, as app/(tabs)/_layout.tsx has them.
const TAB_LABELS: Record<SupportedLanguage, readonly string[]> = {
  en: ['Home', 'Bible', 'Explore', 'You'],
  zh: ['首頁', '聖經', '探索', '您'],
  'zh-cn': ['首页', '圣经', '探索', '您'],
  es: ['Inicio', 'Biblia', 'Explorar', 'Tú'],
};
const PREVIEW_TABS: readonly MaterialCommunityIconName[] = ['home', 'cross', 'compass-outline', 'account-circle-outline'];

/** Which themes each theme setting's picture shows: both, side by side, for the two that switch. */
export const THEME_PREVIEW_KINDS: Record<ThemeMode, readonly ThemeKind[]> = {
  [THEME_SYSTEM]: ['light', 'dark'],
  [THEME_SUNSET]: ['light', 'dark'],
  [THEME_LIGHT]: ['light'],
  [THEME_DARK]: ['dark'],
};

/** Each theme setting's icon. */
export const THEME_ICONS: Record<ThemeMode, MaterialCommunityIconName> = {
  [THEME_SYSTEM]: 'monitor-cellphone',
  [THEME_SUNSET]: 'weather-sunset-down',
  [THEME_LIGHT]: 'weather-sunny',
  [THEME_DARK]: 'weather-night',
};

/**
 * A choice drawn as a card: a picture of what it does, then its label, with
 * an icon and a description if it has them, and its radio button. Pressing it
 * chooses it.
 */
export function ChoiceCard({
  accessibilityLabel,
  children,
  description,
  disabled = false,
  icon,
  label,
  onPress,
  selected,
  style,
  testID,
}: Readonly<{
  accessibilityLabel?: string;
  children: ReactNode;
  description?: string;
  disabled?: boolean;
  icon?: MaterialCommunityIconName;
  label: string;
  onPress: () => void;
  selected: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}>) {
  const theme = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
          borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
          opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
        },
        style,
      ]}
    >
      {children}
      <View style={styles.cardRow}>
        {icon && <AppIcon color={theme.colors.onSurface} name={icon} size={20} />}
        <View style={styles.cardText}>
          <Text numberOfLines={2} style={[styles.cardLabel, { color: theme.colors.onSurface }]} variant="titleMedium">
            {/* A break after a slash, so "Sunrise/Sunset" wraps between its words. */}
            {label.replace(/\//g, '/​')}
          </Text>
          {description ? (
            <Text style={{ color: theme.colors.onSurfaceVariant }} variant="bodySmall">
              {description}
            </Text>
          ) : null}
        </View>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
          <RadioButton.Android
            value={label}
            status={selected ? 'checked' : 'unchecked'}
            color={theme.colors.primary}
            uncheckedColor={theme.colors.onSurfaceVariant}
          />
        </View>
      </View>
    </Pressable>
  );
}

/** A picture of the tab bar in one language, in the current theme. */
export function TabBarPreview({ language }: Readonly<{ language: SupportedLanguage }>) {
  const theme = useAppTheme();
  const selected = theme.dark ? theme.colors.metallicGold.main : theme.colors.primary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.preview, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.previewBar, getFloatingSurfaceStyle(theme)]}>
        {PREVIEW_TABS.map((icon, index) => (
          <View
            key={icon}
            style={[styles.previewTab, index === 1 && { backgroundColor: theme.colors.floatingSelected }]}
          >
            <AppIcon name={icon} size={20} color={index === 1 ? selected : theme.colors.onSurfaceVariant} />
            <Text
              numberOfLines={1}
              style={[styles.previewTabLabel, { color: index === 1 ? selected : theme.colors.onSurfaceVariant }]}
            >
              {TAB_LABELS[language][index]}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * A picture of a page and its tab bar in the light or the dark theme, or both
 * side by side for System and Sunrise/Sunset, each in the member's contrast.
 */
export function ThemePreview({
  contrastModes,
  kinds,
}: Readonly<{ contrastModes: Record<ThemeKind, ContrastMode>; kinds: readonly ThemeKind[] }>) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.themePreview}
    >
      {kinds.map((kind) => {
        // Only its colours are used, so it skips scaling the fonts.
        const theme = getAppTheme(kind === 'dark', false, TEXT_SCALE_MIN, contrastModes[kind]);
        const selected = theme.dark ? theme.colors.metallicGold.main : theme.colors.primary;
        return (
          <View key={kind} style={[styles.themePreviewHalf, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.previewLine, { backgroundColor: theme.colors.onSurfaceVariant }]} />
            <View style={[styles.previewLine, styles.previewLineShort, { backgroundColor: theme.colors.onSurfaceVariant }]} />
            <View style={[styles.previewBar, styles.previewBarBelowLines, getFloatingSurfaceStyle(theme)]}>
              {PREVIEW_TABS.map((icon, index) => (
                <View
                  key={icon}
                  style={[styles.previewTab, index === 1 && { backgroundColor: theme.colors.floatingSelected }]}
                >
                  <AppIcon name={icon} size={16} color={index === 1 ? selected : theme.colors.onSurfaceVariant} />
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 6,
    padding: 10,
  },
  cardRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  cardText: {
    flex: 1,
    gap: 2,
  },
  cardLabel: {
    fontWeight: '600',
  },
  preview: {
    borderRadius: 12,
    overflow: 'hidden',
    padding: 6,
  },
  previewBar: {
    borderRadius: 999,
    flexDirection: 'row',
    padding: 3,
  },
  previewBarBelowLines: {
    marginTop: 6,
  },
  previewTab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 4,
  },
  // A picture, so its labels stay a picture's size.
  previewTabLabel: {
    fontSize: scaleTypographyMetric(11, TEXT_SCALE_MIN),
    lineHeight: scaleTypographyMetric(14, TEXT_SCALE_MIN),
  },
  themePreview: {
    borderRadius: 12,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  themePreviewHalf: {
    flex: 1,
    gap: 5,
    paddingHorizontal: 10,
    paddingTop: 10,
    paddingBottom: 8,
  },
  previewLine: {
    borderRadius: 3,
    height: 6,
    opacity: 0.5,
    width: '80%',
  },
  previewLineShort: {
    width: '55%',
  },
});
