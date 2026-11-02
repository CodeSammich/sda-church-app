import { formatDownloadSize } from '@/constants/DownloadCopy';
import { LanguageContext, type SupportedLanguage } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useBibleAudioDownloads } from '@/hooks/useBibleAudioDownloads';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import {
  deleteBibleAudioBook,
  getBibleAudioScopeStatus,
  listDownloadedBibleAudio,
} from '@/services/BibleAudioDownloads';
import { BIBLE_BOOK_NAMES } from '@/services/BibleService';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { IconButton, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Each narrator a member can download, as this list names it. */
const NARRATOR_NAMES: Readonly<Record<string, Readonly<Record<SupportedLanguage, string>>>> = {
  'cuv-mandarin': {
    en: 'Mandarin (Chinese Union Version)',
    zh: '國語（和合本）',
    'zh-cn': '国语（和合本）',
    es: 'Mandarín (Versión Unión China)',
  },
  'cuv-cantonese': {
    en: 'Cantonese (Chinese Union Version)',
    zh: '粵語（和合本）',
    'zh-cn': '粤语（和合本）',
    es: 'Cantonés (Versión Unión China)',
  },
  rv1909: {
    en: 'Spanish (Reina-Valera 1909)',
    zh: '西班牙語（Reina-Valera 1909）',
    'zh-cn': '西班牙语（Reina-Valera 1909）',
    es: 'Español (Reina-Valera 1909)',
  },
  souer: { en: 'Souer (BSB)', zh: 'Souer（英文 BSB）', 'zh-cn': 'Souer（英文 BSB）', es: 'Souer (BSB, inglés)' },
  hays: { en: 'Hays (BSB)', zh: 'Hays（英文 BSB）', 'zh-cn': 'Hays（英文 BSB）', es: 'Hays (BSB, inglés)' },
  david: { en: 'David (BSB)', zh: 'David（英文 BSB）', 'zh-cn': 'David（英文 BSB）', es: 'David (BSB, inglés)' },
};

const copy = {
  en: {
    title: 'Offline Bible Audio',
    intro:
      'Books downloaded to listen to with no connection. They stay on this phone until you delete them, and they aren’t in its backup.',
    howTo: 'To download a book, the New Testament, or the whole Bible, open the Bible, tap the narrator, and choose under Listen offline.',
    empty: 'Nothing downloaded yet.',
    chapters: (done: number, total: number, size: string) =>
      done === total ? `${total} chapters · ${size}` : `${done} of ${total} chapters · ${size}`,
    downloading: 'Downloading…',
    delete: (book: string) => `Delete ${book}`,
    deleteTitle: (book: string) => `Delete ${book}?`,
    deleteMessage: 'You can download it again later.',
    cancel: 'Cancel',
    confirm: 'Delete',
  },
  zh: {
    title: '離線聖經音訊',
    intro: '已下載、可在沒有網路時收聽的書卷。它們會保留在這部手機上，直到您刪除，也不會包含在手機的備份中。',
    howTo: '若要下載一卷書、新約或整本聖經，請打開聖經，點選朗讀者，然後在「離線收聽」中選擇。',
    empty: '尚未下載任何內容。',
    chapters: (done: number, total: number, size: string) =>
      done === total ? `${total} 章 · ${size}` : `${done} / ${total} 章 · ${size}`,
    downloading: '下載中…',
    delete: (book: string) => `刪除${book}`,
    deleteTitle: (book: string) => `刪除${book}？`,
    deleteMessage: '之後可以再次下載。',
    cancel: '取消',
    confirm: '刪除',
  },
  'zh-cn': {
    title: '离线圣经音频',
    intro: '已下载、可在没有网络时收听的书卷。它们会保留在这部手机上，直到您删除，也不会包含在手机的备份中。',
    howTo: '如要下载一卷书、新约或整本圣经，请打开圣经，点击朗读者，然后在“离线收听”中选择。',
    empty: '尚未下载任何内容。',
    chapters: (done: number, total: number, size: string) =>
      done === total ? `${total} 章 · ${size}` : `${done} / ${total} 章 · ${size}`,
    downloading: '下载中…',
    delete: (book: string) => `删除${book}`,
    deleteTitle: (book: string) => `删除${book}？`,
    deleteMessage: '之后可以再次下载。',
    cancel: '取消',
    confirm: '删除',
  },
  es: {
    title: 'Audio bíblico sin conexión',
    intro:
      'Libros descargados para escuchar sin conexión. Se quedan en este teléfono hasta que los borres, y no están en su copia de seguridad.',
    howTo: 'Para descargar un libro, el Nuevo Testamento o toda la Biblia, abre la Biblia, toca el narrador y elige en Escuchar sin conexión.',
    empty: 'Todavía no hay nada descargado.',
    chapters: (done: number, total: number, size: string) =>
      done === total ? `${total} capítulos · ${size}` : `${done} de ${total} capítulos · ${size}`,
    downloading: 'Descargando…',
    delete: (book: string) => `Borrar ${book}`,
    deleteTitle: (book: string) => `¿Borrar ${book}?`,
    deleteMessage: 'Puedes volver a descargarlo más tarde.',
    cancel: 'Cancelar',
    confirm: 'Borrar',
  },
} as const;

/**
 * Offline Bible Audio, in the You tab (#556): every book downloaded for
 * listening offline, by narrator, with its size and a way to delete it.
 * Downloads start in the Bible audio settings popup.
 */
export default function OfflineBibleAudioScreen() {
  const { language } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const DocumentStyles = useDocumentStyles();
  const { backTo } = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight();
  useBibleAudioDownloads();
  const downloaded = listDownloadedBibleAudio();

  const confirmDelete = (narrator: string, bookId: string, bookName: string) =>
    Alert.alert(labels.deleteTitle(bookName), labels.deleteMessage, [
      { text: labels.cancel, style: 'cancel' },
      { text: labels.confirm, style: 'destructive', onPress: () => deleteBibleAudioBook(narrator, bookId) },
    ]);

  return (
    <ScrollView
      testID="offline-bible-audio"
      style={[NavigationStyles.container, { backgroundColor: theme.colors.background }]}
      contentContainerStyle={[
        NavigationStyles.contentContainer,
        { paddingTop: headerHeight + 20, paddingBottom: insets.bottom + 80 },
      ]}
    >
      <Stack.Screen options={{ title: labels.title, backTo } as any} />
      <Text variant="headlineSmall" style={[styles.title, { color: theme.colors.onBackground }]}>
        {labels.title}
      </Text>
      <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurface }]}>
        {labels.intro}
      </Text>
      <Text variant="bodyMedium" style={[styles.paragraph, { color: theme.colors.onSurfaceVariant }]}>
        {labels.howTo}
      </Text>
      {!downloaded.length && (
        <Text variant="bodyLarge" style={[styles.paragraph, { color: theme.colors.onSurface }]}>
          {labels.empty}
        </Text>
      )}
      {downloaded.map(({ narrator, bytes, books }) => (
        <View key={narrator} style={styles.narrator}>
          <Text
            variant="titleMedium"
            style={[
              DocumentStyles.sectionTitle,
              { color: theme.colors.onSurface, borderBottomColor: theme.colors.outlineVariant },
            ]}
          >
            {`${NARRATOR_NAMES[narrator]?.[language] ?? narrator} · ${formatDownloadSize(bytes, language)}`}
          </Text>
          {books.map(({ bookId, chapters, downloadedChapters, bytes: bookBytes }) => {
            const bookName = BIBLE_BOOK_NAMES[bookId]?.[language] ?? bookId;
            const downloading = getBibleAudioScopeStatus(narrator, { kind: 'book', bookId }).downloading;
            return (
              <View key={bookId} style={styles.book}>
                <View style={styles.bookText}>
                  <Text variant="bodyLarge" style={{ color: theme.colors.onSurface }}>
                    {bookName}
                  </Text>
                  <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                    {downloading
                      ? labels.downloading
                      : labels.chapters(downloadedChapters, chapters, formatDownloadSize(bookBytes, language))}
                  </Text>
                </View>
                <IconButton
                  accessibilityLabel={labels.delete(bookName)}
                  icon="delete-outline"
                  onPress={() => confirmDelete(narrator, bookId, bookName)}
                />
              </View>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title: { fontWeight: 'bold', marginBottom: 15 },
  paragraph: { marginBottom: 12 },
  narrator: { marginTop: 12 },
  book: { alignItems: 'center', flexDirection: 'row', minHeight: 56 },
  bookText: { flex: 1, flexShrink: 1, minWidth: 0 },
});
