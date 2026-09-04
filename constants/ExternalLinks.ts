import * as WebBrowser from 'expo-web-browser';
import { Alert, Linking, Platform } from 'react-native';
import { SupportedLanguage } from './LanguageContext';

/**
 * Church Identity & Branding Constants
 * Hardcoding these directly satisfies Tenet 5 (Simplicity) by removing
 * dependency on .env for static branding information.
 */
export const CHURCH_NAME = 'New York Chinese SDA Church';
export const CHURCH_PHONE = '(718) 205-8618';
export const CHURCH_EMAIL = 'pastor@nyccsda.org';

// Relative path to various church specific images in the public folder on GitHub Pages
export const CHURCH_BUILDING_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221703/church_building.jpg';
export const PASTOR_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221020/moses_fang-1536x1024.jpg';
export const BIBLE_WORKER_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221317/sarah_fang-1536x1024.jpg';
export const CHILDREN_MINISTRY_WORKER_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/13221357/geng_shuang-1536x1024.jpg';
export const FOOD_BANK_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2025/09/28035000/mmexport1738506529402.jpg.jpg';
export const FLUSHING_FELLOWSHIP_IMAGE_URL =
  'https://assets.adventistconnect.org/newyork2/2026/07/01230029/flushing_fellowship_3.jpg';
export const ELMHURST_SABBATH_URLS = [
  'https://assets.adventistconnect.org/newyork2/2026/07/19124827/elmhurst_sabbath.png'
]

export const IOS_PWA_INSTALL_GUIDE_URL =
  'https://youtu.be/5IwrG8BTylw?si=7FW6G4DWiJmLkz89&t=15';

// Hardcoded to 760 41st Ave Elmhurst, NY 11373
export const CHURCH_LATITUDE = 40.74546;
export const CHURCH_LONGITUDE = -73.88914;

/**
 * Sunset API Endpoint
 * Centralizing this here follows Tenet 5 (Simplicity) by providing a
 * single source for external API endpoints.
 */
export const getSunsetApiUrl = (lat: number, lng: number, date: string) =>
  `https://api.sunrise-sunset.org/json?lat=${lat}&lng=${lng}&date=${date}&formatted=0`;

/**
 * Production bulletin API. The public PWA sends only a Sabbath date; Apps
 * Script joins the yearly schedule with Queens/Brooklyn worship responses and
 * returns privacy-filtered JSON.
 *
 * Architecture, deployment, privacy, and verification documentation:
 * https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/blob/main/apps-script/README.md
 */
export const BULLETIN_API_BASE_URL =
  'https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec';

export const getBulletinApiUrl = (date: string) =>
  `${BULLETIN_API_BASE_URL}?date=${encodeURIComponent(date)}`;

/**
 * Staff-only source schedule. Google Drive enforces access for signed-in
 * nyccsda.org accounts; the public PWA does not proxy or embed its contents.
 */
export const QUARTERLY_SCHEDULE_URL =
  'https://docs.google.com/spreadsheets/d/1FqFJ8YvBA-IybOlVU1SW6ynrBGNs8Cd-9xlWz6SkkDA/edit?usp=sharing';

export const openQuarterlySchedule = () =>
  openURL(
    QUARTERLY_SCHEDULE_URL,
    'Access unavailable',
    'Could not open the staff schedule.',
  );

/**
 * Centralized hub for external destinations.
 * Consolidating these here satisfies Tenet 5 (Simplicity) by providing
 * a single source of truth for the app's external touchpoints.
 */

export const openURL = async (
  url: string,
  errorTitle = 'Error',
  errorMessage = 'Could not open the link.',
) => {
  try {
    await Linking.openURL(url);
  } catch (error) {
    Alert.alert(errorTitle, errorMessage);
    console.error('Linking error:', error);
  }
};

/**
 * Keeps external documents outside the app's rendering surface. Native builds
 * use the system browser sheet/custom tab; web builds use a separate tab.
 */
export const openInSystemBrowser = async (
  url: string,
  errorTitle = 'Error',
  errorMessage = 'Could not open the link.',
) => {
  try {
    if (Platform.OS === 'web') {
      await Linking.openURL(url);
    } else {
      await WebBrowser.openBrowserAsync(url);
    }
  } catch (error) {
    Alert.alert(errorTitle, errorMessage);
    console.error('External browser error:', error);
  }
};

export const openAdventistGiving = async () => {
  return openURL(
    'https://adventistgiving.org/donate/AN48CO',
    'Error',
    'Could not open the online giving link.',
  );
};

