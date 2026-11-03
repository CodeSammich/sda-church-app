import { getBibleAudioScopeCaption } from '@/components/OfflineBibleAudio';
import BIBLE_AUDIO_DOWNLOAD_SIZES from '@/constants/BibleAudioDownloadSizes.json';
import { formatDownloadSize } from '@/constants/DownloadCopy';
import { customLightTheme } from '@/constants/Themes';
import {
  getBibleAudioScopeStatus,
  loadBibleAudioDownloads,
  resetBibleAudioDownloadsForTests,
  type BibleAudioScopeStatus,
} from '@/services/BibleAudioDownloads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, waitFor } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { createElement, type ComponentType } from 'react';
import { Alert, AppState } from 'react-native';
import { mockDisk, mockFiles } from './helpers/file-system-mock';
import { renderWithPreferences } from './helpers/render-preferences';

// Offline Bible Audio, in the You tab (#556): the one place Bible audio is
// downloaded and deleted, by narrator, as a tree of the whole Bible, its
// Testaments, their sections, and the books.
let mockParams: Record<string, string> = {};
let mockScreenOptions: Record<string, unknown> = {};
jest.mock('expo-router', () => ({
  Stack: {
    Screen: ({ options }: { options: Record<string, unknown> }) => {
      mockScreenOptions = options;
      return null;
    },
  },
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@/modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn(() => true) }));
const mockNetwork = { state: { type: 'WIFI', isConnected: true, isInternetReachable: true } };
jest.mock('expo-network', () => ({
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(async () => mockNetwork.state),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const OfflineBibleAudioScreen: ComponentType = require('@/app/(tabs)/you/audio-downloads').default;
const SIZES: Record<string, Record<string, number>> = BIBLE_AUDIO_DOWNLOAD_SIZES;
const sum = (narrator: string, books: string[]) => books.reduce((total, book) => total + SIZES[narrator][book], 0);
const size = (bytes: number, language: 'en' | 'zh' | 'es' = 'en') => formatDownloadSize(bytes, language);
const GOSPELS = ['MAT', 'MRK', 'LUK', 'JHN'];
const JOHN = { kind: 'book', bookId: 'JHN' } as const;

const status = (overrides: Partial<BibleAudioScopeStatus>): BibleAudioScopeStatus => ({
  books: 1,
  downloadedBooks: 0,
  chapters: 21,
  downloadedChapters: 0,
  downloadedBytes: 0,
  totalBytes: 24_500_000,
  downloading: false,
  active: false,
  waitingFor: null,
  ...overrides,
});

// Every chapter of a book on the phone, for one narrator, each 10,000 bytes.
const CHAPTER_BYTES = 10_000;
const putOnPhone = (narrator: string, bookId: string, chapters: number) => {
  for (let chapter = 1; chapter <= chapters; chapter += 1) {
    mockFiles.set(`document/bible-audio/${narrator}/${bookId}/${chapter}.mp3`, 'x'.repeat(CHAPTER_BYTES));
  }
  resetBibleAudioDownloadsForTests();
  loadBibleAudioDownloads();
};

const renderPage = async (params: Record<string, string> = {}, language: 'en' | 'zh' | 'es' = 'en') => {
  mockParams = params;
  const screen = await renderWithPreferences(createElement(OfflineBibleAudioScreen), { language, theme: customLightTheme });
  await act(async () => undefined);
  return screen;
};

const lastAlert = () => {
  const [title, message, buttons] = (Alert.alert as jest.Mock).mock.lastCall ?? [];
  return { title, message, buttons: (buttons ?? []) as { text: string; onPress?: () => void }[] };
};

beforeEach(async () => {
  resetBibleAudioDownloadsForTests();
  mockNetwork.state = { type: 'WIFI', isConnected: true, isInternetReachable: true };
  mockScreenOptions = {};
  await AsyncStorage.clear();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  jest.spyOn(File, 'downloadFileAsync').mockImplementation((async (_url: string, destination: File) => {
    // Never finishes, so each row stays downloading.
    await new Promise(() => undefined);
    return destination;
  }) as never);
});

describe('Offline Bible Audio', () => {
  it('say what each row holds: its size, its progress, what it waits for, part of it, or all of it', () => {
    expect(getBibleAudioScopeCaption(status({}), 'en').text).toBe('24.5 MB');
    expect(getBibleAudioScopeCaption(status({ books: 4, totalBytes: 210_000_000 }), 'en').text).toBe('4 books · 210.0 MB');
    expect(getBibleAudioScopeCaption(status({ books: 4, totalBytes: 210_000_000 }), 'zh').text).toBe('4 卷 · 210.0 MB');
    expect(getBibleAudioScopeCaption(status({ downloading: true, active: true, downloadedBytes: 5_100_000 }), 'en')).toEqual({
      text: 'Downloading · 5.1 of 24.5 MB',
      fraction: 5.1 / 24.5,
    });
    expect(getBibleAudioScopeCaption(status({ downloading: true, downloadedBytes: 5_100_000, waitingFor: 'wifi' }), 'en').text)
      .toBe('Waiting for Wi-Fi · 5.1 MB of 24.5 MB');
    expect(getBibleAudioScopeCaption(status({ downloading: true, waitingFor: 'connection' }), 'zh').text)
      .toBe('等待網路連線 · 0.0 MB / 24.5 MB');
    expect(getBibleAudioScopeCaption(status({ downloadedChapters: 21, downloadedBooks: 1, downloadedBytes: 24_600_000 }), 'en').text)
      .toBe('Downloaded · 24.6 MB');
    expect(getBibleAudioScopeCaption(status({ downloadedChapters: 12, downloadedBytes: 13_000_000 }), 'es').text)
      .toBe('Descargado en parte · faltan 11,5 MB');
    expect(
      getBibleAudioScopeCaption(
        status({ books: 27, downloadedBooks: 12, chapters: 260, downloadedChapters: 100, downloadedBytes: 400_000_000, totalBytes: 970_000_000 }),
        'en',
      ).text,
    ).toBe('12 of 27 books downloaded · 570.0 MB more');
    // The English Bibles run to gigabytes.
    expect(
      getBibleAudioScopeCaption(status({ books: 66, chapters: 1189, totalBytes: 5_500_000_000, downloading: true, active: true, downloadedBytes: 1_200_000_000 }), 'en').text,
    ).toBe('Downloading · 1.20 of 5.50 GB');
    // A book waiting its turn behind the three chapters downloading.
    expect(getBibleAudioScopeCaption(status({ downloading: true, totalBytes: 10_300_000 }), 'en')).toEqual({
      text: 'Waiting to download · 10.3 MB',
      fraction: null,
    });
    expect(getBibleAudioScopeCaption(status({ downloading: true, totalBytes: 10_300_000 }), 'zh').text).toBe('等待下載 · 10.3 MB');
  });

  it('show the whole Bible, both Testaments and their sections, with the sections closed, and the narrator', async () => {
    const screen = await renderPage({ narrator: 'cuv-mandarin' });
    expect(mockScreenOptions.title).toBe('Offline Bible Audio');
    expect(screen.getByText('Mandarin (Chinese Union Version)')).toBeTruthy();
    for (const title of ['Whole Bible', 'Old Testament', 'Law', 'History', 'Poetry and Wisdom', 'Major Prophets', 'Minor Prophets', 'New Testament', 'Gospels', 'Paul’s Letters', 'General Letters']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
    // Acts and Revelation are sections of one book: just the book.
    expect(screen.getByText('Acts')).toBeTruthy();
    expect(screen.getByText('Revelation')).toBeTruthy();
    expect(screen.queryByText('John')).toBeNull();
    expect(screen.getByText(`4 books · ${size(sum('cuv-mandarin', GOSPELS))}`)).toBeTruthy();
    expect(screen.getByText(`66 books · ${size(sum('cuv-mandarin', Object.keys(SIZES['cuv-mandarin'])))}`)).toBeTruthy();
  });

  it("open a section at a tap to show its books, and open the reader's book's section from the Bible", async () => {
    const screen = await renderPage({ narrator: 'cuv-mandarin' });
    await fireEvent.press(screen.getByRole('button', { name: /^Gospels, 4 books/ }));
    for (const book of ['Matthew', 'Mark', 'Luke', 'John']) expect(screen.getByText(book)).toBeTruthy();
    expect(screen.getByText(size(SIZES['cuv-mandarin'].JHN))).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: /^Gospels, 4 books/ }));
    expect(screen.queryByText('John')).toBeNull();

    const fromBible = await renderPage({ narrator: 'cuv-mandarin', bookId: 'LAM' });
    expect(fromBible.getByText('Lamentations')).toBeTruthy();
    expect(fromBible.queryByText('Matthew')).toBeNull();
  });

  it('show in Chinese', async () => {
    const screen = await renderPage({ narrator: 'cuv-mandarin', bookId: 'JHN' }, 'zh');
    expect(mockScreenOptions.title).toBe('離線聖經音訊');
    for (const title of ['國語（和合本）', '整本聖經', '舊約', '摩西五經', '新約', '福音書', '約翰福音', '使徒行傳']) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('download any row on Wi-Fi at a tap, with an X that stops it', async () => {
    const screen = await renderPage({ narrator: 'cuv-mandarin', bookId: 'JHN' });
    await fireEvent.press(screen.getByRole('button', { name: `Download John, ${size(SIZES['cuv-mandarin'].JHN)}` }));
    await act(async () => undefined);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Stop downloading John' }));
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(false);

    await fireEvent.press(screen.getByRole('button', { name: /^Download the Gospels, / }));
    await act(async () => undefined);
    expect(getBibleAudioScopeStatus('cuv-mandarin', { kind: 'section', sectionId: 'gospels' }).downloading).toBe(true);
    // Its books show it too; the New Testament around it doesn't.
    expect(screen.getByRole('button', { name: 'Stop downloading John' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop downloading the New Testament' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: /^Download the Old Testament, / }));
    await act(async () => undefined);
    expect(getBibleAudioScopeStatus('cuv-mandarin', { kind: 'testament', testament: 'old' }).downloading).toBe(true);
  });

  it('ask before using mobile data, and wait for Wi-Fi if the member says so', async () => {
    mockNetwork.state = { type: 'CELLULAR', isConnected: true, isInternetReachable: true };
    const screen = await renderPage({ narrator: 'cuv-mandarin', bookId: 'JHN' });
    await fireEvent.press(screen.getByRole('button', { name: /^Download John, / }));
    await act(async () => undefined);
    const { title, message, buttons } = lastAlert();
    expect([title, message]).toEqual(['Use mobile data?', `You’re on mobile data. This download is ${size(SIZES['cuv-mandarin'].JHN)}.`]);
    expect(buttons.map(({ text }) => text)).toEqual(['Cancel', 'Wait for Wi-Fi', 'Use mobile data']);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(false);
    await act(async () => buttons[1].onPress?.());
    await act(async () => undefined);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN)).toMatchObject({ downloading: true, waitingFor: 'wifi' });
    expect(File.downloadFileAsync).not.toHaveBeenCalled();
  });

  it('ask first before a download over 1 GB, even on Wi-Fi, as for the English whole Bible', async () => {
    const screen = await renderPage({ narrator: 'souer' });
    await fireEvent.press(screen.getByRole('button', { name: /^Download the whole Bible, / }));
    await act(async () => undefined);
    const { title, message, buttons } = lastAlert();
    expect([title, message]).toEqual([`Download ${size(sum('souer', Object.keys(SIZES.souer)))}?`, 'It takes a while, and stays on this phone until you delete it.']);
    expect(getBibleAudioScopeStatus('souer', { kind: 'bible' }).downloading).toBe(false);
    await act(async () => buttons[1].onPress?.());
    expect(getBibleAudioScopeStatus('souer', { kind: 'bible' }).downloading).toBe(true);

    // The Mandarin Bible is under 1 GB, so it starts at once.
    (Alert.alert as jest.Mock).mockClear();
    const mandarin = await renderPage({ narrator: 'cuv-mandarin' });
    await fireEvent.press(mandarin.getByRole('button', { name: /^Download the whole Bible, / }));
    await act(async () => undefined);
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(getBibleAudioScopeStatus('cuv-mandarin', { kind: 'bible' }).downloading).toBe(true);
  });

  it("say so when the phone is offline or hasn't the room, and download nothing", async () => {
    mockNetwork.state = { type: 'NONE', isConnected: false, isInternetReachable: false };
    let screen = await renderPage({ narrator: 'cuv-mandarin' });
    await fireEvent.press(screen.getByRole('button', { name: /^Download Acts, / }));
    await act(async () => undefined);
    expect(Alert.alert).toHaveBeenLastCalledWith('No connection', 'Connect to the internet to download.');

    mockNetwork.state = { type: 'WIFI', isConnected: true, isInternetReachable: true };
    mockDisk.availableBytes = 600_000_000;
    screen = await renderPage({ narrator: 'cuv-mandarin' });
    await fireEvent.press(screen.getByRole('button', { name: /^Download the whole Bible, / }));
    await act(async () => undefined);
    expect(lastAlert().title).toBe('Not enough space');
    expect(mockFiles.size).toBe(0);
    mockDisk.availableBytes = 64_000_000_000;
  });

  it('delete at every level, asking first with the scope and its size, and offer it only where something is downloaded', async () => {
    putOnPhone('cuv-mandarin', 'JHN', 21);
    putOnPhone('cuv-mandarin', 'MAT', 28);
    const screen = await renderPage({ narrator: 'cuv-mandarin', bookId: 'JHN' });
    expect(screen.queryByRole('button', { name: /^Delete the Old Testament/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Delete Mark/ })).toBeNull();
    expect(screen.getByText(`Downloaded · ${size(21 * CHAPTER_BYTES)}`)).toBeTruthy();
    expect(screen.getByText(/^2 of 4 books downloaded · /)).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Delete John' }));
    expect(lastAlert().title).toBe(`Delete John? (${size(21 * CHAPTER_BYTES)})`);
    expect(lastAlert().message).toBe('You can download it again later.');
    expect(lastAlert().buttons.map(({ text }) => text)).toEqual(['Cancel', 'Delete']);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete the Gospels' }));
    expect(lastAlert().title).toBe(`Delete the Gospels? (${size(49 * CHAPTER_BYTES)})`);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete the New Testament' }));
    expect(lastAlert().title).toBe(`Delete the New Testament? (${size(49 * CHAPTER_BYTES)})`);
    // Only some of the Bible: delete it all.
    await fireEvent.press(screen.getByRole('button', { name: 'Delete all downloads for Mandarin (Chinese Union Version)' }));
    expect(lastAlert().title).toBe(`Delete all downloads for Mandarin (Chinese Union Version)? (${size(49 * CHAPTER_BYTES)})`);

    // Cancel deletes nothing; Delete deletes that scope.
    await fireEvent.press(screen.getByRole('button', { name: 'Delete John' }));
    await act(async () => lastAlert().buttons[1].onPress?.());
    expect(screen.queryByRole('button', { name: 'Delete John' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Delete Matthew' })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete the Gospels' }));
    await act(async () => lastAlert().buttons[1].onPress?.());
    expect(screen.queryByRole('button', { name: /^Delete / })).toBeNull();
    expect(mockFiles.size).toBe(0);
  });

  it('say the size in the title in Chinese and Spanish', async () => {
    putOnPhone('cuv-mandarin', 'JHN', 21);
    const zh = await renderPage({ narrator: 'cuv-mandarin', bookId: 'JHN' }, 'zh');
    await fireEvent.press(zh.getByRole('button', { name: '刪除福音書' }));
    expect(lastAlert().title).toBe(`刪除福音書？（${size(21 * CHAPTER_BYTES, 'zh')}）`);
    const es = await renderPage({ narrator: 'cuv-mandarin', bookId: 'JHN' }, 'es');
    await fireEvent.press(es.getByRole('button', { name: 'Borrar los Evangelios' }));
    expect(lastAlert().title).toBe(`¿Borrar los Evangelios? (${size(21 * CHAPTER_BYTES, 'es')})`);
  });

  it('call the whole Bible by name once it is all on the phone', async () => {
    for (const [bookId, chapters] of require('@/services/BibleAudioSources').BIBLE_AUDIO_BOOKS) {
      for (let chapter = 1; chapter <= chapters; chapter += 1) {
        mockFiles.set(`document/bible-audio/rv1909/${bookId}/${chapter}.mp3`, 'x'.repeat(100));
      }
    }
    resetBibleAudioDownloadsForTests();
    loadBibleAudioDownloads();
    const screen = await renderPage({ narrator: 'rv1909' });
    await fireEvent.press(screen.getByRole('button', { name: 'Delete the whole Bible' }));
    expect(lastAlert().title).toBe(`Delete the whole Bible? (${size(1189 * 100)})`);
    expect(screen.queryByRole('button', { name: /^Download / })).toBeNull();
  });

  it('stop a download when deleting what holds it', async () => {
    putOnPhone('cuv-mandarin', 'MRK', 16);
    putOnPhone('cuv-mandarin', 'MAT', 28);
    const screen = await renderPage({ narrator: 'cuv-mandarin', bookId: 'JHN' });
    await fireEvent.press(screen.getByRole('button', { name: /^Download John, / }));
    await act(async () => undefined);
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete Matthew' }));
    await act(async () => lastAlert().buttons[1].onPress?.());
    // Deleting Matthew leaves John downloading; deleting the Gospels stops it.
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Delete the New Testament' }));
    await act(async () => lastAlert().buttons[1].onPress?.());
    expect(getBibleAudioScopeStatus('cuv-mandarin', JOHN).downloading).toBe(false);
    expect(mockFiles.size).toBe(0);
  });

  it("start at the narrator the Bible plays, and switch narrators, keeping others' downloads in view", async () => {
    await AsyncStorage.setItem('user-bible-translation', 'cmn_cuv');
    await AsyncStorage.setItem('user-bible-audio-readers', JSON.stringify({ cuv: 'WordProject Cantonese' }));
    putOnPhone('rv1909', 'JUD', 1);
    let screen = await renderPage();
    // An unknown saved narrator falls back to the first with downloads.
    await waitFor(() => expect(screen.getByText('Spanish (Reina-Valera 1909)')).toBeTruthy());

    await AsyncStorage.setItem('user-bible-audio-readers', JSON.stringify({ BSB: 'hays' }));
    await AsyncStorage.setItem('user-bible-translation', 'BSB');
    screen = await renderPage();
    await waitFor(() => expect(screen.getByText('English – Hays (BSB)')).toBeTruthy());
    expect(screen.getByText('Other narrators')).toBeTruthy();
    expect(screen.getByText('Spanish (Reina-Valera 1909)')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Delete all downloads for Spanish (Reina-Valera 1909)' }));
    expect(lastAlert().title).toBe(`Delete all downloads for Spanish (Reina-Valera 1909)? (${size(CHAPTER_BYTES)})`);

    await fireEvent.press(screen.getByRole('button', { name: 'Narrator: English – Hays (BSB). Change' }));
    expect(screen.getByRole('radio', { name: `Spanish (Reina-Valera 1909), Downloaded · ${size(CHAPTER_BYTES)}` })).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'English – David (BSB), Nothing downloaded' }));
    expect(screen.getByRole('button', { name: 'Narrator: English – David (BSB). Change' })).toBeTruthy();
  });

  it('start at the narrator the Bible saved, and by language when it saved none', async () => {
    await AsyncStorage.setItem('user-bible-translation', 'cmn_cuv');
    await AsyncStorage.setItem('user-bible-audio-readers', JSON.stringify({ cuv: require('@/services/BibleAudioSources').CANTONESE_CUV_READER }));
    let screen = await renderPage();
    await waitFor(() => expect(screen.getByText('Cantonese (Chinese Union Version)')).toBeTruthy());
    await AsyncStorage.clear();
    screen = await renderPage({}, 'es');
    await waitFor(() => expect(screen.getByText('Español (Reina-Valera 1909)')).toBeTruthy());
  });
});
