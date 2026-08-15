import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';

import type {
  BibleAudioQueueControls,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

// Native builds continue to use expo-audio's foreground-capable AudioPlayer.
// Its single-player API does not own the installed-PWA rolling queue; native
// queue behavior remains a fallback in issue #126 if Android Chrome cannot
// sustain longer background sessions.
export const useBibleAudioPlayer = (...args: Parameters<typeof useAudioPlayer>) =>
  useAudioPlayer(...args) as AudioPlayer & BibleAudioQueueControls;

export const useBibleAudioPlayerStatus = (
  player: AudioPlayer & BibleAudioQueueControls,
) => useAudioPlayerStatus(player) as BibleAudioStatus;
