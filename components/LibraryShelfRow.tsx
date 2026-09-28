import { AppIcon } from '@/components/AppIcon';
import { LibraryCoverImage } from '@/components/LibraryCoverImage';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import type { LibraryShelfBook } from '@/features/library/useLibraryShelfBooks';
import { useMemo } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

type LibraryShelfRowProps = Readonly<{
  books: readonly LibraryShelfBook[];
  onSeeAll: () => void;
  seeAllLabel: string;
  title: string;
}>;

/**
 * One shelf of the library page: its title, a link to the whole shelf, and
 * its covers in a row that scrolls sideways. A longer shelf makes the row
 * longer, not the page.
 */
export function LibraryShelfRow({ books, onSeeAll, seeAllLabel, title }: LibraryShelfRowProps) {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const styles = useMemo(() => createStyles(textScale), [textScale]);

  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text
          accessibilityRole="header"
          style={[styles.title, { color: theme.colors.onSurface }]}
        >
          {title}
        </Text>
        <TouchableOpacity
          accessibilityLabel={`${seeAllLabel}: ${title}`}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onSeeAll}
          style={[styles.seeAll, Platform.OS === 'web' ? styles.webPressable : null]}
        >
          <Text style={[styles.seeAllText, { color: theme.colors.primary }]}>
            {seeAllLabel}
          </Text>
          <AppIcon
            name="chevron-right"
            size={DESIGN_TOKENS.ICON_SIZE_STANDARD}
            color={theme.colors.primary}
          />
        </TouchableOpacity>
      </View>
      <FlatList
        contentContainerStyle={styles.books}
        data={books}
        horizontal
        keyExtractor={(book) => book.key}
        renderItem={({ item: book }) => (
          <TouchableOpacity
            accessibilityHint={book.accessibilityHint}
            accessibilityLabel={`${book.title}. ${book.author}`}
            accessibilityRole="button"
            activeOpacity={0.72}
            onPress={book.onPress}
            style={[styles.book, Platform.OS === 'web' ? styles.webPressable : null]}
          >
            <View
              pointerEvents="none"
              style={[
                styles.coverFrame,
                {
                  backgroundColor: theme.colors.surfaceVariant,
                  borderColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <LibraryCoverImage coverSource={book.coverSource} coverUrls={book.coverUrls} />
            </View>
            <Text
              numberOfLines={3}
              style={[styles.bookTitle, { color: theme.colors.onSurface }]}
            >
              {book.title}
            </Text>
            <Text
              numberOfLines={2}
              style={[styles.author, { color: theme.colors.onSurfaceVariant }]}
            >
              {book.author}
            </Text>
          </TouchableOpacity>
        )}
        // Touch screens scroll the row by swiping. A mouse needs the bar.
        showsHorizontalScrollIndicator={Platform.OS === 'web'}
      />
    </View>
  );
}

const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1]) =>
  StyleSheet.create({
    row: {
      marginBottom: 28,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      justifyContent: 'space-between',
      marginBottom: 12,
      paddingHorizontal: 20,
    },
    title: {
      flex: 1,
      fontSize: scaleTypographyMetric(20, textScale),
      fontWeight: '700',
      lineHeight: scaleTypographyMetric(28, textScale),
      minWidth: 0,
    },
    seeAll: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 2,
      minHeight: 44,
    },
    seeAllText: {
      fontSize: scaleTypographyMetric(14, textScale),
      fontWeight: '600',
      lineHeight: scaleTypographyMetric(20, textScale),
    },
    books: {
      gap: 14,
      paddingBottom: 4,
      paddingHorizontal: 20,
    },
    // Covers grow with the text so enlarged titles still fit beneath them.
    book: {
      width: scaleTypographyMetric(104, textScale),
    },
    coverFrame: {
      aspectRatio: 2 / 3,
      borderRadius: 6,
      borderWidth: StyleSheet.hairlineWidth,
      marginBottom: 8,
      overflow: 'hidden',
      width: '100%',
    },
    bookTitle: {
      fontSize: scaleTypographyMetric(14, textScale),
      fontWeight: '600',
      lineHeight: scaleTypographyMetric(19, textScale),
    },
    author: {
      fontSize: scaleTypographyMetric(12, textScale),
      lineHeight: scaleTypographyMetric(17, textScale),
      marginTop: 2,
    },
    webPressable: {
      cursor: 'pointer',
    },
  });
