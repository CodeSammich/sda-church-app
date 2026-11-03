import {
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlayer,
} from 'expo-audio';

import { BIBLE_AUDIO_NARRATOR_ORDER } from '@/constants/BibleAudioNarrators';
import type { TranslationBook } from './BibleService';
import {
  getBibleAudioNarrator,
  getChurchHostedAudioLinks,
  hasChurchHostedAudio,
  type TranslationBookChapterAudioLinks,
} from './BibleAudioSources';
import type { BibleAudioQueueControls, BibleAudioQueueItem } from './BibleAudioPlayer.types';


// Expo Audio's persistent non-mixing mode keeps system interruptions from
// being treated as an intentional app stop, so playback does not reclaim
// focus and resume over another app's audio.
// https://github.com/expo/expo/pull/49101
// Tracking issue and user-facing behavior summary:
// https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/205

/**
 * Configures Bible narration as long-form background media.
 *
 * Platform behavior:
 * The native implementation handles interruption and deactivation on both
 * platforms. The app explicitly releases audio focus only for a user pause,
 * unload, sleep timer, or completed playback.
 *
 * Calling this again before a native retry or seek reasserts the app's audio
 * session after a transient native interruption without auto-resuming a player
 * the user intentionally paused.
 */
export const configureBibleAudioPlayback = () =>
  setAudioModeAsync({
    interruptionMode: 'doNotMixPersistent',
    playsInSilentMode: true,
    shouldPlayInBackground: true,
  });

/**
 * The lock screen's and the earbuds' skips match the reader's own −10 and +30
 * buttons. They must be given: expo-audio 58.0.10 on Android leaves an
 * interval it isn't given at 0, so each press moved 0.1 seconds.
 */
export const BIBLE_AUDIO_SKIP_BACK_SECONDS = 10;
export const BIBLE_AUDIO_SKIP_FORWARD_SECONDS = 30;

/** Publishes playback to native system controls and the web Media Session API. */
export const activateBibleAudioLockScreen = (
  player: Pick<AudioPlayer, 'setActiveForLockScreen'>,
  metadata: AudioMetadata,
) =>
  player.setActiveForLockScreen(true, metadata, {
    showSeekBackward: true,
    showSeekForward: true,
    seekBackwardIntervalSeconds: BIBLE_AUDIO_SKIP_BACK_SECONDS,
    seekForwardIntervalSeconds: BIBLE_AUDIO_SKIP_FORWARD_SECONDS,
  });

type BibleAudioInitialQueuePlayer = Pick<
  AudioPlayer & BibleAudioQueueControls,
  'setActiveForLockScreen' | 'setCurrentChapter' | 'setQueue' | 'setPreviousQueue'
>;

/**
 * Seeds a chapter's native queue before publishing it to lock-screen controls.
 *
 * Android's Expo MediaSession snapshots the playlist when lock-screen controls
 * are activated. Keeping this order in one small helper makes the Media3
 * transition invariant explicit and keeps it covered by a unit test.
 */
export const initializeBibleAudioPlayback = ({
  player,
  currentChapter,
  queue,
  previousQueue,
  metadata,
  onQueueError,
  onLockScreenError,
}: {
  player: BibleAudioInitialQueuePlayer;
  currentChapter?: BibleAudioQueueItem;
  queue: BibleAudioQueueItem[];
  /** The chapters before, nearest first, for the media buttons' previous (#543). */
  previousQueue?: BibleAudioQueueItem[];
  metadata: AudioMetadata;
  onQueueError?: (error: unknown) => void;
  onLockScreenError?: (error: unknown) => void;
}) => {
  if (currentChapter) player.setCurrentChapter?.(currentChapter);
  try {
    player.setQueue?.(queue);
  } catch (error) {
    onQueueError?.(error);
  }
  if (previousQueue) {
    try {
      player.setPreviousQueue?.(previousQueue);
    } catch (error) {
      onQueueError?.(error);
    }
  }
  try {
    activateBibleAudioLockScreen(player, metadata);
  } catch (error) {
    onLockScreenError?.(error);
  }
};

