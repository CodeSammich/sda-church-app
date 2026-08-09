import { WrappingButton as Button } from '@/components/WrappingButton';
import { GridMenuCard } from '@/components/GridMenuCard';
import { CHURCH_LOCATIONS } from '@/constants/ChurchData';
import { BULLETIN_HYMNAL_DISPLAY_NAMES } from '@/constants/BulletinHymnalConfig';
import {
  CHURCH_BUILDING_IMAGE_URL,
  openInMaps,
  openQuarterlySchedule,
} from '@/constants/ExternalLinks';
import { LanguageContext } from '@/constants/LanguageContext';
import { useAppTheme } from '@/constants/Themes';
import { useGlobalHeaderHeight } from '@/hooks/useGlobalHeaderHeight';
import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import {
  Bulletin,
  BulletinLocation,
  fetchBulletin,
  getCachedBulletin,
  getNextBulletinRolloverAt,
  getRefreshAvailableAt,
  getUpcomingSabbathDates,
  hasBulletinValue,
  isBulletinLocationEmpty,
  setRefreshAvailableAt as persistRefreshAvailableAt,
} from '@/services/BulletinService';
import {
  BulletinHymnDestination,
  BulletinHymnPresentation,
  QUEENS_FIXED_HYMNS,
  resolveBulletinHymnPresentation,
} from '@/services/BulletinHymnalService';
import {
  formatScriptureReference,
  getScriptureReaderParams,
  parseScriptureReference,
  resolveScriptureReference,
} from '@/services/BibleService';
import { useDocumentStyles } from '@/styles/DocumentStyles';
import { useNavigationStyles } from '@/styles/NavigationStyles';
import { LinearGradient } from 'expo-linear-gradient';
import { router, Stack } from 'expo-router';
import { useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, ImageBackground, ScrollView, StyleSheet, View } from 'react-native';
import { ActivityIndicator, Card, IconButton, Text } from 'react-native-paper';

