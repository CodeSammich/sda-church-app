import { AppIcon } from '@/components/AppIcon';
import { PopupHeader } from '@/components/PopupHeader';
import { PopupScrollView } from '@/components/PopupScrollView';
import { getBibleAudioNarratorName } from '@/constants/BibleAudioNarrators';
import {
  BIBLE_SECTIONS,
  BIBLE_TESTAMENT_NAMES,
  getBibleSectionOfBook,
  type BibleTestament,
} from '@/constants/BibleSections';
import { formatDownloadSize, getDownloadProgressStatus } from '@/constants/DownloadCopy';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useBibleAudioDownloads } from '@/hooks/useBibleAudioDownloads';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { BIBLE_AUDIO_READERS_STORAGE_KEY, getAudioReaderPreferenceKey } from '@/services/BibleAudioSources';
import {
  BIBLE_AUDIO_DOWNLOAD_NARRATORS,
  deleteBibleAudio,
  downloadBibleAudio,
  getBibleAudioScopeStatus,
  getDownloadableBibleAudioNarrator,
  getDownloadedBibleAudioBytes,
  hasRoomForBibleAudio,
  stopBibleAudioDownload,
  type BibleAudioDownloadScope,
  type BibleAudioScopeStatus,
} from '@/services/BibleAudioDownloads';
import { BIBLE_BOOK_NAMES, BIBLE_TRANSLATION_STORAGE_KEY, DEFAULT_TRANSLATION_MAP } from '@/services/BibleService';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { getPopupSurfaceStyle, usePopupMaxHeight, usePopupWidthStyle } from '@/styles/PopupStyles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { useLocalSearchParams } from 'expo-router';
import { useContext, useEffect, useRef, useState, type ComponentRef, type ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Dialog, IconButton, Portal, ProgressBar, RadioButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const copy = {
  en: {
    title: 'Offline Bible Audio',
    intro:
      'Download Bible audio to listen with no connection. It stays on this phone until you delete it, and isn’t in its backup.',
    narrator: 'Narrator',
    change: 'Change',
    changeNarrator: (name: string) => `Narrator: ${name}. Change`,
    close: 'Close',
    wholeBible: 'Whole Bible',
    wholeBibleInSentence: 'the whole Bible',
    otherNarrators: 'Other narrators',
    books: (count: number, size: string) => `${count} books · ${size}`,
    downloaded: (size: string) => `Downloaded · ${size}`,
    someBooks: (done: number, total: number, more: string) => `${done} of ${total} books downloaded · ${more} more`,
    partly: (more: string) => `Partly downloaded · ${more} more`,
    nothing: 'Nothing downloaded',
    queued: (size: string) => `Waiting to download · ${size}`,
    progress: (done: string, total: string) => `${done} of ${total}`,
    waitingForWifi: 'Waiting for Wi-Fi',
    waitingForConnection: 'Waiting for a connection',
    download: (what: string, size: string) => `Download ${what}, ${size}`,
    stop: (what: string) => `Stop downloading ${what}`,
    delete: (what: string) => `Delete ${what}`,
    deleteAll: (narrator: string) => `Delete all downloads for ${narrator}`,
    expand: (what: string) => `Show the books in ${what}`,
    question: (action: string, size: string) => `${action}? (${size})`,
    deleteMessage: 'You can download it again later.',
    confirmDelete: 'Delete',
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
    title: '離線聖經音訊',
    intro: '下載聖經音訊，在沒有網路時收聽。它會保留在這部手機上，直到您刪除，也不會包含在手機的備份中。',
    narrator: '朗讀者',
    change: '更改',
    changeNarrator: (name: string) => `朗讀者：${name}。更改`,
    close: '關閉',
    wholeBible: '整本聖經',
    wholeBibleInSentence: '整本聖經',
    otherNarrators: '其他朗讀者',
    books: (count: number, size: string) => `${count} 卷 · ${size}`,
    downloaded: (size: string) => `已下載 · ${size}`,
    someBooks: (done: number, total: number, more: string) => `已下載 ${done} / ${total} 卷 · 尚餘 ${more}`,
    partly: (more: string) => `已下載部分 · 尚餘 ${more}`,
    nothing: '尚未下載',
    queued: (size: string) => `等待下載 · ${size}`,
    progress: (done: string, total: string) => `${done} / ${total}`,
    waitingForWifi: '等待 Wi-Fi',
    waitingForConnection: '等待網路連線',
    download: (what: string, size: string) => `下載${what}，${size}`,
    stop: (what: string) => `停止下載${what}`,
    delete: (what: string) => `刪除${what}`,
    deleteAll: (narrator: string) => `刪除${narrator}的所有下載`,
    expand: (what: string) => `顯示${what}的書卷`,
    question: (action: string, size: string) => `${action}？（${size}）`,
    deleteMessage: '之後可以再次下載。',
    confirmDelete: '刪除',
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
    title: '离线圣经音频',
    intro: '下载圣经音频，在没有网络时收听。它会保留在这部手机上，直到您删除，也不会包含在手机的备份中。',
    narrator: '朗读者',
    change: '更改',
    changeNarrator: (name: string) => `朗读者：${name}。更改`,
    close: '关闭',
    wholeBible: '整本圣经',
    wholeBibleInSentence: '整本圣经',
    otherNarrators: '其他朗读者',
    books: (count: number, size: string) => `${count} 卷 · ${size}`,
    downloaded: (size: string) => `已下载 · ${size}`,
    someBooks: (done: number, total: number, more: string) => `已下载 ${done} / ${total} 卷 · 还剩 ${more}`,
    partly: (more: string) => `已下载部分 · 还剩 ${more}`,
    nothing: '尚未下载',
    queued: (size: string) => `等待下载 · ${size}`,
    progress: (done: string, total: string) => `${done} / ${total}`,
    waitingForWifi: '等待 Wi-Fi',
    waitingForConnection: '等待网络连接',
    download: (what: string, size: string) => `下载${what}，${size}`,
    stop: (what: string) => `停止下载${what}`,
    delete: (what: string) => `删除${what}`,
    deleteAll: (narrator: string) => `删除${narrator}的所有下载`,
    expand: (what: string) => `显示${what}的书卷`,
    question: (action: string, size: string) => `${action}？（${size}）`,
    deleteMessage: '之后可以再次下载。',
    confirmDelete: '删除',
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
    title: 'Audio bíblico sin conexión',
    intro:
      'Descarga el audio de la Biblia para escucharlo sin conexión. Se queda en este teléfono hasta que lo borres, y no está en su copia de seguridad.',
    narrator: 'Narrador',
    change: 'Cambiar',
    changeNarrator: (name: string) => `Narrador: ${name}. Cambiar`,
    close: 'Cerrar',
    wholeBible: 'Toda la Biblia',
    wholeBibleInSentence: 'toda la Biblia',
    otherNarrators: 'Otros narradores',
    books: (count: number, size: string) => `${count} libros · ${size}`,
    downloaded: (size: string) => `Descargado · ${size}`,
    someBooks: (done: number, total: number, more: string) => `${done} de ${total} libros descargados · faltan ${more}`,
    partly: (more: string) => `Descargado en parte · faltan ${more}`,
    nothing: 'Nada descargado',
    queued: (size: string) => `En espera de descarga · ${size}`,
    progress: (done: string, total: string) => `${done} de ${total}`,
    waitingForWifi: 'Esperando Wi-Fi',
    waitingForConnection: 'Esperando conexión',
    download: (what: string, size: string) => `Descargar ${what}, ${size}`,
    stop: (what: string) => `Dejar de descargar ${what}`,
    delete: (what: string) => `Borrar ${what}`,
    deleteAll: (narrator: string) => `Borrar todas las descargas de ${narrator}`,
    expand: (what: string) => `Mostrar los libros de ${what}`,
    question: (action: string, size: string) => `¿${action}? (${size})`,
    deleteMessage: 'Puedes volver a descargarlo más tarde.',
    confirmDelete: 'Borrar',
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
// Bible or Old Testament, and some English New Testaments and sections, but
// nothing in Chinese or Spanish (#556).
export const BIBLE_AUDIO_CONFIRM_BYTES = 1_000_000_000;

const BIBLE: BibleAudioDownloadScope = { kind: 'bible' };
const TESTAMENTS: readonly BibleTestament[] = ['old', 'new'];

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
    // Its turn hasn't come: three chapters download at a time.
    if (!status.active) return { text: labels.queued(size(Math.max(0, total - status.downloadedBytes))), fraction: null };
    return getDownloadProgressStatus({ bytesWritten: status.downloadedBytes, totalBytes: total }, language);
  }
  if (isComplete(status)) return { text: labels.downloaded(size(status.downloadedBytes)), fraction: null };
  const more = size(Math.max(0, status.totalBytes - status.downloadedBytes));
  if (status.downloadedBooks > 0 && status.books > 1) {
    return { text: labels.someBooks(status.downloadedBooks, status.books, more), fraction: null };
  }
  if (status.downloadedChapters > 0) return { text: labels.partly(more), fraction: null };
  return { text: status.books > 1 ? labels.books(status.books, size(status.totalBytes)) : size(status.totalBytes), fraction: null };
};

/** The narrator the Bible plays now, for the translation and narrator saved there. */
const loadReaderNarrator = async (language: SupportedLanguage) => {
  try {
    const [translationId, savedReaders] = await Promise.all([
      AsyncStorage.getItem(BIBLE_TRANSLATION_STORAGE_KEY),
      AsyncStorage.getItem(BIBLE_AUDIO_READERS_STORAGE_KEY),
    ]);
    const translation = translationId || DEFAULT_TRANSLATION_MAP[language];
    const readers = savedReaders ? JSON.parse(savedReaders) : {};
    const reader = readers?.[getAudioReaderPreferenceKey(translation)] ?? readers?.[translation];
    return typeof reader === 'string' ? getDownloadableBibleAudioNarrator(translation, reader) : null;
  } catch {
    return null;
  }
};

// The narrator a language's Bible plays first, when the Bible has saved none.
const DEFAULT_NARRATORS: Readonly<Record<SupportedLanguage, string>> = {
  en: 'souer',
  zh: 'cuv-mandarin',
  'zh-cn': 'cuv-mandarin',
  es: 'rv1909',
};

const narratorTotal = (narrator: string) => getDownloadedBibleAudioBytes(narrator, BIBLE);

type RowProps = Readonly<{
  narrator: string;
  scope: BibleAudioDownloadScope;
  title: string;
  /** The scope's name in a sentence: "Download the Gospels". */
  what: string;
  kind: 'bible' | 'testament' | 'section' | 'book';
  /** For a section's row: whether its books show. */
  expanded?: boolean;
  onToggle?: () => void;
  onDownload: () => void;
  onDelete: () => void;
}>;

/** One row of the tree: its title, what it holds, and what can be done with it. */
function ScopeRow({ expanded, kind, narrator, onDelete, onDownload, onToggle, scope, title, what }: RowProps) {
  const { language } = useContext(LanguageContext);
  const labels: Labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const status = getBibleAudioScopeStatus(narrator, scope);
  const caption = getBibleAudioScopeCaption(status, language);
  const complete = isComplete(status);
  const remaining = formatDownloadSize(Math.max(0, status.totalBytes - status.downloadedBytes), language);
  // While it waits for Wi-Fi, download again offers mobile data.
  const canDownload = !complete && (!status.downloading || status.waitingFor === 'wifi');
  const canDelete = status.downloadedChapters > 0 && !status.downloading;
  const header = kind === 'bible' || kind === 'testament';
  const iconColor = theme.colors.onSurfaceVariant;

  const label: ReactNode = (
    <>
      <Text
        variant={header ? 'titleMedium' : 'bodyLarge'}
        style={[{ color: theme.colors.onSurface }, kind !== 'book' && styles.groupTitle]}
      >
        {title}
      </Text>
      <Text
        accessibilityLiveRegion={status.downloading ? 'polite' : 'none'}
        variant="bodySmall"
        style={{ color: complete ? theme.colors.primary : theme.colors.onSurfaceVariant }}
      >
        {caption.text}
      </Text>
      {status.downloading && (status.active || !!status.waitingFor) && (
        <ProgressBar
          color={theme.colors.primary}
          indeterminate={caption.fraction === null}
          progress={caption.fraction ?? 0}
          style={styles.progress}
        />
      )}
    </>
  );

  return (
    <View
      style={[
        styles.row,
        kind === 'book' && styles.bookRow,
        header && [styles.headerRow, { borderBottomColor: theme.colors.outlineVariant }],
      ]}
    >
      {onToggle ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${caption.text}`}
          accessibilityHint={labels.expand(what)}
          accessibilityState={{ expanded: !!expanded }}
          onPress={onToggle}
          style={({ pressed }) => [styles.label, styles.toggle, { opacity: pressed ? 0.7 : 1 }]}
        >
          <AppIcon name={expanded ? 'chevron-down' : 'chevron-right'} size={22} color={iconColor} />
          <View style={styles.label}>{label}</View>
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${title}, ${caption.text}`} style={[styles.label, !header && styles.toggle]}>
          {/* An unseen chevron, so a book's title lines up with a section's. */}
          {!header && (
            <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.hidden}>
              <AppIcon name="chevron-right" size={22} color={iconColor} />
            </View>
          )}
          <View style={styles.label}>{label}</View>
        </View>
      )}
      {canDownload && (
        <IconButton
          accessibilityLabel={labels.download(what, remaining)}
          icon="download"
          iconColor={theme.colors.primary}
          onPress={onDownload}
        />
      )}
      {status.downloading && (
        <IconButton
          accessibilityLabel={labels.stop(what)}
          icon="close"
          iconColor={iconColor}
          onPress={() => stopBibleAudioDownload(narrator, scope)}
        />
      )}
      {canDelete && (
        <IconButton
          accessibilityLabel={
            scope.kind === 'bible' && !complete
              ? labels.deleteAll(getBibleAudioNarratorName(narrator, language) ?? narrator)
              : labels.delete(what)
          }
          icon="delete-outline"
          iconColor={iconColor}
          onPress={onDelete}
        />
      )}
    </View>
  );
}

