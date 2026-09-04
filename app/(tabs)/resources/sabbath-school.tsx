import { MenuCard } from '@/components/MenuCard';
import { VerseHero } from '@/components/VerseHero';
import {
  CHURCH_BUILDING_IMAGE_URL,
  getChildrenSabbathSchoolLanguage,
  getCurrentChildrenSabbathSchoolOptions,
  openChildrenSabbathSchool,
  openBabiesSabbathSchool,
  openCurrentChildrenSabbathSchool,
  openCurrentSabbathSchool,
  openSabbathSchool,
  type ChildrenSabbathSchoolCurriculum,
  type ChildrenSabbathSchoolOption,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { SABBATH_SCHOOL_BACK_TARGET } from '@/constants/BackNavigation';
import { useAppTheme } from '@/constants/Themes';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { Stack } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, List, Text } from 'react-native-paper';

const copy = {
  en: {
    title: 'Sabbath School', verse: '“Let the wise listen and gain instruction, and the discerning acquire wise counsel.”', verseRef: 'Proverbs 1:5 (BSB)', adult: 'Adult', children: 'Children',
    current: 'This Week', currentAdult: 'Open the current adult Bible study lesson',
    allAdult: 'All Adult Lessons', allAdultSub: 'Browse current and past adult quarterlies',
    babies: 'Babies (birth–12 months)', babiesSub: 'Parent and teacher curriculum resources',
    beginner: 'Beginner (ages 1–3)', kindergarten: 'Kindergarten (ages 4–6)',
    primary: 'Primary (ages 7–9)', junior: 'Junior (ages 10–12)',
    teen: 'Teen (ages 13–14)', youth: 'Youth (ages 15–18)',
    studentGuide: 'Student PDF', teacher: 'Teacher',
    teacherGuide: 'Teacher PDF', english: 'English', chinese: 'Chinese', spanish: 'Spanish',
    checking: 'Checking availability…', unavailable: 'Not available in this language',
    studentsTab: 'Students', teachersTab: 'Teachers', moreResources: 'More resources',
    allChildren: "Children's Catalog", allChildrenSub: 'Browse Alive in Jesus age-level resources',
  },
  zh: {
    title: '安息日學', verse: '「使智慧人聽見，增長學問，使聰明人得著智謀。」', verseRef: '箴言 1:5（和合本）', adult: '成人', children: '兒童',
    current: '本週', currentAdult: '開啟本週成人研經課程',
    allAdult: '所有成人課程', allAdultSub: '瀏覽本季及過往季度課程',
    babies: '嬰兒（出生至 12 個月）', babiesSub: '家長與教師課程資源',
    beginner: '幼兒級（1–3 歲）', kindergarten: '幼稚級（4–6 歲）',
    primary: '初小級（7–9 歲）', junior: '少年級（10–12 歲）',
    teen: '青少年級（13–14 歲）', youth: '青年級（15–18 歲）',
    studentGuide: '學生 PDF', teacher: '教師版', teacherGuide: '教師 PDF',
    english: '英文', chinese: '中文', spanish: '西班牙文',
    checking: '正在檢查是否有課程…', unavailable: '此語言暫無課程',
    studentsTab: '學生', teachersTab: '教師', moreResources: '更多資源',
    allChildren: '兒童課程目錄', allChildrenSub: '瀏覽 Alive in Jesus 各年齡課程',
  },
  'zh-cn': {
    title: '安息日学', verse: '“使智慧人听见，增长学问，使聪明人得着智谋。”', verseRef: '箴言 1:5（和合本）', adult: '成人', children: '儿童',
    current: '本周', currentAdult: '打开本周成人研经课程',
    allAdult: '所有成人课程', allAdultSub: '浏览本季及过往季度课程',
    babies: '婴儿（出生至 12 个月）', babiesSub: '家长与教师课程资源',
    beginner: '幼儿组（1–3 岁）', kindergarten: '幼稚组（4–6 岁）',
    primary: '小学组（7–9 岁）', junior: '少年组（10–12 岁）',
    teen: '青少年组（13–14 岁）', youth: '青年组（15–18 岁）',
    studentGuide: '学生 PDF', teacher: '教师版', teacherGuide: '教师 PDF',
    english: '英文', chinese: '中文', spanish: '西班牙文',
    checking: '正在检查是否有课程…', unavailable: '此语言暂无课程',
    studentsTab: '学生', teachersTab: '教师', moreResources: '更多资源',
    allChildren: '儿童课程目录', allChildrenSub: '浏览 Alive in Jesus 各年龄课程',
  },
  es: {
    title: 'Escuela Sabática', verse: '«Oirá el sabio, y aumentará el saber, y el entendido adquirirá consejo.»', verseRef: 'Proverbios 1:5 (RVR1960)', adult: 'Adultos', children: 'Niños',
    current: 'Esta semana', currentAdult: 'Abre la lección actual para adultos',
    allAdult: 'Todas las lecciones para adultos', allAdultSub: 'Explora las guías actuales y anteriores',
    babies: 'Bebés (0–12 meses)', babiesSub: 'Recursos para padres y maestros',
    beginner: 'Principiantes (1–3 años)', kindergarten: 'Jardín de infantes (4–6 años)',
    primary: 'Primarios (7–9 años)', junior: 'Menores (10–12 años)',
    teen: 'Adolescentes (13–14 años)', youth: 'Jóvenes (15–18 años)',
    studentGuide: 'PDF del alumno', teacher: 'Maestro',
    teacherGuide: 'PDF del maestro', english: 'inglés', chinese: 'chino', spanish: 'español',
    checking: 'Comprobando disponibilidad…', unavailable: 'No disponible en este idioma',
    studentsTab: 'Alumnos', teachersTab: 'Maestros', moreResources: 'Más recursos',
    allChildren: 'Catálogo infantil', allChildrenSub: 'Explora los recursos de Alive in Jesus por edad',
  },
} as const;

