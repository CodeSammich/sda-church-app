import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import { APP_DOWNLOAD_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { Image, Share, StyleSheet, View } from 'react-native';
import { Button, Dialog, Portal, Text } from 'react-native-paper';

type ShareAppDialogProps = Readonly<{ onDismiss: () => void; visible: boolean }>;

const copy = {
  en: {
    title: 'Share the App',
    description: "Show this code to a friend. Their phone's camera opens a page that sends them to their app store.",
    share: 'Share Link',
    close: 'Close',
    qrLabel: 'QR code for the app download page',
  },
  zh: {
    title: '分享應用程式',
    description: '請朋友用手機相機掃描此 QR 碼，即可前往應用程式商店下載。',
    share: '分享連結',
    close: '關閉',
    qrLabel: '應用程式下載頁面的 QR 碼',
  },
  'zh-cn': {
    title: '分享应用',
    description: '请朋友用手机相机扫描此二维码，即可前往应用商店下载。',
    share: '分享链接',
    close: '关闭',
    qrLabel: '应用下载页面的二维码',
  },
  es: {
    title: 'Compartir la App',
    description:
      'Muestre este código a un amigo. La cámara de su teléfono abre una página que lo lleva a su tienda de aplicaciones.',
    share: 'Compartir enlace',
    close: 'Cerrar',
    qrLabel: 'Código QR de la página de descarga de la app',
  },
} as const;

// The same address as the printed bulletin's app QR code
// (scripts/bulletin-qr-codes.json), made by scripts/generate-qr.mjs (#555).
const QR_IMAGE = require('@/assets/images/app-download-qr.jpg');

export function ShareAppDialog({ onDismiss, visible }: ShareAppDialogProps) {
  const { language } = useContext(LanguageContext);
  const labels = copy[language as keyof typeof copy] || copy.en;
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();

  const shareLink = async () => {
    try {
      await Share.share({ message: APP_DOWNLOAD_URL, url: APP_DOWNLOAD_URL });
    } catch (error) {
      console.warn('Sharing the app download link failed', error);
    }
  };

  return (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={onDismiss}
        style={[popupWidthStyle, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <PopupHeader
          closeLabel={labels.close}
          onClose={onDismiss}
          style={styles.header}
          title={labels.title}
          variant="headlineSmall"
        />
        <Dialog.ScrollArea style={styles.scrollArea}>
          <PopupScrollView contentContainerStyle={styles.scrollContent}>
            <Text
              variant="bodyMedium"
              style={[styles.description, { color: theme.colors.onSurfaceVariant }]}
            >
              {labels.description}
            </Text>
            {/* A white square, so the code scans in the dark theme too. */}
            <View style={styles.qrFrame}>
              <Image
                source={QR_IMAGE}
                style={styles.qr}
                accessibilityLabel={labels.qrLabel}
                accessibilityRole="image"
              />
            </View>
            <Text
              variant="bodyMedium"
              selectable
              style={[styles.link, { color: theme.colors.primary }]}
            >
              {APP_DOWNLOAD_URL.replace(/^https:\/\//, '')}
            </Text>
            <Button mode="contained" icon="share-variant" onPress={shareLink} style={styles.share}>
              {labels.share}
            </Button>
          </PopupScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  description: {
    alignSelf: 'stretch',
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
  link: {
    marginTop: 12,
    textAlign: 'center',
  },
  qr: {
    height: 220,
    width: 220,
  },
  qrFrame: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
  },
  scrollArea: {
    borderBottomWidth: 0,
    marginBottom: 0,
    paddingHorizontal: 0,
  },
  scrollContent: {
    alignItems: 'center',
    paddingBottom: 24,
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  share: {
    marginTop: 16,
  },
});
