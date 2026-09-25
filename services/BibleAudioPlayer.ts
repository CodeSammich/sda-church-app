import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';

import type {
  BibleAudioQueueControls,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

// iOS retains expo-audio's single player. Android uses the native playlist in
// BibleAudioPlayer.android.ts; web uses its rolling HTML media queue.
export const useBibleAudioPlayer = (...args: Parameters<typeof useAudioPlayer>) =>
  useAudioPlayer(...args) as AudioPlayer & BibleAudioQueueControls;

export const useBibleAudioPlayerStatus = (
  player: AudioPlayer & BibleAudioQueueControls,
) => useAudioPlayerStatus(player) as BibleAudioStatus;
