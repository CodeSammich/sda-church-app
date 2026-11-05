import { ContrastChoice, getContrastCopy } from '@/components/ContrastChoice';
import { PopupScrollView } from '@/components/PopupScrollView';
import { LanguageContext } from '@/constants/LanguageContext';
import { ThemeContext, useAppTheme, type ThemeKind } from '@/constants/Themes';
import { isKeyScreensBuild, SCREENSHOT_WHATS_NEW_STEP_KEY } from '@/services/ScreenshotRoute';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext, useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

/**
 * What's new in 1.7.0 (#669), once, for members who set up an earlier
 * version: only the contrast question setup now asks, for light mode and
 * then dark mode, each with its two pictures. It asks questions, so it has no
 * X and can't be dismissed: pressing a picture answers one, and after the
 * second it closes for good.
 */
export function WhatsNewDialog({ onDone }: Readonly<{ onDone: () => void }>) {
  const { language } = useContext(LanguageContext);
  const { contrastModes, setContrastMode } = useContext(ThemeContext);
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();
  const copy = getContrastCopy(language);
  const [kind, setKind] = useState<ThemeKind>('light');

  // A key-screens build can open the second question, since the capture
  // can't press the first.
  useEffect(() => {
    if (!isKeyScreensBuild()) return;
    void AsyncStorage.getItem(SCREENSHOT_WHATS_NEW_STEP_KEY).then((saved) => {
      if (saved === 'dark') setKind('dark');
    });
  }, []);

  return (
    <Portal>
      <Dialog
        visible
        dismissable={false}
        dismissableBackButton={false}
        style={[popupWidthStyle, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <Dialog.Title style={styles.title}>{copy.questions[kind]}</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          {/* Keyed by the question, so the second opens at its top. */}
          <PopupScrollView key={kind} contentContainerStyle={styles.scrollContent}>
            <Text variant="bodyMedium" style={[styles.help, { color: theme.colors.onSurfaceVariant }]}>
              {copy.help}
            </Text>
            <ContrastChoice
              kind={kind}
              language={language}
              onChoose={(mode) => {
                void setContrastMode(kind, mode);
                if (kind === 'light') setKind('dark');
                else onDone();
              }}
              value={contrastModes[kind]}
            />
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
