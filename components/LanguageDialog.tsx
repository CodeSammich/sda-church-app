import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import { ChoiceCard, TabBarPreview } from '@/components/SettingChoices';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

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
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();

  return (
    <Portal>
      <Dialog
        testID="language-dialog"
        visible={visible}
        onDismiss={onDismiss}
        style={[
          popupWidthStyle,
          { maxHeight: popupMaxHeight },
          getPopupSurfaceStyle(theme),
        ]}
      >
        <PopupHeader
          closeLabel={labels.close}
          onClose={onDismiss}
          style={styles.header}
          title={labels.title}
          variant="headlineSmall"
        />
        <Dialog.ScrollArea
          style={styles.scrollArea}
          testID="language-dialog-scroll-area"
        >
          <PopupScrollView contentContainerStyle={styles.scrollContent}>
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
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  description: {
    marginBottom: 16,
  },
  // Paper gives a dialog's first child a 24-point top margin; with the X's
  // 48-point row, 16 keeps the title where Paper's own title sits.
  header: {
    marginBottom: 8,
    marginTop: 16,
    paddingLeft: 24,
    paddingRight: 12,
  },
  options: {
    gap: 10,
  },
  scrollArea: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});
