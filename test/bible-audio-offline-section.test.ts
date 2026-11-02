import { BibleAudioOfflineSection, getBibleAudioScopeCaption } from '@/components/BibleAudioOfflineSection';
import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import { formatDownloadSize } from '@/constants/DownloadCopy';
import {
  getBibleAudioScopeStatus,
  resetBibleAudioDownloadsForTests,
  type BibleAudioScopeStatus,
} from '@/services/BibleAudioDownloads';
import { act, fireEvent } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { createElement } from 'react';
import { Alert, AppState, Platform } from 'react-native';
import { mockDisk, mockFiles } from './helpers/file-system-mock';
import { renderWithPreferences } from './helpers/render-preferences';

// "Listen offline" in the Bible audio settings popup (#556).
jest.mock('@/modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn(() => true) }));
const mockNetwork = { state: { type: 'WIFI', isConnected: true, isInternetReachable: true } };
jest.mock('expo-network', () => ({
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(async () => mockNetwork.state),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const MANDARIN_READER = '基督徒团契 (Audio Power)';
const SIZES: Record<string, Record<string, number>> = BIBLE_AUDIO_DOWNLOAD_SIZES;
const JOHN = { kind: 'book', bookId: 'JHN' } as const;
const NEW_TESTAMENT_BOOKS = Object.keys(SIZES['cuv-mandarin']).slice(39);
const sum = (bytes: number[]) => bytes.reduce((total, each) => total + each, 0);
const styles = { divider: {}, helper: {}, row: {}, rowCaption: {}, rowLabel: {}, rowTitle: {}, sectionTitle: {} };

const status = (overrides: Partial<BibleAudioScopeStatus>): BibleAudioScopeStatus => ({
  chapters: 21,
  downloadedChapters: 0,
  downloadedBytes: 0,
  totalBytes: 24_500_000,
  downloading: false,
  waitingFor: null,
  ...overrides,
});

const renderSection = (reader = MANDARIN_READER, translationId = 'cmn_cuv', language: 'en' | 'zh' = 'en') =>
  renderWithPreferences(
    createElement(BibleAudioOfflineSection, {
      book: { id: 'JHN', name: language === 'zh' ? '約翰福音' : 'John' },
      reader,
      styles,
      textScale: 1.25,
      translationId,
    }),
    { language },
  );

beforeEach(() => {
  resetBibleAudioDownloadsForTests();
  mockNetwork.state = { type: 'WIFI', isConnected: true, isInternetReachable: true };
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
  jest.spyOn(File, 'downloadFileAsync').mockImplementation((async (_url: string, destination: File) => {
    // Never finishes, so each row stays downloading.
    await new Promise(() => undefined);
    return destination;
  }) as never);
});

describe('Listen offline', () => {
  it('says what each choice holds: its size, its progress, what it waits for, or that it is on the phone', () => {
    expect(getBibleAudioScopeCaption(status({}), 'en').text).toBe('24.5 MB');
    expect(getBibleAudioScopeCaption(status({ downloading: true, downloadedBytes: 5_100_000 }), 'en')).toEqual({
      text: 'Downloading · 5.1 of 24.5 MB',
      fraction: 5.1 / 24.5,
    });
    expect(getBibleAudioScopeCaption(status({ downloading: true, downloadedBytes: 5_100_000, waitingFor: 'wifi' }), 'en').text)
      .toBe('Waiting for Wi-Fi · 5.1 MB of 24.5 MB');
    expect(getBibleAudioScopeCaption(status({ downloading: true, waitingFor: 'connection' }), 'zh').text)
      .toBe('等待網路連線 · 0.0 MB / 24.5 MB');
    expect(getBibleAudioScopeCaption(status({ downloadedChapters: 21, downloadedBytes: 24_600_000 }), 'en').text)
      .toBe('On this phone · 24.6 MB');
    expect(getBibleAudioScopeCaption(status({ downloadedChapters: 12, downloadedBytes: 13_000_000 }), 'es').text)
      .toBe('12 de 21 capítulos en este teléfono · faltan 11,5 MB');
    // The English Bibles run to gigabytes.
    expect(getBibleAudioScopeCaption(status({ chapters: 1189, totalBytes: 5_500_000_000 }), 'en').text).toBe('5.50 GB');
    expect(
      getBibleAudioScopeCaption(status({ chapters: 1189, totalBytes: 5_500_000_000, downloading: true, downloadedBytes: 1_200_000_000 }), 'en').text,
    ).toBe('Downloading · 1.20 of 5.50 GB');
  });

  it('offer the book being read, the New Testament, and the whole Bible, each with its size', async () => {
    const screen = await renderSection();
    expect(screen.getByText('Listen offline')).toBeTruthy();
    expect(screen.getByText('John')).toBeTruthy();
    expect(screen.getByText(formatDownloadSize(SIZES['cuv-mandarin'].JHN, 'en'))).toBeTruthy();
    expect(screen.getByText('New Testament')).toBeTruthy();
    expect(screen.getByText(formatDownloadSize(sum(NEW_TESTAMENT_BOOKS.map((book) => SIZES['cuv-mandarin'][book])), 'en'))).toBeTruthy();
    expect(screen.getByText('Whole Bible')).toBeTruthy();
    expect(screen.getByText(formatDownloadSize(sum(Object.values(SIZES['cuv-mandarin'])), 'en'))).toBeTruthy();
  });

  it('show in Chinese', async () => {
    const screen = await renderSection(MANDARIN_READER, 'cmn_cuv', 'zh');
    expect(screen.getByText('離線收聽')).toBeTruthy();
    expect(screen.getByText('新約')).toBeTruthy();
    expect(screen.getByText('整本聖經')).toBeTruthy();
  });

  it("aren't offered for a narrator the app can't download, or on the web", async () => {
    expect((await renderSection('gilbert', 'BSB')).queryByText('Listen offline')).toBeNull();
    jest.replaceProperty(Platform, 'OS', 'web');
    expect((await renderSection()).queryByText('Listen offline')).toBeNull();
  });

  it('download on Wi-Fi at a tap, with an X that stops it', async () => {
    const screen = await renderSection();
    await fireEvent.press(screen.getByRole('button', { name: /^Download John,/ }));
    await act(async () => undefined);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(true);
    expect(screen.getByText(/^Downloading/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Stop downloading John' }));
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(false);
  });

  it('ask before using mobile data, and wait for Wi-Fi if the member says so', async () => {
    mockNetwork.state = { type: 'CELLULAR', isConnected: true, isInternetReachable: true };
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const screen = await renderSection();
    await fireEvent.press(screen.getByRole('button', { name: /^Download John,/ }));
    await act(async () => undefined);

    const [title, message, buttons] = alert.mock.calls[0];
    expect([title, message]).toEqual(['Use mobile data?', `You’re on mobile data. This download is ${formatDownloadSize(SIZES['cuv-mandarin'].JHN, 'en')}.`]);
    expect(buttons?.map(({ text }) => text)).toEqual(['Cancel', 'Wait for Wi-Fi', 'Use mobile data']);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(false);

    await act(async () => buttons?.[1].onPress?.());
    await act(async () => undefined);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN)).toMatchObject({ downloading: true, waitingFor: 'wifi' });
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });

  it('ask first before a download over 1 GB, even on Wi-Fi, as for the English whole Bible', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const souerBible = formatDownloadSize(sum(Object.values(SIZES.souer)), 'en');
    const screen = await renderSection('souer', 'BSB');
    await fireEvent.press(screen.getByRole('button', { name: /^Download Whole Bible,/ }));
    await act(async () => undefined);

    const [title, message, buttons] = alert.mock.calls[0];
    expect([title, message]).toEqual([`Download ${souerBible}?`, 'It takes a while, and stays on this phone until you delete it.']);
    expect(buttons?.map(({ text }) => text)).toEqual(['Cancel', 'Download']);
    expect(getBibleAudioScopeStatus('souer', { kind: 'bible' }).downloading).toBe(false);
    await act(async () => buttons?.[1].onPress?.());
    expect(getBibleAudioScopeStatus('souer', { kind: 'bible' }).downloading).toBe(true);

    // The Mandarin Bible is under 1 GB, so it starts at once.
    alert.mockClear();
    const mandarin = await renderSection();
    await fireEvent.press(mandarin.getByRole('button', { name: /^Download Whole Bible,/ }));
    await act(async () => undefined);
    expect(alert).not.toHaveBeenCalled();
    expect(getBibleAudioScopeStatus('cuv-mandarin', { kind: 'bible' }).downloading).toBe(true);
  });

  it("say so when the phone is offline or hasn't the room, and download nothing", async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockNetwork.state = { type: 'NONE', isConnected: false, isInternetReachable: false };
    let screen = await renderSection();
    await fireEvent.press(screen.getByRole('button', { name: /^Download John,/ }));
    await act(async () => undefined);
    expect(alert).toHaveBeenLastCalledWith('No connection', 'Connect to the internet to download.');

    mockNetwork.state = { type: 'WIFI', isConnected: true, isInternetReachable: true };
    mockDisk.availableBytes = 600_000_000;
    screen = await renderSection();
    await fireEvent.press(screen.getByRole('button', { name: /^Download Whole Bible,/ }));
    await act(async () => undefined);
    expect(alert.mock.lastCall?.[0]).toBe('Not enough space');
    expect(mockFiles.size).toBe(0);
    expect(getBibleAudioScopeStatus('cuv-mandarin', { kind: 'bible' }).downloading).toBe(false);
  });
});
