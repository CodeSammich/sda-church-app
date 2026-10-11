import { AppIcon } from '@/components/AppIcon';
import { LibraryCoverImage } from '@/components/LibraryCoverImage';
import {
  getBottomTabIconTextScale,
  scaleTypographyMetric,
  type TextScale,
} from '@/constants/AppPreferences';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  FlatList,
  type ImageSourcePropType,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  type StyleProp,
  StyleSheet,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';
import { Text } from 'react-native-paper';

/** One page: a library book, or a hymnal on the hymnal page. */
export type FeaturedCarouselItem = Readonly<{
  key: string;
  title: string;
  author: string;
  accessibilityHint?: string;
  coverSource?: ImageSourcePropType;
  coverUrls?: readonly string[];
  /** The label above the title, in place of `featuredLabel`. */
  eyebrow?: string;
  /** Without one, the page is not a button. */
  onPress?: () => void;
}>;

type LibraryFeaturedCarouselProps = Readonly<{
  books: readonly FeaturedCarouselItem[];
  featuredLabel?: string;
  /** The pill under each title. Without one, there is no pill. */
  readLabel?: string;
  /** Labels a page dot, for example "Featured book 2 of 4". */
  pageLabel: (page: number, pageCount: number, book: FeaturedCarouselItem) => string;
  /** Labels the arrows beside the dots, for example "Previous featured book". */
  previousLabel: string;
  nextLabel: string;
  /**
   * The page to show, for a parent that follows it, such as the hymnal page,
   * where the page picks the hymnal. Changing it scrolls to that page.
   */
  page?: number;
  /** Called when a swipe or a dot shows another page. */
  onPageChange?: (page: number) => void;
}>;

/**
 * The top of the library page: a few featured books, one per page, swiped
 * sideways. Each page shows the cover large over a blurred copy of itself.
 * It never advances on its own. Arrows either side of the dots show that it
 * moves, and turn the page for a mouse, which can't swipe. The hymnal page
 * uses it for its hymnals.
 */
export function LibraryFeaturedCarousel({
  books,
  featuredLabel = '',
  nextLabel,
  onPageChange,
  page: shownPage,
  pageLabel,
  previousLabel,
  readLabel,
}: LibraryFeaturedCarouselProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const headerHeight = useGlobalHeaderHeight();
  const styles = useMemo(() => createStyles(textScale), [textScale]);
  const listRef = useRef<FlatList<FeaturedCarouselItem>>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [ownPage, setOwnPage] = useState(shownPage ?? 0);
  const page = shownPage ?? ownPage;
  const scrolledWidth = useRef(0);

  const setPage = (index: number) => {
    const next = Math.min(Math.max(index, 0), books.length - 1);
    setOwnPage(next);
    if (next !== page) onPageChange?.(next);
  };
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

  // A parent's page: jump there once the width is known, then slide to each
  // page it picks after that.
  useEffect(() => {
    if (shownPage === undefined || !pageWidth) return;
    const animated = scrolledWidth.current === pageWidth;
    scrolledWidth.current = pageWidth;
    listRef.current?.scrollToOffset({ animated, offset: shownPage * pageWidth });
  }, [pageWidth, shownPage]);

  if (!books.length) return null;

  // At the first or last page, the arrow that way is dimmed and does nothing.
  const renderArrow = (step: -1 | 1) => {
    const target = page + step;
    const disabled = target < 0 || target >= books.length;
    return (
      <TouchableOpacity
        accessibilityLabel={step < 0 ? previousLabel : nextLabel}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPress={() => showPage(target)}
        style={[
          styles.arrow,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline },
          disabled ? styles.disabledArrow : Platform.OS === 'web' ? styles.webPressable : null,
        ]}
      >
        <AppIcon
          name={step < 0 ? 'chevron-left' : 'chevron-right'}
          size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
          textScale={getBottomTabIconTextScale(textScale)}
          color={theme.colors.primary}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View onLayout={onLayout} style={styles.carousel}>
      {pageWidth > 0 ? (
        <View style={styles.frame}>
        <FlatList
          ref={listRef}
          data={books}
          getItemLayout={(_, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
          horizontal
          initialScrollIndex={shownPage || undefined}
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
              <PageContent
                accessibilityHint={book.accessibilityHint}
                accessibilityLabel={`${book.eyebrow ?? featuredLabel}: ${book.title}. ${book.author}`}
                onPress={book.onPress}
                // The page starts under the floating header, like TitleHero.
                style={[styles.content, { paddingTop: headerHeight + 12 }]}
                webPressableStyle={styles.webPressable}
              >
                <View pointerEvents="none" style={styles.coverFrame}>
                  <LibraryCoverImage coverSource={book.coverSource} coverUrls={book.coverUrls} />
                </View>
                <View pointerEvents="none" style={styles.details}>
                  <Text style={styles.eyebrow}>{book.eyebrow ?? featuredLabel}</Text>
                  <Text style={styles.title}>{book.title}</Text>
                  <Text style={styles.author}>{book.author}</Text>
                  {readLabel ? (
                    <View style={styles.readButton}>
                      <Text style={styles.readText}>{readLabel}</Text>
                    </View>
                  ) : null}
                </View>
              </PageContent>
            </View>
          )}
          showsHorizontalScrollIndicator={false}
        />
        </View>
      ) : null}
      {books.length > 1 ? (
        <View style={styles.pager}>
          {renderArrow(-1)}
          <View style={styles.dots}>
            {books.map((book, index) => (
              <TouchableOpacity
                key={book.key}
                accessibilityLabel={pageLabel(index + 1, books.length, book)}
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
          {renderArrow(1)}
        </View>
      ) : null}
    </View>
  );
}

type PageContentProps = Readonly<{
  accessibilityHint?: string;
  accessibilityLabel: string;
  children: ReactNode;
  onPress?: () => void;
  style: StyleProp<ViewStyle>;
  webPressableStyle: ViewStyle;
}>;

// A page with somewhere to go is a button; otherwise it reads as one item.
function PageContent({
  accessibilityHint,
  accessibilityLabel,
  children,
  onPress,
  style,
  webPressableStyle,
}: PageContentProps) {
  return onPress ? (
    <TouchableOpacity
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      activeOpacity={0.8}
      onPress={onPress}
      style={[style, Platform.OS === 'web' ? webPressableStyle : null]}
    >
      {children}
    </TouchableOpacity>
  ) : (
    <View accessibilityHint={accessibilityHint} accessibilityLabel={accessibilityLabel} accessible style={style}>
      {children}
    </View>
  );
}

// Sized like the header's buttons: 44pt, growing with the text. Like the tab
// bar's icons, the arrows stop growing at 130%, so at larger sizes they don't
// push the page's content further down.
const getArrowSize = (textScale: TextScale) =>
  Math.ceil(44 + (getBottomTabIconTextScale(textScale) - 1) * 24);

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
    pager: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 16,
      justifyContent: 'center',
      marginTop: 4,
    },
    // Round like the header's buttons.
    arrow: {
      alignItems: 'center',
      borderRadius: 999,
      borderWidth: 1,
      height: getArrowSize(textScale),
      justifyContent: 'center',
      width: getArrowSize(textScale),
    },
    disabledArrow: {
      opacity: 0.4,
    },
    dots: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
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
