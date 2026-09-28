import type { AudioPlayer, AudioPlaylist, AudioPlaylistStatus, AudioSource } from 'expo-audio';
import type {
  BibleAudioQueueItem,
  BibleAudioSourceError,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

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

const destroyPlaylist = (playlist: AudioPlaylist) => {
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
};

/** Owns the native lifetime; stale reader callbacks never reach a released object. */
export class BibleAudioNativeQueue {
  private playlist: AudioPlaylist | null = null;
  private subscription?: { remove(): void };
  private tracks: Array<BibleAudioQueueItem | undefined> = [];
  private snapshot = idleStatus();
  private listeners = new Set<() => void>();
  private sourceErrorListeners = new Set<(event: BibleAudioSourceError) => void>();
  // Failed playlists replaced by a fresh one. The newest may still own the
  // lock-screen session and its foreground service until the fresh playlist
  // takes over, and destroying the owner would stop that service. They are
  // destroyed once the fresh playlist is playing, or when the reader closes.
  private retiredPlaylists: AudioPlaylist[] = [];

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
      if (status.playing && !status.isBuffering && this.retiredPlaylists.length) {
        // A playing playlist has taken over the lock screen by now.
        this.destroyRetiredPlaylists();
      }
      const { error } = status as AudioPlaylistStatus & { error?: unknown };
      if (error) {
        // expo-audio puts the error in this one event only; the next status
        // clears it. Deliver it now rather than through React state.
        const event = {
          error,
          currentTime: status.currentTime,
          sourceUrl: this.status(status).activeSourceUrl,
          chapter: track,
        };
        this.sourceErrorListeners.forEach(listener => listener(event));
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
    this.destroyRetiredPlaylists();
    destroyPlaylist(playlist);
  }

  getStatus = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  addSourceErrorListener(listener: (event: BibleAudioSourceError) => void) {
    this.sourceErrorListeners.add(listener);
    return { remove: () => { this.sourceErrorListeners.delete(listener); } };
  }

  private destroyRetiredPlaylists() {
    const retired = this.retiredPlaylists;
    this.retiredPlaylists = [];
    retired.forEach(destroyPlaylist);
  }

  // ExoPlayer stops in its idle state after a playback error, and expo-audio
  // only calls prepare() when it creates a playlist, so a source added to it
  // never loads. A healthy playlist is never idle: an empty one has ended.
  // Reading the state directly also covers an error whose event is still
  // queued for JavaScript.
  private hasFailed() {
    const status = this.callNative('currentStatus', playlist => playlist.currentStatus);
    return !!status && !status.isLoaded && !status.isBuffering;
  }

  private retirePlaylist() {
    const playlist = this.playlist;
    if (!playlist) return;
    this.playlist = null;
    try {
      this.subscription?.remove();
    } catch {
      // The emitter may already have been released with the playlist.
    }
    this.subscription = undefined;
    // One of the two newest failed playlists may still own the lock screen.
    // An older one handed it over while two newer playlists loaded and failed.
    this.retiredPlaylists.push(playlist);
    while (this.retiredPlaylists.length > 2) {
      destroyPlaylist(this.retiredPlaylists.shift()!);
    }
  }

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
    if (this.playlist && this.hasFailed()) {
      // Only a failed player is recreated; a healthy one keeps its native
      // object, lock-screen session, and buffered state. The failed one is
      // retired, not destroyed, so the foreground service keeps running.
      this.retirePlaylist();
      this.mount();
    }
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
    // A retired playlist can still own the lock-screen session.
    this.destroyRetiredPlaylists();
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
