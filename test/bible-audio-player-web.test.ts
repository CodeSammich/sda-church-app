/** @jest-environment jsdom */

import { act, renderHook } from '@testing-library/react-native';

import {
  useBibleAudioPlayer,
  useBibleAudioPlayerStatus,
} from '@/services/BibleAudioPlayer.web';

describe('Bible audio web player', () => {
  const setActionHandler = jest.fn();

  beforeEach(() => {
    jest.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
    jest.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
    jest
      .spyOn(HTMLMediaElement.prototype, 'play')
      .mockImplementation(() => Promise.resolve());
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      value: {
        metadata: null,
        playbackState: 'none',
        setActionHandler,
        setPositionState: jest.fn(),
      },
    });
    (globalThis as any).MediaMetadata = class {
      constructor(readonly metadata: MediaMetadataInit) {}
    };
  });

  afterEach(() => jest.useRealTimers());

  it('keeps document-attached audio elements and loads only on demand', () => {
    const { result, unmount } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = document.querySelector<HTMLAudioElement>(
      'audio[data-bible-audio-player]',
    );

    expect(media).not.toBeNull();
    expect(media?.hasAttribute('src')).toBe(false);
    expect(result.current.status.playing).toBe(false);

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/chapter.mp3' });
      result.current.player.setActiveForLockScreen(true, {
        title: 'Genesis 1 · BSB (HelloAO)',
        artist: 'Souer',
      });
      result.current.player.play();
    });

    expect(media?.src).toBe('https://audio.example/chapter.mp3');
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(setActionHandler).toHaveBeenCalledWith('play', expect.any(Function));
    expect(setActionHandler).toHaveBeenCalledWith('pause', expect.any(Function));
    expect(setActionHandler).toHaveBeenCalledWith(
      'nexttrack',
      expect.any(Function),
    );
    expect(setActionHandler).toHaveBeenCalledWith(
      'previoustrack',
      expect.any(Function),
    );
    expect((navigator.mediaSession.metadata as any).metadata.title).toBe(
      'Genesis 1 · BSB (HelloAO)',
    );
    expect(media?.title).toBe('Genesis 1 · BSB (HelloAO)');

    // iOS may replace the custom metadata while promoting the remote source
    // into Now Playing. Readiness and playback events must restore it.
    navigator.mediaSession.metadata = null;
    act(() => media?.dispatchEvent(new Event('loadedmetadata')));
    expect((navigator.mediaSession.metadata as any).metadata.title).toBe(
      'Genesis 1 · BSB (HelloAO)',
    );
    navigator.mediaSession.metadata = null;
    act(() => media?.dispatchEvent(new Event('playing')));
    expect((navigator.mediaSession.metadata as any).metadata.title).toBe(
      'Genesis 1 · BSB (HelloAO)',
    );

    unmount();
    expect(document.querySelector('audio[data-bible-audio-player]')).toBeNull();
  });

  it('maps headset next/previous gestures to chapter navigation', () => {
    const onNext = jest.fn();
    const onPrevious = jest.fn();
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/1.mp3' });
      result.current.player.setRemoteChapterHandlers({ onNext, onPrevious });
      result.current.player.setActiveForLockScreen(true, {
        title: 'Genesis 1 · BSB (HelloAO)',
      });
      result.current.player.setQueue([
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 2,
          source: 'https://audio.example/2.mp3',
          metadata: { title: 'Genesis 2 · BSB (HelloAO)' },
        },
      ]);
    });

    const getHandler = (action: MediaSessionAction) =>
      [...setActionHandler.mock.calls]
        .reverse()
        .find(([registeredAction]) => registeredAction === action)?.[1] as
        | (() => void)
        | undefined;

    act(() => getHandler('nexttrack')?.());
    expect(result.current.status.activeChapter).toEqual({
      translationId: 'BSB',
      bookId: 'GEN',
      chapter: 2,
    });
    expect(onNext).not.toHaveBeenCalled();

    act(() => getHandler('previoustrack')?.());
    expect(onPrevious).toHaveBeenCalledWith({
      translationId: 'BSB',
      bookId: 'GEN',
      chapter: 2,
    });

    // At the end of the prepared queue, let the reader navigate normally.
    act(() => getHandler('nexttrack')?.());
    expect(onNext).toHaveBeenCalledWith({
      translationId: 'BSB',
      bookId: 'GEN',
      chapter: 2,
    });
  });

  it('plays multiple queued chapters and preloads only the immediate next one', () => {
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = Array.from(
      document.querySelectorAll<HTMLAudioElement>(
        'audio[data-bible-audio-player]',
      ),
    );

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/1.mp3' });
      result.current.player.setActiveForLockScreen(true, {
        title: 'Genesis 1 · BSB (HelloAO)',
      });
      result.current.player.setQueue([
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 2,
          source: 'https://audio.example/2.mp3',
          metadata: { title: 'Genesis 2 · BSB (HelloAO)' },
        },
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 3,
          source: 'https://audio.example/3.mp3',
          metadata: { title: 'Genesis 3 · BSB (HelloAO)' },
        },
      ]);
      result.current.player.play();
    });

    expect(media[0].src).toBe('https://audio.example/1.mp3');
    expect(media[1].src).toBe('https://audio.example/2.mp3');

    act(() => media[0].dispatchEvent(new Event('ended')));
    expect(result.current.status.activeChapter).toEqual({
      translationId: 'BSB',
      bookId: 'GEN',
      chapter: 2,
    });
    expect((navigator.mediaSession.metadata as any).metadata.title).toBe(
      'Genesis 2 · BSB (HelloAO)',
    );
    expect(media[0].src).toBe('https://audio.example/3.mp3');

    act(() => media[1].dispatchEvent(new Event('ended')));
    expect(result.current.status.activeChapter).toEqual({
      translationId: 'BSB',
      bookId: 'GEN',
      chapter: 3,
    });
    expect((navigator.mediaSession.metadata as any).metadata.title).toBe(
      'Genesis 3 · BSB (HelloAO)',
    );
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(3);
  });

  it('falls back when Android rejects the standby chapter preload', () => {
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = Array.from(
      document.querySelectorAll<HTMLAudioElement>(
        'audio[data-bible-audio-player]',
      ),
    );

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/1.mp3' });
      result.current.player.setQueue([
        {
          translationId: 'cmn_cuv',
          bookId: 'GEN',
          chapter: 2,
          source: 'https://primary.example/2.mp3',
          metadata: { title: 'Genesis 2 · CUV (Primary)' },
          fallbacks: [
            {
              source: 'https://fallback.example/2.mp3',
              metadata: { title: 'Genesis 2 · CUV (Fallback)' },
            },
          ],
        },
      ]);
    });

    expect(media[1].src).toBe('https://primary.example/2.mp3');
    act(() => media[1].dispatchEvent(new Event('error')));
    expect(media[1].src).toBe('https://fallback.example/2.mp3');

    act(() => media[0].dispatchEvent(new Event('ended')));
    expect(result.current.status.activeChapter).toEqual({
      translationId: 'cmn_cuv',
      bookId: 'GEN',
      chapter: 2,
    });
    expect((navigator.mediaSession.metadata as any).metadata.title).toBe(
      'Genesis 2 · CUV (Fallback)',
    );
  });

  it('reloads an unready promoted chapter when Play is pressed again', () => {
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = Array.from(
      document.querySelectorAll<HTMLAudioElement>(
        'audio[data-bible-audio-player]',
      ),
    );

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/1.mp3' });
      result.current.player.setQueue([
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 2,
          source: 'https://audio.example/2.mp3',
          metadata: { title: 'Genesis 2 · BSB (HelloAO)' },
        },
      ]);
      media[0].dispatchEvent(new Event('ended'));
    });

    (HTMLMediaElement.prototype.load as jest.Mock).mockClear();
    act(() => result.current.player.play());

    expect(media[1].src).toBe('https://audio.example/2.mp3');
    expect(HTMLMediaElement.prototype.load).toHaveBeenCalledTimes(1);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
  });

  it('keeps the user-authorized media element across Android chapters', () => {
    jest
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (Linux; Android 16; Pixel 9a) Chrome/140');
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = Array.from(
      document.querySelectorAll<HTMLAudioElement>(
        'audio[data-bible-audio-player]',
      ),
    );

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/1.mp3' });
      result.current.player.setQueue([
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 2,
          source: 'https://audio.example/2.mp3',
          metadata: { title: 'Genesis 2 · BSB (HelloAO)' },
        },
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 3,
          source: 'https://audio.example/3.mp3',
          metadata: { title: 'Genesis 3 · BSB (HelloAO)' },
        },
      ]);
      media[0].dispatchEvent(new Event('ended'));
    });

    expect(media[0].src).toBe('https://audio.example/2.mp3');
    // Do not cancel the partially downloaded chapter 2 standby request until
    // the active element has enough data to continue.
    expect(media[1].src).toBe('https://audio.example/2.mp3');
    Object.defineProperty(media[0], 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_FUTURE_DATA,
    });
    act(() => media[0].dispatchEvent(new Event('canplay')));
    expect(media[1].src).toBe('https://audio.example/3.mp3');
    expect(result.current.status.activeChapter).toEqual({
      translationId: 'BSB',
      bookId: 'GEN',
      chapter: 2,
    });
  });

  it('resumes an unexpected Android pause immediately after chapter transition', async () => {
    jest
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (Linux; Android 16; Pixel 9a) Chrome/140');
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = Array.from(
      document.querySelectorAll<HTMLAudioElement>(
        'audio[data-bible-audio-player]',
      ),
    );

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/1.mp3' });
      result.current.player.setQueue([
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 2,
          source: 'https://audio.example/2.mp3',
          metadata: { title: 'Genesis 2 · BSB (HelloAO)' },
        },
      ]);
      result.current.player.play();
      media[0].dispatchEvent(new Event('ended'));
      media[0].dispatchEvent(new Event('playing'));
    });
    (HTMLMediaElement.prototype.play as jest.Mock).mockClear();
    Object.defineProperty(media[0], 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_FUTURE_DATA,
    });

    await act(async () => {
      media[0].dispatchEvent(new Event('pause'));
      await Promise.resolve();
    });

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    expect(result.current.status.interruptionCount).toBe(1);
  });

  it('does not resume a user-requested Android pause', async () => {
    jest
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (Linux; Android 16; Pixel 9a) Chrome/140');
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = Array.from(
      document.querySelectorAll<HTMLAudioElement>(
        'audio[data-bible-audio-player]',
      ),
    );
    Object.defineProperty(media[0], 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_FUTURE_DATA,
    });

    act(() => {
      result.current.player.replace({ uri: 'https://audio.example/1.mp3' });
      result.current.player.setQueue([
        {
          translationId: 'BSB',
          bookId: 'GEN',
          chapter: 2,
          source: 'https://audio.example/2.mp3',
          metadata: { title: 'Genesis 2 · BSB (HelloAO)' },
        },
      ]);
      result.current.player.play();
      media[0].dispatchEvent(new Event('ended'));
      result.current.player.pause();
    });
    (HTMLMediaElement.prototype.play as jest.Mock).mockClear();

    await act(async () => {
      media[0].dispatchEvent(new Event('pause'));
      await Promise.resolve();
    });

    expect(HTMLMediaElement.prototype.play).not.toHaveBeenCalled();
    expect(result.current.status.interruptionCount).toBe(0);
  });

  it('keeps retrying while Android playback is desired and remains paused', async () => {
    jest.useFakeTimers();
    jest
      .spyOn(navigator, 'userAgent', 'get')
      .mockReturnValue('Mozilla/5.0 (Linux; Android 16; Pixel 9a) Chrome/140');
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = document.querySelector<HTMLAudioElement>(
      'audio[data-bible-audio-player]',
    )!;
    Object.defineProperty(media, 'readyState', {
      configurable: true,
      value: HTMLMediaElement.HAVE_FUTURE_DATA,
    });

    act(() => result.current.player.play());
    (HTMLMediaElement.prototype.play as jest.Mock).mockClear();
    await act(async () => jest.advanceTimersByTimeAsync(2_000));

    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(1);
    act(() => result.current.player.pause());
  });

  it('never allows the standby element to become a second audible player', () => {
    const { result } = renderHook(() => {
      const player = useBibleAudioPlayer();
      return { player, status: useBibleAudioPlayerStatus(player) };
    });
    const media = Array.from(
      document.querySelectorAll<HTMLAudioElement>(
        'audio[data-bible-audio-player]',
      ),
    );
    const activePause = jest.spyOn(media[0], 'pause');
    const standbyPause = jest.spyOn(media[1], 'pause');

    act(() => result.current.player.play());
    expect(standbyPause).toHaveBeenCalledTimes(1);
    activePause.mockClear();
    standbyPause.mockClear();

    act(() => media[1].dispatchEvent(new Event('play')));
    expect(standbyPause).toHaveBeenCalledTimes(1);

    activePause.mockClear();
    standbyPause.mockClear();
    act(() => result.current.player.pause());
    expect(activePause).toHaveBeenCalled();
    expect(standbyPause).toHaveBeenCalled();
  });
});
