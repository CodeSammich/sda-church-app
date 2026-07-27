import { MenuCard } from '@/components/MenuCard';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openSabbathSchool,
  openSermonArchive,
  openSpotifyPodcast,
  openZoomClass,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useContext } from 'react';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { List, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const allLabels = {
  en: {
    title: 'Resources',
    sermonsWorship: 'Watch & Listen',
    studyLiturgy: 'Study & Liturgy',
    bible: 'Holy Bible',
    bibleSub: 'Read scripture in multiple languages',
    youtube: 'Sermon Archive',
    youtubeSub: 'Watch our latest sermons and worship services',
    spotify: 'Audio Archive',
    spotifySub: 'Listen to sermons and classes',
    sabbathSchool: 'Sabbath School',
    sabbathSchoolSub: 'Weekly Bible study guides and discussion',
    zoomClass: 'Zoom Class',
    zoomSub:
      'Interactive Bible study and fellowship',
    hymnal: 'Hymnal',
    hymnalSub: 'English and Chinese worship music',
    library: 'Library',
    librarySub: 'Devotionals, PDFs and guides',
  },
  zh: {
    title: '資源庫',
    sermonsWorship: '觀看與收聽',
    studyLiturgy: '研經與禮儀',
    bible: '聖經',
    bibleSub: '閱讀多種語言的聖經',
    youtube: '講道回顧',
    youtubeSub: '觀看最新的講道與崇拜影片',
    spotify: '音頻檔案',
    spotifySub: '收聽證道與課程',
    sabbathSchool: '安息日學',
    sabbathSchoolSub: '每週研經指南與討論',
    zoomClass: 'Zoom 課程',
    zoomSub: '互動式研經與團契。',
    hymnal: '詩歌本',
    hymnalSub: '中英文敬拜音樂',
    library: '圖書館',
    librarySub: '靈修資料、PDF 與指南',
  },
  'zh-cn': {
    title: '资源库',
    sermonsWorship: '观看与收听',
    studyLiturgy: '研经与礼仪',
    bible: '圣经',
    bibleSub: '阅读多种语言的圣经',
    youtube: '讲道回顾',
    youtubeSub: '观看最新的讲道与崇拜视频',
    spotify: '音频存档',
    spotifySub: '收听证道与课程',
    sabbathSchool: '安息日学',
    sabbathSchoolSub: '每周研经指南与讨论',
    zoomClass: 'Zoom 课程',
    zoomSub: '互动式研经与团契。',
    hymnal: '诗歌本',
    hymnalSub: '中英文敬拜音乐',
    library: '图书馆',
    librarySub: '灵修资料、PDF 与指南',
  },
  es: {
    title: 'Recursos',
    sermonsWorship: 'Ver y Escuchar',
    studyLiturgy: 'Estudio y Liturgia',
    bible: 'Santa Biblia',
    bibleSub: 'Lee las escrituras en varios idiomas',
    youtube: 'Archivo de Sermones',
    youtubeSub: 'Vea nuestros últimos sermones y servicios de adoración',
    spotify: 'Archivo de Audio',
    spotifySub: 'Escucha sermones y clases',
    sabbathSchool: 'Escuela Sabática',
    sabbathSchoolSub: 'Guías de estudio bíblico semanal y discusión',
    zoomClass: 'Clase de Zoom',
    zoomSub:
      'Estudio bíblico interactivo y compañerismo.',
    hymnal: 'Himnario',
    hymnalSub: 'Música de adoración en inglés y chino',
    library: 'Biblioteca',
    librarySub: 'Devocionales, PDFs y guías',
  },
};

export default function ResourcesScreen() {
  const theme = useAppTheme();
  const { language } = useContext(LanguageContext);
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  const insets = useSafeAreaInsets();

  return (
    <>
      <Stack.Screen options={{ title: labels.title }} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={{ paddingBottom: 80 }}
      >
        <ImageBackground
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[
            NavigationStyles.heroHeader,
            { paddingTop: insets.top + 70, paddingBottom: 24 },
          ]}
          resizeMode="cover"
        >
          <LinearGradient
            colors={theme.gradients.heroOverlay}
            style={StyleSheet.absoluteFill}
          />
          <Text
            variant="headlineSmall"
            style={[
              NavigationStyles.heroTitle,
              { color: theme.dark ? theme.colors.onSurface : theme.colors.onSecondary },
            ]}
          >
            {labels.title}
          </Text>
        </ImageBackground>

        <View style={styles.body}>
          <List.Section>
            <List.Subheader
              style={[
                NavigationStyles.subheader,
                { color: theme.colors.onBackground },
              ]}
            >
              {labels.studyLiturgy}
            </List.Subheader>
            <MenuCard
              title={labels.hymnal}
              description={labels.hymnalSub}
              icon="music-note"
              iconColor={theme.colors.tertiary}
              onPress={() =>
                router.push({
                  pathname: '/resources/hymnal-selection',
                  params: { backTo: '/resources' },
                } as any)
              }
            />

            <MenuCard
              title={labels.sabbathSchool}
              description={labels.sabbathSchoolSub}
              icon="book-open-variant"
              iconColor={theme.colors.tertiary}
              rightIcon="open-in-new"
              onPress={() => openSabbathSchool(language)}
            />

            <MenuCard
              title={labels.library}
              description={labels.librarySub}
              icon="bookshelf"
              iconColor={theme.colors.tertiary}
              onPress={() => {}} // TODO: Implement library page
            />
          </List.Section>

          <List.Section>
            <List.Subheader
              style={[
                NavigationStyles.subheader,
                { color: theme.colors.onBackground },
              ]}
            >
              {labels.sermonsWorship}
            </List.Subheader>
            <MenuCard
              title={labels.youtube}
              description={labels.youtubeSub}
              icon="youtube"
              iconColor={(theme.colors as any).brandYoutube}
              onPress={openSermonArchive}
              rightIcon="open-in-new"
            />

            <MenuCard
              title={labels.spotify}
              description={labels.spotifySub}
              icon="spotify"
              iconColor={(theme.colors as any).brandSpotify}
              onPress={openSpotifyPodcast}
              rightIcon="open-in-new"
            />

            <MenuCard
              title={labels.zoomClass}
              description={labels.zoomSub}
              icon="video"
              iconColor={(theme.colors as any).brandZoom}
              onPress={openZoomClass}
              rightIcon="open-in-new"
            />
          </List.Section>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
  },
});
