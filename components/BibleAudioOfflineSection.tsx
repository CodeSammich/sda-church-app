import { AppIcon } from '@/components/AppIcon';
import type { TextScale } from '@/constants/AppPreferences';
import { formatDownloadSize, getDownloadProgressStatus } from '@/constants/DownloadCopy';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useBibleAudioDownloads } from '@/hooks/useBibleAudioDownloads';
import {
  downloadBibleAudio,
  getBibleAudioScopeStatus,
  getDownloadableBibleAudioNarrator,
  hasRoomForBibleAudio,
  stopBibleAudioDownload,
  type BibleAudioDownloadScope,
  type BibleAudioScopeStatus,
} from '@/services/BibleAudioDownloads';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { useContext } from 'react';
import {
  Alert,
  type StyleProp,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Divider, IconButton, ProgressBar, Text } from 'react-native-paper';

const copy = {
  en: {
    listenOffline: 'Listen offline',
    newTestament: 'New Testament',
    wholeBible: 'Whole Bible',
    note: 'Downloads stay on this phone until you delete them, in the You tab.',
    onPhone: (size: string) => `On this phone · ${size}`,
    partly: (done: number, total: number, more: string) =>
      `${done} of ${total} chapters on this phone · ${more} more`,
    progress: (done: string, total: string) => `${done} of ${total}`,
    waitingForWifi: 'Waiting for Wi-Fi',
    waitingForConnection: 'Waiting for a connection',
    download: (title: string) => `Download ${title}`,
    stop: (title: string) => `Stop downloading ${title}`,
    mobileDataTitle: 'Use mobile data?',
    mobileData: (size: string) => `You’re on mobile data. This download is ${size}.`,
    waitForWifi: 'Wait for Wi-Fi',
    useMobileData: 'Use mobile data',
    bigTitle: (size: string) => `Download ${size}?`,
    big: 'It takes a while, and stays on this phone until you delete it.',
    confirmDownload: 'Download',
    cancel: 'Cancel',
    noRoomTitle: 'Not enough space',
    noRoom: (size: string) => `This download needs ${size}. Free up space on this phone, then try again.`,
    offlineTitle: 'No connection',
    offline: 'Connect to the internet to download.',
    errorTitle: 'Couldn’t download',
    backupError: 'This phone couldn’t keep the download out of its backup.',
  },
  zh: {
    listenOffline: '離線收聽',
    newTestament: '新約',
    wholeBible: '整本聖經',
    note: '下載的內容會保留在這部手機上，直到您在「您」分頁中刪除。',
    onPhone: (size: string) => `已下載 · ${size}`,
    partly: (done: number, total: number, more: string) =>
      `已下載 ${done} / ${total} 章 · 尚餘 ${more}`,
    progress: (done: string, total: string) => `${done} / ${total}`,
    waitingForWifi: '等待 Wi-Fi',
    waitingForConnection: '等待網路連線',
    download: (title: string) => `下載${title}`,
    stop: (title: string) => `停止下載${title}`,
    mobileDataTitle: '使用行動數據？',
    mobileData: (size: string) => `您正在使用行動數據。這次下載共 ${size}。`,
    waitForWifi: '等待 Wi-Fi',
    useMobileData: '使用行動數據',
    bigTitle: (size: string) => `下載 ${size}？`,
    big: '需要一段時間，並會保留在這部手機上，直到您刪除。',
    confirmDownload: '下載',
    cancel: '取消',
    noRoomTitle: '空間不足',
    noRoom: (size: string) => `這次下載需要 ${size}。請先清出手機空間，再試一次。`,
    offlineTitle: '沒有網路連線',
    offline: '請連上網路以下載。',
    errorTitle: '無法下載',
    backupError: '這部手機無法將下載內容排除在備份之外。',
  },
  'zh-cn': {
    listenOffline: '离线收听',
    newTestament: '新约',
    wholeBible: '整本圣经',
    note: '下载的内容会保留在这部手机上，直到您在“您”页面中删除。',
    onPhone: (size: string) => `已下载 · ${size}`,
    partly: (done: number, total: number, more: string) =>
      `已下载 ${done} / ${total} 章 · 还剩 ${more}`,
    progress: (done: string, total: string) => `${done} / ${total}`,
    waitingForWifi: '等待 Wi-Fi',
    waitingForConnection: '等待网络连接',
    download: (title: string) => `下载${title}`,
    stop: (title: string) => `停止下载${title}`,
    mobileDataTitle: '使用移动数据？',
    mobileData: (size: string) => `您正在使用移动数据。这次下载共 ${size}。`,
    waitForWifi: '等待 Wi-Fi',
    useMobileData: '使用移动数据',
    bigTitle: (size: string) => `下载 ${size}？`,
    big: '需要一段时间，并会保留在这部手机上，直到您删除。',
    confirmDownload: '下载',
    cancel: '取消',
    noRoomTitle: '空间不足',
    noRoom: (size: string) => `这次下载需要 ${size}。请先清理手机空间，再试一次。`,
    offlineTitle: '没有网络连接',
    offline: '请连接网络以下载。',
    errorTitle: '无法下载',
    backupError: '这部手机无法将下载内容排除在备份之外。',
  },
  es: {
    listenOffline: 'Escuchar sin conexión',
    newTestament: 'Nuevo Testamento',
    wholeBible: 'Toda la Biblia',
    note: 'Las descargas se quedan en este teléfono hasta que las borres, en la pestaña Tú.',
    onPhone: (size: string) => `En este teléfono · ${size}`,
    partly: (done: number, total: number, more: string) =>
      `${done} de ${total} capítulos en este teléfono · faltan ${more}`,
    progress: (done: string, total: string) => `${done} de ${total}`,
    waitingForWifi: 'Esperando Wi-Fi',
    waitingForConnection: 'Esperando conexión',
    download: (title: string) => `Descargar ${title}`,
    stop: (title: string) => `Dejar de descargar ${title}`,
    mobileDataTitle: '¿Usar datos móviles?',
    mobileData: (size: string) => `Estás usando datos móviles. Esta descarga ocupa ${size}.`,
    waitForWifi: 'Esperar Wi-Fi',
    useMobileData: 'Usar datos móviles',
    bigTitle: (size: string) => `¿Descargar ${size}?`,
    big: 'Tarda un rato y se queda en este teléfono hasta que lo borres.',
    confirmDownload: 'Descargar',
    cancel: 'Cancelar',
    noRoomTitle: 'No hay espacio suficiente',
    noRoom: (size: string) =>
      `Esta descarga necesita ${size}. Libera espacio en este teléfono y vuelve a intentarlo.`,
    offlineTitle: 'Sin conexión',
    offline: 'Conéctate a internet para descargar.',
    errorTitle: 'No se pudo descargar',
    backupError: 'Este teléfono no pudo dejar la descarga fuera de su copia de seguridad.',
  },
} as const;