export default function SabbathSchoolScreen() {
  const { language } = useContext(LanguageContext);
  const labels = copy[language] || copy.en;
  const theme = useAppTheme();
  const navigationStyles = useNavigationStyles();
  const documentStyles = useDocumentStyles();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();
  const [childrenTab, setChildrenTab] = useState<'students' | 'teachers'>('students');
  const [childrenOptions, setChildrenOptions] = useState<
    Record<ChildrenSabbathSchoolCurriculum, ChildrenSabbathSchoolOption> | null
  >(null);
  const showingStudents = childrenTab === 'students';
  const showChildrenTabs = language === 'en' || Object.values(childrenOptions || {})
    .some((option) => option.available);

  useEffect(() => {
    const controller = new AbortController();
    setChildrenOptions(null);
    getCurrentChildrenSabbathSchoolOptions(
      language,
      new Date(),
      fetch,
      controller.signal,
    )
      .then(setChildrenOptions)
      .catch((error) => {
        if (error instanceof Error && error.name === 'AbortError') return;
        console.warn('Could not load children Sabbath School availability:', error);
        setChildrenOptions({} as Record<
          ChildrenSabbathSchoolCurriculum,
          ChildrenSabbathSchoolOption
        >);
      });
    return () => controller.abort();
  }, [language]);

  const guideDescription = (
    curriculum: ChildrenSabbathSchoolCurriculum,
    guide: 'student' | 'teacher',
  ) => {
    const base = guide === 'student' ? labels.studentGuide : labels.teacherGuide;
    if (!childrenOptions) return `${base} · ${labels.checking}`;
    if (!childrenOptions[curriculum]?.available) return `${base} · ${labels.unavailable}`;
    const guideLanguage = getChildrenSabbathSchoolLanguage(curriculum, language);
    return `${base} · ${
      guideLanguage === 'zh'
        ? labels.chinese
        : guideLanguage === 'es'
          ? labels.spanish
          : labels.english
    }`;
  };
  const renderChildrenLesson = (
    curriculum: ChildrenSabbathSchoolCurriculum,
    title: string,
    guide: 'student' | 'teacher',
  ) => {
    const option = childrenOptions?.[curriculum];
    const available = option?.available === true;
    if (language !== 'en' && !available) return null;
    return (
      <MenuCard
        description={guideDescription(curriculum, guide)}
        disabled={!available}
        icon={guide === 'student' ? 'book-open-page-variant' : 'human-male-board'}
        onPress={() => openCurrentChildrenSabbathSchool(curriculum, language)}
        title={language === 'en' ? title : option?.categoryName || title}
      />
    );
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: labels.title,
          backTo: SABBATH_SCHOOL_BACK_TARGET,
          showTitleChip: showHeaderTitle,
        } as any}
      />
      <ScrollView
        style={navigationStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        <VerseHero
          title={labels.title}
          verse={labels.verse}
          reference={labels.verseRef}
          imageSource={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          verseColors={
            theme.dark
              ? ['#1D2B3A', '#26445D', '#315E7A']
              : ['#1E4E79', '#2873A3', '#3B8FBD']
          }
        />
        <View style={styles.content}>
        <List.Section>
          <Text
            variant="titleLarge"
            style={[
              documentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {labels.adult}
          </Text>
          <MenuCard title={labels.current} description={labels.currentAdult} icon="calendar-today" onPress={() => openCurrentSabbathSchool(language)} />
          <MenuCard title={labels.allAdult} description={labels.allAdultSub} icon="bookshelf" onPress={() => openSabbathSchool(language)} />
        </List.Section>
        <List.Section>
          <Text
            variant="titleLarge"
            style={[
              documentStyles.sectionTitle,
              {
                color: theme.colors.onSurface,
                borderBottomColor: theme.colors.outlineVariant,
              },
            ]}
          >
            {labels.children}
          </Text>
          {showChildrenTabs ? (
            <>
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
                  {renderChildrenLesson('beginner-student', labels.beginner, 'student')}
                  {renderChildrenLesson('kindergarten-student', labels.kindergarten, 'student')}
                  {renderChildrenLesson('primary-student', labels.primary, 'student')}
                  {renderChildrenLesson('junior', labels.junior, 'student')}
                  {renderChildrenLesson('teen', labels.teen, 'student')}
                  {renderChildrenLesson('youth', labels.youth, 'student')}
                </>
              ) : (
                <>
                  {renderChildrenLesson('beginner-teacher', labels.beginner, 'teacher')}
                  {renderChildrenLesson('kindergarten-teacher', labels.kindergarten, 'teacher')}
                  {renderChildrenLesson('primary-teacher', labels.primary, 'teacher')}
                  {renderChildrenLesson('junior-teacher', labels.junior, 'teacher')}
                  {renderChildrenLesson('teen-teacher', labels.teen, 'teacher')}
                  {renderChildrenLesson('youth-teacher', labels.youth, 'teacher')}
                </>
              )}
            </>
          ) : null}
          <MenuCard title={labels.babies} description={labels.babiesSub} icon="baby-face-outline" onPress={() => openBabiesSabbathSchool(language)} />
          <MenuCard title={labels.allChildren} description={labels.allChildrenSub} icon="account-child" onPress={openChildrenSabbathSchool} />
        </List.Section>
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  childrenTabsContainer: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  childrenTab: { flex: 1 },
  content: { paddingBottom: 24, paddingHorizontal: 20 },
  scrollContent: { paddingBottom: 24 },
});