export const openSpotifyPodcast = async () => {
  return openURL(
    'https://open.spotify.com/show/6Ig7RqU3A5vivl4x3FJFLV',
    'Error',
    'Could not open the Spotify podcast.',
  );
};

export const openZoomClass = async () => {
  return openURL(
    'https://us06web.zoom.us/j/2541879535?pwd=Rmhsa0pFK3hQVTRHMzVqQ2swZlBodz09',
    'Error',
    'Could not open the Zoom class link.',
  );
};

export const openSermonArchive = async () => {
  return openURL(
    'https://www.youtube.com/playlist?list=PLX85oBoVF4TKC4p0hJ6EK6X_2zXOB53eW',
    'Error',
    'Could not open the YouTube sermon archive.',
  );
};

export const openSabbathStream = async () => {
  return openURL(
    'https://www.youtube.com/@newyorkchinesesdachurch1334/streams',
    'Error',
    'Could not open the YouTube livestream.',
  );
};

export const openYouTubeSearch = (query: string) => {
  return openURL(
    `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
    'Error',
    'Could not open the YouTube search results.',
  );
};

export const openIosPwaInstallGuide = () =>
  openURL(
    IOS_PWA_INSTALL_GUIDE_URL,
    'Error',
    'Could not open the PWA installation guide.',
  );

// SABBATH SCHOOL DIGITAL ECOSYSTEM
// DENOMINATIONAL CORE FRAMEWORK & PUBLIC DATA BACKBONE
// URL: https://sabbath-school.adventech.io
// Status: Official / Direct Institutional Partner
// Context: Developed by Adventech via direct authorization from the General
//          Conference (Sabbath School and Personal Ministries Department).
// Content: Web parity for the official "Sabbath School & PM" mobile app,
//          hosting authorized curriculum for all age divisions.
// Architecture: Functions as the open-source data engine/API backend that
//               independent platforms consume to render alternative layouts.
//
// Adventech and the General Conference of Seventh-day Adventists have an official partnership
// https://sspmadventist.org/sspmapp
export const openSabbathSchool = (language: SupportedLanguage) => {
  let path = language || 'en';

  if (language === 'zh' || language === 'zh-cn') {
    // There is no traditional Chinese version of the Sabbath School site,
    // so we default to simplified Chinese which is more widely used online
    path = 'zh';
  }

  return openURL(
    `https://sabbath-school.adventech.io/${path}`,
    'Error',
    'Could not open the Sabbath School link.',
  );
};

const getSabbathSchoolLanguage = (language: SupportedLanguage) =>
  language === 'zh' || language === 'zh-cn' ? 'zh' : language || 'en';

export const getCurrentSabbathSchoolUrl = (
  language: SupportedLanguage,
  date = new Date(),
) => {
  const candidates = [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]
    .flatMap((year) => [1, 2, 3, 4].map((quarter) => {
      const start = new Date(year, (quarter - 1) * 3, 1);
      start.setDate(start.getDate() - ((start.getDay() + 1) % 7));
      return { quarter, start, year };
    }))
    .filter(({ start }) => start.getTime() <= date.getTime())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
  const { quarter, start: quarterStart, year } = candidates[0];
  const lesson = Math.max(
    1,
    Math.min(14, Math.floor((date.getTime() - quarterStart.getTime()) / 604_800_000) + 1),
  );
  return `https://sabbath-school.adventech.io/${getSabbathSchoolLanguage(language)}/${year}-${String(quarter).padStart(2, '0')}/${String(lesson).padStart(2, '0')}`;
};

export const openCurrentSabbathSchool = (language: SupportedLanguage) =>
  openURL(
    getCurrentSabbathSchoolUrl(language),
    'Error',
    'Could not open this week\'s Sabbath School lesson.',
  );

export const openChildrenSabbathSchool = () =>
  openURL(
    'https://aliveinjesus.info/',
    'Error',
    'Could not open the children\'s Sabbath School catalog.',
  );

export type ChildrenSabbathSchoolCurriculum =
  | 'beginner-student'
  | 'beginner-teacher'
  | 'kindergarten-student'
  | 'kindergarten-teacher'
  | 'primary-student'
  | 'primary-teacher'
  | 'junior'
  | 'junior-teacher'
  | 'teen'
  | 'teen-teacher'
  | 'youth'
  | 'youth-teacher';

