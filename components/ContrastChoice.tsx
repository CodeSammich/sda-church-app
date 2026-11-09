import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { getFloatingSurfaceStyle } from '@/components/CapsuleTabBar';
import { SetupHeading, SetupRoomContext } from '@/components/SetupScreen';
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
import { useContext, useState } from 'react';
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

/**
 * A small picture of the page's bottom with the tab bar, in one theme and
 * contrast. Side by side, its icons keep their size at a large text size, so
 * the four fit across half the width.
 */
function ContrastPreview({
  compact = false,
  contrast,
  kind,
}: Readonly<{ compact?: boolean; contrast: ContrastMode; kind: ThemeKind }>) {
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
            <AppIcon
              name={icon}
              size={22}
              scaleWithText={!compact}
              color={index === 1 ? selected : theme.colors.onSurfaceVariant}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * The two choices for one theme, high contrast first, one above the other or,
 * in columns, side by side, each with its picture in that theme, its label
 * and description. Pressing one chooses it.
 */
export function ContrastChoice({
  columns = false,
  kind,
  language,
  onChoose,
  value,
}: Readonly<{
  columns?: boolean;
  kind: ThemeKind;
  language: string;
  onChoose: (mode: ContrastMode) => void;
  value: ContrastMode;
}>) {
  const theme = useAppTheme();
  const copy = getContrastCopy(language);
  return (
    <View accessibilityRole="radiogroup" style={[styles.options, columns && styles.columns]}>
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
              columns && styles.column,
              {
                backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <ContrastPreview compact={columns} contrast={mode} kind={kind} />
            {/* Side by side, the radio button sits under the picture, so the
                label has the card's width and doesn't break mid-word. */}
            <View style={[styles.optionRow, columns && styles.optionRowColumn]}>
              <View style={[styles.optionText, columns && styles.optionTextColumn]}>
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

/**
 * A contrast question as a step of its own, in first-launch setup and in the
 * question after an update (#708): the question, the hint, and the two
 * pictures. Both pictures and the buttons below should show without a
 * scroll, so where the pictures one above the other don't fit, at a large
 * text size or on a short screen, they sit side by side. It shows once it
 * knows which fits, so the other doesn't flash first.
 */
export function ContrastStep({
  kind,
  language,
  onChoose,
  value,
}: Readonly<{ kind: ThemeKind; language: string; onChoose: (mode: ContrastMode) => void; value: ContrastMode }>) {
  const copy = getContrastCopy(language);
  const room = useContext(SetupRoomContext);
  // The step's height with the pictures one above the other, measured only
  // while they are, so side by side doesn't switch them back and forth.
  const [stackedHeight, setStackedHeight] = useState(0);
  const columns = room !== null && room > 0 && stackedHeight > room;
  const settled = room === null || (room > 0 && stackedHeight > 0);
  return (
    <View
      onLayout={(event) => {
        if (!columns) setStackedHeight(event.nativeEvent.layout.height);
      }}
      style={{ opacity: settled ? 1 : 0 }}
    >
      <SetupHeading title={copy.questions[kind]} subtitle={copy.help} />
      <ContrastChoice columns={columns} kind={kind} language={language} onChoose={onChoose} value={value} />
    </View>
  );
}

const styles = StyleSheet.create({
  options: {
    gap: 12,
  },
  columns: {
    alignItems: 'stretch',
    flexDirection: 'row',
  },
  // Half the width each, however wide their words would make them.
  column: {
    flexBasis: 0,
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
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
  optionRowColumn: {
    alignItems: 'flex-start',
    flexDirection: 'column-reverse',
    gap: 4,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  optionTextColumn: {
    alignSelf: 'stretch',
    flexBasis: 'auto',
    flexGrow: 0,
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
