import { LanguageContext } from '@/constants/LanguageContext';
import {
  THEME_AMBIENT,
  THEME_DARK,
  THEME_LIGHT,
  THEME_SUNSET,
  THEME_SYSTEM,
  ThemeContext,
  useAppTheme,
  type ThemeMode,
} from '@/constants/Themes';
import { getPopupSurfaceStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Portal, RadioButton, Text } from 'react-native-paper';

type ThemeDialogProps = Readonly<{ onDismiss: () => void; visible: boolean }>;

const OPTIONS: readonly {
  value: ThemeMode;
  labels: Record<'en' | 'zh' | 'zh-cn' | 'es', { label: string; description: string }>;
}[] = [
  {
    value: THEME_LIGHT,
    labels: {
      en: { label: 'Light', description: 'Always use the light theme' },
      zh: { label: '淺色', description: '始終使用淺色主題' },
      'zh-cn': { label: '浅色', description: '始终使用浅色主题' },
      es: { label: 'Claro', description: 'Usar siempre el tema claro' },
    },
  },
  {
    value: THEME_DARK,
    labels: {
      en: { label: 'Dark', description: 'Always use the dark theme' },
      zh: { label: '深色', description: '始終使用深色主題' },
      'zh-cn': { label: '深色', description: '始终使用深色主题' },
      es: { label: 'Oscuro', description: 'Usar siempre el tema oscuro' },
    },
  },
  {
    value: THEME_AMBIENT,
    labels: {
      en: { label: 'Automatic', description: 'Use the ambient light sensor when available' },
      zh: { label: '自動', description: '有可用時根據環境光線調整' },
      'zh-cn': { label: '自动', description: '有可用时根据环境光线调整' },
      es: { label: 'Automático', description: 'Usar el sensor de luz ambiental cuando esté disponible' },
    },
  },
  {
    value: THEME_SUNSET,
    labels: {
      en: { label: 'Sunset', description: 'Follow sunset in New York' },
      zh: { label: '日落', description: '跟隨紐約的日落時間' },
      'zh-cn': { label: '日落', description: '跟随纽约的日落时间' },
      es: { label: 'Atardecer', description: 'Seguir el atardecer en Nueva York' },
    },
  },
  {
    value: THEME_SYSTEM,
    labels: {
      en: { label: 'System', description: 'Follow your device setting' },
      zh: { label: '系統', description: '跟隨裝置設定' },
      'zh-cn': { label: '系统', description: '跟随设备设置' },
      es: { label: 'Sistema', description: 'Seguir la configuración del dispositivo' },
    },
  },
];

const copy = {
  en: {
    title: 'Theme',
    description: 'Choose how the app selects its light or dark appearance.',
    close: 'Close',
  },
  zh: {
    title: '主題',
    description: '選擇應用程式如何使用淺色或深色外觀。',
    close: '關閉',
  },
  'zh-cn': {
    title: '主题',
    description: '选择应用如何使用浅色或深色外观。',
    close: '关闭',
  },
  es: {
    title: 'Tema',
    description: 'Elige cómo la aplicación selecciona su apariencia clara u oscura.',
    close: 'Cerrar',
  },
} as const;

export function ThemeDialog({ onDismiss, visible }: ThemeDialogProps) {
  const { language } = useContext(LanguageContext);
  const { themeMode, setThemeMode } = useContext(ThemeContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const optionLanguage = language in copy ? language : 'en';

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[styles.dialog, getPopupSurfaceStyle(theme)]}
      >
        <Dialog.Title>{labels.title}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            <Text
              variant="bodyMedium"
              style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
            >
              {labels.description}
            </Text>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {OPTIONS.map((option) => {
                const selected = option.value === themeMode;
                const optionLabels = option.labels[optionLanguage as keyof typeof option.labels];

                return (
                  <Pressable
                    key={option.value}
                    accessibilityLabel={`${optionLabels.label}, ${optionLabels.description}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      void setThemeMode(option.value);
                      onDismiss();
                    }}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: selected
                          ? theme.colors.primaryContainer
                          : theme.colors.surfaceVariant,
                        borderColor: selected
                          ? theme.colors.primary
                          : theme.colors.outlineVariant,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <View style={styles.optionText}>
                      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                        {optionLabels.label}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {optionLabels.description}
                      </Text>
                    </View>
                    <View
                      accessibilityElementsHidden
                      importantForAccessibility="no-hide-descendants"
                      pointerEvents="none"
                    >
                      <RadioButton.Android
                        value={option.value}
                        status={selected ? 'checked' : 'unchecked'}
                        color={theme.colors.primary}
                        uncheckedColor={theme.colors.onSurfaceVariant}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </Dialog.ScrollArea>
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel={labels.close}
            accessibilityRole="button"
            onPress={onDismiss}
            style={({ pressed }) => [
              styles.close,
              { borderColor: theme.colors.outline, opacity: pressed ? 0.78 : 1 },
            ]}
          >
            <Text variant="labelLarge" style={[styles.closeLabel, { color: theme.colors.primary }]}>
              {labels.close}
            </Text>
          </Pressable>
        </View>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  actions: {
    alignItems: 'stretch',
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 12,
  },
  close: {
    alignItems: 'center',
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  closeLabel: {
    fontWeight: '700',
    textAlign: 'center',
  },
  description: {
    marginBottom: 16,
  },
  dialog: {
    alignSelf: 'center',
    maxHeight: '90%',
    maxWidth: 560,
    width: '90%',
  },
  option: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  options: {
    gap: 10,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  scrollArea: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 4,
  },
});
