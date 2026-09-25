import type { AudioPlayer, AudioPlaylist, AudioPlaylistStatus, AudioSource } from 'expo-audio';
import type { BibleAudioQueueItem, BibleAudioStatus } from './BibleAudioPlayer.types';

const idleStatus = (): BibleAudioStatus => ({
  currentTime: 0, duration: 0, playing: false, isLoaded: false,
  isBuffering: false, didJustFinish: false,
});

const nativeErrorText = (cause: unknown): string => {
  if (cause instanceof Error) {
    const nested = 'cause' in cause ? nativeErrorText((cause as Error & { cause?: unknown }).cause) : '';
    return `${cause.message} ${nested}`;
  }
  if (cause && typeof cause === 'object' && 'message' in cause) {
    return `${String((cause as { message?: unknown }).message)} ${nativeErrorText((cause as { cause?: unknown }).cause)}`;
  }
  return String(cause);
};

// Expo's Android bridge reports a released shared object in two forms. The
// useful message is sometimes nested under `cause`, while the outer message
// only says that an Integer could not be cast back to AudioPlaylist. Both are
// stale-handle errors and must be absorbed by the adapter rather than thrown
// from a React effect or timer.
const isReleasedError = (cause: unknown) =>
  /already released|invalid shared object|received class java\.lang\.Integer|cannot be cast to (?:type )?class expo\.modules\.audio\.AudioPlaylist/i.test(
    nativeErrorText(cause),
  );

/** Owns the native lifetime; stale reader callbacks never reach a released object. */
export class BibleAudioNativeQueue {
  private playlist: AudioPlaylist | null = null;
  private subscription?: { remove(): void };
  private tracks: Array<BibleAudioQueueItem | undefined> = [];
  private snapshot = idleStatus();
  private listeners = new Set<() => void>();

  constructor(private readonly createPlaylist: () => AudioPlaylist) {}

  mount() {
    if (this.playlist) return;
    const playlist = this.createPlaylist();
    this.playlist = playlist;
    this.subscription = playlist.addListener('playlistStatusUpdate', (status) => {
      // An event can already be queued when its listener is removed.
      if (this.playlist !== playlist) return;
      this.publish(this.status(status));
      const track = this.tracks[status.currentIndex];
      if (track && track !== this.lastMetadataTrack) {
        try {
          this.updateMetadata();
        } catch (error) {
          // Lock-screen metadata is auxiliary. A canary bridge failure here
          // must not take down playback or the reader during a track change.
          console.warn('Bible audio lock-screen metadata update failed', error);
        }
      }
    });
    const initialStatus = this.callNative('currentStatus', currentPlaylist => currentPlaylist.currentStatus);
    if (initialStatus) {
      this.publish(this.status(initialStatus));
    }
  }

  unmount() {
    const playlist = this.playlist;
    if (!playlist) return;
    // Invalidate first: later effect cleanups/timers must see an inert adapter.
    this.playlist = null;
    try {
      this.subscription?.remove();
    } catch {
      // The event emitter can already be gone when native cleanup races React.
    }
    this.subscription = undefined;
    this.tracks = [];
    this.lastMetadataTrack = undefined;
    this.snapshot = idleStatus();
    try {
      // destroy unregisters it from Expo Audio; release frees the shared object.
      playlist.destroy();
    } catch (cause) {
      if (!isReleasedError(cause)) {
        console.warn('Bible audio playlist cleanup failed', cause);
      }
    } finally {
      try {
        playlist.release();
      } catch (cause) {
        if (!isReleasedError(cause)) {
          console.warn('Bible audio playlist release failed', cause);
        }
      }
    }
  }

  getStatus = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(status: BibleAudioStatus) {
    this.snapshot = status;
    this.listeners.forEach(listener => listener());
  }

  private invalidateReleasedPlaylist() {
    this.playlist = null;
    try {
      this.subscription?.remove();
    } catch {
      // The emitter may already have been released with the playlist.
    }
    this.subscription = undefined;
    this.tracks = [];
    this.snapshot = idleStatus();
  }

  private callNative<T>(operation: string, call: (playlist: AudioPlaylist) => T): T | undefined {
    if (!this.playlist) return undefined;
    try {
      return call(this.playlist);
    } catch (cause) {
      if (isReleasedError(cause)) {
        // A native release can race a queued JS callback. Make the facade
        // inert so later effects/timers cannot repeatedly call the dead handle.
        this.invalidateReleasedPlaylist();
        return undefined;
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Bible audio playlist ${operation} failed: ${message}`, { cause });
    }
  }

  get currentStatus(): BibleAudioStatus {
    const status = this.callNative('currentStatus', playlist => playlist.currentStatus);
    return status ? this.status(status) : this.snapshot;
  }

  status(status: AudioPlaylistStatus): BibleAudioStatus {
    const track = this.tracks[status.currentIndex];
    const source = track?.source;
    return {
      ...status,
      activeChapter: track,
      activeSourceUrl: source && typeof source === 'object' ? source.uri : undefined,
    };
  }

  replace(source: AudioSource | null) {
    this.callNative('replace', playlist => {
      this.tracks = [];
      this.lastMetadataTrack = undefined;
      playlist.clear();
      if (source) {
        this.tracks.push(undefined);
        playlist.add(source);
      }
    });
  }

  setCurrentChapter(item: BibleAudioQueueItem) {
    this.callNative('set current chapter', playlist => {
      this.tracks[playlist.currentIndex] = item;
    });
  }

  // Only append to the tail; never remove media while ExoPlayer is changing
  // tracks. Removing a queued item can invalidate currentIndex in the native
  // playlist and was the source of the Android transition crash.
  setQueue(items: BibleAudioQueueItem[]) {
    this.callNative('set queue', playlist => {
      const index = playlist.currentIndex;
      if (!playlist.trackCount) return;
      const tail = this.tracks.slice(index + 1);
      const sharedLength = Math.min(tail.length, items.length);
      for (let itemIndex = 0; itemIndex < sharedLength; itemIndex += 1) {
        if (JSON.stringify(tail[itemIndex]) !== JSON.stringify(items[itemIndex])) {
          // A source/reader change must go through replace(), which resets the
          // current track safely. Do not mutate an active native queue here.
          return;
        }
      }
      for (const item of items.slice(tail.length)) {
        this.tracks.push(item);
        playlist.add(item.source);
      }
    });
  }

  play() { this.callNative('play', playlist => playlist.play()); }
  pause() { this.callNative('pause', playlist => playlist.pause()); }
  async seekTo(seconds: number) {
    try {
      await this.callNative('seekTo', playlist => playlist.seekTo(seconds));
    } catch (cause) {
      if (isReleasedError(cause)) {
        this.invalidateReleasedPlaylist();
        return;
      }
      const message = cause instanceof Error ? cause.message : String(cause);
      throw new Error(`Bible audio playlist seekTo failed: ${message}`, { cause });
    }
  }
  setActiveForLockScreen(...args: Parameters<AudioPlayer['setActiveForLockScreen']>) {
    this.callNative('setActiveForLockScreen', playlist => playlist.setActiveForLockScreen(...args));
  }
  clearLockScreenControls() {
    this.callNative('clearLockScreenControls', playlist => playlist.clearLockScreenControls());
  }

  private lastMetadataTrack?: BibleAudioQueueItem;
  updateMetadata() {
    this.callNative('updateLockScreenMetadata', playlist => {
      const track = this.tracks[playlist.currentIndex];
      if (track) {
        playlist.updateLockScreenMetadata(track.metadata);
        this.lastMetadataTrack = track;
      }
    });
  }
}
