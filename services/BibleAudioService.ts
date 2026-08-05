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
