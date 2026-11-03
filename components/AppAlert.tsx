import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import { WrappingButton } from '@/components/WrappingButton';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight } from '@/styles/PopupStyles';
import { useContext, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

/**
 * The app's own popups, in place of the system's alerts (Alert.alert), which
 * look like Android's or iOS's own rather than the app's. Shaped like
 * Alert.alert, so a call reads the same: showAppAlert(title, message, buttons).
 * One AppAlertHost, in app/_layout.tsx, shows them, a popup at a time.
 *
 * As docs/UI_UX.md asks of every popup: centred, with the shared corners
 * (getPopupSurfaceStyle) and the one height limit (usePopupMaxHeight).
 * - A popup that asks a question has its answers as buttons, and no X; a tap
 *   outside it, or Android's Back, answers Cancel.
 * - A popup that only says something has an X in its title row, and no Close
 *   button.
 */

/** Text in the app's language: a string the caller has chosen, or one for each language. */
export type LocalizedText = string | Readonly<Record<SupportedLanguage, string>>;

const inLanguage = (text: LocalizedText, language: SupportedLanguage) =>
  typeof text === 'string' ? text : (text[language] ?? text.en);

export type AppAlertButton = Readonly<{
  text: string;
  /** Cancel goes last, as a plain button. Destructive is in the error color. */
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}>;

type AppAlert = Readonly<{ title: LocalizedText; message?: LocalizedText; buttons: readonly AppAlertButton[] }>;

let current: AppAlert | null = null;
const waiting: AppAlert[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

/** Shows a popup, after any already showing. With no buttons, it only informs, with an X. */
export const showAppAlert = (title: LocalizedText, message?: LocalizedText, buttons: readonly AppAlertButton[] = []) => {
  const alert = { title, message, buttons };
  if (current) {
    waiting.push(alert);
  } else {
    current = alert;
    notify();
  }
};

// Closes the popup showing, then does what its answer does, so that answer
// may show another.
const close = (button?: AppAlertButton) => {
  current = waiting.shift() ?? null;
  notify();
  button?.onPress?.();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The popup showing now, for tests. */
export const getAppAlertForTests = () => current;

/** Forgets every popup, for tests. */
export const resetAppAlertsForTests = () => {
  current = null;
  waiting.length = 0;
  notify();
};

const closeLabels = { en: 'Close', zh: '關閉', 'zh-cn': '关闭', es: 'Cerrar' } as const;

/** Shows showAppAlert's popups. Mounted once, in app/_layout.tsx. */
export function AppAlertHost() {
  const alert = useSyncExternalStore(subscribe, () => current);
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  if (!alert) return null;

  const cancel = alert.buttons.find(({ style }) => style === 'cancel');
  // The main answer first, as the last one Alert.alert would list; Cancel last.
  const answers = alert.buttons.filter((button) => button !== cancel).reverse();
  const asks = alert.buttons.length > 0;

  return (
    <Portal>
      <Dialog
        testID="app-alert"
        visible
        onDismiss={() => close(cancel)}
        style={[styles.dialog, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        {asks ? (
          <Text accessibilityRole="header" variant="titleLarge" style={[styles.title, { color: theme.colors.onSurface }]}>
            {inLanguage(alert.title, language)}
          </Text>
        ) : (
          <PopupHeader
            closeLabel={closeLabels[language] ?? closeLabels.en}
            onClose={() => close()}
            style={styles.header}
            title={inLanguage(alert.title, language)}
          />
        )}
        {!!alert.message && (
          <Dialog.ScrollArea style={styles.scrollArea}>
            <PopupScrollView contentContainerStyle={[styles.message, !asks && styles.noticeMessage]}>
              <Text variant="bodyLarge" style={{ color: theme.colors.onSurfaceVariant }}>
                {inLanguage(alert.message, language)}
              </Text>
            </PopupScrollView>
          </Dialog.ScrollArea>
        )}
        {asks && (
          <View style={styles.answers}>
            {answers.map((button, index) => (
              <WrappingButton
                key={button.text}
                mode={index === 0 ? 'contained' : 'outlined'}
                buttonColor={index === 0 && button.style === 'destructive' ? theme.colors.error : undefined}
                textColor={
                  button.style === 'destructive'
                    ? index === 0
                      ? theme.colors.onError
                      : theme.colors.error
                    : undefined
                }
                onPress={() => close(button)}
                style={styles.answer}
              >
                {button.text}
              </WrappingButton>
            ))}
            {cancel && (
              <WrappingButton mode="text" onPress={() => close(cancel)} style={styles.answer}>
                {cancel.text}
              </WrappingButton>
            )}
          </View>
        )}
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  // As ThemeDialog's.
  dialog: { alignSelf: 'center', maxWidth: 560, width: '90%' },
  // Paper gives a dialog's first child a 24-point top margin; with the X's
  // 48-point row, 16 keeps the title where Paper's own title sits.
  header: { marginBottom: 8, marginTop: 16, paddingLeft: 24, paddingRight: 12 },
  title: { marginBottom: 8, paddingHorizontal: 24 },
  scrollArea: { borderBottomWidth: 0, borderTopWidth: 0, marginBottom: 0, paddingHorizontal: 0 },
  message: { paddingBottom: 8, paddingHorizontal: 24 },
  // With no buttons below, as much room under the message as above the title.
  noticeMessage: { paddingBottom: 24 },
  // Stacked, and wrapping (Paper's Button keeps to one line), so long answers
  // in large text still fit, as "Usar datos móviles".
  answers: { gap: 8, paddingBottom: 20, paddingHorizontal: 24, paddingTop: 12 },
  answer: { alignSelf: 'stretch' },
});
