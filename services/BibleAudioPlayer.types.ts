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
  // The installed-PWA adapter owns the rolling chapter queue. Native builds use
  // expo-audio's player unless issue #126 requires a native Android fallback.
  setQueue?: (items: BibleAudioQueueItem[]) => void;
}

export type BibleAudioStatus = Pick<
  AudioStatus,
  'currentTime' | 'didJustFinish' | 'duration' | 'isBuffering' | 'playing'
> & {
  activeChapter?: BibleAudioChapterIdentity;
};
