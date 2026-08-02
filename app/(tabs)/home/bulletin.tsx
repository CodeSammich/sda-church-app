import { MenuCard } from '@/components/MenuCard';
import { WrappingButton as Button } from '@/components/WrappingButton';
import { CHURCH_BUILDING_IMAGE_URL } from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack } from 'expo-router';
import { useContext } from 'react';
import { ImageBackground, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Card, List, Text } from 'react-native-paper';

export default function WeeklyBulletinScreen() {
  const { language } = useContext(LanguageContext);
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const NavigationStyles = useNavigationStyles();
  const headerHeight = useGlobalHeaderHeight();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();

  const allLabels = {
    en: {
      title: 'Weekly Bulletin',
      description:
        'Stay connected with our church community through our weekly announcements, order of service, and prayer requests.',
      viewLatest: 'View Latest Bulletin (PDF)',
      announcements: 'Announcements',
      placeholder: 'Weekly updates will be available here soon.',
      quarterlySchedule: 'Quarterly Schedule',
      rosterHeader: 'Service Roster',
      thisWeek: 'This Week',
      nextWeek: 'Next Week',
      roles: {
        deacon: 'Deacon in Charge',
        greeter: 'Greeter',
        av: 'Audio / Visual',
        pianist: 'Pianist',
      },
    },
    zh: {
      title: '每週週報',
      description: '透過我們的每週公告、聚會程序和代禱事項，與教會社群保持聯繫。',
      viewLatest: '查看最新週報 (PDF)',
      announcements: '公告事項',
      placeholder: '每週更新即將在此發布。',
      quarterlySchedule: '季度排班',
      rosterHeader: '服事安排',
      thisWeek: '本週',
      nextWeek: '下週',
      roles: {
        deacon: '值班執事',
        greeter: '招待',
        av: '音響視訊',
        pianist: '司琴',
      },
    },
    'zh-cn': {
      title: '每周周报',
      description: '通过我们的每周公告、聚会程序和代祷事项，与教会社区保持联系。',
      viewLatest: '查看最新周报 (PDF)',
      announcements: '公告事项',
      placeholder: '每周更新即将在此发布。',
      quarterlySchedule: '季度排班',
      rosterHeader: '服事安排',
      thisWeek: '本周',
      nextWeek: '下周',
      roles: {
        deacon: '值班执事',
        greeter: '招待',
        av: '音响视讯',
        pianist: '司琴',
      },
    },
    es: {
      title: 'Boletín Semanal',
      description:
        'Mantente conectado con nuestra comunidad de la iglesia a través de nuestros anuncios semanales, orden del servicio y peticiones de oración.',
      viewLatest: 'Ver el boletín más reciente (PDF)',
      announcements: 'Anuncios',
      placeholder: 'Las actualizaciones semanales estarán disponibles aquí pronto.',
      quarterlySchedule: 'Horario Trimestral',
      rosterHeader: 'Registro de Servicio',
      thisWeek: 'Esta Semana',
      nextWeek: 'Próxima Semana',
      roles: {
        deacon: 'Diácono de Turno',
        greeter: 'Bienvenida',
        av: 'Audio / Visual',
        pianist: 'Pianista',
      },
    },
  };

  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  // Placeholder data - this would eventually come from a CMS or local constant
  const thisWeekData = [
    { role: labels.roles.deacon, name: 'TBD', icon: 'account-tie' },
    { role: labels.roles.greeter, name: 'TBD', icon: 'hand-wave' },
    { role: labels.roles.av, name: 'TBD', icon: 'microphone-variant' },
    { role: labels.roles.pianist, name: 'TBD', icon: 'piano' },
  ];

  const nextWeekData = [
    { role: labels.roles.deacon, name: 'TBD', icon: 'account-tie' },
    { role: labels.roles.greeter, name: 'TBD', icon: 'hand-wave' },
    { role: labels.roles.av, name: 'TBD', icon: 'microphone-variant' },
    { role: labels.roles.pianist, name: 'TBD', icon: 'piano' },
  ];

  const Section = ({ title, assignments }: { title: string; assignments: any[] }) => (
    <List.Section>
      <List.Subheader
        numberOfLines={0}
        style={[NavigationStyles.subheader, { color: theme.colors.onBackground }]}
      >
        {title}
      </List.Subheader>
      {assignments.map((item, index) => (
        <MenuCard
          key={index}
          title={item.role}
          description={item.name}
          icon={item.icon as any}
          rightIcon={null}
          style={index < assignments.length - 1 ? { marginBottom: 12 } : undefined}
        />
      ))}
    </List.Section>
  );

  return (
    <>
      <Stack.Screen
        options={{ title: labels.title, showTitleChip: showHeaderTitle } as any}
      />
      <ScrollView
        style={DocumentStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 0 }}
      >
        {/* Hero */}
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

        {/* Body */}
        <View style={DocumentStyles.section}>
          <Text style={[DocumentStyles.description, { color: theme.colors.onSurface }]}>
            {labels.description}
          </Text>

          <Button
            mode="contained"
            onPress={() => {
              /* TODO: Integrate with a PDF link from ExternalLinks.ts */
            }}
            style={DocumentStyles.button}
            buttonColor={theme.colors.primary}
            textColor={theme.colors.onPrimary}
            icon="file-pdf-box"
          >
            {labels.viewLatest}
          </Button>
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
            {labels.announcements}
          </Text>
          <Card style={DocumentStyles.card} mode="outlined">
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: 'center',
                  padding: 20,
                }}
              >
                {labels.placeholder}
              </Text>
            </Card.Content>
          </Card>
        </View>

        <Section title={labels.thisWeek} assignments={thisWeekData} />
        <Section title={labels.nextWeek} assignments={nextWeekData} />
        <List.Section>
          <List.Subheader
            numberOfLines={0}
            style={[NavigationStyles.subheader, { color: theme.colors.onBackground }]}
          >
            {labels.rosterHeader}
          </List.Subheader>
          <MenuCard
            title={labels.quarterlySchedule}
            icon="file-table-outline"
            iconColor={theme.colors.tertiary}
            rightIcon="open-in-new"
            onPress={() =>
              Linking.openURL(
                'https://docs.google.com/spreadsheets/d/1uFp2L6BvXqK-uM6yB8-HhI...placeholder',
              )
            }
          />
        </List.Section>
      </ScrollView>
    </>
  );
}
