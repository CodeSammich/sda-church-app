import { useEffect, useRef, useState } from 'react';

import type { AudioMetadata, AudioSource } from 'expo-audio';

import type {
  BibleAudioQueueItem,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

type Listener = () => void;

const EMPTY_STATUS: BibleAudioStatus = {
  currentTime: 0,
  didJustFinish: false,
  duration: 0,
  isBuffering: false,
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
    if (this.standbyMedia) this.unloadMedia(this.standbyMedia);
    media.pause();
    this.status = EMPTY_STATUS;
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
    this.prepareStandby();
  }

  play() {
    const media = this.media;
    if (!media) return;

    // A pending play() can resolve after an iOS PWA resumes and the elements
    // have swapped roles. Keep the standby silent before starting the owner.
    this.standbyMedia?.pause();
    void media.play().catch((error) => {
      console.error('Bible audio playback was rejected by the browser:', error);
      this.handleError();
    });
  }

  pause() {
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
    const uri = next ? getSourceUri(next.source) : null;
    if (!uri) {
      standby.removeAttribute('src');
      standby.load();
      return;
    }
    if (standby.src !== uri) {
      standby.src = uri;
      standby.load();
    }
  }

  private playQueuedChapter() {
    const next = this.queue.shift();
    const previousMedia = this.media;
    const nextMedia = this.standbyMedia;
    if (!next || !previousMedia || !nextMedia) return false;

    this.detachActiveMediaListeners(previousMedia);
    this.unloadMedia(previousMedia);

    this.media = nextMedia;
    this.standbyMedia = previousMedia;
    this.attachActiveMediaListeners(nextMedia);
    this.metadata = next.metadata;
    this.applyMetadata();
    this.status = {
      ...EMPTY_STATUS,
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
    this.updateStatus({ isBuffering: false });
    // Safari may replace custom metadata with the media URL's origin when the
    // newly loaded resource becomes ready, so publish it again afterward.
    this.applyMetadata();
    this.updateMediaPosition();
  };
  private handlePlaying = () => {
    this.updateStatus({ didJustFinish: false, isBuffering: false, playing: true });
    // iOS can perform another native Now Playing update at playback start.
    this.applyMetadata();
    if (this.lockScreenActive && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'playing';
    }
  };
  private handlePause = () => {
    this.updateStatus({ isBuffering: false, playing: false });
    if (this.lockScreenActive && 'mediaSession' in navigator) {
      navigator.mediaSession.playbackState = 'paused';
    }
  };
  private handleTimeUpdate = () => {
    this.updateStatus({});
    this.updateMediaPosition();
  };
  private handleEnded = () => {
    if (this.playQueuedChapter()) return;
    this.updateStatus({ didJustFinish: true, isBuffering: false, playing: false });
  };
  private handleError = () =>
    this.updateStatus({ didJustFinish: false, isBuffering: false, playing: false });
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
