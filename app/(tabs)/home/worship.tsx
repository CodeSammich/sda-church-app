import { MenuCard } from '@/components/MenuCard';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useContext } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { List } from 'react-native-paper';

const allLabels = {
  en: {
    title: 'Sabbath Worship',
    elmhurstTitle: 'Elmhurst',
    brooklynTitle: 'Brooklyn (Bay Ridge)',
    saturday: 'Saturday',
    locations: {
      f1: '1st Floor',
      f2: '2nd Floor',
      f3: '3rd Floor',
      basement: 'Basement',
    },
    eventNames: {
      song: 'Song Service',
      ss: 'Sabbath School / Small Groups',
      worship: 'Worship Service & Sermon',
      lunch: 'Fellowship Lunch',
      youth: 'Youth Ministry (Ages 8-18)',
      choir: 'Choir Practice',
      seminary: 'Theological Seminary',
      brooklynSS: 'Song Service & Sabbath School',
      brooklynWorship: 'Worship Service & Sermon',
      brooklynLunch: 'Fellowship Lunch',
    },
  },
  zh: {
    title: '安息日崇拜',
    elmhurstTitle: '艾姆赫斯特',
    brooklynTitle: '布魯克林 (Bay Ridge)',
    saturday: '星期六',
    locations: {
      f1: '1 樓',
      f2: '2 樓',
      f3: '3 樓',
      basement: '地下室',
    },
    eventNames: {
      song: '讚美詩歌',
      ss: '安息日學 / 小組聚會',
      worship: '崇拜聚會 & 證道',
      lunch: '教會午餐 (愛筵)',
      youth: '青年事工 (8-18 歲)',
      choir: '詩班練習',
      seminary: '神學講座',
      brooklynSS: '詩歌崇拜 & 安息日學',
      brooklynWorship: '崇拜聚會 & 證道',
      brooklynLunch: '團契午餐',
    },
  },
  'zh-cn': {
    title: '安息日崇拜',
    elmhurstTitle: '艾姆赫斯特',
    brooklynTitle: '布鲁克林 (Bay Ridge)',
    saturday: '星期六',
    locations: {
      f1: '1 楼',
      f2: '2 楼',
      f3: '3 楼',
      basement: '地下室',
    },
    eventNames: {
      song: '赞美诗歌',
      ss: '安息日学 / 小组聚会',
      worship: '崇拜聚会 & 证道',
      lunch: '教会午餐 (爱筵)',
      youth: '青年事工 (8-18 岁)',
      choir: '诗班练习',
      seminary: '神学讲座',
      brooklynSS: '诗歌崇拜 & 安息日学',
      brooklynWorship: '崇拜聚会 & 证道',
      brooklynLunch: '团契午餐',
    },
  },
  es: {
    title: 'Adoración Sabática',
    elmhurstTitle: 'Elmhurst',
    brooklynTitle: 'Brooklyn (Bay Ridge)',
    saturday: 'Sábado',
    locations: {
      f1: '1er Piso',
      f2: '2do Piso',
      f3: '3er Piso',
      basement: 'Sótano',
    },
    eventNames: {
      song: 'Servicio de Canto',
      ss: 'Escuela Sabática / Grupos Pequeños',
      worship: 'Adoración y Sermón',
      lunch: 'Almuerzo de Compañerismo',
      youth: 'Ministerio Juvenil (Ages 8-18)',
      choir: 'Práctica del Coro',
      seminary: 'Seminario Teológico',
      brooklynSS: 'Canto y Escuela Sabática',
      brooklynWorship: 'Adoración y Sermón',
      brooklynLunch: 'Almuerzo de Compañerismo',
    },
  },
};

export default function WorshipScreen() {
  const theme = useAppTheme();
  const NavigationStyles = useNavigationStyles();
  const { language } = useContext(LanguageContext);
  const { backTo } = useLocalSearchParams();
  const headerHeight = useGlobalHeaderHeight();
  const labels = allLabels[language as keyof typeof allLabels] || allLabels.en;

  const createEvents = (type: 'elmhurst' | 'brooklyn') => {
    if (type === 'elmhurst')
      return [
        {
          title: labels.eventNames.song,
          time: `${labels.saturday}, 10:00 AM`,
          loc: labels.locations.f3,
          icon: 'music-note',
        },
        {
          title: labels.eventNames.ss,
          time: `${labels.saturday}, 10:30 AM`,
          loc: `${labels.locations.f2} / ${labels.locations.f3}`,
          icon: 'forum',
        },
        {
          title: labels.eventNames.youth,
          time: `${labels.saturday}, 10:30 AM`,
          loc: labels.locations.f2,
          icon: 'account-group',
        },
        {
          title: labels.eventNames.worship,
          time: `${labels.saturday}, 11:30 AM`,
          loc: labels.locations.f3,
          icon: 'church',
        },
        {
          title: labels.eventNames.lunch,
          time: `${labels.saturday}, 1:00 PM`,
          loc: labels.locations.basement,
          icon: 'silverware-fork-knife',
        },
        {
          title: labels.eventNames.choir,
          time: `${labels.saturday}, 2:00 PM`,
          loc: labels.locations.f2,
          icon: 'microphone',
        },
        {
          title: labels.eventNames.seminary,
          time: `${labels.saturday}, 3:00 - 6:00 PM`,
          loc: labels.locations.f2,
          icon: 'school',
        },
      ];
    if (type === 'brooklyn')
      return [
        {
          title: labels.eventNames.brooklynSS,
          time: `${labels.saturday}, 10:00 - 11:30 AM`,
          loc: labels.locations.f3,
          icon: 'music-note',
        },
        {
          title: labels.eventNames.brooklynWorship,
          time: `${labels.saturday}, 11:30 AM - 12:30 PM`,
          loc: labels.locations.f3,
          icon: 'church',
        },
        {
          title: labels.eventNames.brooklynLunch,
          time: `${labels.saturday}, 12:30 - 1:00 PM`,
          loc: labels.locations.f3,
          icon: 'silverware-fork-knife',
        },
      ];
    return [];
  };

  const Section = ({ title, events }: { title: string; events: any[] }) => (
    <List.Section>
      <List.Subheader
        numberOfLines={0}
        style={[NavigationStyles.subheader, { color: theme.colors.onBackground }]}
      >
        {title}
      </List.Subheader>
      {events.map((event, index) => (
        <MenuCard
          key={index}
          title={event.title}
          description={`${event.time} • ${event.loc}`}
          icon={event.icon as any}
          rightIcon={null}
          style={styles.eventCard}
        />
      ))}
    </List.Section>
  );

  return (
    <>
      <Stack.Screen options={{ title: labels.title, backTo } as any} />
      <ScrollView
        style={NavigationStyles.container}
        contentContainerStyle={[
          NavigationStyles.contentContainer,
          { paddingTop: headerHeight, paddingBottom: 40 },
        ]}
      >
        <Section title={labels.elmhurstTitle} events={createEvents('elmhurst')} />
        <Section title={labels.brooklynTitle} events={createEvents('brooklyn')} />
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  eventCard: { marginBottom: 8 },
});
