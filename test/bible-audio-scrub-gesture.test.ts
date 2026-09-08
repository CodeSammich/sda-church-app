import { BibleAudioScrubGesture } from '@/services/BibleAudioScrubGesture';

describe('Bible scrub gestures', () => {
  it('uses the final finger-up coordinate when the last move was earlier', () => {
    const gesture = new BibleAudioScrubGesture();
    gesture.begin(141, 41, 200, 200_000);
    expect(gesture.move(150)).toBe(50_000);
    expect(gesture.release(190)).toBe(90_000);
    expect(gesture.release(0)).toBeNull();
  });

  it('does not commit an interrupted drag at the last observed timestamp', () => {
    const gesture = new BibleAudioScrubGesture();
    expect(gesture.begin(141, 41, 200, 200_000)).toBe(41_000);
    gesture.cancel();
    expect(gesture.move(190)).toBeNull();
    expect(gesture.release(190)).toBeNull();
    expect(gesture.begin(190, 90, 200, 200_000)).toBe(90_000);
  });

  it('tracks right and left movement in a fixed coordinate frame', () => {
    const gesture = new BibleAudioScrubGesture();
    gesture.begin(200, 100, 200, 200_000);
    expect(gesture.move(250)).toBe(150_000);
    expect(gesture.move(150)).toBe(50_000);
    expect(gesture.move(90)).toBe(0);
    expect(gesture.release(350)).toBe(200_000);
  });

  it('rejects missing geometry and invalid release coordinates', () => {
    const gesture = new BibleAudioScrubGesture();
    expect(gesture.begin(100, 0, 0, 200_000)).toBeNull();
    gesture.begin(100, 0, 200, 200_000);
    expect(gesture.release(NaN)).toBeNull();
    expect(gesture.move(150)).toBeNull();
  });
});
