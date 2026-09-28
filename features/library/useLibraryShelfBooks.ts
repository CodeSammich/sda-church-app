import { useEffect, useMemo, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { openURL } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  loadChineseLibraryCoverUrls,
  shouldLoadChineseLibraryCovers,
  type ChineseLibraryCoverUrls,
} from './ChineseLibrary';
import { EGW_BOOKS, getEgwCoverUrlsForLanguage } from './EgwBookCatalog';
import {
  getLibraryItemDisplayText,
  getLibraryItemShelf,
  getLibraryItemsForLanguage,
  type LibraryItem,
} from './LibraryCatalog';
import { BOOK_COVERS, EGW_COVERS } from './LibraryCovers';
import {
  EGW_BOOK_IDS_BY_SHELF,
  LIBRARY_SHELVES,
  orderShelfBooks,
  type LibraryShelf,
} from './LibraryShelves';

const LIBRARY_BOOK_LABELS = {
  en: {
    title: 'Library',
    egwAuthor: 'Ellen G. White',
    chooseEdition: 'Choose an edition. Your app language is listed first. The official text reader remembers its own font and theme settings.',
    opensOfficial: 'Opens the official EGW Writings text edition',
    egwOpenError: 'Could not open this EGW Writings book.',
    close: 'Close',
    chooseBook: 'Choose this book and its language edition',
    opensGutenberg: 'Opens externally on Project Gutenberg',
    opensPdf: 'Opens the PDF',
    opensInternetArchive: 'Opens externally on the Internet Archive',
    openError: 'Could not open this library source.',
  },
  zh: {
    title: '圖書館',
    egwAuthor: '懷愛倫',
    chooseEdition: '請選擇版本。應用程式語言會優先顯示。官方純文字閱讀器會記住其字體與主題設定。',
    opensOfficial: '開啟 EGW Writings 官方純文字版本',
    egwOpenError: '無法開啟這本懷愛倫著作。',
    close: '關閉',
    chooseBook: '選擇此書及語言版本',
    opensGutenberg: '在 Project Gutenberg 外部網站開啟',
    opensPdf: '開啟 PDF 文件',
    opensInternetArchive: '在 Internet Archive 外部網站開啟',
    openError: '無法開啟此圖書來源。',
  },
  'zh-cn': {
    title: '图书馆',
    egwAuthor: '怀爱伦',
    chooseEdition: '请选择版本。应用程序语言会优先显示。官方纯文字阅读器会记住其字体与主题设置。',
    opensOfficial: '打开 EGW Writings 官方纯文字版本',
    egwOpenError: '无法打开这本怀爱伦著作。',
    close: '关闭',
    chooseBook: '选择此书及语言版本',
    opensGutenberg: '在 Project Gutenberg 外部网站打开',
    opensPdf: '打开 PDF 文件',
    opensInternetArchive: '在 Internet Archive 外部网站打开',
    openError: '无法打开此图书来源。',
  },
  es: {
    title: 'Biblioteca',
    egwAuthor: 'Elena G. de White',
    chooseEdition: 'Elige una edición. El idioma de la aplicación aparece primero. El lector de texto oficial recuerda sus propios ajustes de fuente y tema.',
    opensOfficial: 'Abre la edición de texto oficial de EGW Writings',
    egwOpenError: 'No se pudo abrir este libro de EGW Writings.',
    close: 'Cerrar',
    chooseBook: 'Elige este libro y una edición por idioma',
    opensGutenberg: 'Se abre externamente en Project Gutenberg',
    opensPdf: 'Abre el PDF',
    opensInternetArchive: 'Se abre externamente en Internet Archive',
    openError: 'No se pudo abrir esta fuente de la biblioteca.',
  },
};

/** One book as the library shows it on a shelf, whatever its source. */
export type LibraryShelfBook = Readonly<{
  key: string;
  title: string;
  author: string;
  accessibilityHint: string;
  coverSource?: ImageSourcePropType;
  coverUrls?: readonly string[];
  onPress: () => void;
}>;

const isOnShelf = (shelf: LibraryShelf, egwBookId: string) =>
  shelf === 'egw' || !!EGW_BOOK_IDS_BY_SHELF[shelf]?.includes(egwBookId);

