import { requireOptionalNativeModule } from 'expo';

/**
 * Bible audio downloads the phone itself carries out (#611), so they go on
 * while it's locked or the app is in the background, and stay on Wi-Fi unless
 * the member allowed mobile data:
 *
 * - iPhone: two background URLSessions (ios/BibleAudioDownloadSessions.swift),
 *   one on Wi-Fi only, with no cellular and no expensive networks such as a
 *   phone's hotspot, and one on any network.
 * - Android: the system's DownloadManager
 *   (android/.../BibleAudioDownloadStore.kt), on unmetered Wi-Fi only unless
 *   allowed, with the system's one notification for the app's downloads.
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

/** One chapter: the app's name for it, where from, and the file it becomes. */
export type SystemDownload = Readonly<{ id: string; url: string; path: string }>;

/** A chapter still downloading or waiting. Finished ones aren't listed. */
export type SystemDownloadStatus = Readonly<{
  id: string;
  state: 'waiting' | 'running' | 'paused' | 'failed';
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
  /** Stops the chapters, and forgets them. Also clears a failed one. */
  cancel(ids: string[]): Promise<void>;
}>;

/** The phone's downloader, or null where there's none: the web, and tests. */
export const getBibleAudioSystemDownloads = () =>
  requireOptionalNativeModule<BibleAudioSystemDownloads>('BibleAudioDownloads');