type Labels = (typeof copy)[keyof typeof copy];

// A download bigger than this asks first, even on Wi-Fi: an English whole
// Bible, or Hays' or David's New Testament, but nothing in Chinese or Spanish
// (#556).
export const BIBLE_AUDIO_CONFIRM_BYTES = 1_000_000_000;

const isComplete = (status: BibleAudioScopeStatus) =>
  status.chapters > 0 && status.downloadedChapters >= status.chapters;

/** What a row says under its title, and how far along its download is. */
export const getBibleAudioScopeCaption = (
  status: BibleAudioScopeStatus,
  language: SupportedLanguage,
): { text: string; fraction: number | null } => {
  const labels: Labels = copy[language] || copy.en;
  const size = (bytes: number) => formatDownloadSize(bytes, language);
  const total = Math.max(status.totalBytes, status.downloadedBytes);
  if (status.downloading) {
    const fraction = total > 0 ? Math.min(1, status.downloadedBytes / total) : null;
    if (status.waitingFor) {
      const waiting = status.waitingFor === 'wifi' ? labels.waitingForWifi : labels.waitingForConnection;
      return { text: `${waiting} · ${labels.progress(size(status.downloadedBytes), size(total))}`, fraction };
    }
    return getDownloadProgressStatus({ bytesWritten: status.downloadedBytes, totalBytes: total }, language);
  }
  if (isComplete(status)) return { text: labels.onPhone(size(status.downloadedBytes)), fraction: null };
  if (status.downloadedChapters > 0) {
    return {
      text: labels.partly(
        status.downloadedChapters,
        status.chapters,
        size(Math.max(0, status.totalBytes - status.downloadedBytes)),
      ),
      fraction: null,
    };
  }
  return { text: size(status.totalBytes), fraction: null };
};

export type BibleAudioOfflineSectionStyles = Readonly<{
  divider: StyleProp<ViewStyle>;
  sectionTitle: StyleProp<TextStyle>;
  helper: StyleProp<TextStyle>;
  row: StyleProp<ViewStyle>;
  rowLabel: StyleProp<ViewStyle>;
  rowTitle: StyleProp<TextStyle>;
  rowCaption: StyleProp<TextStyle>;
}>;

type BibleAudioOfflineSectionProps = Readonly<{
  translationId: string;
  /** The narrator chosen in the popup above. */
  reader?: string;
  /** The book being read, in the translation's own name. */
  book?: Readonly<{ id: string; name: string }>;
  textScale: TextScale;
  styles: BibleAudioOfflineSectionStyles;
}>;