type ChildrenCurriculumRoute = Readonly<{
  host: string;
  language: 'en' | 'zh';
  pdfIndex: number;
  suffix: string;
  weekStartsOnSunday: boolean;
  quarterlyGroup?: string;
}>;

const ENGLISH_CHILDREN_CURRICULUM_ROUTES: Readonly<
  Record<ChildrenSabbathSchoolCurriculum, {
    host: string;
    language: 'en';
    pdfIndex: number;
    suffix: string;
    weekStartsOnSunday: boolean;
  }>
> = {
  'beginner-student': { host: 'app.beginner.aliveinjesus.info', language: 'en', pdfIndex: 0, suffix: 'zaijbgsg', weekStartsOnSunday: true },
  'beginner-teacher': { host: 'app.beginner.aliveinjesus.info', language: 'en', pdfIndex: 0, suffix: 'yaijbgtg', weekStartsOnSunday: true },
  'kindergarten-student': { host: 'app.kindergarten.aliveinjesus.info', language: 'en', pdfIndex: 0, suffix: 'zaijkdsg', weekStartsOnSunday: true },
  'kindergarten-teacher': { host: 'app.kindergarten.aliveinjesus.info', language: 'en', pdfIndex: 0, suffix: 'yaijkdtg', weekStartsOnSunday: true },
  'primary-student': { host: 'app.primary.aliveinjesus.info', language: 'en', pdfIndex: 0, suffix: 'zaijprsg', weekStartsOnSunday: true },
  'primary-teacher': { host: 'app.primary.aliveinjesus.info', language: 'en', pdfIndex: 0, suffix: 'yaijprtg', weekStartsOnSunday: true },
  junior: { host: 'sabbath-school.adventech.io', language: 'en', pdfIndex: 0, suffix: 'pp', weekStartsOnSunday: false },
  'junior-teacher': { host: 'sabbath-school.adventech.io', language: 'en', pdfIndex: 1, suffix: 'pp', weekStartsOnSunday: false },
  teen: { host: 'sabbath-school.adventech.io', language: 'en', pdfIndex: 0, suffix: 'rt', weekStartsOnSunday: false },
  'teen-teacher': { host: 'sabbath-school.adventech.io', language: 'en', pdfIndex: 1, suffix: 'rt', weekStartsOnSunday: false },
  youth: { host: 'sabbath-school.adventech.io', language: 'en', pdfIndex: 0, suffix: 'cc', weekStartsOnSunday: false },
  'youth-teacher': { host: 'sabbath-school.adventech.io', language: 'en', pdfIndex: 1, suffix: 'cc', weekStartsOnSunday: false },
};

const CHINESE_CHILDREN_CURRICULUM_ROUTES: Partial<
  Readonly<Record<ChildrenSabbathSchoolCurriculum, ChildrenCurriculumRoute>>
> = {
  // These routes support deterministic non-API links. Live availability and
  // localized category names come from the Adventech catalog below.
  'beginner-student': { host: 'sabbath-school.adventech.io', language: 'zh', pdfIndex: 0, suffix: 'bg', weekStartsOnSunday: false, quarterlyGroup: '初级学课' },
  'beginner-teacher': { host: 'sabbath-school.adventech.io', language: 'zh', pdfIndex: 1, suffix: 'bg', weekStartsOnSunday: false, quarterlyGroup: '初级学课' },
  'kindergarten-student': { host: 'sabbath-school.adventech.io', language: 'zh', pdfIndex: 0, suffix: 'kd', weekStartsOnSunday: false, quarterlyGroup: '中级学课' },
  'kindergarten-teacher': { host: 'sabbath-school.adventech.io', language: 'zh', pdfIndex: 1, suffix: 'kd', weekStartsOnSunday: false, quarterlyGroup: '中级学课' },
};

const getChildrenCurriculumRoute = (
  curriculum: ChildrenSabbathSchoolCurriculum,
  language: SupportedLanguage,
): ChildrenCurriculumRoute =>
  language === 'zh' || language === 'zh-cn'
    ? CHINESE_CHILDREN_CURRICULUM_ROUTES[curriculum] ||
      ENGLISH_CHILDREN_CURRICULUM_ROUTES[curriculum]
    : ENGLISH_CHILDREN_CURRICULUM_ROUTES[curriculum];

export const getChildrenSabbathSchoolLanguage = (
  _curriculum: ChildrenSabbathSchoolCurriculum,
  language: SupportedLanguage,
) => getChildrenProviderLanguage(language);

