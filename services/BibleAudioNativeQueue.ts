import type {
  AudioLockScreenOptions,
  AudioPlayer,
  AudioPlaylist,
  AudioPlaylistStatus,
  AudioSource,
} from 'expo-audio';
import { logForAudioE2e } from './AudioE2eLog';
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
  // Chapters inserted ahead of the current one renumber the native queue, but
  // status events sent before an insert can still be on their way, numbered
  // the old way. Each insert sends its own event too, numbered as the queue was
  // after it, partway through a run of inserts. Each status says how many
  // tracks the queue had when it was sent, and the queue only grows until it's
  // replaced, so an event is read with the inserts that left the queue longer
  // than that: frontInsertCounts holds the queue's length after each insert
  // (#543). An event without a track count falls back to pendingIndexShift:
  // until one agrees with the playlist's live index, one that doesn't is read
  // with every insert since.
  private frontInsertCounts: number[] = [];
  private pendingIndexShift = 0;
  // While lock-screen controls are on: their options, and the chapter the
  // media session was last published with. See refreshLockScreenSession.
  private lockScreen?: { options?: AudioLockScreenOptions; track?: BibleAudioQueueItem };

  constructor(private readonly createPlaylist: () => AudioPlaylist) {}

  mount() {
    if (this.playlist) return;
    const playlist = this.createPlaylist();
    this.playlist = playlist;
    this.subscription = playlist.addListener('playlistStatusUpdate', (status) => {
      // An event can already be queued when its listener is removed.
      if (this.playlist !== playlist) return;
      const index = this.eventTrackIndex(status);
      this.publish(this.status(status, index));
      this.logSource(this.snapshot.activeSourceUrl);
      const track = this.tracks[index];
      if (track && track !== this.lastMetadataTrack) {
        try {
          this.updateMetadata();
        } catch (error) {
          // Lock-screen metadata is auxiliary. A canary bridge failure here
          // must not take down playback or the reader during a track change.
          console.warn('Bible audio lock-screen metadata update failed', error);
        }
      }
      this.refreshLockScreenSession(track, status);
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
          sourceUrl: this.status(status, index).activeSourceUrl,
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
    this.forgetTracks();
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

  // The audio e2e's failure details name the host that was playing, which
  // the lock screen's title no longer does (#804).
  private loggedSourceUrl?: string;
  private logSource(url: string | undefined) {
    if (!url || url === this.loggedSourceUrl) return;
    this.loggedSourceUrl = url;
    let host = '';
    try {
      host = new URL(url).hostname;
    } catch {
      // Not a URL the e2e needs to name.
    }
    logForAudioE2e(`audio from ${host || 'the phone'}`);
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
    // The track list numbers the retired playlist's queue. The fresh one starts
    // at index 0, which in that queue is the farthest chapter queued before the
    // one playing, so its first status would name that chapter (Luke 5 while
    // John 5 failed over), and the reader would follow it there (#802).
    this.forgetTracks();
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
    this.forgetTracks();
    this.snapshot = idleStatus();
  }

  // Forgets which chapter each native track is, and the inserts still being
  // counted, for a queue that is being emptied or replaced.
  private forgetTracks() {
    this.tracks = [];
    this.pendingIndexShift = 0;
    this.frontInsertCounts = [];
    this.lastMetadataTrack = undefined;
    // The controls were published for those tracks; the next ones publish their own.
    this.lockScreen = undefined;
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

  // The track a status event is about. See pendingIndexShift.
  private eventTrackIndex(status: AudioPlaylistStatus) {
    const sentWith = (status as AudioPlaylistStatus & { trackCount?: unknown }).trackCount;
    if (this.frontInsertCounts.length && typeof sentWith === 'number') {
      const notYetCounted = this.frontInsertCounts.filter(count => count > sentWith).length;
      if (!notYetCounted) {
        // This event counts every insert, so later ones will too.
        this.frontInsertCounts = [];
        this.pendingIndexShift = 0;
      }
      return status.currentIndex + notYetCounted;
    }
    if (!this.pendingIndexShift) return status.currentIndex;
    const liveIndex = this.callNative('current index', playlist => playlist.currentIndex);
    if (liveIndex === undefined) return status.currentIndex;
    if (status.currentIndex === liveIndex) {
      // Events from before the insert have all arrived.
      this.pendingIndexShift = 0;
      return liveIndex;
    }
    return status.currentIndex + this.pendingIndexShift;
  }

  status(status: AudioPlaylistStatus, index = status.currentIndex): BibleAudioStatus {
    const track = this.tracks[index];
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
    // A new recording publishes its own lock-screen controls once it's queued
    // (initializeBibleAudioPlayback); until then there's none to refresh.
    this.lockScreen = undefined;
    this.callNative('replace', playlist => {
      this.forgetTracks();
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

  // Queue the chapters before the current one, nearest first, so the media
  // buttons' previous goes back a chapter even from the one that started
  // playing: Media3 turns it into seekToPrevious, which restarts the first track
  // (#543). Like setQueue, it only adds chapters missing at the front and never
  // removes one. Each insert goes ahead of everything, so inserting nearest
  // first leaves them in reading order.
  setPreviousQueue(items: BibleAudioQueueItem[]) {
    this.callNative('set previous queue', playlist => {
      if (!playlist.trackCount) return;
      const head = this.tracks.slice(0, playlist.currentIndex).reverse();
      const sharedLength = Math.min(head.length, items.length);
      for (let itemIndex = 0; itemIndex < sharedLength; itemIndex += 1) {
        if (JSON.stringify(head[itemIndex]) !== JSON.stringify(items[itemIndex])) {
          // A different reader or source; replace() resets the queue for those.
          return;
        }
      }
      for (const item of items.slice(head.length)) {
        // Record the insert first: its own status event can arrive during the
        // call, and must find the track list already renumbered.
        this.tracks.unshift(item);
        this.pendingIndexShift += 1;
        this.frontInsertCounts.push(playlist.trackCount + 1);
        playlist.insert(item.source, 0);
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
    const [active, , options] = args;
    this.callNative('setActiveForLockScreen', playlist => {
      playlist.setActiveForLockScreen(...args);
      this.lockScreen = active
        ? { options, track: this.tracks[playlist.currentIndex] }
        : undefined;
    });
  }
  clearLockScreenControls() {
    this.lockScreen = undefined;
    // A retired playlist can still own the lock-screen session.
    this.destroyRetiredPlaylists();
    this.callNative('clearLockScreenControls', playlist => playlist.clearLockScreenControls());
  }

  // Publishes the lock-screen controls again once the playlist has moved to
  // another chapter by itself, or by the notification's or earbuds' next or
  // previous, so the notification's progress bar starts that chapter (#804).
  // expo-audio 58's media session never hears that the track changed: it
  // wraps the player for its metadata in a Kotlin `Player.Listener by
  // listener`, which doesn't forward Media3's default methods, so only metadata
  // changes reach the session. Its playback state, which the bar is drawn
  // from, can stay as it was when playback last started or paused, and the bar
  // ran on from there into the next chapter: about three quarters along when
  // the reader said 0:50 of 8:03. Publishing again builds a new session, which
  // reads the position and the chapter's length, so it waits until the length
  // is known.
  private refreshLockScreenSession(
    track: BibleAudioQueueItem | undefined,
    status: AudioPlaylistStatus,
  ) {
    const lockScreen = this.lockScreen;
    if (!lockScreen || !track || track === lockScreen.track || !(status.duration > 0)) return;
    lockScreen.track = track;
    try {
      this.callNative('refresh lock screen', playlist =>
        playlist.setActiveForLockScreen(true, track.metadata, lockScreen.options));
    } catch (error) {
      // As with the metadata, the controls are auxiliary to playback.
      console.warn('Bible audio lock-screen refresh failed', error);
    }
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
