import { ContrastChoice, getContrastCopy } from '@/components/ContrastChoice';
import { PopupScrollView } from '@/components/PopupScrollView';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { ThemeContext, useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

const copy: Record<SupportedLanguage, { title: string; intro: string; note: string }> = {
  en: {
    title: "What's new",
    intro: "A new look: the tab bar and the Bible's controls now float above the page.",
    note: 'You can change this anytime in You → Contrast.',
  },
  zh: {
    title: '新功能',
    intro: '全新外觀：分頁列和聖經的控制項現在浮在頁面上。',
    note: '之後可隨時在「您」→「對比度」中更改。',
  },
  'zh-cn': {
    title: '新功能',
    intro: '全新外观：标签栏和圣经的控件现在浮在页面上。',
    note: '之后可随时在“您”→“对比度”中更改。',
  },
  es: {
    title: 'Novedades',
    intro: 'Un nuevo diseño: las pestañas y los controles de la Biblia ahora flotan sobre la página.',
    note: 'Puedes cambiarlo cuando quieras en Tú → Contraste.',
  },
};

/**
 * "What's new" in 1.7.0 (#669), once, for members who set up an earlier
 * version: the new look, and the contrast choice that setup now asks. It asks
 * a question, so it has no X and can't be dismissed: pressing a picture
 * answers it and closes it, with high contrast first.
 */
export function WhatsNewDialog({ onDone }: Readonly<{ onDone: () => void }>) {
  const { language } = useContext(LanguageContext);
  const { contrastMode, setContrastMode } = useContext(ThemeContext);
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();
  const labels = copy[language] ?? copy.en;
  const contrastCopy = getContrastCopy(language);

  return (
    <Portal>
      <Dialog
        visible
        dismissable={false}
        dismissableBackButton={false}
        style={[popupWidthStyle, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <Dialog.Title style={styles.title}>{labels.title}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <PopupScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
              {labels.intro}
            </Text>
            <Text variant="titleMedium" style={[styles.question, { color: theme.colors.onSurface }]}>
              {contrastCopy.question}
            </Text>
            <Text variant="bodyMedium" style={[styles.help, { color: theme.colors.onSurfaceVariant }]}>
              {contrastCopy.help}
            </Text>
            <ContrastChoice
              language={language}
              onChoose={(mode) => {
                void setContrastMode(mode);
                onDone();
              }}
              value={contrastMode}
            />
            <Text variant="bodySmall" style={[styles.note, { color: theme.colors.onSurfaceVariant }]}>
              {labels.note}
            </Text>
          </PopupScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  help: {
    marginBottom: 12,
  },
  note: {
    marginTop: 16,
  },
  question: {
    marginTop: 16,
  },
  scrollArea: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  title: {
    marginTop: 24,
  },
});