const getChildrenQuarterAndLesson = (
  route: ChildrenCurriculumRoute,
  date: Date,
) => {
  const candidates = [date.getFullYear() - 1, date.getFullYear(), date.getFullYear() + 1]
    .flatMap((year) => [1, 2, 3, 4].map((quarter) => {
      const start = new Date(year, (quarter - 1) * 3, 1);
      const daysBack = route.weekStartsOnSunday
        ? start.getDay()
        : (start.getDay() + 1) % 7;
      start.setDate(start.getDate() - daysBack);
      return { quarter, start, year };
    }))
    .filter(({ start }) => start.getTime() <= date.getTime())
    .sort((a, b) => b.start.getTime() - a.start.getTime());
  const { quarter, start, year } = candidates[0];
  const lesson = Math.max(
    1,
    Math.min(14, Math.floor((date.getTime() - start.getTime()) / 604_800_000) + 1),
  );
  return {
    lesson: String(lesson).padStart(2, '0'),
    quarterly: `${year}-${String(quarter).padStart(2, '0')}-${route.suffix}`,
  };
};

export const getCurrentChildrenSabbathSchoolUrl = (
  curriculum: ChildrenSabbathSchoolCurriculum,
  language: SupportedLanguage = 'en',
  date = new Date(),
) => {
  const route = getChildrenCurriculumRoute(curriculum, language);
  if (route.quarterlyGroup) {
    return `https://${route.host}/${route.language}?group=${encodeURIComponent(route.quarterlyGroup)}`;
  }
  const { lesson, quarterly } = getChildrenQuarterAndLesson(route, date);
  return `https://${route.host}/${route.language}/${quarterly}/${lesson}`;
};

type ChildrenLessonResponse = {
  pdfs?: Array<{ src?: string }>;
};

type ChildrenQuarterlySummary = {
  end_date?: string;
  id?: string;
  quarterly_group?: {
    name?: string;
  };
  start_date?: string;
};

export type ChildrenSabbathSchoolOption = Readonly<{
  available: boolean;
  categoryName?: string;
}>;

type ChildrenQuarterlyResponse = {
  lessons?: Array<{
    end_date?: string;
    id?: string;
    start_date?: string;
  }>;
};

type ChildrenCatalogCandidate = Readonly<{
  pdfIndex: number;
  suffix: string;
}>;

const CHILDREN_CATALOG_CANDIDATES: Readonly<
  Record<ChildrenSabbathSchoolCurriculum, readonly ChildrenCatalogCandidate[]>
> = {
  'beginner-student': [
    { suffix: 'zaijbgsg', pdfIndex: 0 },
    { suffix: 'bg', pdfIndex: 0 },
  ],
  'beginner-teacher': [
    { suffix: 'yaijbgtg', pdfIndex: 0 },
    { suffix: 'yaijbgtgtg', pdfIndex: 0 },
    { suffix: 'bg', pdfIndex: 1 },
  ],
  'kindergarten-student': [
    { suffix: 'zaijkdsg', pdfIndex: 0 },
    { suffix: 'kd', pdfIndex: 0 },
  ],
  'kindergarten-teacher': [
    { suffix: 'yaijkdtg', pdfIndex: 0 },
    { suffix: 'kd', pdfIndex: 1 },
  ],
  'primary-student': [
    { suffix: 'zaijprsg', pdfIndex: 0 },
    { suffix: 'pr', pdfIndex: 0 },
  ],
  'primary-teacher': [
    { suffix: 'yaijprtg', pdfIndex: 0 },
    { suffix: 'pr', pdfIndex: 1 },
  ],
  junior: [{ suffix: 'pp', pdfIndex: 0 }],
  'junior-teacher': [{ suffix: 'pp', pdfIndex: 1 }],
  teen: [{ suffix: 'rt', pdfIndex: 0 }],
  'teen-teacher': [{ suffix: 'rt', pdfIndex: 1 }],
  youth: [
    { suffix: 'hant-cc', pdfIndex: 0 },
    { suffix: 'cc', pdfIndex: 0 },
  ],
  'youth-teacher': [
    { suffix: 'hant-cc', pdfIndex: 1 },
    { suffix: 'cc', pdfIndex: 1 },
  ],
};

const parseAdventechDate = (value?: string) => {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  return new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1]));
};

const isActiveOnDate = (
  item: { start_date?: string; end_date?: string },
  date: Date,
) => {
  const start = parseAdventechDate(item.start_date);
  const end = parseAdventechDate(item.end_date);
  const requestedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return !!start && !!end &&
    start.getTime() <= requestedDate.getTime() &&
    requestedDate.getTime() <= end.getTime();
};

