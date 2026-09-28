import type { AudioMetadata, AudioSource, AudioStatus } from 'expo-audio';

export interface BibleAudioChapterIdentity {
  bookId: string;
  chapter: number;
  translationId: string;
}

export interface BibleAudioQueueSource {
  metadata: AudioMetadata;
  source: AudioSource;
}

export interface BibleAudioQueueItem extends BibleAudioChapterIdentity {
  metadata: AudioMetadata;
  source: AudioSource;
  /** Alternate hosts for the same narration, in preferred retry order. */
  fallbacks?: BibleAudioQueueSource[];
}

export interface BibleAudioQueueControls {
  // Web and Android adapters own chapter queues; iOS uses the single player.
  setCurrentChapter?: (item: BibleAudioQueueItem) => void;
  setQueue?: (items: BibleAudioQueueItem[]) => void;
  setRemoteChapterHandlers?: (
    handlers?: {
      onNext?: (activeChapter?: BibleAudioChapterIdentity) => void;
      onPrevious?: (activeChapter?: BibleAudioChapterIdentity) => void;
    },
  ) => void;
}

export type BibleAudioStatus = Pick<
  AudioStatus,
  'currentTime' | 'didJustFinish' | 'duration' | 'isBuffering' | 'playing'
> & {
  activeChapter?: BibleAudioChapterIdentity;
  activeSourceUrl?: string;
  error?: string | null;
  interruptionCount?: number;
  isLoaded?: boolean;
  loadError?: boolean;
  reasonForWaitingToPlay?: string;
  timeControlStatus?: string;
};

/** A playback error, delivered once, as the player reports it. */
export interface BibleAudioSourceError {
  error: unknown;
  /** Playback position when the source failed, in seconds. */
  currentTime: number;
  /** The recording that failed, when the adapter knows it. */
  sourceUrl?: string;
  /** Android: the queued chapter that failed, with its alternate hosts. */
  chapter?: BibleAudioQueueItem;
}
