import { EgwEditionDialog } from '@/components/EgwEditionDialog';
import { TitleHero } from '@/components/TitleHero';
import {
  LibraryBookCard,
  shouldUseLibraryListLayout,
} from '@/components/LibraryBookCard';
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
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

export default function LibraryScreen() {
  const { collection, q } = useLocalSearchParams<{
    collection?: string;
    q?: string;
  }>();
  const shelf = isLibraryShelf(collection) ? collection : 'egw';
  const { language } = useContext(LanguageContext);
  const { textScale } = useTextSize();
  const { fontScale, width } = useWindowDimensions();
  const { egwDialog, getShelfBooks } = useLibraryShelfBooks(language, {
    loadEgwCovers: shelf === 'egw' || !!EGW_BOOK_IDS_BY_SHELF[shelf],
  });
  const styles = useMemo(() => createStyles(textScale), [textScale]);
  const useListLayout = shouldUseLibraryListLayout(
    width,
    Math.max(1, fontScale * textScale),
  );
  const shelfTitle = LIBRARY_SHELF_TITLES[shelf][language];
  const books = getShelfBooks(shelf, q);

  return (
    <>
      <Stack.Screen
        options={{
          backTo: '/explore/library',
          title: shelfTitle,
        } as any}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
      >
        <TitleHero
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          title={shelfTitle}
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
                listLayout={useListLayout}
                onPress={book.onPress}
                title={book.title}
              />
            ))}
          </View>
        </View>
      </ScrollView>

      <EgwEditionDialog {...egwDialog} />
    </>
  );
}

const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1]) =>
  StyleSheet.create({
    scrollContent: {
      paddingBottom: 28,
    },
    content: {
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
