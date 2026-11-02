import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import { excludeFromBackup } from '@/modules/backup-exclusion';
import {
  BIBLE_AUDIO_DOWNLOAD_NARRATORS,
  deleteBibleAudioBook,
  downloadBibleAudio,
  getBibleAudioDownloadUrls,
  getBibleAudioScopeStatus,
  getDownloadableBibleAudioNarrator,
  getDownloadedChapterUri,
  hasRoomForBibleAudio,
  listDownloadedBibleAudio,
  loadBibleAudioDownloads,
  resetBibleAudioDownloadsForTests,
  snapshotDownloadedChapters,
  stopBibleAudioDownload,
} from '@/services/BibleAudioDownloads';
import { withDownloadedCopy } from '@/services/BibleAudioService';
import { BIBLE_AUDIO_BOOKS, CANTONESE_CUV_READER, RV1909_READER } from '@/services/BibleAudioSources';
import { File } from 'expo-file-system';
import { AppState } from 'react-native';
import { mockDisk, mockFiles } from './helpers/file-system-mock';

// Bible audio downloaded for listening offline (#556).
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

const MANDARIN_READER = '基督徒团契 (Audio Power)';
const exclude = excludeFromBackup as jest.MockedFunction<typeof excludeFromBackup>;
const JOHN = { kind: 'book', bookId: 'JHN' } as const;
const JUDE = { kind: 'book', bookId: 'JUD' } as const;
const PHILEMON = { kind: 'book', bookId: 'PHM' } as const;
const SIZES: Record<string, Record<string, number>> = BIBLE_AUDIO_DOWNLOAD_SIZES;

const setNetwork = (state: Partial<MockNetwork>) => {
  mockNetwork.state = { ...mockNetwork.state, ...state };
  mockNetwork.listeners.forEach((listener) => listener(mockNetwork.state));
};

