import type { SupportedLanguage } from '@/constants/LanguageContext';

/**
 * The line the Bible audio player shows while the phone has no connection and
 * the chapter isn't downloaded (#801). Without it the reading just stops: the
 * player shows 0:00 and a spinner, and nothing says that the network is why,
 * or that a downloaded chapter would have played. Meanwhile the player keeps
 * retrying, and plays by itself once the connection is back (see
 * BibleAudioFailover.ts). It takes the progress bar's place until audio plays:
 * one short line of text, not a button, since a small phone's player has no
 * room for another button. "Not downloaded" is worded as Offline Bible Audio
 * words it (未下載, #822).
 */
const copy: Record<SupportedLanguage, string> = {
  en: 'No connection · not downloaded',
  zh: '沒有網路 · 未下載',
  'zh-cn': '没有网络 · 未下载',
  es: 'Sin conexión · no descargado',
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
