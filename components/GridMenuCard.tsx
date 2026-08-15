import { useAppTheme } from '@/constants/Themes';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { AppIcon, type MaterialCommunityIconName } from '@/components/AppIcon';
import React, { useMemo, useRef } from 'react';
import {
  Animated,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

interface GridMenuCardProps {
  title: string;
  subtitle?: string;
  /** MaterialCommunityIcons glyph for the decorative illustration area */
  icon: MaterialCommunityIconName;
  /** Pastel background color for the card */
  color: string;
  /** Icon tint — defaults to a semi-transparent dark of the card color */
  iconColor?: string;
  onPress?: () => void;
  style?: ViewStyle | any;
}

export const getGridMenuCardTitleBlockMinHeight = (effectiveScale: number) => {
  const safeScale = Number.isFinite(effectiveScale)
    ? Math.max(1, effectiveScale)
    : 1;
  // Two title lines (2 x 20) or one title plus its subtitle (20 + 3 + 18).
  // Reserving this on every card keeps rows equal regardless of which label
  // happens to wrap on a particular device or in a particular language.
  return Math.ceil(41 * safeScale);
};

export const GridMenuCard: React.FC<GridMenuCardProps> = ({
  title,
  subtitle,
  icon,
  color,
  iconColor,
  onPress,
  style,
}) => {
  const theme = useAppTheme();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(textScale, Math.max(1, fontScale * textScale)),
    [fontScale, textScale],
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
            <Text style={[styles.title, { color: theme.colors.onSurface }]}>{title}</Text>
            {subtitle ? <Text style={[styles.subtitle, { color: theme.colors.onSurfaceVariant }]}>{subtitle}</Text> : null}
        </View>

        {/* Illustration + arrow row — bottom */}
        <View pointerEvents="none" style={styles.bottomRow}>
          <View style={styles.decorIconContainer}>
            <AppIcon
              name={icon}
              size={68}
              color={resolvedIconColor}
              style={styles.decorIcon}
            />
          </View>
          {/* Diagonal arrow affordance */}
          <View
            testID="grid-menu-card-arrow-badge"
            style={[
              styles.arrowBadge,
              {
                backgroundColor: cardColors.arrowBackground,
                borderColor: cardColors.arrowBorder,
              },
            ]}
          >
            <AppIcon
              name="arrow-top-right"
              size={14}
              color={cardColors.arrowForeground}
            />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const createStyles = (textScale: Parameters<typeof scaleTypographyMetric>[1], effectiveScale: number) => StyleSheet.create({
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    minHeight: 148 + Math.round(Math.max(0, effectiveScale - 1) * 64),
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  webPressable: {
    cursor: 'pointer',
  },
  titleBlock: {
    flex: 0,
    minHeight: getGridMenuCardTitleBlockMinHeight(effectiveScale),
  },
  title: {
    fontSize: scaleTypographyMetric(15, textScale),
    fontWeight: '700',
    // color will be set via theme (onSurface) in component
    lineHeight: scaleTypographyMetric(20, textScale),
    maxWidth: '90%',
  },
  subtitle: {
    fontSize: scaleTypographyMetric(12, textScale),
    lineHeight: scaleTypographyMetric(18, textScale),
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
