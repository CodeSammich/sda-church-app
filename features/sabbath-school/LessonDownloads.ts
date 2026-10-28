import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  findChildrenLesson,
  isChildrenLessonPdf,
  type ChildrenSabbathSchoolCurriculum,
} from '@/features/sabbath-school/ChildrenLessons';
import { getCacheFolder, readCachedText, writeCachedText } from '@/services/CacheStore';
import { File } from 'expo-file-system';
import { getNetworkStateAsync } from 'expo-network';

/**
 * Children's lesson PDFs kept on the phone for the week (#529).
 *
 * The lessons are big (5–14 MB for the English student lessons, and 33 MB for
 * one Chinese lesson), and the English ones aren't built for fast web
 * view, so a viewer has to download the whole file before it shows page 1. A
 * tap used to show nothing for up to a minute or two. Now the app downloads the
 * PDF itself, with a progress bar, into the cache directory, which isn't backed
 * up and which the phone may clear. It then opens the copy in the phone's own
 * viewer. Opening it again that week needs no download, and no catalog lookup
 * either, so it works offline too.
 *
 * A lesson downloads only when someone taps it, so people who don't use
 * Sabbath School never download one.
 *
 * Phones only: the web opens the PDF in the browser, as before. See
 * docs/feature_designs/sabbath_school_lessons.md.
 */

const FOLDER = 'children-lessons';
const INDEX = { folder: FOLDER, name: 'index.json', key: 'childrenLessonsIndex' } as const;
const PDF_TYPE = 'application/pdf';
const PROGRESS_INTERVAL_MS = 100;

export type ChildrenLesson = Readonly<{
  curriculum: ChildrenSabbathSchoolCurriculum;
  language: SupportedLanguage;
}>;

/** `totalBytes` is -1 until the server says how big the file is. */
export type LessonDownloadProgress = Readonly<{ bytesWritten: number; totalBytes: number }>;

type SavedLesson = ChildrenLesson & {
  url: string;
  /** The first and last days it's the lesson for, as YYYY-MM-DD. */
  from: string;
  until: string;
};

