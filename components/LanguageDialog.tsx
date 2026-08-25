import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, Portal, RadioButton, Text } from 'react-native-paper';

type LanguageDialogProps = Readonly<{ onDismiss: () => void; visible: boolean }>;

const OPTIONS: readonly {
  value: SupportedLanguage;
  label: string;
  description: string;
}[] = [
  { value: 'en', label: 'English', description: 'English' },
  { value: 'zh', label: '繁體中文', description: 'Traditional Chinese' },
  { value: 'zh-cn', label: '简体中文', description: 'Simplified Chinese' },
  { value: 'es', label: 'Español', description: 'Spanish' },
];

const copy = {
  en: {
    title: 'Language',
    description: 'Choose the language used throughout the app.',
    selected: 'Selected',
    close: 'Close',
  },
  zh: {
    title: '語言',
    description: '選擇整個應用程式使用的語言。',
    selected: '已選擇',
    close: '關閉',
  },
  'zh-cn': {
    title: '语言',
    description: '选择整个应用使用的语言。',
    selected: '已选择',
    close: '关闭',
  },
  es: {
    title: 'Idioma',
    description: 'Elige el idioma que se usará en toda la aplicación.',
    selected: 'Seleccionado',
    close: 'Cerrar',
  },
} as const;

export function LanguageDialog({ onDismiss, visible }: LanguageDialogProps) {
  const { language, setLanguage } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[
          styles.dialog,
          getPopupSurfaceStyle(theme),
        ]}
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
                const selected = option.value === language;
                const accessibilityLabel = `${option.label}, ${option.description}`;

                return (
                  <Pressable
                    key={option.value}
                    accessibilityLabel={accessibilityLabel}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => {
                      setLanguage(option.value);
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
                      <Text
                        variant="titleMedium"
                        style={{ color: theme.colors.onSurface }}
                      >
                        {option.label}
                      </Text>
                      <Text
                        variant="bodySmall"
                        style={{ color: theme.colors.onSurfaceVariant }}
                      >
                        {option.description}
                        {selected ? ` · ${labels.selected}` : ''}
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
              {
                borderColor: theme.colors.outline,
                opacity: pressed ? 0.78 : 1,
              },
            ]}
          >
            <Text
              variant="labelLarge"
              style={[styles.closeLabel, { color: theme.colors.primary }]}
            >
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
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
});
