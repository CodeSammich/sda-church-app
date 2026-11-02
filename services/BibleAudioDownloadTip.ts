import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * When Bible audio keeps stopping to load, the audio settings button points
 * the listener to Listen offline (#595): its border pulses, then a dot stays
 * until the popup opens, and the popup says why. This file decides when.
 *
 * - **The stalls:** 3 in one listening session, from pressing play to pausing
 *   or stopping, or one longer than 5 seconds. The usual loading at a
 *   chapter's start, or after the listener skips or drags the bar, doesn't
 *   count toward the 3, but still counts if it runs over 5 seconds.
 * - **Not nagging:** at most once each time the app starts. Never again once
 *   Bible audio has been on the phone, even after it's deleted. If the listener
 *   closes the popup without downloading, it rests for 7 days.
 *
 * hooks/useBibleAudioDownloadTip.ts adds what only the screen knows: whether
 * Listen offline is offered, and what's already on the phone.
 */

/** Stalls in one listening session that show the tip. */
export const BIBLE_AUDIO_TIP_STALLS = 3;
/** A stall this long shows the tip by itself. */
export const BIBLE_AUDIO_TIP_LONG_STALL_MS = 5_000;
/** How long the tip rests after the listener opens the popup and doesn't download. */
export const BIBLE_AUDIO_TIP_REST_MS = 7 * 24 * 60 * 60 * 1000;
// Loading this early in a chapter, or this soon after a skip or a drag, is the
// usual wait, not a stall.
const CHAPTER_START_MS = 1_000;
const AFTER_SEEK_MS = 2_000;

/** `downloaded`, or when the rest ends, in milliseconds since 1970. */
export const BIBLE_AUDIO_TIP_STORAGE_KEY = 'bible-audio-download-tip';

// undefined until AsyncStorage has been read; null when nothing is saved.
let saved: 'downloaded' | number | null | undefined;
let loading: Promise<void> | null = null;
let shownThisRun = false;

const save = (value: 'downloaded' | number) => {
  saved = value;
  AsyncStorage.setItem(BIBLE_AUDIO_TIP_STORAGE_KEY, String(value)).catch((error) =>
    console.warn('Could not save the Bible audio download tip:', error),
  );
};

/** Reads what's saved, once. Until it has, the tip doesn't show. */
export const loadBibleAudioTip = () => {
  loading ??= AsyncStorage.getItem(BIBLE_AUDIO_TIP_STORAGE_KEY)
    .then((value) => {
      // A save made meanwhile is newer.
      if (saved !== undefined) return;
      const restUntil = Number(value);
      saved = value === 'downloaded' ? 'downloaded' : value && restUntil > 0 ? restUntil : null;
    })
    .catch((error) => {
      console.warn('Could not read the Bible audio download tip:', error);
      saved ??= null;
    });
  return loading;
};

/** Whether the tip may show now, if the stalls call for it. */
export const canShowBibleAudioTip = (now = Date.now()) =>
  !shownThisRun &&
  saved !== undefined &&
  saved !== 'downloaded' &&
  (saved === null || now >= saved);

export const noteBibleAudioTipShown = () => {
  shownThisRun = true;
};

/** The listener closed the popup the tip opened, without downloading. */
export const restBibleAudioTip = (now = Date.now()) => save(now + BIBLE_AUDIO_TIP_REST_MS);

/** Bible audio is on the phone, so the listener knows downloads exist. */
export const noteBibleAudioDownloaded = () => {
  if (saved !== 'downloaded') save('downloaded');
};

/** Forgets everything, for tests. */
export const resetBibleAudioTipForTests = () => {
  saved = undefined;
  loading = null;
  shownThisRun = false;
};

export type BibleAudioPlaybackState = Readonly<{
  /** The listener wants playback: they pressed play and haven't paused or stopped. */
  listening: boolean;
  /** The player is loading instead of playing. */
  waiting: boolean;
  /** Where in the chapter, in milliseconds. */
  positionMillis: number;
}>;

/**
 * Counts one listening session's stalls, and calls `onStruggling` when they
 * call for the tip. The caller decides whether it may show. `getState` reads
 * the player as it is now.
 */
export class BibleAudioStallWatcher {
  private stalls = 0;
  private stalled = false;
  private lastSeekAt = Number.NEGATIVE_INFINITY;
  private longStallTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly getState: () => BibleAudioPlaybackState,
    private readonly onStruggling: () => void,
    private readonly now: () => number = Date.now,
  ) {}

  /** The listener skipped or dragged the bar, so the player may load for a moment. */
  noteSeek() {
    this.lastSeekAt = this.now();
  }

  /** Call whenever the player's status changes. */
  update() {
    const { listening, waiting, positionMillis } = this.getState();
    if (!listening) {
      this.endSession();
      return;
    }
    if (waiting === this.stalled) return;
    this.stalled = waiting;
    if (!waiting) {
      this.clearLongStallTimer();
      return;
    }
    const usualWait =
      positionMillis < CHAPTER_START_MS || this.now() - this.lastSeekAt < AFTER_SEEK_MS;
    if (!usualWait && ++this.stalls >= BIBLE_AUDIO_TIP_STALLS) {
      this.struggling();
      return;
    }
    this.longStallTimer = setTimeout(() => {
      this.longStallTimer = null;
      const { listening: stillListening, waiting: stillWaiting } = this.getState();
      // A pause while loading may leave the player's status as it was.
      if (stillListening && stillWaiting) this.struggling();
      else this.update();
    }, BIBLE_AUDIO_TIP_LONG_STALL_MS);
  }

  /** Pausing or stopping ends the listening session; so does leaving the screen. */
  endSession() {
    this.stalls = 0;
    this.stalled = false;
    this.clearLongStallTimer();
  }

  private struggling() {
    this.stalls = 0;
    this.clearLongStallTimer();
    this.onStruggling();
  }

  private clearLongStallTimer() {
    if (this.longStallTimer) clearTimeout(this.longStallTimer);
    this.longStallTimer = null;
  }
}