/** Returns a stable provider identifier for an audio URL. */
export const getBibleAudioSourceId = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/** Returns the user-facing provider name shown in audio controls. */
export const getBibleAudioSourceLabel = (url: string) => {
  const host = getBibleAudioSourceId(url);
  if (host === 'assets.adventistconnect.org') return 'NYCCSDA.org';
  if (host === 'theaudiopower.com' || host === 'theaudiopower.org') {
    return 'Audio Power';
  }
  if (host === 'archive.org') return 'Internet Archive';
  if (host === 'bible.helloao.org' || host === 'audio.bible.helloao.org') {
    return 'HelloAO';
  }
  return host.replace(/^www\./, '');
};

export const getBibleAudioMediaTitle = (
  chapterTitle: string,
  translationLabel: string,
  sourceUrl: string,
) =>
  `${chapterTitle} · ${translationLabel} (${getBibleAudioSourceLabel(sourceUrl)})`;

/**
 * Moves a preferred provider to the front without removing automatic
 * fallbacks or changing their relative order.
 */
export const prioritizeBibleAudioSource = (
  urls: string[],
  preferredSourceId?: string,
) => {
  if (!preferredSourceId) return urls;
  return [
    ...urls.filter(
      (url) => getBibleAudioSourceId(url) === preferredSourceId,
    ),
    ...urls.filter(
      (url) => getBibleAudioSourceId(url) !== preferredSourceId,
    ),
  ];
};

/**
 * Orders the narrators exposed for a chapter without loading any audio. BSB's
 * preferred narration order is Souer, Hays, then David; unknown narrators keep
 * the order supplied by the provider.
 */
export const getOrderedBibleAudioReaders = (
  translationId: string,
  links?: TranslationBookChapterAudioLinks,
) => {
  // The app's one narrator order (constants/BibleAudioNarrators.ts): Souer,
  // Hays, then David for the BSB, and Mandarin before Cantonese. Readers it
  // doesn't know keep the provider's order, after those it does.
  const rank = (reader: string) => {
    const index = BIBLE_AUDIO_NARRATOR_ORDER.indexOf(
      getBibleAudioNarrator(translationId, reader)?.toLocaleLowerCase() ?? '',
    );
    return index < 0 ? BIBLE_AUDIO_NARRATOR_ORDER.length : index;
  };
  return Object.entries(links || {})
    .map((entry, providerIndex) => ({ entry, providerIndex }))
    .sort(
      (left, right) =>
        rank(left.entry[0]) - rank(right.entry[0]) ||
        left.providerIndex - right.providerIndex,
    )
    .map(({ entry }) => entry);
};

/** Returns lightweight chapter coordinates without requesting chapter text. */
export const getFollowingBibleChapters = (
  books: TranslationBook[],
  bookId: string,
  chapter: number,
  limit: number,
) => {
  const chapters: Array<{ book: TranslationBook; chapter: number }> = [];
  let bookIndex = books.findIndex((candidate) => candidate.id === bookId);
  let nextChapter = chapter + 1;

  while (bookIndex >= 0 && bookIndex < books.length && chapters.length < limit) {
    const nextBook = books[bookIndex];
    if (nextChapter <= nextBook.numberOfChapters) {
      chapters.push({ book: nextBook, chapter: nextChapter });
      nextChapter += 1;
    } else {
      bookIndex += 1;
      nextChapter = 1;
    }
  }

  return chapters;
};

/** The chapters before one, nearest first, across book boundaries. */
export const getPrecedingBibleChapters = (
  books: TranslationBook[],
  bookId: string,
  chapter: number,
  limit: number,
) => {
  const chapters: Array<{ book: TranslationBook; chapter: number }> = [];
  let bookIndex = books.findIndex((candidate) => candidate.id === bookId);
  let previousChapter = chapter - 1;

  while (bookIndex >= 0 && chapters.length < limit) {
    if (previousChapter >= 1) {
      chapters.push({ book: books[bookIndex], chapter: previousChapter });
      previousChapter -= 1;
    } else {
      bookIndex -= 1;
      previousChapter = bookIndex >= 0 ? books[bookIndex].numberOfChapters : 0;
    }
  }

  return chapters;
};

/** Retargets a HelloAO recording URL while preserving its narrator filename. */
export const retargetHelloAoAudioUrl = (
  sourceUrl: string,
  translationId: string,
  bookId: string,
  chapter: number,
) => {
  try {
    const url = new URL(sourceUrl);
    if (!/(^|\.)helloao\.org$/i.test(url.hostname)) return null;

    const match = url.pathname.match(
      /^(.*\/api\/)[^/]+\/[^/]+\/\d+(\/audio\/.*)$/,
    );
    if (!match) return null;
    url.pathname = `${match[1]}${translationId}/${bookId}/${chapter}${match[2]}`;
    return url.toString();
  } catch {
    return null;
  }
};

