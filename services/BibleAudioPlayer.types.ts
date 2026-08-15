import type { AudioMetadata, AudioSource, AudioStatus } from 'expo-audio';

export interface BibleAudioChapterIdentity {
  bookId: string;
  chapter: number;
  translationId: string;
}

export interface BibleAudioQueueItem extends BibleAudioChapterIdentity {
  metadata: AudioMetadata;
  source: AudioSource;
}

export interface BibleAudioQueueControls {
  // Implemented by the web adapter. Optional until the native adapter gains a
  // foreground-service-compatible queue (tracked in issue #126).
  setQueue?: (items: BibleAudioQueueItem[]) => void;
}

export type BibleAudioStatus = Pick<
  AudioStatus,
  'currentTime' | 'didJustFinish' | 'duration' | 'isBuffering' | 'playing'
> & {
  activeChapter?: BibleAudioChapterIdentity;
};
