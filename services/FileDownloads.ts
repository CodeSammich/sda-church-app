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
): Download => {
  const controller = new AbortController();
  let reportedAt = 0;
  const promise = (async () => {
    folder.create({ intermediates: true, idempotent: true });
    // Into a separate file first: on Android, a download that fails part way
    // leaves what it got. Each download has its own, so one that's stopping
    // doesn't write into the next.
    const partial = new File(folder, `${name}.${Date.now()}.part`);
    await File.downloadFileAsync(url, partial, {
      idempotent: true,
      signal: controller.signal,
      onProgress: (progress) => {
        const now = Date.now();
        if (now - reportedAt < PROGRESS_INTERVAL_MS) return;
        reportedAt = now;
        listeners.forEach((listener) => listener(progress));
      },
    });
    partial.rename(name);
    return new File(folder, name);
  })().finally(() => {
    if (downloads.get(key)?.controller === controller) downloads.delete(key);
  });
  return { promise, listeners, controller };
};

/**
 * Downloads `url` into `folder` as `name`, replacing a file there. The file
 * appears only once the whole download has arrived. Aborting `signal` stops
 * the download, even one another request shares.
 */
export const downloadFile = (
  url: string,
  folder: Directory,
  name: string,
  { onProgress, signal }: { onProgress?: (progress: DownloadProgress) => void; signal?: AbortSignal } = {},
): Promise<File> => {
  const key = new File(folder, name).uri;
  let download = downloads.get(key);
  // Not one that's stopping, as when a popup's X is followed by another tap.
  if (download && !download.controller.signal.aborted) {
    if (onProgress) download.listeners.add(onProgress);
  } else {
    download = startDownload(url, folder, name, key, new Set(onProgress ? [onProgress] : []));
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
