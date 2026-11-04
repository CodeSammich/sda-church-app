import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import {
  downloadBibleAudio,
  getBibleAudioScopeStatus,
  getDownloadedChapterUri,
  loadBibleAudioDownloads,
  resetBibleAudioDownloadsForTests,
} from '@/services/BibleAudioDownloads';
import {
  CHAPTER_SIZE_TOLERANCE,
  getBibleAudioBookBytes,
  getBibleAudioChapterSizeRange,
  isBibleAudioChapterSizeRight,
  MAX_UNKNOWN_CHAPTER_BYTES,
  MIN_UNKNOWN_CHAPTER_BYTES,
} from '@/services/BibleAudioDownloadSizes';
import { BIBLE_AUDIO_BOOKS } from '@/services/BibleAudioSources';
import { downloadFile, DownloadSizeError } from '@/services/FileDownloads';
import { Directory, File, Paths } from 'expo-file-system';
import { AppState } from 'react-native';
import { chapterBytes, mockChapterFile } from './helpers/bible-audio-chapter-files';
import { mockFiles, mockFileSizes } from './helpers/file-system-mock';

// A downloaded Bible audio chapter is kept only when it's the recording: a
// Wi-Fi's sign-in page, answered as if it were the file, or a file cut off
// part way, is deleted and tried again, rather than kept to fail when played
// offline; and no answer may grow without end and fill the phone.
jest.mock('expo-audio', () => ({ setAudioModeAsync: jest.fn() }));
jest.mock('@/modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn(() => true) }));
jest.mock('expo-network', () => ({
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI', isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: () => undefined })),
}));

const SIZES: Record<string, Record<string, number[]>> = BIBLE_AUDIO_DOWNLOAD_SIZES;
const JUDE = { kind: 'book', bookId: 'JUD' } as const;
const SIGN_IN_PAGE = '<html><body>Accept the terms to use this Wi-Fi</body></html>';

type Download = (
  url: string,
  destination: File,
  options?: { onProgress?: (progress: { bytesWritten: number; totalBytes: number }) => void; signal?: AbortSignal },
) => Promise<File>;
const mockDownloads = (download: Download) =>
  jest.spyOn(File, 'downloadFileAsync').mockImplementation(download as unknown as typeof File.downloadFileAsync);

const until = async (done: () => boolean) => {
  for (let tries = 0; tries < 500; tries += 1) {
    if (done()) return;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  throw new Error('Downloads did not settle');
};

const audioFiles = () => [...mockFiles.keys()].filter((path) => path.startsWith('document/bible-audio/')).sort();

beforeEach(() => {
  resetBibleAudioDownloadsForTests();
  jest.restoreAllMocks();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
});

describe('Bible audio chapter sizes', () => {
  it("know every chapter's size, for every narrator, in chapter order", () => {
    for (const [narrator, books] of Object.entries(SIZES)) {
      expect([narrator, Object.keys(books)]).toEqual([narrator, BIBLE_AUDIO_BOOKS.map(([bookId]) => bookId)]);
      for (const [bookId, chapters] of BIBLE_AUDIO_BOOKS) {
        expect([narrator, bookId, books[bookId].length]).toEqual([narrator, bookId, chapters]);
        // The shortest recording is 60 KB, the longest 22 MB.
        expect(books[bookId].every((bytes) => Number.isInteger(bytes) && bytes > 50_000 && bytes < 25_000_000)).toBe(true);
      }
    }
    expect(getBibleAudioBookBytes('cuv-mandarin', 'JUD')).toBe(SIZES['cuv-mandarin'].JUD[0]);
    expect(getBibleAudioBookBytes('souer', 'JHN')).toBe(SIZES.souer.JHN.reduce((total, bytes) => total + bytes));
  });

  it('keep the church\'s copies at the sizes of the files the verse times were made from', () => {
    for (const narrator of ['cuv-mandarin', 'cuv-cantonese', 'rv1909']) {
      const measured: Record<string, { bytes: number }> = JSON.parse(
        readFileSync(join(process.cwd(), 'scripts/bible-audio-timing-sources', `${narrator}.json`), 'utf8'),
      );
      for (const [chapter, { bytes }] of Object.entries(measured)) {
        const [bookId, number] = chapter.split(' ');
        expect([narrator, chapter, SIZES[narrator][bookId][Number(number) - 1]]).toEqual([narrator, chapter, bytes]);
      }
    }
  });

  it('allow a chapter within 2% of its recording, and nothing further off', () => {
    const bytes = chapterBytes('souer', 'JHN', 3);
    expect(CHAPTER_SIZE_TOLERANCE).toBe(0.02);
    const range = getBibleAudioChapterSizeRange('souer', 'JHN', 3);
    expect(range).toEqual({ min: Math.floor(bytes * 0.98), max: Math.ceil(bytes * 1.02), known: true });
    expect(isBibleAudioChapterSizeRight('souer', 'JHN', 3, bytes)).toBe(true);
    expect(isBibleAudioChapterSizeRight('souer', 'JHN', 3, Math.round(bytes * 1.015))).toBe(true);
    expect(isBibleAudioChapterSizeRight('souer', 'JHN', 3, Math.round(bytes * 0.985))).toBe(true);
    // Cut off part way.
    expect(isBibleAudioChapterSizeRight('souer', 'JHN', 3, Math.round(bytes * 0.9))).toBe(false);
    // A Wi-Fi's sign-in page.
    expect(isBibleAudioChapterSizeRight('souer', 'JHN', 3, SIGN_IN_PAGE.length)).toBe(false);
    expect(isBibleAudioChapterSizeRight('souer', 'JHN', 3, Math.round(bytes * 1.05))).toBe(false);
  });

  it('keep a chapter whose size is unknown between 20 KB and 60 MB', () => {
    expect([MIN_UNKNOWN_CHAPTER_BYTES, MAX_UNKNOWN_CHAPTER_BYTES]).toEqual([20_000, 60_000_000]);
    for (const [narrator, bookId, chapter] of [
      ['someone', 'JHN', 3],
      ['souer', 'XYZ', 1],
      ['souer', 'JUD', 2],
    ] as const) {
      expect(getBibleAudioChapterSizeRange(narrator, bookId, chapter)).toEqual({ min: 20_000, max: 60_000_000, known: false });
    }
    expect(isBibleAudioChapterSizeRight('someone', 'JHN', 3, SIGN_IN_PAGE.length)).toBe(false);
    expect(isBibleAudioChapterSizeRight('someone', 'JHN', 3, 1_000_000)).toBe(true);
    expect(isBibleAudioChapterSizeRight('someone', 'JHN', 3, 60_000_001)).toBe(false);
  });
});

describe('Downloading a file at a size it must be', () => {
  const folder = new Directory(Paths.document, 'downloads');
  const range = { min: 900, max: 1_100 };
  const parts = () => [...mockFiles.keys()].filter((path) => path.endsWith('.part'));

  it('keep one that ends within the range', async () => {
    mockDownloads(async (url, destination) => {
      mockFiles.set(destination.uri, 'x'.repeat(1_000));
      return destination;
    });
    const file = await downloadFile('https://example.org/a.mp3', folder, 'a.mp3', { sizeRange: range });
    expect(file.uri).toBe('document/downloads/a.mp3');
    expect(mockFiles.get('document/downloads/a.mp3')).toHaveLength(1_000);
    expect(parts()).toEqual([]);
  });

  it('turn down a sign-in page, or a file cut off part way, and delete it', async () => {
    for (const text of [SIGN_IN_PAGE, 'x'.repeat(899), 'x'.repeat(1_101)]) {
      mockDownloads(async (url, destination) => {
        mockFiles.set(destination.uri, text);
        return destination;
      });
      await expect(downloadFile('https://example.org/a.mp3', folder, 'a.mp3', { sizeRange: range })).rejects.toBeInstanceOf(
        DownloadSizeError,
      );
      expect(mockFiles.has('document/downloads/a.mp3')).toBe(false);
      expect(parts()).toEqual([]);
    }
  });

  it('stop one that grows past the range, before it can fill the phone', async () => {
    let written = 0;
    mockDownloads(async (url, destination, options) => {
      // A server that never stops sending.
      while (!options?.signal?.aborted) {
        if (written > 1_000_000) throw new Error('Never stopped');
        written += 500;
        mockFiles.set(destination.uri, 'x'.repeat(written));
        options?.onProgress?.({ bytesWritten: written, totalBytes: -1 });
      }
      throw new Error('aborted');
    });
    const error = await downloadFile('https://example.org/a.mp3', folder, 'a.mp3', { sizeRange: range }).catch((e) => e);
    expect(error).toBeInstanceOf(DownloadSizeError);
    expect(error.bytes).toBe(1_500);
    expect(written).toBe(1_500);
    expect(mockFiles.has('document/downloads/a.mp3')).toBe(false);
    expect(parts()).toEqual([]);
  });

  it('stop one at once when the server says it is too big', async () => {
    let progressed = 0;
    mockDownloads(async (url, destination, options) => {
      options?.onProgress?.({ bytesWritten: 0, totalBytes: 5_000_000_000 });
      progressed += 1;
      if (options?.signal?.aborted) throw new Error('aborted');
      return destination;
    });
    await expect(downloadFile('https://example.org/a.mp3', folder, 'a.mp3', { sizeRange: range })).rejects.toBeInstanceOf(
      DownloadSizeError,
    );
    expect(progressed).toBe(1);
  });

  it('delete what a failed download got at once, not at the next start', async () => {
    mockDownloads(async (url, destination) => {
      mockFiles.set(destination.uri, 'x'.repeat(300));
      throw new Error('The network connection was lost.');
    });
    await expect(downloadFile('https://example.org/a.mp3', folder, 'a.mp3')).rejects.toThrow('lost');
    expect([...mockFiles.keys()]).toEqual([]);
  });
});

describe('Bible audio downloads turn down a chapter that is not the recording', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  it("try Mandarin's mirror when a Wi-Fi's sign-in page answers for the church's copy", async () => {
    const download = mockDownloads(async (url, destination) => {
      if (url.includes('adventistconnect')) mockFiles.set(destination.uri, SIGN_IN_PAGE);
      else mockChapterFile(destination.uri, url);
      return destination;
    });
    downloadBibleAudio('cuv-mandarin', JUDE);
    await until(() => !getBibleAudioScopeStatus('cuv-mandarin', JUDE).downloading);
    expect(download.mock.calls.map(([url]) => new URL(url).hostname)).toEqual(['assets.adventistconnect.org', 'archive.org']);
    expect(mockFiles.get('document/bible-audio/cuv-mandarin/JUD/1.mp3')).toContain('archive.org');
    expect(getBibleAudioScopeStatus('cuv-mandarin', JUDE)).toMatchObject({
      downloadedChapters: 1,
      downloadedBytes: chapterBytes('cuv-mandarin', 'JUD', 1),
    });
    expect(audioFiles()).toEqual(['document/bible-audio/cuv-mandarin/JUD/1.mp3']);
  });

  it('never mark a chapter downloaded from a file cut off part way, and try it again', async () => {
    let calls = 0;
    mockDownloads(async (url, destination) => {
      calls += 1;
      mockFiles.set(destination.uri, 'x');
      // The first two arrive cut off; the third whole.
      mockFileSizes.set(destination.uri, Math.round(chapterBytes('rv1909', 'JUD', 1) * (calls < 3 ? 0.5 : 1)));
      return destination;
    });
    downloadBibleAudio('rv1909', JUDE);
    await until(() => !getBibleAudioScopeStatus('rv1909', JUDE).downloading);
    expect(calls).toBe(3);
    expect(getDownloadedChapterUri('rv1909', 'JUD', 1)).toBe('document/bible-audio/rv1909/JUD/1.mp3');
    expect(audioFiles()).toEqual(['document/bible-audio/rv1909/JUD/1.mp3']);
  });

  it('give up on a chapter that never arrives whole, leaving no file', async () => {
    mockDownloads(async (url, destination) => {
      mockFiles.set(destination.uri, SIGN_IN_PAGE);
      return destination;
    });
    downloadBibleAudio('rv1909', JUDE);
    await until(() => !getBibleAudioScopeStatus('rv1909', JUDE).downloading);
    expect(getBibleAudioScopeStatus('rv1909', JUDE).downloadedChapters).toBe(0);
    expect(getDownloadedChapterUri('rv1909', 'JUD', 1)).toBeNull();
    expect(audioFiles()).toEqual([]);
  });

  it('delete a broken chapter an earlier version kept, so it downloads again', () => {
    mockChapterFile('document/bible-audio/souer/JUD/1.mp3');
    mockFiles.set('document/bible-audio/souer/PHM/1.mp3', SIGN_IN_PAGE);
    loadBibleAudioDownloads();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('souer/PHM/1'));
    expect(getDownloadedChapterUri('souer', 'JUD', 1)).toBe('document/bible-audio/souer/JUD/1.mp3');
    expect(getDownloadedChapterUri('souer', 'PHM', 1)).toBeNull();
    expect(audioFiles()).toEqual(['document/bible-audio/souer/JUD/1.mp3']);
  });
});

