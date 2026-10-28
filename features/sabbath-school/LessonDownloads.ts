import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  findChildrenLessonUrl,
  isChildrenLessonPdf,
  type ChildrenSabbathSchoolCurriculum,
} from '@/features/sabbath-school/ChildrenLessons';
import { getCacheFolder, readCachedText, writeCachedText } from '@/services/CacheStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
 * either.
 *
 * On Wi-Fi, the app also fetches the coming Sabbath's lesson for the two
 * lessons (age group and guide) opened most recently, so they open at once on
 * Sabbath.
 *
 * Phones only: the web opens the PDF in the browser, as before. See
 * docs/feature_designs/sabbath_school_lessons.md.
 */

const FOLDER = 'children-lessons';
const INDEX = { folder: FOLDER, name: 'index.json', key: 'childrenLessonsIndex' } as const;
// The lessons opened most recently are the person's own choice, not a copy the
// app can download again, so they're kept with the settings, which a full
// phone's cache clearing doesn't touch.
const RECENT_KEY = 'children-lessons-recent-v1';
const PDF_TYPE = 'application/pdf';
// Lookups, and the copies they name, are kept this long after their period begins.
const KEEP_DAYS = 7;
const RECENT_LESSONS = 2;
const PROGRESS_INTERVAL_MS = 100;

export type ChildrenLesson = Readonly<{
  curriculum: ChildrenSabbathSchoolCurriculum;
  language: SupportedLanguage;
}>;

/** `totalBytes` is -1 until the server says how big the file is. */
export type LessonDownloadProgress = Readonly<{ bytesWritten: number; totalBytes: number }>;

type LessonIndex = {
  /** Each lesson PDF found, by period, age group, and app language. */
  lookups: Record<string, string>;
};

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/**
 * The lesson for a date changes only when a Sabbath or a Sunday begins:
 * quarterly lessons start on Sabbath, and Alive in Jesus weeks on Sunday. So a
 * lookup holds from one of those days until the next, and this names that period
 * by its first day.
 */
export const lessonPeriodOf = (date: Date) => {
  const day = startOfDay(date);
  if (day.getDay() !== 6) day.setDate(day.getDate() - day.getDay());
  return dateKey(day);
};

/** The Sabbath on or after a date. */
export const comingSabbathOf = (date: Date) => {
  const day = startOfDay(date);
  day.setDate(day.getDate() + 6 - day.getDay());
  return day;
};

const lookupKey = (period: string, { curriculum, language }: ChildrenLesson) =>
  `${period}|${curriculum}|${language}`;

const curriculumOf = (key: string) => key.split('|')[1] as ChildrenSabbathSchoolCurriculum;

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
    return { lookups: saved.lookups && typeof saved.lookups === 'object' ? saved.lookups : {} };
  } catch {
    return { lookups: {} };
  }
};

let indexChanges: Promise<boolean> = Promise.resolve(true);

// One change at a time, so a tap and a Wi-Fi fetch don't undo each other's.
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

const readRecentLessons = async (): Promise<ChildrenLesson[]> => {
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(RECENT_KEY)) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
};

const rememberLesson = async (lesson: ChildrenLesson) => {
  try {
    const others = (await readRecentLessons()).filter(
      (each) => each.curriculum !== lesson.curriculum || each.language !== lesson.language,
    );
    await AsyncStorage.setItem(RECENT_KEY, JSON.stringify([lesson, ...others].slice(0, RECENT_LESSONS)));
  } catch {
    // Only the Wi-Fi fetch ahead uses it.
  }
};

/**
 * The lesson PDF for a date, from this period's earlier lookup where there was
 * one. When there's no PDF yet, findChildrenLessonUrl gives the age group's
 * website, which isn't kept, so the next tap looks again.
 */
const findLesson = async (
  lesson: ChildrenLesson,
  date: Date,
): Promise<{ pdf: string } | { website: string }> => {
  const key = lookupKey(lessonPeriodOf(date), lesson);
  const known = (await readIndex()).lookups[key];
  if (known && isChildrenLessonPdf(known)) return { pdf: known };
  const url = await findChildrenLessonUrl(lesson.curriculum, lesson.language, date);
  if (!isChildrenLessonPdf(url)) return { website: url };
  await changeIndex((index) => {
    index.lookups[key] = url;
  });
  return { pdf: url };
};

type Download = Readonly<{
  promise: Promise<File>;
  listeners: Set<(progress: LessonDownloadProgress) => void>;
  controller: AbortController;
}>;

// Downloads under way, by address, so a tap during a Wi-Fi fetch shares it.
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
 * `signal` stops the download, even one a Wi-Fi fetch began.
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
 * Forgets the lookups whose period began more than a week before `today`, and
 * deletes the copies no remaining lookup names.
 */
export const pruneChildrenLessons = async (today = new Date()) => {
  const oldest = startOfDay(today);
  oldest.setDate(oldest.getDate() - KEEP_DAYS);
  const kept = new Set<string>([INDEX.name]);
  const saved = await changeIndex((index) => {
    index.lookups = Object.fromEntries(
      Object.entries(index.lookups).filter(([key]) => key.split('|')[0] >= dateKey(oldest)),
    );
    Object.entries(index.lookups).forEach(([key, url]) => kept.add(lessonFileName(curriculumOf(key), url)));
  });
  const folder = getCacheFolder(FOLDER);
  // Unless the lookups were saved, `kept` may be missing some.
  if (!saved || !folder.exists) return;
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

// Asked only after a lookup or a download fails, so a network that wrongly
// reports no internet can't stop one that would have worked.
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
  void rememberLesson(lesson);
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

let fetchingAhead = false;

/**
 * Fetches the coming Sabbath's lesson for the age groups opened most recently,
 * so they open at once on Sabbath. Quarterly lessons change on Sabbath, so on a
 * weekday that's the next lesson, not this week's. It looks up this period's
 * lesson too, usually the copy already on the phone, so that opens offline
 * later in the week. The caller checks for Wi-Fi.
 */
export const fetchChildrenLessonsAhead = async (date = new Date()) => {
  if (fetchingAhead) return;
  fetchingAhead = true;
  try {
    const dates = [date, comingSabbathOf(date)].filter(
      (each, index, all) => all.findIndex((other) => lessonPeriodOf(other) === lessonPeriodOf(each)) === index,
    );
    for (const lesson of await readRecentLessons()) {
      for (const each of dates) {
        try {
          const found = await findLesson(lesson, each);
          if ('pdf' in found) await downloadLesson(lesson, found.pdf);
        } catch {
          // Offline, or the download failed: the next time the app opens tries again.
        }
      }
    }
    await pruneChildrenLessons(date);
  } finally {
    fetchingAhead = false;
  }
};
