import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The line the Bible audio player shows while the phone has no connection and
 * the chapter isn't downloaded (#801). Without it the reading just stops: the
 * player shows 0:00 and a spinner, and nothing says that the network is why,
 * or that a downloaded chapter would have played. Meanwhile the player keeps
 * retrying, and plays by itself once the connection is back (see
 * BibleAudioFailover.ts). It takes the progress bar's place until audio plays:
 * one short line of text, not a button, since a small phone's player has no
 * room for another button. Its "not downloaded" is a link to a popup that says
 * how to listen offline, which also shows once by itself (BibleAudioOfflineTip.ts).
 * "Not downloaded" is worded as Offline Bible Audio words it (未下載, #822).
 */
const copy: Record<
  SupportedLanguage,
  Readonly<{
    connection: string;
    notDownloaded: string;
    /** The link's name for screen readers. */
    linkLabel: string;
    /** The popup the link, or the one-time tip, opens. */
    title: string;
    body: string;
    open: string;
    close: string;
  }>
> = {
  en: {
    connection: 'No connection',
    notDownloaded: 'not downloaded',
    linkLabel: 'Not downloaded. Open Offline Bible Audio',
    title: 'No connection',
    body: "This chapter isn't saved on your phone. Next time you're online, download chapters in Offline Bible Audio to listen anywhere.",
    open: 'Open Offline Bible Audio',
    close: 'Close',
  },
  zh: {
    connection: '沒有網路',
    notDownloaded: '未下載',
    linkLabel: '未下載。開啟離線聖經音訊',
    title: '沒有網路',
    body: '這一章沒有存在這部手機上。下次連上網路時，請在「離線聖經音訊」下載章節，在任何地方都能收聽。',
    open: '開啟離線聖經音訊',
    close: '關閉',
  },
  'zh-cn': {
    connection: '没有网络',
    notDownloaded: '未下载',
    linkLabel: '未下载。打开离线圣经音频',
    title: '没有网络',
    body: '这一章没有存在这部手机上。下次连接网络时，请在“离线圣经音频”下载章节，在任何地方都能收听。',
    open: '打开离线圣经音频',
    close: '关闭',
  },
  es: {
    connection: 'Sin conexión',
    notDownloaded: 'no descargado',
    linkLabel: 'No descargado. Abrir Audio bíblico sin conexión',
    title: 'Sin conexión',
    body: 'Este capítulo no está guardado en tu teléfono. La próxima vez que tengas conexión, descarga capítulos en Audio bíblico sin conexión para escucharlos en cualquier lugar.',
    open: 'Abrir Audio bíblico sin conexión',
    close: 'Cerrar',
  },
};

/** The words the line and its popup use, in the app's language. */
export const getBibleAudioOfflineCopy = (language: SupportedLanguage) => copy[language] ?? copy.en;

/** The whole line: "No connection · not downloaded". */
export const getBibleAudioOfflineLine = (language: SupportedLanguage) => {
  const { connection, notDownloaded } = getBibleAudioOfflineCopy(language);
  return `${connection} · ${notDownloaded}`;
};

/** Whether expo-network says the phone has no working connection. */
export const isOfflineNetworkState = (state: {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
}) => state.isConnected === false || state.isInternetReachable === false;

export type BibleAudioOfflineLineState = Readonly<{
  /** The listener pressed play and hasn't paused, so the player keeps trying. */
  listening: boolean;
  /** The recording can be heard: playing, and not stopped to load. */
  audible: boolean;
  offline: boolean;
  /** The chapter is on the phone (#556), so it plays without a connection. */
  downloaded: boolean;
}>;

/**
 * Whether the player shows the line: the listener is waiting for audio that
 * can't load. A drop the player rides out on what it has already loaded shows
 * nothing, and neither does a pause, after which nothing plays by itself.
 */
export const showsBibleAudioOfflineLine = ({
  listening,
  audible,
  offline,
  downloaded,
}: BibleAudioOfflineLineState) => listening && offline && !audible && !downloaded;
