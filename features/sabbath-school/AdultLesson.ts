import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The adult Sabbath School lesson a bulletin's Sabbath discusses (#558), from
 * the same Adventech catalog as the app's Sabbath School links, so the weekly
 * sheet needs no lesson column.
 *
 * The class discusses the lesson studied during the week before. Lesson weeks
 * run Sabbath to Friday, so it's the lesson whose week ends the day before the
 * Sabbath. That Friday is always in the lesson's own quarter, since a quarter
 * starts on the Sabbath on or before its first day. The printed bulletin picks
 * the same lesson (getPhysicalSabbathSchoolLesson_ in PrintedBulletin.gs).
 */

export type AdultLesson = Readonly<{
  /** The lesson's number in its quarter, from 1. */
  number: number;
  title: string;
  /** The lesson on the Sabbath School website. */
  url: string;
}>;

const ADVENTECH = 'https://sabbath-school.adventech.io';

// Give up after this long; the bulletin shows the rest without it.
const LOOKUP_TIMEOUT_MS = 12_000;

// Adventech's quarterly for each app language. Traditional Chinese is its own
// issue, such as 2026-04-hant.
const QUARTERLIES: Record<SupportedLanguage, { language: string; suffix: string }> = {
  en: { language: 'en', suffix: '' },
  zh: { language: 'zh', suffix: '-hant' },
  'zh-cn': { language: 'zh', suffix: '' },
  es: { language: 'es', suffix: '' },
};

const pad = (value: number) => String(value).padStart(2, '0');

// Adventech writes dates as DD/MM/YYYY.
const toIsoDate = (value?: string) => {
  const match = value?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : '';
};

/** The Friday before a Sabbath (YYYY-MM-DD), and that Friday's quarter, such as 2026-04. */
export const getAdultLessonWeek = (sabbath: string) => {
  const [year, month, day] = sabbath.split('-').map(Number);
  const friday = new Date(Date.UTC(year, month - 1, day - 1));
  return {
    friday: `${friday.getUTCFullYear()}-${pad(friday.getUTCMonth() + 1)}-${pad(friday.getUTCDate())}`,
    quarter: `${friday.getUTCFullYear()}-${pad(Math.floor(friday.getUTCMonth() / 3) + 1)}`,
  };
};

type CatalogLesson = { id?: string; title?: string; start_date?: string; end_date?: string };

const lookUpAdultLesson = async (
  sabbath: string,
  language: SupportedLanguage,
  fetchJson: typeof fetch,
): Promise<AdultLesson | null> => {
  const { friday, quarter } = getAdultLessonWeek(sabbath);
  const source = QUARTERLIES[language] || QUARTERLIES.en;
  const quarterly = `${quarter}${source.suffix}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LOOKUP_TIMEOUT_MS);
  try {
    const response = await fetchJson(
      `${ADVENTECH}/api/v2/${source.language}/quarterlies/${quarterly}/index.json`,
      { signal: controller.signal },
    );
    if (!response.ok) return null;
    const { lessons = [] }: { lessons?: CatalogLesson[] } = await response.json();
    const lesson = lessons.find(
      ({ start_date, end_date }) =>
        toIsoDate(start_date) !== '' &&
        toIsoDate(start_date) <= friday &&
        friday <= toIsoDate(end_date),
    );
    const number = Number(lesson?.id);
    const title = lesson?.title?.trim();
    if (!lesson?.id || !Number.isInteger(number) || !title) return null;
    return {
      number,
      title,
      url: `${ADVENTECH}/${source.language}/${quarterly}/${lesson.id}`,
    };
  } finally {
    clearTimeout(timer);
  }
};

const lessons = new Map<string, Promise<AdultLesson | null>>();

/**
 * The lesson for a Sabbath (YYYY-MM-DD) in the app's language, or null when
 * the catalog can't be read or has no such lesson. Never rejects. Each
 * Sabbath's lesson is looked up once; a failed lookup is tried again next time.
 */
export const findAdultLesson = (
  sabbath: string,
  language: SupportedLanguage,
  fetchJson: typeof fetch = fetch,
): Promise<AdultLesson | null> => {
  const key = `${language}:${sabbath}`;
  let lesson = lessons.get(key);
  if (!lesson) {
    lesson = lookUpAdultLesson(sabbath, language, fetchJson).catch(() => null);
    lessons.set(key, lesson);
    void lesson.then((found) => {
      if (!found) lessons.delete(key);
    });
  }
  return lesson;
};

/** "Lesson 5: Title", in the app's language. */
export const formatAdultLesson = (lesson: AdultLesson, language: SupportedLanguage) => {
  switch (language) {
    case 'zh':
      return `第${lesson.number}課 ${lesson.title}`;
    case 'zh-cn':
      return `第${lesson.number}课 ${lesson.title}`;
    case 'es':
      return `Lección ${lesson.number}: ${lesson.title}`;
    default:
      return `Lesson ${lesson.number}: ${lesson.title}`;
  }
};
