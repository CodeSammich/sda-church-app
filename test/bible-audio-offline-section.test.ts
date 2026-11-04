import {
  BibleAudioOfflineSection,
  getBibleAudioDownloadTipLine,
  getBibleAudioOfflineCaption,
} from '@/components/BibleAudioOfflineSection';
import { downloadBibleAudio, loadBibleAudioDownloads, resetBibleAudioDownloadsForTests } from '@/services/BibleAudioDownloads';
import { act, fireEvent } from '@testing-library/react-native';
import { File } from 'expo-file-system';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { AppState, Platform } from 'react-native';
import { mockChapterFile } from './helpers/bible-audio-chapter-files';
import { renderWithPreferences } from './helpers/render-preferences';

// "Listen offline" in the Bible audio settings popup (#556): one row that
// opens Offline Bible Audio in the You tab.
jest.mock('@/modules/backup-exclusion', () => ({ excludeFromBackup: jest.fn(() => true) }));
jest.mock('expo-network', () => ({
  NetworkStateType: { CELLULAR: 'CELLULAR', WIFI: 'WIFI' },
  getNetworkStateAsync: jest.fn(async () => ({ type: 'WIFI', isConnected: true, isInternetReachable: true })),
  addNetworkStateListener: jest.fn(() => ({ remove: jest.fn() })),
}));

const MANDARIN_READER = '基督徒团契 (Audio Power)';
const JOHN = { id: 'JHN', name: 'John' };
const styles = { divider: {}, helper: {}, row: {}, rowCaption: {}, rowLabel: {}, rowTitle: {}, sectionTitle: {} };

// Every chapter of a book on the phone, for one narrator.
const putOnPhone = (narrator: string, bookId: string, chapters: number) => {
  for (let chapter = 1; chapter <= chapters; chapter += 1) {
    mockChapterFile(`document/bible-audio/${narrator}/${bookId}/${chapter}.mp3`);
  }
  resetBibleAudioDownloadsForTests();
  loadBibleAudioDownloads();
};

const renderSection = (
  {
    reader = MANDARIN_READER,
    translationId = 'cmn_cuv',
    language = 'en' as 'en' | 'zh',
    onOpen = jest.fn(),
    showsTip = false,
  } = {},
) =>
  renderWithPreferences(
    createElement(BibleAudioOfflineSection, {
      book: language === 'zh' ? { id: 'JHN', name: '約翰福音' } : JOHN,
      onOpen,
      reader,
      showsTip,
      styles,
      textScale: 1.25,
      translationId,
    }),
    { language },
  );

beforeEach(() => {
  resetBibleAudioDownloadsForTests();
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active', writable: true });
});