const getChildrenProviderLanguage = (language: SupportedLanguage): 'en' | 'es' | 'zh' =>
  language === 'zh' || language === 'zh-cn' ? 'zh' : language;

const findActiveChildrenQuarterly = (
  curriculum: ChildrenSabbathSchoolCurriculum,
  catalog: readonly ChildrenQuarterlySummary[],
  date: Date,
) => {
  const activeQuarterlies = catalog.filter((quarterly) => isActiveOnDate(quarterly, date));
  return CHILDREN_CATALOG_CANDIDATES[curriculum]
    .map((candidate) => ({
      candidate,
      quarterly: activeQuarterlies.find(({ id }) => id?.endsWith(`-${candidate.suffix}`)),
    }))
    .find(({ quarterly }) => quarterly?.id);
};

export const getCurrentChildrenSabbathSchoolOptions = async (
  language: SupportedLanguage,
  date = new Date(),
  fetchCatalog: typeof fetch = fetch,
  signal?: AbortSignal,
) => {
  const providerLanguage = getChildrenProviderLanguage(language);
  const response = await fetchCatalog(
    `https://sabbath-school.adventech.io/api/v2/${providerLanguage}/quarterlies/index.json`,
    { signal },
  );
  if (!response.ok) {
    throw new Error(`Quarterly catalog request failed: ${response.status}`);
  }
  const data = await response.json() as ChildrenQuarterlySummary[];
  const catalog = Array.isArray(data) ? data : [];
  return Object.fromEntries(
    (Object.keys(CHILDREN_CATALOG_CANDIDATES) as ChildrenSabbathSchoolCurriculum[])
      .map((curriculum) => {
        const match = findActiveChildrenQuarterly(curriculum, catalog, date);
        return [
          curriculum,
          {
            available: !!match,
            categoryName: match?.quarterly?.quarterly_group?.name,
          },
        ];
      }),
  ) as Record<ChildrenSabbathSchoolCurriculum, ChildrenSabbathSchoolOption>;
};

export const getCurrentChildrenSabbathSchoolAvailability = async (
  language: SupportedLanguage,
  date = new Date(),
  fetchCatalog: typeof fetch = fetch,
  signal?: AbortSignal,
) => {
  const options = await getCurrentChildrenSabbathSchoolOptions(
    language,
    date,
    fetchCatalog,
    signal,
  );
  return Object.fromEntries(
    (Object.entries(options) as Array<[
      ChildrenSabbathSchoolCurriculum,
      ChildrenSabbathSchoolOption,
    ]>).map(([curriculum, option]) => [curriculum, option.available]),
  ) as Record<ChildrenSabbathSchoolCurriculum, boolean>;
};

const fetchCurrentChildrenLessonPdfUrl = async (
  curriculum: ChildrenSabbathSchoolCurriculum,
  language: 'en' | 'es' | 'zh',
  date: Date,
  fetchLesson: typeof fetch,
) => {
  const catalogResponse = await fetchLesson(
    `https://sabbath-school.adventech.io/api/v2/${language}/quarterlies/index.json`,
  );
  if (!catalogResponse.ok) {
    throw new Error(`Quarterly catalog request failed: ${catalogResponse.status}`);
  }
  const catalogData = await catalogResponse.json() as ChildrenQuarterlySummary[];
  const match = findActiveChildrenQuarterly(
    curriculum,
    Array.isArray(catalogData) ? catalogData : [],
    date,
  );
  if (!match?.quarterly?.id) {
    throw new Error(`No active ${language} quarterly for ${curriculum}.`);
  }

  const quarterly = match.quarterly.id;
  const quarterlyResponse = await fetchLesson(
    `https://sabbath-school.adventech.io/api/v2/${language}/quarterlies/${quarterly}/index.json`,
  );
  if (!quarterlyResponse.ok) {
    throw new Error(`Quarterly request failed: ${quarterlyResponse.status}`);
  }
  const quarterlyData = await quarterlyResponse.json() as ChildrenQuarterlyResponse;
  const activeLessons = quarterlyData.lessons?.filter((lesson) =>
    isActiveOnDate(lesson, date)
  ) || [];
  const lesson = activeLessons.find(({ id }) => /^\d+$/.test(id || '')) || activeLessons[0];
  if (!lesson?.id) throw new Error('The quarterly has no lesson for this date.');

  const response = await fetchLesson(
    `https://sabbath-school.adventech.io/api/v2/${language}/quarterlies/${quarterly}/lessons/${lesson.id}/index.json`,
  );
  if (!response.ok) throw new Error(`Lesson request failed: ${response.status}`);

  const lessonData = await response.json() as ChildrenLessonResponse;
  const pdfUrl = lessonData.pdfs?.[match.candidate.pdfIndex]?.src;
  const parsedPdfUrl = pdfUrl ? new URL(pdfUrl) : null;
  if (
    !parsedPdfUrl ||
    parsedPdfUrl.protocol !== 'https:' ||
    parsedPdfUrl.hostname !== 'sabbath-school-pdf.adventech.io'
  ) {
    throw new Error('The lesson does not include an official PDF.');
  }
  return parsedPdfUrl.href;
};

