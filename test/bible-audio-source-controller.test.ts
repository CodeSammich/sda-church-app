import type { AudioSource } from 'expo-audio';
import {
  BibleAudioSourceController,
  type AudioSourceTarget,
  type BibleAudioSourceHost,
} from '@/services/BibleAudioSourceController';
import type {
  BibleAudioChapterIdentity,
  BibleAudioQueueItem,
  BibleAudioStatus,
} from '@/services/BibleAudioPlayer.types';

const JOHN_3: BibleAudioChapterIdentity = { bookId: 'JHN', chapter: 3, translationId: 'cmn_cuv' };
const JOHN_4: BibleAudioChapterIdentity = { bookId: 'JHN', chapter: 4, translationId: 'cmn_cuv' };
const HOSTS = ['https://church.example', 'https://archive.example', 'https://ministry.example'];

const urlsFor = (chapter: BibleAudioChapterIdentity) =>
  HOSTS.map((host) => `${host}/${chapter.bookId}-${chapter.chapter}.mp3`);
const targetFor = (chapter: BibleAudioChapterIdentity): AudioSourceTarget => ({
  chapter,
  sources: urlsFor(chapter).map((uri) => ({ source: { uri }, metadata: { title: uri } })),
});

/**
 * A fake player and Bible screen. The player behaves like expo-audio as seen
 * from JavaScript: a new source starts buffering, the listener sees
 * `playing` once it is audible, and errors arrive as separate events.
 */
function setup({ platform = 'android' } = {}) {
  let status: BibleAudioStatus = {
    currentTime: 0, duration: 0, playing: false, isBuffering: false,
    isLoaded: false, didJustFinish: false,
  };
  const player = {
    get currentStatus() { return status; },
    replace: jest.fn((source: AudioSource) => {
      const uri = typeof source === 'object' && source ? source.uri : undefined;
      status = {
        ...status, currentTime: 0, duration: 0, playing: false,
        isBuffering: true, isLoaded: false, activeSourceUrl: uri,
      };
    }),
    play: jest.fn(),
    seekTo: jest.fn(async (seconds: number) => { status = { ...status, currentTime: seconds }; }),
  };
  let readerTarget = targetFor(JOHN_3);
  let positionMillis = 0;
  const host: BibleAudioSourceHost = {
    platform,
    player,
    listening: { current: false },
    pendingAutoplay: { current: false },
    loadedUrl: { current: null },
    sourceReady: { current: false },
    getReaderTarget: () => readerTarget,
    getPositionMillis: () => positionMillis,
    // The Android playlist then reports this chapter as its current track.
    initializePlayback: jest.fn((target: AudioSourceTarget) => {
      status = { ...status, activeChapter: target.chapter };
    }),
    setLoading: jest.fn(),
    cancelSeek: jest.fn(),
    scheduleAutoplayRetry: jest.fn(),
    clearAutoplayRetry: jest.fn(),
    clearRecoveryTimeout: jest.fn(),
    releaseFocus: jest.fn(),
  };
  const controller = new BibleAudioSourceController(host);

  const loads = () => player.replace.mock.calls.map(([source]) => (source as { uri: string }).uri);
  const lastLoad = () => loads().at(-1);
  /** The loaded source becomes audible, and the screen passes on the status. */
  const startPlaying = (atSeconds = 0) => {
    status = { ...status, playing: true, isBuffering: false, isLoaded: true, duration: 300, currentTime: atSeconds };
    controller.onStatus(status);
  };
  /** The player reports an error for the loaded source, and goes idle. */
  const fail = (overrides: { chapter?: BibleAudioQueueItem; sourceUrl?: string } = {}) => {
    const sourceUrl = overrides.sourceUrl ?? status.activeSourceUrl;
    status = { ...status, playing: false, isBuffering: false, isLoaded: false };
    controller.handleError({
      error: { message: 'Source error', code: 2001 },
      currentTime: status.currentTime,
      sourceUrl,
      chapter: overrides.chapter,
    });
  };
  /** Pausing, as the Bible screen's Play/Pause button does. */
  const pause = () => {
    controller.cancel();
    host.listening.current = false;
    host.pendingAutoplay.current = false;
  };

  return {
    controller, host, player, loads, lastLoad, startPlaying, fail, pause,
    setStatus: (next: Partial<BibleAudioStatus>) => { status = { ...status, ...next }; },
    setReaderTarget: (target: AudioSourceTarget) => { readerTarget = target; },
    setPositionMillis: (millis: number) => { positionMillis = millis; },
  };
}

