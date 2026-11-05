import { ContrastChoice, getContrastCopy } from '@/components/ContrastChoice';
import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import { LanguageContext } from '@/constants/LanguageContext';
import { ThemeContext, useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

/**
 * You → Contrast (#669): high contrast, the default, or standard, chosen by
 * pictures of the tab bar in each.
 */
export function ContrastDialog({ onDismiss, visible }: Readonly<{ onDismiss: () => void; visible: boolean }>) {
  const { language } = useContext(LanguageContext);
  const { contrastMode, setContrastMode } = useContext(ThemeContext);
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();
  const copy = getContrastCopy(language);

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[popupWidthStyle, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <PopupHeader
          closeLabel={copy.close}
          onClose={onDismiss}
          style={styles.header}
          title={copy.title}
          variant="headlineSmall"
        />
        <Dialog.ScrollArea style={styles.scrollArea}>
          <PopupScrollView contentContainerStyle={styles.scrollContent}>
            <Text variant="bodyMedium" style={[styles.help, { color: theme.colors.onSurfaceVariant }]}>
              {copy.help}
            </Text>
            <ContrastChoice
              language={language}
              onChoose={(mode) => {
                void setContrastMode(mode);
                onDismiss();
              }}
              value={contrastMode}
            />
          </PopupScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  help: {
    marginBottom: 16,
  },
  // As in ThemeDialog: with the X's 48-point row, 16 keeps the title where
  // Paper's own title sits.
  header: {
    marginBottom: 8,
    marginTop: 16,
    paddingLeft: 24,
    paddingRight: 12,
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
});
