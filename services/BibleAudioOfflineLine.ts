import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The line the Bible audio player shows while the phone has no connection and
 * the chapter isn't downloaded (#801). Without it the reading just stops: the
 * player shows 0:00 and a spinner, and nothing says that the network is why,
 * that the chapter plays by itself once the connection is back (the player
 * keeps retrying while the listener listens; see BibleAudioFailover.ts), or
 * that a downloaded chapter would have played. It takes the progress bar's
 * place until audio plays: a line of text, not a button, since a small phone's
 * player has no room for another button.
 */
const copy: Record<SupportedLanguage, string> = {
  en: "No connection: this chapter isn't downloaded. It will play once you're back online.",
  zh: '沒有網路連線：本章尚未下載，恢復連線後會自動播放。',
  'zh-cn': '没有网络连接：本章尚未下载，恢复连接后会自动播放。',
  es: 'Sin conexión: este capítulo no está descargado. Se reproducirá cuando vuelva la conexión.',
};

export const getBibleAudioOfflineLine = (language: SupportedLanguage) => copy[language] ?? copy.en;

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
