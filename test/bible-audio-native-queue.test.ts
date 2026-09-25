import type { AudioPlaylist, AudioPlaylistStatus, AudioSource } from 'expo-audio';
import { BibleAudioNativeQueue } from '@/services/BibleAudioNativeQueue';
import type { BibleAudioQueueItem } from '@/services/BibleAudioPlayer.types';

const chapter = (number: number): BibleAudioQueueItem => ({
  bookId: 'GEN', chapter: number, translationId: 'BSB',
  source: { uri: `https://example.com/${number}.mp3` },
  metadata: { title: `Genesis ${number}` },
});

function setup() {
  const sources: AudioSource[] = [];
  const status = {
    currentIndex: 0, playing: false, currentTime: 0, duration: 120,
    isLoaded: true, isBuffering: false, didJustFinish: false,
  } as AudioPlaylistStatus;
  const playlist = {
    addListener: jest.fn(() => ({ remove: jest.fn() })),
    destroy: jest.fn(), release: jest.fn(),
    get currentIndex() { return status.currentIndex; },
    get trackCount() { return sources.length; },
    get currentStatus() { return status; },
    clear: jest.fn(() => { sources.length = 0; status.currentIndex = 0; }),
    add: jest.fn((source: AudioSource) => sources.push(source)),
    remove: jest.fn((index: number) => sources.splice(index, 1)),
    play: jest.fn(), pause: jest.fn(), updateLockScreenMetadata: jest.fn(),
  };
  const queue = new BibleAudioNativeQueue(() => playlist as unknown as AudioPlaylist);
  queue.mount();
  queue.replace(chapter(1).source);
  queue.setCurrentChapter(chapter(1));
  queue.setQueue([chapter(2), chapter(3)]);
  return { queue, playlist, status, sources };
}

it('supplies future chapters to native playback before any text or React transition', () => {
  const { queue, status, sources, playlist } = setup();
  expect(sources).toEqual([1, 2, 3].map(n => chapter(n).source));
  // Simulate native advancement with no render or chapter-text response.
  status.currentIndex = 2;
  status.playing = true;
  expect(queue.currentStatus).toMatchObject({
    playing: true, activeChapter: { chapter: 3 },
    activeSourceUrl: 'https://example.com/3.mp3',
  });
  expect(playlist.play).not.toHaveBeenCalled();
});

it('only appends a newly discovered chapter after an interruption', () => {
  const { queue, playlist, status, sources } = setup();
  status.currentIndex = 1;
  status.currentTime = 45;
  queue.setQueue([chapter(3), chapter(4)]);
  expect(sources).toEqual([1, 2, 3, 4].map(n => chapter(n).source));
  expect(queue.currentStatus).toMatchObject({ playing: false, currentTime: 45 });
  expect(playlist.clear).toHaveBeenCalledTimes(1);
  expect(playlist.remove).not.toHaveBeenCalled();
  expect(playlist.play).not.toHaveBeenCalled();
  expect(playlist.pause).not.toHaveBeenCalled();
});

it('does not reload an unchanged tail on every status update', () => {
  const { queue, playlist } = setup();
  queue.setQueue([chapter(2), chapter(3)]);
  expect(playlist.add).toHaveBeenCalledTimes(3);
  expect(playlist.remove).not.toHaveBeenCalled();
});

it('does not replace a mismatched active tail during a transition', () => {
  const { queue, playlist, sources, status } = setup();
  status.currentIndex = 1;
  queue.setQueue([chapter(9)]);
  expect(sources).toEqual([1, 2, 3].map(n => chapter(n).source));
  expect(playlist.add).toHaveBeenCalledTimes(3);
  expect(playlist.remove).not.toHaveBeenCalled();
});

it('does not remove upcoming tracks when a shorter queue is requested', () => {
  const { queue, playlist, status, sources } = setup();
  status.currentIndex = 1;
  status.playing = true;
  queue.setQueue([]);
  expect(sources).toEqual([1, 2, 3].map(n => chapter(n).source));
  expect(queue.currentStatus.playing).toBe(true);
  expect(playlist.remove).not.toHaveBeenCalled();
  expect(playlist.pause).not.toHaveBeenCalled();
});

it('identifies the first chapter when native Previous returns to it', () => {
  const { queue, status, playlist } = setup();
  status.currentIndex = 1;
  queue.updateMetadata();
  expect(playlist.updateLockScreenMetadata).toHaveBeenLastCalledWith(chapter(2).metadata);
  status.currentIndex = 0;
  expect(queue.currentStatus.activeChapter).toMatchObject({ chapter: 1 });
  queue.updateMetadata();
  expect(playlist.updateLockScreenMetadata).toHaveBeenLastCalledWith(chapter(1).metadata);
});

it('discards the previous queue and chapter identity when the user selects a new recording', () => {
  const { queue, sources } = setup();
  queue.replace(chapter(8).source);
  expect(queue.currentStatus.activeChapter).toBeUndefined();
  queue.setCurrentChapter(chapter(8));
  queue.setQueue([chapter(9)]);
  expect(sources).toEqual([8, 9].map(n => chapter(n).source));
  expect(queue.currentStatus.activeChapter).toMatchObject({ chapter: 8 });
});

