import { EgwEditionDialog } from '@/components/EgwEditionDialog';
import { LibraryFeaturedCarousel } from '@/components/LibraryFeaturedCarousel';
import { LibraryShelfRow } from '@/components/LibraryShelfRow';
import { LanguageContext } from '@/constants/LanguageContext';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';
import {
  getLibraryItemDisplayText,
  getLibraryItemShelf,
  getLibraryItemsForLanguage,
} from '@/features/library/LibraryCatalog';
import {
  FEATURED_LIBRARY_BOOKS,
  LIBRARY_SHELF_TITLES,
  LIBRARY_SHELVES,
} from '@/features/library/LibraryShelves';
import { useLibraryShelfBooks } from '@/features/library/useLibraryShelfBooks';
import { router, Stack } from 'expo-router';
import { useCallback, useContext, useMemo } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

const copy = {
  en: {
    title: 'Library', seeAll: 'See all', featured: 'Featured', read: 'Read',
    featuredPage: (page: number, count: number) => `Featured book ${page} of ${count}`,
  },
  zh: {
    title: '圖書館', seeAll: '查看全部', featured: '精選', read: '閱讀',
    featuredPage: (page: number, count: number) => `精選書籍 ${page}/${count}`,
  },
  'zh-cn': {
    title: '图书馆', seeAll: '查看全部', featured: '精选', read: '阅读',
    featuredPage: (page: number, count: number) => `精选书籍 ${page}/${count}`,
  },
  es: {
    title: 'Biblioteca', seeAll: 'Ver todo', featured: 'Destacado', read: 'Leer',
    featuredPage: (page: number, count: number) => `Libro destacado ${page} de ${count}`,
  },
} as const;

const searchLabels = {
  en: 'Search all library books',
  zh: '搜尋所有圖書',
  'zh-cn': '搜索所有图书',
  es: 'Buscar todos los libros',
} as const;

export default function LibraryHubScreen() {
  const { language } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const navigationStyles = useNavigationStyles();
  const catalog = getLibraryItemsForLanguage(language);
  const { egwDialog, getBooks, getShelfBooks } = useLibraryShelfBooks(language, { loadEgwCovers: true });
  const open = useCallback((collection: string, q?: string) =>
    router.push({
      pathname: '/explore/library/[collection]',
      params: { collection, ...(q ? { q } : {}) },
    } as any), []);
  const egwAuthor = LIBRARY_SHELF_TITLES.egw[language];
  const searchItems = useMemo(() => {
    const egw = EGW_BOOKS.map((work) => ({
      collection: 'egw' as const,
      icon: 'book-open-page-variant',
      key: `egw:${work.id}`,
      onPress: () => open('egw', work.workTitle[language]),
      searchText: `${work.workTitle[language]} ${egwAuthor}`,
      subtitle: egwAuthor,
      title: work.workTitle[language],
    }));
    const other = [
      ...catalog.publicDomainWorks,
      ...catalog.officialCollections,
      ...catalog.churchDocuments,
    ].map(
      (work) => {
        const text = getLibraryItemDisplayText(work, language);
        const collection = getLibraryItemShelf(work);
        return {
          collection,
          icon: 'book-open-page-variant',
          key: `${collection}:${work.id}`,
          onPress: () => open(collection, text.title),
          searchText: `${text.title} ${text.author}`,
          subtitle: text.author,
          title: text.title,
        };
      },
    );
    return [...egw, ...other];
  }, [catalog.churchDocuments, catalog.officialCollections, catalog.publicDomainWorks, egwAuthor, language, open]);
  return (
    <>
      <Stack.Screen
        options={{
          title: labels.title,
          headerSearch: {
            items: searchItems,
            placeholder: searchLabels[language],
          },
        } as any}
      />
      <ScrollView
        style={navigationStyles.container}
        contentContainerStyle={styles.scrollContent}
      >
        <LibraryFeaturedCarousel
          books={getBooks(FEATURED_LIBRARY_BOOKS)}
          featuredLabel={labels.featured}
          pageLabel={labels.featuredPage}
          readLabel={labels.read}
        />
        {/* Each shelf is a row of covers that scrolls sideways, in the order
            LIBRARY_SHELVES gives. */}
        <View>
          {LIBRARY_SHELVES.map((shelf) => {
            const books = getShelfBooks(shelf);
            if (!books.length) return null;
            return (
              <LibraryShelfRow
                key={shelf}
                books={books}
                onSeeAll={() => open(shelf)}
                seeAllLabel={labels.seeAll}
                title={LIBRARY_SHELF_TITLES[shelf][language]}
              />
            );
          })}
        </View>
      </ScrollView>
      <EgwEditionDialog {...egwDialog} />
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 24 },
});
