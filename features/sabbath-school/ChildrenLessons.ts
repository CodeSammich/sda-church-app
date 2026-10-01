import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * Finds this week's children's Sabbath School lesson for an age group (#336).
 *
 * Every age group opens something every week, trying in order:
 *
 * 1. this week's lesson PDF in the app's language, where Adventech has one;
 * 2. this week's English lesson PDF;
 * 3. the age group's Alive in Jesus website, which always loads.
 *
 * The app used to hide an age group unless Adventech's catalog listed a lesson
 * for today. That left the screen blank for weeks at a time: the catalog lists
 * some quarters with the previous quarter's dates, Chinese lessons come out late
 * or not at all, there are none in Spanish, and Alive in Jesus lessons moved to
 * a newer catalog in 2026.
 */

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

type LessonLanguage = 'en' | 'zh';

type LessonSource =
  // A quarterly in Adventech's catalog, such as 2026-04-pp. Each lesson lists
  // the student's PDF first and the teacher's second.
  | Readonly<{ catalog: 'quarterly'; suffix: string; pdfIndex: 0 | 1 }>
  // An Alive in Jesus book, such as aij/2026-04-bg, with one PDF per week.
  | Readonly<{ catalog: 'aliveInJesus'; name: string }>;

type AgeGroup = Readonly<{
  website: string;
  sources: Readonly<Partial<Record<LessonLanguage, readonly LessonSource[]>>>;
}>;

const quarterly = (suffix: string, pdfIndex: 0 | 1): LessonSource => ({
  catalog: 'quarterly',
  suffix,
  pdfIndex,
});
const aliveInJesus = (name: string): LessonSource => ({ catalog: 'aliveInJesus', name });

// Junior, Teen, and Youth link to their current lessons from these sites until
// Alive in Jesus covers those ages (2027 or later).
const website = (level: string) => `https://${level}.aliveinjesus.info/`;

export const CHILDREN_AGE_GROUPS: Readonly<Record<ChildrenSabbathSchoolCurriculum, AgeGroup>> = {
  'beginner-student': {
    website: website('beginner'),
    sources: { zh: [quarterly('bg', 0)], en: [aliveInJesus('bg')] },
  },
  'beginner-teacher': {
    website: website('beginner'),
    sources: { zh: [quarterly('bg', 1)], en: [aliveInJesus('bg-tg')] },
  },
  'kindergarten-student': {
    website: website('kindergarten'),
    sources: { zh: [quarterly('kd', 0)], en: [aliveInJesus('kd')] },
  },
  'kindergarten-teacher': {
    website: website('kindergarten'),
    sources: { zh: [quarterly('kd', 1)], en: [aliveInJesus('kd-tg')] },
  },
  'primary-student': {
    website: website('primary'),
    sources: { zh: [quarterly('pr', 0)], en: [aliveInJesus('pr')] },
  },
  'primary-teacher': {
    website: website('primary'),
    sources: { zh: [quarterly('pr', 1)], en: [aliveInJesus('pr-tg')] },
  },
  junior: {
    website: website('junior'),
    sources: { zh: [quarterly('pp', 0)], en: [quarterly('pp', 0)] },
  },
  'junior-teacher': {
    website: website('junior'),
    sources: { zh: [quarterly('pp', 1)], en: [quarterly('pp', 1)] },
  },
  teen: {
    website: website('teen'),
    sources: { en: [quarterly('rt', 0)] },
  },
  'teen-teacher': {
    website: website('teen'),
    sources: { en: [quarterly('rt', 1)] },
  },
  youth: {
    website: website('youth'),
    sources: { zh: [quarterly('hant-cc', 0), quarterly('cc', 0)], en: [quarterly('cc', 0)] },
  },
  'youth-teacher': {
    website: website('youth'),
    sources: { zh: [quarterly('hant-cc', 1), quarterly('cc', 1)], en: [quarterly('cc', 1)] },
  },
};

const ADVENTECH_API = 'https://sabbath-school.adventech.io/api';
const PDF_HOSTS = ['sabbath-school-pdf.adventech.io', 'sabbath-school-resources-media.adventech.io'];

// Give up on the lesson and open the website after this long.
const LOOKUP_TIMEOUT_MS = 12_000;

type Dated = { start_date?: string; end_date?: string };

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Rounded, so a daylight saving change doesn't lose a day.
const daysBetween = (from: Date, to: Date) =>
  Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);

const parseAdventechDate = (value?: string) => {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? new Date(Number(match[3]), Number(match[2]) - 1, Number(match[1])) : null;
};

const covers = (item: Dated, date: Date) => {
  const start = parseAdventechDate(item.start_date);
  const end = parseAdventechDate(item.end_date);
  return !!start && !!end && daysBetween(start, date) >= 0 && daysBetween(date, end) >= 0;
};

/**
 * The quarter a date falls in, such as "2026-04", and its week, from 1. A
 * quarter starts on the Sabbath on or before its first day. Alive in Jesus weeks
 * run Sunday to Sabbath, so its quarters start the day after.
 */
export const getChildrenQuarter = (date: Date, weekStartsOn: 'saturday' | 'sunday') => {
  const today = startOfDay(date);
  const starts = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1].flatMap((year) =>
    [1, 2, 3, 4].map((quarter) => {
      const start = new Date(year, (quarter - 1) * 3, 1);
      const daysBack = weekStartsOn === 'sunday' ? start.getDay() : (start.getDay() + 1) % 7;
      start.setDate(start.getDate() - daysBack);
      return { quarter, start, year };
    }),
  );
  const current = starts.filter(({ start }) => daysBetween(start, today) >= 0).pop()!;
  return {
    id: `${current.year}-${String(current.quarter).padStart(2, '0')}`,
    week: Math.floor(daysBetween(current.start, today) / 7) + 1,
  };
};

