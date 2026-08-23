import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useContext } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { Dialog, Divider, Portal, Text } from 'react-native-paper';

type LanguageDialogProps = Readonly<{ onDismiss: () => void; visible: boolean }>;

const OPTIONS: readonly { value: SupportedLanguage; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: '繁體中文 (Traditional Chinese)' },
  { value: 'zh-cn', label: '简体中文 (Simplified Chinese)' },
  { value: 'es', label: 'Español (Spanish)' },
];

const copy = {
  en: { title: 'Language', close: 'Close' },
  zh: { title: '語言', close: '關閉' },
  'zh-cn': { title: '语言', close: '关闭' },
  es: { title: 'Idioma', close: 'Cerrar' },
} as const;

export function LanguageDialog({ onDismiss, visible }: LanguageDialogProps) {
  const { language, setLanguage } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        <Dialog.Title>{labels.title}</Dialog.Title>
        <Dialog.Content style={styles.content}>
          {OPTIONS.map((option, index) => {
            const selected = option.value === language;
            return (
              <View key={option.value}>
                {index > 0 && <Divider />}
                <TouchableOpacity
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => {
                    setLanguage(option.value);
                    onDismiss();
                  }}
                  style={styles.option}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                    {selected ? '◉' : '○'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </Dialog.Content>
        <Dialog.Actions>
          <TouchableOpacity accessibilityRole="button" onPress={onDismiss} style={styles.close}>
            <Text style={styles.closeLabel}>{labels.close}</Text>
          </TouchableOpacity>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 0 },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 52,
    paddingHorizontal: 24,
    paddingVertical: 10,
  },
  optionLabel: { flex: 1, paddingRight: 12 },
  close: { paddingHorizontal: 12, paddingVertical: 8 },
  closeLabel: { fontWeight: '700' },
});