const LABELS = {
  en: {
    title: 'Weekly Bulletin',
    thisWeek: 'This Week',
    nextWeek: 'Next Week',
    loading: 'Loading bulletin…',
    refresh: 'Refresh',
    loadError: 'This bulletin could not be loaded.',
    retry: 'Try Again',
    notAssigned: 'TBD',
    notAvailable: 'TBD',
    nameWithheld: 'Name withheld',
    choir: 'Choir',
    worshipProgram: 'Worship Program',
    hymnalNote: 'English hymn numbers use the {hymnal}.',
    serviceRoster: 'Service Roster',
    queens: 'Queens',
    brooklyn: 'Brooklyn',
    possibleJointService: 'Brooklyn service details are not listed for this Sabbath.',
    possibleJointServiceHint: 'There may be a joint service at Elmhurst.',
    openElmhurst: 'Open Elmhurst Church',
    openBibleReference: 'Open {reference} in the Bible reader',
    readNow: 'Read now',
    openHymn: 'Open hymn',
    openHymnInHymnal: 'Open {hymn} in the hymnal',
    planning: 'Planning',
    quarterlySchedule: 'Quarterly Schedule',
    churchStaffOnly: 'Church staff only',
    metadata: {
      quarter: 'Quarter',
      specialRemark: 'Special Remark',
      tithePurpose: 'Tithe Purpose',
      pastorTravel: 'Pastor Travel',
    },
    program: {
      doxology: 'Doxology',
      hymnOfPraise: 'Hymn of Praise',
      sermonTitle: 'Sermon Title',
      bibleVerses: 'Bible Verses',
      pastoralPrayer: 'Pastoral Prayer',
      hymnOfResponse: 'Hymn of Response',
      postlude: 'Postlude',
    },
    roles: {
      sermon: 'Sermon Speaker',
      translation: 'Translation',
      chineseTeacher: 'Chinese Teacher',
      englishTeacher: 'English Teacher',
      childrenTeacher: 'Children Teacher',
      chairPastoralPrayer: 'Chair / Pastoral Prayer',
      specialMusic: 'Special Music',
      offeringPrayer: 'Offering Prayer',
      pianist: 'Pianist',
      ssChair: 'Sabbath School Chair',
      openingPrayer: 'Opening Prayer',
      closingPrayer: 'Closing Prayer',
      sabbathSchool: 'Sabbath School',
    },
  },
  zh: {
    title: '每週週報',
    thisWeek: '本週',
    nextWeek: '下週',
    loading: '正在載入週報…',
    refresh: '重新整理',
    loadError: '無法載入本週週報。',
    retry: '重試',
    notAssigned: '尚未安排',
    notAvailable: '尚未確定',
    nameWithheld: '姓名保留',
    choir: '詩班',
    worshipProgram: '崇拜程序',
    hymnalNote: '中文詩歌編號採用 {hymnal} 首詩歌本。',
    serviceRoster: '服事安排',
    queens: '皇后區',
    brooklyn: '布魯克林',
    possibleJointService: '本安息日尚未列出布魯克林的聚會資料。',
    possibleJointServiceHint: '當天可能與艾姆赫斯特教會聯合聚會。',
    openElmhurst: '開啟艾姆赫斯特教會位置',
    openBibleReference: '在聖經閱讀器中開啟 {reference}',
    readNow: '立即閱讀',
    openHymn: '開啟詩歌',
    openHymnInHymnal: '在詩歌本中開啟{hymn}',
    planning: '事工規劃',
    quarterlySchedule: '季度排班',
    churchStaffOnly: '僅限教會同工',
    metadata: {
      quarter: '季度',
      specialRemark: '特別事項',
      tithePurpose: '什一用途',
      pastorTravel: '牧師行程',
    },
    program: {
      doxology: '讚美',
      hymnOfPraise: '讚美詩',
      sermonTitle: '講道題目',
      bibleVerses: '本週經文',
      pastoralPrayer: '牧養禱告',
      hymnOfResponse: '回應詩',
      postlude: '後奏曲',
    },
    roles: {
      sermon: '講員',
      translation: '翻譯',
      chineseTeacher: '中文教師',
      englishTeacher: '英文教師',
      childrenTeacher: '兒童教師',
      chairPastoralPrayer: '主席／牧禱',
      specialMusic: '特別音樂',
      offeringPrayer: '奉獻禱告',
      pianist: '司琴',
      ssChair: '安息日學主席',
      openingPrayer: '開會禱告',
      closingPrayer: '閉會禱告',
      sabbathSchool: '安息日學',
    },
  },
  'zh-cn': {
    title: '每周周报',
    thisWeek: '本周',
    nextWeek: '下周',
    loading: '正在加载周报…',
    refresh: '刷新',
    loadError: '无法加载本周周报。',
    retry: '重试',
    notAssigned: '尚未安排',
    notAvailable: '尚未确定',
    nameWithheld: '姓名保留',
    choir: '诗班',
    worshipProgram: '崇拜程序',
    hymnalNote: '中文诗歌编号采用 {hymnal} 首诗歌本。',
    serviceRoster: '服事安排',
    queens: '皇后区',
    brooklyn: '布鲁克林',
    possibleJointService: '本安息日尚未列出布鲁克林的聚会资料。',
    possibleJointServiceHint: '当天可能与艾姆赫斯特教会联合聚会。',
    openElmhurst: '打开艾姆赫斯特教会位置',
    openBibleReference: '在圣经阅读器中打开 {reference}',
    readNow: '立即阅读',
    openHymn: '打开诗歌',
    openHymnInHymnal: '在诗歌本中打开{hymn}',
    planning: '事工规划',
    quarterlySchedule: '季度排班',
    churchStaffOnly: '仅限教会同工',
    metadata: {
      quarter: '季度',
      specialRemark: '特别事项',
      tithePurpose: '什一用途',
      pastorTravel: '牧师行程',
    },
    program: {
      doxology: '颂美',
      hymnOfPraise: '赞美诗',
      sermonTitle: '讲道题目',
      bibleVerses: '本周经文',
      pastoralPrayer: '牧养祷告',
      hymnOfResponse: '回应诗',
      postlude: '后奏曲',
    },
    roles: {
      sermon: '讲员',
      translation: '翻译',
      chineseTeacher: '中文教师',
      englishTeacher: '英文教师',
      childrenTeacher: '儿童教师',
      chairPastoralPrayer: '主席／牧祷',
      specialMusic: '特别音乐',
      offeringPrayer: '奉献祷告',
      pianist: '司琴',
      ssChair: '安息日学主席',
      openingPrayer: '开会祷告',
      closingPrayer: '闭会祷告',
      sabbathSchool: '安息日学',
    },
  },
  es: {
    title: 'Boletín Semanal',
    thisWeek: 'Esta Semana',
    nextWeek: 'Próxima Semana',
    loading: 'Cargando el boletín…',
    refresh: 'Actualizar',
    loadError: 'No se pudo cargar este boletín.',
    retry: 'Intentar de Nuevo',
    notAssigned: 'Por asignar',
    notAvailable: 'Por determinar',
    nameWithheld: 'Nombre reservado',
    choir: 'Coro',
    worshipProgram: 'Programa de Adoración',
    hymnalNote: 'Los números de los himnos en inglés usan el {hymnal}.',
    serviceRoster: 'Asignaciones de Servicio',
    queens: 'Queens',
    brooklyn: 'Brooklyn',
    possibleJointService: 'No hay detalles del servicio de Brooklyn para este sábado.',
    possibleJointServiceHint: 'Puede haber un servicio conjunto en Elmhurst.',
    openElmhurst: 'Abrir Iglesia de Elmhurst',
    openBibleReference: 'Abrir {reference} en el lector de la Biblia',
    readNow: 'Leer ahora',
    openHymn: 'Abrir himno',
    openHymnInHymnal: 'Abrir {hymn} en el himnario',
    planning: 'Planificación',
    quarterlySchedule: 'Horario Trimestral',
    churchStaffOnly: 'Solo personal de la iglesia',
    metadata: {
      quarter: 'Trimestre',
      specialRemark: 'Observación Especial',
      tithePurpose: 'Propósito del Diezmo',
      pastorTravel: 'Viaje Pastoral',
    },
    program: {
      doxology: 'Doxología',
      hymnOfPraise: 'Himno de Alabanza',
      sermonTitle: 'Título del Sermón',
      bibleVerses: 'Versículos Bíblicos',
      pastoralPrayer: 'Oración Pastoral',
      hymnOfResponse: 'Himno de Respuesta',
      postlude: 'Postludio',
    },
    roles: {
      sermon: 'Orador del Sermón',
      translation: 'Traducción',
      chineseTeacher: 'Maestro de Chino',
      englishTeacher: 'Maestro de Inglés',
      childrenTeacher: 'Maestro de Niños',
      chairPastoralPrayer: 'Dirección / Oración Pastoral',
      specialMusic: 'Música Especial',
      offeringPrayer: 'Oración de Ofrenda',
      pianist: 'Pianista',
      ssChair: 'Dirección de Escuela Sabática',
      openingPrayer: 'Oración Inicial',
      closingPrayer: 'Oración Final',
      sabbathSchool: 'Escuela Sabática',
    },
  },
} as const;

