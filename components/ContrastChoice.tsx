import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { getFloatingSurfaceStyle } from '@/components/CapsuleTabBar';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  CONTRAST_HIGH,
  CONTRAST_STANDARD,
  getAppTheme,
  useAppTheme,
  type ContrastMode,
} from '@/constants/Themes';
import { DEFAULT_TEXT_SCALE, TEXT_SCALE_MIN } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { RadioButton, Text } from 'react-native-paper';

/**
 * The contrast choice (#669): high contrast, the default, or standard, in
 * first-launch setup's last step and under You → Contrast. Members choose by
 * pictures of the tab bar in each, not by the term alone, which many older
 * members wouldn't know.
 */
export const contrastCopy: Record<
  SupportedLanguage,
  {
    title: string;
    question: string;
    help: string;
    close: string;
    options: Record<ContrastMode, { label: string; description: string }>;
  }
> = {
  en: {
    title: 'Contrast',
    question: 'Which is easier to read?',
    help: 'Compare the bar at the bottom of each picture.',
    close: 'Close',
    options: {
      [CONTRAST_STANDARD]: { label: 'Standard', description: 'Soft colors, close to the page' },
      [CONTRAST_HIGH]: { label: 'High contrast', description: 'Bars and buttons that stand out clearly' },
    },
  },
  zh: {
    title: '對比度',
    question: '哪一個看得比較清楚？',
    help: '請比較每張圖下方的選單列。',
    close: '關閉',
    options: {
      [CONTRAST_STANDARD]: { label: '標準', description: '柔和的顏色，與頁面相近' },
      [CONTRAST_HIGH]: { label: '高對比度', description: '清楚突出的選單列和按鈕' },
    },
  },
  'zh-cn': {
    title: '对比度',
    question: '哪一个看得比较清楚？',
    help: '请比较每张图下方的菜单栏。',
    close: '关闭',
    options: {
      [CONTRAST_STANDARD]: { label: '标准', description: '柔和的颜色，与页面相近' },
      [CONTRAST_HIGH]: { label: '高对比度', description: '清楚突出的菜单栏和按钮' },
    },
  },
  es: {
    title: 'Contraste',
    question: '¿Cuál se lee mejor?',
    help: 'Compara la barra de abajo en cada imagen.',
    close: 'Cerrar',
    options: {
      [CONTRAST_STANDARD]: { label: 'Estándar', description: 'Colores suaves, parecidos a la página' },
      [CONTRAST_HIGH]: { label: 'Alto contraste', description: 'Barras y botones que resaltan claramente' },
    },
  },
};

export const getContrastCopy = (language: string) =>
  contrastCopy[language as SupportedLanguage] ?? contrastCopy.en;

const PREVIEW_TABS: readonly MaterialCommunityIconName[] = ['home', 'cross', 'compass-outline', 'account-circle-outline'];

/** A small picture of the page's bottom with the tab bar, in one contrast. */
function ContrastPreview({ compact, contrast }: Readonly<{ compact: boolean; contrast: ContrastMode }>) {
  const appTheme = useAppTheme();
  // Only its colours are used, so it skips scaling the fonts.
  const theme = getAppTheme(appTheme.dark, false, TEXT_SCALE_MIN, contrast);
  const selected = theme.dark ? theme.colors.metallicGold.main : theme.colors.primary;
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={[styles.preview, compact && styles.previewCompact, { backgroundColor: theme.colors.background }]}
    >
      <View style={[styles.previewLine, { backgroundColor: theme.colors.onSurfaceVariant }]} />
      <View style={[styles.previewLine, styles.previewLineShort, { backgroundColor: theme.colors.onSurfaceVariant }]} />
      <View style={[styles.previewBar, getFloatingSurfaceStyle(theme)]}>
        {PREVIEW_TABS.map((icon, index) => (
          <View
            key={icon}
            style={[
              styles.previewTab,
              compact && styles.previewTabCompact,
              index === 1 && { backgroundColor: theme.colors.floatingSelected },
            ]}
          >
            <AppIcon
              name={icon}
              size={compact ? 18 : 22}
              color={index === 1 ? selected : theme.colors.onSurfaceVariant}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The two choices, each with its picture, label and description. Pressing
 * one chooses it. Side by side where they fit, as on a phone at up to the
 * 125% default, so both pictures are in view to compare without scrolling,
 * with a smaller radio mark so the labels keep whole words; one above the
 * other at larger sizes.
 */
export function ContrastChoice({
  language,
  onChoose,
  value,
}: Readonly<{ language: string; onChoose: (mode: ContrastMode) => void; value: ContrastMode }>) {
  const theme = useAppTheme();
  const copy = getContrastCopy(language);
  const { textScale } = useTextSize();
  const [width, setWidth] = useState(0);
  const sideBySide = width >= 300 && textScale <= DEFAULT_TEXT_SCALE;
  return (
    <View
      accessibilityRole="radiogroup"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={[styles.options, sideBySide && styles.optionsSideBySide]}
    >
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
            testID={`contrast-${mode}`}
            style={({ pressed }) => [
              styles.option,
              sideBySide && styles.optionSideBySide,
              {
                backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <ContrastPreview compact={sideBySide} contrast={mode} />
            <View style={[styles.optionRow, sideBySide && styles.optionRowSideBySide]}>
              {sideBySide && (
                <AppIcon
                  name={selected ? 'radiobox-marked' : 'radiobox-blank'}
                  size={20}
                  color={selected ? theme.colors.primary : theme.colors.onSurfaceVariant}
                />
              )}
              <View style={styles.optionText}>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                  {option.label}
                </Text>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {option.description}
                </Text>
              </View>
              {!sideBySide && (
                <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
                  <RadioButton.Android
                    value={mode}
                    status={selected ? 'checked' : 'unchecked'}
                    color={theme.colors.primary}
                    uncheckedColor={theme.colors.onSurfaceVariant}
                  />
                </View>
              )}
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
  optionsSideBySide: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  optionSideBySide: {
    flex: 1,
    padding: 8,
  },
  optionRowSideBySide: {
    alignItems: 'flex-start',
    gap: 6,
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
  previewCompact: {
    gap: 4,
    paddingHorizontal: 8,
    paddingTop: 8,
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
  previewTabCompact: {
    paddingVertical: 4,
  },
});
