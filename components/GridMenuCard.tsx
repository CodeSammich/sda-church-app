import { useAppTheme } from '@/constants/Themes';
import { scaleTypographyMetric, type TextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import { keepWordsWhole } from '@/constants/LineBreaks';
import React, { useMemo, useRef, useState } from 'react';
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
   * Every title in the card's grid. A card's text grows with the text size
   * until the widest word of any of them fills a line of its title, so cards
   * that share a grid keep one size (fitGridMenuCardTextScale). Without it, the
   * card's own title.
   */
  fitTitles?: string[];
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
 * The card's scale before it's fitted: the app's text size times the phone's,
 * in full. The card applies it itself, with the phone's scaling turned off on
 * its Text, so it measures its words at the size they're drawn. Until 1.9.2
 * the text stopped at the default 1.25× (#387) while the card's icon and
 * height grew with the app's text size, so at 200% the icons were big and the
 * titles small.
 */
export const getGridMenuCardTextScale = (textScale: TextScale, fontScale: number) => {
  const phoneScale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return (textScale * phoneScale) as TextScale;
};

// The card's padding and border on each side. The title has all the width
// between them: with 90% of it, as until 1.9.2, it stopped growing sooner.
const CARD_PADDING = 18;
const CARD_BORDER = 1;
const TITLE_FONT_SIZE = 15;
const TITLE_LINE_HEIGHT = 20;
// Two points spare, since a word exactly as wide as its line broke on Android.
const SPARE = 2;
// Where a line of a title may break: a space, or a zero-width space, which
// marks the words of a long Chinese title, such as 本週 / 安息日學 / 課程, since
// Chinese has no spaces between its words. keepWordsWhole holds the rest of
// the Chinese together, and keeps its no-break spaces.
const LINE_BREAK = /[^\S\u00a0]+|\u200b/u;

/**
 * The smallest the card gets to keep a word whole, as in a narrow iPad
 * window: 80% of its size at 100%.
 */
export const GRID_MENU_CARD_TEXT_MIN_SCALE = 0.8;

/** The width of a title's lines in a card `cardWidth` points wide. */
export const getGridMenuCardTitleWidth = (cardWidth: number) => cardWidth - 2 * (CARD_PADDING + CARD_BORDER);

/** The words of a card's title, as a line may break between them. */
export const getGridMenuCardTitleWords = (title: string) =>
  keepWordsWhole(title).split(LINE_BREAK).filter(Boolean);

/**
 * The card's scale, for its title, its icon and its height alike, given
 * `widestWord`, the widest word of the grid's titles, in points, at `scale`:
 * the reader's text size, up to the largest at which that word still fits on
 * one line of the card's title. Home's and New Member & Visitor's cards stay
 * two a row at every size, by design (#387), so past that size a word would
 * break mid-word, as "Compañerismo" and "Denomination" did (#324). The icon and
 * the card stop growing there too, so the title stays in proportion to them;
 * until 1.9.2 they grew on with the text size while the title stayed at 1.25×.
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
}) => {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const scale = getGridMenuCardTextScale(textScale, fontScale);
  // The grid's words, each measured on a line of its own at the reader's
  // size, and the card's width, so the card stops growing where the widest
  // word fills its title's line.
  const fitWords = useMemo(
    () => [...new Set((fitTitles ?? [title]).flatMap(getGridMenuCardTitleWords))],
    [fitTitles, title],
  );
  const [cardWidth, setCardWidth] = useState(0);
  const [measuredWord, setMeasuredWord] = useState(0);
  const widestWord = measuredWord || measureWebWords(fitWords, scale);
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
          {/* The icon grows with the title, and stops where it does. */}
          <View style={styles.decorIconContainer}>
            {imageSource ? (
              <ExternalBrandIcon
                source={imageSource}
                darkSource={darkImageSource}
                size={68}
                contentScale={imageContentScale}
                style={styles.decorIcon}
                textScale={cardTextScale}
              />
            ) : icon ? (
              <AppIcon
                name={icon}
                size={68}
                color={resolvedIconColor}
                style={styles.decorIcon}
                textScale={cardTextScale}
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
