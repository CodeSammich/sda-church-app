jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { setAudioModeAsync } from 'expo-audio';
import {
  activateBibleAudioLockScreen,
  configureBibleAudioPlayback,
  getBibleAudioSourceId,
  prioritizeBibleAudioSource,
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

  it('prioritizes a chosen source while preserving every fallback', () => {
    const urls = [
      'https://assets.adventistconnect.org/chapter.mp3',
      'https://theaudiopower.com/chapter.mp3',
      'https://archive.org/chapter.mp3',
    ];

    expect(getBibleAudioSourceId(urls[1])).toBe('theaudiopower.com');
    expect(prioritizeBibleAudioSource(urls, 'archive.org')).toEqual([
      urls[2],
      urls[0],
      urls[1],
    ]);
    expect(prioritizeBibleAudioSource(urls, 'unknown.example')).toEqual(urls);
  });
});
