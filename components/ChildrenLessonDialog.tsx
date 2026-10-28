import { PopupHeader } from '@/components/PopupHeader';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import type { LessonDownloadProgress } from '@/features/sabbath-school/LessonDownloads';
import { getPopupSurfaceStyle, usePopupMaxHeight } from '@/styles/PopupStyles';
import { useContext } from 'react';
import { StyleSheet } from 'react-native';
import { Dialog, Portal, ProgressBar, Text } from 'react-native-paper';

const megabytes = (bytes: number, language: SupportedLanguage) => {
  const text = (bytes / 1_000_000).toFixed(1);
  return language === 'es' ? text.replace('.', ',') : text;
};

const copy = {
  en: {
    finding: 'Finding this week’s lesson…',
    starting: 'Downloading…',
    downloading: (done: string, total?: string) =>
      total ? `Downloading · ${done} of ${total} MB` : `Downloading · ${done} MB`,
    note: 'It stays on this phone for the week, so next time it opens at once.',
    offline: 'No connection. Connect to the internet to download this week’s lesson.',
    close: 'Close',
  },
  zh: {
    finding: '正在尋找本週課程…',
    starting: '下載中…',
    downloading: (done: string, total?: string) =>
      total ? `下載中 · ${done} / ${total} MB` : `下載中 · ${done} MB`,
    note: '課程會在這部手機保留一週，下次可立即開啟。',
    offline: '沒有網路連線。請連上網路以下載本週課程。',
    close: '關閉',
  },
  'zh-cn': {
    finding: '正在查找本周课程…',
    starting: '下载中…',
    downloading: (done: string, total?: string) =>
      total ? `下载中 · ${done} / ${total} MB` : `下载中 · ${done} MB`,
    note: '课程会在这部手机保留一周，下次可立即打开。',
    offline: '没有网络连接。请连接网络以下载本周课程。',
    close: '关闭',
  },
  es: {
    finding: 'Buscando la lección de esta semana…',
    starting: 'Descargando…',
    downloading: (done: string, total?: string) =>
      total ? `Descargando · ${done} de ${total} MB` : `Descargando · ${done} MB`,
    note: 'Se queda en este teléfono durante la semana, así que la próxima vez se abre al instante.',
    offline: 'Sin conexión. Conéctate a internet para descargar la lección de esta semana.',
    close: 'Cerrar',
  },
} as const;

/** What a children's lesson popup says: finding the lesson, then how much has downloaded. */
export const getChildrenLessonStatus = (
  progress: LessonDownloadProgress | null,
  language: SupportedLanguage,
) => {
  const labels = copy[language] || copy.en;
  if (!progress) return { text: labels.finding, fraction: null };
  const known = progress.totalBytes > 0;
  // Until the first progress event, which can take a second or two.
  if (!known && progress.bytesWritten <= 0) return { text: labels.starting, fraction: null };
  return {
    text: labels.downloading(
      megabytes(progress.bytesWritten, language),
      known ? megabytes(progress.totalBytes, language) : undefined,
    ),
    fraction: known ? Math.min(1, progress.bytesWritten / progress.totalBytes) : null,
  };
};

type ChildrenLessonDialogProps = Readonly<{
  /** The age group, such as "Primary (ages 7–9)". */
  title: string;
  /** Null while the app looks up this week's lesson. */
  progress: LessonDownloadProgress | null;
  /** Offline with no copy on the phone: says so, with only the X. */
  offline?: boolean;
  visible: boolean;
  /** The X, or a tap outside: stops the lookup and the download. */
  onCancel: () => void;
}>;

/**
 * Shown from the tap on a children's lesson until it opens (#529): the lookup,
 * then the PDF's download, which can take a minute on a phone connection.
 */
export function ChildrenLessonDialog({ offline = false, onCancel, progress, title, visible }: ChildrenLessonDialogProps) {
  const { language } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const status = getChildrenLessonStatus(progress, language);

  return (
    <Portal>
      <Dialog
        testID="children-lesson-dialog"
        visible={visible}
        onDismiss={onCancel}
        style={[styles.dialog, { maxHeight: popupMaxHeight }, getPopupSurfaceStyle(theme)]}
      >
        <PopupHeader closeLabel={labels.close} onClose={onCancel} style={styles.header} title={title} />
        <Dialog.Content style={styles.content}>
          {offline ? (
            <Text accessibilityLiveRegion="polite" variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
              {labels.offline}
            </Text>
          ) : (
            <>
              <Text accessibilityLiveRegion="polite" variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                {status.text}
              </Text>
              <ProgressBar
                accessibilityLabel={status.text}
                color={theme.colors.primary}
                indeterminate={status.fraction === null}
                progress={status.fraction ?? 0}
                style={styles.progress}
              />
              <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                {labels.note}
              </Text>
            </>
          )}
        </Dialog.Content>
      </Dialog>
    </Portal>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16, paddingBottom: 24 },
  dialog: { alignSelf: 'center', maxWidth: 560, width: '90%' },
  // As in the other popups: with the X's 48-point row, 16 keeps the title where
  // Paper's own title sits.
  header: { marginBottom: 8, marginTop: 16, paddingLeft: 24, paddingRight: 12 },
  progress: { borderRadius: 2, height: 4 },
});
