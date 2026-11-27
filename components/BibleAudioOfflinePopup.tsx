import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import { WrappingButton } from '@/components/WrappingButton';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { getBibleAudioOfflineCopy } from '@/services/BibleAudioOfflineLine';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, Text } from 'react-native-paper';

type BibleAudioOfflinePopupProps = Readonly<{
  visible: boolean;
  /** The X, or a tap outside. */
  onClose: () => void;
  /** Opens Offline Bible Audio, which then shows the book being read. */
  onOpen: () => void;
}>;

/**
 * What the Bible audio line's "not downloaded" link opens, and the one-time
 * tip shows by itself (#801): why the chapter can't play, and where to
 * download chapters for next time. It works offline, as the page it opens does.
 */
export function BibleAudioOfflinePopup({ onClose, onOpen, visible }: BibleAudioOfflinePopupProps) {
  const { language } = useContext(LanguageContext);
  const labels = getBibleAudioOfflineCopy(language);
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();

  return (
    <Portal>
      <Dialog
        testID="bible-audio-offline-popup"
        visible={visible}
        onDismiss={onClose}
        style={[popupWidthStyle, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <PopupHeader closeLabel={labels.close} onClose={onClose} style={styles.header} title={labels.title} />
        <Dialog.ScrollArea style={styles.scrollArea}>
          <PopupScrollView contentContainerStyle={styles.body}>
            <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
              {labels.body}
            </Text>
          </PopupScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions style={styles.actions}>
          <WrappingButton mode="contained" onPress={onOpen}>
            {labels.open}
          </WrappingButton>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  // Paper puts actions at the end; the one button sits in the middle.
  actions: { justifyContent: 'center', paddingBottom: 20, paddingHorizontal: 24, paddingTop: 16 },
  body: { paddingTop: 4 },
  header: { marginBottom: 8, marginTop: 16, paddingLeft: 24, paddingRight: 12 },
  scrollArea: { borderBottomWidth: 0, borderTopWidth: 0, paddingHorizontal: 24 },
});
