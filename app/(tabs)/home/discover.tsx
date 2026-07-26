import { GridMenuCard } from '@/components/GridMenuCard';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { DocumentStyles } from '@/styles/DocumentStyles';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useContext } from 'react';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function DiscoverScreen() {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top;
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const allLabels = {
    en: {
      title: 'Discover',
      aboutSDA: 'About Denomination',
      aboutHistory: 'Locations & History',
      meetTeam: 'Meet Our Team',
      fellowship: 'Fellowship',
      bible: 'Holy Bible',
      join: 'Joining the Church',
    },
    zh: {
      title: '探索',
      aboutSDA: '關於教派',
      aboutHistory: '地點與歷史',
      meetTeam: '認識我們的團隊',
      fellowship: '團契',
      bible: '聖經',
      join: '加入教會',
    },
    'zh-cn': {
      title: '探索',
      aboutSDA: '关于教派',
      aboutHistory: '地点与历史',
      meetTeam: '认识我们的团队',
      fellowship: '团契',
      bible: '圣经',
      join: '加入教会',
    },
    es: {
      title: 'Descubrir',
      aboutSDA: 'Sobre la Denominación',
      aboutHistory: 'Ubicaciones e Historia',
      meetTeam: 'Conoce a nuestro equipo',
      fellowship: 'Compañerismo',
      bible: 'Santa Biblia',
      join: 'Unirse a la Iglesia',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen options={{ title: labels.title, showTitleChip: showHeaderTitle } as any} />
      <ScrollView
        style={DocumentStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: headerHeight }}
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
        <View style={styles.grid}>
          <GridMenuCard
            title={labels.aboutSDA}
            icon="cross"
            color={theme.colors.cardBgColors.aboutSDA}
            iconColor={theme.colors.iconColors.aboutSDA}
            onPress={() => router.push({ pathname: '/home/about-sda', params: { backTo: '/home/discover' } } as any)}
            style={styles.gridCell}
          />
          <GridMenuCard
            title={labels.aboutHistory}
            icon="map-marker-path"
            color={theme.colors.cardBgColors.aboutHistory}
            iconColor={theme.colors.iconColors.aboutHistory}
            onPress={() => router.push({ pathname: '/home/about-my-church', params: { backTo: '/home/discover' } } as any)}
            style={styles.gridCell}
          />
          <GridMenuCard
            title={labels.meetTeam}
            icon="card-account-phone"
            color={theme.colors.cardBgColors.meetTeam}
            iconColor={theme.colors.iconColors.meetTeam}
            onPress={() => router.push({ pathname: '/home/team', params: { backTo: '/home/discover' } } as any)}
            style={styles.gridCell}
          />
          <GridMenuCard
            title={labels.join}
            icon="water-outline"
            color={theme.colors.cardBgColors.join}
            iconColor={theme.colors.iconColors.join}
            onPress={() => router.push({ pathname: '/home/baptism', params: { backTo: '/home/discover' } } as any)}
            style={styles.gridCell}
          />
          <GridMenuCard
            title={labels.fellowship}
            icon="handshake"
            color={theme.colors.cardBgColors.fellowship}
            iconColor={theme.colors.iconColors.fellowship}
            onPress={() => router.push({ pathname: '/home/fellowship', params: { backTo: '/home/discover' } } as any)}
            style={styles.gridCell}
          />
          <GridMenuCard
            title={labels.bible}
            icon="book-cross"
            color={theme.colors.cardBgColors.bible}
            iconColor={theme.colors.iconColors.bible}
            onPress={() => router.push({ pathname: '/bible', params: { backTo: '/home/discover' } } as any)}
            style={styles.gridCell}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  gridCell: {
    flexBasis: '47.5%',
    flexGrow: 1,
  },
});
