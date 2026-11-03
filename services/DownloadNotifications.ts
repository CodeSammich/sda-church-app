import type { SupportedLanguage } from '@/constants/LanguageContext';
import { getBibleAudioSystemDownloads, type DownloadNotificationText } from '@/modules/bible-audio-downloads';
import { setBibleAudioDownloadLanguage } from '@/services/BibleAudioDownloads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';

/**
 * The app's notifications, its first (#610): only about a Bible audio download
 * the member started, as its progress, with Stop, and a word when it's done.
 * The app asks the phone's leave the first time a long download starts (a
 * section or more), never at launch, and You → Download notifications turns
 * them off. They're made on the phone; nothing is sent anywhere.
 *
 * - Android 14 and later: the progress, with Stop, and done or waiting for
 *   Wi-Fi. Android requires one while a download runs out of sight, so with
 *   them off it's the quiet kind.
 * - iPhone: a word when it's done, as iOS shows no progress for it.
 * - Android 13 and lower: the system's own download notification, which the
 *   app doesn't change, so You has no switch there.
 */

export const DOWNLOAD_NOTIFICATIONS_STORAGE_KEY = 'downloadNotifications';
const ASKED_STORAGE_KEY = 'downloadNotificationsAsked';

const TEXT: Readonly<Record<SupportedLanguage, DownloadNotificationText>> = {
  en: {
    channel: 'Bible audio downloads',
    quietChannel: 'Bible audio downloads (quiet)',
    progress: '{done} of {total} chapters',
    waitingForWifi: 'Waiting for Wi-Fi',
    waitingForConnection: 'Waiting for a connection',
    done: 'Downloaded',
    stopped: 'Couldn’t download. Open the app to try again.',
    stop: 'Stop',
  },
  zh: {
    channel: '聖經音訊下載',
    quietChannel: '聖經音訊下載（靜音）',
    progress: '{done}／{total} 章',
    waitingForWifi: '等待 Wi-Fi',
    waitingForConnection: '等待網路連線',
    done: '已下載',
    stopped: '無法下載。請開啟應用程式再試一次。',
    stop: '停止',
  },
  'zh-cn': {
    channel: '圣经音频下载',
    quietChannel: '圣经音频下载（静音）',
    progress: '{done}／{total} 章',
    waitingForWifi: '等待 Wi-Fi',
    waitingForConnection: '等待网络连接',
    done: '已下载',
    stopped: '无法下载。请打开应用再试一次。',
    stop: '停止',
  },
  es: {
    channel: 'Descargas de audio bíblico',
    quietChannel: 'Descargas de audio bíblico (silenciosas)',
    progress: '{done} de {total} capítulos',
    waitingForWifi: 'Esperando Wi-Fi',
    waitingForConnection: 'Esperando conexión',
    done: 'Descargado',
    stopped: 'No se pudo descargar. Abre la app para volver a intentarlo.',
    stop: 'Detener',
  },
};

export const getDownloadNotificationText = (language: SupportedLanguage) => TEXT[language] ?? TEXT.en;

let enabled = true;
let language: SupportedLanguage = 'en';
const listeners = new Set<() => void>();

const system = () => getBibleAudioSystemDownloads();

/** Whether the phone shows the app's own download notifications, so You offers the switch. */
export const hasDownloadNotifications = () => !!system()?.ownNotifications && !!system()?.setNotificationOptions;

export const getDownloadNotificationsEnabled = () => enabled;

export const subscribeDownloadNotifications = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const apply = () => system()?.setNotificationOptions?.(enabled, getDownloadNotificationText(language));

/** From the app's root: the member's choice, and the words in the app's language. */
export const loadDownloadNotifications = async (appLanguage: SupportedLanguage) => {
  language = appLanguage;
  setBibleAudioDownloadLanguage(appLanguage);
  enabled = (await AsyncStorage.getItem(DOWNLOAD_NOTIFICATIONS_STORAGE_KEY).catch(() => null)) !== 'off';
  listeners.forEach((listener) => listener());
  await apply();
};

/**
 * The switch in You. Turned on where the phone won't let the app ask again,
 * it opens the app's settings, where the member can allow them.
 */
export const setDownloadNotificationsEnabled = async (value: boolean) => {
  enabled = value;
  listeners.forEach((listener) => listener());
  await AsyncStorage.setItem(DOWNLOAD_NOTIFICATIONS_STORAGE_KEY, value ? 'on' : 'off');
  await apply();
  const downloads = system();
  if (!value || !downloads?.getNotificationPermission) return;
  const permission = await downloads.getNotificationPermission();
  if (permission.granted) return;
  if (permission.canAskAgain) {
    await AsyncStorage.setItem(ASKED_STORAGE_KEY, '1');
    await downloads.requestNotificationPermission?.();
  } else {
    await Linking.openSettings();
  }
};

/**
 * The moment of need: before the first long download, a section or more,
 * asks once for the phone's leave. Never at launch, and never again after
 * the member answered.
 */
export const askForDownloadNotifications = async (long: boolean) => {
  const downloads = system();
  if (!long || !enabled || !hasDownloadNotifications() || !downloads?.requestNotificationPermission) return;
  if (await AsyncStorage.getItem(ASKED_STORAGE_KEY).catch(() => '1')) return;
  const permission = await downloads.getNotificationPermission?.();
  if (!permission || permission.granted || !permission.canAskAgain) return;
  await AsyncStorage.setItem(ASKED_STORAGE_KEY, '1');
  await downloads.requestNotificationPermission().catch(() => undefined);
};

export const resetDownloadNotificationsForTests = () => {
  enabled = true;
  language = 'en';
  listeners.clear();
};
