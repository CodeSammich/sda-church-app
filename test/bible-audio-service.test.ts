jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { setAudioModeAsync } from 'expo-audio';
import {
  activateBibleAudioLockScreen,
  configureBibleAudioPlayback,
} from '@/services/BibleAudioService';

describe('Bible audio playback', () => {
  it('configures long-form background playback', async () => {
    await configureBibleAudioPlayback();

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      interruptionMode: 'doNotMix',
      shouldPlayInBackground: true,
    });
  });

  it('publishes playback to system media controls', () => {
    const player = { setActiveForLockScreen: jest.fn() };
    const metadata = {
      title: 'Genesis 1',
      artist: 'Berean Standard Bible',
      albumTitle: 'Bible audio',
    };

    activateBibleAudioLockScreen(player as any, metadata);

    expect(player.setActiveForLockScreen).toHaveBeenCalledWith(true, metadata, {
      showSeekBackward: true,
      showSeekForward: true,
    });
  });
});