const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

const [CHURCH, ARCHIVE, MINISTRY] = urlsFor(JOHN_3);

describe('Bible audio source failover', () => {
  it('skips a host that fails outright at once, without waiting for a timeout', async () => {
    const { controller, loads, fail } = setup();
    await controller.start();
    expect(loads()).toEqual([CHURCH]);

    fail();

    expect(loads()).toEqual([CHURCH, ARCHIVE]);
  });

  it('gives a slow host 15, 30, then 45 seconds, with 5 and 20 second pauses between passes', async () => {
    const { controller, loads } = setup();
    await controller.start();

    jest.advanceTimersByTime(14_999);
    expect(loads()).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(loads()).toEqual([CHURCH, ARCHIVE]);
    jest.advanceTimersByTime(15_000);
    expect(loads()).toEqual([CHURCH, ARCHIVE, MINISTRY]);

    // The last host of pass 1 times out; pass 2 starts after 5 seconds.
    jest.advanceTimersByTime(15_000 + 4_999);
    expect(loads()).toHaveLength(3);
    jest.advanceTimersByTime(1);
    expect(loads()).toEqual([CHURCH, ARCHIVE, MINISTRY, CHURCH]);

    // Pass 2 gives each host 30 seconds, then waits 20 before pass 3.
    jest.advanceTimersByTime(30_000 * 3 + 19_999);
    expect(loads()).toHaveLength(6);
    jest.advanceTimersByTime(1);
    expect(loads()).toHaveLength(7);
  });

  it('keeps a slow host loading from the third pass on, so a crawling connection can finish', async () => {
    const { controller, loads } = setup();
    await controller.start();
    // Passes 1 and 2 time out (3 × 15 s + 5 s, then 3 × 30 s + 20 s).
    jest.advanceTimersByTime(50_000 + 110_000);
    expect(loads()).toHaveLength(7);

    // The third pass's first host is slow but hasn't failed: it is kept.
    jest.advanceTimersByTime(10 * 60_000);
    expect(loads()).toHaveLength(7);
    expect(console.warn).toHaveBeenLastCalledWith(
      'Bible audio is still buffering after every source was tried; keeping the current source.',
    );
  });

  it('waits out the pass delay after the last host fails, unless the connection comes back first', async () => {
    const { controller, loads, fail } = setup();
    await controller.start();
    fail();
    fail();
    fail();
    expect(loads()).toEqual([CHURCH, ARCHIVE, MINISTRY]);

    jest.advanceTimersByTime(4_000);
    expect(loads()).toHaveLength(3);
    // The phone reconnects (or the app is reopened): retry now.
    controller.retryNow();
    expect(loads()).toEqual([CHURCH, ARCHIVE, MINISTRY, CHURCH]);
    // The waiting timer doesn't load a second time.
    jest.advanceTimersByTime(10_000);
    expect(loads()).toHaveLength(4);
  });

  it('never gives up while the listener is listening, and pausing stops the retries', async () => {
    const { controller, loads, fail, pause, host } = setup();
    await controller.start();
    // A dead zone lasting ten minutes: each load fails at once. A failed
    // player reports its error once, so each load fails exactly once.
    const end = Date.now() + 10 * 60_000;
    let failedLoads = 0;
    while (Date.now() < end) {
      if (loads().length > failedLoads) {
        failedLoads = loads().length;
        fail();
      }
      jest.advanceTimersByTime(1_000);
    }
    const passes = loads().filter((url) => url === CHURCH).length;
    // 5 s and 20 s pauses, then one pass a minute: at least 10 passes.
    expect(passes).toBeGreaterThanOrEqual(10);
    expect(host.listening.current).toBe(true);
    expect(host.releaseFocus).not.toHaveBeenCalled();

    fail();
    const before = loads().length;
    pause();
    jest.advanceTimersByTime(5 * 60_000);
    expect(loads()).toHaveLength(before);
  });

  it('reloads a host that dropped mid-chapter where it stopped, with fresh retry passes', async () => {
    const { controller, loads, fail, startPlaying, player } = setup();
    await controller.start();
    startPlaying(630);

    fail();
    await flush();

    expect(loads()).toEqual([CHURCH, CHURCH]);
    expect(player.seekTo).toHaveBeenLastCalledWith(630);

    // The reload fails before playing: the next host picks up at 630 s.
    fail();
    await flush();
    expect(loads()).toEqual([CHURCH, CHURCH, ARCHIVE]);
    expect(player.seekTo).toHaveBeenLastCalledWith(630);
  });

  it('on iOS, seeks a reloaded source only after it has loaded, then plays', async () => {
    const { controller, fail, startPlaying, player, setStatus, host } = setup({ platform: 'ios' });
    await controller.start();
    startPlaying(120);
    player.play.mockClear();

    fail();
    await flush();
    expect(player.seekTo).not.toHaveBeenCalled();
    expect(player.play).not.toHaveBeenCalled();
    expect(controller.isResumePending).toBe(true);

    setStatus({ isLoaded: true, duration: 300, isBuffering: false });
    controller.onStatus(player.currentStatus);
    await flush();

    expect(player.seekTo).toHaveBeenCalledWith(120);
    expect(player.play).toHaveBeenCalledTimes(1);
    expect(host.pendingAutoplay.current).toBe(true);
    expect(controller.isResumePending).toBe(false);
  });

  it('after a pause during a failing load, Play loads the next host instead of the dead player', async () => {
    const { controller, loads, fail, pause, player, host } = setup();
    await controller.start();
    pause();
    fail();
    expect(loads()).toEqual([CHURCH]);
    player.play.mockClear();

    await controller.start();

    expect(loads()).toEqual([CHURCH, ARCHIVE]);
    expect(host.listening.current).toBe(true);
  });

  it('resumes a playing host with play() alone after a pause', async () => {
    const { controller, loads, startPlaying, pause, player } = setup();
    await controller.start();
    startPlaying(42);
    pause();
    player.play.mockClear();

    await controller.start();

    expect(loads()).toEqual([CHURCH]);
    expect(player.play).toHaveBeenCalledTimes(1);
  });

  it('ignores a stale timer after Android moves on to the next chapter by itself', async () => {
    const { controller, loads, setStatus } = setup();
    await controller.start();
    // The playlist advanced to John 4 before John 3's host timed out.
    setStatus({ activeChapter: JOHN_4 });

    jest.advanceTimersByTime(60_000);

    expect(loads()).toEqual([CHURCH]);
  });

  it("fails over a queued chapter with that chapter's own hosts", async () => {
    const { controller, loads, fail, startPlaying, host } = setup();
    await controller.start();
    startPlaying();
    const [primary, ...fallbacks] = targetFor(JOHN_4).sources;
    const queued: BibleAudioQueueItem = { ...JOHN_4, ...primary, fallbacks };

    // The reader still shows John 3 when John 4's primary fails.
    fail({ chapter: queued, sourceUrl: urlsFor(JOHN_4)[0] });

    expect(loads().at(-1)).toBe(urlsFor(JOHN_4)[1]);
    expect(host.initializePlayback).toHaveBeenLastCalledWith(
      expect.objectContaining({ chapter: JOHN_4 }),
      expect.anything(),
    );
  });

  it('treats a load that throws like a failed host, and keeps audio focus', async () => {
    const { controller, loads, player, host } = setup();
    player.replace.mockImplementationOnce(() => { throw new Error('bridge failure'); });

    await controller.start();

    expect(loads()).toEqual([CHURCH, ARCHIVE]);
    expect(host.releaseFocus).not.toHaveBeenCalled();
    expect(host.listening.current).toBe(true);
  });

  it('keeps a slow host that starts playing during the pause between passes', async () => {
    const { controller, loads, startPlaying } = setup();
    await controller.start();
    jest.advanceTimersByTime(45_000);
    expect(loads()).toEqual([CHURCH, ARCHIVE, MINISTRY]);

    // The last host times out; during the 5 second pause it starts playing.
    jest.advanceTimersByTime(2_000);
    startPlaying(1);
    jest.advanceTimersByTime(10_000);

    expect(loads()).toEqual([CHURCH, ARCHIVE, MINISTRY]);
  });

  it('stops, and gives audio focus back, only when a chapter has no audio at all', async () => {
    const { controller, host, setReaderTarget } = setup();
    setReaderTarget({ chapter: JOHN_3, sources: [] });

    await controller.load(host.getReaderTarget(), 0);

    expect(host.listening.current).toBe(false);
    expect(host.releaseFocus).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalledWith('Bible audio unavailable: every configured host failed.');
  });

  it('forgets a failed source when the reader or host changes', async () => {
    const { controller, loads, fail, pause, host } = setup();
    await controller.start();
    pause();
    fail();
    controller.reset();
    host.loadedUrl.current = null;

    await controller.start();

    // A fresh start from the first host, not a skip past the failed one.
    expect(loads()).toEqual([CHURCH, CHURCH]);
  });
});
