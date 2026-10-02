import { useEffect, useState } from 'react';
import type { ImageSourcePropType } from 'react-native';

import { openURL } from '@/constants/ExternalLinks';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  loadChineseLibraryCoverUrls,
  shouldLoadChineseLibraryCovers,
  type ChineseLibraryCoverUrls,
} from './ChineseLibrary';
import { EGW_BOOKS, getEgwCoverUrlsForLanguage, getEgwEditionForLanguage } from './EgwBookCatalog';
import {
  getLibraryItemDisplayText,
  getLibraryItemShelf,
  getLibraryItemSource,
  getLibraryItemsForLanguage,
  type LibraryItem,
} from './LibraryCatalog';
import { BOOK_COVERS, CHINESE_BOOK_COVERS, EGW_COVERS, SPANISH_BOOK_COVERS } from './LibraryCovers';
import {
  CATALOG_ITEM_IDS_BY_SHELF,
  EGW_BOOK_IDS_BY_SHELF,
  LIBRARY_SHELVES,
  orderShelfBooks,
  type LibraryShelf,
} from './LibraryShelves';

const LIBRARY_BOOK_LABELS = {
  en: {
    title: 'Library',
    egwAuthor: 'Ellen G. White',
    opensOfficial: 'Opens the official EGW Writings text edition',
    egwOpenError: 'Could not open this EGW Writings book.',
    opensGutenberg: 'Opens externally on Project Gutenberg',
    opensPdf: 'Opens the PDF',
    opensInternetArchive: 'Opens externally on the Internet Archive',
    opensWebsite: "Opens externally on the book's source website",
    openError: 'Could not open this library source.',
  },
  zh: {
    title: '圖書館',
    egwAuthor: '懷愛倫',
    opensOfficial: '開啟 EGW Writings 官方純文字版本',
    egwOpenError: '無法開啟這本懷愛倫著作。',
    opensGutenberg: '在 Project Gutenberg 外部網站開啟',
    opensPdf: '開啟 PDF 文件',
    opensInternetArchive: '在 Internet Archive 外部網站開啟',
    opensWebsite: '在此書的來源網站外部開啟',
    openError: '無法開啟此圖書來源。',
  },
  'zh-cn': {
    title: '图书馆',
    egwAuthor: '怀爱伦',
    opensOfficial: '打开 EGW Writings 官方纯文字版本',
    egwOpenError: '无法打开这本怀爱伦著作。',
    opensGutenberg: '在 Project Gutenberg 外部网站打开',
    opensPdf: '打开 PDF 文件',
    opensInternetArchive: '在 Internet Archive 外部网站打开',
    opensWebsite: '在此书的来源网站外部打开',
    openError: '无法打开此图书来源。',
  },
  es: {
    title: 'Biblioteca',
    egwAuthor: 'Elena G. de White',
    opensOfficial: 'Abre la edición de texto oficial de EGW Writings',
    egwOpenError: 'No se pudo abrir este libro de EGW Writings.',
    opensGutenberg: 'Se abre externamente en Project Gutenberg',
    opensPdf: 'Abre el PDF',
    opensInternetArchive: 'Se abre externamente en Internet Archive',
    opensWebsite: 'Se abre externamente en el sitio de origen del libro',
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
  // Orders shared shelves; see orderShelfBooks.
  byEllenWhite: boolean;
  onPress: () => void;
}>;

const isOnShelf = (shelf: LibraryShelf, egwBookId: string) =>
  shelf === 'egw' || !!EGW_BOOK_IDS_BY_SHELF[shelf]?.includes(egwBookId);

/**
 * The books on each shelf, shared by the library page and each shelf's own
 * page. Every book opens in the app language's edition when it has one,
 * including Ellen G. White's, which all have English, Chinese, and Spanish.
 */
export function useLibraryShelfBooks(
  language: SupportedLanguage,
  { loadEgwCovers }: { loadEgwCovers: boolean },
) {
  const labels = LIBRARY_BOOK_LABELS[language] || LIBRARY_BOOK_LABELS.en;
  const catalog = getLibraryItemsForLanguage(language);
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
        accessibilityHint: labels.opensOfficial,
        coverSource: EGW_COVERS[work.id],
        coverUrls: getEgwCoverUrlsForLanguage(work, language, chineseCoverUrls[work.id]),
        byEllenWhite: true,
        onPress: () =>
          openURL(
            getEgwEditionForLanguage(work, language).url,
            work.workTitle[language],
            labels.egwOpenError,
          ),
      }));
    const otherBooks = [
      ...catalog.publicDomainWorks,
      ...catalog.officialCollections,
      ...catalog.churchDocuments,
    ]
      .filter(
        (item) =>
          (getLibraryItemShelf(item) === shelf ||
            !!CATALOG_ITEM_IDS_BY_SHELF[shelf]?.includes(item.id)) &&
          matchesQuery(item),
      )
      .map((item) => {
        const text = getLibraryItemDisplayText(item, language);
        const source = getLibraryItemSource(item, language);
        return {
          key: item.id,
          title: text.title,
          author: text.author,
          accessibilityHint:
            source.sourceName === 'EGW Writings'
              ? labels.opensOfficial
              : source.rights === 'church-hosted' || source.rights === 'permission-to-copy'
                ? labels.opensPdf
                : source.sourceName === 'Internet Archive'
                  ? labels.opensInternetArchive
                  : source.sourceName === 'Project Gutenberg'
                    ? labels.opensGutenberg
                    : labels.opensWebsite,
          coverSource:
            (language === 'es' && item.spanish && SPANISH_BOOK_COVERS[item.id]) ||
            ((language === 'zh' || language === 'zh-cn') &&
              item.chineseEdition &&
              CHINESE_BOOK_COVERS[item.id]) ||
            BOOK_COVERS[item.id],
          byEllenWhite: item.author === 'Ellen G. White',
          onPress: () => openURL(source.sourceUrl, labels.title, labels.openError),
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

  return { getBooks, getShelfBooks, labels };
}
