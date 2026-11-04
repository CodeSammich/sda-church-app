import { BIBLE_AUDIO_TIP_PULSES, BibleAudioDownloadTipMarks } from '@/components/BibleAudioDownloadTipMarks';
import { useBibleAudioDownloadTip } from '@/hooks/useBibleAudioDownloadTip';
import { resetBibleAudioDownloadsForTests } from '@/services/BibleAudioDownloads';
import {
  BIBLE_AUDIO_TIP_LONG_STALL_MS,
  BIBLE_AUDIO_TIP_REST_MS,
  BIBLE_AUDIO_TIP_STORAGE_KEY,
  BibleAudioStallWatcher,
  canShowBibleAudioTip,
  loadBibleAudioTip,
  noteBibleAudioTipShown,
  resetBibleAudioTipForTests,
  restBibleAudioTip,
  type BibleAudioPlaybackState,
} from '@/services/BibleAudioDownloadTip';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, render, renderHook } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { AccessibilityInfo, Animated, AppState } from 'react-native';
import { mockChapterFile } from './helpers/bible-audio-chapter-files';

// When Bible audio keeps stopping to load, the audio settings button points
// the listener to Listen offline (#595).
jest.mock('@/modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn(() => true) }));
jest.mock('expo-network', () => ({
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI', isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const DAY = 24 * 60 * 60 * 1000;
let player: { listening: boolean; waiting: boolean; positionMillis: number };

// The player loads for `millis`, `seconds` into the chapter, then plays on.
const stall = (watcher: BibleAudioStallWatcher, seconds: number, millis = 1_000) => {
  player.positionMillis = seconds * 1000;
  player.waiting = true;
  watcher.update();
  jest.advanceTimersByTime(millis);
  player.waiting = false;
  watcher.update();
};

beforeEach(async () => {
  jest.useFakeTimers();
  player = { listening: true, waiting: false, positionMillis: 0 };
  resetBibleAudioTipForTests();
  resetBibleAudioDownloadsForTests();
  await AsyncStorage.clear();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
});

afterEach(() => {
  jest.useRealTimers();
});

describe('The stalls that show the tip', () => {
  const watch = () => {
    const onStruggling = jest.fn();
    return { onStruggling, watcher: new BibleAudioStallWatcher(() => player, onStruggling) };
  };

  it('are 3 in one listening session', () => {
    const { onStruggling, watcher } = watch();
    stall(watcher, 30);
    stall(watcher, 95);
    expect(onStruggling).not.toHaveBeenCalled();
    stall(watcher, 140);
    expect(onStruggling).toHaveBeenCalledTimes(1);
  });

  it("don't count the usual loading at a chapter's start, or after a skip or a drag", () => {
    const { onStruggling, watcher } = watch();
    stall(watcher, 0);
    stall(watcher, 0.5);
    watcher.noteSeek();
    stall(watcher, 40);
    jest.advanceTimersByTime(2_000);
    stall(watcher, 60);
    stall(watcher, 80);
    expect(onStruggling).not.toHaveBeenCalled();
    stall(watcher, 120);
    expect(onStruggling).toHaveBeenCalledTimes(1);
  });

  it('or one longer than 5 seconds, even at the start of a chapter', () => {
    const { onStruggling, watcher } = watch();
    stall(watcher, 0, BIBLE_AUDIO_TIP_LONG_STALL_MS - 100);
    expect(onStruggling).not.toHaveBeenCalled();
    stall(watcher, 0, BIBLE_AUDIO_TIP_LONG_STALL_MS);
    expect(onStruggling).toHaveBeenCalledTimes(1);
  });

  it('start again when the listener pauses, even while the player still says it is loading', () => {
    const { onStruggling, watcher } = watch();
    stall(watcher, 30);
    stall(watcher, 60);
    player.listening = false;
    watcher.update();
    player.listening = true;
    stall(watcher, 90);
    expect(onStruggling).not.toHaveBeenCalled();

    player.waiting = true;
    watcher.update();
    // Paused while loading: the player's status needn't change.
    player.listening = false;
    jest.advanceTimersByTime(BIBLE_AUDIO_TIP_LONG_STALL_MS * 2);
    expect(onStruggling).not.toHaveBeenCalled();
  });
});

describe('The tip', () => {
  it("waits until what's saved has been read, and shows once each time the app starts", async () => {
    expect(canShowBibleAudioTip()).toBe(false);
    await loadBibleAudioTip();
    expect(canShowBibleAudioTip()).toBe(true);
    noteBibleAudioTipShown();
    expect(canShowBibleAudioTip()).toBe(false);
  });

  it('rests for 7 days after the listener opens the popup and does not download', async () => {
    const now = Date.UTC(2026, 10, 2);
    await loadBibleAudioTip();
    restBibleAudioTip(now);
    await act(async () => undefined);
    expect(await AsyncStorage.getItem(BIBLE_AUDIO_TIP_STORAGE_KEY)).toBe(String(now + BIBLE_AUDIO_TIP_REST_MS));

    // The app opens again.
    resetBibleAudioTipForTests();
    await loadBibleAudioTip();
    expect(canShowBibleAudioTip(now + 6 * DAY)).toBe(false);
    expect(canShowBibleAudioTip(now + 7 * DAY)).toBe(true);
  });

  describe('on the Bible screen', () => {
    const renderTip = async (narrator: string | null = 'cuv-mandarin') => {
      const hook = await renderHook(
        ({ popupVisible }: { popupVisible: boolean }) =>
          useBibleAudioDownloadTip(narrator, popupVisible, () => player as BibleAudioPlaybackState),
        { initialProps: { popupVisible: false } },
      );
      await act(async () => undefined);
      return hook;
    };
    const struggle = async (watcher: BibleAudioStallWatcher) =>
      act(async () => stall(watcher, 0, BIBLE_AUDIO_TIP_LONG_STALL_MS));

    it('marks the button, then shows its line in the popup, then rests', async () => {
      const { rerender, result } = await renderTip();
      expect(result.current).toMatchObject({ marksButton: false, showsLine: false });
      await struggle(result.current.watcher);
      expect(result.current).toMatchObject({ marksButton: true, showsLine: true });

      await rerender({ popupVisible: true });
      expect(result.current).toMatchObject({ marksButton: false, showsLine: true });
      await rerender({ popupVisible: false });
      expect(result.current).toMatchObject({ marksButton: false, showsLine: false });
      expect(Number(await AsyncStorage.getItem(BIBLE_AUDIO_TIP_STORAGE_KEY))).toBeGreaterThan(Date.now() + 6 * DAY);

      // Once each time the app starts.
      await struggle(result.current.watcher);
      expect(result.current.marksButton).toBe(false);
    });

    it("isn't shown where Listen offline isn't offered", async () => {
      const { result } = await renderTip(null);
      await struggle(result.current.watcher);
      expect(result.current.marksButton).toBe(false);
    });

    it('is never shown again once Bible audio is on the phone', async () => {
      mockChapterFile('document/bible-audio/souer/JHN/1.mp3');
      const { result } = await renderTip();
      expect(await AsyncStorage.getItem(BIBLE_AUDIO_TIP_STORAGE_KEY)).toBe('downloaded');
      await struggle(result.current.watcher);
      expect(result.current.marksButton).toBe(false);

      // Even after the member deletes it, when the app opens again.
      resetBibleAudioTipForTests();
      await loadBibleAudioTip();
      expect(canShowBibleAudioTip()).toBe(false);
    });
  });
});

describe("The button's marks", () => {
  beforeEach(() => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  });

  const renderMarks = (visible: boolean) =>
    render(createElement(BibleAudioDownloadTipMarks, { color: '#1565C0', visible }));

  it('pulse the border 3 times, then keep a dot', async () => {
    const loop = jest.spyOn(Animated, 'loop');
    const screen = await renderMarks(true);
    await act(async () => undefined);
    expect(loop).toHaveBeenCalledTimes(1);
    expect(loop.mock.calls[0][1]).toEqual({ iterations: BIBLE_AUDIO_TIP_PULSES });
    expect(screen.queryByTestId('bible-audio-tip-dot')).toBeNull();
    await act(async () => jest.advanceTimersByTime(BIBLE_AUDIO_TIP_PULSES * 900 + 500));
    expect(screen.getByTestId('bible-audio-tip-dot')).toBeTruthy();
  });

  it('show only the dot with Reduce Motion on', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const loop = jest.spyOn(Animated, 'loop');
    const screen = await renderMarks(true);
    await act(async () => undefined);
    expect(loop).not.toHaveBeenCalled();
    expect(screen.getByTestId('bible-audio-tip-dot')).toBeTruthy();
  });

  it('pulse when the app comes back, if the tip arrived with the screen off', async () => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'background', writable: true });
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, listener: (state: string) => void) => {
      listeners.push(listener);
      return { remove: jest.fn() };
    }) as never);
    const loop = jest.spyOn(Animated, 'loop');
    await renderMarks(true);
    await act(async () => undefined);
    expect(loop).not.toHaveBeenCalled();
    await act(async () => listeners.forEach((listener) => listener('active')));
    expect(loop).toHaveBeenCalledTimes(1);
  });

  it("aren't there without the tip", async () => {
    const screen = await renderMarks(false);
    expect(screen.queryByTestId('bible-audio-tip-dot')).toBeNull();
    expect(screen.queryByTestId('bible-audio-tip-pulse')).toBeNull();
  });
});

describe('The Bible screen', () => {
  const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');

  it("watches the player's stalls, and its skips", () => {
    expect(bible).toMatch(/downloadTip\.watcher\.update\(\);\s*\}, \[audioStatus\.isBuffering, audioStatus\.playing/);
    // Android reports a play the listener asked for as playing while it loads.
    expect(bible).toMatch(/waiting: !isScrubbingRef\.current && status\.isBuffering,/);
    expect(bible).toMatch(/const seekAudio = [^]*?downloadTip\.watcher\.noteSeek\(\)/);
  });

  it('marks the audio settings button, says the line to screen readers, and shows it in the popup', () => {
    expect(bible).toMatch(/<BibleAudioDownloadTipMarks\s+color=\{theme\.colors\.primary\}\s+visible=\{downloadTip\.marksButton\}/);
    expect(bible).toMatch(/downloadTip\.marksButton \? `\$\{getBibleAudioDownloadTipLine\(language\)\} `/);
    expect(bible).toMatch(/showsTip=\{downloadTip\.showsLine\}/);
  });
});
