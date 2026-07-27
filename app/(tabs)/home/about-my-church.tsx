import { CHURCH_LOCATIONS, getLocationNames } from '@/constants/ChurchData';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openAtlanticUnion,
  openGNYC,
  openInMaps,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { DESIGN_TOKENS } from '@/constants/Layout';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { DocumentStyles } from '@/styles/DocumentStyles';
import { NavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function AboutChurchHistoryScreen() {
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + DESIGN_TOKENS.HEADER_HEIGHT_BASE;
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const allLabels = {
    en: {
      title: 'History',
      churchName: 'New York Chinese\nSeventh-day Adventist\nChurch',
      history: 'History',
      historySubtext:
        'The New York Chinese Seventh-day Adventist Church began as a humble gathering in 1973. Today, we are a vibrant community dedicated to outreach and supporting our neighbors.',
      milestoneItems: [
        { year: '1973', event: 'First home gathering' },
        { year: '1987', event: 'Officially organized' },
        { year: '1996', event: 'Joined conference' },
        { year: '1999', event: 'Opened permanent home' },
      ],
      locationsTitle: 'Locations & Services',
      elmhurstText:
        'Church services are conducted in both English and Mandarin Chinese. We are blessed to have a vibrant, multiethnic congregation. Our members come from various backgrounds and speak many languages, including Spanish, French, German, Japanese, and more.',
      flushingText:
        'A subgroup of our Elmhurst location where we foster community. This includes meals, personal testimony, a lesson/sermon, prayer, and worship.',
      brooklynText:
        'In Bay Ridge, Brooklyn, we hold a traditional worship service on Sabbaths. This service is conducted in Mandarin and includes prayer, song service, a sermon, and offerings, providing a unique opportunity for spiritual growth and fellowship.',
      organization: 'Affiliations',
      localConference: 'Local Conference',
      localConfName: 'Greater New York Conference',
      localConfDesc:
        'Our local congregation is part of a network of churches across the New York metropolitan area.',
      unionConference: 'Union Conference',
      unionConfName: 'Atlantic Union Conference',
      unionConfDesc:
        'The Atlantic Union coordinates Adventist mission and education across the Northeast United States and Bermuda.',
      learnMore: 'Learn More',
      getDirections: 'Get Directions',
    },
    zh: {
      title: '歷史',
      churchName: '紐約華人基督復臨安息日會',
      history: '歷史',
      historySubtext:
        '紐約華人基督復臨安息日會始於 1973 年。今天, 我們是一個充滿活力的雙語社群, 始終致力於外展使命並支持鄰居。',
      milestoneItems: [
        { year: '1973', event: '首次住宅聚會' },
        { year: '1987', event: '會眾正式成立' },
        { year: '1996', event: '加入紐約區會' },
        { year: '1999', event: '永久會所落成' },
      ],
      locationsTitle: '聚會地點與服務',
      elmhurstText:
        '聚會以英語和國語進行。我們擁有一個充滿活力的多民族會眾。我們的成員來自不同的背景並說多種語言，包括西班牙語、法語、德語、日語等。',
      flushingText:
        '艾姆赫斯特教會的子小組，我們在那裡建立社群。聚會內容包括用餐、個人見證、講道、禱告和敬拜。',
      brooklynText:
        '在布魯克林的 Bay Ridge，我們在安息日舉行傳統崇拜服務。該服務以國語進行，包括禱告、詩歌讚美、證道和奉獻，為靈命成長和團契提供獨特機會。',
      organization: '教會組織',
      localConference: '區會',
      localConfName: '大紐約區會',
      localConfDesc: '我們的在地會眾是大紐約大都會地區教會網絡的一部分。',
      unionConference: '聯合會',
      unionConfName: '大西洋聯合會',
      unionConfDesc: '大西洋聯合會負責協調美國東北部和百慕達地區的復臨教會使命與教育。',
      learnMore: '了解更多',
      getDirections: '獲取路線',
    },
    'zh-cn': {
      title: '历史',
      churchName: '纽约华人基督复临安息日会',
      history: '历史',
      historySubtext:
        '纽约华人基督复临安息日会始于 1973 年。今天, 我们是一个充满活力的双语社群, 始终致力于外展使命并支持邻居。',
      milestoneItems: [
        { year: '1973', event: '首次住宅聚会' },
        { year: '1987', event: '会众正式成立' },
        { year: '1996', event: '加入纽约区会' },
        { year: '1999', event: '永久会所落成' },
      ],
      locationsTitle: '聚会地点与服务',
      elmhurstText:
        '聚会以英语和普通话进行。我们拥有一个充满活力的多民族会众。我们的成员来自不同的背景并说多种语言，包括西班牙语、法语、德语、日语等。',
      flushingText:
        '艾姆赫斯特教会的子小组，我们在那里建立社区。聚会内容包括用餐、个人见证、讲道、祷告和敬拜。',
      brooklynText:
        '在布鲁克林的 Bay Ridge，我们在安息日举行传统崇拜服务。该服务以普通话进行，包括祷告、诗歌赞美、证道和奉献，为灵命成长和团契提供独特机会。',
      organization: '教会组织',
      localConference: '区会',
      localConfName: '大纽约区会',
      localConfDesc: '我们的在地会众是大纽约大都会地区教会网络的一部分。',
      unionConference: '联合会',
      unionConfName: '大西洋联合会',
      unionConfDesc: '大西洋联合会负责协调美国东北部和百慕大地区的复临教会使命与教育。',
      learnMore: '了解更多',
      getDirections: '获取路线',
    },
    es: {
      title: 'Historia',
      churchName: 'Iglesia Adventista\ndel Séptimo Día\nde Nueva York',
      history: 'Historia',
      historySubtext:
        'La Iglesia Adventista del Séptimo Día de Nueva York comenzó como una humilde reunión en 1973. Hoy, somos una comunidad bilingüe vibrante dedicada a apoyar a nuestros vecinos.',
      milestoneItems: [
        { year: '1973', event: 'Primera reunión' },
        { year: '1987', event: 'Organizada' },
        { year: '1996', event: 'Unión a conferencia' },
        { year: '1999', event: 'Sede propia' },
      ],
      locationsTitle: 'Ubicaciones y Servicios',
      elmhurstText:
        'Los servicios de la iglesia se llevan a cabo tanto en inglés como en chino mandarín. Tenemos la bendición de tener una congregación multiétnica vibrante. Nuestros miembros provienen de diversos orígenes y hablan muchos idiomas, incluidos español, francés, alemán, japonés y más.',
      flushingText:
        'Un subgrupo de nuestra ubicación de Elmhurst donde fomentamos la comunidad. Esto incluye comidas, testimonios personales, una lección/sermón, oración y adoración.',
      brooklynText:
        'En Bay Ridge, Brooklyn, llevamos a cabo un servicio de adoración tradicional los sábados. Este servicio se realiza en mandarín e incluye oración, servicio de cantos, un sermón y ofrendas, brindando una oportunidad única para el crecimiento espiritual y el compañerismo.',
      organization: 'Organización de la Iglesia',
      localConference: 'Asociación Local',
      localConfName: 'Greater New York Conference',
      localConfDesc:
        'Nuestra congregación local es parte de una red de iglesias en el área metropolitana de Nueva York.',
      unionConference: 'Unión',
      unionConfName: 'Atlantic Union Conference',
      unionConfDesc:
        'La Unión del Atlántico coordina la misión y educación adventista en el noreste de los Estados Unidos y las Bermudas.',
      learnMore: 'Saber más',
      getDirections: 'Obtener Direcciones',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;
  const locationNames = getLocationNames(language);

  return (
    <>
      <Stack.Screen
        options={{ title: labels.title, backTo, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={DocumentStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom + 50,
        }}
      >
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
            style={[
              NavigationStyles.heroTitle,
              { color: theme.dark ? theme.colors.onSurface : theme.colors.onSecondary },
            ]}
          >
            {labels.churchName}
          </Text>
        </ImageBackground>

        <View style={DocumentStyles.section}>
          <Text
            variant="titleLarge"
            style={[
              DocumentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {labels.history}
          </Text>
          <Text
            variant="bodyMedium"
            style={[DocumentStyles.description, { color: theme.colors.onSurface }]}
          >
            {labels.historySubtext}
          </Text>
          <View style={DocumentStyles.timelineContainer}>
            {(labels as any).milestoneItems.map((item: any, index: number) => (
              <View key={index} style={DocumentStyles.timelineColumn}>
                <View
                  style={[
                    DocumentStyles.yearCircle,
                    { backgroundColor: theme.colors.tertiary },
                  ]}
                >
                  <Text
                    style={[DocumentStyles.yearText, { color: theme.colors.onTertiary }]}
                  >
                    {item.year}
                  </Text>
                </View>
                <View
                  style={[
                    DocumentStyles.connectorLine,
                    { backgroundColor: theme.colors.outlineVariant },
                  ]}
                />
                <Text
                  variant="labelSmall"
                  style={[
                    DocumentStyles.milestoneEvent,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {item.event}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={DocumentStyles.section}>
          <Text
            variant="titleLarge"
            style={[
              DocumentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {labels.locationsTitle}
          </Text>

          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {CHURCH_LOCATIONS[0].address}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {locationNames[0]}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.elmhurstText}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                icon="map-marker"
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                onPress={() => openInMaps(CHURCH_LOCATIONS[0].searchQuery)}
              >
                {labels.getDirections}
              </Button>
            </Card.Actions>
          </Card>

          {/* Nested Subgroup: Flushing Fellowship */}
          <Card
            style={[
              DocumentStyles.card,
              DocumentStyles.orgCard,
              {
                marginLeft: 16,
                borderLeftWidth: 4,
                borderLeftColor: theme.colors.secondary,
              },
            ]}
            mode="outlined"
          >
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {CHURCH_LOCATIONS[2].address}
              </Text>
              <Text
                variant="titleLarge"
                style={[
                  DocumentStyles.orgName,
                  { color: theme.colors.secondary, fontWeight: 'bold' },
                ]}
              >
                {locationNames[2]}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.flushingText}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                icon="map-marker"
                buttonColor={theme.colors.secondary}
                textColor={theme.colors.onSecondary}
                onPress={() => openInMaps(CHURCH_LOCATIONS[2].searchQuery)}
              >
                {labels.getDirections}
              </Button>
            </Card.Actions>
          </Card>

          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {CHURCH_LOCATIONS[1].address}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {locationNames[1]}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.brooklynText}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                icon="map-marker"
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                onPress={() => openInMaps(CHURCH_LOCATIONS[1].searchQuery)}
              >
                {labels.getDirections}
              </Button>
            </Card.Actions>
          </Card>
        </View>

        <View style={DocumentStyles.section}>
          <Text
            variant="titleLarge"
            style={[
              DocumentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {labels.organization}
          </Text>
          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.localConference}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {labels.localConfName}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.localConfDesc}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                icon="open-in-new"
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                onPress={openGNYC}
              >
                {labels.learnMore}
              </Button>
            </Card.Actions>
          </Card>

          <Card style={[DocumentStyles.card, DocumentStyles.orgCard]} mode="outlined">
            <Card.Content>
              <Text
                variant="labelMedium"
                style={{ color: theme.colors.onSurfaceVariant }}
              >
                {labels.unionConference}
              </Text>
              <Text
                variant="titleLarge"
                style={[DocumentStyles.orgName, { color: theme.colors.onSurface }]}
              >
                {labels.unionConfName}
              </Text>
              <Text
                style={[
                  DocumentStyles.description,
                  DocumentStyles.orgDesc,
                  { color: theme.colors.onSurface },
                ]}
                variant="bodyMedium"
              >
                {labels.unionConfDesc}
              </Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                icon="open-in-new"
                buttonColor={theme.colors.primary}
                textColor={theme.colors.onPrimary}
                onPress={openAtlanticUnion}
              >
                {labels.learnMore}
              </Button>
            </Card.Actions>
          </Card>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    width: '100%',
    minHeight: 220,
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    overflow: 'hidden',
    marginBottom: 20,
  },
  heroTitle: {
    fontWeight: 'bold',
    fontSize: 26,
    lineHeight: 34,
    textAlign: 'left',
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
});