/**
 * The books on each shelf, shared by the library page and each shelf's own
 * page. An Ellen G. White book opens a dialog to choose its language edition,
 * so a screen that lists her books also renders `EgwEditionDialog` with
 * `egwDialog`.
 */
export function useLibraryShelfBooks(
  language: SupportedLanguage,
  { loadEgwCovers }: { loadEgwCovers: boolean },
) {
  const labels = LIBRARY_BOOK_LABELS[language] || LIBRARY_BOOK_LABELS.en;
  const catalog = getLibraryItemsForLanguage(language);
  const [selectedEgwBookId, setSelectedEgwBookId] = useState<string | null>(null);
  const [chineseCoverUrls, setChineseCoverUrls] = useState<ChineseLibraryCoverUrls>({});

  useEffect(() => {
    if (!shouldLoadChineseLibraryCovers(language) || !loadEgwCovers) {
      setChineseCoverUrls({});
      return;
    }

    const controller = new AbortController();
    loadChineseLibraryCoverUrls(setChineseCoverUrls, controller.signal).catch((error) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('Could not refresh Chinese library covers:', error);
    });

    return () => controller.abort();
  }, [language, loadEgwCovers]);

  const getShelfBooks = (shelf: LibraryShelf, query = ''): LibraryShelfBook[] => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    // Match both the text shown in this language and the catalog's own text,
    // so a search result in either language finds its book on the shelf.
    const matchesQuery = (work: LibraryItem) => {
      const text = getLibraryItemDisplayText(work, language);
      return `${text.title} ${text.author} ${work.title} ${work.author}`
        .toLocaleLowerCase()
        .includes(normalizedQuery);
    };
    const egwBooks = EGW_BOOKS
      .filter((work) => isOnShelf(shelf, work.id))
      .filter((work) =>
        `${work.workTitle[language]} ${labels.egwAuthor}`.toLocaleLowerCase().includes(normalizedQuery),
      )
      .map((work) => ({
        key: `egw:${work.id}`,
        title: work.workTitle[language],
        author: labels.egwAuthor,
        accessibilityHint: labels.chooseBook,
        coverSource: EGW_COVERS[work.id],
        coverUrls: getEgwCoverUrlsForLanguage(work, language, chineseCoverUrls[work.id]),
        onPress: () => setSelectedEgwBookId(work.id),
      }));
    const otherBooks = [
      ...catalog.publicDomainWorks,
      ...catalog.officialCollections,
      ...catalog.churchDocuments,
    ]
      .filter((item) => getLibraryItemShelf(item) === shelf && matchesQuery(item))
      .map((item) => {
        const text = getLibraryItemDisplayText(item, language);
        return {
          key: item.id,
          title: text.title,
          author: text.author,
          accessibilityHint:
            item.rights === 'official-external'
              ? labels.opensOfficial
              : item.rights === 'church-hosted'
                ? labels.opensPdf
                : item.sourceName === 'Internet Archive'
                  ? labels.opensInternetArchive
                  : labels.opensGutenberg,
          coverSource: BOOK_COVERS[item.id],
          onPress: () => openURL(item.sourceUrl, labels.title, labels.openError),
        };
      });
    return orderShelfBooks(shelf, [...egwBooks, ...otherBooks]);
  };

  /** Books by key, in the order given, from whichever shelf holds them. */
  const getBooks = (keys: readonly string[]): LibraryShelfBook[] => {
    const books = new Map(
      LIBRARY_SHELVES.flatMap((shelf) => getShelfBooks(shelf)).map((book) => [book.key, book]),
    );
    return keys.flatMap((key) => books.get(key) ?? []);
  };

  const selectedEgwBook = useMemo(
    () => EGW_BOOKS.find(({ id }) => id === selectedEgwBookId) || null,
    [selectedEgwBookId],
  );
  const egwDialog = {
    closeLabel: labels.close,
    language,
    onDismiss: () => setSelectedEgwBookId(null),
    openError: labels.egwOpenError,
    opensOfficial: labels.opensOfficial,
    selectEditionLabel: labels.chooseEdition,
    work: selectedEgwBook,
  };

  return { egwDialog, getBooks, getShelfBooks, labels };
}
