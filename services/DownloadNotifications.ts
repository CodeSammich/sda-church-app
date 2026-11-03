import { showAppAlert } from '@/components/AppAlert';
import type { SupportedLanguage } from '@/constants/LanguageContext';
import { getBibleAudioSystemDownloads, type DownloadNotificationText } from '@/modules/bible-audio-downloads';
import { setBibleAudioDownloadLanguage } from '@/services/BibleAudioDownloads';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking, Platform } from 'react-native';

/**
 * The app's notifications, its first (#610): only about a Bible audio download
 * the member started, as its progress, with Stop, and a word when it's done.
 * They're made on the phone; nothing is sent anywhere. docs/UI_UX.md has the
 * policy every notification follows.
 *
 * - Asked at need, never at launch: the first time a long download starts (a
 *   section or more), the app's own popup says what they're for, that the
 *   download goes on either way, and where to turn them off. Only Allow brings
 *   the phone's question, whose words the app can't change. After Not now, the
 *   app asks once more at most, at the next Testament or whole Bible.
 * - None is needed for a download to go on in the background: Android 14 and
 *   later show it in their Task Manager without leave, and Android 13 and lower
 *   and the iPhone need none.
 * - You → Download notifications turns them off.
 *
 * - Android 14 and later: the progress, with Stop, and done or waiting for
 *   Wi-Fi. Android requires one while a download runs out of sight, so with
 *   them off it's the quiet kind.
 * - iPhone: a word when it's done, as iOS shows no progress for it.
 * - Android 13 and lower: the system's own download notification, which the
 *   app doesn't change, so You has no switch there.
 */

export const DOWNLOAD_NOTIFICATIONS_STORAGE_KEY = 'downloadNotifications';
// Never asked; 'not-now' once; 'asked' after Allow, or Not now twice.
const ASKED_STORAGE_KEY = 'downloadNotificationsAsked';

/** The app's own question, before the phone's. */
const ASK: Readonly<
  Record<SupportedLanguage, Readonly<{ title: string; message: string; iosTitle: string; iosMessage: string; notNow: string; allow: string }>>
> = {
  en: {
    title: 'Show this download’s progress?',
    message: 'A notification shows how far it is, with Stop, and when it’s done. The download keeps going either way. You can turn this off in You.',
    iosTitle: 'Get a notice when it’s done?',
    iosMessage: 'The download keeps going either way. You can turn this off in You.',
    notNow: 'Not now',
    allow: 'Allow',
  },
  zh: {
    title: '顯示這次下載的進度？',
    message: '通知會顯示下載進度、「停止」按鈕，以及何時完成。不論是否允許，下載都會繼續。您可以在「您」頁面關閉。',
    iosTitle: '下載完成時通知您？',
    iosMessage: '不論是否允許，下載都會繼續。您可以在「您」頁面關閉。',
    notNow: '以後再說',
    allow: '允許',
  },
  'zh-cn': {
    title: '显示这次下载的进度？',
    message: '通知会显示下载进度、“停止”按钮，以及何时完成。无论是否允许，下载都会继续。您可以在“您”页面关闭。',
    iosTitle: '下载完成时通知您？',
    iosMessage: '无论是否允许，下载都会继续。您可以在“您”页面关闭。',
    notNow: '以后再说',
    allow: '允许',
  },
  es: {
    title: '¿Mostrar el progreso de esta descarga?',
    message: 'Una notificación muestra cuánto lleva, con Detener, y cuándo termina. La descarga sigue de todos modos. Puedes desactivarlo en Tú.',
    iosTitle: '¿Avisarte cuando termine?',
    iosMessage: 'La descarga sigue de todos modos. Puedes desactivarlo en Tú.',
    notNow: 'Ahora no',
    allow: 'Permitir',
  },
};

export const getDownloadNotificationQuestion = (language: SupportedLanguage) => ASK[language] ?? ASK.en;

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
let granted = false;
let language: SupportedLanguage = 'en';
const listeners = new Set<() => void>();

const system = () => getBibleAudioSystemDownloads();

/** Whether the phone shows the app's own download notifications, so You offers the switch. */
export const hasDownloadNotifications = () => !!system()?.ownNotifications && !!system()?.setNotificationOptions;

export const getDownloadNotificationsEnabled = () => enabled;

/** What You's switch shows: on only if the member wants them and the phone allows them. */
export const getDownloadNotificationsOn = () => enabled && granted;

/** Whether the phone allows them, as after the member changed it in Settings. */
export const refreshDownloadNotificationPermission = async () => {
  const permission = await system()?.getNotificationPermission?.().catch(() => null);
  granted = !!permission?.granted;
  listeners.forEach((listener) => listener());
};

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
  await refreshDownloadNotificationPermission();
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
  granted = permission.granted;
  listeners.forEach((listener) => listener());
  if (permission.granted) return;
  if (permission.canAskAgain) {
    // The member chose it here, so the phone's question comes at once.
    await AsyncStorage.setItem(ASKED_STORAGE_KEY, 'asked');
    await downloads.requestNotificationPermission?.();
    await refreshDownloadNotificationPermission();
  } else {
    await Linking.openSettings();
  }
};

/** How big a download is, for when to ask. */
export type DownloadSize = 'book' | 'section' | 'testament' | 'bible';

/**
 * The moment of need, before a long download starts: the app's question, then
 * the phone's, if the member says Allow. First at a section or more; after
 * Not now, once more at most, at a Testament or the whole Bible; never at
 * launch, and never once the phone has been asked.
 */
export const askForDownloadNotifications = async (size: DownloadSize) => {
  const downloads = system();
  if (size === 'book' || !enabled || !hasDownloadNotifications() || !downloads?.requestNotificationPermission) return;
  const asked = await AsyncStorage.getItem(ASKED_STORAGE_KEY).catch(() => 'asked');
  if (asked === 'asked' || (asked === 'not-now' && size === 'section')) return;
  const permission = await downloads.getNotificationPermission?.();
  if (!permission || permission.granted || !permission.canAskAgain) return;
  const words = getDownloadNotificationQuestion(language);
  const allow = await new Promise<boolean>((resolve) =>
    showAppAlert(
      Platform.OS === 'ios' ? words.iosTitle : words.title,
      Platform.OS === 'ios' ? words.iosMessage : words.message,
      [
        { text: words.notNow, style: 'cancel', onPress: () => resolve(false) },
        { text: words.allow, onPress: () => resolve(true) },
      ],
    ),
  );
  await AsyncStorage.setItem(ASKED_STORAGE_KEY, allow || asked === 'not-now' ? 'asked' : 'not-now');
  if (allow) {
    await downloads.requestNotificationPermission().catch(() => undefined);
    await refreshDownloadNotificationPermission();
  }
};

export const resetDownloadNotificationsForTests = () => {
  enabled = true;
  granted = false;
  language = 'en';
  listeners.clear();
};