// Only the official PDF hosts, so a changed catalog can't send people elsewhere.
const officialPdf = (src?: string) => {
  try {
    const url = new URL(src || '');
    return url.protocol === 'https:' && PDF_HOSTS.includes(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
};

// This week's lesson, or else the quarter's lesson for this week by number.
const pickWeek = <T>(weeks: readonly T[], isThisWeek: (week: T) => boolean, week: number) =>
  weeks.find(isThisWeek) || weeks[Math.min(week, weeks.length) - 1];

type GetJson = (url: string) => Promise<any>;

const findQuarterlyPdf = async (
  source: Extract<LessonSource, { catalog: 'quarterly' }>,
  language: LessonLanguage,
  date: Date,
  getJson: GetJson,
) => {
  const base = `${ADVENTECH_API}/v2/${language}/quarterlies`;
  const catalog: Array<Dated & { id?: string }> = await getJson(`${base}/index.json`);
  const { id: quarter, week } = getChildrenQuarter(date, 'saturday');
  const issues = (Array.isArray(catalog) ? catalog : []).filter(({ id }) =>
    new RegExp(`^\\d{4}-\\d{2}-${source.suffix}$`).test(id || ''),
  );
  // Prefer the issue named for this quarter: the catalog has listed a new
  // quarter's issue with the previous quarter's dates.
  const issue =
    issues.find(({ id }) => id === `${quarter}-${source.suffix}`) ||
    issues.find((each) => covers(each, date));
  if (!issue?.id) return null;

  const { lessons = [] }: { lessons?: Array<Dated & { id?: string }> } = await getJson(
    `${base}/${issue.id}/index.json`,
  );
  const numbered = lessons.filter(({ id }) => /^\d+$/.test(id || ''));
  const lesson = pickWeek(numbered, (each) => covers(each, date), week);
  if (!lesson?.id) return null;

  const { pdfs = [] }: { pdfs?: Array<{ src?: string }> } = await getJson(
    `${base}/${issue.id}/lessons/${lesson.id}/index.json`,
  );
  return officialPdf(pdfs[source.pdfIndex]?.src);
};

const findAliveInJesusPdf = async (
  source: Extract<LessonSource, { catalog: 'aliveInJesus' }>,
  language: LessonLanguage,
  date: Date,
  getJson: GetJson,
) => {
  const { id: quarter, week } = getChildrenQuarter(date, 'sunday');
  const book = `${language}/aij/${quarter}-${source.name}`;
  const [contents, pdfs]: [
    { sections?: Array<{ documents?: Array<{ name?: string; startDate?: string; endDate?: string }> }> },
    Array<{ src?: string; target?: string }>,
  ] = await Promise.all([
    getJson(`${ADVENTECH_API}/v3/${book}/sections/index.json`),
    getJson(`${ADVENTECH_API}/v3/${book}/pdf.json`),
  ]);
  const weeks = (contents.sections || [])
    .flatMap((section) => section.documents || [])
    .filter(({ name }) => /^\d+$/.test(name || ''));
  const document = pickWeek(
    weeks,
    (each) => covers({ start_date: each.startDate, end_date: each.endDate }, date),
    week,
  );
  if (!document?.name) return null;
  const pdf = (Array.isArray(pdfs) ? pdfs : []).find(
    ({ target }) => target === `${book}/${document.name}`,
  );
  return officialPdf(pdf?.src);
};

const lessonLanguages = (language: SupportedLanguage): LessonLanguage[] =>
  language === 'zh' || language === 'zh-cn' ? ['zh', 'en'] : ['en'];

/**
 * The address to open for an age group this week: a lesson PDF where one is
 * found, otherwise the age group's website. Never rejects.
 */
export const findChildrenLessonUrl = async (
  curriculum: ChildrenSabbathSchoolCurriculum,
  language: SupportedLanguage = 'en',
  date = new Date(),
  fetchJson: typeof fetch = fetch,
  timeoutMs = LOOKUP_TIMEOUT_MS,
): Promise<string> => {
  const ageGroup = CHILDREN_AGE_GROUPS[curriculum];
  const controller = new AbortController();
  const getJson: GetJson = async (url) => {
    const response = await fetchJson(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
    // A missing Alive in Jesus book returns a web page, which fails here.
    return response.json();
  };

  const findPdf = async () => {
    for (const lessonLanguage of lessonLanguages(language)) {
      for (const source of ageGroup.sources[lessonLanguage] || []) {
        if (controller.signal.aborted) return null;
        try {
          const pdf =
            source.catalog === 'quarterly'
              ? await findQuarterlyPdf(source, lessonLanguage, date, getJson)
              : await findAliveInJesusPdf(source, lessonLanguage, date, getJson);
          if (pdf) return pdf;
        } catch {
          // Missing, late, or unreachable: try the next source.
        }
      }
    }
    return null;
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      controller.abort();
      resolve(null);
    }, timeoutMs);
  });
  try {
    return (await Promise.race([findPdf(), timeout])) || ageGroup.website;
  } finally {
    clearTimeout(timer);
  }
};
