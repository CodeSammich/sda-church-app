import {
  getBibleAudioDownloadsVersion,
  getDownloadedChapterUri,
  listDownloadedBibleAudio,
  loadBibleAudioDownloads,
  subscribeBibleAudioDownloads,
} from '@/services/BibleAudioDownloads';
import { useCallback, useEffect, useSyncExternalStore } from 'react';

/**
 * Re-renders whenever Bible audio downloaded for listening offline (#556)
 * changes: a chapter arrives or is deleted, or a download's progress moves,
 * a few times a second. For lists and progress, not the whole Bible screen.
 */
export function useBibleAudioDownloads() {
  useEffect(loadBibleAudioDownloads, []);
  return useSyncExternalStore(subscribeBibleAudioDownloads, getBibleAudioDownloadsVersion);
}

/**
 * The phone's copy of one chapter, or null. Re-renders only when that changes,
 * so the Bible screen doesn't redraw with every download's progress.
 */
export function useDownloadedChapterUri(narrator: string | null, bookId: string | undefined, chapter: number) {
  useEffect(loadBibleAudioDownloads, []);
  const getUri = useCallback(
    () => (bookId ? getDownloadedChapterUri(narrator, bookId, chapter) : null),
    [narrator, bookId, chapter],
  );
  return useSyncExternalStore(subscribeBibleAudioDownloads, getUri);
}

const getDownloadedBytes = () =>
  listDownloadedBibleAudio().reduce((total, narrator) => total + narrator.bytes, 0);

/** How much downloaded Bible audio is on the phone, in bytes. Re-renders only when that changes. */
export function useDownloadedBibleAudioBytes() {
  useEffect(loadBibleAudioDownloads, []);
  return useSyncExternalStore(subscribeBibleAudioDownloads, getDownloadedBytes);
}
