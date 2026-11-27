import { useBibleAudioOfflineLine } from '@/hooks/useBibleAudioOfflineLine';
import { useRenderingRef } from '@/hooks/useRenderingRef';
import {
  getBibleAudioOfflineLine,
  isOfflineNetworkState,
  showsBibleAudioOfflineLine,
} from '@/services/BibleAudioOfflineLine';
import { act, renderHook } from '@testing-library/react-native';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { readFileSync } from 'node:fs';

// When the network is down as a chapter that isn't downloaded starts, the
// player says so, in place of its progress bar, instead of stopping without a
// word (#801).
jest.mock('expo-network', () => ({
  getNetworkStateAsync: jest.fn(),
  addNetworkStateListener: jest.fn(),
}));

const OFFLINE = { isConnected: false, isInternetReachable: false } as NetworkState;
const ONLINE = { isConnected: true, isInternetReachable: true } as NetworkState;
let networkListeners: ((state: NetworkState) => void)[] = [];
let removals = 0;

beforeEach(() => {
  networkListeners = [];
  removals = 0;
  jest.mocked(addNetworkStateListener).mockImplementation((listener) => {
    networkListeners.push(listener);
    return { remove: () => { removals += 1; } } as ReturnType<typeof addNetworkStateListener>;
  });
  jest.mocked(getNetworkStateAsync).mockResolvedValue(OFFLINE);
});

const networkChanges = async (state: NetworkState) =>
  act(async () => networkListeners.forEach((listener) => listener(state)));

const waiting = { listening: true, audible: false, offline: true, downloaded: false };

describe('the line', () => {
  it('names the network and the missing download in one short line, in each app language', () => {
    // 未下載 as Offline Bible Audio says it (#822).
    expect(getBibleAudioOfflineLine('en')).toBe('No connection · not downloaded');
    expect(getBibleAudioOfflineLine('zh')).toBe('沒有網路 · 未下載');
    expect(getBibleAudioOfflineLine('zh-cn')).toBe('没有网络 · 未下载');
    expect(getBibleAudioOfflineLine('es')).toBe('Sin conexión · no descargado');
  });

  it('shows while the listener waits for audio that needs the network', () => {
    expect(showsBibleAudioOfflineLine(waiting)).toBe(true);
  });

  it('stays away once the audio is heard, after a pause, online, or for a downloaded chapter', () => {
    // A short drop the player rides out on what it has already loaded.
    expect(showsBibleAudioOfflineLine({ ...waiting, audible: true })).toBe(false);
    // After a pause nothing waits for the connection, so there's nothing to explain.
    expect(showsBibleAudioOfflineLine({ ...waiting, listening: false })).toBe(false);
    expect(showsBibleAudioOfflineLine({ ...waiting, offline: false })).toBe(false);
    expect(showsBibleAudioOfflineLine({ ...waiting, downloaded: true })).toBe(false);
  });

  it("reads expo-network's state as offline when either half says so", () => {
    expect(isOfflineNetworkState(OFFLINE)).toBe(true);
    // Wi-Fi that's connected but reaches nothing, as flaky Wi-Fi often does.
    expect(isOfflineNetworkState({ isConnected: true, isInternetReachable: false })).toBe(true);
    expect(isOfflineNetworkState(ONLINE)).toBe(false);
    // Not yet known isn't offline.
    expect(isOfflineNetworkState({ isConnected: true, isInternetReachable: null })).toBe(false);
  });
});

