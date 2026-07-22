import { MenuCard } from '@/components/MenuCard';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openChineseHymnalAndroid,
  openChineseHymnalIos,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useAppTheme } from '@/constants/Themes';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ImageBackground, ScrollView, StyleSheet } from 'react-native';
import { List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const uiLabels = {
  en: {
    title: 'Select Hymnal',
    english: 'English Hymnal',
    englishSub: 'Lyrics and music for worship',
    chineseIos: 'Chinese Hymnal (iOS)',
    chineseIosSub: 'Traditional Chinese Hymnal 506 for iPhone/iPad',
    chineseAndroid: 'Chinese Hymnal (Android)',
    chineseAndroidSub: 'Traditional Chinese Hymnal 506 for Android',
  },
  zh: {
    title: '選擇詩歌本',
    english: '英文詩歌本',
    englishSub: '敬拜用的歌詞與音樂',
    chineseIos: '506 讚美詩 (iOS)',
    chineseIosSub: '繁體中文讚美詩 iPhone/iPad 版',
    chineseAndroid: '506 讚美詩 (Android)',
    chineseAndroidSub: '繁體中文讚美詩 Android 版',
  },
  'zh-cn': {
    title: '选择诗歌本',
    english: '英文诗歌本',
    englishSub: '敬拜用的歌词与音乐',
    chineseIos: '506 赞美诗 (iOS)',
    chineseIosSub: '繁体中文赞美诗 iPhone/iPad 版',
    chineseAndroid: '506 赞美诗 (Android)',
    chineseAndroidSub: '繁体中文赞美诗 Android 版',
  },
  es: {
    title: 'Seleccionar Himnario',
    english: 'Himnario en Inglés',
    englishSub: 'Letras y música para la adoración',
    chineseIos: 'Himnario Chino (iOS)',
    chineseIosSub: 'Himnario en Chino Tradicional para iPhone/iPad',
    chineseAndroid: 'Himnario Chino (Android)',
    chineseAndroidSub: 'Himnario en Chino Tradicional para Android',
  },
};

export default function HymnalSelectionScreen() {
  const theme = useAppTheme();
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const labels = uiLabels[language as keyof typeof uiLabels] || uiLabels.en;

  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + DESIGN_TOKENS.HEADER_HEIGHT_BASE;

  return (
    <>
      <Stack.Screen options={{ title: labels.title, backTo } as any} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={[
          NavigationStyles.contentContainer,
          { paddingTop: headerHeight },
        ]}
      >
        {/* Hero */}
        <ImageBackground
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[NavigationStyles.heroHeader, { paddingTop: insets.top + 70, paddingBottom: 24 }]}
          resizeMode="cover"
        >
          <LinearGradient
            colors={theme.gradients.heroOverlay}
            style={StyleSheet.absoluteFill}
          />
          <Text
            variant="headlineSmall"
            style={[NavigationStyles.heroTitle, { color: theme.colors.onSecondary }]}
          >
            {labels.title}
          </Text>
        </ImageBackground>

        {/* Body */}
        <List.Section>
          <MenuCard
            title={labels.english}
            description={labels.englishSub}
            icon="music-note"
            iconColor={theme.colors.tertiary}
            onPress={() =>
              router.push({
                pathname: '/resources/english-hymnal',
                params: {
                  backTo: '/resources/hymnal-selection',
                  refresh: Date.now().toString(),
                },
              } as any)
            }
          />

          <MenuCard
            title={labels.chineseIos}
            description={labels.chineseIosSub}
            icon="apple"
            iconColor={theme.colors.tertiary}
            rightIcon="open-in-new"
            onPress={openChineseHymnalIos}
          />

          <MenuCard
            title={labels.chineseAndroid}
            description={labels.chineseAndroidSub}
            icon="google-play"
            iconColor={theme.colors.tertiary}
            rightIcon="open-in-new"
            onPress={openChineseHymnalAndroid}
          />
        </List.Section>
      </ScrollView>
    </>
  );
}