type LessonIndex = {
  /** Each lesson PDF found, with the days it's the lesson for. */
  lessons: SavedLesson[];
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * The days a lesson found for `date` is the lesson for: the catalog's dates
 * where it gives them (a quarterly lesson runs Sabbath to Friday, an Alive in
 * Jesus week Sunday to Sabbath). A lesson picked by its number has none, so
 * then it's only the days both kinds of week containing `date` share: the
 * Sabbath alone, or Sunday to Friday.
 */
export const lessonDaysOf = (date: Date, startsOn?: Date, endsOn?: Date) => {
  if (startsOn && endsOn) return { from: dateKey(startsOn), until: dateKey(endsOn) };
  const day = startOfDay(date);
  if (day.getDay() === 6) return { from: dateKey(day), until: dateKey(day) };
  const sunday = new Date(day.getFullYear(), day.getMonth(), day.getDate() - day.getDay());
  const friday = new Date(sunday.getFullYear(), sunday.getMonth(), sunday.getDate() + 5);
  return { from: dateKey(sunday), until: dateKey(friday) };
};

// FNV-1a, so each address gets its own file.
const hashOf = (text: string) => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index++) {
    hash = Math.imul(hash ^ text.charCodeAt(index), 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
};

/**
 * A copy's file name: the age group and guide, which the phone's viewer shows
 * as its title, and a hash of the PDF's address, whose own name is a hash.
 */
export const lessonFileName = (curriculum: ChildrenSabbathSchoolCurriculum, url: string) =>
  `${curriculum}-${hashOf(url)}.pdf`;

const lessonFile = (curriculum: ChildrenSabbathSchoolCurriculum, url: string) =>
  new File(getCacheFolder(FOLDER), lessonFileName(curriculum, url));

const readIndex = async (): Promise<LessonIndex> => {
  try {
    const saved = JSON.parse((await readCachedText(INDEX)) ?? '{}');
    return { lessons: Array.isArray(saved.lessons) ? saved.lessons : [] };
  } catch {
    return { lessons: [] };
  }
};

let indexChanges: Promise<boolean> = Promise.resolve(true);

// One change at a time, so two taps, or a tap and a cleanup, don't undo each other's.
// Resolves to whether the change was saved.
const changeIndex = (change: (index: LessonIndex) => void) =>
  (indexChanges = indexChanges.then(async () => {
    try {
      const index = await readIndex();
      change(index);
      await writeCachedText(INDEX, JSON.stringify(index));
      return true;
    } catch {
      return false;
    }
  }));

const isSameLesson = (saved: ChildrenLesson, lesson: ChildrenLesson) =>
  saved.curriculum === lesson.curriculum && saved.language === lesson.language;

/**
 * The lesson PDF for a date: a saved one whose days include it, without using
 * the network, or else a new lookup, saved with its days. When there's no PDF yet,
 * findChildrenLesson gives the age group's website, which isn't saved, so the
 * next tap looks again.
 */
const findLesson = async (
  lesson: ChildrenLesson,
  date: Date,
): Promise<{ pdf: string } | { website: string }> => {
  const day = dateKey(date);
  const known = (await readIndex()).lessons.find(
    (saved) => isSameLesson(saved, lesson) && saved.from <= day && day <= saved.until,
  );
  if (known && isChildrenLessonPdf(known.url)) return { pdf: known.url };
  const { url, startsOn, endsOn } = await findChildrenLesson(lesson.curriculum, lesson.language, date);
  if (!isChildrenLessonPdf(url)) return { website: url };
  await changeIndex((index) => {
    index.lessons.push({ ...lesson, url, ...lessonDaysOf(date, startsOn, endsOn) });
  });
  return { pdf: url };
};

type Download = Readonly<{
  promise: Promise<File>;
  listeners: Set<(progress: LessonDownloadProgress) => void>;
  controller: AbortController;
}>;

// Downloads under way, by address, so two requests for the same lesson share one.
const downloads = new Map<string, Download>();

const startDownload = (
  url: string,
  file: File,
  listeners: Set<(progress: LessonDownloadProgress) => void>,
): Download => {
  const controller = new AbortController();
  let reportedAt = 0;
  const promise = (async () => {
    const folder = getCacheFolder(FOLDER);
    folder.create({ intermediates: true, idempotent: true });
    // Into a separate file first: on Android, a download that fails part way
    // leaves what it got. Each download has its own, so one that's stopping
    // doesn't write into the next.
    const partial = new File(folder, `${file.name}.${Date.now()}.part`);
    await File.downloadFileAsync(url, partial, {
      idempotent: true,
      signal: controller.signal,
      onProgress: (progress) => {
        const now = Date.now();
        if (now - reportedAt < PROGRESS_INTERVAL_MS) return;
        reportedAt = now;
        listeners.forEach((listener) => listener(progress));
      },
    });
    partial.rename(file.name);
    return new File(folder, file.name);
  })().finally(() => {
    if (downloads.get(url)?.controller === controller) downloads.delete(url);
  });
  return { promise, listeners, controller };
};

/**
 * The phone's copy of a lesson PDF, downloaded first unless it's there. Aborting
 * `signal` stops the download, even one another request shares.
 */
const downloadLesson = (
  { curriculum }: ChildrenLesson,
  url: string,
  onProgress?: (progress: LessonDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<File> => {
  const file = lessonFile(curriculum, url);
  if (file.exists) return Promise.resolve(file);
  onProgress?.({ bytesWritten: 0, totalBytes: -1 });
  let download = downloads.get(url);
  // Not one that's stopping, as when the popup's X is followed by another tap.
  if (download && !download.controller.signal.aborted) {
    if (onProgress) download.listeners.add(onProgress);
  } else {
    download = startDownload(url, file, new Set(onProgress ? [onProgress] : []));
    downloads.set(url, download);
  }
  const { controller, listeners, promise } = download;
  const stop = () => controller.abort();
  if (signal?.aborted) stop();
  signal?.addEventListener('abort', stop);
  return promise.finally(() => {
    if (onProgress) listeners.delete(onProgress);
    signal?.removeEventListener('abort', stop);
  });
};

/**
 * Forgets the lessons whose last day is before `today`, and deletes the copies
 * no remaining lesson names. So, with the catalog's dates, a quarterly lesson
 * goes from the next Sabbath, and an Alive in Jesus lesson from the Sunday
 * after its Sabbath, the first time the app checks.
 */
export const pruneChildrenLessons = async (today = new Date()) => {
  const folder = getCacheFolder(FOLDER);
  // Nothing to do on a phone that never opened a lesson.
  if (!folder.exists) return;
  const day = dateKey(today);
  const kept = new Set<string>([INDEX.name]);
  const saved = await changeIndex((index) => {
    index.lessons = index.lessons.filter((lesson) => lesson.until >= day);
    index.lessons.forEach((lesson) => kept.add(lessonFileName(lesson.curriculum, lesson.url)));
  });
  // Unless the change was saved, `kept` may be missing some.
  if (!saved) return;
  for (const entry of folder.list()) {
    if (!(entry instanceof File) || kept.has(entry.name)) continue;
    // A download under way writes a .part file.
    if (entry.name.endsWith('.part') && downloads.size) continue;
    entry.delete();
  }
};

export type ChildrenLessonToOpen = Readonly<
  { file: File; url: string } | { url: string } | { offline: true }
>;

const OFFLINE = { offline: true } as const;

// Asked only after a lookup finds no PDF or a download fails, so a network that
// wrongly reports no internet can't stop one that would have worked.
const isOffline = async () => {
  try {
    const network = await getNetworkStateAsync();
    return network.isConnected === false || network.isInternetReachable === false;
  } catch {
    return false;
  }
};

/**
 * This week's lesson for an age group: the phone's copy, downloaded first if
 * needed, or else an address to open in the browser. That's the age group's
 * website when there's no PDF yet, or the PDF when it couldn't be downloaded.
 * When the phone is offline and has no copy, it says so instead, since neither
 * page would load. Rejects only when `signal` is aborted.
 */
export const getChildrenLesson = async (
  lesson: ChildrenLesson,
  {
    date = new Date(),
    onProgress,
    signal,
  }: {
    date?: Date;
    onProgress?: (progress: LessonDownloadProgress) => void;
    signal?: AbortSignal;
  } = {},
): Promise<ChildrenLessonToOpen> => {
  const found = await findLesson(lesson, date);
  if ('website' in found) return (await isOffline()) ? OFFLINE : { url: found.website };
  try {
    const file = await downloadLesson(lesson, found.pdf, onProgress, signal);
    void pruneChildrenLessons(date);
    return { file, url: found.pdf };
  } catch (error) {
    if (signal?.aborted) throw error;
    return (await isOffline()) ? OFFLINE : { url: found.pdf };
  }
};

/**
 * Opens a lesson's copy in the phone's own viewer: Quick Look on iPhone, and on
 * Android the app that opens PDFs. Resolves to false when there's none.
 */
export const previewChildrenLesson = async (file: File, title: string) => {
  if (!(await file.canPreview({ mimeType: PDF_TYPE }))) return false;
  await file.preview({ mimeType: PDF_TYPE, title });
  return true;
};