describe('on the Bible screen', () => {
  const renderLine = async (props: Partial<Parameters<typeof useBibleAudioOfflineLine>[0]> = {}) => {
    const hook = await renderHook(
      (overrides: Partial<Parameters<typeof useBibleAudioOfflineLine>[0]>) =>
        useBibleAudioOfflineLine({
          enabled: true,
          language: 'zh',
          listening: true,
          audible: false,
          downloaded: false,
          ...overrides,
        }),
      { initialProps: props },
    );
    await act(async () => undefined);
    return hook;
  };

  it('shows when the network is down as a chapter starts, and goes when it comes back', async () => {
    const { result } = await renderLine();
    expect(result.current).toBe('沒有網路 · 未下載');
    await networkChanges(ONLINE);
    expect(result.current).toBeNull();
    await networkChanges(OFFLINE);
    expect(result.current).not.toBeNull();
  });

  it('goes as soon as the audio plays, and when the listener pauses', async () => {
    const { result, rerender } = await renderLine();
    await rerender({ audible: true });
    expect(result.current).toBeNull();
    await rerender({ audible: false, listening: false });
    expect(result.current).toBeNull();
  });

  it('watches the connection only while the listener listens', async () => {
    const { rerender, unmount } = await renderLine({ listening: false });
    expect(addNetworkStateListener).not.toHaveBeenCalled();
    await rerender({ listening: true });
    expect(networkListeners).toHaveLength(1);
    await rerender({ listening: false });
    expect(removals).toBe(1);
    unmount();
    expect(removals).toBe(1);
  });

  it("isn't shown on the web, whose player is a testing preview", async () => {
    const { result } = await renderLine({ enabled: false });
    expect(result.current).toBeNull();
    expect(addNetworkStateListener).not.toHaveBeenCalled();
  });

  it('keeps a change that arrives before the first reading of the connection', async () => {
    let resolve: (state: NetworkState) => void = () => undefined;
    jest.mocked(getNetworkStateAsync).mockReturnValue(new Promise((done) => { resolve = done; }));
    const { result } = await renderLine();
    await networkChanges(ONLINE);
    // The first reading, taken before the connection came back, arrives late.
    await act(async () => resolve(OFFLINE));
    expect(result.current).toBeNull();
  });
});

describe('a drop while listening, for the one-time tip (#801)', () => {
  const listen = async (onDrop: () => void) => {
    await renderHook(() =>
      useBibleAudioOfflineLine({
        enabled: true,
        language: 'en',
        listening: true,
        audible: true,
        downloaded: false,
        onDrop,
      }),
    );
    // The first reading of the connection arrives a few ticks later.
    await act(async () => {
      for (let i = 0; i < 5; i += 1) await Promise.resolve();
    });
  };

  it('comes from a drop while listening', async () => {
    jest.mocked(getNetworkStateAsync).mockResolvedValue(ONLINE);
    const onDrop = jest.fn();
    await listen(onDrop);
    await act(async () => networkListeners.forEach((listener) => listener(OFFLINE)));
    expect(onDrop).toHaveBeenCalledTimes(1);
    // Staying offline isn't another drop.
    await act(async () => networkListeners.forEach((listener) => listener(OFFLINE)));
    expect(onDrop).toHaveBeenCalledTimes(1);
  });

  it('not from starting to listen offline', async () => {
    jest.mocked(getNetworkStateAsync).mockResolvedValue(OFFLINE);
    const onDrop = jest.fn();
    await listen(onDrop);
    await act(async () => networkListeners.forEach((listener) => listener(OFFLINE)));
    expect(onDrop).not.toHaveBeenCalled();
  });

});

describe('the listening flag the line depends on', () => {
  it('re-renders the screen when a callback changes it, and only then', async () => {
    let renders = 0;
    const { result } = await renderHook(() => {
      renders += 1;
      return { ref: useRenderingRef(false) };
    });
    const before = renders;
    await act(async () => { result.current.ref.current = false; });
    expect(renders).toBe(before);
    await act(async () => { result.current.ref.current = true; });
    expect(renders).toBe(before + 1);
    expect(result.current.ref.current).toBe(true);
  });

  it("is the screen's listening flag, which the source controller and the play button set", () => {
    const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
    expect(bible).toContain('const nativePlaybackIntentRef = useRenderingRef(false);');
    expect(bible).toContain('listening: nativePlaybackIntentRef,');
    expect(bible).toMatch(/useBibleAudioOfflineLine\(\{[^}]*listening: nativePlaybackIntentRef\.current,/);
    // The dock makes room when the line wraps past the progress bar's height.
    expect(bible).toContain('audioOfflineLineHeight - dockLayout.audioTimelineHeight');
  });

  it('shows pause while the line shows, and a tap then pauses', () => {
    // The player is still trying then. A play button would look stopped, and
    // its tap would cancel the retries, as the persona found (#801).
    const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');
    expect(bible).toContain("icon={isPlaying || audioOfflineLine ? 'pause' : 'play'}");
    const toggle = bible.slice(bible.indexOf('const toggleAudio = async () => {'));
    expect(toggle.slice(0, toggle.indexOf(') {'))).toContain('!!audioOfflineLine ||');
  });
});
