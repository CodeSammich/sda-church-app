import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import { excludeFromBackup } from '@/modules/backup-exclusion';
import {
  BIBLE_AUDIO_BOOKS,
  getAudioPowerCuvChapterLinks,
  getBibleAudioNarrator,
  getCantoneseCuvChapterUrl,
  getRv1909ChapterLinks,
} from '@/services/BibleAudioSources';
import { downloadFile, isPhoneOffline } from '@/services/FileDownloads';
import { Directory, File, Paths } from 'expo-file-system';
import {
  addNetworkStateListener,
  getNetworkStateAsync,
  NetworkStateType,
  type NetworkState,
} from 'expo-network';
import { AppState, Platform } from 'react-native';

/**
 * Bible audio kept on the phone for listening offline (#556): a book, the New
 * Testament, or the whole Bible, for one narrator, downloaded only when the
 * member taps it. Playback tries the phone's copy first (see
 * buildBibleAudioQueue's `getDownloadedUri`).
 *
 * The files are in `bible-audio/<narrator>/<book>/<chapter>.mp3` in the
 * documents directory, which the phone doesn't clear when space runs low, as
 * Spotify's and YouTube's downloads aren't, and they stay until the member
 * deletes them. They're kept out of the phone's backups: on iPhone with
 * modules/backup-exclusion, and on Android with the backup rules in
 * plugins/withAndroidBackupRules.js. Phones only: the web streams.
 *
 * Each chapter is its own file, so a download stopped part way, by the X, a
 * lost connection, or the app being closed, keeps the chapters it finished.
 * See docs/feature_designs/on_device_storage.md.
 */

export type BibleAudioDownloadScope =
  | Readonly<{ kind: 'book'; bookId: string }>
  | Readonly<{ kind: 'new-testament' }>
  | Readonly<{ kind: 'bible' }>;

const SIZES: Readonly<Record<string, Readonly<Record<string, number>>>> = BIBLE_AUDIO_DOWNLOAD_SIZES;
const CHAPTERS = new Map(BIBLE_AUDIO_BOOKS);
const NEW_TESTAMENT = BIBLE_AUDIO_BOOKS.findIndex(([bookId]) => bookId === 'MAT');
const HELLOAO_AUDIO = 'https://audio.bible.helloao.org/api/BSB';

const FOLDER = 'bible-audio';
const CONCURRENT_DOWNLOADS = 3;
// A chapter whose every copy fails is tried this many times in all.
const ATTEMPTS = 3;
// After this many chapters in a row fail, the host is likely down: stop, and
// leave the rest for a tap later, rather than ask for every chapter.
const FAILURES_TO_STOP = 6;
const PROGRESS_EMIT_MS = 250;
// What a download must leave free, so it never fills the phone.
const SPACE_TO_LEAVE = 500_000_000;

/** The narrators a member can download, in the order the You tab lists them. */
export const BIBLE_AUDIO_DOWNLOAD_NARRATORS = Object.keys(SIZES);

/** The narrator a reader choice plays, by its download name, if it can be downloaded here. */
export const getDownloadableBibleAudioNarrator = (translationId: string, reader?: string) => {
  if (Platform.OS === 'web' || !reader) return null;
  const narrator = getBibleAudioNarrator(translationId, reader);
  return narrator && narrator in SIZES ? narrator : null;
};

const scopeKey = (scope: BibleAudioDownloadScope) => (scope.kind === 'book' ? `book:${scope.bookId}` : scope.kind);

// Whether downloading `request` downloads all of `scope` too.
const covers = (request: string, scope: BibleAudioDownloadScope) =>
  request === 'bible' ||
  request === scopeKey(scope) ||
  (request === 'new-testament' && scope.kind === 'book' && getBibleAudioScopeBooks({ kind: 'new-testament' }).includes(scope.bookId));

