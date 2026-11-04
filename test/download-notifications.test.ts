import {
  askForDownloadNotifications,
  DOWNLOAD_NOTIFICATIONS_STORAGE_KEY,
  getDownloadNotificationQuestion,
  getDownloadNotificationsEnabled,
  getDownloadNotificationsOn,
  getDownloadNotificationText,
  hasDownloadNotifications,
  loadDownloadNotifications,
  resetDownloadNotificationsForTests,
  setDownloadNotificationsEnabled,
} from '@/services/DownloadNotifications';
import { showAppAlert } from '@/components/AppAlert';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'node:fs';
import { Linking, Platform } from 'react-native';

// The app's first notifications (#610): only for a Bible audio download the
// member started, asked for at need with the app's own words first, and one
// switch on Offline Bible Audio. docs/UI_UX.md, "Notifications", is the policy.
jest.mock('@/components/AppAlert', () => ({ showAppAlert: jest.fn() }));
const mockPermission = { status: 'undetermined', granted: false, canAskAgain: true };
const mockSystem = {
  ownNotifications: true,
  setNotificationOptions: jest.fn(async () => undefined),
  getNotificationPermission: jest.fn(async () => ({ ...mockPermission })),
  requestNotificationPermission: jest.fn(async () => {
    Object.assign(mockPermission, { status: 'granted', granted: true, canAskAgain: false });
    return { ...mockPermission };
  }),
};
jest.mock('@/modules/bible-audio-downloads', () => ({ getBibleAudioSystemDownloads: () => mockSystem }));

// The app's question, answered: Allow, Not now, or a tap outside (Cancel).
const answer = async (ask: Promise<void>, choice: 'Allow' | 'Not now' | 'outside') => {
  await new Promise((resolve) => setTimeout(resolve, 0));
  const [, , buttons] = (showAppAlert as jest.Mock).mock.lastCall;
  const button =
    choice === 'outside'
      ? buttons.find(({ style }: { style?: string }) => style === 'cancel')
      : buttons.find(({ text }: { text: string }) => text === choice);
  button.onPress?.();
  await ask;
};

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
    expect(showAppAlert).not.toHaveBeenCalled();
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
    for (const language of ['en', 'zh', 'zh-cn', 'es'] as const) {
      const text = getDownloadNotificationText(language);
      expect(Object.values(text).every(Boolean)).toBe(true);
      expect(text.progress).toMatch(/\{done\}.*\{total\}/);
      expect(text.channel).not.toBe(text.quietChannel);
      const question = getDownloadNotificationQuestion(language);
      expect(Object.values(question).every(Boolean)).toBe(true);
    }
  });

  it('ask with the app’s own words first, saying the download goes on either way, then the phone’s only after Allow', async () => {
    await loadDownloadNotifications('en');
    await askForDownloadNotifications('book');
    expect(showAppAlert).not.toHaveBeenCalled();

    const ask = askForDownloadNotifications('section');
    await new Promise((resolve) => setTimeout(resolve, 0));
    const [title, message, buttons] = (showAppAlert as jest.Mock).mock.lastCall;
    const words = getDownloadNotificationQuestion('en');
    expect(title).toBe(Platform.OS === 'ios' ? words.iosTitle : words.title);
    expect(message).toContain('The download keeps going either way.');
    expect(message).toContain('You can turn this on or off here, under Download notifications.');
    expect(buttons.map(({ text }: { text: string }) => text)).toEqual(['Not now', 'Allow']);
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
    await answer(ask, 'Allow');
    expect(mockSystem.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(getDownloadNotificationsOn()).toBe(true);

    // Never again: the phone has been asked.
    await askForDownloadNotifications('bible');
    expect(showAppAlert).toHaveBeenCalledTimes(1);
  });

  it('after Not now, ask once more at most, at a Testament or the whole Bible', async () => {
    await loadDownloadNotifications('en');
    await answer(askForDownloadNotifications('section'), 'Not now');
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
    // Not at the next section.
    await askForDownloadNotifications('section');
    expect(showAppAlert).toHaveBeenCalledTimes(1);
    // Once more, at a Testament; a tap outside is Not now too.
    await answer(askForDownloadNotifications('testament'), 'outside');
    expect(showAppAlert).toHaveBeenCalledTimes(2);
    // And then never.
    await askForDownloadNotifications('bible');
    expect(showAppAlert).toHaveBeenCalledTimes(2);
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it('not ask where the member turned them off, the phone won’t let it, or they’re already allowed', async () => {
    await loadDownloadNotifications('en');
    await setDownloadNotificationsEnabled(false);
    jest.clearAllMocks();
    await askForDownloadNotifications('bible');

    resetDownloadNotificationsForTests();
    await AsyncStorage.clear();
    await loadDownloadNotifications('en');
    Object.assign(mockPermission, { status: 'denied', granted: false, canAskAgain: false });
    await askForDownloadNotifications('bible');
    Object.assign(mockPermission, { status: 'granted', granted: true, canAskAgain: false });
    await askForDownloadNotifications('bible');
    expect(showAppAlert).not.toHaveBeenCalled();
    expect(mockSystem.requestNotificationPermission).not.toHaveBeenCalled();
  });

  it('turn off and on from Offline Bible Audio, kept for next time, and open Settings where the phone won’t let the app ask', async () => {
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    Object.assign(mockPermission, { status: 'granted', granted: true, canAskAgain: false });
    await loadDownloadNotifications('es');
    expect(getDownloadNotificationsOn()).toBe(true);
    await setDownloadNotificationsEnabled(false);
    expect(getDownloadNotificationsEnabled()).toBe(false);
    expect(getDownloadNotificationsOn()).toBe(false);
    expect(await AsyncStorage.getItem(DOWNLOAD_NOTIFICATIONS_STORAGE_KEY)).toBe('off');
    expect(mockSystem.setNotificationOptions).toHaveBeenLastCalledWith(false, getDownloadNotificationText('es'));

    resetDownloadNotificationsForTests();
    await loadDownloadNotifications('es');
    expect(getDownloadNotificationsEnabled()).toBe(false);

    // Back on, where the phone has said no for good: its settings.
    Object.assign(mockPermission, { status: 'denied', granted: false, canAskAgain: false });
    await setDownloadNotificationsEnabled(true);
    expect(settings).toHaveBeenCalledTimes(1);
    expect(getDownloadNotificationsOn()).toBe(false);
    // Where it may still ask, it asks at once: the member chose it.
    Object.assign(mockPermission, { status: 'undetermined', granted: false, canAskAgain: true });
    await setDownloadNotificationsEnabled(true);
    expect(mockSystem.requestNotificationPermission).toHaveBeenCalledTimes(1);
    expect(showAppAlert).not.toHaveBeenCalled();
    expect(getDownloadNotificationsOn()).toBe(true);
  });

  it('offer the switch only where the app has its own, not where Android’s download notification shows instead', () => {
    expect(hasDownloadNotifications()).toBe(true);
    mockSystem.ownNotifications = false;
    expect(hasDownloadNotifications()).toBe(false);
  });

  it('ask just before a long download starts on the page, and nowhere at launch', () => {
    const page = readFileSync('components/OfflineBibleAudio.tsx', 'utf8');
    expect(page).toContain('await askForDownloadNotifications(scope.kind)');
    const layout = readFileSync('app/_layout.tsx', 'utf8');
    expect(layout).toContain('loadDownloadNotifications(language)');
    expect(layout).not.toContain('askForDownloadNotifications');
  });
});
