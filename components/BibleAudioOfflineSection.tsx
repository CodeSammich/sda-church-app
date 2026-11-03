import { AppIcon } from '@/components/AppIcon';
import type { TextScale } from '@/constants/AppPreferences';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useBibleAudioDownloads } from '@/hooks/useBibleAudioDownloads';
import {
  getBibleAudioScopeStatus,
  getDownloadableBibleAudioNarrator,
  isDownloadingBibleAudio,
} from '@/services/BibleAudioDownloads';
import { useContext } from 'react';
import { type StyleProp, type TextStyle, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Divider, Text } from 'react-native-paper';

const copy = {
  en: {
    listenOffline: 'Listen offline',
    bufferingTip: 'Playback often stops to load. Download to listen without waiting.',
    open: 'Offline Bible Audio',
    downloading: 'Downloading…',
    book: (book: string) => `${book} downloaded`,
    wholeBible: 'Whole Bible downloaded',
    books: (done: number, total: number) => `${done} of ${total} books downloaded`,
    partly: 'Partly downloaded',
    nothing: 'Download a book, a section, or the whole Bible',
  },
  zh: {
    listenOffline: '離線收聽',
    bufferingTip: '播放時常停下來載入。下載後即可收聽，不必等待。',
    open: '離線聖經音訊',
    downloading: '下載中…',
    book: (book: string) => `已下載${book}`,
    wholeBible: '已下載整本聖經',
    books: (done: number, total: number) => `已下載 ${done} / ${total} 卷`,
    partly: '已下載部分',
    nothing: '下載一卷書、一個部分或整本聖經',
  },
  'zh-cn': {
    listenOffline: '离线收听',
    bufferingTip: '播放时常停下来加载。下载后即可收听，不必等待。',
    open: '离线圣经音频',
    downloading: '下载中…',
    book: (book: string) => `已下载${book}`,
    wholeBible: '已下载整本圣经',
    books: (done: number, total: number) => `已下载 ${done} / ${total} 卷`,
    partly: '已下载部分',
    nothing: '下载一卷书、一个部分或整本圣经',
  },
  es: {
    listenOffline: 'Escuchar sin conexión',
    bufferingTip: 'La reproducción se detiene a menudo para cargar. Descarga el audio para escucharlo sin esperar.',
    open: 'Audio bíblico sin conexión',
    downloading: 'Descargando…',
    book: (book: string) => `${book} descargado`,
    wholeBible: 'Toda la Biblia descargada',
    books: (done: number, total: number) => `${done} de ${total} libros descargados`,
    partly: 'Descargado en parte',
    nothing: 'Descarga un libro, una sección o toda la Biblia',
  },
} as const;

/** Why to download, when streaming keeps stopping to load (#595). */
export const getBibleAudioDownloadTipLine = (language: SupportedLanguage) =>
  (copy[language] || copy.en).bufferingTip;

/**
 * What the row says about a narrator's downloads: that some are downloading,
 * that the book being read is on the phone, or how much of the Bible is.
 */
export const getBibleAudioOfflineCaption = (
  narrator: string,
  book: Readonly<{ id: string; name: string }> | undefined,
  language: SupportedLanguage,
) => {
  const labels = copy[language] || copy.en;
  if (isDownloadingBibleAudio(narrator)) return labels.downloading;
  if (book) {
    const status = getBibleAudioScopeStatus(narrator, { kind: 'book', bookId: book.id });
    if (status.chapters > 0 && status.downloadedChapters >= status.chapters) return labels.book(book.name);
  }
  const bible = getBibleAudioScopeStatus(narrator, { kind: 'bible' });
  if (bible.downloadedBooks >= bible.books) return labels.wholeBible;
  if (bible.downloadedBooks > 0) return labels.books(bible.downloadedBooks, bible.books);
  return bible.downloadedChapters > 0 ? labels.partly : labels.nothing;
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
  /** Closes the popup and opens Offline Bible Audio at this narrator. */
  onOpen: (narrator: string) => void;
  /** Says why to download, when streaming keeps stopping to load (#595). */
  showsTip?: boolean;
}>;

/**
 * "Listen offline", in the Bible audio settings popup (#556): one row that
 * says what's on the phone for the narrator chosen above, and opens Offline
 * Bible Audio in the You tab, where Bible audio is downloaded and deleted.
 * Phones only, and only for narrators the app may download (see
 * services/BibleAudioDownloads.ts).
 */
export function BibleAudioOfflineSection({
  book,
  onOpen,
  reader,
  showsTip = false,
  styles,
  textScale,
  translationId,
}: BibleAudioOfflineSectionProps) {
  const { language } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();
  useBibleAudioDownloads();
  const narrator = getDownloadableBibleAudioNarrator(translationId, reader);
  if (!narrator) return null;
  const caption = getBibleAudioOfflineCaption(narrator, book, language);

  return (
    <View testID="bible-audio-offline">
      <Divider style={styles.divider} />
      <Text variant="titleMedium" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
        {labels.listenOffline}
      </Text>
      {showsTip && (
        <Text variant="bodyMedium" style={[styles.helper, { color: theme.colors.primary, paddingBottom: 8 }]}>
          {labels.bufferingTip}
        </Text>
      )}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${labels.open}, ${caption}`}
        onPress={() => onOpen(narrator)}
        style={[styles.row, { flexDirection: 'row', alignItems: 'center', gap: 12 }]}
      >
        <AppIcon pointerEvents="none" name="download-circle-outline" size={24} textScale={textScale} color={theme.colors.onSurface} />
        <View style={styles.rowLabel}>
          <Text style={[styles.rowTitle, { color: theme.colors.onSurface }]}>{labels.open}</Text>
          <Text style={[styles.rowCaption, { color: theme.colors.onSurfaceVariant }]}>{caption}</Text>
        </View>
        <AppIcon pointerEvents="none" name="chevron-right" size={24} textScale={textScale} color={theme.colors.onSurfaceVariant} />
      </TouchableOpacity>
    </View>
  );
}