/** The books a scope covers, in canonical order. */
export const getBibleAudioScopeBooks = (scope: BibleAudioDownloadScope): string[] => {
  if (scope.kind === 'book') return CHAPTERS.has(scope.bookId) ? [scope.bookId] : [];
  return BIBLE_AUDIO_BOOKS.slice(scope.kind === 'bible' ? 0 : NEW_TESTAMENT).map(([bookId]) => bookId);
};

/**
 * Where a narrator's chapter downloads from, in the order tried: the church's
 * copy, then for Mandarin its two mirrors, which are the same file. The
 * WordProject recordings (Cantonese and Spanish) come only from the church's
 * copies, as for streaming (see docs/LEGAL.md). The English ones come from
 * HelloAO, whose terms say "Cache, store and download without expiry".
 */
export const getBibleAudioDownloadUrls = (narrator: string, bookId: string, chapter: number): string[] => {
  const chapters = CHAPTERS.get(bookId);
  if (!chapters || !Number.isInteger(chapter) || chapter < 1 || chapter > chapters) return [];
  const list = (source?: string | string[] | null) => (source ? [source].flat() : []);
  switch (narrator) {
    case 'cuv-mandarin':
      return list(Object.values(getAudioPowerCuvChapterLinks(bookId, chapter))[0]);
    case 'cuv-cantonese':
      return list(getCantoneseCuvChapterUrl(bookId, chapter));
    case 'rv1909':
      return list(Object.values(getRv1909ChapterLinks(bookId, chapter))[0]);
    default:
      return narrator in SIZES ? [`${HELLOAO_AUDIO}/${bookId}/${chapter}/audio/${narrator}.mp3`] : [];
  }
};

const rootFolder = () => new Directory(Paths.document, FOLDER);
const bookFolder = (narrator: string, bookId: string) => new Directory(rootFolder(), narrator, bookId);
const chapterFileName = (chapter: number) => `${chapter}.mp3`;

// The chapters on the phone: narrator, then book, then each chapter's size in bytes.
const downloaded = new Map<string, Map<string, Map<number, number>>>();
let loaded = false;

const record = (narrator: string, bookId: string, chapter: number, bytes: number) => {
  let books = downloaded.get(narrator);
  if (!books) downloaded.set(narrator, (books = new Map()));
  let chapters = books.get(bookId);
  if (!chapters) books.set(bookId, (chapters = new Map()));
  chapters.set(chapter, bytes);
};

type Queued = Readonly<{
  narrator: string;
  bookId: string;
  chapter: number;
  /** Whether the member agreed to download it over mobile data. */
  mobileData: boolean;
  attempts: number;
}>;

const keyOf = ({ narrator, bookId, chapter }: Pick<Queued, 'narrator' | 'bookId' | 'chapter'>) =>
  `${narrator}/${bookId}/${chapter}`;

// Chapters waiting to download, in order, and those downloading now.
const queued = new Map<string, Queued>();
const running = new Map<string, { item: Queued; bytesWritten: number; controller: AbortController }>();
// The scopes members asked for, by narrator, while any is downloading: a row
// shows a download only when it, or a scope that holds it, was asked for. So
// John downloading doesn't make the New Testament look as if it is.
const requested = new Map<string, Set<string>>();
let network: NetworkState | null = null;
// Set when downloads failed because the phone lost its connection or left the
// app; they go on when it's back.
let waitingForConnection = false;
let failuresInARow = 0;

const listeners = new Set<() => void>();
let version = 0;
let progressTimer: ReturnType<typeof setTimeout> | null = null;

const emit = () => {
  if (progressTimer) clearTimeout(progressTimer);
  progressTimer = null;
  version += 1;
  listeners.forEach((listener) => listener());
};

// Progress arrives several times a second for each chapter: tell screens less often.
const emitProgress = () => {
  progressTimer ??= setTimeout(emit, PROGRESS_EMIT_MS);
};

/** For useSyncExternalStore: calls `listener` whenever what's downloaded, or downloading, changes. */
export const subscribeBibleAudioDownloads = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Changes whenever anything subscribeBibleAudioDownloads reports does. */
export const getBibleAudioDownloadsVersion = () => version;

