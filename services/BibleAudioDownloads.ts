import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import { BIBLE_AUDIO_NARRATOR_ORDER, getBibleAudioNarratorName } from '@/constants/BibleAudioNarrators';
import { BIBLE_SECTIONS, type BibleTestament } from '@/constants/BibleSections';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { excludeFromBackup } from '@/modules/backup-exclusion';
import { getBibleAudioSystemDownloads, type SystemDownloadStatus } from '@/modules/bible-audio-downloads';
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
 * Bible audio kept on the phone for listening offline (#556): a book, a
 * section (constants/BibleSections.ts), a Testament, or the whole Bible, for
 * one narrator, downloaded only when the member taps it, in You → Offline
 * Bible Audio. Playback tries the phone's copy first (see
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
 *
 * On a phone, the phone's own downloader does the downloading (#611,
 * modules/bible-audio-downloads), so it goes on while the phone is locked or
 * the app is in the background, on Wi-Fi only unless the member allowed
 * mobile data. That's custom code, to replace with Expo's once it can keep a
 * background download on Wi-Fi only (#612). The in-app downloader below,
 * three chapters at a time, is for where there's no native module.
 */

export type BibleAudioDownloadScope =
  | Readonly<{ kind: 'book'; bookId: string }>
  | Readonly<{ kind: 'section'; sectionId: string }>
  | Readonly<{ kind: 'testament'; testament: BibleTestament }>
  | Readonly<{ kind: 'bible' }>;

const SIZES: Readonly<Record<string, Readonly<Record<string, number>>>> = BIBLE_AUDIO_DOWNLOAD_SIZES;
const CHAPTERS = new Map(BIBLE_AUDIO_BOOKS);
const HELLOAO_AUDIO = 'https://audio.bible.helloao.org/api/BSB';

const FOLDER = 'bible-audio';
// What was asked for, kept for the phone's downloader across app launches.
const REQUESTS_FILE = 'requests.json';
// How often the open app asks the phone's downloader how it's doing.
const POLL_MS = 1_000;
const CONCURRENT_DOWNLOADS = 3;
// A chapter whose every copy fails is tried this many times in all.
const ATTEMPTS = 3;
// After this many chapters in a row fail, the host is likely down: stop, and
// leave the rest for a tap later, rather than ask for every chapter.
const FAILURES_TO_STOP = 6;
const PROGRESS_EMIT_MS = 250;
// What a download must leave free, so it never fills the phone.
const SPACE_TO_LEAVE = 500_000_000;

/** The narrators a member can download, in the app's one narrator order. */
export const BIBLE_AUDIO_DOWNLOAD_NARRATORS = BIBLE_AUDIO_NARRATOR_ORDER.filter((narrator) => narrator in SIZES);

/** The narrator a reader choice plays, by its download name, if it can be downloaded here. */
export const getDownloadableBibleAudioNarrator = (translationId: string, reader?: string) => {
  if (Platform.OS === 'web' || !reader) return null;
  const narrator = getBibleAudioNarrator(translationId, reader);
  return narrator && narrator in SIZES ? narrator : null;
};

const scopeKey = (scope: BibleAudioDownloadScope) => {
  switch (scope.kind) {
    case 'book':
      return `book:${scope.bookId}`;
    case 'section':
      return `section:${scope.sectionId}`;
    case 'testament':
      return `testament:${scope.testament}`;
    default:
      return 'bible';
  }
};

/** The books a scope covers, in canonical order. */
export const getBibleAudioScopeBooks = (scope: BibleAudioDownloadScope): string[] => {
  switch (scope.kind) {
    case 'book':
      return CHAPTERS.has(scope.bookId) ? [scope.bookId] : [];
    case 'section':
      return [...(BIBLE_SECTIONS.find(({ id }) => id === scope.sectionId)?.books ?? [])];
    case 'testament':
      return BIBLE_SECTIONS.filter(({ testament }) => testament === scope.testament).flatMap(({ books }) => books);
    default:
      return BIBLE_AUDIO_BOOKS.map(([bookId]) => bookId);
  }
};

// Whether downloading `request` downloads all of `scope` too.
const covers = (request: BibleAudioDownloadScope, scope: BibleAudioDownloadScope) => {
  const held = new Set(getBibleAudioScopeBooks(request));
  const books = getBibleAudioScopeBooks(scope);
  return books.length > 0 && books.every((bookId) => held.has(bookId));
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
const running = new Map<string, { item: Queued; bytesWritten: number; controller?: AbortController }>();
// The scopes members asked for, by narrator and then key, while any is
// downloading: a row shows a download only when it, or a scope that holds it,
// was asked for. So John downloading doesn't make the Gospels look as if they are.
type Request = Readonly<{ scope: BibleAudioDownloadScope; mobileData: boolean }>;
const requested = new Map<string, Map<string, Request>>();
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
  if (systemDownloads()) void reconcileSystem();
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
  books: number;
  /** The books all on the phone. */
  downloadedBooks: number;
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
  /** Whether any of its chapters are arriving now, not only waiting their turn. */
  active: boolean;
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
  let downloadedBooks = 0;
  let downloadedChapters = 0;
  let downloadedBytes = 0;
  let totalBytes = 0;
  for (const bookId of books) {
    const bookChapters = CHAPTERS.get(bookId) ?? 0;
    chapters += bookChapters;
    totalBytes += SIZES[narrator]?.[bookId] ?? 0;
    const onPhone = downloaded.get(narrator)?.get(bookId);
    if (onPhone && onPhone.size >= bookChapters) downloadedBooks += 1;
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
  let heldOffWifi = false;
  for (const [key, item] of queued) {
    if (item.narrator !== narrator || !inScope.has(item.bookId)) continue;
    waiting = true;
    mobileData ||= item.mobileData;
    heldOffWifi ||= heldForWifi.has(key);
    downloadedBytes += heldBytes.get(key) ?? 0;
  }
  const asked = [...(requested.get(narrator)?.values() ?? [])].some((request) => covers(request.scope, scope));
  const downloading = asked && (active || waiting);
  return {
    books: books.length,
    downloadedBooks,
    chapters,
    downloadedChapters,
    downloadedBytes,
    totalBytes,
    downloading,
    active: downloading && active,
    waitingFor: !downloading || active
      ? null
      : waitingForConnection
        ? 'connection'
        : (isOnMobileData() && !mobileData) || heldOffWifi
          ? 'wifi'
          : null,
  };
};

/** Whether any of a narrator's chapters are downloading, or waiting to. */
export const isDownloadingBibleAudio = (narrator: string) =>
  [...running.values()].some(({ item }) => item.narrator === narrator) ||
  [...queued.values()].some((item) => item.narrator === narrator);

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
    // The phone's downloader waits for a connection by itself.
    if (systemDownloads()) waitingForConnection = !isConnected(state);
    else if (isConnected(state)) waitingForConnection = false;
    emit();
    pump();
  };
  subscriptions = [
    addNetworkStateListener(update),
    AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      // What the phone downloaded while the app was away.
      if (systemDownloads()) void refreshSystem();
      // On iPhone, the in-app downloader stops while the app is in the background.
      else if (waitingForConnection) getNetworkStateAsync().then(update, () => undefined);
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
  stopPolling();
  saveRequests();
};

const nextToDownload = () => {
  for (const item of queued.values()) {
    if (item.mobileData || !isOnMobileData()) return item;
  }
  return null;
};

const pump = () => {
  // The phone's downloader runs its own queue.
  if (systemDownloads()) return;
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
        // Stopped, or deleted, as it finished: a deleted book mustn't come back.
        if (controller.signal.aborted) {
          if (file.exists) file.delete();
          return;
        }
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

// ---- The phone's downloader (#611), on a phone. Custom until #612. ----

const systemDownloads = () => (Platform.OS === 'web' ? null : getBibleAudioSystemDownloads());

// Which try each chapter is on, through its sources in turn.
const tries = new Map<string, number>();
// Chapters on their way to the phone's downloader, which a list mustn't take
// for finished or failed.
const handingOver = new Set<string>();
// Chapters held for Wi-Fi: on Android, for unmetered Wi-Fi while the phone is
// on another network, as a hotspot, which is someone's data plan; on either,
// a Wi-Fi-only one while the phone is on mobile data.
const heldForWifi = new Set<string>();
// What's arrived of chapters waiting part way, as one held when Wi-Fi dropped.
const heldBytes = new Map<string, number>();
let polling: ReturnType<typeof setInterval> | null = null;
// Calls to the phone's downloader, one at a time, so a list never runs
// between an enqueue and the tasks it starts.
let systemCalls: Promise<unknown> = Promise.resolve();
const callSystem = <T>(call: () => Promise<T>): Promise<T> => {
  const next = systemCalls.then(call, call);
  systemCalls = next.catch((error) => console.warn('The phone’s Bible audio downloader failed:', error));
  return next;
};

const chapterFile = ({ narrator, bookId, chapter }: Pick<Queued, 'narrator' | 'bookId' | 'chapter'>) =>
  new File(bookFolder(narrator, bookId), chapterFileName(chapter));

// The language the phone's notifications name a download in (#610), as
// "English – Souer (BSB)": the app's, set from its root.
let notificationLanguage: SupportedLanguage = 'en';
export const setBibleAudioDownloadLanguage = (language: SupportedLanguage) => {
  notificationLanguage = language;
};

const handToSystem = (items: readonly Queued[], allowMobileData: boolean) => {
  const system = systemDownloads();
  if (!system || !items.length) return;
  const downloads = items.flatMap((item) => {
    const urls = getBibleAudioDownloadUrls(item.narrator, item.bookId, item.chapter);
    const id = keyOf(item);
    if (!urls.length) return [];
    // The next source first, then the rest in turn, for a phone that tries them all.
    const first = (tries.get(id) ?? 0) % urls.length;
    const inTurn = [...urls.slice(first), ...urls.slice(0, first)];
    return [
      {
        id,
        url: inTurn[0],
        fallbacks: inTurn.slice(1),
        path: chapterFile(item).uri,
        group: getBibleAudioNarratorName(item.narrator, notificationLanguage) ?? item.narrator,
        bytes: Math.round((SIZES[item.narrator]?.[item.bookId] ?? 0) / Math.max(1, CHAPTERS.get(item.bookId) ?? 1)),
      },
    ];
  });
  downloads.forEach(({ id }) => handingOver.add(id));
  void callSystem(() => system.enqueue(downloads, allowMobileData)).finally(() =>
    downloads.forEach(({ id }) => handingOver.delete(id)),
  );
  startPolling();
};

const startPolling = () => {
  if (polling) return;
  polling = setInterval(() => {
    if (AppState.currentState === 'active') void refreshSystem();
  }, POLL_MS);
};

const stopPolling = () => {
  if (polling) clearInterval(polling);
  polling = null;
};

const itemOf = (status: SystemDownloadStatus): Queued | null => {
  const [narrator, bookId, chapter] = status.id.split('/');
  return narrator && CHAPTERS.has(bookId) && Number(chapter) > 0
    ? { narrator, bookId, chapter: Number(chapter), mobileData: status.mobileData, attempts: 0 }
    : null;
};

// Once nothing's left, it stops watching, unless the app is just starting
// and hasn't yet handed over what's left of earlier requests.
const refreshSystem = ({ settle = true }: { settle?: boolean } = {}) =>
  callSystem(async () => {
    const system = systemDownloads();
    if (!system) return;
    applySystemStatuses(await system.list());
    if (settle && !queued.size && !running.size && !handingOver.size) stopWatching();
    emit();
  });

// What the phone reports: `queued` and `running` mirror it. A chapter gone from
// its list finished, with its file in place, or failed.
const applySystemStatuses = (statuses: readonly SystemDownloadStatus[]) => {
  const known = new Map<string, Queued>(queued);
  running.forEach(({ item }, key) => known.set(key, item));
  const live = new Set(statuses.map(({ id }) => id));
  queued.clear();
  running.clear();
  heldForWifi.clear();
  heldBytes.clear();
  const failed: Queued[] = [];
  const stoppedByPhone: string[] = [];
  for (const [key, item] of known) {
    if (live.has(key)) continue;
    if (handingOver.has(key)) {
      queued.set(key, item);
      continue;
    }
    const file = chapterFile(item);
    if (file.exists) {
      record(item.narrator, item.bookId, item.chapter, file.size);
      tries.delete(key);
      failuresInARow = 0;
    } else {
      failed.push(item);
    }
  }
  for (const status of statuses) {
    // Or one asked for before the app started.
    const item = known.get(status.id) ?? itemOf(status);
    if (!item) continue;
    const sources = getBibleAudioDownloadUrls(item.narrator, item.bookId, item.chapter).length;
    if (status.state === 'stopped') {
      stoppedByPhone.push(status.id);
      continue;
    }
    // Android retries a host that doesn't answer for minutes: try its mirror.
    if (status.state === 'failed' || (status.state === 'paused' && status.reason === 'retry' && sources > 1)) {
      failed.push(item);
    } else if (status.state === 'running' && (item.mobileData || !isOnMobileData())) {
      // From its start: Android has three under way at a time, and a short
      // chapter can start and finish between two looks, which would make the
      // row say it's only waiting.
      running.set(status.id, { item, bytesWritten: status.bytesWritten });
    } else {
      // iOS says a chapter that's received some of its bytes is running, even
      // while its Wi-Fi-only session holds it on mobile data.
      queued.set(status.id, item);
      if (status.bytesWritten > 0) heldBytes.set(status.id, status.bytesWritten);
      const pausedForWifi = status.state === 'paused' && (status.reason === 'network' || status.reason === 'wifi');
      if (!item.mobileData && (pausedForWifi || isOnMobileData())) heldForWifi.add(status.id);
    }
  }
  if (stoppedByPhone.length) stoppedFromNotification(stoppedByPhone);
  retryOnSystem(failed);
};

// Stop, on a download's notification (#610), stopped what the phone had: the
// member's stop, as the X's, so none of it is asked for again.
const stoppedFromNotification = (ids: readonly string[]) => {
  const narrators = new Set(ids.map((id) => id.split('/')[0]));
  for (const narrator of narrators) requested.delete(narrator);
  ids.forEach((id) => tries.delete(id));
  const system = systemDownloads();
  if (system) void callSystem(() => system.cancel([...ids]));
  saveRequests();
};

// The next source for each failed chapter, up to ATTEMPTS times round them all.
// After FAILURES_TO_STOP chapters in a row fail every source, the host is
// likely down: stop, as the in-app downloader does.
const retryOnSystem = (failed: readonly Queued[]) => {
  const system = systemDownloads();
  if (!system || !failed.length) return;
  const again: Queued[] = [];
  const givenUp: string[] = [];
  for (const item of failed) {
    const key = keyOf(item);
    const sources = Math.max(1, getBibleAudioDownloadUrls(item.narrator, item.bookId, item.chapter).length);
    // A phone that tried every source has been round them once.
    const count = (tries.get(key) ?? 0) + (system.triesEverySource ? sources : 1);
    if (count % sources === 0) failuresInARow += 1;
    if (count < sources * ATTEMPTS && failuresInARow < FAILURES_TO_STOP) {
      tries.set(key, count);
      queued.set(key, item);
      again.push(item);
    } else {
      tries.delete(key);
      givenUp.push(key);
    }
  }
  if (failuresInARow >= FAILURES_TO_STOP) {
    givenUp.push(...queued.keys(), ...running.keys());
    queued.clear();
    running.clear();
    requested.clear();
    saveRequests();
    again.length = 0;
  }
  // Clears Android's record of a failed download.
  if (givenUp.length) void callSystem(() => system.cancel(givenUp));
  handToSystem(
    again.filter(({ mobileData }) => !mobileData),
    false,
  );
  handToSystem(
    again.filter(({ mobileData }) => mobileData),
    true,
  );
};

const requestsFile = () => new File(rootFolder(), REQUESTS_FILE);

// Kept beside the audio, out of the backup with it, so a download the phone
// carries on with the app closed still shows when it opens again.
const saveRequests = () => {
  if (!systemDownloads()) return;
  const list = [...requested].flatMap(([narrator, asks]) => [...asks.values()].map((ask) => ({ narrator, ...ask })));
  try {
    const file = requestsFile();
    if (list.length) {
      rootFolder().create({ intermediates: true, idempotent: true });
      if (!file.exists) file.create();
      file.write(JSON.stringify(list));
    } else if (file.exists) {
      file.delete();
    }
  } catch (error) {
    console.warn('Could not save the Bible audio downloads asked for:', error);
  }
};

const readRequests = async () => {
  try {
    const file = requestsFile();
    if (!file.exists) return;
    const list: unknown = JSON.parse(await file.text());
    if (!Array.isArray(list)) return;
    for (const entry of list) {
      if (typeof entry?.narrator !== 'string' || !entry.scope || typeof entry.scope.kind !== 'string') continue;
      let asked = requested.get(entry.narrator);
      if (!asked) requested.set(entry.narrator, (asked = new Map()));
      asked.set(scopeKey(entry.scope), { scope: entry.scope, mobileData: entry.mobileData === true });
    }
  } catch (error) {
    console.warn('Could not read the Bible audio downloads asked for:', error);
  }
};

// When the app starts: what the phone did while it was closed. A chapter asked
// for that's neither on the phone nor downloading, as one iOS stopped when the
// app was swiped away, is handed over again.
const reconcileSystem = async () => {
  await readRequests();
  await refreshSystem({ settle: false });
  for (const [narrator, asks] of requested) {
    for (const { scope, mobileData } of asks.values()) {
      const items: Queued[] = [];
      for (const bookId of getBibleAudioScopeBooks(scope)) {
        const onPhone = downloaded.get(narrator)?.get(bookId);
        for (let chapter = 1; chapter <= (CHAPTERS.get(bookId) ?? 0); chapter += 1) {
          const key = keyOf({ narrator, bookId, chapter });
          if (onPhone?.has(chapter) || running.has(key) || queued.has(key)) continue;
          const item = { narrator, bookId, chapter, mobileData, attempts: 0 };
          queued.set(key, item);
          items.push(item);
        }
      }
      handToSystem(items, mobileData);
    }
  }
  if (queued.size || running.size) {
    watchConnection();
    startPolling();
  } else {
    stopWatching();
  }
  emit();
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
  if (!asked) requested.set(narrator, (asked = new Map()));
  const requestKey = scopeKey(scope);
  asked.set(requestKey, { scope, mobileData: mobileData || (asked.get(requestKey)?.mobileData ?? false) });
  // For the phone's downloader: what's new to it, or now allowed on mobile data.
  const handOver: Queued[] = [];
  for (const bookId of getBibleAudioScopeBooks(scope)) {
    const onPhone = downloaded.get(narrator)?.get(bookId);
    for (let chapter = 1; chapter <= (CHAPTERS.get(bookId) ?? 0); chapter += 1) {
      const key = keyOf({ narrator, bookId, chapter });
      if (onPhone?.has(chapter) || running.has(key)) continue;
      const waiting = queued.get(key);
      if (waiting) {
        if (mobileData && !waiting.mobileData) {
          queued.set(key, { ...waiting, mobileData });
          handOver.push({ ...waiting, mobileData });
        }
      } else {
        const item = { narrator, bookId, chapter, mobileData, attempts: 0 };
        queued.set(key, item);
        handOver.push(item);
      }
    }
  }
  watchConnection();
  emit();
  if (systemDownloads()) {
    saveRequests();
    handToSystem(handOver, mobileData);
  } else {
    pump();
  }
};

/** Stops a scope's chapters downloading. The ones already on the phone stay. */
export const stopBibleAudioDownload = (narrator: string, scope: BibleAudioDownloadScope) => {
  const books = new Set(getBibleAudioScopeBooks(scope));
  const stopped: string[] = [];
  for (const [key, item] of queued) {
    if (item.narrator !== narrator || !books.has(item.bookId)) continue;
    queued.delete(key);
    stopped.push(key);
  }
  for (const [key, { item, controller }] of running) {
    if (item.narrator !== narrator || !books.has(item.bookId)) continue;
    if (controller) {
      controller.abort();
    } else {
      running.delete(key);
      stopped.push(key);
    }
  }
  const asked = requested.get(narrator);
  asked?.forEach((request, key) => {
    if (covers(scope, request.scope)) asked.delete(key);
  });
  const system = systemDownloads();
  if (system) {
    stopped.forEach((key) => tries.delete(key));
    if (stopped.length) void callSystem(() => system.cancel(stopped));
    saveRequests();
  }
  emit();
  pump();
};

/** How much of a scope is on the phone, in bytes, not counting chapters still downloading. */
export const getDownloadedBibleAudioBytes = (narrator: string, scope: BibleAudioDownloadScope) => {
  let bytes = 0;
  for (const bookId of getBibleAudioScopeBooks(scope)) {
    downloaded.get(narrator)?.get(bookId)?.forEach((size) => (bytes += size));
  }
  return bytes;
};

/**
 * Deletes a scope's downloaded chapters, and stops any of them still
 * downloading: a book, a section, a Testament, or for the whole Bible,
 * everything downloaded for the narrator. Other books' downloads go on.
 */
export const deleteBibleAudio = (narrator: string, scope: BibleAudioDownloadScope) => {
  stopBibleAudioDownload(narrator, scope);
  const deleteFiles = () => {
    const books = downloaded.get(narrator);
    for (const bookId of getBibleAudioScopeBooks(scope)) {
      const folder = bookFolder(narrator, bookId);
      if (folder.exists) folder.delete();
      books?.delete(bookId);
    }
    if (scope.kind === 'bible') {
      const folder = new Directory(rootFolder(), narrator);
      if (folder.exists) folder.delete();
    }
    if (books && !books.size) downloaded.delete(narrator);
    emit();
  };
  deleteFiles();
  // A chapter the phone finished just as it was stopped: once the phone has
  // stopped them all, delete again, unless the member has asked for it anew.
  if (systemDownloads()) {
    void callSystem(async () => {
      const books = new Set(getBibleAudioScopeBooks(scope));
      const askedAgain =
        [...queued.values(), ...[...running.values()].map(({ item }) => item)].some(
          (item) => item.narrator === narrator && books.has(item.bookId),
        );
      if (!askedAgain) deleteFiles();
    });
  }
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
  running.forEach(({ controller }) => controller?.abort());
  running.clear();
  downloaded.clear();
  loaded = false;
  failuresInARow = 0;
  stopWatching();
  tries.clear();
  handingOver.clear();
  heldForWifi.clear();
  heldBytes.clear();
  systemCalls = Promise.resolve();
};
