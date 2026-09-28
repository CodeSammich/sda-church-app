import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createAudioPlaylist, type AudioPlayer, type useAudioPlayer } from 'expo-audio';
import { BibleAudioNativeQueue } from './BibleAudioNativeQueue';
import type { BibleAudioQueueControls, BibleAudioSourceError } from './BibleAudioPlayer.types';

export const useBibleAudioPlayer = (...args: Parameters<typeof useAudioPlayer>) => {
  const [player] = useState(() => new BibleAudioNativeQueue(
    () => createAudioPlaylist({ updateInterval: args[1]?.updateInterval }),
  ));
  useEffect(() => {
    // Create in the committed effect, not render. A cleanup/setup replay gets
    // a fresh native object; unmount invalidates the facade before releasing it.
    player.mount();
    return () => player.unmount();
  }, [player]);
  return player as unknown as AudioPlayer & BibleAudioQueueControls;
};

export const useBibleAudioPlayerStatus = (player: AudioPlayer & BibleAudioQueueControls) => {
  const queue = player as unknown as BibleAudioNativeQueue;
  return useSyncExternalStore(queue.subscribe, queue.getStatus, queue.getStatus);
};

export const useBibleAudioSourceErrors = (
  player: AudioPlayer & BibleAudioQueueControls,
  onError: (event: BibleAudioSourceError) => void,
) => {
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    const queue = player as unknown as BibleAudioNativeQueue;
    const subscription = queue.addSourceErrorListener((event) => onErrorRef.current(event));
    return () => subscription.remove();
  }, [player]);
};
