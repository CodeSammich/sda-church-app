import { Directory, File } from 'expo-file-system';
import { getNetworkStateAsync } from 'expo-network';

/**
 * Big files the phone downloads itself, with progress, as docs/UI_UX.md's
 * External Service Links section asks: the children's lesson PDFs (#529) and
 * Bible audio kept for listening offline (#556).
 */

/** `totalBytes` is -1 until the server says how big the file is. */
export type DownloadProgress = Readonly<{ bytesWritten: number; totalBytes: number }>;

const PROGRESS_INTERVAL_MS = 100;

/**
 * The sizes a download may finish at, in bytes. One that grows past `max` is
 * stopped, and one that finishes outside it is deleted: a Wi-Fi's sign-in
 * page, or a file cut off part way, is never kept as the file asked for.
 */
export type DownloadSizeRange = Readonly<{ min: number; max: number }>;

/** Why a download was turned down: its size was wrong. */
export class DownloadSizeError extends Error {
  constructor(readonly bytes: number) {
    super(`The download's size, ${bytes} bytes, isn't the file's`);
    this.name = 'DownloadSizeError';
  }
}

type Download = Readonly<{
  promise: Promise<File>;
  listeners: Set<(progress: DownloadProgress) => void>;
  controller: AbortController;
}>;

// Downloads under way, by the file they write, so two requests for the same
// file share one.
const downloads = new Map<string, Download>();

const startDownload = (
  url: string,
  folder: Directory,
  name: string,
  key: string,
  listeners: Set<(progress: DownloadProgress) => void>,
  sizeRange?: DownloadSizeRange,
): Download => {
  const controller = new AbortController();
  let reportedAt = 0;
  let tooBig = 0;
  // Into a separate file first: on Android, a download that fails part way
  // leaves what it got. Each download has its own, so one that's stopping
  // doesn't write into the next.
  const partial = new File(folder, `${name}.${Date.now()}.part`);
  const promise = (async () => {
    folder.create({ intermediates: true, idempotent: true });
    try {
      await File.downloadFileAsync(url, partial, {
        idempotent: true,
        signal: controller.signal,
        onProgress: (progress) => {
          const bytes = Math.max(progress.bytesWritten, progress.totalBytes);
          if (sizeRange && bytes > sizeRange.max) {
            tooBig = bytes;
            controller.abort();
            return;
          }
          const now = Date.now();
          if (now - reportedAt < PROGRESS_INTERVAL_MS) return;
          reportedAt = now;
          listeners.forEach((listener) => listener(progress));
        },
      });
      const bytes = partial.size;
      if (sizeRange && (bytes < sizeRange.min || bytes > sizeRange.max)) throw new DownloadSizeError(bytes);
    } catch (error) {
      // What a failed or stopped download got goes now, not when the app next starts.
      try {
        if (partial.exists) partial.delete();
      } catch {
        // The next start clears it.
      }
      throw tooBig ? new DownloadSizeError(tooBig) : error;
    }
    partial.rename(name);
    return new File(folder, name);
  })().finally(() => {
    if (downloads.get(key)?.controller === controller) downloads.delete(key);
  });
  return { promise, listeners, controller };
};

/**
 * Downloads `url` into `folder` as `name`, replacing a file there. The file
 * appears only once the whole download has arrived, and, given `sizeRange`,
 * only at a size within it; otherwise it rejects with a DownloadSizeError.
 * Aborting `signal` stops the download, even one another request shares.
 */
export const downloadFile = (
  url: string,
  folder: Directory,
  name: string,
  {
    onProgress,
    signal,
    sizeRange,
  }: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal; sizeRange?: DownloadSizeRange } = {},
): Promise<File> => {
  const key = new File(folder, name).uri;
  let download = downloads.get(key);
  // Not one that's stopping, as when a popup's X is followed by another tap.
  if (download && !download.controller.signal.aborted) {
    if (onProgress) download.listeners.add(onProgress);
  } else {
    download = startDownload(url, folder, name, key, new Set(onProgress ? [onProgress] : []), sizeRange);
    downloads.set(key, download);
  }
  const { controller, listeners, promise } = download;
  const stop = () => controller.abort();
  if (signal?.aborted) stop();
  signal?.addEventListener('abort', stop);
  return promise.finally(() => {
    if (onProgress) listeners.delete(onProgress);
    signal?.removeEventListener('abort', stop);
  });
};

/** Whether a download into `folder` is under way, so its `.part` file is in use. */
export const isDownloadingInto = (folder: Directory) =>
  [...downloads.keys()].some((key) => key.startsWith(`${folder.uri.replace(/\/$/, '')}/`));

/**
 * Whether the phone is offline. Ask it only after a download fails, so a
 * network that wrongly reports no internet can't stop one that would have
 * worked.
 */
export const isPhoneOffline = async () => {
  try {
    const network = await getNetworkStateAsync();
    return network.isConnected === false || network.isInternetReachable === false;
  } catch {
    return false;
  }
};
