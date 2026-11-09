import { ContrastChoice, getContrastCopy } from '@/components/ContrastChoice';
import { PopupScrollView } from '@/components/PopupScrollView';
import { SetupAction } from '@/components/SetupAction';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { ThemeContext, useAppTheme, type ThemeKind } from '@/constants/Themes';
import { isKeyScreensBuild, SCREENSHOT_WHATS_NEW_STEP_KEY } from '@/services/ScreenshotRoute';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useContext, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

// Setup's words for its buttons, with Done for the last question: members
// who see this have already started.
const labels: Record<SupportedLanguage, { back: string; done: string; next: string }> = {
  en: { back: 'Back', done: 'Done', next: 'Next' },
  zh: { back: '上一步', done: '完成', next: '下一步' },
  'zh-cn': { back: '上一步', done: '完成', next: '下一步' },
  es: { back: 'Atrás', done: 'Listo', next: 'Siguiente' },
};

/**
 * What's new in 1.7.0 (#669), once, for members who set up an earlier
 * version: only the contrast question setup now asks, for light mode and
 * then dark mode, each with its two pictures. It asks questions, so it has no
 * X and can't be dismissed. As in setup, a tap on a picture only chooses it,
 * and Next, then Done, go on (#708): high contrast starts chosen, and when a
 * tap on a picture went on, a tap on the one already chosen seemed to do
 * nothing. Each button saves the choice shown, so high contrast kept is saved.
 */
export function WhatsNewDialog({ onDone }: Readonly<{ onDone: () => void }>) {
  const { language } = useContext(LanguageContext);
  const { contrastModes, setContrastMode } = useContext(ThemeContext);
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();
  const copy = getContrastCopy(language);
  const words = labels[language] ?? labels.en;
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
              onChoose={(mode) => void setContrastMode(kind, mode)}
              value={contrastModes[kind]}
            />
          </PopupScrollView>
        </Dialog.ScrollArea>
        {/* Below the scrolling part, so the way on is always in view. */}
        <View style={styles.actions}>
          {kind === 'dark' && (
            <SetupAction kind="outlined" label={words.back} onPress={() => setKind('light')} placement="fill" />
          )}
          <SetupAction
            label={kind === 'dark' ? words.done : words.next}
            onPress={() => {
              void setContrastMode(kind, contrastModes[kind]);
              if (kind === 'light') setKind('dark');
              else onDone();
            }}
            placement="fill"
          />
        </View>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  help: {
    marginBottom: 12,
  },
  scrollArea: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingBottom: 16,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  title: {
    marginTop: 24,
  },
});
