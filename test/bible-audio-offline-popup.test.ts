import { BibleAudioOfflinePopup } from '@/components/BibleAudioOfflinePopup';
import {
  hasHadBibleAudioDownloads,
  loadBibleAudioTip,
  noteBibleAudioDownloaded,
  resetBibleAudioTipForTests,
} from '@/services/BibleAudioDownloadTip';
import { getBibleAudioOfflineCopy, getBibleAudioOfflineLine } from '@/services/BibleAudioOfflineLine';
import {
  BIBLE_AUDIO_OFFLINE_TIP_STORAGE_KEY,
  loadBibleAudioOfflineTip,
  noteBibleAudioOfflineTipShown,
  resetBibleAudioOfflineTipForTests,
  shouldShowBibleAudioOfflineTip,
} from '@/services/BibleAudioOfflineTip';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fireEvent } from '@testing-library/react-native';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderWithPreferences } from './helpers/render-preferences';

// The line's "not downloaded" opens a popup about listening offline, which
// also shows once by itself the first time the connection drops (#801).
const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');

beforeEach(async () => {
  await AsyncStorage.clear();
  resetBibleAudioOfflineTipForTests();
  resetBibleAudioTipForTests();
});

describe('the popup', () => {
  it('says why, and where to download, in each app language, with the X and one button', () => {
    expect(getBibleAudioOfflineCopy('en')).toMatchObject({
      title: 'No connection',
      body: "This chapter isn't saved on your phone. Next time you're online, download chapters in Offline Bible Audio to listen anywhere.",
      open: 'Open Offline Bible Audio',
    });
    expect(getBibleAudioOfflineCopy('zh')).toMatchObject({ title: '沒有網路', open: '開啟離線聖經音訊' });
    expect(getBibleAudioOfflineCopy('zh').body).toContain('「離線聖經音訊」');
    expect(getBibleAudioOfflineCopy('zh-cn')).toMatchObject({ title: '没有网络', open: '打开离线圣经音频' });
    expect(getBibleAudioOfflineCopy('es')).toMatchObject({
      title: 'Sin conexión',
      open: 'Abrir Audio bíblico sin conexión',
    });
    // The line is still the short one.
    expect(getBibleAudioOfflineLine('zh')).toBe('沒有網路 · 未下載');
  });

  it('opens Offline Bible Audio from its button, and closes from its X', async () => {
    const onOpen = jest.fn();
    const onClose = jest.fn();
    const screen = await renderWithPreferences(
      createElement(BibleAudioOfflinePopup, { visible: true, onOpen, onClose }),
      { language: 'zh' },
    );
    expect(screen.getByText('沒有網路')).toBeTruthy();
    expect(screen.getByText(getBibleAudioOfflineCopy('zh').body)).toBeTruthy();
    fireEvent.press(screen.getByText('開啟離線聖經音訊'));
    expect(onOpen).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByLabelText('關閉'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // Its one button sits in the middle, not at Paper's end.
    expect(readFileSync('components/BibleAudioOfflinePopup.tsx', 'utf8')).toMatch(
      /actions: \{ justifyContent: 'center',/,
    );
  });

  it("opens from the line's link, which names where it leads, and opens the book being read", () => {
    expect(bible).toMatch(
      /accessibilityRole="link"\s+accessibilityLabel=\{audioOfflineCopy\.linkLabel\}\s+onPress=\{\(\) => setAudioOfflinePopupVisible\(true\)\}/,
    );
    expect(getBibleAudioOfflineCopy('en').linkLabel).toBe('Not downloaded. Open Offline Bible Audio');
    // A 44-point target, in a row as tall, so it never reaches the buttons above.
    expect(bible).toContain('minHeight: Math.max(dockLayout.audioTimelineHeight, MIN_TAP_TARGET)');
    expect(bible).toMatch(/audioOfflineLink: \{\s*justifyContent: 'center',\s*minHeight: MIN_TAP_TARGET,/);
    expect(bible).toMatch(
      /pathname: '\/you\/audio-downloads',\s*params: \{ backTo: '\/bible', narrator: audioDownloadNarrator \?\? '', bookId: book\?\.id \?\? '' \},/,
    );
  });
});

describe('the one-time tip', () => {
  const allowed = { appActive: true, chapterDownloaded: false, hasEverDownloaded: false };

  it('shows once, ever, and never after the app restarts', async () => {
    await loadBibleAudioOfflineTip();
    expect(shouldShowBibleAudioOfflineTip(allowed)).toBe(true);
    noteBibleAudioOfflineTipShown();
    expect(shouldShowBibleAudioOfflineTip(allowed)).toBe(false);
    expect(await AsyncStorage.getItem(BIBLE_AUDIO_OFFLINE_TIP_STORAGE_KEY)).toBe('shown');
    resetBibleAudioOfflineTipForTests();
    await loadBibleAudioOfflineTip();
    expect(shouldShowBibleAudioOfflineTip(allowed)).toBe(false);
  });

  it('never shows in the background, for a downloaded chapter, or after any download', async () => {
    await loadBibleAudioOfflineTip();
    expect(shouldShowBibleAudioOfflineTip({ ...allowed, appActive: false })).toBe(false);
    expect(shouldShowBibleAudioOfflineTip({ ...allowed, chapterDownloaded: true })).toBe(false);
    expect(shouldShowBibleAudioOfflineTip({ ...allowed, hasEverDownloaded: true })).toBe(false);
  });

  it("doesn't show before it knows whether it has been shown", () => {
    expect(shouldShowBibleAudioOfflineTip(allowed)).toBe(false);
  });

  it('counts audio downloaded once and deleted since as downloaded', async () => {
    await loadBibleAudioTip();
    expect(hasHadBibleAudioDownloads()).toBe(false);
    noteBibleAudioDownloaded();
    expect(hasHadBibleAudioDownloads()).toBe(true);
  });

  it('shows the same popup on the Bible screen, only with the app open, and says so for the e2e', () => {
    const drop = bible.slice(bible.indexOf('onDrop: () => {'));
    const handler = drop.slice(0, drop.indexOf('\n    },\n'));
    expect(handler).toContain("appActive: AppState.currentState === 'active'");
    expect(handler).toContain('chapterDownloaded: !!downloadedAudioUriRef.current');
    expect(handler).toContain('hasEverDownloaded: hasDownloadedBibleAudio || hasHadBibleAudioDownloads()');
    expect(handler).toContain('noteBibleAudioOfflineTipShown();');
    expect(handler).toContain('setAudioOfflinePopupVisible(true);');
  });
});