describe("The phone's own downloaders keep a chapter only at its size", () => {
  const read = (path: string) => readFileSync(join(process.cwd(), 'modules/bible-audio-downloads', path), 'utf8');
  const android = (name: string) => read(`android/src/main/java/org/nyccsda/bibleaudiodownloads/${name}`);

  it('share one rule on Android, with the app\'s limits for a size not known', () => {
    const checks = android('BibleAudioFileChecks.kt');
    expect(checks).toContain('private const val MIN_UNKNOWN_BYTES = 20_000L');
    expect(checks).toContain('private const val MAX_UNKNOWN_BYTES = 60_000_000L');
    expect(checks).toContain('if (type.startsWith("text/")) return false');
    expect(checks).toContain('return known || type.startsWith("audio/") || type == "application/octet-stream"');
    const module = android('BibleAudioDownloadsModule.kt');
    expect(module).toContain('@Field var minBytes: Double = 0.0');
    expect(module).toContain('@Field var maxBytes: Double = 0.0');
  });

  it("stop Android 14's job past the size, turn down the wrong size or a web page, and delete its partial file", () => {
    const service = android('BibleAudioTransferService.kt');
    expect(service).toContain('if (!sizes.allows(connection.contentType)) {');
    expect(service).toMatch(/if \(total > sizes\.max\) \{\n\s+partial\.delete\(\)\n\s+return false/);
    expect(service).toMatch(/if \(bytes \+ read > sizes\.max\) \{\n\s+tooBig = true\n\s+break/);
    expect(service).toMatch(
      /if \(tooBig \|\| \(total >= 0 && bytes != total\) \|\| !sizes\.fits\(bytes\)\) \{\n\s+partial\.delete\(\)\n\s+return false/,
    );
    // Failed from every source: what it got goes, rather than waiting for a retry.
    expect(android('BibleAudioTransfers.kt')).toMatch(/fun failed\(transfer: Transfer\) = synchronized\(LOCK\) \{\n\s+release\(transfer\)\n\s+deletePartial\(transfer\)/);
  });

  it("move a DownloadManager chapter into place only at its size, and stop one that's too big", () => {
    const store = android('BibleAudioDownloadStore.kt');
    expect(store).toContain(
      'entry.sizes.fits(source.length()) && entry.sizes.allows(cursor.string(DownloadManager.COLUMN_MEDIA_TYPE))',
    );
    expect(store).toContain('if (whole && target != null) {');
    expect(store).toContain('turnDownLocked(downloadId, entry)');
    // A failed one's partial file goes at once.
    expect(store).toMatch(/DownloadManager\.STATUS_FAILED -> \{\n[^}]*File\(entry\.partial\)\.delete\(\)/);
  });

  it('keep an iPhone chapter only at its size, and stop one that grows past it', () => {
    const sessions = read('ios/BibleAudioDownloadSessions.swift');
    expect(sessions).toContain('private static let minUnknownBytes: Int64 = 20_000');
    expect(sessions).toContain('private static let maxUnknownBytes: Int64 = 60_000_000');
    expect(sessions).toContain('guard sizes.allows(downloadTask.response?.mimeType), sizes.fits(bytes) else {');
    expect(sessions).toMatch(/> sizes\.max \{\n\s+downloadTask\.cancel\(\)/);
    expect(read('ios/BibleAudioDownloadsModule.swift')).toContain('@Field var maxBytes: Double = 0');
  });
});
