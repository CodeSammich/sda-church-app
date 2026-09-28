import { LibraryCoverImage } from '@/components/LibraryCoverImage';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import type { LibraryShelfBook } from '@/features/library/useLibraryShelfBooks';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

type LibraryFeaturedCarouselProps = Readonly<{
  books: readonly LibraryShelfBook[];
  featuredLabel: string;
  readLabel: string;
  /** Labels a page dot, for example "Featured book 2 of 4". */
  pageLabel: (page: number, pageCount: number) => string;
}>;

/**
 * The top of the library page: a few featured books, one per page, swiped
 * sideways. Each page shows the cover large over a blurred copy of itself.
 * It never advances on its own.
 */
export function LibraryFeaturedCarousel({
  books,
  featuredLabel,
  pageLabel,
  readLabel,
}: LibraryFeaturedCarouselProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const headerHeight = useGlobalHeaderHeight();
  const styles = useMemo(() => createStyles(textScale), [textScale]);
  const listRef = useRef<FlatList<LibraryShelfBook>>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);

  const onLayout = (event: LayoutChangeEvent) =>
    setPageWidth(Math.round(event.nativeEvent.layout.width));
  const onScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  };
  const showPage = (index: number) => {
    setPage(index);
    listRef.current?.scrollToOffset({ animated: true, offset: index * pageWidth });
  };

  if (!books.length) return null;

  return (
    <View onLayout={onLayout} style={styles.carousel}>
      {pageWidth > 0 ? (
        <View style={styles.frame}>
        <FlatList
          ref={listRef}
          data={books}
          getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
          horizontal
          keyExtractor={(book) => book.key}
          onMomentumScrollEnd={onScrollEnd}
          // Web has no momentum event for a mouse or trackpad scroll.
          onScrollEndDrag={Platform.OS === 'web' ? onScrollEnd : undefined}
          pagingEnabled
          renderItem={({ item: book }) => (
            <View style={[styles.page, { width: pageWidth }]}>
              <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <LibraryCoverImage
                  blurRadius={Platform.OS === 'web' ? 18 : 24}
                  coverSource={book.coverSource}
                  coverUrls={book.coverUrls}
                />
                <View style={[StyleSheet.absoluteFill, styles.scrim]} />
              </View>
              <TouchableOpacity
                accessibilityHint={book.accessibilityHint}
                accessibilityLabel={`${featuredLabel}: ${book.title}. ${book.author}`}
                accessibilityRole="button"
                activeOpacity={0.8}
                onPress={book.onPress}
                // The page starts under the floating header, like TitleHero.
                style={[
                  styles.content,
                  { paddingTop: headerHeight + 12 },
                  Platform.OS === 'web' ? styles.webPressable : null,
                ]}
              >
                <View pointerEvents="none" style={styles.coverFrame}>
                  <LibraryCoverImage coverSource={book.coverSource} coverUrls={book.coverUrls} />
                </View>
                <View pointerEvents="none" style={styles.details}>
                  <Text style={styles.eyebrow}>{featuredLabel}</Text>
                  <Text style={styles.title}>{book.title}</Text>
                  <Text style={styles.author}>{book.author}</Text>
                  <View style={styles.readButton}>
                    <Text style={styles.readText}>{readLabel}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
        </View>
      ) : null}
      {books.length > 1 ? (
        <View style={styles.dots}>
          {books.map((book, index) => (
            <TouchableOpacity
              key={book.key}
              accessibilityLabel={pageLabel(index + 1, books.length)}
              accessibilityRole="button"
              accessibilityState={{ selected: index === page }}
              hitSlop={10}
              onPress={() => showPage(index)}
              style={Platform.OS === 'web' ? styles.webPressable : null}
            >
              <View
                style={[
                  styles.dot,
                  index === page
                    ? [styles.activeDot, { backgroundColor: theme.colors.primary }]
                    : { backgroundColor: theme.colors.outlineVariant },
                ]}
              />
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// The page sits on a darkened, blurred cover in both themes, so its text is
// always light.
const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1]) =>
  StyleSheet.create({
    carousel: {
      marginBottom: 24,
    },
    // Rounded like TitleHero, the banner other pages open with.
    frame: {
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    // Pages share the tallest page's height; center each one's content.
    page: {
      justifyContent: 'center',
      overflow: 'hidden',
    },
    scrim: {
      backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    content: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 18,
      paddingHorizontal: 20,
      paddingVertical: 24,
    },
    coverFrame: {
      aspectRatio: 2 / 3,
      borderRadius: 8,
      overflow: 'hidden',
      width: '38%',
      maxWidth: 200,
    },
    details: {
      flex: 1,
      minWidth: 0,
    },
    eyebrow: {
      color: 'rgba(255, 255, 255, 0.78)',
      fontSize: scaleTypographyMetric(12, textScale),
      fontWeight: '700',
      letterSpacing: 1,
      lineHeight: scaleTypographyMetric(16, textScale),
      marginBottom: 6,
      textTransform: 'uppercase',
    },
    title: {
      color: '#ffffff',
      fontSize: scaleTypographyMetric(22, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(28, textScale),
    },
    author: {
      color: 'rgba(255, 255, 255, 0.85)',
      fontSize: scaleTypographyMetric(14, textScale),
      lineHeight: scaleTypographyMetric(20, textScale),
      marginTop: 4,
    },
    readButton: {
      alignSelf: 'flex-start',
      backgroundColor: '#ffffff',
      borderRadius: 999,
      marginTop: 16,
      paddingHorizontal: 22,
      paddingVertical: 9,
    },
    readText: {
      color: '#111111',
      fontSize: scaleTypographyMetric(15, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(20, textScale),
    },
    dots: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      marginTop: 12,
    },
    dot: {
      borderRadius: 4,
      height: 8,
      width: 8,
    },
    activeDot: {
      width: 20,
    },
    webPressable: {
      cursor: 'pointer',
    },
  });