// Lets queued downloads run until `done`, or fails.
const until = async (done: () => boolean) => {
  for (let tries = 0; tries < 500; tries += 1) {
    if (done()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Downloads did not settle');
};

const audioFiles = () =>
  [...mockFiles.keys()].filter((path) => path.startsWith('document/bible-audio/')).sort();

type Download = (url: string, destination: File, options?: { onProgress?: Function; signal?: AbortSignal }) => Promise<File>;
const mockDownloads = (download?: Download) =>
  jest.spyOn(File, 'downloadFileAsync').mockImplementation(
    (download ??
      (async (url, destination, options) => {
        options?.onProgress?.({ bytesWritten: 500, totalBytes: 1000 });
        mockFiles.set(destination.uri, `${'x'.repeat(1000)} ${url}`);
        return destination;
      })) as typeof File.downloadFileAsync,
  );

const isDone = (scope: Parameters<typeof getBibleAudioScopeStatus>[1], narrator = 'cuv-mandarin') => () =>
  !getBibleAudioScopeStatus(narrator, scope).downloading;

beforeEach(() => {
  resetBibleAudioDownloadsForTests();
  mockNetwork.state = { type: 'WIFI', isConnected: true, isInternetReachable: true };
  mockNetwork.listeners.clear();
  exclude.mockReturnValue(true);
  // React Native's own mock makes it a function.
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
});

describe('Bible audio downloads', () => {
  it("name each narrator a member can download, and none they can't", () => {
    expect(getDownloadableBibleAudioNarrator('cmn_cuv', MANDARIN_READER)).toBe('cuv-mandarin');
    expect(getDownloadableBibleAudioNarrator('cmn_cu1', MANDARIN_READER)).toBe('cuv-mandarin');
    expect(getDownloadableBibleAudioNarrator('cmn_cuv', CANTONESE_CUV_READER)).toBe('cuv-cantonese');
    expect(getDownloadableBibleAudioNarrator('spa_r09', RV1909_READER)).toBe('rv1909');
    expect(['souer', 'hays', 'david'].map((reader) => getDownloadableBibleAudioNarrator('BSB', reader))).toEqual([
      'souer',
      'hays',
      'david',
    ]);
    // Gilbert is on openbible.com, not HelloAO.
    expect(getDownloadableBibleAudioNarrator('BSB', 'gilbert')).toBeNull();
    expect(getDownloadableBibleAudioNarrator('cmn_cuv', 'someone')).toBeNull();
    expect(getDownloadableBibleAudioNarrator('BSB')).toBeNull();
  });

  it("download Mandarin from the church's copy first, then its mirrors", () => {
    expect(getBibleAudioDownloadUrls('cuv-mandarin', 'JHN', 3).map((url) => new URL(url).hostname)).toEqual([
      'assets.adventistconnect.org',
      'archive.org',
      'theaudiopower.com',
    ]);
  });

  it("download the WordProject recordings only from the church's copies, never WordProject's servers", () => {
    for (const narrator of ['cuv-cantonese', 'rv1909']) {
      for (const [bookId, chapters] of BIBLE_AUDIO_BOOKS) {
        for (let chapter = 1; chapter <= chapters; chapter += 1) {
          const urls = getBibleAudioDownloadUrls(narrator, bookId, chapter);
          expect([narrator, bookId, chapter, urls.map((url) => new URL(url).hostname)]).toEqual([
            narrator,
            bookId,
            chapter,
            ['assets.adventistconnect.org'],
          ]);
        }
      }
    }
  });

  it('download the English narrators from the same HelloAO links the reader streams', () => {
    const folder = join(process.cwd(), 'assets/bible/bsb');
    let checked = 0;
    for (const name of readdirSync(folder).filter((file) => file !== 'books.biblejson')) {
      const book = JSON.parse(readFileSync(join(folder, name), 'utf8'));
      for (const [index, chapter] of (book.chapters as { thisChapterAudioLinks?: Record<string, string> }[]).entries()) {
        if (!chapter?.thisChapterAudioLinks) continue;
        for (const narrator of ['souer', 'hays', 'david']) {
          expect(getBibleAudioDownloadUrls(narrator, book.book.id, index)).toEqual([chapter.thisChapterAudioLinks[narrator]]);
          checked += 1;
        }
      }
    }
    expect(checked).toBe(3 * 1189);
  });

  it('know every book\'s size for every narrator, and the church copies\' from the files themselves', () => {
    expect(BIBLE_AUDIO_DOWNLOAD_NARRATORS).toEqual(['cuv-mandarin', 'cuv-cantonese', 'rv1909', 'souer', 'hays', 'david']);
    for (const narrator of BIBLE_AUDIO_DOWNLOAD_NARRATORS) {
      expect(Object.keys(SIZES[narrator])).toEqual(BIBLE_AUDIO_BOOKS.map(([bookId]) => bookId));
      expect(Object.values(SIZES[narrator]).every((bytes) => bytes > 100_000)).toBe(true);
    }
    for (const narrator of ['cuv-mandarin', 'cuv-cantonese', 'rv1909']) {
      const chapters: Record<string, { bytes: number }> = JSON.parse(
        readFileSync(join(process.cwd(), 'scripts/bible-audio-timing-sources', `${narrator}.json`), 'utf8'),
      );
      const john = Object.entries(chapters)
        .filter(([chapter]) => chapter.startsWith('JHN '))
        .reduce((total, [, { bytes }]) => total + bytes, 0);
      expect([narrator, SIZES[narrator].JHN]).toEqual([narrator, john]);
    }
  });

  it('download a book into the documents directory, kept out of the backup, one file a chapter', async () => {
    const download = mockDownloads();
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN)).toMatchObject({
      chapters: 21,
      downloadedChapters: 0,
      totalBytes: SIZES['cuv-mandarin'].JHN,
      downloading: false,
    });

    downloadBibleAudio('cuv-mandarin', JOHN);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(true);
    await until(isDone(JOHN));

    expect(download).toHaveBeenCalledTimes(21);
    expect(audioFiles()).toEqual(
      Array.from({ length: 21 }, (_, index) => `document/bible-audio/cuv-mandarin/JHN/${index + 1}.mp3`).sort(),
    );
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN)).toMatchObject({ downloadedChapters: 21, downloading: false });
    // The folder, and each file too.
    expect(exclude).toHaveBeenCalledWith('document/bible-audio');
    expect(exclude).toHaveBeenCalledWith('document/bible-audio/cuv-mandarin/JHN/3.mp3');
    // Nothing went in the cache, which the phone may clear.
    expect([...mockFiles.keys()].some((path) => path.startsWith('cache/'))).toBe(false);
  });

  it("play a downloaded chapter from the phone first, then the church's copy and its mirrors", async () => {
    mockDownloads();
    downloadBibleAudio('cuv-mandarin', JOHN);
    await until(isDone(JOHN));

    const streamed = getBibleAudioDownloadUrls('cuv-mandarin', 'JHN', 3);
    const onPhone = getDownloadedChapterUri('cuv-mandarin', 'JHN', 3);
    expect(onPhone).toBe('document/bible-audio/cuv-mandarin/JHN/3.mp3');
    expect(withDownloadedCopy(streamed, onPhone)).toEqual([onPhone, ...streamed]);
    // A chapter that isn't on the phone streams as before.
    expect(getDownloadedChapterUri('cuv-mandarin', 'ACT', 1)).toBeNull();
    expect(withDownloadedCopy(streamed, null)).toEqual(streamed);
    // Nor is it another narrator's.
    expect(getDownloadedChapterUri('cuv-cantonese', 'JHN', 3)).toBeNull();
  });

  it("give a playback session the chapters on the phone when it starts, so the lock screen's queue doesn't change under it", async () => {
    mockDownloads();
    const atStart = snapshotDownloadedChapters('cuv-mandarin');
    downloadBibleAudio('cuv-mandarin', JUDE);
    await until(isDone(JUDE));
    expect(atStart('JUD', 1)).toBeNull();
    expect(snapshotDownloadedChapters('cuv-mandarin')('JUD', 1)).toBe('document/bible-audio/cuv-mandarin/JUD/1.mp3');
    expect(snapshotDownloadedChapters('cuv-cantonese')('JUD', 1)).toBeNull();
    expect(snapshotDownloadedChapters(null)('JUD', 1)).toBeNull();
  });

  it("move to the next mirror when the church's copy fails", async () => {
    const download = mockDownloads(async (url, destination) => {
      if (url.includes('adventistconnect')) throw new Error('HTTP 503');
      mockFiles.set(destination.uri, url);
      return destination;
    });
    downloadBibleAudio('cuv-mandarin', JUDE);
    await until(isDone(JUDE));
    expect(download.mock.calls.map(([url]) => new URL(url).hostname)).toEqual(['assets.adventistconnect.org', 'archive.org']);
    expect(mockFiles.get('document/bible-audio/cuv-mandarin/JUD/1.mp3')).toContain('archive.org');
  });

  it('count a scope\'s progress in bytes, and the New Testament and whole Bible in chapters', async () => {
    mockDownloads();
    downloadBibleAudio('cuv-mandarin', JUDE);
    await until(isDone(JUDE));
    const onPhone = mockFiles.get('document/bible-audio/cuv-mandarin/JUD/1.mp3')!.length;
    expect(getBibleAudioScopeStatus('cuv-mandarin', JUDE).downloadedBytes).toBe(onPhone);
    expect(getBibleAudioScopeStatus('cuv-mandarin', { kind: 'new-testament' })).toMatchObject({
      chapters: 260,
      downloadedChapters: 1,
    });
    expect(getBibleAudioScopeStatus('cuv-mandarin', { kind: 'bible' })).toMatchObject({
      chapters: 1189,
      downloadedChapters: 1,
      totalBytes: Object.values(SIZES['cuv-mandarin']).reduce((total, bytes) => total + bytes),
    });
  });

  it("show a download on the rows asked for, and the books inside them, but not the rows around them", () => {
    mockDownloads(async (url, destination) => {
      await new Promise(() => undefined);
      return destination;
    });
    downloadBibleAudio('cuv-mandarin', JOHN);
    const downloading = () =>
      [JOHN, PHILEMON, { kind: 'new-testament' } as const, { kind: 'bible' } as const].map(
        (scope) => getBibleAudioScopeStatus('cuv-mandarin', scope).downloading,
      );
    expect(downloading()).toEqual([true, false, false, false]);
    downloadBibleAudio('cuv-mandarin', { kind: 'new-testament' });
    expect(downloading()).toEqual([true, true, true, false]);
    // Stopping John leaves the rest of the New Testament downloading.
    stopBibleAudioDownload('cuv-mandarin', JOHN);
    expect(downloading()).toEqual([false, true, true, false]);
    stopBibleAudioDownload('cuv-mandarin', { kind: 'new-testament' });
    expect(downloading()).toEqual([false, false, false, false]);
  });

  it('stop at the X, keeping the chapters already downloaded', async () => {
    let started = 0;
    mockDownloads(async (url, destination, options) => {
      started += 1;
      if (started > 3) {
        // The fourth waits until it's stopped.
        await new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('stopped'))));
      }
      mockFiles.set(destination.uri, url);
      return destination;
    });
    downloadBibleAudio('cuv-mandarin', JOHN);
    await until(() => getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloadedChapters === 3);
    stopBibleAudioDownload('cuv-mandarin', JOHN);
    await until(isDone(JOHN));
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN)).toMatchObject({ downloadedChapters: 3, downloading: false });
    expect(audioFiles().filter((path) => path.endsWith('.part'))).toEqual([]);
  });

  it('start nothing over mobile data unless the member agreed, and go on when Wi-Fi is back', async () => {
    const download = mockDownloads();
    mockNetwork.state = { type: 'CELLULAR', isConnected: true, isInternetReachable: true };
    downloadBibleAudio('cuv-mandarin', JUDE);
    await until(() => getBibleAudioScopeStatus('cuv-mandarin', JUDE).waitingFor === 'wifi');
    expect(download).not.toHaveBeenCalled();

    setNetwork({ type: 'WIFI' });
    await until(isDone(JUDE));
    expect(getBibleAudioScopeStatus('cuv-mandarin', JUDE).downloadedChapters).toBe(1);
  });

  it('download over mobile data when the member agreed to', async () => {
    mockDownloads();
    mockNetwork.state = { type: 'CELLULAR', isConnected: true, isInternetReachable: true };
    downloadBibleAudio('cuv-mandarin', JUDE, { mobileData: true });
    await until(isDone(JUDE));
    expect(getBibleAudioScopeStatus('cuv-mandarin', JUDE).downloadedChapters).toBe(1);
  });

  it('wait when the connection drops, as between subway stations, and go on when it comes back', async () => {
    let online = true;
    mockDownloads(async (url, destination) => {
      if (!online) throw new Error('The Internet connection appears to be offline.');
      mockFiles.set(destination.uri, url);
      return destination;
    });
    online = false;
    mockNetwork.state = { type: 'NONE', isConnected: false, isInternetReachable: false };
    downloadBibleAudio('cuv-mandarin', PHILEMON);
    await until(() => getBibleAudioScopeStatus('cuv-mandarin', PHILEMON).waitingFor === 'connection');

    online = true;
    setNetwork({ type: 'CELLULAR', isConnected: true, isInternetReachable: true });
    // It had started on no network, so it waits for Wi-Fi rather than use mobile data.
    await until(() => getBibleAudioScopeStatus('cuv-mandarin', PHILEMON).waitingFor === 'wifi');
    setNetwork({ type: 'WIFI' });
    await until(isDone(PHILEMON));
    expect(getBibleAudioScopeStatus('cuv-mandarin', PHILEMON).downloadedChapters).toBe(1);
  });

  it("stop asking once chapters keep failing, as when the church's host is down", async () => {
    const download = mockDownloads(async () => {
      throw new Error('HTTP 503');
    });
    downloadBibleAudio('rv1909', JOHN);
    await until(isDone(JOHN, 'rv1909'));
    // Six in a row, and the two already downloading beside the sixth: not John's 21.
    expect(download.mock.calls.length).toBeLessThanOrEqual(8);
    expect(getBibleAudioScopeStatus('rv1909', JOHN).downloadedChapters).toBe(0);
  });

  it("refuse to download on iPhone if the files can't be kept out of the backup", () => {
    const download = mockDownloads();
    exclude.mockReturnValue(false);
    expect(() => downloadBibleAudio('cuv-mandarin', JOHN)).toThrow('backup');
    expect(download).not.toHaveBeenCalled();
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(false);
  });

  it('find what an earlier session downloaded, and clear what it left half done', () => {
    mockFiles.set('document/bible-audio/souer/JHN/1.mp3', 'x'.repeat(4_000));
    mockFiles.set('document/bible-audio/souer/JHN/2.mp3', 'x'.repeat(5_000));
    mockFiles.set('document/bible-audio/souer/JHN/3.mp3.1761000000000.part', 'x');
    mockFiles.set('document/bible-audio/rv1909/GEN/1.mp3', 'x'.repeat(700));
    loadBibleAudioDownloads();
    expect(listDownloadedBibleAudio()).toEqual([
      { narrator: 'rv1909', bytes: 700, books: [{ bookId: 'GEN', chapters: 50, downloadedChapters: 1, bytes: 700 }] },
      { narrator: 'souer', bytes: 9_000, books: [{ bookId: 'JHN', chapters: 21, downloadedChapters: 2, bytes: 9_000 }] },
    ]);
    expect(audioFiles()).not.toContain('document/bible-audio/souer/JHN/3.mp3.1761000000000.part');
    expect(getDownloadedChapterUri('souer', 'JHN', 2)).toBe('document/bible-audio/souer/JHN/2.mp3');
  });

  it("delete a book's chapters", async () => {
    mockDownloads();
    downloadBibleAudio('cuv-mandarin', JUDE);
    downloadBibleAudio('cuv-mandarin', PHILEMON);
    await until(() => isDone(JUDE)() && isDone(PHILEMON)());
    deleteBibleAudioBook('cuv-mandarin', 'JUD');
    expect(audioFiles()).toEqual(['document/bible-audio/cuv-mandarin/PHM/1.mp3']);
    expect(getDownloadedChapterUri('cuv-mandarin', 'JUD', 1)).toBeNull();
    expect(listDownloadedBibleAudio().map(({ books }) => books.map(({ bookId }) => bookId))).toEqual([['PHM']]);
  });

  it('check there is room, leaving some space free', () => {
    mockDisk.availableBytes = 2_000_000_000;
    expect(hasRoomForBibleAudio(939_000_000)).toBe(true);
    expect(hasRoomForBibleAudio(1_600_000_000)).toBe(false);
  });
});
