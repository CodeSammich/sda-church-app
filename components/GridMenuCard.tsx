import { useAppTheme } from '@/constants/Themes';
import { scaleTypographyMetric, type TextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { keepWordsWhole } from '@/constants/LineBreaks';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Animated,
  type ImageSourcePropType,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { ExternalBrandIcon } from '@/components/ExternalBrandIcon';

interface GridMenuCardProps {
  title: string;
  subtitle?: string;
  /** MaterialCommunityIcons glyph for the decorative illustration area */
  icon?: MaterialCommunityIconName;
  imageSource?: ImageSourcePropType;
  darkImageSource?: ImageSourcePropType;
  /** Optional visual scale for provider assets with transparent canvas padding. */
  imageContentScale?: number;
  /** Pastel background color for the card */
  color: string;
  /** Icon tint — defaults to a semi-transparent dark of the card color */
  iconColor?: string;
  onPress?: () => void;
  style?: ViewStyle | any;
  /** Lines reserved equally across a grid so translated titles cannot resize one card. */
  titleBlockLines?: 2 | 3;
  showArrow?: boolean;
  /**
   * Every title in the card's grid, measured word by word, so the grid can
   * give each card a row of its own where a word wouldn't fit beside another
   * card (useGridMenuCardColumns). Without it, the card's own title.
   */
  fitTitles?: string[];
  /** Called with the widest word of fitTitles, in points, once it's measured. */
  onWidestWord?: (width: number) => void;
}

export const getGridMenuCardTitleBlockMinHeight = (
  effectiveScale: number,
  titleBlockLines: 2 | 3 = 2,
) => {
  const safeScale = Number.isFinite(effectiveScale)
    ? Math.max(1, effectiveScale)
    : 1;
  // Two lines also fit one title plus its subtitle (20 + 3 + 18). Compact
  // translated grids can opt into three lines so every card reserves enough
  // room for their longest label.
  const unscaledHeight = titleBlockLines === 3 ? 60 : 41;
  return Math.ceil(unscaledHeight * safeScale);
};

/**
 * The card text's scale: the app's text size times the phone's, in full, as
 * the rest of the page and the card's own icon grow. The card applies it
 * itself, with the phone's scaling turned off on its Text, so it measures its
 * words at the size they're drawn. Until 1.9.2 it stopped at the default
 * 1.25×, and shrank from there to keep a word whole beside another card, so at
 * 200% the cards and their icons grew but the titles never did (#387, #324).
 */
export const getGridMenuCardTextScale = (textScale: TextScale, fontScale: number) => {
  const phoneScale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return (textScale * phoneScale) as TextScale;
};

// The card's padding and border on each side. The title has all the width
// between them: it had 90% of it, which left a long word less room beside
// another card.
const CARD_PADDING = 18;
const CARD_BORDER = 1;
const TITLE_FONT_SIZE = 15;
const TITLE_LINE_HEIGHT = 20;
// Two points spare, since a word exactly as wide as its line broke on Android.
const SPARE = 2;
// Where a line of a title may break: a space, or a zero-width space, which
// marks the words of a long Chinese title, such as 本週\u200b安息日學\u200b課程, since
// Chinese has no spaces between its words. keepWordsWhole holds the rest of
// the Chinese together, and keeps its no-break spaces.
const LINE_BREAK = /[^\S\u00a0]+|\u200b/u;

/**
 * The smallest the card text gets to keep a word whole that's wider than a
 * card a whole row wide: 80% of its size at 100%.
 */
export const GRID_MENU_CARD_TEXT_MIN_SCALE = 0.8;

/** The width of a title's lines in a card `cardWidth` points wide. */
export const getGridMenuCardTitleWidth = (cardWidth: number) => cardWidth - 2 * (CARD_PADDING + CARD_BORDER);

/** The words of a card's title, as a line may break between them. */
export const getGridMenuCardTitleWords = (title: string) =>
  keepWordsWhole(title).split(LINE_BREAK).filter(Boolean);

/**
 * How many cards share a row of a grid `rowWidth` points wide, with `gap`
 * between them: two while `widestWord`, the widest word of the grid's titles
 * at their size, in points, fits on a line of a card half the row, or else
 * one, so the titles keep the size the reader chose and no word breaks. Two
 * until the word is measured.
 */
export const getGridMenuCardColumns = (rowWidth: number, gap: number, widestWord: number): 1 | 2 =>
  rowWidth > 0 && widestWord > getGridMenuCardTitleWidth((rowWidth - gap) / 2) - SPARE ? 1 : 2;

/**
 * The columns of a grid of cards in a row `rowWidth` points wide, from the
 * widest word its cards measure: give each card `onWidestWord`.
 */
export const useGridMenuCardColumns = (rowWidth: number, gap: number) => {
  const [widestWord, setWidestWord] = useState(0);
  return { columns: getGridMenuCardColumns(rowWidth, gap, widestWord), onWidestWord: setWidestWord };
};

/**
 * The card text's scale, given `widestWord`, the widest word of the grid's
 * titles, in points, at `scale`: smaller in proportion only where that word
 * wouldn't fit on one line of the card's title, which would break it mid-word.
 * The grid gives each card a row of its own first (getGridMenuCardColumns), so
 * only a word wider than a whole row shrinks, at the largest sizes together
 * on a narrow phone, and only as far as it must.
 */
export const fitGridMenuCardTextScale = (
  scale: TextScale,
  cardWidth: number,
  widestWord: number,
): TextScale => {
  const room = getGridMenuCardTitleWidth(cardWidth) - SPARE;
  if (!(cardWidth > 0) || !(widestWord > room)) return scale;
  return Math.max(GRID_MENU_CARD_TEXT_MIN_SCALE, (scale * room) / widestWord) as TextScale;
};

/**
 * The widest of `words` in a bold title at `scale`, measured with the
 * browser's canvas. The web has no onTextLayout, which measures them on a
 * phone.
 */
const measureWebWords = (words: string[], scale: number) => {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return 0;
  const context = document.createElement('canvas').getContext?.('2d');
  if (!context) return 0;
  const family = getComputedStyle(document.body).fontFamily || 'sans-serif';
  context.font = `700 ${TITLE_FONT_SIZE * scale}px ${family}`;
  return Math.max(0, ...words.map((word) => context.measureText(word).width));
};

export const GridMenuCard: React.FC<GridMenuCardProps> = ({
  title,
  subtitle,
  icon,
  imageSource,
  darkImageSource,
  imageContentScale = 1,
  color,
  iconColor,
  onPress,
  style,
  titleBlockLines = 2,
  showArrow = true,
  fitTitles,
  onWidestWord,
}) => {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const scale = getGridMenuCardTextScale(textScale, fontScale);
  // The grid's words, each measured on a line of its own at the card's size,
  // so the grid can tell whether two cards fit a row, and the card's width, so
  // a word wider than even a whole row can shrink to stay whole.
  const fitWords = useMemo(
    () => [...new Set((fitTitles ?? [title]).flatMap(getGridMenuCardTitleWords))],
    [fitTitles, title],
  );
  const [cardWidth, setCardWidth] = useState(0);
  const [measuredWord, setMeasuredWord] = useState(0);
  const widestWord = measuredWord || measureWebWords(fitWords, scale);
  useEffect(() => {
    if (widestWord > 0) onWidestWord?.(widestWord);
  }, [onWidestWord, widestWord]);
  const cardTextScale = fitGridMenuCardTextScale(scale, cardWidth, widestWord);
  const styles = useMemo(
    () => createStyles(textScale, cardTextScale, titleBlockLines),
    [cardTextScale, textScale, titleBlockLines],
  );
  const measureTextStyle = useMemo(
    () => ({
      fontSize: scaleTypographyMetric(TITLE_FONT_SIZE, scale),
      fontWeight: '700' as const,
      lineHeight: scaleTypographyMetric(TITLE_LINE_HEIGHT, scale),
    }),
    [scale],
  );
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 30,
      bounciness: 4,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 6,
    }).start();
  };

  const cardColors = theme.colors.gridMenuCard;
  const resolvedIconColor = iconColor ?? cardColors.decorativeIcon;
  // Read aloud without the marks between a Chinese title's words.
  const spokenTitle = title.replace(/\u200b/gu, '');
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        accessibilityLabel={subtitle ? `${spokenTitle}. ${subtitle}` : spokenTitle}
        accessibilityRole={onPress ? 'button' : undefined}
        disabled={!onPress}
        style={[
          styles.card,
          { backgroundColor: color, borderColor: cardColors.border },
          onPress && Platform.OS === 'web' ? styles.webPressable : null,
        ]}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
        activeOpacity={1}
      >
        <View
          accessibilityElementsHidden
          aria-hidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.measure}
        >
          <Text
            allowFontScaling={false}
            onTextLayout={(event) =>
              setMeasuredWord(Math.max(0, ...event.nativeEvent.lines.map((line) => line.width)))
            }
            style={measureTextStyle}
            testID="grid-menu-card-word-measure"
          >
            {fitWords.join('\n')}
          </Text>
        </View>
        {/* Title block — top left */}
        <View pointerEvents="none" style={styles.titleBlock}>
            <Text
              allowFontScaling={false}
              style={[styles.title, { color: theme.colors.onSurface }]}
            >
              {keepWordsWhole(title)}
            </Text>
            {subtitle ? (
              <Text
                allowFontScaling={false}
                style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}
              >
                {subtitle}
              </Text>
            ) : null}
        </View>

        {/* Illustration + arrow row — bottom */}
        <View pointerEvents="none" style={styles.bottomRow}>
          <View style={styles.decorIconContainer}>
            {imageSource ? (
              <ExternalBrandIcon
                source={imageSource}
                darkSource={darkImageSource}
                size={68}
                contentScale={imageContentScale}
                style={styles.decorIcon}
              />
            ) : icon ? (
              <AppIcon
                name={icon}
                size={68}
                color={resolvedIconColor}
                style={styles.decorIcon}
              />
            ) : null}
          </View>
          {/* Diagonal arrow affordance */}
          {showArrow && <LinearGradient
            testID="grid-menu-card-arrow-badge"
            colors={
              theme.dark
                ? theme.gradients.metallicGold
                : [cardColors.arrowBackground, cardColors.arrowBackground]
            }
            locations={theme.dark ? [0, 0.38, 0.62, 1] : [0, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[
              styles.arrowBadge,
              {
                borderColor: cardColors.arrowBorder,
              },
            ]}
          >
            <AppIcon
              name="arrow-top-right"
              size={14}
              color={cardColors.arrowForeground}
            />
          </LinearGradient>}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (
  textScale: TextScale,
  cardTextScale: TextScale,
  titleBlockLines: 2 | 3,
) => StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: CARD_BORDER,
    padding: CARD_PADDING,
    minHeight: 148 + Math.round(Math.max(0, cardTextScale - 1) * 64),
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  webPressable: {
    cursor: 'pointer',
  },
  titleBlock: {
    flex: 0,
    minHeight: getGridMenuCardTitleBlockMinHeight(cardTextScale, titleBlockLines),
  },
  title: {
    fontSize: scaleTypographyMetric(TITLE_FONT_SIZE, cardTextScale),
    fontWeight: '700',
    // color will be set via theme (onSurface) in component
    lineHeight: scaleTypographyMetric(TITLE_LINE_HEIGHT, cardTextScale),
  },
  // Out of sight and wide enough that no word wraps; the card clips it.
  measure: {
    left: 0,
    opacity: 0,
    position: 'absolute',
    top: 0,
    width: 4000,
  },
  subtitle: {
    fontSize: scaleTypographyMetric(12, cardTextScale),
    lineHeight: scaleTypographyMetric(18, cardTextScale),
    // color will be set via theme (onSurfaceVariant) in component
    marginTop: 3,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  decorIcon: {
    // Offset slightly so it bleeds toward the edge for a richer look
    marginLeft: -6,
    marginBottom: -6,
  },
  decorIconContainer: {
    position: 'relative',
  },
  decorIconBackground: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  arrowBadge: {
    width: scaleTypographyMetric(28, textScale),
    height: scaleTypographyMetric(28, textScale),
    borderRadius: scaleTypographyMetric(14, textScale),
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
  },
});
