import { MenuCard } from '@/components/MenuCard';
import { VerseHero } from '@/components/VerseHero';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openChineseHymnalAndroid,
  openChineseHymnalIos,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ScrollView } from 'react-native';
import { List } from 'react-native-paper';

const uiLabels = {
  en: {
    title: 'Select Hymnal',
    verse: '“Is anyone among you in trouble? Let them pray. Is anyone happy? Let them sing songs of praise.”',
    verseRef: 'James 5:13 (NIV)',
    english: 'English Hymnal',
    englishSub: 'Lyrics and music for worship',
    chineseIos: 'Chinese Hymnal (iOS)',
    chineseIosSub: 'Traditional Chinese Hymnal 506 for iPhone/iPad',
    chineseAndroid: 'Chinese Hymnal (Android)',
    chineseAndroidSub: 'Traditional Chinese Hymnal 506 for Android',
  },
  zh: {
    title: '選擇詩歌本',
    verse: '「你們中間有受苦的呢，他就該禱告；有喜樂的呢，他就該歌頌。」',
    verseRef: '雅各書 5:13 (CUV)',
    english: '英文詩歌本',
    englishSub: '敬拜用的歌詞與音樂',
    chineseIos: '506 讚美詩 (iOS)',
    chineseIosSub: '繁體中文讚美詩 iPhone/iPad 版',
    chineseAndroid: '506 讚美詩 (Android)',
    chineseAndroidSub: '繁體中文讚美詩 Android 版',
  },
  'zh-cn': {
    title: '选择诗歌本',
    verse: '“你们中间有受苦的呢，他就该祷告；有喜乐的呢，他就该歌颂。”',
    verseRef: '雅各书 5:13 (CUVS)',
    english: '英文诗歌本',
    englishSub: '敬拜用的歌词与音乐',
    chineseIos: '506 赞美诗 (iOS)',
    chineseIosSub: '繁体中文赞美诗 iPhone/iPad 版',
    chineseAndroid: '506 赞美诗 (Android)',
    chineseAndroidSub: '繁体中文赞美诗 Android 版',
  },
  es: {
    title: 'Seleccionar Himnario',
    verse: '“¿Está alguno entre vosotros afligido? Haga oración. ¿Está alguno alegre? Cante alabanzas.”',
    verseRef: 'Santiago 5:13 (RVR1960)',
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
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  return (
    <>
      <Stack.Screen
        options={{ title: labels.title, backTo, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={NavigationStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0, paddingBottom: 80 }}
      >
        <VerseHero
          title={labels.title}
          verse={labels.verse}
          reference={labels.verseRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={
            theme.dark
              ? ['#242052', '#312B6B', '#3D3782']
              : ['#312E81', '#4338CA', '#6366F1']
          }
        />

        {/* Body */}
        <List.Section style={{ paddingHorizontal: 20 }}>
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