/**
 * Finds the chapters already on the phone. It runs once, the first time
 * anything asks; the Bible screen and the You tab ask when they open.
 */
export const loadBibleAudioDownloads = () => {
  if (loaded || Platform.OS === 'web') return;
  loaded = true;
  try {
    const root = rootFolder();
    if (!root.exists) return;
    for (const narrator of root.list()) {
      if (!(narrator instanceof Directory)) continue;
      for (const book of narrator.list()) {
        if (!(book instanceof Directory)) continue;
        for (const entry of book.list()) {
          if (!(entry instanceof File)) continue;
          const chapter = /^(\d+)\.mp3$/.exec(entry.name)?.[1];
          if (chapter) record(narrator.name, book.name, Number(chapter), entry.size);
          // Nothing downloads before this, so it's one a closed app left.
          else if (entry.name.endsWith('.part')) entry.delete();
        }
      }
    }
  } catch (error) {
    console.warn('Could not read the downloaded Bible audio:', error);
  }
  emit();
};

/** The phone's copy of a chapter, or null when there isn't one. */
export const getDownloadedChapterUri = (narrator: string | null, bookId: string, chapter: number) =>
  narrator && downloaded.get(narrator)?.get(bookId)?.has(chapter)
    ? new File(bookFolder(narrator, bookId), chapterFileName(chapter)).uri
    : null;

/**
 * The phone's copies of a narrator's chapters as they are now. The Android
 * queue behind the lock screen keeps the chapters it's given, and stops
 * adding more if one it holds changes (services/BibleAudioNativeQueue.ts), so
 * a playback session asks this once, when it starts, rather than seeing each
 * chapter as it downloads. The reader's own chapter always plays the phone's
 * copy once it's there.
 */
export const snapshotDownloadedChapters = (narrator: string | null) => {
  const chapters = new Set<string>();
  (narrator ? downloaded.get(narrator) : undefined)?.forEach((onPhone, bookId) =>
    onPhone.forEach((_, chapter) => chapters.add(`${bookId} ${chapter}`)),
  );
  return (bookId: string, chapter: number) =>
    chapters.has(`${bookId} ${chapter}`) ? getDownloadedChapterUri(narrator, bookId, chapter) : null;
};

const isOnMobileData = () => network?.type === NetworkStateType.CELLULAR;

export type BibleAudioScopeStatus = Readonly<{
  chapters: number;
  downloadedChapters: number;
  /** What's on the phone, and what's arrived of the chapters downloading now. */
  downloadedBytes: number;
  /** The whole scope's size, from constants/BibleAudioDownloadSizes.json. */
  totalBytes: number;
  /**
   * Whether it, or a scope that holds it, was asked for, and any of its
   * chapters are downloading or waiting to.
   */
  downloading: boolean;
  /** Why it isn't downloading now, while it waits. */
  waitingFor: 'connection' | 'wifi' | null;
}>;

/** How much of a scope is on the phone, and whether it's downloading. */
export const getBibleAudioScopeStatus = (
  narrator: string,
  scope: BibleAudioDownloadScope,
): BibleAudioScopeStatus => {
  const books = getBibleAudioScopeBooks(scope);
  const inScope = new Set(books);
  let chapters = 0;
  let downloadedChapters = 0;
  let downloadedBytes = 0;
  let totalBytes = 0;
  for (const bookId of books) {
    chapters += CHAPTERS.get(bookId) ?? 0;
    totalBytes += SIZES[narrator]?.[bookId] ?? 0;
    const onPhone = downloaded.get(narrator)?.get(bookId);
    downloadedChapters += onPhone?.size ?? 0;
    onPhone?.forEach((bytes) => (downloadedBytes += bytes));
  }
  let active = false;
  for (const { item, bytesWritten } of running.values()) {
    if (item.narrator !== narrator || !inScope.has(item.bookId)) continue;
    active = true;
    downloadedBytes += bytesWritten;
  }
  let waiting = false;
  let mobileData = false;
  for (const item of queued.values()) {
    if (item.narrator !== narrator || !inScope.has(item.bookId)) continue;
    waiting = true;
    mobileData ||= item.mobileData;
  }
  const asked = [...(requested.get(narrator) ?? [])].some((request) => covers(request, scope));
  const downloading = asked && (active || waiting);
  return {
    chapters,
    downloadedChapters,
    downloadedBytes,
    totalBytes,
    downloading,
    waitingFor: !downloading || active
      ? null
      : waitingForConnection
        ? 'connection'
        : isOnMobileData() && !mobileData
          ? 'wifi'
          : null,
  };
};

