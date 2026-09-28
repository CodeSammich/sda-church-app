import {
  BIBLE_AUDIO_RETRY_DELAY_MS,
  BIBLE_AUDIO_SOURCE_PASSES,
  getBibleAudioSourceLoadTimeoutMs,
  getNextBibleAudioSourceAttempt,
  hasBibleAudioSourceStarted,
  isLastTimedBibleAudioPass,
} from '@/services/BibleAudioFailover';

describe('Bible audio source failover', () => {
  it('tries a slow first source for 15 seconds, not 45', () => {
    expect(getBibleAudioSourceLoadTimeoutMs(0)).toBe(15_000);
  });

  it('gives each later pass a longer timeout, capped at the last pass', () => {
    const timeouts = BIBLE_AUDIO_SOURCE_PASSES.map((_, pass) =>
      getBibleAudioSourceLoadTimeoutMs(pass),
    );
    expect(timeouts).toEqual([15_000, 30_000, 45_000]);
    expect(getBibleAudioSourceLoadTimeoutMs(99)).toBe(45_000);
    expect(getBibleAudioSourceLoadTimeoutMs(-1)).toBe(15_000);
  });

  it('moves to the next mirror in the same pass without waiting', () => {
    expect(getNextBibleAudioSourceAttempt({ sourceIndex: 0, pass: 0 }, 3)).toEqual({
      sourceIndex: 1,
      pass: 0,
      delayMs: 0,
    });
    expect(getNextBibleAudioSourceAttempt({ sourceIndex: 1, pass: 1 }, 3)).toEqual({
      sourceIndex: 2,
      pass: 1,
      delayMs: 0,
    });
  });

  it('starts over from the first mirror after a pause', () => {
    expect(getNextBibleAudioSourceAttempt({ sourceIndex: 2, pass: 0 }, 3)).toEqual({
      sourceIndex: 0,
      pass: 1,
      delayMs: 5_000,
    });
    expect(getNextBibleAudioSourceAttempt({ sourceIndex: 2, pass: 1 }, 3)).toEqual({
      sourceIndex: 0,
      pass: 2,
      delayMs: 20_000,
    });
  });

  it('keeps trying every source once a minute after the last pass', () => {
    const tried: string[] = [];
    let attempt: { sourceIndex: number; pass: number } = { sourceIndex: 0, pass: 0 };
    const delays: number[] = [];
    for (let step = 0; step < 15; step += 1) {
      tried.push(`${attempt.pass}:${attempt.sourceIndex}`);
      const next = getNextBibleAudioSourceAttempt(attempt, 3)!;
      if (next.sourceIndex === 0) delays.push(next.delayMs);
      attempt = next;
    }
    expect(tried).toEqual([
      '0:0', '0:1', '0:2', '1:0', '1:1', '1:2', '2:0', '2:1', '2:2',
      '3:0', '3:1', '3:2', '4:0', '4:1', '4:2',
    ]);
    // Between passes: 5 seconds, 20 seconds, then a minute every time.
    expect(delays).toEqual([
      5_000, 20_000, BIBLE_AUDIO_RETRY_DELAY_MS, BIBLE_AUDIO_RETRY_DELAY_MS, BIBLE_AUDIO_RETRY_DELAY_MS,
    ]);
    expect(getBibleAudioSourceLoadTimeoutMs(7)).toBe(45_000);
  });

  it('keeps a slow source loading from the last timed pass on', () => {
    expect(isLastTimedBibleAudioPass(0)).toBe(false);
    expect(isLastTimedBibleAudioPass(1)).toBe(false);
    expect(isLastTimedBibleAudioPass(2)).toBe(true);
    expect(isLastTimedBibleAudioPass(5)).toBe(true);
  });

  it('retries a single source on each pass and handles no sources', () => {
    expect(getNextBibleAudioSourceAttempt({ sourceIndex: 0, pass: 0 }, 1)).toEqual({
      sourceIndex: 0,
      pass: 1,
      delayMs: 5_000,
    });
    expect(getNextBibleAudioSourceAttempt({ sourceIndex: 0, pass: 0 }, 0)).toBeNull();
  });

  it('keeps a source that is audibly playing or has loaded', () => {
    const idle = { duration: 0, isBuffering: false, isLoaded: false, playing: false };
    expect(hasBibleAudioSourceStarted(idle)).toBe(false);
    expect(hasBibleAudioSourceStarted({ ...idle, playing: true })).toBe(true);
    expect(hasBibleAudioSourceStarted({ ...idle, isLoaded: true, duration: 180 })).toBe(true);
    // A duration without a loaded source is not progress.
    expect(hasBibleAudioSourceStarted({ ...idle, duration: 180 })).toBe(false);
  });

  it('does not count a buffering source that Android reports as playing', () => {
    // ExoPlayer reports the playback it intends while a new source buffers.
    expect(hasBibleAudioSourceStarted({
      duration: 0, isBuffering: true, isLoaded: false, playing: true,
    })).toBe(false);
  });

  it('does not count a resume position seeked to before any audio loads', () => {
    expect(hasBibleAudioSourceStarted({
      currentTime: 180, duration: 0, isBuffering: false, isLoaded: false, playing: false,
    } as Parameters<typeof hasBibleAudioSourceStarted>[0])).toBe(false);
  });
});
