import { MenuCard } from '@/components/MenuCard';
import {
  EXTERNAL_BRAND_ASSETS,
  EXTERNAL_BRAND_ICON_CONTENT_SCALE,
} from '@/constants/ExternalBrandAssets';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openSermonArchive,
  openSpotifyPodcast,
  openZoomClass,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { openSdaBible } from '@/features/library/SdaBibleReader';
import { APP_ICONOGRAPHY } from '@/constants/Iconography';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useHeroUnderStatusBar } from '@/hooks/useHeroUnderStatusBar';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useContext } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { ImageBackground } from '@/components/ImageBackground';
import { Text } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'Explore',
    bible: 'Holy Bible',
    bibleSub: 'Read scripture in multiple languages',
    youtube: 'Sermon Archive',
    youtubeSub: 'Watch our latest sermons and worship services',
    spotify: 'Audio Archive',
    spotifySub: 'Listen to sermons and classes',
    zoomClass: 'Zoom Class',
    zoomSub:
      'Interactive Bible study and fellowship',
    library: 'Library',
    librarySub: 'Books our church recommends: Christian classics, children\'s books, and Adventist writings',
    sdaBible: 'In-depth Bible Study',
    sdaBibleSub: 'SDA Bible app: commentary and 1,000+ books',
  },
  zh: {
    title: '探索',
    bible: '聖經',
    bibleSub: '閱讀多種語言的聖經',
    youtube: '講道回顧',
    youtubeSub: '觀看最新的講道與崇拜影片',
    spotify: '音頻檔案',
    spotifySub: '收聽證道與課程',
    zoomClass: 'Zoom 課程',
    zoomSub: '互動式研經與團契。',
    library: '精選書庫',
    librarySub: '教會推薦的書籍：基督教經典、兒童讀物與復臨著作',
    sdaBible: '深入研經',
    sdaBibleSub: 'SDA Bible 應用程式：聖經註釋與一千多本書籍',
  },
  'zh-cn': {
    title: '探索',
    bible: '圣经',
    bibleSub: '阅读多种语言的圣经',
    youtube: '讲道回顾',
    youtubeSub: '观看最新的讲道与崇拜视频',
    spotify: '音频存档',
    spotifySub: '收听证道与课程',
    zoomClass: 'Zoom 课程',
    zoomSub: '互动式研经与团契。',
    library: '精选书库',
    librarySub: '教会推荐的书籍：基督教经典、儿童读物与复临著作',
    sdaBible: '深入研经',
    sdaBibleSub: 'SDA Bible 应用程序：圣经注释与一千多本书籍',
  },
  es: {
    title: 'Explorar',
    bible: 'Santa Biblia',
    bibleSub: 'Lee las escrituras en varios idiomas',
    youtube: 'Archivo de Sermones',
    youtubeSub: 'Vea nuestros últimos sermones y servicios de adoración',
    spotify: 'Archivo de Audio',
    spotifySub: 'Escucha sermones y clases',
    zoomClass: 'Clase de Zoom',
    zoomSub:
      'Estudio bíblico interactivo y compañerismo.',
    library: 'Biblioteca',
    librarySub: 'Libros que recomienda nuestra iglesia: clásicos cristianos, libros infantiles y escritos adventistas',
    sdaBible: 'Estudio bíblico a fondo',
    sdaBibleSub: 'App SDA Bible: comentarios y más de 1.000 libros',
  },
};

export default function ExploreScreen() {
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { language } = useContext(LanguageContext);
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  const headerHeight = useGlobalHeaderHeight();
  const { heroUnderStatusBar, onHeroLayout, onScroll } = useHeroUnderStatusBar();

  return (
    <>
      <Stack.Screen options={{ title: labels.title, heroUnderStatusBar } as any} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={styles.content}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <ImageBackground
          onLayout={onHeroLayout}
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[
            NavigationStyles.heroHeader,
            { paddingTop: headerHeight + 6, paddingBottom: 24 },
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

        <View style={styles.cardList}>
          <MenuCard
            title={labels.library}
            description={labels.librarySub}
            icon={APP_ICONOGRAPHY.explore.library}
            iconColor={theme.colors.tertiary}
            rightIcon={{ name: 'chevron-right' }}
            onPress={() => router.push('/explore/library')}
          />

          <MenuCard
            title={labels.youtube}
            description={labels.youtubeSub}
            imageSource={EXTERNAL_BRAND_ASSETS.youtubeIcon.light}
            darkImageSource={EXTERNAL_BRAND_ASSETS.youtubeIcon.dark}
            imageContentScale={EXTERNAL_BRAND_ICON_CONTENT_SCALE.youtube}
            onPress={openSermonArchive}
          />

          <MenuCard
            title={labels.spotify}
            description={labels.spotifySub}
            imageSource={EXTERNAL_BRAND_ASSETS.spotifyIcon.light}
            darkImageSource={EXTERNAL_BRAND_ASSETS.spotifyIcon.dark}
            onPress={openSpotifyPodcast}
          />

          {/* The SDA Bible app's commentary and nearly all its books are in
              Chinese, so the card shows only in Chinese (#554). */}
          {(language === 'zh' || language === 'zh-cn') && (
            <MenuCard
              title={labels.sdaBible}
              description={labels.sdaBibleSub}
              icon={APP_ICONOGRAPHY.explore.sdaBible}
              iconColor={theme.colors.tertiary}
              onPress={() => openSdaBible(language)}
            />
          )}

          <MenuCard
            title={labels.zoomClass}
            description={labels.zoomSub}
            icon={{ name: 'video' }}
            iconColor={theme.colors.brandZoom}
            onPress={openZoomClass}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 16,
  },
  cardList: {
    paddingHorizontal: 20,
  },
});
