import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import {
  ImageBackground,
  type ImageSourcePropType,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { Text } from 'react-native-paper';

type TitleHeroProps = {
  imageSource: ImageSourcePropType;
  title: string;
};

/** A compact page hero for routes that need visual identity without a verse panel. */
export function TitleHero({ imageSource, title }: TitleHeroProps) {
  const theme = useAppTheme();
  const headerHeight = useGlobalHeaderHeight();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const styles = useMemo(
    () => createStyles(textScale, Math.max(1, fontScale * textScale)),
    [fontScale, textScale],
  );

  return (
    <View style={[styles.shadow, { shadowColor: theme.dark ? '#000000' : '#243B53' }]}>
      <View style={styles.frame}>
        <ImageBackground
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
        >
          <LinearGradient
            colors={['rgba(0,0,0,0.42)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.72)']}
            locations={[0, 0.45, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.titleArea, { paddingTop: headerHeight + 6 }]}>
            <Text variant="headlineSmall" style={styles.title}>
              {title}
            </Text>
          </View>
        </ImageBackground>
      </View>
    </View>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  effectiveScale: number,
) =>
  StyleSheet.create({
    shadow: {
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      elevation: 7,
      marginBottom: 20,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
      width: '100%',
    },
    frame: {
      borderBottomLeftRadius: 32,
      borderBottomRightRadius: 32,
      overflow: 'hidden',
    },
    image: {
      justifyContent: 'flex-end',
      minHeight: 200 + Math.round(Math.max(0, effectiveScale - 1) * 40),
      width: '100%',
    },
    titleArea: {
      justifyContent: 'flex-end',
      minHeight: 200 + Math.round(Math.max(0, effectiveScale - 1) * 40),
      paddingBottom: 22,
      paddingHorizontal: 20,
    },
    title: {
      color: '#FFFFFF',
      fontSize: scaleTypographyMetric(28, textScale),
      fontWeight: 'bold',
      lineHeight: scaleTypographyMetric(36, textScale),
      textShadowColor: 'rgba(0,0,0,0.5)',
      textShadowOffset: { width: 0, height: 2 },
      textShadowRadius: 5,
    },
  });