describe('Listen offline', () => {
  it('say what is on the phone: nothing yet, the book being read, some books, the whole Bible, or a download going on', () => {
    expect(getBibleAudioOfflineCaption('cuv-mandarin', JOHN, 'en')).toBe('Download a book, a section, or the whole Bible');
    putOnPhone('cuv-mandarin', 'JUD', 1);
    expect(getBibleAudioOfflineCaption('cuv-mandarin', JOHN, 'en')).toBe('1 of 66 books downloaded');
    putOnPhone('cuv-mandarin', 'JHN', 21);
    expect(getBibleAudioOfflineCaption('cuv-mandarin', JOHN, 'en')).toBe('John downloaded');
    expect(getBibleAudioOfflineCaption('cuv-mandarin', { id: 'JHN', name: '約翰福音' }, 'zh')).toBe('已下載約翰福音');
    // Reading another book, it counts the books.
    expect(getBibleAudioOfflineCaption('cuv-mandarin', { id: 'GEN', name: 'Genesis' }, 'en')).toBe('2 of 66 books downloaded');
    // Another narrator's downloads are theirs.
    expect(getBibleAudioOfflineCaption('cuv-cantonese', JOHN, 'en')).toBe('Download a book, a section, or the whole Bible');

    jest.spyOn(File, 'downloadFileAsync').mockImplementation((() => new Promise(() => undefined)) as never);
    downloadBibleAudio('cuv-mandarin', { kind: 'book', bookId: 'MAT' });
    expect(getBibleAudioOfflineCaption('cuv-mandarin', JOHN, 'en')).toBe('Downloading…');
  });

  it('count part of a book as partly downloaded, and the whole Bible once it is all there', () => {
    mockChapterFile('document/bible-audio/rv1909/GEN/1.mp3');
    resetBibleAudioDownloadsForTests();
    loadBibleAudioDownloads();
    expect(getBibleAudioOfflineCaption('rv1909', undefined, 'es')).toBe('Descargado en parte');
  });

  it('open Offline Bible Audio at the narrator chosen above', async () => {
    const onOpen = jest.fn();
    const screen = await renderSection({ onOpen });
    expect(screen.getByText('Listen offline')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Offline Bible Audio, Download a book, a section, or the whole Bible' }));
    expect(onOpen).toHaveBeenCalledWith('cuv-mandarin');
    // No download rows, sizes or X here any more: those are on the page.
    expect(screen.queryByText('Whole Bible')).toBeNull();
    expect(screen.queryByRole('button', { name: /^Download / })).toBeNull();
  });

  it('show in Chinese', async () => {
    const screen = await renderSection({ language: 'zh' });
    expect(screen.getByText('離線收聽')).toBeTruthy();
    expect(screen.getByText('離線聖經音訊')).toBeTruthy();
    expect(screen.getByText('下載一卷書、一個部分或整本聖經')).toBeTruthy();
  });

  it('say why to download when playback keeps stopping to load (#595)', async () => {
    const tip = 'Playback often stops to load. Download to listen without waiting.';
    expect(getBibleAudioDownloadTipLine('en')).toBe(tip);
    expect((await renderSection()).queryByText(tip)).toBeNull();
    const screen = await renderSection({ showsTip: true });
    expect(screen.getByText(tip)).toBeTruthy();
    // Above the row it points to.
    expect(screen.getByRole('button', { name: /^Offline Bible Audio, / })).toBeTruthy();
    expect((await renderSection({ language: 'zh', showsTip: true })).getByText('播放時常停下來載入。下載後即可收聽，不必等待。')).toBeTruthy();

    // The key-screen checks fail a shot showing these, such as Android's
    // "keeps stopping" crash dialog.
    const { NEVER_SHOWN_BY_PLATFORM } = require('../scripts/check-screens.cjs');
    const reserved: string[] = [...NEVER_SHOWN_BY_PLATFORM.ios, ...NEVER_SHOWN_BY_PLATFORM.android];
    for (const language of ['en', 'zh', 'zh-cn', 'es'] as const) {
      const line = getBibleAudioDownloadTipLine(language);
      expect(reserved.filter((text) => line.includes(text))).toEqual([]);
    }
  });

  it("isn't offered for a narrator the app can't download, or on the web", async () => {
    expect((await renderSection({ reader: 'gilbert', translationId: 'BSB' })).queryByText('Listen offline')).toBeNull();
    jest.replaceProperty(Platform, 'OS', 'web');
    expect((await renderSection()).queryByText('Listen offline')).toBeNull();
  });

  it('closes the popup and opens the page with Back returning to the reader, at the book being read', () => {
    const source = readFileSync(join(__dirname, '..', 'app/(tabs)/bible/index.tsx'), 'utf8');
    const open = source.slice(source.indexOf('onOpen={(narrator) => {'), source.indexOf('reader={selectedAudioReader}'));
    expect(open).toContain('setAudioSettingsVisible(false);');
    expect(open).toMatch(/pathname: '\/you\/audio-downloads'/);
    expect(open).toMatch(/params: \{ backTo: '\/bible', narrator, bookId: book\?\.id \?\? '' \}/);
  });

  it('re-render as downloads change', async () => {
    const screen = await renderSection();
    expect(screen.getByText('Download a book, a section, or the whole Bible')).toBeTruthy();
    await act(async () => putOnPhone('cuv-mandarin', 'JHN', 21));
    // putOnPhone reloads the store, which tells the row.
    expect(screen.getByText('John downloaded')).toBeTruthy();
  });
});
