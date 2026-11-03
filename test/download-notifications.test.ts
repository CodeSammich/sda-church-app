import {
  askForDownloadNotifications,
  DOWNLOAD_NOTIFICATIONS_STORAGE_KEY,
  getDownloadNotificationsEnabled,
  getDownloadNotificationText,
  hasDownloadNotifications,
  loadDownloadNotifications,
  resetDownloadNotificationsForTests,
  setDownloadNotificationsEnabled,
} from '@/services/DownloadNotifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'node:fs';
import { Linking } from 'react-native';

// The app's first notifications (#610): only for a Bible audio download the
// member started, asked for at the first long one, and one switch in You.
const mockPermission = { status: 'undetermined', granted: false, canAskAgain: true };
const mockSystem = {
  ownNotifications: true,
  setNotificationOptions: jest.fn(async () => undefined),
  getNotificationPermission: jest.fn(async () => ({ ...mockPermission })),
  requestNotificationPermission: jest.fn(async () => ({ ...mockPermission, status: 'granted', granted: true })),
};
jest.mock('@/modules/bible-audio-downloads', () => ({ getBibleAudioSystemDownloads: () => mockSystem }));

beforeEach(async () => {
  resetDownloadNotificationsForTests();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  Object.assign(mockPermission, { status: 'undetermined', granted: false, canAskAgain: true });
  mockSystem.ownNotifications = true;
});

describe('download notifications', () => {
  it('hand the phone their words in the app’s language, and never ask at launch', async () => {
    await loadDownloadNotifications('zh');
    expect(mockSystem.setNotificationOptions).toHaveBeenLastCalledWith(true, getDownloadNotificationText('zh'));
    expect(getDownloadNotificationText('zh').progress).toBe('{done}／{total} 章');
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
    // Every language has every word, with the counts to fill in.
    for (const language of ['en', 'zh', 'zh-cn', 'es'] as const) {
      const text = getDownloadNotificationText(language);
      expect(Object.values(text).every(Boolean)).toBe(true);
      expect(text.progress).toMatch(/\{done\}.*\{total\}/);
      expect(text.channel).not.toBe(text.quietChannel);
    }
  });

  it('ask once, at the first long download, and not for a book', async () => {
    await loadDownloadNotifications('en');
    await askForDownloadNotifications(false);
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
    await askForDownloadNotifications(true);
    expect(mockSystem.requestNotificationPermission).toHaveBeenCalledTimes(1);
    // Whatever the answer, not again.
    await askForDownloadNotifications(true);
    expect(mockSystem.requestNotificationPermission).toHaveBeenCalledTimes(1);
  });

  it('not ask where the member turned them off, the phone won’t let it, or they’re already allowed', async () => {
    await loadDownloadNotifications('en');
    await setDownloadNotificationsEnabled(false);
    jest.clearAllMocks();
    await askForDownloadNotifications(true);
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();

    resetDownloadNotificationsForTests();
    await AsyncStorage.clear();
    await loadDownloadNotifications('en');
    Object.assign(mockPermission, { status: 'denied', granted: false, canAskAgain: false });
    await askForDownloadNotifications(true);
    Object.assign(mockPermission, { status: 'granted', granted: true, canAskAgain: true });
    await askForDownloadNotifications(true);
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it('turn off and on from You, kept for next time, and open Settings where the phone won’t let the app ask', async () => {
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    await loadDownloadNotifications('es');
    await setDownloadNotificationsEnabled(false);
    expect(getDownloadNotificationsEnabled()).toBe(false);
    expect(await AsyncStorage.getItem(DOWNLOAD_NOTIFICATIONS_STORAGE_KEY)).toBe('off');
    expect(mockSystem.setNotificationOptions).toHaveBeenLastCalledWith(false, getDownloadNotificationText('es'));

    resetDownloadNotificationsForTests();
    await loadDownloadNotifications('es');
    expect(getDownloadNotificationsEnabled()).toBe(false);

    // Back on, where the phone has said no for good: its settings.
    Object.assign(mockPermission, { status: 'denied', granted: false, canAskAgain: false });
    await setDownloadNotificationsEnabled(true);
    expect(settings).toHaveBeenCalledTimes(1);
    expect(mockSystem.setNotificationOptions).toHaveBeenLastCalledWith(true, getDownloadNotificationText('es'));
    // Where it may still ask, it asks.
    Object.assign(mockPermission, { status: 'undetermined', granted: false, canAskAgain: true });
    await setDownloadNotificationsEnabled(true);
    expect(mockSystem.requestNotificationPermission).toHaveBeenCalledTimes(1);
  });

  it('offer the switch only where the app has its own, not where Android’s download notification shows instead', () => {
    expect(hasDownloadNotifications()).toBe(true);
    mockSystem.ownNotifications = false;
    expect(hasDownloadNotifications()).toBe(false);
  });

  it('ask just before a long download starts on the page, and nowhere at launch', () => {
    const page = readFileSync('components/OfflineBibleAudio.tsx', 'utf8');
    expect(page).toContain("await askForDownloadNotifications(scope.kind !== 'book')");
    const layout = readFileSync('app/_layout.tsx', 'utf8');
    expect(layout).toContain('loadDownloadNotifications(language)');
    expect(layout).not.toContain('askForDownloadNotifications');
    expect(layout).not.toContain('requestNotificationPermission');
  });
});
