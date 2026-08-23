import { MenuCard } from '@/components/MenuCard';
import {
  openChildrenSabbathSchool,
  openBabiesSabbathSchool,
  openCurrentChildrenSabbathSchool,
  openCurrentSabbathSchool,
  openSabbathSchool,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { Stack } from 'expo-router';
import { useContext, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, List } from 'react-native-paper';

const copy = {
  en: {
    title: 'Sabbath School', adult: 'Adult', children: 'Children',
    current: 'This Week', currentAdult: 'Open the current adult Bible study lesson',
    allAdult: 'All Adult Lessons', allAdultSub: 'Browse current and past adult quarterlies',
    babies: 'Babies (birth–12 months)', babiesSub: 'Parent and teacher curriculum resources',
    beginner: 'Beginner (ages 1–3)', kindergarten: 'Kindergarten (ages 4–6)',
    primary: 'Primary (ages 7–9)', junior: 'Junior (ages 10–12)',
    teen: 'Teen (ages 13–14)', youth: 'Youth (ages 15–18)',
    studentGuide: 'Student PDF · English', teacher: 'Teacher',
    teacherGuide: 'PDF · English',
    studentsTab: 'Students', teachersTab: 'Teachers', moreResources: 'More resources',
    allChildren: "Children's Catalog", allChildrenSub: 'Browse Alive in Jesus age-level resources',
  },
  zh: {
    title: '安息日學', adult: '成人', children: '兒童',
    current: '本週', currentAdult: '開啟本週成人研經課程',
    allAdult: '所有成人課程', allAdultSub: '瀏覽本季及過往季度課程',
    babies: '嬰兒（出生至 12 個月）', babiesSub: '家長與教師課程資源',
    beginner: '幼兒級（1–3 歲）', kindergarten: '幼稚級（4–6 歲）',
    primary: '初小級（7–9 歲）', junior: '少年級（10–12 歲）',
    teen: '青少年級（13–14 歲）', youth: '青年級（15–18 歲）',
    studentGuide: '學生 PDF · 英文', teacher: '教師版', teacherGuide: 'PDF · 英文',
    studentsTab: '學生', teachersTab: '教師', moreResources: '更多資源',
    allChildren: '兒童課程目錄', allChildrenSub: '瀏覽 Alive in Jesus 各年齡課程',
  },
  'zh-cn': {
    title: '安息日学', adult: '成人', children: '儿童',
    current: '本周', currentAdult: '打开本周成人研经课程',
    allAdult: '所有成人课程', allAdultSub: '浏览本季及过往季度课程',
    babies: '婴儿（出生至 12 个月）', babiesSub: '家长与教师课程资源',
    beginner: '幼儿组（1–3 岁）', kindergarten: '幼稚组（4–6 岁）',
    primary: '小学组（7–9 岁）', junior: '少年组（10–12 岁）',
    teen: '青少年组（13–14 岁）', youth: '青年组（15–18 岁）',
    studentGuide: '学生 PDF · 英文', teacher: '教师版', teacherGuide: 'PDF · 英文',
    studentsTab: '学生', teachersTab: '教师', moreResources: '更多资源',
    allChildren: '儿童课程目录', allChildrenSub: '浏览 Alive in Jesus 各年龄课程',
  },
  es: {
    title: 'Escuela Sabática', adult: 'Adultos', children: 'Niños',
    current: 'Esta semana', currentAdult: 'Abre la lección actual para adultos',
    allAdult: 'Todas las lecciones para adultos', allAdultSub: 'Explora las guías actuales y anteriores',
    babies: 'Bebés (0–12 meses)', babiesSub: 'Recursos para padres y maestros',
    beginner: 'Principiantes (1–3 años)', kindergarten: 'Jardín de infantes (4–6 años)',
    primary: 'Primarios (7–9 años)', junior: 'Menores (10–12 años)',
    teen: 'Adolescentes (13–14 años)', youth: 'Jóvenes (15–18 años)',
    studentGuide: 'PDF del alumno · inglés', teacher: 'Maestro',
    teacherGuide: 'PDF · inglés',
    studentsTab: 'Alumnos', teachersTab: 'Maestros', moreResources: 'Más recursos',
    allChildren: 'Catálogo infantil', allChildrenSub: 'Explora los recursos de Alive in Jesus por edad',
  },
} as const;

export default function SabbathSchoolScreen() {
  const { language } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const navigationStyles = useNavigationStyles();
  const headerHeight = useGlobalHeaderHeight();
  const [childrenTab, setChildrenTab] = useState<'students' | 'teachers'>('students');
  const showingStudents = childrenTab === 'students';

  return (
    <>
      <Stack.Screen options={{ title: labels.title }} />
      <ScrollView
        style={navigationStyles.container}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12 }]}
      >
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onBackground }}>{labels.adult}</List.Subheader>
          <MenuCard title={labels.current} description={labels.currentAdult} icon="calendar-today" onPress={() => openCurrentSabbathSchool(language)} />
          <MenuCard title={labels.allAdult} description={labels.allAdultSub} icon="bookshelf" onPress={() => openSabbathSchool(language)} />
        </List.Section>
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onBackground }}>{labels.children}</List.Subheader>
          <View style={styles.childrenTabsContainer}>
            <Button
              accessibilityRole="tab"
              accessibilityState={{ selected: showingStudents }}
              mode={showingStudents ? 'contained' : 'outlined'}
              onPress={() => setChildrenTab('students')}
              style={styles.childrenTab}
            >
              {labels.studentsTab}
            </Button>
            <Button
              accessibilityRole="tab"
              accessibilityState={{ selected: !showingStudents }}
              mode={!showingStudents ? 'contained' : 'outlined'}
              onPress={() => setChildrenTab('teachers')}
              style={styles.childrenTab}
            >
              {labels.teachersTab}
            </Button>
          </View>
          {showingStudents ? (
            <>
              <MenuCard title={labels.beginner} description={labels.studentGuide} icon="book-open-page-variant" onPress={() => openCurrentChildrenSabbathSchool('beginner-student')} />
              <MenuCard title={labels.kindergarten} description={labels.studentGuide} icon="book-open-page-variant" onPress={() => openCurrentChildrenSabbathSchool('kindergarten-student')} />
              <MenuCard title={labels.primary} description={labels.studentGuide} icon="book-open-page-variant" onPress={() => openCurrentChildrenSabbathSchool('primary-student')} />
              <MenuCard title={labels.junior} description={labels.studentGuide} icon="book-open-page-variant" onPress={() => openCurrentChildrenSabbathSchool('junior')} />
              <MenuCard title={labels.teen} description={labels.studentGuide} icon="book-open-page-variant" onPress={() => openCurrentChildrenSabbathSchool('teen')} />
              <MenuCard title={labels.youth} description={labels.studentGuide} icon="book-open-page-variant" onPress={() => openCurrentChildrenSabbathSchool('youth')} />
            </>
          ) : (
            <>
              <MenuCard title={labels.beginner} description={labels.teacherGuide} icon="human-male-board" onPress={() => openCurrentChildrenSabbathSchool('beginner-teacher')} />
              <MenuCard title={labels.kindergarten} description={labels.teacherGuide} icon="human-male-board" onPress={() => openCurrentChildrenSabbathSchool('kindergarten-teacher')} />
              <MenuCard title={labels.primary} description={labels.teacherGuide} icon="human-male-board" onPress={() => openCurrentChildrenSabbathSchool('primary-teacher')} />
              <MenuCard title={labels.junior} description={labels.teacherGuide} icon="human-male-board" onPress={() => openCurrentChildrenSabbathSchool('junior-teacher')} />
              <MenuCard title={labels.teen} description={labels.teacherGuide} icon="human-male-board" onPress={() => openCurrentChildrenSabbathSchool('teen-teacher')} />
              <MenuCard title={labels.youth} description={labels.teacherGuide} icon="human-male-board" onPress={() => openCurrentChildrenSabbathSchool('youth-teacher')} />
            </>
          )}
        </List.Section>
        <List.Section>
          <List.Subheader style={{ color: theme.colors.onBackground }}>{labels.moreResources}</List.Subheader>
          <MenuCard title={labels.babies} description={labels.babiesSub} icon="baby-face-outline" onPress={openBabiesSabbathSchool} />
          <MenuCard title={labels.allChildren} description={labels.allChildrenSub} icon="account-child" onPress={openChildrenSabbathSchool} />
        </List.Section>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  childrenTabsContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  childrenTab: { flex: 1 },
  content: { paddingBottom: 24, paddingHorizontal: 20 },
});