export type BibleAudioSleepTimerSetting =
  5 | 10 | 15 | 30 | 60 | 120 | 'chapter' | 'book' | null;

export const shouldStopBibleAudioAtChapterEnd = (
  setting: BibleAudioSleepTimerSetting,
  chapter: number,
  numberOfChapters?: number,
) => setting === 'chapter' ||
  (setting === 'book' && chapter === numberOfChapters);

/**
 * A chapter's recordings in the order playback tries them: the phone's copy
 * first, if the member downloaded it (#556), whatever source the listener
 * chose, then the others, which stream, in the order given.
 */
export const withDownloadedCopy = (urls: readonly string[], downloadedUri: string | null) =>
  downloadedUri ? [downloadedUri, ...urls.filter((url) => url !== downloadedUri)] : [...urls];

/**
 * The recording a title credits. A downloaded copy is credited to the source
 * it's a copy of, the first one that streams.
 */
export const getBibleAudioCreditUrl = (url: string, urls: readonly string[], downloadedUri: string | null) =>
  url === downloadedUri ? (urls.find((other) => other !== downloadedUri) ?? url) : url;

interface BibleAudioQueueOptions {
  albumTitle: string;
  artist: string;
  books: TranslationBook[];
  currentBookId: string;
  currentChapter: number;
  /** The chapters after the current one, or before it, nearest first. */
  direction?: 'following' | 'preceding';
  /** The phone's copy of a chapter, played first, or null (#556). */
  getDownloadedUri?: (bookId: string, chapter: number) => string | null;
  limit?: number;
  sleepTimer?: BibleAudioSleepTimerSetting;
  preferredSourceId?: string;
  selectedAudioUrls: string[];
  selectedReader?: string;
  translationId: string;
  translationLabel: string;
}

/**
 * Builds track descriptors for the chapters after the current one, or before
 * it, without fetching chapter text or audio. The sleep timer limits both: a
 * chapter timer queues none, and a book timer stays in the book.
 */
export const buildBibleAudioQueue = ({
  albumTitle,
  artist,
  books,
  currentBookId,
  currentChapter,
  direction = 'following',
  getDownloadedUri,
  // Keep descriptors available when background React effects are suspended.
  // The web adapter still preloads only the immediate next recording.
  limit = 24,
  sleepTimer = null,
  preferredSourceId,
  selectedAudioUrls,
  selectedReader,
  translationId,
  translationLabel,
}: BibleAudioQueueOptions): BibleAudioQueueItem[] =>
  (direction === 'preceding' ? getPrecedingBibleChapters : getFollowingBibleChapters)(
    books,
    currentBookId,
    currentChapter,
    sleepTimer === 'chapter' ? 0 : limit,
  )
  .filter(({ book }) => sleepTimer !== 'book' || book.id === currentBookId)
  .flatMap(({ book, chapter }) => {
    let queuedUrls: string[] = [];

    if (hasChurchHostedAudio(translationId)) {
      const links = getChurchHostedAudioLinks(translationId, book.id, chapter);
      const source = selectedReader
        ? links[selectedReader]
        : Object.values(links)[0];
      const urls = source ? (Array.isArray(source) ? source : [source]) : [];
      queuedUrls = prioritizeBibleAudioSource(urls, preferredSourceId);
    } else {
      queuedUrls = selectedAudioUrls
        .map((url) =>
          retargetHelloAoAudioUrl(url, translationId, book.id, chapter),
        )
        .filter((url): url is string => !!url);
    }

    const downloadedUri = getDownloadedUri?.(book.id, chapter) ?? null;
    const tracks = withDownloadedCopy(queuedUrls, downloadedUri).map((url) => {
      const title = getBibleAudioMediaTitle(
        `${book.name} ${chapter}`,
        translationLabel,
        getBibleAudioCreditUrl(url, queuedUrls, downloadedUri),
      );
      return {
        source: { uri: url, name: title },
        metadata: { title, artist, albumTitle },
      };
    });
    const [primary, ...fallbacks] = tracks;
    if (!primary) return [];

    return [
      {
        bookId: book.id,
        chapter,
        translationId,
        ...primary,
        fallbacks,
      },
    ];
  });