/**
 * "Listen offline", in the Bible audio settings popup (#556): download the
 * book being read, the New Testament, or the whole Bible, for the narrator
 * chosen above, with each one's size, its progress, and an X that stops it.
 * Phones only, and only for narrators the app may download (see
 * services/BibleAudioDownloads.ts).
 *
 * A download goes on when the popup closes, so a long one needn't keep it
 * open; the You tab lists what's on the phone, and deletes it.
 */
export function BibleAudioOfflineSection({ book, reader, styles, textScale, translationId }: BibleAudioOfflineSectionProps) {
  const { language } = useContext(LanguageContext);
  const labels: Labels = copy[language] || copy.en;
  const theme = useAppTheme();
  useBibleAudioDownloads();
  const narrator = getDownloadableBibleAudioNarrator(translationId, reader);
  if (!narrator) return null;

  const rows: { key: string; title: string; scope: BibleAudioDownloadScope }[] = [
    ...(book ? [{ key: 'book', title: book.name, scope: { kind: 'book', bookId: book.id } as const }] : []),
    { key: 'new-testament', title: labels.newTestament, scope: { kind: 'new-testament' } },
    { key: 'bible', title: labels.wholeBible, scope: { kind: 'bible' } },
  ];

  const start = async (title: string, scope: BibleAudioDownloadScope) => {
    const status = getBibleAudioScopeStatus(narrator, scope);
    const remainingBytes = Math.max(0, status.totalBytes - status.downloadedBytes);
    const remaining = formatDownloadSize(remainingBytes, language);
    if (!hasRoomForBibleAudio(remainingBytes)) {
      Alert.alert(labels.noRoomTitle, labels.noRoom(remaining));
      return;
    }
    const network = await getNetworkStateAsync().catch(() => null);
    if (network && (network.isConnected === false || network.isInternetReachable === false)) {
      Alert.alert(labels.offlineTitle, labels.offline);
      return;
    }
    const begin = (mobileData: boolean) => {
      try {
        downloadBibleAudio(narrator, scope, { mobileData });
      } catch (error) {
        console.error('Bible audio download failed to start:', error);
        Alert.alert(labels.errorTitle, labels.backupError);
      }
    };
    if (network?.type !== NetworkStateType.CELLULAR) {
      if (remainingBytes > BIBLE_AUDIO_CONFIRM_BYTES) {
        Alert.alert(labels.bigTitle(remaining), labels.big, [
          { text: labels.cancel, style: 'cancel' },
          { text: labels.confirmDownload, onPress: () => begin(false) },
        ]);
        return;
      }
      begin(false);
      return;
    }
    Alert.alert(labels.mobileDataTitle, labels.mobileData(remaining), [
      { text: labels.cancel, style: 'cancel' },
      { text: labels.waitForWifi, onPress: () => begin(false) },
      { text: labels.useMobileData, onPress: () => begin(true) },
    ]);
  };

  return (
    <View testID="bible-audio-offline">
      <Divider style={styles.divider} />
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        {labels.listenOffline}
      </Text>
      {rows.map(({ key, title, scope }) => {
        const status = getBibleAudioScopeStatus(narrator, scope);
        const caption = getBibleAudioScopeCaption(status, language);
        const complete = isComplete(status);
        // While it waits for Wi-Fi, a tap offers mobile data instead.
        const canStart = !complete && (!status.downloading || status.waitingFor === 'wifi');
        return (
          <View key={key} style={styles.row}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel={`${canStart ? labels.download(title) : title}, ${caption.text}`}
              accessibilityState={{ disabled: !canStart }}
              disabled={!canStart}
              onPress={() => void start(title, scope)}
              style={[styles.rowLabel, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
            >
              <AppIcon
                pointerEvents="none"
                name={complete ? 'check-circle' : 'download'}
                size={24}
                textScale={textScale}
                color={complete || status.downloading ? theme.colors.primary : theme.colors.onSurface}
              />
              <View style={styles.rowLabel}>
                <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{title}</Text>
                <Text
                  accessibilityLiveRegion={status.downloading ? 'polite' : 'none'}
                  style={[styles.rowCaption, { color: theme.colors.onSurfaceVariant }]}
                >
                  {caption.text}
                </Text>
                {status.downloading && (
                  <ProgressBar
                    color={theme.colors.primary}
                    indeterminate={caption.fraction === null}
                    progress={caption.fraction ?? 0}
                    style={{ borderRadius: 2, height: 4, marginTop: 6 }}
                  />
                )}
              </View>
            </TouchableOpacity>
            {status.downloading && (
              <IconButton
                accessibilityLabel={labels.stop(title)}
                icon="close"
                onPress={() => stopBibleAudioDownload(narrator, scope)}
                style={{ margin: -8 }}
              />
            )}
          </View>
        );
      })}
      <Text variant="bodySmall" style={[styles.helper, { color: theme.colors.onSurfaceVariant }]}>
        {labels.note}
      </Text>
    </View>
  );
}
