import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  deleteBibleAudio,
  downloadBibleAudio,
  getBibleAudioDownloadUrls,
  getBibleAudioScopeStatus,
  getDownloadedChapterUri,
  loadBibleAudioDownloads,
  resetBibleAudioDownloadsForTests,
  stopBibleAudioDownload,
} from '@/services/BibleAudioDownloads';
import { File } from 'expo-file-system';
import { AppState } from 'react-native';
import { mockFiles } from './helpers/file-system-mock';

// Bible audio downloads the phone itself carries out (#611), so they go on
// while it's locked or the app is in the background, on Wi-Fi only unless the
// member allowed mobile data. Here the phone's downloader is a stand-in that
// keeps its chapters in memory; modules/bible-audio-downloads is the real one.
jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn() }));
jest.mock('@/modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn(() => true) }));

type MockNetwork = { type: string; isConnected: boolean; isInternetReachable: boolean };
const mockNetwork: { state: MockNetwork; listeners: Set<(state: MockNetwork) => void> } = {
  state: { type: 'WIFI', isConnected: true, isInternetReachable: true },
  listeners: new Set(),
};
jest.mock('expo-network', () => ({
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(async () => mockNetwork.state),
  addNetworkStateListener: jest.fn((listener: (state: MockNetwork) => void) => {
    mockNetwork.listeners.add(listener);
    return { remove: () => mockNetwork.listeners.delete(listener) };
  }),
}));

type MockTask = {
  id: string;
  url: string;
  path: string;
  mobileData: boolean;
  state: 'waiting' | 'running' | 'paused' | 'failed';
  reason: 'wifi' | 'network' | 'retry' | 'paused' | null;
  bytesWritten: number;
  totalBytes: number;
};
const mockTasks = new Map<string, MockTask>();
const mockSystem = {
  tasks: mockTasks,
  enqueue: jest.fn(async (downloads: { id: string; url: string; path: string }[], mobileData: boolean) => {
    for (const download of downloads) {
      mockTasks.set(download.id, { ...download, mobileData, state: 'waiting', reason: null, bytesWritten: 0, totalBytes: -1 });
    }
  }),
  list: jest.fn(async () => [...mockTasks.values()].map(({ url, path, ...status }) => status)),
  cancel: jest.fn(async (ids: string[]) => {
    ids.forEach((id) => mockTasks.delete(id));
  }),
};
jest.mock('@/modules/bible-audio-downloads', () => ({ getBibleAudioSystemDownloads: () => mockSystem }));

const MANDARIN = 'cuv-mandarin';
const JUDE = { kind: 'book', bookId: 'JUD' } as const;
const PHILEMON = { kind: 'book', bookId: 'PHM' } as const;
const GOSPELS = { kind: 'section', sectionId: 'gospels' } as const;
const NEW_TESTAMENT = { kind: 'testament', testament: 'new' } as const;
const REQUESTS = 'document/bible-audio/requests.json';

// The phone finishing a chapter: the file in place, and the task gone.
const finish = (id: string) => {
  const task = mockSystem.tasks.get(id)!;
  mockFiles.set(task.path, 'x'.repeat(1000));
  mockSystem.tasks.delete(id);
};

// A second of the open app asking the phone how it's doing.
const poll = async (seconds = 1) => {
  for (let second = 0; second < seconds; second += 1) await jest.advanceTimersByTimeAsync(1_000);
};

const lastEnqueue = () => mockSystem.enqueue.mock.lastCall!;

beforeEach(() => {
  jest.useFakeTimers();
  resetBibleAudioDownloadsForTests();
  mockSystem.tasks.clear();
  jest.clearAllMocks();
  mockNetwork.state = { type: 'WIFI', isConnected: true, isInternetReachable: true };
  mockNetwork.listeners.clear();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
});

afterEach(() => {
  resetBibleAudioDownloadsForTests();
  jest.useRealTimers();
});

describe('Bible audio downloads the phone carries out (#611)', () => {
  it("hand a scope's chapters to the phone all at once, on Wi-Fi only unless the member allowed mobile data", async () => {
    const inApp = jest.spyOn(File, 'downloadFileAsync');
    downloadBibleAudio(MANDARIN, GOSPELS);
    await poll();
    expect(mockSystem.enqueue).toHaveBeenCalledTimes(1);
    const [downloads, mobileData] = lastEnqueue();
    expect(downloads).toHaveLength(28 + 16 + 24 + 21);
    expect(mobileData).toBe(false);
    expect(downloads[0]).toEqual({
      id: 'cuv-mandarin/MAT/1',
      url: getBibleAudioDownloadUrls(MANDARIN, 'MAT', 1)[0],
      path: 'document/bible-audio/cuv-mandarin/MAT/1.mp3',
    });
    downloadBibleAudio('souer', JUDE, { mobileData: true });
    await poll();
    expect(lastEnqueue()[1]).toBe(true);
    // The in-app downloader stays out of it.
    expect(inApp).not.toHaveBeenCalled();
    // What was asked for is kept, for when the app starts again.
    expect(JSON.parse(mockFiles.get(REQUESTS)!)).toEqual([
      { narrator: MANDARIN, scope: GOSPELS, mobileData: false },
      { narrator: 'souer', scope: JUDE, mobileData: true },
    ]);
  });

  it('show what the phone reports, and record each chapter it finishes', async () => {
    downloadBibleAudio(MANDARIN, PHILEMON);
    downloadBibleAudio(MANDARIN, JUDE);
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, PHILEMON)).toMatchObject({ downloading: true, active: false });
    // Downloading from its start, before any bytes: with three at a time, a
    // short chapter may come and go between two looks.
    Object.assign(mockSystem.tasks.get('cuv-mandarin/PHM/1')!, { state: 'running', bytesWritten: 0, totalBytes: -1 });
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, PHILEMON)).toMatchObject({ downloading: true, active: true, downloadedBytes: 0 });
    Object.assign(mockSystem.tasks.get('cuv-mandarin/PHM/1')!, { state: 'running', bytesWritten: 400, totalBytes: 1000 });
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, PHILEMON)).toMatchObject({ downloading: true, active: true, downloadedBytes: 400 });
    // Jude waits its turn.
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE)).toMatchObject({ downloading: true, active: false });

    finish('cuv-mandarin/PHM/1');
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, PHILEMON)).toMatchObject({ downloading: false, downloadedChapters: 1 });
    expect(getDownloadedChapterUri(MANDARIN, 'PHM', 1)).toBe('document/bible-audio/cuv-mandarin/PHM/1.mp3');
    finish('cuv-mandarin/JUD/1');
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE).downloading).toBe(false);
    // All done: nothing more to keep.
    expect(mockFiles.has(REQUESTS)).toBe(false);
  });

  it("hand over again on mobile data what's waiting for Wi-Fi, once the member allows it", async () => {
    mockNetwork.state = { type: 'CELLULAR', isConnected: true, isInternetReachable: true };
    downloadBibleAudio(MANDARIN, JUDE);
    await poll();
    expect(lastEnqueue()[1]).toBe(false);
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE)).toMatchObject({ downloading: true, waitingFor: 'wifi' });

    downloadBibleAudio(MANDARIN, JUDE, { mobileData: true });
    await poll();
    expect(lastEnqueue()).toEqual([[expect.objectContaining({ id: 'cuv-mandarin/JUD/1' })], true]);
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE).waitingFor).toBeNull();
  });

  it("say it waits for Wi-Fi on mobile data even for a chapter part way, as iOS lists it as running", async () => {
    downloadBibleAudio(MANDARIN, PHILEMON);
    await poll();
    Object.assign(mockSystem.tasks.get('cuv-mandarin/PHM/1')!, { state: 'running', bytesWritten: 400, totalBytes: 1000 });
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, PHILEMON)).toMatchObject({ active: true, downloadedBytes: 400 });
    // Wi-Fi drops: iOS still says running, with its 400 bytes.
    mockNetwork.state = { type: 'CELLULAR', isConnected: true, isInternetReachable: true };
    mockNetwork.listeners.forEach((listener) => listener(mockNetwork.state));
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, PHILEMON)).toMatchObject({
      downloading: true,
      active: false,
      waitingFor: 'wifi',
      downloadedBytes: 400,
    });
  });

  it('say it waits for Wi-Fi while Android holds a download off a metered network, as a hotspot', async () => {
    downloadBibleAudio(MANDARIN, JUDE);
    await poll();
    Object.assign(mockSystem.tasks.get('cuv-mandarin/JUD/1')!, { state: 'paused', reason: 'network' });
    await poll();
    // The phone says it's on Wi-Fi: the hotspot's.
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE)).toMatchObject({ downloading: true, waitingFor: 'wifi' });
  });

  it('try the next source when one fails, as on Android or when the iPhone drops it', async () => {
    downloadBibleAudio(MANDARIN, JUDE);
    await poll();
    const [first, second, third] = getBibleAudioDownloadUrls(MANDARIN, 'JUD', 1);
    expect(lastEnqueue()[0][0].url).toBe(first);
    // Android: a failed download stays listed.
    mockSystem.tasks.get('cuv-mandarin/JUD/1')!.state = 'failed';
    await poll(2);
    expect(lastEnqueue()[0][0].url).toBe(second);
    // iPhone: it's gone, with no file.
    mockSystem.tasks.delete('cuv-mandarin/JUD/1');
    await poll(2);
    expect(lastEnqueue()[0][0].url).toBe(third);
    // Android retrying a host that doesn't answer: the mirror, now.
    Object.assign(mockSystem.tasks.get('cuv-mandarin/JUD/1')!, { state: 'paused', reason: 'retry' });
    await poll(2);
    expect(lastEnqueue()[0][0].url).toBe(first);
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE).downloading).toBe(true);
  });

  it('stop after chapters keep failing every source, as when the hosts are down', async () => {
    downloadBibleAudio('rv1909', NEW_TESTAMENT);
    await poll();
    for (let round = 0; round < 12 && mockSystem.tasks.size; round += 1) {
      mockSystem.tasks.forEach((task) => (task.state = 'failed'));
      await poll();
    }
    expect(mockSystem.tasks.size).toBe(0);
    expect(getBibleAudioScopeStatus('rv1909', NEW_TESTAMENT).downloading).toBe(false);
  });

  it('stop at the X, and delete, through the phone, and never keep a chapter it finishes as it stops', async () => {
    downloadBibleAudio(MANDARIN, GOSPELS);
    downloadBibleAudio(MANDARIN, JUDE);
    await poll();
    stopBibleAudioDownload(MANDARIN, GOSPELS);
    await poll();
    expect(mockSystem.cancel).toHaveBeenCalledWith(expect.arrayContaining(['cuv-mandarin/MAT/1', 'cuv-mandarin/JHN/21']));
    expect([...mockSystem.tasks.keys()]).toEqual(['cuv-mandarin/JUD/1']);
    expect(getBibleAudioScopeStatus(MANDARIN, GOSPELS).downloading).toBe(false);
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE).downloading).toBe(true);

    // Jude finishes on the phone just as the member deletes it.
    mockSystem.cancel.mockImplementationOnce(async (ids: string[]) => {
      finish('cuv-mandarin/JUD/1');
      ids.forEach((id) => mockSystem.tasks.delete(id));
    });
    deleteBibleAudio(MANDARIN, JUDE);
    await poll();
    expect(mockFiles.has('document/bible-audio/cuv-mandarin/JUD/1.mp3')).toBe(false);
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE).downloadedChapters).toBe(0);
  });

  it("carry on when the app starts again: what the phone is still doing, what it finished, and what's left", async () => {
    // From before: the Gospels asked for. Matthew 1 finished while the app
    // was closed, Matthew 2 is still downloading, and the rest the phone
    // dropped, as iOS does when the app is swiped away.
    mockFiles.set(REQUESTS, JSON.stringify([{ narrator: MANDARIN, scope: GOSPELS, mobileData: false }]));
    mockFiles.set('document/bible-audio/cuv-mandarin/MAT/1.mp3', 'x'.repeat(1000));
    mockSystem.tasks.set('cuv-mandarin/MAT/2', {
      id: 'cuv-mandarin/MAT/2',
      url: 'https://example.org/2.mp3',
      path: 'document/bible-audio/cuv-mandarin/MAT/2.mp3',
      mobileData: false,
      state: 'running',
      reason: null,
      bytesWritten: 300,
      totalBytes: 900,
    });
    loadBibleAudioDownloads();
    await poll();
    expect(getBibleAudioScopeStatus(MANDARIN, GOSPELS)).toMatchObject({ downloading: true, active: true, downloadedChapters: 1 });
    // The rest, handed over again, still on Wi-Fi only.
    const [downloads, mobileData] = lastEnqueue();
    expect(mobileData).toBe(false);
    expect(downloads.map(({ id }) => id)).not.toContain('cuv-mandarin/MAT/1');
    expect(downloads.map(({ id }) => id)).not.toContain('cuv-mandarin/MAT/2');
    expect(downloads).toHaveLength(89 - 2);
  });

  it('hand everything over again when the app starts and the phone has nothing left, as after a swipe away', async () => {
    mockFiles.set(REQUESTS, JSON.stringify([{ narrator: MANDARIN, scope: JUDE, mobileData: true }]));
    loadBibleAudioDownloads();
    await poll();
    expect(lastEnqueue()).toEqual([[expect.objectContaining({ id: 'cuv-mandarin/JUD/1' })], true]);
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE).downloading).toBe(true);
  });

  it("not take a chapter on its way to the phone for one that failed, while the phone's list is being read", async () => {
    downloadBibleAudio(MANDARIN, PHILEMON);
    await poll();
    // The next list is slow to come back, and meanwhile the member asks for Jude.
    let answer: (statuses: unknown[]) => void = () => undefined;
    mockSystem.list.mockImplementationOnce(() => new Promise((resolve) => (answer = resolve as typeof answer)));
    await jest.advanceTimersByTimeAsync(1_000);
    downloadBibleAudio(MANDARIN, JUDE);
    answer([...mockSystem.tasks.values()].map(({ url, path, ...status }) => status));
    await poll(2);
    const jude = mockSystem.enqueue.mock.calls.flatMap(([downloads]) => downloads).filter(({ id }) => id === 'cuv-mandarin/JUD/1');
    expect(jude.map(({ url }) => url)).toEqual([getBibleAudioDownloadUrls(MANDARIN, 'JUD', 1)[0]]);
    expect(getBibleAudioScopeStatus(MANDARIN, JUDE).downloading).toBe(true);
  });

  it('say when Expo can do this, so the custom code can go (#612)', () => {
    // Expo SDK 58's DownloadTask has no Wi-Fi-only setting for its background
    // session on iOS, and ignores it on Android, so modules/bible-audio-downloads
    // does it. Once expo-file-system's options change, check whether Expo's own
    // background download keeps Bible audio on Wi-Fi only, with the phone locked,
    // and replace the custom code (#612).
    const types = readFileSync(join(process.cwd(), 'node_modules/expo-file-system/build/NetworkTasks.types.d.ts'), 'utf8');
    const options = /export type DownloadTaskOptions = \{([\s\S]*?)\n\};/.exec(types)?.[1] ?? '';
    const names = [...options.matchAll(/^\s{4}(\w+)\??:/gm)].map(([, name]) => name);
    expect({ issue: '#612', downloadTaskOptions: names }).toEqual({
      issue: '#612',
      downloadTaskOptions: ['headers', 'deferBackgroundSessionCompletion', 'sessionType', 'onProgress', 'signal'],
    });
    expect({ issue: '#612', androidIgnoresSessionType: options.includes('Android accepts this option for API consistency and ignores it') }).toEqual({
      issue: '#612',
      androidIgnoresSessionType: true,
    });
  });

  it('mark every custom piece with why it is there and #612', () => {
    for (const file of [
      'modules/bible-audio-downloads/index.ts',
      'modules/bible-audio-downloads/ios/BibleAudioDownloadSessions.swift',
      'modules/bible-audio-downloads/ios/BibleAudioDownloadsModule.swift',
      'modules/bible-audio-downloads/ios/BibleAudioDownloadsAppDelegate.swift',
      'modules/bible-audio-downloads/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioDownloadStore.kt',
      'modules/bible-audio-downloads/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioDownloadsModule.kt',
      'modules/bible-audio-downloads/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioDownloadReceiver.kt',
      'modules/bible-audio-downloads/android/src/main/AndroidManifest.xml',
      'modules/bible-audio-downloads/android/build.gradle',
      'services/BibleAudioDownloads.ts',
      'plugins/withAndroidBackupRules.js',
    ]) {
      expect({ file, mentions612: readFileSync(join(process.cwd(), file), 'utf8').includes('#612') }).toEqual({ file, mentions612: true });
    }
  });

  it('keep the Wi-Fi rule in the native code: no mobile data, roaming, or metered or expensive networks unless allowed', () => {
    const swift = readFileSync(join(process.cwd(), 'modules/bible-audio-downloads/ios/BibleAudioDownloadSessions.swift'), 'utf8');
    expect(swift).toContain('configuration.allowsCellularAccess = anyNetwork');
    expect(swift).toContain('configuration.allowsExpensiveNetworkAccess = anyNetwork');
    expect(swift).toMatch(/let session: URLSession = allowMobileData \? anyNetwork! : wifi!/);
    const kotlin = readFileSync(
      join(process.cwd(), 'modules/bible-audio-downloads/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioDownloadStore.kt'),
      'utf8',
    );
    expect(kotlin).toContain('.setAllowedOverMetered(next.mobileData)');
    expect(kotlin).toContain('.setAllowedOverRoaming(next.mobileData)');
    expect(kotlin).toContain('if (!next.mobileData) request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)');
    expect(kotlin).toContain('editor.putString(key, encodeWaiting(Waiting(key, download.id, download.url, target.path, allowMobileData)))');
  });

  it('take three chapters at a time, as the in-app downloader does, and stop starting more while the host fails', () => {
    // One mirror is a small ministry's own server.
    const source = readFileSync(join(process.cwd(), 'services/BibleAudioDownloads.ts'), 'utf8');
    expect(source).toContain('const CONCURRENT_DOWNLOADS = 3;');
    const swift = readFileSync(join(process.cwd(), 'modules/bible-audio-downloads/ios/BibleAudioDownloadSessions.swift'), 'utf8');
    expect(swift.match(/configuration\.httpMaximumConnectionsPerHost = 3\b/g)).toHaveLength(1);
    expect(swift).toMatch(/private func makeSession[\s\S]*httpMaximumConnectionsPerHost[\s\S]*return URLSession/);
    const kotlin = readFileSync(
      join(process.cwd(), 'modules/bible-audio-downloads/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioDownloadStore.kt'),
      'utf8',
    );
    // Left to itself, DownloadManager ran 11 of a whole Bible at once, and
    // handing it all 1,189 chapters kept the receiver waiting until Android
    // said the app wasn't responding. It gets three at a time; the receiver
    // starts the next as each ends, with the app closed too.
    expect(kotlin).toContain('private const val AT_ONCE = 3');
    expect(kotlin.match(/manager\.enqueue\(/g)).toHaveLength(1);
    expect(kotlin).toMatch(/private fun startNextLocked\(\) \{[\s\S]*?val downloadId = manager\.enqueue\(request\)/);
    for (const name of ['fun enqueue', 'fun list', 'fun cancel', 'fun complete']) {
      const body = kotlin.slice(kotlin.indexOf(name), kotlin.indexOf('\n  }\n', kotlin.indexOf(name)));
      expect({ name, startsNext: body.includes('startNextLocked()') }).toEqual({ name, startsNext: true });
    }
    // One handed over again, as from its next source, goes first, so a section
    // isn't left waiting on one chapter until the rest of the Bible is done.
    expect(kotlin).toContain('val key = WAITING_PREFIX + if (download.id in handedBefore) "$AGAIN$place" else place');
    expect(kotlin).toContain('private const val AGAIN = "!"');
    expect(kotlin).toContain('.sortedBy { it.key }');
    // After six failures in a row, the rest wait for the app to try the next source.
    expect(kotlin).toContain('private const val FAILURES_TO_PAUSE = 6');
    expect(source).toContain('const FAILURES_TO_STOP = 6;');
    expect(kotlin).toContain('if (waiting.isEmpty() || tracked.getInt(FAILURES, 0) >= FAILURES_TO_PAUSE) return');
  });

  it("keep Android's downloads going while locked, and leave no partial files behind", () => {
    const kotlin = readFileSync(
      join(process.cwd(), 'modules/bible-audio-downloads/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioDownloadStore.kt'),
      'utf8',
    );
    // A hidden download is the app's background work, which Android put off
    // with the emulator locked; a visible one runs. The system groups them
    // into one notification, with no permission from the app.
    expect(kotlin).toContain('.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)');
    expect(kotlin).not.toContain('VISIBILITY_HIDDEN');
    expect(readFileSync(join(process.cwd(), 'modules/bible-audio-downloads/android/src/main/AndroidManifest.xml'), 'utf8')).not.toContain(
      'DOWNLOAD_WITHOUT_NOTIFICATION',
    );
    // DownloadManager.remove() left 355 MB of partial files on the emulator:
    // the app deletes its own, after a move or a stop, and sweeps up orphans.
    expect(kotlin).toContain('source?.delete()');
    expect(kotlin).toContain('partials.forEach { it.delete() }');
    expect(kotlin).toContain('sweepLocked()');
  });
});
