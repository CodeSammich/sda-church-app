import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { AppIcon } from '@/components/AppIcon';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import {
  ImageBackground,
  ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

type VerseHeroProps = {
  title: string;
  verse: string;
  reference: string;
  imageSource: ImageSourcePropType;
  verseColors: [string, string, ...string[]];
};

/**
 * A page hero whose image flows directly into a scripture panel. Keeping the
 * image and verse inside one clipped shape makes the verse feel like part of
 * the page introduction instead of a separate content card.
 */
export function VerseHero({
  title,
  verse,
  reference,
  imageSource,
  verseColors,
}: VerseHeroProps) {
  const theme = useAppTheme();
  const headerHeight = useGlobalHeaderHeight();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(textScale, Math.max(1, fontScale * textScale)),
    [fontScale, textScale],
  );

  return (
    <View style={[styles.shadow, { shadowColor: theme.dark ? '#000000' : verseColors[0] }]}>
      <View style={styles.frame}>
        <ImageBackground source={imageSource} style={styles.image} resizeMode="cover">
          <LinearGradient
            colors={['rgba(0,0,0,0.46)', 'rgba(0,0,0,0.1)', 'rgba(0,0,0,0.68)']}
            locations={[0, 0.46, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.titleArea, { paddingTop: headerHeight + 6 }]}>
            <Text variant="headlineSmall" style={styles.title}>
              {title}
            </Text>
          </View>
        </ImageBackground>

        <LinearGradient
          colors={verseColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.versePanel}
        >
          <View pointerEvents="none" style={styles.glow} />
          <View style={styles.verseLead}>
            <View style={styles.iconDisc}>
              <AppIcon
                name="format-quote-open"
                size={20}
                color="rgba(255,255,255,0.92)"
              />
            </View>
            <View style={styles.rule} />
          </View>
          <Text variant="bodyLarge" style={styles.verse}>
            {verse}
          </Text>
          <Text variant="labelMedium" style={styles.reference}>
            — {reference}
          </Text>
        </LinearGradient>
      </View>
    </View>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveScale: number,
) => StyleSheet.create({
  shadow: {
    width: '100%',
    marginBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 18,
    elevation: 7,
  },
  frame: {
    overflow: 'hidden',
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  image: {
    width: '100%',
    minHeight: 220 + Math.round(Math.max(0, effectiveScale - 1) * 48),
    justifyContent: 'flex-end',
  },
  titleArea: {
    minHeight: 220 + Math.round(Math.max(0, effectiveScale - 1) * 48),
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 22,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: scaleTypographyMetric(28, textScale),
    lineHeight: scaleTypographyMetric(36, textScale),
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 5,
  },
  versePanel: {
    minHeight: 150,
    paddingHorizontal: 22,
    paddingTop: 18,
    paddingBottom: 24,
    overflow: 'hidden',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.24)',
  },
  glow: {
    position: 'absolute',
    width: 190,
    height: 190,
    borderRadius: 95,
    right: -70,
    top: -105,
    backgroundColor: 'rgba(255,255,255,0.09)',
  },
  verseLead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  iconDisc: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  rule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    marginLeft: 12,
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  verse: {
    color: '#FFFFFF',
    fontStyle: 'italic',
    lineHeight: scaleTypographyMetric(25, textScale),
    letterSpacing: 0.1,
  },
  reference: {
    color: 'rgba(255,255,255,0.86)',
    marginTop: 12,
    textAlign: 'right',
    fontWeight: 'bold',
    letterSpacing: 0.4,
  },
});