export const getCurrentChildrenSabbathSchoolPdfUrl = async (
  curriculum: ChildrenSabbathSchoolCurriculum,
  language: SupportedLanguage = 'en',
  date = new Date(),
  fetchLesson: typeof fetch = fetch,
) => {
  return fetchCurrentChildrenLessonPdfUrl(
    curriculum,
    getChildrenProviderLanguage(language),
    date,
    fetchLesson,
  );
};

export const openCurrentChildrenSabbathSchool = (
  curriculum: ChildrenSabbathSchoolCurriculum,
  language: SupportedLanguage = 'en',
) => {
  // Reserve the web browsing context during the original tap. Waiting for the
  // API first can cause installed PWAs to treat the PDF as an in-app redirect.
  const externalWindow = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.open('about:blank', '_blank')
    : null;
  if (externalWindow) externalWindow.opener = null;

  getCurrentChildrenSabbathSchoolPdfUrl(curriculum, language)
    .then(async (pdfUrl) => {
      if (Platform.OS === 'web') {
        if (!externalWindow) {
          throw new Error('The external browser window was blocked.');
        }
        externalWindow.location.replace(pdfUrl);
      } else {
        await openInSystemBrowser(
          pdfUrl,
          'Error',
          'Could not open the children\'s Sabbath School PDF.',
        );
      }
    })
    .catch((error) => {
      externalWindow?.close();
      Alert.alert(
        'Error',
        'Could not open the current children\'s Sabbath School PDF in the external browser.',
      );
      console.error('Children Sabbath School PDF error:', error);
    });
};

export const getBabiesSabbathSchoolUrl = (
  language: SupportedLanguage = 'en',
) => {
  if (language === 'zh' || language === 'zh-cn') {
    return 'https://babies.aliveinjesus.info/zh/resources';
  }
  if (language === 'es') {
    return 'https://babies.aliveinjesus.info/es/resources';
  }
  return 'https://babies.aliveinjesus.info/resources';
};

export const openBabiesSabbathSchool = (
  language: SupportedLanguage = 'en',
) =>
  openURL(
    getBabiesSabbathSchoolUrl(language),
    'Error',
    'Could not open the Babies parent and teacher resources.',
  );

export const openChineseHymnalIos = () =>
  openURL(
    'https://apps.apple.com/us/app/506%E8%AE%9A%E7%BE%8E%E8%A9%A9-traditional-chinese/id6498894032',
    'Error',
    'Could not open the App Store link.',
  );

export const openChineseHymnalAndroid = () =>
  openURL(
    'https://play.google.com/store/apps/details?id=org.chumadventist.hymnal506.next',
    'Error',
    'Could not open the Google Play link.',
  );

/**
 * Opens a given address in the Google Maps app or browser.
 * @param address The formatted address string to search for.
 */
export const openInMaps = async (address: string) => {
  if (!address) return;
  const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    address,
  )}`;
  return openURL(url, 'Error', 'Could not open Google Maps.');
};

export const openBeliefs = () =>
  openURL('https://adventist.org/beliefs#official-beliefs');
export const openGNYC = () => openURL('https://gnyc.org/');
export const openAtlanticUnion = () => openURL('https://atlantic-union.org/');

export const openPhone = (phone: string) => {
  const cleanedPhone = phone.replace(/[^\d+]/g, '');
  return openURL(
    `tel:${cleanedPhone}`,
    'Error',
    'Phone calls are not supported on this device or emulator.',
  );
};

export const openEmail = (email: string) =>
  openURL(
    `mailto:${email}`,
    'Error',
    'Email is not configured on this device or emulator.',
  );
