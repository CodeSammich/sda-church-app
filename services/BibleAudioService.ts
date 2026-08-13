import {
  setAudioModeAsync,
  type AudioMetadata,
  type AudioPlayer,
} from 'expo-audio';

/** Configures Bible narration as long-form background media. */
export const configureBibleAudioPlayback = () =>
  setAudioModeAsync({
    interruptionMode: 'doNotMix',
    shouldPlayInBackground: true,
  });

/** Publishes playback to native system controls and the web Media Session API. */
export const activateBibleAudioLockScreen = (
  player: AudioPlayer,
  metadata: AudioMetadata,
) =>
  player.setActiveForLockScreen(true, metadata, {
    showSeekBackward: true,
    showSeekForward: true,
  });

/** Returns a stable provider identifier for an audio URL. */
export const getBibleAudioSourceId = (url: string) => {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
};

/**
 * Moves a preferred provider to the front without removing automatic
 * fallbacks or changing their relative order.
 */
export const prioritizeBibleAudioSource = (
  urls: string[],
  preferredSourceId?: string,
) => {
  if (!preferredSourceId) return urls;
  return [
    ...urls.filter(
      (url) => getBibleAudioSourceId(url) === preferredSourceId,
    ),
    ...urls.filter(
      (url) => getBibleAudioSourceId(url) !== preferredSourceId,
    ),
  ];
};
