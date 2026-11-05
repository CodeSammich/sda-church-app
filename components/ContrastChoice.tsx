import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { getFloatingSurfaceStyle } from '@/components/CapsuleTabBar';
import { TEXT_SCALE_MIN } from '@/constants/AppPreferences';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  CONTRAST_HIGH,
  CONTRAST_STANDARD,
  getAppTheme,
  useAppTheme,
  type ContrastMode,
  type ThemeKind,
} from '@/constants/Themes';
import { Pressable, StyleSheet, View } from 'react-native';
import { RadioButton, Text } from 'react-native-paper';

/**
 * The contrast choice (#669): high contrast, the default, or standard, for
 * the light and the dark theme each. Asked at first-launch setup's last two
 * steps, once after the update that brought it, and any time under You →
 * Contrast. Members choose by pictures of the tab bar in each, not by the
 * term alone, which many older members wouldn't know.
 */
export const contrastCopy: Record<
  SupportedLanguage,
  {
    title: string;
    help: string;
    close: string;
    questions: Record<ThemeKind, string>;
    sections: Record<ThemeKind, string>;
    options: Record<ContrastMode, { label: string; description: string }>;
  }
> = {
  en: {
    title: 'Contrast',
    help: 'Compare the bar at the bottom of each picture.',
    close: 'Close',
    questions: { light: 'Which is easier to read in light mode?', dark: 'Which is easier to read in dark mode?' },
    sections: { light: 'Light mode', dark: 'Dark mode' },
    options: {
      [CONTRAST_STANDARD]: { label: 'Standard', description: 'Soft colors, close to the page' },
      [CONTRAST_HIGH]: { label: 'High contrast', description: 'Bars and buttons that stand out clearly' },
    },
  },
  zh: {
    title: '對比度',
    help: '請比較每張圖下方的選單列。',
    close: '關閉',
    questions: { light: '淺色模式下，哪一個看得比較清楚？', dark: '深色模式下，哪一個看得比較清楚？' },
    sections: { light: '淺色模式', dark: '深色模式' },
    options: {
      [CONTRAST_STANDARD]: { label: '標準', description: '柔和的顏色，與頁面相近' },
      [CONTRAST_HIGH]: { label: '高對比度', description: '清楚突出的選單列和按鈕' },
    },
  },
  'zh-cn': {
    title: '对比度',
    help: '请比较每张图下方的菜单栏。',
    close: '关闭',
    questions: { light: '浅色模式下，哪一个看得比较清楚？', dark: '深色模式下，哪一个看得比较清楚？' },
    sections: { light: '浅色模式', dark: '深色模式' },
    options: {
      [CONTRAST_STANDARD]: { label: '标准', description: '柔和的颜色，与页面相近' },
      [CONTRAST_HIGH]: { label: '高对比度', description: '清楚突出的菜单栏和按钮' },
    },
  },
  es: {
    title: 'Contraste',
    help: 'Compara la barra de abajo en cada imagen.',
    close: 'Cerrar',
    questions: { light: '¿Cuál se lee mejor en modo claro?', dark: '¿Cuál se lee mejor en modo oscuro?' },
    sections: { light: 'Modo claro', dark: 'Modo oscuro' },
    options: {
      [CONTRAST_STANDARD]: { label: 'Estándar', description: 'Colores suaves, parecidos a la página' },
      [CONTRAST_HIGH]: { label: 'Alto contraste', description: 'Barras y botones que resaltan claramente' },
    },
  },
};

export const getContrastCopy = (language: string) =>
  contrastCopy[language as SupportedLanguage] ?? contrastCopy.en;

const PREVIEW_TABS: readonly MaterialCommunityIconName[] = ['home', 'cross', 'compass-outline', 'account-circle-outline'];

/** A small picture of the page's bottom with the tab bar, in one theme and contrast. */
function ContrastPreview({ contrast, kind }: Readonly<{ contrast: ContrastMode; kind: ThemeKind }>) {
  // Only its colours are used, so it skips scaling the fonts.
  const theme = getAppTheme(kind === 'dark', false, TEXT_SCALE_MIN, contrast);
  const selected = theme.dark ? theme.colors.metallicGold.main : theme.colors.primary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.preview, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.previewLine, { backgroundColor: theme.colors.onSurfaceVariant }]} />
      <View style={[styles.previewLine, styles.previewLineShort, { backgroundColor: theme.colors.onSurfaceVariant }]} />
      <View style={[styles.previewBar, getFloatingSurfaceStyle(theme)]}>
        {PREVIEW_TABS.map((icon, index) => (
          <View
            key={icon}
            style={[styles.previewTab, index === 1 && { backgroundColor: theme.colors.floatingSelected }]}
          >
            <AppIcon name={icon} size={22} color={index === 1 ? selected : theme.colors.onSurfaceVariant} />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The two choices for one theme, high contrast first, one above the other,
 * each with its picture in that theme, its label and description. Pressing
 * one chooses it.
 */
export function ContrastChoice({
  kind,
  language,
  onChoose,
  value,
}: Readonly<{ kind: ThemeKind; language: string; onChoose: (mode: ContrastMode) => void; value: ContrastMode }>) {
  const theme = useAppTheme();
  const copy = getContrastCopy(language);
  return (
    <View accessibilityRole="radiogroup" style={styles.options}>
      {([CONTRAST_HIGH, CONTRAST_STANDARD] as const).map((mode) => {
        const selected = mode === value;
        const option = copy.options[mode];
        return (
          <Pressable
            key={mode}
            accessibilityLabel={`${option.label}, ${option.description}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            onPress={() => onChoose(mode)}
            testID={`contrast-${kind}-${mode}`}
            style={({ pressed }) => [
              styles.option,
              {
                backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <ContrastPreview contrast={mode} kind={kind} />
            <View style={styles.optionRow}>
              <View style={styles.optionText}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                  {option.label}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {option.description}
                </Text>
              </View>
              <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
                <RadioButton.Android
                  value={mode}
                  status={selected ? 'checked' : 'unchecked'}
                  color={theme.colors.primary}
                  uncheckedColor={theme.colors.onSurfaceVariant}
                />
              </View>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 12,
  },
  option: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  optionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  preview: {
    borderRadius: 12,
    gap: 6,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
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
  previewBar: {
    borderRadius: 999,
    flexDirection: 'row',
    marginTop: 6,
    padding: 3,
  },
  previewTab: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    paddingVertical: 6,
  },
});
