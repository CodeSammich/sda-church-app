import { useAppTheme } from '@/constants/Themes';
import { scaleTypographyMetric, type TextScale } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import React, { useMemo, useRef } from 'react';
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
}) => {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(
      textScale,
      getGridMenuCardTextScale(textScale, fontScale),
      titleBlockLines,
    ),
    [fontScale, textScale, titleBlockLines],
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
        activeOpacity={1}
      >
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
    borderWidth: 1,
    padding: 18,
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
    fontSize: scaleTypographyMetric(15, cardTextScale),
    fontWeight: '700',
    // color will be set via theme (onSurface) in component
    lineHeight: scaleTypographyMetric(20, cardTextScale),
    maxWidth: '90%',
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
