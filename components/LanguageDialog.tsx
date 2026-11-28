import { AppSheet } from '@/components/AppSheet';
import { PopupScrollView } from '@/components/PopupScrollView';
import { ChoiceCard, TabBarPreview } from '@/components/SettingChoices';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';

type LanguageDialogProps = Readonly<{ onDismiss: () => void; visible: boolean }>;

/**
 * Each language by its own name only (maintainer, #867): a second line in
 * English filled half of each card with words a reader of that language may
 * not read, and pushed the languages below the sheet's fold. A screen reader
 * reads each name in its own language.
 */
const OPTIONS: readonly {
  value: SupportedLanguage;
  label: string;
  /** The name's language, for VoiceOver (BCP 47). */
  locale: string;
}[] = [
  { value: 'en', label: 'English', locale: 'en' },
  { value: 'zh', label: '繁體中文', locale: 'zh-Hant' },
  { value: 'zh-cn', label: '简体中文', locale: 'zh-Hans' },
  { value: 'es', label: 'Español', locale: 'es' },
];

const copy = {
  en: {
    title: 'Language',
    close: 'Close',
  },
  zh: {
    title: '語言',
    close: '關閉',
  },
  'zh-cn': {
    title: '语言',
    close: '关闭',
  },
  es: {
    title: 'Idioma',
    close: 'Cerrar',
  },
} as const;

export function LanguageDialog({ onDismiss, visible }: LanguageDialogProps) {
  const { language, setLanguage } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;

  return (
    <AppSheet
      testID="language-dialog"
      visible={visible}
      onDismiss={onDismiss}
      closeLabel={labels.close}
      title={labels.title}
      // A choice made by comparing them all: full height (#867).
      height="large"
    >
      {/* No line under the title, which says what the sheet is: without it,
          the four languages show at once at 200% text on a phone (#867). */}
      <PopupScrollView testID="language-dialog-scroll" contentContainerStyle={styles.scrollContent}>
        {/* Each a picture of the tab bar in it, one above another (#681). */}
        <View accessibilityRole="radiogroup" style={styles.options}>
          {OPTIONS.map((option) => (
            <ChoiceCard
              key={option.value}
              accessibilityLanguage={option.locale}
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
  options: {
    gap: 8,
  },
  scrollContent: {
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
});
