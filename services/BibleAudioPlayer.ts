import { useEffect, useRef } from 'react';
import { useAudioPlayer, useAudioPlayerStatus, type AudioPlayer } from 'expo-audio';

import type {
  BibleAudioQueueControls,
  BibleAudioSourceError,
  BibleAudioStatus,
} from './BibleAudioPlayer.types';

// iOS retains expo-audio's single player. Android uses the native playlist in
// BibleAudioPlayer.android.ts; web uses its rolling HTML media queue.
export const useBibleAudioPlayer = (...args: Parameters<typeof useAudioPlayer>) =>
  useAudioPlayer(...args) as AudioPlayer & BibleAudioQueueControls;

export const useBibleAudioPlayerStatus = (
  player: AudioPlayer & BibleAudioQueueControls,
) => useAudioPlayerStatus(player) as BibleAudioStatus;

/**
 * Calls `onError` once for each playback error. expo-audio reports an error
 * in a single status event, which a React render can miss.
 */
export const useBibleAudioSourceErrors = (
  player: AudioPlayer & BibleAudioQueueControls,
  onError: (event: BibleAudioSourceError) => void,
) => {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    const subscription = player.addListener('playbackStatusUpdate', (status) => {
      if (status.error) {
        onErrorRef.current({ error: status.error, currentTime: status.currentTime });
      }
    });
    return () => subscription.remove();
  }, [player]);
};