/** Whether the phone has room for `bytes` more, leaving some space free. */
export const hasRoomForBibleAudio = (bytes: number) => {
  try {
    return Paths.availableDiskSpace - bytes >= SPACE_TO_LEAVE;
  } catch {
    return true;
  }
};

let subscriptions: { remove(): void }[] = [];

const isConnected = (state: NetworkState) =>
  state.isConnected !== false && state.isInternetReachable !== false;

// Watches the connection while anything is downloading: to go on when it comes
// back, and to wait for Wi-Fi when a download the member didn't allow on
// mobile data would use it.
const watchConnection = () => {
  if (subscriptions.length) return;
  const update = (state: NetworkState) => {
    network = state;
    if (isConnected(state)) waitingForConnection = false;
    emit();
    pump();
  };
  subscriptions = [
    addNetworkStateListener(update),
    // On iPhone, downloads stop while the app is in the background.
    AppState.addEventListener('change', (state) => {
      if (state === 'active' && waitingForConnection) getNetworkStateAsync().then(update, () => undefined);
    }),
  ];
  getNetworkStateAsync().then(update, () => update({ isConnected: true, isInternetReachable: true }));
};

const stopWatching = () => {
  subscriptions.forEach((subscription) => subscription.remove());
  subscriptions = [];
  requested.clear();
  network = null;
  waitingForConnection = false;
};

const nextToDownload = () => {
  for (const item of queued.values()) {
    if (item.mobileData || !isOnMobileData()) return item;
  }
  return null;
};

const pump = () => {
  // Until the connection's known, so nothing starts on mobile data unasked.
  while (network && !waitingForConnection && running.size < CONCURRENT_DOWNLOADS) {
    const next = nextToDownload();
    if (!next) break;
    queued.delete(keyOf(next));
    void downloadChapter(next);
  }
  if (!queued.size && !running.size) stopWatching();
};

const downloadChapter = async (item: Queued) => {
  const key = keyOf(item);
  const controller = new AbortController();
  const entry = { item, bytesWritten: 0, controller };
  running.set(key, entry);
  emit();
  try {
    for (const url of getBibleAudioDownloadUrls(item.narrator, item.bookId, item.chapter)) {
      try {
        const file = await downloadFile(url, bookFolder(item.narrator, item.bookId), chapterFileName(item.chapter), {
          signal: controller.signal,
          onProgress: ({ bytesWritten }) => {
            entry.bytesWritten = bytesWritten;
            emitProgress();
          },
        });
        if (Platform.OS === 'ios') excludeFromBackup(file.uri);
        record(item.narrator, item.bookId, item.chapter, file.size);
        failuresInARow = 0;
        return;
      } catch {
        if (controller.signal.aborted) return;
        entry.bytesWritten = 0;
      }
    }
    // Every copy failed.
    if (AppState.currentState !== 'active' || (await isPhoneOffline())) {
      queued.set(key, item);
      waitingForConnection = true;
    } else if ((failuresInARow += 1) >= FAILURES_TO_STOP) {
      queued.clear();
    } else if (item.attempts + 1 < ATTEMPTS) {
      queued.set(key, { ...item, attempts: item.attempts + 1 });
    }
  } finally {
    running.delete(key);
    emit();
    pump();
  }
};

/**
 * Downloads a scope's chapters that aren't on the phone yet. Chapters already
 * downloading carry on. On mobile data, only what the member agreed to
 * download over it starts; the rest waits for Wi-Fi.
 *
 * Throws if the iPhone can't keep the files out of its backup.
 */
