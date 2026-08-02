import {
  CHURCH_BUILDING_IMAGE_URL,
  CHURCH_EMAIL,
  CHURCH_PHONE,
  openEmail,
  openPhone,
} from '@/constants/ExternalLinks';
import { WrappingButton as Button } from '@/components/WrappingButton';
import { scaleTypographyMetric } from '@/constants/AppPreferences';
import { LanguageContext } from '@/constants/LanguageContext';
import { TEAM_MEMBERS } from '@/constants/TeamData';
import { useTextSize } from '@/constants/TextSizeContext';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext, useMemo } from 'react';
import { ImageBackground, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Card, Divider, Text } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function MeetOurTeamScreen() {
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { textScale } = useTextSize();
  const { fontScale } = useWindowDimensions();
  const useStackedActions = fontScale * textScale >= 1.5;
  const styles = useMemo(
    () => createStyles(textScale, useStackedActions),
    [textScale, useStackedActions],
  );
  const insets = useSafeAreaInsets();
  const headerHeight = useGlobalHeaderHeight();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const allLabels = {
    en: {
      title: 'Meet Our Team',
      seniorPastor: 'Senior Pastor',
      bibleWorker: 'Bible Worker',
      childrensMinistry: "Children's Ministry",
      call: 'Call',
      email: 'Email',
    },
    zh: {
      title: '認識我們的團隊',
      seniorPastor: '主任牧師',
      bibleWorker: '聖經助理',
      childrensMinistry: '兒童事工',
      call: '致電',
      email: '電郵',
    },
    'zh-cn': {
      title: '认识我们的团队',
      seniorPastor: '主任牧师',
      bibleWorker: '圣经助理',
      childrensMinistry: '儿童事工',
      call: '致电',
      email: '电邮',
    },
    es: {
      title: 'Conoce a nuestro equipo',
      seniorPastor: 'Pastor Principal',
      bibleWorker: 'Obrero Bíblico',
      childrensMinistry: 'Ministerio Infantil',
      call: 'Llamar',
      email: 'Correo',
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen
        options={{ title: labels.title, backTo, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: theme.colors.background }]}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{
          paddingBottom: insets.bottom + 40,
        }}
      >
        <ImageBackground
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

        {/* Content Body */}
        <View style={styles.body}>
          {/* Cards for each team member */}
          {TEAM_MEMBERS.map((member, index) => (
            <Card
              key={index}
              style={[styles.sectionCard, { backgroundColor: theme.colors.surface }]}
              mode="outlined"
            >
              <Card.Cover source={{ uri: member.imageUrl }} style={styles.cardCover} />
              <Card.Content style={styles.cardContent}>
                <Text
                  variant="titleMedium"
                  style={[styles.cardSectionTitle, { color: theme.colors.onSurface }]}
                >
                  {member.name[language as keyof typeof allLabels] || member.name.en}
                </Text>
                <Text
                  variant="labelMedium"
                  style={[
                    styles.roleSubtitle,
                    { color: theme.colors.tertiary, marginBottom: 8, fontWeight: 'bold' },
                  ]}
                >
                  {labels[member.roleKey as keyof typeof labels]}
                </Text>
                <Text
                  variant="bodyMedium"
                  style={[
                    styles.cardDescription,
                    { color: theme.colors.onSurfaceVariant },
                  ]}
                >
                  {member.description[language as keyof typeof allLabels] ||
                    member.description.en}
                </Text>
              </Card.Content>
              {member.roleKey === 'seniorPastor' && (
                <>
                  <Divider style={{ marginHorizontal: 16 }} />
                  <Card.Actions style={styles.actionsRow}>
                    <Button
                      icon="email-outline"
                      mode="contained"
                      onPress={() => openEmail(CHURCH_EMAIL)}
                      style={[
                        styles.actionButton,
                        { backgroundColor: theme.colors.tertiary },
                      ]}
                      labelStyle={{ color: theme.colors.onSecondary }}
                    >
                      {labels.email}
                    </Button>
                    <Button
                      icon="phone"
                      mode="outlined"
                      onPress={() => openPhone(CHURCH_PHONE)}
                      style={[
                        styles.actionButton,
                        { borderColor: theme.colors.tertiary },
                      ]}
                      textColor={theme.colors.tertiary}
                    >
                      {labels.call}
                    </Button>
                  </Card.Actions>
                </>
              )}
            </Card>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const createStyles = (
  textScale: Parameters<typeof scaleTypographyMetric>[1],
  useStackedActions: boolean,
) => StyleSheet.create({
  container: {
    flex: 1,
  },
  quoteContainer: {
    marginTop: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    padding: 16,
    borderRadius: 8,
  },
  body: {
    padding: 16,
  },
  sectionCard: {
    marginBottom: 24,
    borderRadius: 12,
    overflow: 'hidden',
  },
  cardCover: {
    height: 220,
  },
  cardContent: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  cardSectionTitle: {
    fontWeight: 'bold',
    fontSize: scaleTypographyMetric(20, textScale),
    lineHeight: scaleTypographyMetric(28, textScale),
    marginBottom: 4,
  },
  roleSubtitle: {
    fontSize: scaleTypographyMetric(14, textScale),
    lineHeight: scaleTypographyMetric(20, textScale),
  },
  cardDescription: {
    fontSize: scaleTypographyMetric(15, textScale),
    lineHeight: scaleTypographyMetric(22, textScale),
  },
  actionsRow: {
    flexDirection: useStackedActions ? 'column' : 'row',
    justifyContent: 'space-between',
    padding: 12,
    gap: 12,
  },
  actionButton: {
    flex: useStackedActions ? undefined : 1,
    width: useStackedActions ? '100%' : undefined,
    borderRadius: 8,
  },
  sectionHeaderContainer: {
    marginTop: 8,
    marginBottom: 16,
  },
  sectionHeading: {
    fontSize: scaleTypographyMetric(22, textScale),
    lineHeight: scaleTypographyMetric(30, textScale),
    fontWeight: 'bold',
  },
  headingDivider: {
    height: 3,
    marginTop: 6,
    width: 60,
    borderRadius: 2,
    backgroundColor: '#3EA6FF',
  },
});