const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;
let scriptureReferenceRequestSequence = 0;

const createScriptureReferenceRequest = () =>
  `${Date.now()}-${++scriptureReferenceRequestSequence}`;

type Labels = (typeof LABELS)['en'];
type WeekState = {
  date: string;
  bulletin?: Bulletin;
  error?: string;
  loading: boolean;
};

type DataRowProps = {
  label: string;
  value?: string;
  emptyText: string;
  last?: boolean;
  action?: {
    accessibilityLabel: string;
    label: string;
    onPress: () => void;
  };
};

const DataRow = ({ label, value, emptyText, last, action }: DataRowProps) => (
  <View style={[styles.dataRow, !last && styles.dataRowBorder]}>
    <Text variant="labelLarge">{label}</Text>
    {action ? (
      <View style={styles.programActionRow}>
        <Text variant="bodyMedium" style={styles.programActionValue}>
          {value || emptyText}
        </Text>
        <Button
          accessibilityLabel={action.accessibilityLabel}
          mode="contained-tonal"
          compact
          icon="music-note"
          onPress={action.onPress}
        >
          {action.label}
        </Button>
      </View>
    ) : (
      <Text variant="bodyMedium">{value || emptyText}</Text>
    )}
  </View>
);

const getProgramValue = (
  value: { english: string; chinese: string },
  language: string,
) =>
  language === 'zh' || language === 'zh-cn'
    ? value.chinese || value.english
    : value.english || value.chinese;

