import { useAppTheme } from '@/constants/Themes';
import { scaleTypographyMetric, type TextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
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
   * Every title in the card's grid. A card holds its text down until the
   * widest word of any of them fits on one line of its title, so cards that
   * share a grid keep one size (fitGridMenuCardTextScale). Without it, the
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
 * The largest a card's title and subtitle get, with the app's text size and the
 * phone's multiplied together: the size they have at the app's default 125%.
 * Two cards share a row at every size, so past this a long word breaks
 * mid-word (#387). On a Pixel 9a (412 points wide), Spanish "Compañerismo"
 * already fills its card at 125%, and English "Livestream" and "Denomination"
 * broke from about 1.4×. The rest of the page still grows to the 3.2× limit.
 */
export const GRID_MENU_CARD_TEXT_MAX_SCALE = 1.25;

/**
 * The card text's scale: the app's text size times the phone's, up to the cap.
 * The card applies it itself, with the phone's scaling turned off on its Text,
 * because Android scales lineHeight with the phone's full text size even where
 * React Native's font-size multiplier cap holds fontSize down, which spread
 * capped titles' lines apart.
 */
export const getGridMenuCardTextScale = (textScale: TextScale, fontScale: number) => {
  const phoneScale = Number.isFinite(fontScale) && fontScale > 0 ? fontScale : 1;
  return Math.min(textScale * phoneScale, GRID_MENU_CARD_TEXT_MAX_SCALE) as TextScale;
};

// The card's padding and border on each side, and the share of the rest that
// its title may use (styles.title's maxWidth).
const CARD_PADDING = 18;
const CARD_BORDER = 1;
const TITLE_WIDTH_FRACTION = 0.9;
const TITLE_FONT_SIZE = 15;
const TITLE_LINE_HEIGHT = 20;

/** The smallest the card text gets to keep a word whole: 80% of its size at 100%. */
export const GRID_MENU_CARD_TEXT_MIN_SCALE = 0.8;

/** The width of a title's lines in a card `cardWidth` points wide. */
export const getGridMenuCardTitleWidth = (cardWidth: number) =>
  (cardWidth - 2 * (CARD_PADDING + CARD_BORDER)) * TITLE_WIDTH_FRACTION;

/**
 * The card text's scale, given `widestWord`, the widest word of the grid's
 * titles, in points, at `scale`: smaller in proportion where that word wouldn't
 * fit on one line of the title, which would break it mid-word. The cap above
 * was set on a 412-point phone. On narrower ones "Denomination" broke at 125%
 * from 390 points down, and Spanish "Compañerismo" from 412; in a narrow iPad
 * window, both did (#324). Two points spare, since a word exactly as wide as
 * the line broke on Android.
 */
export const fitGridMenuCardTextScale = (
  scale: TextScale,
  cardWidth: number,
  widestWord: number,
): TextScale => {
  const room = getGridMenuCardTitleWidth(cardWidth) - 2;
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
  const cappedScale = getGridMenuCardTextScale(textScale, fontScale);
  // The grid's words, each measured on a line of its own at the capped size,
  // and the card's width, so the text can shrink to keep every word whole.
  const fitWords = useMemo(
    () => [...new Set((fitTitles ?? [title]).flatMap((each) => each.split(/\s+/u)).filter(Boolean))],
    [fitTitles, title],
  );
  const [cardWidth, setCardWidth] = useState(0);
  const [measuredWord, setMeasuredWord] = useState(0);
  const widestWord = measuredWord || measureWebWords(fitWords, cappedScale);
  const cardTextScale = fitGridMenuCardTextScale(cappedScale, cardWidth, widestWord);
  const styles = useMemo(
    () => createStyles(textScale, cardTextScale, titleBlockLines),
    [cardTextScale, textScale, titleBlockLines],
  );
  const measureTextStyle = useMemo(
    () => ({
      fontSize: scaleTypographyMetric(TITLE_FONT_SIZE, cappedScale),
      fontWeight: '700' as const,
      lineHeight: scaleTypographyMetric(TITLE_LINE_HEIGHT, cappedScale),
    }),
    [cappedScale],
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
  return (
    <Animated.View style={[{ transform: [{ scale: scaleAnim }] }, style]}>
      <TouchableOpacity
        accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
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
              {title}
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
    maxWidth: `${TITLE_WIDTH_FRACTION * 100}%`,
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
