import { MenuCard } from '@/components/MenuCard';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { router, Stack } from 'expo-router';
import { useContext } from 'react';
import { Linking, ScrollView } from 'react-native';
import { Card, List, Text } from 'react-native-paper';

const allLabels = {
  en: {
    header: 'Community',
    worship: 'Sabbath Worship',
    fellowship: 'Fellowship',
    weeklyHeader: 'Services & Gatherings',
    upcomingHeader: 'Upcoming Events',
    upcomingPlaceholder: 'Stay tuned for upcoming special events and programs!',
    rosterHeader: 'Service Roster',
    weeklyAssignments: 'Weekly Assignments',
    quarterlySchedule: 'Quarterly Overview',
    prayerHeader: 'Prayer',
    privatePrayer: 'Private Prayer Request',
    prayerRequest: 'Community Prayer Wall',
  },
  zh: {
    header: '教會社群',
    worship: '安息日崇拜',
    fellowship: '團契',
    weeklyHeader: '崇拜與聚會',
    upcomingHeader: '近期活動',
    upcomingPlaceholder: '敬請關注即將舉行的特別活動和節目！',
    rosterHeader: '服事安排',
    weeklyAssignments: '每週服事表',
    quarterlySchedule: '季度總表',
    prayerHeader: '禱告',
    privatePrayer: '私人代禱請求',
    prayerRequest: '教會禱告牆',
  },
  'zh-cn': {
    header: '教会社区',
    worship: '安息日崇拜',
    fellowship: '团契',
    weeklyHeader: '崇拜与聚会',
    upcomingHeader: '近期活动',
    upcomingPlaceholder: '敬请关注即将举行的特别活动和节目！',
    rosterHeader: '服事安排',
    weeklyAssignments: '每周服事表',
    quarterlySchedule: '季度总表',
    prayerHeader: '祷告',
    privatePrayer: '私人代祷请求',
    prayerRequest: '教会祷告墙',
  },
  es: {
    header: 'Comunidad',
    worship: 'Adoración Sabática',
    fellowship: 'Compañerismo',
    weeklyHeader: 'Servicios y Reuniones',
    upcomingHeader: 'Próximos Eventos',
    upcomingPlaceholder: '¡Estén atentos a los próximos eventos y programas especiales!',
    rosterHeader: 'Registro de Servicio',
    weeklyAssignments: 'Asignaciones Semanales',
    quarterlySchedule: 'Horario Trimestral',
    prayerHeader: 'Oración',
    privatePrayer: 'Petición de Oración Privada',
    prayerRequest: 'Muro de Oración Comunitario',
  },
};

export default function CommunityScreen() {
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { language } = useContext(LanguageContext);
  const headerHeight = useGlobalHeaderHeight();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  return (
    <>
      <Stack.Screen options={{ title: labels.header }} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={[
          NavigationStyles.contentContainer,
          { paddingTop: headerHeight },
        ]}
      >
        <List.Section>
          <List.Subheader
            numberOfLines={0}
            style={[NavigationStyles.subheader, { color: theme.colors.onBackground }]}
          >
            {labels.weeklyHeader}
          </List.Subheader>
          <MenuCard
            title={labels.fellowship}
            icon="account-group"
            iconColor={theme.colors.tertiary}
            onPress={() =>
              router.push({
                pathname: '/home/fellowship',
                params: { backTo: '/bible/bible1' },
              } as any)
            }
          />
        </List.Section>

        <List.Section>
          <List.Subheader
            numberOfLines={0}
            style={[NavigationStyles.subheader, { color: theme.colors.onBackground }]}
          >
            {labels.rosterHeader}
          </List.Subheader>
          <MenuCard
            title={labels.weeklyAssignments}
            icon="clipboard-text-outline"
            iconColor={theme.colors.tertiary}
            style={{ marginBottom: 12 }}
            onPress={() =>
              router.push({
                pathname: '/home/bulletin',
                params: { backTo: '/bible/bible1' },
              } as any)
            }
          />
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

        <List.Section>
          <List.Subheader
            numberOfLines={0}
            style={[NavigationStyles.subheader, { color: theme.colors.onBackground }]}
          >
            {labels.prayerHeader}
          </List.Subheader>
          <MenuCard
            title={labels.privatePrayer}
            icon="email-outline"
            iconColor={theme.colors.tertiary}
            style={{ marginBottom: 12 }}
            onPress={() => {}} // TODO: Link to a private Google Form or email
          />
          <MenuCard
            title={labels.prayerRequest}
            icon="hands-pray"
            iconColor={theme.colors.tertiary}
            onPress={() =>
              router.push({
                pathname: '/home/prayer',
                params: { backTo: '/bible/bible1' },
              } as any)
            }
          />
        </List.Section>

        <List.Section>
          <List.Subheader
            numberOfLines={0}
            style={[NavigationStyles.subheader, { color: theme.colors.onBackground }]}
          >
            {labels.upcomingHeader}
          </List.Subheader>
          <Card style={{ backgroundColor: theme.colors.surface }} mode="outlined">
            <Card.Content>
              <Text
                variant="bodyMedium"
                style={{
                  color: theme.colors.onSurfaceVariant,
                  textAlign: 'center',
                  paddingVertical: 20,
                }}
              >
                {labels.upcomingPlaceholder}
              </Text>
            </Card.Content>
          </Card>
        </List.Section>
      </ScrollView>
    </>
  );
}