const getRosterValue = (value: string | undefined, labels: Labels) => {
  if (!value) return '';
  if (value === 'Name withheld') return labels.nameWithheld;
  if (value.toLowerCase() === 'choir') return labels.choir;
  return value;
};

export default function WeeklyBulletinScreen() {
  const { language } = useContext(LanguageContext);
  const labels = (LABELS[language as keyof typeof LABELS] || LABELS.en) as Labels;
  const theme = useAppTheme();
  const DocumentStyles = useDocumentStyles();
  const NavigationStyles = useNavigationStyles();
  const headerHeight = useGlobalHeaderHeight();
  const { showHeaderTitle, handleHeroScroll } = useHeroHeaderTitle();
  const [weekDates, setWeekDates] = useState(() => getUpcomingSabbathDates());
  const [weeks, setWeeks] = useState<WeekState[]>(() =>
    weekDates.map((date) => ({ date, loading: false })),
  );
  const [selectedWeek, setSelectedWeek] = useState('0');
  const loadingWeeksRef = useRef(new Set<string>());
  const refreshAvailableAtRef = useRef<[number, number]>([0, 0]);
  const [refreshAvailableAt, setRefreshAvailableAt] = useState<[number, number]>([0, 0]);
  const [cooldownClock, setCooldownClock] = useState(() => Date.now());

  const syncWeekDates = useCallback(() => {
    const nextDates = getUpcomingSabbathDates();
    if (nextDates[0] === weekDates[0] && nextDates[1] === weekDates[1]) {
      return false;
    }

    loadingWeeksRef.current.clear();
    refreshAvailableAtRef.current = [0, 0];
    setRefreshAvailableAt([0, 0]);
    setCooldownClock(Date.now());
    setSelectedWeek('0');
    setWeeks(nextDates.map((date) => ({ date, loading: false })));
    setWeekDates(nextDates);
    return true;
  }, [weekDates]);

  const loadWeek = useCallback(
    async (index: number, signal?: AbortSignal, skipDeviceCache = false) => {
      const date = weekDates[index];
      if (!date || loadingWeeksRef.current.has(date)) return;

      loadingWeeksRef.current.add(date);

      try {
        const cached = skipDeviceCache ? undefined : await getCachedBulletin(date);
        if (cached) {
          if (!signal?.aborted) {
            setWeeks((current) =>
              current.map((week, weekIndex) =>
                weekIndex === index && week.date === date
                  ? { date, bulletin: cached, error: undefined, loading: false }
                  : week,
              ),
            );
          }
          return;
        }

        setWeeks((current) =>
          current.map((week, weekIndex) =>
            weekIndex === index && week.date === date
              ? { ...week, error: undefined, loading: true }
              : week,
          ),
        );
        const bulletin = await fetchBulletin(date, signal);
        if (!signal?.aborted) {
          setWeeks((current) =>
            current.map((week, weekIndex) =>
              weekIndex === index && week.date === date
                ? { date, bulletin, error: undefined, loading: false }
                : week,
            ),
          );
        }
      } catch (error) {
        if (!signal?.aborted) {
          setWeeks((current) =>
            current.map((week, weekIndex) =>
              weekIndex === index && week.date === date
                ? {
                    ...week,
                    error: error instanceof Error ? error.message : LABELS.en.loadError,
                    loading: false,
                  }
                : week,
            ),
          );
        }
      } finally {
        loadingWeeksRef.current.delete(date);
      }
    },
    [weekDates],
  );

  const refreshWeek = useCallback(
    async (index: number) => {
      const date = weekDates[index];
      if (!date) return;

      const now = Date.now();
      if (refreshAvailableAtRef.current[index] > now) return;

      const nextAvailableAt = now + REFRESH_COOLDOWN_MS;
      refreshAvailableAtRef.current[index] = nextAvailableAt;
      void persistRefreshAvailableAt(date, nextAvailableAt).catch(() => undefined);
      setRefreshAvailableAt((current) => {
        const updated: [number, number] = [...current];
        updated[index] = nextAvailableAt;
        return updated;
      });
      setCooldownClock(now);
      await loadWeek(index, undefined, true);
    },
    [loadWeek, weekDates],
  );

  useEffect(() => {
    const controller = new AbortController();
    void loadWeek(0, controller.signal);
    return () => controller.abort();
  }, [loadWeek]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all(weekDates.map((date) => getRefreshAvailableAt(date))).then(
      (availableAt) => {
        if (cancelled) return;
        const values = availableAt.map((value, index) =>
          Math.max(value, refreshAvailableAtRef.current[index]),
        ) as [number, number];
        refreshAvailableAtRef.current = values;
        setRefreshAvailableAt(values);
        setCooldownClock(Date.now());
      },
    );
    return () => {
      cancelled = true;
    };
  }, [weekDates]);

  useEffect(() => {
    const refreshSelectedIfStale = () => {
      if (!syncWeekDates()) void loadWeek(Number(selectedWeek));
    };
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refreshSelectedIfStale();
    });

    const sabbathStart = new Date(`${weekDates[0]}T00:00:00`).getTime();
    const sabbathStartDelay = sabbathStart - Date.now();
    const sabbathStartTimer =
      sabbathStartDelay > 0
        ? setTimeout(() => void loadWeek(0), sabbathStartDelay + 1000)
        : undefined;

    const rolloverDelay = getNextBulletinRolloverAt() - Date.now();
    const rolloverTimer =
      rolloverDelay > 0
        ? setTimeout(() => void syncWeekDates(), rolloverDelay + 1000)
        : undefined;

    return () => {
      subscription.remove();
      if (sabbathStartTimer) clearTimeout(sabbathStartTimer);
      if (rolloverTimer) clearTimeout(rolloverTimer);
    };
  }, [loadWeek, selectedWeek, syncWeekDates, weekDates]);

  useEffect(() => {
    const latestExpiry = Math.max(...refreshAvailableAt);
    if (latestExpiry <= Date.now()) return;

    const timer = setInterval(() => {
      const now = Date.now();
      setCooldownClock(now);
      if (now >= latestExpiry) clearInterval(timer);
    }, 1000);

    return () => clearInterval(timer);
  }, [refreshAvailableAt]);

  const dateLocale =
    language === 'zh' ? 'zh-TW' : language === 'zh-cn' ? 'zh-CN' : language;

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat(dateLocale, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(`${date}T12:00:00`));

  const selectWeek = (index: number) => {
    setSelectedWeek(String(index));
    void loadWeek(index);
  };

  const openBulletinHymn = (destination: BulletinHymnDestination) => {
    router.push({
      pathname: destination.route,
      params: {
        backTo: '/home/bulletin',
        ...(destination.hymnNumber
          ? { hymnNum: destination.hymnNumber.toString() }
          : {}),
      },
    } as any);
  };

  const getBulletinHymnAction = (
    presentation: BulletinHymnPresentation,
  ): DataRowProps['action'] => {
    const { destination, displayText } = presentation;
    if (!destination) return undefined;

    return {
      accessibilityLabel: labels.openHymnInHymnal.replace(
        '{hymn}',
        displayText,
      ),
      label: labels.openHymn,
      onPress: () => openBulletinHymn(destination),
    };
  };

  const renderProgram = (location: BulletinLocation, isQueens: boolean) => {
    // One resolver owns both visible text and routing for every bulletin hymn.
    // See docs/feature_designs/bulletin_hymn_resolution.md before adding fields.
    const praiseHymn = resolveBulletinHymnPresentation(
      location.hymnOfPraise,
      language,
    );
    const responseHymn = resolveBulletinHymnPresentation(
      location.hymnOfResponse,
      language,
    );
    const getFixedHymnPresentation = (
      value: (typeof QUEENS_FIXED_HYMNS)[keyof typeof QUEENS_FIXED_HYMNS],
    ): BulletinHymnPresentation => ({
      ...resolveBulletinHymnPresentation(value, language),
      // Preserve the church-approved wording for fixed weekly responses.
      displayText: getProgramValue(value, language),
    });
    const doxology = getFixedHymnPresentation(QUEENS_FIXED_HYMNS.doxology);
    const pastoralPrayer = getFixedHymnPresentation(
      QUEENS_FIXED_HYMNS.pastoralPrayer,
    );
    const postlude = getFixedHymnPresentation(QUEENS_FIXED_HYMNS.postlude);
    const displayedHymnalName =
      language === 'zh' || language === 'zh-cn'
        ? BULLETIN_HYMNAL_DISPLAY_NAMES.chinese
        : BULLETIN_HYMNAL_DISPLAY_NAMES.english;
    const parsedBibleReference = parseScriptureReference(location.bibleVerses);
    const localizedBibleReference = parsedBibleReference
      ? formatScriptureReference(parsedBibleReference, language)
      : null;
    const displayedBibleReference = localizedBibleReference || location.bibleVerses;
    const targetBibleReference = resolveScriptureReference(location.bibleVerses);
    const openBibleReference = hasBulletinValue(location.bibleVerses)
      ? () =>
          router.replace({
            pathname: '/bible',
            params: {
              ...getScriptureReaderParams(targetBibleReference, language),
              referenceRequest: createScriptureReferenceRequest(),
              backTo: '/home/bulletin',
            },
          } as any)
      : undefined;

    return (
      <View style={styles.cardSection}>
        <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
          {labels.worshipProgram}
        </Text>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          {labels.hymnalNote.replace('{hymnal}', displayedHymnalName)}
        </Text>
        {isQueens && (
          <DataRow
            label={labels.program.doxology}
            value={doxology.displayText}
            emptyText={labels.notAvailable}
            action={getBulletinHymnAction(doxology)}
          />
        )}
        <DataRow
          label={labels.program.hymnOfPraise}
          value={praiseHymn.displayText}
          emptyText={labels.notAvailable}
          action={getBulletinHymnAction(praiseHymn)}
        />
        <DataRow
          label={labels.program.sermonTitle}
          value={getProgramValue(location.sermonTitle, language)}
          emptyText={labels.notAvailable}
        />
        <View style={[styles.dataRow, styles.dataRowBorder]}>
          <Text variant="labelLarge">{labels.program.bibleVerses}</Text>
          <View style={styles.scriptureActionRow}>
            <Text variant="bodyMedium" style={styles.scriptureReference}>
              {displayedBibleReference || labels.notAvailable}
            </Text>
            {openBibleReference && (
              <Button
                accessibilityLabel={labels.openBibleReference.replace(
                  '{reference}',
                  formatScriptureReference(targetBibleReference, language) ||
                    displayedBibleReference,
                )}
                mode="contained-tonal"
                compact
                icon="book-open-page-variant"
                onPress={openBibleReference}
              >
                {labels.readNow}
              </Button>
            )}
          </View>
        </View>
        {isQueens && (
          <DataRow
            label={labels.program.pastoralPrayer}
            value={pastoralPrayer.displayText}
            emptyText={labels.notAvailable}
            action={getBulletinHymnAction(pastoralPrayer)}
          />
        )}
        <DataRow
          label={labels.program.hymnOfResponse}
          value={responseHymn.displayText}
          emptyText={labels.notAvailable}
          action={getBulletinHymnAction(responseHymn)}
          last={!isQueens}
        />
        {isQueens && (
          <DataRow
            label={labels.program.postlude}
            value={postlude.displayText}
            emptyText={labels.notAvailable}
            action={getBulletinHymnAction(postlude)}
            last
          />
        )}
      </View>
    );
  };

  const renderRoster = (location: BulletinLocation, isQueens: boolean) => {
    const rows: Array<[string, string | undefined]> = isQueens
      ? [
          [labels.roles.sermon, location.sermon],
          [labels.roles.translation, location.translation],
          [labels.roles.chineseTeacher, location.chineseTeacher],
          [labels.roles.englishTeacher, location.englishTeacher],
          [labels.roles.childrenTeacher, location.childrenTeacher],
          [labels.roles.chairPastoralPrayer, location.chairPastoralPrayer],
          [labels.roles.specialMusic, location.specialMusic],
          [labels.roles.offeringPrayer, location.offeringPrayer],
          [labels.roles.pianist, location.pianist],
          [labels.roles.ssChair, location.ssChair],
          [labels.roles.openingPrayer, location.openingPrayer],
          [labels.roles.closingPrayer, location.closingPrayer],
        ]
      : [
          [labels.roles.sermon, location.sermon],
          [labels.roles.chairPastoralPrayer, location.chairPastoralPrayer],
          [labels.roles.offeringPrayer, location.offeringPrayer],
          [labels.roles.sabbathSchool, location.sabbathSchool],
        ];

    return (
      <View style={styles.cardSection}>
        <Text variant="titleMedium" style={{ color: theme.colors.primary }}>
          {labels.serviceRoster}
        </Text>
        {rows.map(([label, value], index) => (
          <DataRow
            key={label}
            label={label}
            value={getRosterValue(value, labels)}
            emptyText={labels.notAssigned}
            last={index === rows.length - 1}
          />
        ))}
      </View>
    );
  };

  const renderLocation = (
    title: string,
    location: BulletinLocation,
    isQueens: boolean,
    specialRemark: string,
  ) => (
    <Card mode="outlined" style={styles.card}>
      <Card.Title title={title} titleVariant="titleLarge" style={styles.locationCardTitle} />
      <Card.Content>
        {hasBulletinValue(specialRemark) && (
          <View
            style={[
              styles.remarkBanner,
              { backgroundColor: theme.colors.secondaryContainer },
            ]}
          >
            <Text variant="labelLarge" style={{ color: theme.colors.onSecondaryContainer }}>
              {labels.metadata.specialRemark}
            </Text>
            <Text variant="titleMedium" style={{ color: theme.colors.onSecondaryContainer }}>
              {specialRemark}
            </Text>
          </View>
        )}

        {!isQueens && isBulletinLocationEmpty(location) && (
          <View
            style={[
              styles.jointServiceNotice,
              { backgroundColor: theme.colors.tertiaryContainer },
            ]}
          >
            <Text variant="titleMedium" style={{ color: theme.colors.onTertiaryContainer }}>
              {labels.possibleJointService}
            </Text>
            <Text variant="bodyMedium" style={{ color: theme.colors.onTertiaryContainer }}>
              {labels.possibleJointServiceHint}
            </Text>
            <Button
              mode="contained-tonal"
              icon="map-marker"
              onPress={() => openInMaps(CHURCH_LOCATIONS[0].searchQuery)}
            >
              {labels.openElmhurst}
            </Button>
          </View>
        )}

        {renderProgram(location, isQueens)}
        {renderRoster(location, isQueens)}
      </Card.Content>
    </Card>
  );

  const renderBulletin = (bulletin: Bulletin) => {
    const metadataRows: Array<[string, string]> = [
      [labels.metadata.quarter, bulletin.quarter],
      [labels.metadata.tithePurpose, bulletin.tithePurpose],
      ...(hasBulletinValue(bulletin.pastorTravel)
        ? [[labels.metadata.pastorTravel, bulletin.pastorTravel] as [string, string]]
        : []),
    ];

    return (
      <>
        <Card mode="outlined" style={styles.card}>
          <Card.Content>
            {metadataRows.map(([label, value], index) => (
              <DataRow
                key={label}
                label={label}
                value={value}
                emptyText={labels.notAvailable}
                last={index === metadataRows.length - 1}
              />
            ))}
          </Card.Content>
        </Card>
        {renderLocation(labels.queens, bulletin.queens, true, bulletin.specialRemark)}
        {renderLocation(labels.brooklyn, bulletin.brooklyn, false, bulletin.specialRemark)}
      </>
    );
  };

  return (
    <>
      <Stack.Screen options={{ title: labels.title, showTitleChip: showHeaderTitle } as any} />
      <ScrollView
        style={DocumentStyles.container}
        onScroll={handleHeroScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scrollContent}
      >
        <ImageBackground
          source={{ uri: CHURCH_BUILDING_IMAGE_URL }}
          style={[
            NavigationStyles.heroHeader,
            { paddingTop: headerHeight + 6, paddingBottom: 24 },
          ]}
          resizeMode="cover"
        >
          <LinearGradient colors={theme.gradients.heroOverlay} style={StyleSheet.absoluteFill} />
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

        <View style={styles.weekTabsContainer}>
          <Button
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedWeek === '0' }}
            mode={selectedWeek === '0' ? 'contained-tonal' : 'outlined'}
            icon="calendar-today"
            onPress={() => selectWeek(0)}
            style={styles.weekTab}
          >
            {labels.thisWeek}
          </Button>
          <Button
            accessibilityRole="tab"
            accessibilityState={{ selected: selectedWeek === '1' }}
            mode={selectedWeek === '1' ? 'contained-tonal' : 'outlined'}
            icon="calendar-arrow-right"
            onPress={() => selectWeek(1)}
            style={styles.weekTab}
          >
            {labels.nextWeek}
          </Button>
        </View>

        {weeks[Number(selectedWeek)] && (() => {
          const index = Number(selectedWeek);
          const week = weeks[index];
          const cooldownSeconds = Math.max(
            0,
            Math.ceil((refreshAvailableAt[index] - cooldownClock) / 1000),
          );
          const cooldownLabel = `${Math.floor(cooldownSeconds / 60)}:${String(
            cooldownSeconds % 60,
          ).padStart(2, '0')}`;
          return (
          <View key={week.date} style={styles.weekSection}>
            <View
              style={[
                styles.weekHeader,
                {
                  borderBottomColor: theme.colors.outlineVariant,
                },
              ]}
            >
              <Text
                variant="titleLarge"
                style={[styles.weekDate, { color: theme.colors.onSurface }]}
              >
                {formatDate(week.date)}
              </Text>
              <IconButton
                accessibilityLabel={
                  cooldownSeconds > 0
                    ? `${labels.refresh} (${cooldownLabel})`
                    : labels.refresh
                }
                mode="contained-tonal"
                disabled={week.loading || cooldownSeconds > 0}
                icon="refresh"
                onPress={() => void refreshWeek(index)}
                style={styles.refreshButton}
              />
            </View>

            {week.loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator color={theme.colors.primary} />
                <Text>{labels.loading}</Text>
              </View>
            )}

            {week.error && (
              <Card mode="outlined" style={styles.card}>
                <Card.Content>
                  <Text variant="titleMedium">{labels.loadError}</Text>
                  <Text variant="bodyMedium" style={styles.errorDetail}>
                    {week.error}
                  </Text>
                  <Button mode="outlined" onPress={() => void refreshWeek(index)}>
                    {labels.retry}
                  </Button>
                </Card.Content>
              </Card>
            )}

            {week.bulletin && renderBulletin(week.bulletin)}
          </View>
          );
        })()}

        <View style={[DocumentStyles.section, styles.planningSection]}>
          <Text
            variant="titleLarge"
            style={[DocumentStyles.sectionTitle, { color: theme.colors.primary }]}
          >
            {labels.planning}
          </Text>
          <GridMenuCard
            title={labels.quarterlySchedule}
            subtitle={labels.churchStaffOnly}
            icon="file-table-outline"
            color={theme.colors.cardBgColors.bulletin}
            iconColor={theme.colors.iconColors.bulletin}
            onPress={openQuarterlySchedule}
            style={styles.scheduleCard}
          />
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 32,
  },
  weekSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  weekTabsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  weekTab: {
    flex: 1,
    minWidth: 0,
  },
  scheduleCard: {
    width: '100%',
  },
  planningSection: {
    marginTop: 0,
  },
  weekHeader: {
    alignItems: 'center',
    borderBottomWidth: 2,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingBottom: 10,
  },
  weekDate: {
    flexGrow: 1,
    flexShrink: 1,
    fontWeight: 'bold',
    minWidth: 0,
  },
  refreshButton: {
    flexShrink: 0,
    margin: 0,
  },
  card: {
    marginBottom: 16,
  },
  locationCardTitle: {
    paddingTop: 8,
  },
  cardSection: {
    marginBottom: 16,
  },
  remarkBanner: {
    borderRadius: 12,
    gap: 4,
    marginBottom: 20,
    padding: 14,
  },
  jointServiceNotice: {
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
    padding: 14,
  },
  dataRow: {
    paddingVertical: 10,
    gap: 4,
  },
  dataRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128, 128, 128, 0.35)',
  },
  scriptureActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  scriptureReference: {
    flexShrink: 1,
  },
  programActionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  programActionValue: {
    flexShrink: 1,
  },
  loadingContainer: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 32,
  },
  errorDetail: {
    marginVertical: 12,
  },
});
