import { requireOptionalNativeModule } from 'expo';

/**
 * Bible audio downloads the phone itself carries out (#611), so they go on
 * while it's locked or the app is in the background, and stay on Wi-Fi unless
 * the member allowed mobile data:
 *
 * - iPhone: two background URLSessions (ios/BibleAudioDownloadSessions.swift),
 *   one on Wi-Fi only, with no cellular and no expensive networks such as a
 *   phone's hotspot, and one on any network.
 * - Android 14 and later: the app's own user-initiated data transfer jobs
 *   (android/.../BibleAudioTransfers.kt), on unmetered Wi-Fi only unless
 *   allowed, with the app's notification (#610). Android doesn't hold these to
 *   the hour's quota it puts on an app's background jobs, which held a locked
 *   phone on battery to about 75 chapters an hour.
 * - Android 13 and lower: the system's DownloadManager
 *   (android/.../BibleAudioDownloadStore.kt), likewise, with the system's one
 *   notification for the app's downloads.
 *
 * Each finished chapter is moved into the app's documents folder, at the path
 * asked for, even when the app's JavaScript isn't running, so the app finds it
 * there (services/BibleAudioDownloads.ts).
 *
 * Custom code, to remove once Expo can do it (#612): Expo SDK 58's
 * DownloadTask has no Wi-Fi-only setting for its background session on iOS,
 * and no background session on Android. test/bible-audio-system-downloads.test.ts
 * fails once expo-file-system offers one.
 */

/**
 * One chapter: the app's name for it, where from, and the file it becomes;
 * where else from, if that fails, what it's part of for its notification, as
 * "English – Souer (BSB)", and about how big it is.
 */
export type SystemDownload = Readonly<{
  id: string;
  url: string;
  path: string;
  fallbacks?: readonly string[];
  group?: string;
  bytes?: number;
}>;

/** A chapter still downloading or waiting. Finished ones aren't listed. */
export type SystemDownloadStatus = Readonly<{
  id: string;
  /** `stopped`: by Stop on its notification, which the app treats as the member's stop. */
  state: 'waiting' | 'running' | 'paused' | 'failed' | 'stopped';
  /** Android's reason a download is paused. iOS doesn't say, and leaves it out. */
  reason?: 'wifi' | 'network' | 'retry' | 'paused' | null;
  bytesWritten: number;
  /** -1 until the server says. */
  totalBytes: number;
  /** Whether it may use mobile data. */
  mobileData: boolean;
}>;

export type BibleAudioSystemDownloads = Readonly<{
  /** Starts the chapters, in place of any already downloading under the same names. */
  enqueue(downloads: SystemDownload[], allowMobileData: boolean): Promise<void>;
  list(): Promise<SystemDownloadStatus[]>;
  /** Stops the chapters, and forgets them. Also clears a failed or stopped one. */
  cancel(ids: string[]): Promise<void>;
  /** Whether a failed chapter has been tried from every source it was given, not just the first. */
  triesEverySource?: boolean;
  /** Whether the app's own notifications show a download: no on Android 13 and lower, whose system shows its own. */
  ownNotifications?: boolean;
  /** The member's choice on Offline Bible Audio, and the notifications' words in the app's language. */
  setNotificationOptions?(enabled: boolean, text: DownloadNotificationText): Promise<void>;
  getNotificationPermission?(): Promise<NotificationPermission>;
  /** Asks, if the phone still lets the app ask. */
  requestNotificationPermission?(): Promise<NotificationPermission>;
}>;

export type NotificationPermission = Readonly<{
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
}>;

/** The words of a download's notifications; `{done}` and `{total}` are filled in. */
export type DownloadNotificationText = Readonly<{
  channel: string;
  quietChannel: string;
  progress: string;
  waitingForWifi: string;
  waitingForConnection: string;
  done: string;
  stopped: string;
  stop: string;
}>;

/** The phone's downloader, or null where there's none: the web, and tests. */
export const getBibleAudioSystemDownloads = () =>
  requireOptionalNativeModule<BibleAudioSystemDownloads>('BibleAudioDownloads');
