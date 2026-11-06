import { TitleHero } from '@/components/TitleHero';
import {
  LibraryBookCard,
  getLibraryGridCardWidth,
  shouldUseLibraryListLayout,
} from '@/components/LibraryBookCard';
import { contentColumnStyle, getContentWidth } from '@/constants/Layout';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useTextSize } from '@/constants/TextSizeContext';
import {
  EGW_BOOK_IDS_BY_SHELF,
  isLibraryShelf,
  LIBRARY_SHELF_TITLES,
} from '@/features/library/LibraryShelves';
import { useLibraryShelfBooks } from '@/features/library/useLibraryShelfBooks';
import { useHeroUnderStatusBar } from '@/hooks/useHeroUnderStatusBar';
import { useContentColumnScale } from '@/hooks/useContentColumnScale';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { TabBarSpacer } from '@/constants/BottomTabHeightContext';

export default function LibraryScreen() {
  const { collection, q } = useLocalSearchParams<{
    collection?: string;
    q?: string;
  }>();
  const shelf = isLibraryShelf(collection) ? collection : 'egw';
  const { language } = useContext(LanguageContext);
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const { getShelfBooks } = useLibraryShelfBooks(language, {
    loadEgwCovers: shelf === 'egw' || !!EGW_BOOK_IDS_BY_SHELF[shelf],
  });
  const columnScale = useContentColumnScale();
  const styles = useMemo(() => createStyles(textScale, columnScale), [columnScale, textScale]);
  const useListLayout = shouldUseLibraryListLayout(
    getContentWidth(width, columnScale),
    Math.max(1, fontScale * textScale),
  );
  const gridCardWidth = getLibraryGridCardWidth(getContentWidth(width, columnScale));
  const shelfTitle = LIBRARY_SHELF_TITLES[shelf][language];
  const books = getShelfBooks(shelf, q);
  const { heroUnderStatusBar, onHeroLayout, onScroll } = useHeroUnderStatusBar();

  return (
    <>
      <Stack.Screen
        options={{
          backTo: '/explore/library',
          title: shelfTitle,
          heroUnderStatusBar,
        } as any}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <TitleHero
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          title={shelfTitle}
          onLayout={onHeroLayout}
        />
        <View style={styles.content}>
          <View style={[styles.bookGrid, useListLayout && styles.bookList]}>
            {books.map((book) => (
              <LibraryBookCard
                key={book.key}
                accessibilityHint={book.accessibilityHint}
                author={book.author}
                coverSource={book.coverSource}
                coverUrls={book.coverUrls}
                gridWidth={gridCardWidth}
                listLayout={useListLayout}
                onPress={book.onPress}
                title={book.title}
              />
            ))}
          </View>
        </View>
        <TabBarSpacer />
      </ScrollView>
    </>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  columnScale: number,
) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 28,
    },
    content: {
      ...contentColumnStyle(columnScale),
      paddingHorizontal: 20,
    },
    bookGrid: {
      alignItems: 'flex-start',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      marginBottom: 20,
    },
    bookList: {
      flexDirection: 'column',
    },
  });