export const downloadBibleAudio = (
  narrator: string,
  scope: BibleAudioDownloadScope,
  { mobileData = false }: { mobileData?: boolean } = {},
) => {
  loadBibleAudioDownloads();
  const root = rootFolder();
  root.create({ intermediates: true, idempotent: true });
  if (Platform.OS === 'ios' && !excludeFromBackup(root.uri)) {
    throw new Error('Could not keep downloaded Bible audio out of the backup');
  }
  failuresInARow = 0;
  let asked = requested.get(narrator);
  if (!asked) requested.set(narrator, (asked = new Set()));
  asked.add(scopeKey(scope));
  for (const bookId of getBibleAudioScopeBooks(scope)) {
    const onPhone = downloaded.get(narrator)?.get(bookId);
    for (let chapter = 1; chapter <= (CHAPTERS.get(bookId) ?? 0); chapter += 1) {
      const key = keyOf({ narrator, bookId, chapter });
      if (onPhone?.has(chapter) || running.has(key)) continue;
      const waiting = queued.get(key);
      if (waiting) {
        if (mobileData) queued.set(key, { ...waiting, mobileData });
      } else {
        queued.set(key, { narrator, bookId, chapter, mobileData, attempts: 0 });
      }
    }
  }
  watchConnection();
  emit();
  pump();
};

/** Stops a scope's chapters downloading. The ones already on the phone stay. */
export const stopBibleAudioDownload = (narrator: string, scope: BibleAudioDownloadScope) => {
  const books = new Set(getBibleAudioScopeBooks(scope));
  for (const [key, item] of queued) {
    if (item.narrator === narrator && books.has(item.bookId)) queued.delete(key);
  }
  for (const { item, controller } of running.values()) {
    if (item.narrator === narrator && books.has(item.bookId)) controller.abort();
  }
  const asked = requested.get(narrator);
  asked?.forEach((request) => {
    const requestScope: BibleAudioDownloadScope =
      request === 'bible' || request === 'new-testament'
        ? { kind: request }
        : { kind: 'book', bookId: request.slice('book:'.length) };
    if (covers(scopeKey(scope), requestScope)) asked.delete(request);
  });
  emit();
  pump();
};

/** Deletes a book's downloaded chapters, and stops any still downloading. */
export const deleteBibleAudioBook = (narrator: string, bookId: string) => {
  stopBibleAudioDownload(narrator, { kind: 'book', bookId });
  const folder = bookFolder(narrator, bookId);
  if (folder.exists) folder.delete();
  downloaded.get(narrator)?.delete(bookId);
  emit();
};

export type DownloadedBibleAudio = Readonly<{
  narrator: string;
  bytes: number;
  books: readonly Readonly<{ bookId: string; chapters: number; downloadedChapters: number; bytes: number }>[];
}>;

/** What's on the phone, by narrator, with each book in canonical order. */
export const listDownloadedBibleAudio = (): DownloadedBibleAudio[] =>
  BIBLE_AUDIO_DOWNLOAD_NARRATORS.flatMap((narrator) => {
    const onPhone = downloaded.get(narrator);
    const books = BIBLE_AUDIO_BOOKS.flatMap(([bookId, chapters]) => {
      const chaptersOnPhone = onPhone?.get(bookId);
      if (!chaptersOnPhone?.size) return [];
      let bytes = 0;
      chaptersOnPhone.forEach((size) => (bytes += size));
      return [{ bookId, chapters, downloadedChapters: chaptersOnPhone.size, bytes }];
    });
    return books.length
      ? [{ narrator, books, bytes: books.reduce((total, book) => total + book.bytes, 0) }]
      : [];
  });

/** Forgets everything, for tests. */
export const resetBibleAudioDownloadsForTests = () => {
  queued.clear();
  running.forEach(({ controller }) => controller.abort());
  running.clear();
  downloaded.clear();
  loaded = false;
  failuresInARow = 0;
  stopWatching();
};
