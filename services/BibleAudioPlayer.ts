import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';

import type {
  BibleAudioQueueControls,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

// Native builds use expo-audio's single active player. The Bible screen keeps
// the native path deliberately separate from the installed-PWA rolling queue;
// native buffering and chapter transitions are recovered by that screen's
// explicit playback state instead of swapping between native player objects.
export const useBibleAudioPlayer = (...args: Parameters<typeof useAudioPlayer>) =>
  useAudioPlayer(...args) as AudioPlayer & BibleAudioQueueControls;

export const useBibleAudioPlayerStatus = (
  player: AudioPlayer & BibleAudioQueueControls,
) => useAudioPlayerStatus(player) as BibleAudioStatus;
