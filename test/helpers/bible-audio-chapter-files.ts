import { getBibleAudioChapterBytes } from '@/services/BibleAudioDownloadSizes';
import { mockFiles, mockFileSizes } from './file-system-mock';

/**
 * Writes a Bible audio chapter at `path`, or the partial file a download of it
 * writes, at its recording's size (constants/BibleAudioDownloadSizes.json), as
 * a real download does: the app keeps a chapter only at about that size.
 * `text` is what tests read back, as the address it came from.
 */
export const mockChapterFile = (path: string, text = path) => {
  mockFiles.set(path, text);
  const match = /bible-audio\/([^/]+)\/([^/]+)\/(\d+)\.mp3/.exec(path);
  const bytes = match && getBibleAudioChapterBytes(match[1], match[2], Number(match[3]));
  if (bytes) mockFileSizes.set(path, bytes);
  else mockFileSizes.delete(path);
};

/** A chapter's recorded size, which must be known. */
export const chapterBytes = (narrator: string, bookId: string, chapter: number) => {
  const bytes = getBibleAudioChapterBytes(narrator, bookId, chapter);
  if (!bytes) throw new Error(`No size for ${narrator} ${bookId} ${chapter}`);
  return bytes;
};
