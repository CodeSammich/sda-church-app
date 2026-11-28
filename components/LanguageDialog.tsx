import { AppSheet } from '@/components/AppSheet';
import { PopupScrollView } from '@/components/PopupScrollView';
import { ChoiceCard, TabBarPreview } from '@/components/SettingChoices';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';

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
    close: 'Close',
  },
  zh: {
    title: '語言',
    description: '選擇整個應用程式使用的語言。',
    close: '關閉',
  },
  'zh-cn': {
    title: '语言',
    description: '选择整个应用使用的语言。',
    close: '关闭',
  },
  es: {
    title: 'Idioma',
    description: 'Elige el idioma que se usará en toda la aplicación.',
    close: 'Cerrar',
  },
} as const;

export function LanguageDialog({ onDismiss, visible }: LanguageDialogProps) {
  const { language, setLanguage } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();

  return (
    <AppSheet
      testID="language-dialog"
      visible={visible}
      onDismiss={onDismiss}
      closeLabel={labels.close}
      title={labels.title}
    >
      <PopupScrollView testID="language-dialog-scroll" contentContainerStyle={styles.scrollContent}>
        <Text
          variant="bodyMedium"
          style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
        >
          {labels.description}
        </Text>
        {/* Each a picture of the tab bar in it, one above another (#681). */}
        <View accessibilityRole="radiogroup" style={styles.options}>
          {OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              accessibilityLabel={`${option.label}, ${option.description}`}
              description={option.description}
              label={option.label}
              onPress={() => {
                setLanguage(option.value);
                onDismiss();
              }}
              selected={option.value === language}
            >
              <TabBarPreview language={option.value} />
            </ChoiceCard>
          ))}
        </View>
      </PopupScrollView>
    </AppSheet>
  );
}

const styles = StyleSheet.create({
  description: {
    marginBottom: 16,
  },
  options: {
    gap: 10,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