type NarratorDialogProps = Readonly<{
  narrator: string;
  visible: boolean;
  onChoose: (narrator: string) => void;
  onDismiss: () => void;
}>;

/** The narrators a member can download, each with what's on the phone. */
function NarratorDialog({ narrator, onChoose, onDismiss, visible }: NarratorDialogProps) {
  const { language } = useContext(LanguageContext);
  const labels: Labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const popupMaxHeight = usePopupMaxHeight();
  const popupWidthStyle = usePopupWidthStyle();
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
          style={styles.dialogHeader}
          title={labels.narrator}
          variant="headlineSmall"
        />
        <Dialog.ScrollArea style={styles.dialogScrollArea}>
          <PopupScrollView contentContainerStyle={styles.dialogContent}>
            <View accessibilityRole="radiogroup" style={styles.options}>
              {BIBLE_AUDIO_DOWNLOAD_NARRATORS.map((option) => {
                const selected = option === narrator;
                const name = getBibleAudioNarratorName(option, language) ?? option;
                const total = narratorTotal(option);
                const caption = total ? labels.downloaded(formatDownloadSize(total, language)) : labels.nothing;
                return (
                  <Pressable
                    key={option}
                    accessibilityLabel={`${name}, ${caption}`}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    onPress={() => onChoose(option)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: selected ? theme.colors.primaryContainer : theme.colors.surfaceVariant,
                        borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                        opacity: pressed ? 0.78 : 1,
                      },
                    ]}
                  >
                    <View style={styles.label}>
                      <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                        {name}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {caption}
                      </Text>
                    </View>
                    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" pointerEvents="none">
                      <RadioButton.Android
                        value={option}
                        status={selected ? 'checked' : 'unchecked'}
                        color={theme.colors.primary}
                        uncheckedColor={theme.colors.onSurfaceVariant}
                      />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </PopupScrollView>
        </Dialog.ScrollArea>
      </Dialog>
    </Portal>
  );
}

/** The page's title, in the header. */
export const getOfflineBibleAudioTitle = (language: SupportedLanguage) => (copy[language] || copy.en).title;

const firstParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * Offline Bible Audio, in the You tab (#556): the one place to download Bible
 * audio for listening offline and to delete it, for one narrator at a time.
 * The whole Bible, each Testament, each section (constants/BibleSections.ts),
 * and each book can be downloaded, stopped, or deleted. Sections show their
 * books when tapped. The Bible's audio settings open it at the narrator
 * playing there, with the book being read showing.
 */
export function OfflineBibleAudio() {
  const { language } = useContext(LanguageContext);
  const labels: Labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const params = useLocalSearchParams();
  const narratorParam = firstParam(params.narrator);
  const bookParam = firstParam(params.bookId);
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight();
  useBibleAudioDownloads();
  const [narrator, setNarrator] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [choosingNarrator, setChoosingNarrator] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  // The book being read, from the Bible: the page scrolls to its row once.
  const contentRef = useRef<ComponentRef<typeof View>>(null);
  const bookRowRef = useRef<ComponentRef<typeof View>>(null);
  const scrolledToBook = useRef<string | null>(null);
  // Where to scroll, until it has. Android ignores a scroll while the page
  // slides in, so it's tried again as the page and its content settle.
  const pendingScroll = useRef<number | null>(null);
  const scrollToPending = () => {
    if (pendingScroll.current !== null) scrollRef.current?.scrollTo({ y: pendingScroll.current, animated: false });
  };
  const scrollToBook = () => {
    const book = bookRowRef.current;
    const content = contentRef.current;
    if (!bookParam || scrolledToBook.current === bookParam || !book || !content) return;
    scrolledToBook.current = bookParam;
    book.measureLayout(
      content,
      (_x, y) => {
        // The content starts 20 points below the header: this leaves about a
        // row's height above the book.
        pendingScroll.current = Math.max(0, y + 20 - 64);
        scrollToPending();
        setTimeout(() => {
          scrollToPending();
          pendingScroll.current = null;
        }, 500);
      },
      () => undefined,
    );
  };
  useEffect(() => {
    if (!narrator) return;
    const frame = requestAnimationFrame(scrollToBook);
    return () => cancelAnimationFrame(frame);
  });

  useEffect(() => {
    let cancelled = false;
    if (narratorParam && BIBLE_AUDIO_DOWNLOAD_NARRATORS.includes(narratorParam)) {
      setNarrator(narratorParam);
    } else {
      void loadReaderNarrator(language).then((saved) => {
        if (cancelled) return;
        setNarrator(
          (current) =>
            current ??
            saved ??
            BIBLE_AUDIO_DOWNLOAD_NARRATORS.find((option) => narratorTotal(option) > 0) ??
            DEFAULT_NARRATORS[language],
        );
      });
    }
    const section = bookParam ? getBibleSectionOfBook(bookParam) : undefined;
    if (section && section.books.length > 1) setExpanded(new Set([section.id]));
    scrolledToBook.current = null;
    return () => {
      cancelled = true;
    };
    // The language only picks a first default.
  }, [narratorParam, bookParam]);

  const name = (option: string) => getBibleAudioNarratorName(option, language) ?? option;

  const start = async (option: string, scope: BibleAudioDownloadScope) => {
    const status = getBibleAudioScopeStatus(option, scope);
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
        downloadBibleAudio(option, scope, { mobileData });
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

  // "Delete the Gospels? (210 MB)", or for the whole Bible when only some is
  // on the phone, "Delete all downloads for English – Souer (BSB)? (1.20 GB)".
  const confirmDelete = (option: string, scope: BibleAudioDownloadScope, what: string) => {
    const action =
      scope.kind === 'bible' && !isComplete(getBibleAudioScopeStatus(option, scope))
        ? labels.deleteAll(name(option))
        : labels.delete(what);
    const size = formatDownloadSize(getDownloadedBibleAudioBytes(option, scope), language);
    Alert.alert(labels.question(action, size), labels.deleteMessage, [
      { text: labels.cancel, style: 'cancel' },
      { text: labels.confirmDelete, style: 'destructive', onPress: () => deleteBibleAudio(option, scope) },
    ]);
  };

  const row = (props: Omit<RowProps, 'narrator' | 'onDownload' | 'onDelete'> & { narrator: string }) => (
    <ScopeRow
      key={JSON.stringify(props.scope)}
      {...props}
      onDownload={() => void start(props.narrator, props.scope)}
      onDelete={() => confirmDelete(props.narrator, props.scope, props.what)}
    />
  );

  const bookName = (bookId: string) => BIBLE_BOOK_NAMES[bookId]?.[language] ?? bookId;
  const others = narrator
    ? BIBLE_AUDIO_DOWNLOAD_NARRATORS.filter((option) => option !== narrator && narratorTotal(option) > 0)
    : [];

  return (
    <ScrollView
      ref={scrollRef}
      onContentSizeChange={scrollToPending}
      onLayout={scrollToPending}
      onScrollBeginDrag={() => (pendingScroll.current = null)}
      testID="offline-bible-audio"
      style={[NavigationStyles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        NavigationStyles.contentContainer,
        { paddingTop: headerHeight + 20, paddingBottom: insets.bottom + 80 },
      ]}
    >
      <View ref={contentRef} collapsable={false}>
        <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
          {labels.title}
        </Text>
        <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurfaceVariant }]}>
          {labels.intro}
        </Text>
        {narrator && (
          <>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={labels.changeNarrator(name(narrator))}
              onPress={() => setChoosingNarrator(true)}
              style={({ pressed }) => [
                styles.narrator,
                { backgroundColor: theme.colors.surfaceVariant, opacity: pressed ? 0.78 : 1 },
              ]}
            >
              <View style={styles.label}>
                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                  {labels.narrator}
                </Text>
                <Text variant="titleMedium" style={{ color: theme.colors.onSurface }}>
                  {name(narrator)}
                </Text>
              </View>
              <Text variant="labelLarge" style={{ color: theme.colors.primary }}>
                {labels.change}
              </Text>
            </Pressable>

            {row({ narrator, scope: BIBLE, kind: 'bible', title: labels.wholeBible, what: labels.wholeBibleInSentence })}
            {TESTAMENTS.map((testament) => {
              const names = BIBLE_TESTAMENT_NAMES[testament];
              return (
                <View key={testament} style={styles.testament}>
                  {row({
                    narrator,
                    scope: { kind: 'testament', testament },
                    kind: 'testament',
                    title: names.name[language],
                    what: names.inSentence[language] ?? names.name[language],
                  })}
                  {BIBLE_SECTIONS.filter((section) => section.testament === testament).map((section) => {
                    // A section of one book, as Acts, is just the book.
                    if (section.books.length === 1) {
                      const bookId = section.books[0];
                      return (
                        <View key={bookId} ref={bookId === bookParam ? bookRowRef : undefined} collapsable={false}>
                          {row({
                            narrator,
                            scope: { kind: 'book', bookId },
                            kind: 'section',
                            title: bookName(bookId),
                            what: bookName(bookId),
                          })}
                        </View>
                      );
                    }
                    const open = expanded.has(section.id);
                    return (
                      <View key={section.id}>
                        {row({
                          narrator,
                          scope: { kind: 'section', sectionId: section.id },
                          kind: 'section',
                          title: section.name[language],
                          what: section.inSentence?.[language] ?? section.name[language],
                          expanded: open,
                          onToggle: () =>
                            setExpanded((current) => {
                              const next = new Set(current);
                              if (open) next.delete(section.id);
                              else next.add(section.id);
                              return next;
                            }),
                        })}
                        {open &&
                          section.books.map((bookId) => (
                            <View
                              key={bookId}
                              ref={bookId === bookParam ? bookRowRef : undefined}
                              collapsable={false}
                              onLayout={bookId === bookParam ? scrollToBook : undefined}
                            >
                              {row({
                                narrator,
                                scope: { kind: 'book', bookId },
                                kind: 'book',
                                title: bookName(bookId),
                                what: bookName(bookId),
                              })}
                            </View>
                          ))}
                      </View>
                    );
                  })}
                </View>
              );
            })}

            {others.length > 0 && (
              <View style={styles.testament}>
                <Text
                  variant="titleMedium"
                  style={[styles.groupTitle, styles.headerRow, { color: theme.colors.onSurface, borderBottomColor: theme.colors.outlineVariant }]}
                >
                  {labels.otherNarrators}
                </Text>
                {others.map((option) => (
                  <View key={option} style={styles.row}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`${name(option)}, ${labels.downloaded(formatDownloadSize(narratorTotal(option), language))}`}
                      onPress={() => setNarrator(option)}
                      style={({ pressed }) => [styles.label, { opacity: pressed ? 0.7 : 1 }]}
                    >
                      <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                        {name(option)}
                      </Text>
                      <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                        {labels.downloaded(formatDownloadSize(narratorTotal(option), language))}
                      </Text>
                    </Pressable>
                    <IconButton
                      accessibilityLabel={labels.deleteAll(name(option))}
                      icon="delete-outline"
                      iconColor={theme.colors.onSurfaceVariant}
                      onPress={() => {
                        const size = formatDownloadSize(narratorTotal(option), language);
                        Alert.alert(labels.question(labels.deleteAll(name(option)), size), labels.deleteMessage, [
                          { text: labels.cancel, style: 'cancel' },
                          { text: labels.confirmDelete, style: 'destructive', onPress: () => deleteBibleAudio(option, BIBLE) },
                        ]);
                      }}
                    />
                  </View>
                ))}
              </View>
            )}

            <NarratorDialog
              narrator={narrator}
              visible={choosingNarrator}
              onDismiss={() => setChoosingNarrator(false)}
              onChoose={(option) => {
                setNarrator(option);
                setChoosingNarrator(false);
              }}
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: 'bold', marginBottom: 15 },
  paragraph: { marginBottom: 16 },
  narrator: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  testament: { marginTop: 16 },
  row: { alignItems: 'center', flexDirection: 'row', minHeight: 56 },
  headerRow: { borderBottomWidth: StyleSheet.hairlineWidth * 2, marginBottom: 4, paddingVertical: 4 },
  // A section's books sit a step in from its title.
  bookRow: { paddingLeft: 20 },
  label: { flex: 1, flexShrink: 1, minWidth: 0 },
  toggle: { alignItems: 'center', flexDirection: 'row', gap: 12 },
  hidden: { opacity: 0 },
  groupTitle: { fontWeight: 'bold' },
  progress: { borderRadius: 2, height: 4, marginTop: 6 },
  dialogHeader: { marginBottom: 8, marginTop: 16, paddingLeft: 24, paddingRight: 12 },
  dialogScrollArea: { borderBottomWidth: 0, marginBottom: 0, paddingHorizontal: 0 },
  dialogContent: { paddingBottom: 24, paddingHorizontal: 24, paddingTop: 4 },
  options: { gap: 10 },
  option: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
