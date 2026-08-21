import { useEffect, useRef, useState } from 'react';

import type { AudioMetadata, AudioSource } from 'expo-audio';

import type {
  BibleAudioQueueItem,
  BibleAudioQueueSource,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

type Listener = () => void;

const ANDROID_PLAYBACK_WATCHDOG_MS = 2_000;

const EMPTY_STATUS: BibleAudioStatus = {
  currentTime: 0,
  didJustFinish: false,
  duration: 0,
  isBuffering: false,
  interruptionCount: 0,
  loadError: false,
  playing: false,
};

const getSourceUri = (source: AudioSource) => {
  if (typeof source === 'string') return source;
  if (source && typeof source === 'object' && 'uri' in source) {
    return source.uri || null;
  }
  return null;
};

/**
 * Browser player backed by two document-attached media elements. The active
 * element owns the media session while a standby element buffers only the next
 * queued chapter. Neither receives a source before the user starts playback.
 *
 * Background playback and consecutive chapter transitions are device-tested in
 * installed iOS PWAs. Android testing shows several background transitions but
 * playback may still pause after approximately three chapters. The operating
 * system decides whether to show Media Session controls on its lock screen.
 */
class BibleAudioPlayerWeb {
  private media: HTMLAudioElement | null = null;
  private standbyMedia: HTMLAudioElement | null = null;
  private listeners = new Set<Listener>();
  private status = EMPTY_STATUS;
  private metadata: AudioMetadata | undefined;
  private lockScreenActive = false;
  private queue: BibleAudioQueueItem[] = [];
  private activeSources: BibleAudioQueueSource[] = [];
  private activeSourceIndex = 0;
  private standbyItemKey: string | null = null;
  private standbySourceIndex = 0;
  private standbyLoadFailed = false;
  private standbyReleasePending = false;
  private continuePlaybackRequested = false;
  private playbackWatchdogTimeout: ReturnType<typeof setTimeout> | null = null;
  private playbackResumePending = false;
  private interruptionCount = 0;
  private remoteChapterHandlers:
    | {
        onNext?: (activeChapter?: BibleAudioStatus['activeChapter']) => void;
        onPrevious?: (activeChapter?: BibleAudioStatus['activeChapter']) => void;
      }
    | undefined;

  get currentStatus() {
    const media = this.media;
    return {
      duration: this.safeDuration(media?.duration || 0),
      isLoaded: !!media && media.readyState >= HTMLMediaElement.HAVE_METADATA,
    };
  }

  mount() {
    if (this.media || typeof document === 'undefined') return;

    const media = this.createMediaElement();
    const standbyMedia = this.createMediaElement();
    media.preload = 'metadata';
    standbyMedia.preload = 'auto';
    this.media = media;
    this.standbyMedia = standbyMedia;

    this.attachActiveMediaListeners(media);
  }

  unmount() {
    const media = this.media;
    if (!media) return;
    this.clearLockScreenControls();
    this.detachActiveMediaListeners(media);
    this.unloadMedia(media);
    media.remove();
    if (this.standbyMedia) this.unloadMedia(this.standbyMedia);
    this.standbyMedia?.remove();
    this.media = null;
    this.standbyMedia = null;
    this.queue = [];
    this.activeSources = [];
    this.interruptionCount = 0;
    this.remoteChapterHandlers = undefined;
    this.standbyReleasePending = false;
    this.resetStandbyState();
    this.stopPlaybackRecovery();
    this.status = EMPTY_STATUS;
    this.listeners.clear();
  }

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getStatus = () => this.status;

  replace(source: AudioSource) {
    const media = this.media;
    if (!media) return;
    const uri = getSourceUri(source);
    this.queue = [];
    this.standbyReleasePending = false;
    this.continuePlaybackRequested = false;
    this.stopPlaybackRecovery();
    this.activeSourceIndex = 0;
    this.activeSources = uri
      ? [{ source, metadata: this.metadata || {} }]
      : [];
    this.resetStandbyState();
    if (this.standbyMedia) this.unloadMedia(this.standbyMedia);
    media.pause();
    this.status = EMPTY_STATUS;
    this.interruptionCount = 0;
    if (uri) {
      media.src = uri;
    } else {
      media.removeAttribute('src');
    }
    media.load();
    this.emit();
  }

  setQueue(items: BibleAudioQueueItem[]) {
    this.queue = items.slice();
    if (!this.standbyReleasePending) this.prepareStandby();
  }

  setRemoteChapterHandlers(
    handlers?: {
      onNext?: (activeChapter?: BibleAudioStatus['activeChapter']) => void;
      onPrevious?: (activeChapter?: BibleAudioStatus['activeChapter']) => void;
    },
  ) {
    this.remoteChapterHandlers = handlers;
  }

  play() {
    const media = this.media;
    if (!media) return;
    this.continuePlaybackRequested = true;

    // A pending play() can resolve after an iOS PWA resumes and the elements
    // have swapped roles. Keep the standby silent before starting the owner.
    this.standbyMedia?.pause();
    // Android may discard or fail a background preload while leaving the
    // element at HAVE_NOTHING. A later Play action must restart the request
    // instead of repeatedly calling play() on the same unusable element.
    if (
      this.activeSources.length > 0 &&
      (media.error || media.readyState === HTMLMediaElement.HAVE_NOTHING)
    ) {
      if (
        media.error &&
        this.activeSourceIndex === this.activeSources.length - 1
      ) {
        this.activeSourceIndex = 0;
      }
      this.loadActiveSource();
    }
    void media.play().catch((error) => {
      console.error('Bible audio playback was rejected by the browser:', error);
      this.handleError();
    });
    this.schedulePlaybackWatchdog();
  }

  pause() {
    this.continuePlaybackRequested = false;
    this.stopPlaybackRecovery();
    this.media?.pause();
    this.standbyMedia?.pause();
  }

  seekTo(seconds: number) {
    if (this.media) this.media.currentTime = seconds;
    return Promise.resolve();
  }

  setPlaybackRate(rate: number) {
    if (this.media) this.media.playbackRate = rate;
    if (this.standbyMedia) this.standbyMedia.playbackRate = rate;
    this.updateMediaPosition();
  }

  setActiveForLockScreen(active: boolean, metadata?: AudioMetadata) {
    this.lockScreenActive = active;
    this.metadata = metadata;
    if (metadata && this.activeSources[this.activeSourceIndex]) {
      this.activeSources[this.activeSourceIndex].metadata = metadata;
    }
    if (!('mediaSession' in navigator)) return;
    if (!active) {
      this.clearLockScreenControls();
      return;
    }

    this.applyMetadata();
    navigator.mediaSession.setActionHandler('play', () => this.play());
    navigator.mediaSession.setActionHandler('pause', () => this.pause());
    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
      void this.seekTo(Math.max(0, this.status.currentTime - (details.seekOffset || 10)));
    });
    navigator.mediaSession.setActionHandler('seekforward', (details) => {
      void this.seekTo(
        Math.min(this.status.duration, this.status.currentTime + (details.seekOffset || 10)),
      );
    });
    navigator.mediaSession.setActionHandler('seekto', (details) => {
      if (details.seekTime !== undefined) void this.seekTo(details.seekTime);
    });
    navigator.mediaSession.setActionHandler('nexttrack', () => {
      if (!this.playQueuedChapter()) {
        this.remoteChapterHandlers?.onNext?.(this.status.activeChapter);
      }
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => {
      this.remoteChapterHandlers?.onPrevious?.(this.status.activeChapter);
    });
  }

  clearLockScreenControls() {
    this.lockScreenActive = false;
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = null;
    navigator.mediaSession.playbackState = 'none';
    for (const action of [
      'play',
      'pause',
      'seekbackward',
      'seekforward',
      'seekto',
      'nexttrack',
      'previoustrack',
    ] as MediaSessionAction[]) {
      try {
        navigator.mediaSession.setActionHandler(action, null);
      } catch {}
    }
  }

  private safeDuration(duration: number) {
    return Number.isFinite(duration) && duration > 0 ? duration : 0;
  }

  private createMediaElement() {
    const media = document.createElement('audio');
    media.setAttribute('data-bible-audio-player', '');
    media.setAttribute('aria-hidden', 'true');
    Object.assign(media.style, {
      height: '1px',
      left: '-10000px',
      opacity: '0',
      pointerEvents: 'none',
      position: 'fixed',
      width: '1px',
    });
    // iOS can resume a previously active media element when a PWA returns to
    // the foreground. If that element is now the standby, stop it immediately
    // so two chapters can never be audible at once.
    media.addEventListener('play', () => {
      if (media !== this.media) media.pause();
    });
    media.addEventListener('error', (event) => this.handleStandbyError(event));
    document.body.appendChild(media);
    return media;
  }

  private unloadMedia(media: HTMLAudioElement) {
    media.pause();
    media.removeAttribute('src');
    media.load();
  }

  private attachActiveMediaListeners(media: HTMLAudioElement) {
    media.addEventListener('loadstart', this.handleLoading);
    media.addEventListener('waiting', this.handleLoading);
    media.addEventListener('loadedmetadata', this.handleReady);
    media.addEventListener('canplay', this.handleReady);
    media.addEventListener('playing', this.handlePlaying);
    media.addEventListener('pause', this.handlePause);
    media.addEventListener('timeupdate', this.handleTimeUpdate);
    media.addEventListener('seeked', this.handleTimeUpdate);
    media.addEventListener('ended', this.handleEnded);
    media.addEventListener('error', this.handleError);
  }

  private detachActiveMediaListeners(media: HTMLAudioElement) {
    media.removeEventListener('loadstart', this.handleLoading);
    media.removeEventListener('waiting', this.handleLoading);
    media.removeEventListener('loadedmetadata', this.handleReady);
    media.removeEventListener('canplay', this.handleReady);
    media.removeEventListener('playing', this.handlePlaying);
    media.removeEventListener('pause', this.handlePause);
    media.removeEventListener('timeupdate', this.handleTimeUpdate);
    media.removeEventListener('seeked', this.handleTimeUpdate);
    media.removeEventListener('ended', this.handleEnded);
    media.removeEventListener('error', this.handleError);
  }

  private prepareStandby() {
    const standby = this.standbyMedia;
    const next = this.queue[0];
    if (!standby) return;
    const nextKey = next
      ? `${next.translationId}:${next.bookId}:${next.chapter}`
      : null;
    if (nextKey !== this.standbyItemKey) {
      this.standbyItemKey = nextKey;
      this.standbySourceIndex = 0;
      this.standbyLoadFailed = false;
    }

    const sources = next ? this.getQueueSources(next) : [];
    const uri = getSourceUri(sources[this.standbySourceIndex]?.source);
    if (!uri) {
      standby.removeAttribute('src');
      standby.load();
      return;
    }
    if (standby.src !== uri || this.standbyLoadFailed) {
      this.standbyLoadFailed = false;
      standby.src = uri;
      standby.load();
    }
  }

  private playQueuedChapter() {
    const next = this.queue.shift();
    const previousMedia = this.media;
    const nextMedia = this.standbyMedia;
    if (!next || !previousMedia || !nextMedia) return false;

    // Chrome on Android can briefly start and then pause a different audio
    // element when a locked PWA advances its playlist. Keep the element that
    // received the original user gesture as the media-session owner there;
    // the standby request still warms the browser cache for the next URL.
    if (this.shouldReuseActiveMediaForQueue()) {
      this.activeSources = this.getQueueSources(next);
      this.activeSourceIndex = this.standbyLoadFailed
        ? 0
        : Math.min(this.standbySourceIndex, this.activeSources.length - 1);
      this.metadata = this.activeSources[this.activeSourceIndex]?.metadata;
      // Keep the partially downloaded standby request alive until the active
      // element has enough data to play. Releasing it here can discard the
      // only buffered bytes Chrome retained while the PWA was locked.
      this.standbyReleasePending = true;
      this.status = {
        ...EMPTY_STATUS,
        interruptionCount: this.interruptionCount,
        activeChapter: {
          bookId: next.bookId,
          chapter: next.chapter,
          translationId: next.translationId,
        },
        isBuffering: true,
      };
      this.loadActiveSource();
      this.play();
      return true;
    }

    this.detachActiveMediaListeners(previousMedia);
    this.unloadMedia(previousMedia);

    this.media = nextMedia;
    this.standbyMedia = previousMedia;
    this.attachActiveMediaListeners(nextMedia);
    this.activeSources = this.getQueueSources(next);
    this.activeSourceIndex = this.standbyLoadFailed
      ? 0
      : Math.min(this.standbySourceIndex, this.activeSources.length - 1);
    this.metadata = this.activeSources[this.activeSourceIndex]?.metadata;
    this.resetStandbyState();
    this.applyMetadata();
    this.status = {
      ...EMPTY_STATUS,
      interruptionCount: this.interruptionCount,
      activeChapter: {
        bookId: next.bookId,
        chapter: next.chapter,
        translationId: next.translationId,
      },
      isBuffering: nextMedia.readyState < HTMLMediaElement.HAVE_FUTURE_DATA,
    };
    this.emit();
    this.prepareStandby();
    this.play();
    return true;
  }

  private shouldReuseActiveMediaForQueue() {
    return (
      typeof navigator !== 'undefined' &&
      /Android/i.test(navigator.userAgent || '')
    );
  }

  private stopPlaybackRecovery() {
    if (this.playbackWatchdogTimeout) {
      clearTimeout(this.playbackWatchdogTimeout);
      this.playbackWatchdogTimeout = null;
    }
    this.playbackResumePending = false;
  }

  private schedulePlaybackWatchdog() {
    if (
      !this.shouldReuseActiveMediaForQueue() ||
      !this.continuePlaybackRequested ||
      this.playbackWatchdogTimeout
    ) {
      return;
    }

    this.playbackWatchdogTimeout = setTimeout(() => {
      this.playbackWatchdogTimeout = null;
      this.recoverDesiredPlayback();
      this.schedulePlaybackWatchdog();
    }, ANDROID_PLAYBACK_WATCHDOG_MS);
  }

  private recoverDesiredPlayback() {
    const media = this.media;
    if (
      !media ||
      !this.continuePlaybackRequested ||
      media.ended ||
      !media.paused ||
      this.playbackResumePending
    ) {
      return;
    }

    this.playbackResumePending = true;
    void Promise.resolve().then(() => {
      this.playbackResumePending = false;
      if (
        media !== this.media ||
        !this.continuePlaybackRequested ||
        media.ended ||
        !media.paused
      ) {
        return;
      }
      if (media.error && this.activeSources.length > 0) {
        this.loadActiveSource();
        return;
      }
      // A progressive MP3 download with insufficient buffered data is a wait,
      // not a pause to fight. `canplay`/`playing` will retry after Chrome has
      // retained enough future audio.
      if (media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA) {
        return;
      }
      void media.play().catch((error) => {
        console.warn(
          'Android paused Bible audio while continuous playback was requested; resume was rejected:',
          error,
        );
        this.handleError();
      });
    });
  }

  private releaseStandbyAfterActiveReady() {
    if (
      !this.standbyReleasePending ||
      !this.media ||
      this.media.readyState < HTMLMediaElement.HAVE_FUTURE_DATA
    ) {
      return;
    }
    this.standbyReleasePending = false;
    if (this.standbyMedia) this.unloadMedia(this.standbyMedia);
    this.resetStandbyState();
    this.prepareStandby();
  }

  private recoverUnexpectedPause() {
    if (
      !this.shouldReuseActiveMediaForQueue() ||
      !this.continuePlaybackRequested
    ) {
      return;
    }
    this.recoverDesiredPlayback();
    this.schedulePlaybackWatchdog();
  }

  private getQueueSources(item: BibleAudioQueueItem): BibleAudioQueueSource[] {
    return [
      { source: item.source, metadata: item.metadata },
      ...(item.fallbacks || []),
    ];
  }

  private resetStandbyState() {
    this.standbyItemKey = null;
    this.standbySourceIndex = 0;
    this.standbyLoadFailed = false;
  }

  private loadActiveSource() {
    const media = this.media;
    const track = this.activeSources[this.activeSourceIndex];
    const uri = track ? getSourceUri(track.source) : null;
    if (!media || !uri) return false;
    media.src = uri;
    media.load();
    this.metadata = track.metadata;
    this.applyMetadata();
    this.updateStatus({ isBuffering: true, loadError: false, playing: false });
    return true;
  }

  private tryNextActiveSource() {
    if (this.activeSourceIndex + 1 >= this.activeSources.length) return false;
    this.activeSourceIndex += 1;
    if (!this.loadActiveSource()) return false;
    const media = this.media;
    if (media) {
      void media.play().catch((error) => {
        console.error('Bible audio fallback was rejected by the browser:', error);
        this.handleError();
      });
    }
    return true;
  }

  private handleStandbyError(event: Event) {
    if (event.currentTarget !== this.standbyMedia) return;
    const next = this.queue[0];
    if (!next) return;
    const sources = this.getQueueSources(next);
    if (this.standbySourceIndex + 1 < sources.length) {
      this.standbySourceIndex += 1;
      this.standbyLoadFailed = true;
      this.prepareStandby();
      return;
    }
    // Keep the item queued. Promotion or a later Play action will retry the
    // preferred request after Android restores network access.
    this.standbyLoadFailed = true;
  }

  private updateStatus(next: Partial<BibleAudioStatus>) {
    const media = this.media;
    this.status = {
      ...this.status,
      currentTime: media?.currentTime || 0,
      duration: this.safeDuration(media?.duration || 0),
      ...next,
    };
    this.emit();
  }

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private updateMediaPosition() {
    if (!this.lockScreenActive || !('mediaSession' in navigator)) return;
    const { currentTime, duration } = this.status;
    if (!duration) return;
    try {
      navigator.mediaSession.setPositionState({
        duration,
        playbackRate: this.media?.playbackRate || 1,
        position: Math.min(currentTime, duration),
      });
    } catch {}
  }

  private applyMetadata() {
    if (!this.metadata) return;
    if (this.media && this.metadata.title) {
      this.media.title = this.metadata.title;
    }
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      album: this.metadata.albumTitle || '',
      artist: this.metadata.artist || '',
      title: this.metadata.title || '',
    });
  }

  private handleLoading = () => this.updateStatus({ isBuffering: true });
  private handleReady = () => {
    this.updateStatus({ isBuffering: false, loadError: false });
    // Safari may replace custom metadata with the media URL's origin when the
    // newly loaded resource becomes ready, so publish it again afterward.
    this.applyMetadata();
    this.updateMediaPosition();
    this.releaseStandbyAfterActiveReady();
    this.recoverDesiredPlayback();
  };
  private handlePlaying = () => {
    this.updateStatus({
      didJustFinish: false,
      isBuffering: false,
      loadError: false,
      playing: true,
    });
    // iOS can perform another native Now Playing update at playback start.
    this.applyMetadata();
    if (this.lockScreenActive && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
    this.releaseStandbyAfterActiveReady();
    this.schedulePlaybackWatchdog();
  };
  private handlePause = () => {
    const wasUnexpectedInterruption =
      this.shouldReuseActiveMediaForQueue() &&
      this.continuePlaybackRequested &&
      this.status.playing &&
      !this.media?.ended;
    if (wasUnexpectedInterruption) this.interruptionCount += 1;
    this.updateStatus({
      interruptionCount: this.interruptionCount,
      isBuffering: false,
      playing: false,
    });
    if (this.lockScreenActive && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
    this.recoverUnexpectedPause();
  };
  private handleTimeUpdate = () => {
    this.updateStatus({});
    this.updateMediaPosition();
  };
  private handleEnded = () => {
    if (this.playQueuedChapter()) return;
    this.continuePlaybackRequested = false;
    this.stopPlaybackRecovery();
    this.updateStatus({ didJustFinish: true, isBuffering: false, playing: false });
  };
  private handleError = () => {
    if (this.media?.error && this.tryNextActiveSource()) return;
    this.updateStatus({
      didJustFinish: false,
      isBuffering: false,
      loadError: true,
      playing: false,
    });
  };
}

export const useBibleAudioPlayer = () => {
  const playerRef = useRef<BibleAudioPlayerWeb | null>(null);
  if (!playerRef.current) playerRef.current = new BibleAudioPlayerWeb();

  useEffect(() => {
    const player = playerRef.current!;
    player.mount();
    return () => player.unmount();
  }, []);

  return playerRef.current;
};

export const useBibleAudioPlayerStatus = (player: BibleAudioPlayerWeb) => {
  const [status, setStatus] = useState(player.getStatus);

  useEffect(
    () => player.subscribe(() => setStatus({ ...player.getStatus() })),
    [player],
  );

  return status;
};