it('preserves lock-screen bridge errors with their operation', () => {
  const { queue, playlist } = setup();
  Object.assign(playlist, {
    setActiveForLockScreen() { throw new Error('Native object conversion failed'); },
  });
  expect(() => queue.setActiveForLockScreen(true, chapter(1).metadata))
    .toThrow('playlist setActiveForLockScreen failed: Native object conversion failed');
});

function releasablePlaylist() {
  let released = false;
  let listener: ((status: AudioPlaylistStatus) => void) | undefined;
  const removeListener = jest.fn();
  const status = {
    currentIndex: 0, currentTime: 0, duration: 0, playing: false,
    isLoaded: false, isBuffering: false, didJustFinish: false,
  } as AudioPlaylistStatus;
  const native = {
    currentStatus: status,
    addListener: jest.fn((_event: string, callback: typeof listener) => {
      listener = callback;
      return { remove: removeListener };
    }),
    destroy: jest.fn(),
    release: jest.fn(() => { released = true; }),
    play: jest.fn(), pause: jest.fn(), clear: jest.fn(),
  };
  // Unlike a plain Jest mock, model Expo's invalid native handle after release.
  const playlist = new Proxy(native, {
    get(target, key) {
      if (released) throw new Error('Cannot use shared object that was already released');
      return Reflect.get(target, key);
    },
    set(target, key, value) {
      if (released) throw new Error('Cannot use shared object that was already released');
      return Reflect.set(target, key, value);
    },
  }) as unknown as AudioPlaylist;
  return { playlist, native, removeListener, emit: (s: AudioPlaylistStatus) => listener?.(s) };
}

it('makes delayed callbacks and reader cleanup inert before releasing the native object', async () => {
  const { playlist, native, removeListener, emit } = releasablePlaylist();
  const queue = new BibleAudioNativeQueue(() => playlist);
  queue.mount();
  queue.unmount();
  expect(removeListener).toHaveBeenCalledTimes(1);
  expect(native.destroy).toHaveBeenCalledTimes(1);
  expect(native.release).toHaveBeenCalledTimes(1);

  expect(() => {
    queue.pause();
    queue.play();
    queue.replace(null);
    queue.setQueue([]);
    queue.setCurrentChapter(chapter(1));
    queue.setActiveForLockScreen(true);
    queue.clearLockScreenControls();
    queue.updateMetadata();
    queue.unmount();
    // A status callback already queued before listener removal must be ignored.
    emit({ ...native.currentStatus, playing: true });
  }).not.toThrow();
  await expect(queue.seekTo(30)).resolves.toBeUndefined();
  expect(queue.currentStatus).toMatchObject({ playing: false, isLoaded: false });
  expect(native.play).not.toHaveBeenCalled();
  expect(native.release).toHaveBeenCalledTimes(1);
});

it('does not crash if native cleanup already released the playlist', () => {
  const { playlist, native } = releasablePlaylist();
  const queue = new BibleAudioNativeQueue(() => playlist);
  queue.mount();
  native.release();
  expect(() => queue.unmount()).not.toThrow();
});

it('absorbs Android cast errors that wrap a released shared object', () => {
  const { playlist, native } = releasablePlaylist();
  const queue = new BibleAudioNativeQueue(() => playlist);
  queue.mount();
  Object.defineProperty(native, 'currentStatus', {
    configurable: true,
    get() {
      throw new Error(
        'The 1st argument cannot be cast to type class expo.modules.audio.AudioPlaylist (received class java.lang.Integer) -> Caused by: cannot use shared object that was already released',
      );
    },
  });

  expect(() => queue.currentStatus).not.toThrow();
  expect(queue.currentStatus).toMatchObject({ playing: false, isLoaded: false });
  expect(() => queue.play()).not.toThrow();
  expect(native.play).not.toHaveBeenCalled();
});

it('creates a fresh playlist after an effect cleanup/setup replay', () => {
  const first = releasablePlaylist();
  const second = releasablePlaylist();
  const factory = jest.fn()
    .mockReturnValueOnce(first.playlist)
    .mockReturnValueOnce(second.playlist);
  const queue = new BibleAudioNativeQueue(factory);
  // Render-time construction must not allocate a native object.
  expect(factory).not.toHaveBeenCalled();
  queue.mount();
  queue.unmount();
  queue.mount();
  queue.play();
  expect(first.native.release).toHaveBeenCalledTimes(1);
  expect(first.native.play).not.toHaveBeenCalled();
  expect(second.native.play).toHaveBeenCalledTimes(1);
  first.emit({ ...first.native.currentStatus, playing: true });
  expect(queue.getStatus().playing).toBe(false);
  queue.unmount();
  expect(second.native.release).toHaveBeenCalledTimes(1);
});
