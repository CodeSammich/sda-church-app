import { GridMenuCard, useGridMenuCardColumns } from '@/components/GridMenuCard';
import { contentColumnStyle, getContentWidth } from '@/constants/Layout';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useContentColumnScale } from '@/hooks/useContentColumnScale';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useContext, useMemo } from 'react';
import {
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { ImageBackground } from '@/components/ImageBackground';
import { Text } from 'react-native-paper';
import { TabBarSpacer } from '@/constants/BottomTabHeightContext';

export default function DiscoverScreen() {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const columnScale = useContentColumnScale();
  const DocumentStyles = useDocumentStyles();
  const NavigationStyles = useNavigationStyles();
  const headerHeight = useGlobalHeaderHeight();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();
  const { width: windowWidth } = useWindowDimensions();
  // Two cards a row, or one where a word of their titles wouldn't fit beside
  // another card at the reader's text size, as on Home.
  const { columns: gridColumns, onWidestWord: onGridWidestWord } = useGridMenuCardColumns(
    getContentWidth(windowWidth, columnScale) - 2 * GRID_PADDING,
    GRID_GAP,
  );
  const gridCellStyle = [styles.gridCell, gridColumns === 1 && styles.gridCellFullRow];
  const gridTitleLines = gridColumns === 1 ? 2 : 3;

  const allLabels = {
    en: {
      title: 'New Member & Visitor',
      aboutSDA: 'About Denomination',
      aboutHistory: 'Locations & History',
      meetTeam: 'Meet Our Team',
      fellowship: 'Fellowship',
      bible: 'Holy Bible',
      join: 'Joining the Church',
    },
    zh: {
      title: '新會友／訪客',
      aboutSDA: '關於教派',
      // A zero-width space (\u200b) marks where a card's title may break,
      // between its words, as on Home.
      aboutHistory: '地點\u200b與歷史',
      meetTeam: '認識\u200b我們的\u200b團隊',
      fellowship: '團契',
      bible: '聖經',
      join: '加入教會',
    },
    'zh-cn': {
      title: '新会友／访客',
      aboutSDA: '关于教派',
      aboutHistory: '地点\u200b与历史',
      meetTeam: '认识\u200b我们的\u200b团队',
      fellowship: '团契',
      bible: '圣经',
      join: '加入教会',
    },
    es: {
      title: 'Nuevo miembro & Visitante',
      aboutSDA: 'Sobre la Denominación',
      aboutHistory: 'Ubicaciones e Historia',
      meetTeam: 'Conoce a nuestro equipo',
      fellowship: 'Compañerismo',
      bible: 'Santa Biblia',
      join: 'Unirse a la Iglesia',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;
  // Every card's title, whose widest word decides whether two cards fit a row.
  const gridTitles = useMemo(
    () => [labels.aboutSDA, labels.aboutHistory, labels.meetTeam, labels.join, labels.fellowship, labels.bible],
    [labels],
  );

  return (
    <>
      <Stack.Screen options={{ title: labels.title, showTitleChip: showHeaderTitle } as any} />
      <ScrollView
        style={DocumentStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        {/* Hero */}
        <ImageBackground
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[NavigationStyles.heroHeader, { paddingTop: headerHeight + 6, paddingBottom: 24 }]}
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

        {/* Body */}
        <View style={[styles.grid, contentColumnStyle(columnScale)]}>
          <GridMenuCard
            fitTitles={gridTitles}
            onWidestWord={onGridWidestWord}
            title={labels.aboutSDA}
            titleBlockLines={gridTitleLines}
            icon="cross"
            color={theme.colors.cardBgColors.aboutSDA}
            iconColor={theme.colors.iconColors.aboutSDA}
            onPress={() => router.push({ pathname: '/home/about-sda', params: { backTo: '/home/discover' } } as any)}
    style={gridCellStyle}
    showArrow={false}
          />
          <GridMenuCard
            fitTitles={gridTitles}
            onWidestWord={onGridWidestWord}
            title={labels.aboutHistory}
            titleBlockLines={gridTitleLines}
            icon="map-marker-path"
            color={theme.colors.cardBgColors.aboutHistory}
            iconColor={theme.colors.iconColors.aboutHistory}
            onPress={() => router.push({ pathname: '/home/about-my-church', params: { backTo: '/home/discover' } } as any)}
    style={gridCellStyle}
    showArrow={false}
          />
          <GridMenuCard
            fitTitles={gridTitles}
            onWidestWord={onGridWidestWord}
            title={labels.meetTeam}
            titleBlockLines={gridTitleLines}
            icon="card-account-phone"
            color={theme.colors.cardBgColors.meetTeam}
            iconColor={theme.colors.iconColors.meetTeam}
            onPress={() => router.push({ pathname: '/home/team', params: { backTo: '/home/discover' } } as any)}
    style={gridCellStyle}
    showArrow={false}
          />
          <GridMenuCard
            fitTitles={gridTitles}
            onWidestWord={onGridWidestWord}
            title={labels.join}
            titleBlockLines={gridTitleLines}
            icon="water-outline"
            color={theme.colors.cardBgColors.join}
            iconColor={theme.colors.iconColors.join}
            onPress={() => router.push({ pathname: '/home/baptism', params: { backTo: '/home/discover' } } as any)}
    style={gridCellStyle}
    showArrow={false}
          />
          <GridMenuCard
            fitTitles={gridTitles}
            onWidestWord={onGridWidestWord}
            title={labels.fellowship}
            titleBlockLines={gridTitleLines}
            icon="handshake"
            color={theme.colors.cardBgColors.fellowship}
            iconColor={theme.colors.iconColors.fellowship}
            onPress={() => router.push({ pathname: '/home/fellowship', params: { backTo: '/home/discover' } } as any)}
    style={gridCellStyle}
    showArrow={false}
          />
          <GridMenuCard
            fitTitles={gridTitles}
            onWidestWord={onGridWidestWord}
            title={labels.bible}
            titleBlockLines={gridTitleLines}
            icon="book-cross"
            color={theme.colors.cardBgColors.bible}
            iconColor={theme.colors.iconColors.bible}
            onPress={() => router.push({ pathname: '/bible', params: { backTo: '/home/discover' } } as any)}
    style={gridCellStyle}
    showArrow={false}
          />
        </View>
        <TabBarSpacer />
      </ScrollView>
    </>
  );
}

// The grid's margins and the gap between its cards.
const GRID_PADDING = 16;
const GRID_GAP = 8;

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GRID_GAP,
    marginBottom: 8,
    paddingHorizontal: GRID_PADDING,
  },
  gridCell: {
    flexBasis: '47.5%',
    flexGrow: 1,
  },
  gridCellFullRow: {
    flexBasis: '100%',
  },
});
