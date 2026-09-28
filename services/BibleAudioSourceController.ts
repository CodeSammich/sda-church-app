import type { AudioSource } from 'expo-audio';

import {
  getBibleAudioSourceLoadTimeoutMs,
  getNextBibleAudioSourceAttempt,
  hasBibleAudioSourceStarted,
  isLastTimedBibleAudioPass,
  type BibleAudioSourceAttempt,
  type NextBibleAudioSourceAttempt,
} from './BibleAudioFailover';
import type {
  BibleAudioChapterIdentity,
  BibleAudioQueueItem,
  BibleAudioQueueSource,
  BibleAudioSourceError,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

/**
 * One chapter's recording on each configured host, in retry order. A source
 * attempt carries its own target, so a delayed retry never reads the chapter
 * or links of a later render.
 */
export type AudioSourceTarget = {
  chapter?: BibleAudioChapterIdentity;
  sources: BibleAudioQueueSource[];
};

export type AudioSourceAttempt = BibleAudioSourceAttempt & {
  attempt: number;
  target: AudioSourceTarget;
  resumePositionMillis: number;
};

export const getAudioSourceUrl = (entry?: BibleAudioQueueSource) => {
  const source = entry?.source;
  return source && typeof source === 'object' ? source.uri ?? null : null;
};

export const getQueuedAudioTarget = (item: BibleAudioQueueItem): AudioSourceTarget => ({
  chapter: { bookId: item.bookId, chapter: item.chapter, translationId: item.translationId },
  sources: [{ source: item.source, metadata: item.metadata }, ...(item.fallbacks || [])],
});

export const isSameAudioChapter = (
  first: BibleAudioChapterIdentity,
  second: BibleAudioChapterIdentity,
) =>
  first.bookId === second.bookId &&
  first.chapter === second.chapter &&
  first.translationId === second.translationId;

type Ref<T> = { current: T };

/** What the controller needs from the player. */
export type BibleAudioSourcePlayer = {
  readonly currentStatus: BibleAudioStatus;
  replace(source: AudioSource): void;
  play(): void;
  seekTo(seconds: number): Promise<void>;
};

/**
 * The Bible screen's side of the controller. The refs are state the screen
 * shares with its other playback code; the callbacks reach its UI, its queue
 * builder, and its autoplay and recovery timers. The screen replaces these on
 * every render, so each call sees the current chapter and links.
 */
export type BibleAudioSourceHost = {
  platform: string;
  player: BibleAudioSourcePlayer;
  /** Whether the listener wants audio playing. Pausing clears it. */
  listening: Ref<boolean>;
  /** Whether the player should be told to play once the source is ready. */
  pendingAutoplay: Ref<boolean>;
  /** The source loaded into the player, if any. */
  loadedUrl: Ref<string | null>;
  /** Whether the loaded source has been ready at least once. */
  sourceReady: Ref<boolean>;
  /** The chapter shown in the reader, on each of its configured hosts. */
  getReaderTarget(): AudioSourceTarget;
  /** The best-known playback position, for resuming a reloaded source. */
  getPositionMillis(): number;
  /** Seeds the native queue and lock-screen controls for a loaded source. */
  initializePlayback(target: AudioSourceTarget, entry: BibleAudioQueueSource): void;
  setLoading(loading: boolean): void;
  cancelSeek(): void;
  scheduleAutoplayRetry(): void;
  clearAutoplayRetry(): void;
  clearRecoveryTimeout(): void;
  releaseFocus(): void;
};

type PendingResume = { attempt: number; url: string; positionMillis: number };

/**
 * Chooses which host plays a Bible chapter, and moves on when one fails.
 *
 * A host that fails outright is skipped as soon as the player reports the
 * error. A slow one gets its pass's load timeout. After the last host, every
 * host is tried again with longer timeouts, and after the third pass once a
 * minute, for as long as the listener is listening (see
 * `BibleAudioFailover.ts` for the schedule). A source that has already played
 * and then fails is reloaded where it stopped.
 */
export class BibleAudioSourceController {
  /** Replaced by the screen on every render. */
  host: BibleAudioSourceHost;

  private attemptCount = 0;
  private loadTimeout: ReturnType<typeof setTimeout> | null = null;
  // A switch to the next host waiting out its pass's start delay, and the
  // switch itself, so it can run early when the connection comes back.
  private failoverTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingFailover: (() => void) | null = null;
  private currentAttempt: AudioSourceAttempt | null = null;
  // The source that has loaded or played. An error after that reloads it where
  // it stopped instead of switching hosts.
  private startedUrl: string | null = null;
  // A source whose native player failed. play() cannot revive a failed player,
  // so the next Play reloads the source.
  private failedUrl: string | null = null;
  // iOS: where a reloaded source resumes once it has loaded. AVPlayer cannot
  // seek an item that has not loaded yet.
  private pendingResume: PendingResume | null = null;

  constructor(host: BibleAudioSourceHost) {
    this.host = host;
  }

  /** Changes whenever a source loads or playback is paused or unloaded. */
  get attempt() {
    return this.attemptCount;
  }

  /** Whether an iOS reload is waiting to seek and start playing. */
  get isResumePending() {
    return this.pendingResume !== null;
  }

  /** Whether `url`'s player failed and hasn't been reloaded. */
  hasFailed(url: string | null) {
    return !!url && this.failedUrl === url;
  }

  /** Whether `url` has loaded or played, now or at any point this attempt. */
  hasStarted(url: string) {
    if (this.startedUrl === url) return true;
    const status = this.host.player.currentStatus;
    return (status.activeSourceUrl || this.host.loadedUrl.current) === url &&
      hasBibleAudioSourceStarted(status);
  }

  /**
   * Called with each fresh player status: latches a source that has started,
   * and runs a pending iOS resume once its source has loaded.
   */
  onStatus(status: BibleAudioStatus) {
    const { host } = this;
    const activeUrl = status.activeSourceUrl || host.loadedUrl.current;
    if (activeUrl && hasBibleAudioSourceStarted(status)) {
      this.startedUrl = activeUrl;
    }
    const pendingResume = this.pendingResume;
    const isReady = !!status.isLoaded && status.duration > 0;
    if (!pendingResume || !isReady || pendingResume.url !== host.loadedUrl.current) return;
    this.pendingResume = null;
    if (pendingResume.attempt !== this.attemptCount) return;
    void host.player.seekTo(pendingResume.positionMillis / 1000)
      .catch((error) => console.warn('Bible audio resume seek failed:', error))
      .then(() => {
        if (pendingResume.attempt !== this.attemptCount || !this.host.listening.current) return;
        this.host.pendingAutoplay.current = true;
        this.host.player.play();
        this.host.scheduleAutoplayRetry();
      });
  }

  /** Loads `target`'s source at `sourceIndex` and starts playing it. */
  async load(
    target: AudioSourceTarget,
    sourceIndex: number,
    resumePositionMillis = 0,
    pass = 0,
  ): Promise<void> {
    const { host } = this;
    const entry = target.sources[sourceIndex];
    const audioUrl = getAudioSourceUrl(entry);
    if (!entry || !audioUrl) {
      this.stopAfterEverySourceFailed();
      return;
    }

    const attempt = ++this.attemptCount;
    this.clearTimers();
    host.clearRecoveryTimeout();
    this.currentAttempt = { attempt, target, sourceIndex, pass, resumePositionMillis };
    this.startedUrl = null;
    this.failedUrl = null;
    this.pendingResume = null;
    // iOS seeks once the source has loaded, then starts playing.
    const deferResume = host.platform === 'ios' && resumePositionMillis > 0;

    try {
      host.setLoading(true);
      host.listening.current = true;
      host.pendingAutoplay.current = host.platform !== 'web' && !deferResume;
      host.loadedUrl.current = audioUrl;
      host.sourceReady.current = false;
      host.cancelSeek();
      host.player.replace(entry.source);
      host.initializePlayback(target, entry);
      if (deferResume) {
        this.pendingResume = { attempt, url: audioUrl, positionMillis: resumePositionMillis };
      } else {
        if (resumePositionMillis > 0) {
          await host.player.seekTo(resumePositionMillis / 1000);
        }
        if (attempt !== this.attemptCount) return;
        this.host.player.play();
        this.host.scheduleAutoplayRetry();
      }

      // A slow initial request is not itself a source failure; a source that
      // fails outright reports an error, handled by handleError. Only try the
      // next host after this pass's load timeout if the source has never
      // started. Once playback begins, this timer never replaces the source.
      this.loadTimeout = setTimeout(() => {
        this.loadTimeout = null;
        if (!this.isCurrentAttempt(attempt, target)) return;
        if (this.hasStarted(audioUrl)) return;

        const next = getNextBibleAudioSourceAttempt({ sourceIndex, pass }, target.sources.length);
        if (next && !isLastTimedBibleAudioPass(pass)) {
          console.warn('Bible audio initial load timed out; trying the next configured source.');
          this.failOver(attempt, target, next, resumePositionMillis);
        } else {
          console.warn('Bible audio is still buffering after every source was tried; keeping the current source.');
        }
      }, getBibleAudioSourceLoadTimeoutMs(pass));
    } catch (e) {
      if (attempt !== this.attemptCount) return;
      // Treat a bridge failure like a source error, including the retry passes.
      console.warn('Bible audio source failed to load.', e);
      this.failedUrl = audioUrl;
      this.moveToNextSource(attempt, target, { sourceIndex, pass }, resumePositionMillis);
    }
  }

  /**
   * Handles a playback error as the player reports it: an HTTP error, a web
   * page instead of audio, a DNS failure, or a connection lost mid-chapter.
   * Android delivers these even while the screen is off.
   */
  handleError({ error, currentTime, sourceUrl, chapter }: BibleAudioSourceError) {
    const { host } = this;
    const failedUrl = sourceUrl || host.loadedUrl.current;
    if (!failedUrl) return;
    this.failedUrl = failedUrl;
    host.clearRecoveryTimeout();
    // After a pause, the next Play reloads the failed source.
    if (!host.listening.current) return;

    const attempt = this.attemptCount;
    const current = this.currentAttempt;
    let target: AudioSourceTarget;
    let position: BibleAudioSourceAttempt;
    let resumePositionMillis = 0;
    if (current && getAudioSourceUrl(current.target.sources[current.sourceIndex]) === failedUrl) {
      target = current.target;
      position = { sourceIndex: current.sourceIndex, pass: current.pass };
      resumePositionMillis = current.resumePositionMillis;
    } else {
      // Android moved on to a queued chapter, which carries its own hosts.
      target = chapter ? getQueuedAudioTarget(chapter) : host.getReaderTarget();
      position = {
        // An unknown source counts as "before the first", so the first is next.
        sourceIndex: target.sources.findIndex((entry) => getAudioSourceUrl(entry) === failedUrl),
        pass: 0,
      };
    }
    this.clearTimers();

    if (this.startedUrl === failedUrl && position.sourceIndex >= 0) {
      // This source already played, so the connection dropped mid-chapter.
      // Reload the same source where it stopped. If the reload fails before
      // it plays, the next host picks up at the same place. This is a new
      // failure, so it gets every retry pass again.
      console.warn('Bible audio stopped mid-chapter; reloading the same source.', error);
      void this.load(
        target,
        position.sourceIndex,
        Math.max(currentTime * 1000, host.getPositionMillis()),
      );
      return;
    }
    console.warn('Bible audio source failed to load; trying the next configured source.', error);
    this.moveToNextSource(attempt, target, position, resumePositionMillis);
  }

  /**
   * Starts or resumes the reader's chapter after the listener presses Play.
   * A failed player cannot resume, so it is reloaded; so is a source paused
   * before it started, which has no load timeout left.
   */
  async start(): Promise<void> {
    const { host } = this;
    const readerTarget = host.getReaderTarget();
    const readerUrls = readerTarget.sources.map(getAudioSourceUrl);
    const loadedUrl = host.loadedUrl.current;
    const loadedIndex = loadedUrl ? readerUrls.indexOf(loadedUrl) : -1;
    if (!loadedUrl || loadedIndex < 0) {
      // After every source failed mid-chapter, start again where it stopped.
      const lastAttempt = this.currentAttempt;
      const resumePositionMillis =
        !loadedUrl &&
        lastAttempt?.target.chapter &&
        readerTarget.chapter &&
        isSameAudioChapter(lastAttempt.target.chapter, readerTarget.chapter)
          ? lastAttempt.resumePositionMillis
          : 0;
      await this.load(readerTarget, 0, resumePositionMillis);
      return;
    }
    if (host.platform !== 'web' && (this.failedUrl === loadedUrl || !this.hasStarted(loadedUrl))) {
      // Reload it, where it stopped if it had played. A source that failed
      // before it played is skipped.
      const current = this.currentAttempt;
      const hasStarted = this.startedUrl === loadedUrl;
      const resumePositionMillis = hasStarted
        ? host.getPositionMillis()
        : current && getAudioSourceUrl(current.target.sources[current.sourceIndex]) === loadedUrl
          ? current.resumePositionMillis
          : 0;
      const sourceIndex = this.failedUrl === loadedUrl && !hasStarted
        ? (loadedIndex + 1) % readerUrls.length
        : loadedIndex;
      await this.load(readerTarget, sourceIndex, resumePositionMillis);
      return;
    }
    host.listening.current = true;
    host.pendingAutoplay.current = host.platform !== 'web';
    host.player.play();
    host.scheduleAutoplayRetry();
  }

  /**
   * Runs a switch that is waiting between passes now, for example when the
   * connection comes back or the app is opened again. Android pauses
   * JavaScript timers while the screen is off, so the wait could otherwise
   * last until the phone is unlocked.
   */
  retryNow() {
    this.pendingFailover?.();
  }

  /** Stops every pending retry, as pausing does. The loaded source stays. */
  cancel() {
    this.attemptCount += 1;
    this.clearTimers();
    this.pendingResume = null;
  }

  /** Forgets the loaded source entirely, as changing reader or host does. */
  reset() {
    this.cancel();
    this.currentAttempt = null;
    this.startedUrl = null;
    this.failedUrl = null;
  }

  private clearTimers() {
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
      this.loadTimeout = null;
    }
    if (this.failoverTimeout) {
      clearTimeout(this.failoverTimeout);
      this.failoverTimeout = null;
    }
    this.pendingFailover = null;
  }

  private stopAfterEverySourceFailed() {
    const { host } = this;
    this.clearTimers();
    host.clearRecoveryTimeout();
    host.listening.current = false;
    host.pendingAutoplay.current = false;
    host.clearAutoplayRetry();
    host.loadedUrl.current = null;
    this.pendingResume = null;
    host.setLoading(false);
    host.releaseFocus();
    console.error('Bible audio unavailable: every configured host failed.');
  }

  // Whether a timer armed for `attempt` still applies. Pausing or loading
  // anything else starts a new attempt, and Android and web can also move to
  // the next chapter on their own.
  private isCurrentAttempt(attempt: number, target: AudioSourceTarget) {
    if (attempt !== this.attemptCount || !this.host.listening.current) return false;
    const activeChapter = this.host.player.currentStatus.activeChapter;
    return !target.chapter || !activeChapter || isSameAudioChapter(activeChapter, target.chapter);
  }

  // Moves this attempt to the next host. When the sources start over, the
  // pass's delay runs first. The source still loading during that delay keeps
  // its chance: if it starts playing, the delayed switch is dropped.
  private failOver(
    attempt: number,
    target: AudioSourceTarget,
    next: NextBibleAudioSourceAttempt,
    resumePositionMillis: number,
  ) {
    if (next.delayMs <= 0) {
      void this.load(target, next.sourceIndex, resumePositionMillis, next.pass);
      return;
    }
    if (this.failoverTimeout) return;
    const runFailover = () => {
      if (this.failoverTimeout) {
        clearTimeout(this.failoverTimeout);
        this.failoverTimeout = null;
      }
      this.pendingFailover = null;
      if (!this.isCurrentAttempt(attempt, target)) return;
      const waitingUrl = this.host.loadedUrl.current;
      if (waitingUrl && this.failedUrl !== waitingUrl && this.hasStarted(waitingUrl)) return;
      void this.load(target, next.sourceIndex, resumePositionMillis, next.pass);
    };
    this.pendingFailover = runFailover;
    this.failoverTimeout = setTimeout(runFailover, next.delayMs);
  }

  // Moves past a source that failed before it played: to the next host, or
  // after the last one, back to the first on the next pass. It keeps going
  // for as long as the listener is listening; pausing stops it.
  private moveToNextSource(
    attempt: number,
    target: AudioSourceTarget,
    current: BibleAudioSourceAttempt,
    resumePositionMillis: number,
  ) {
    const next = getNextBibleAudioSourceAttempt(current, target.sources.length);
    if (!next) {
      this.stopAfterEverySourceFailed();
      return;
    }
    this.failOver(attempt, target, next, resumePositionMillis);
  }
}
