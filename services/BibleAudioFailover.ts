/**
 * When to move Bible audio to the next mirror of the same recording.
 *
 * A source that fails outright (an HTTP error, a web page instead of audio, a
 * DNS failure) reports a player error and is skipped as soon as that error
 * arrives. A source that is only slow reports nothing, so each attempt also
 * has a load timeout. After the last mirror, the sources are tried again from
 * the first, with longer timeouts on each pass. That keeps a failed host from
 * costing a listener long silence while still giving a slow connection, such
 * as a subway dead zone, a fair chance to finish its first request.
 *
 * The app never gives up while the listener is still listening: a dead zone
 * between stations can last minutes. After the last pass, every source is
 * tried again once a minute, and the Bible screen retries at once when the
 * phone's connection comes back.
 */
export const BIBLE_AUDIO_SOURCE_PASSES = [
  { loadTimeoutMs: 15_000, startDelayMs: 0 },
  // A pause before each new pass keeps an offline phone from looping through
  // every host as fast as each request can fail, and gives a dead zone time
  // to pass.
  { loadTimeoutMs: 30_000, startDelayMs: 5_000 },
  { loadTimeoutMs: 45_000, startDelayMs: 20_000 },
] as const;

/** The wait between passes once every configured pass has failed. */
export const BIBLE_AUDIO_RETRY_DELAY_MS = 60_000;

export type BibleAudioSourceAttempt = {
  sourceIndex: number;
  pass: number;
};

export type NextBibleAudioSourceAttempt = BibleAudioSourceAttempt & {
  /** How long to wait before loading this source. */
  delayMs: number;
};

const getPass = (pass: number) =>
  BIBLE_AUDIO_SOURCE_PASSES[
    Math.min(Math.max(0, pass), BIBLE_AUDIO_SOURCE_PASSES.length - 1)
  ];

/** How long a source may load without any progress before the next one is tried. */
export const getBibleAudioSourceLoadTimeoutMs = (pass: number) =>
  getPass(pass).loadTimeoutMs;

/**
 * Whether `pass` is the last timed pass. There, a source that is slow but
 * hasn't failed keeps loading instead of being restarted on another host, so
 * a crawling connection can still finish.
 */
export const isLastTimedBibleAudioPass = (pass: number) =>
  pass >= BIBLE_AUDIO_SOURCE_PASSES.length - 1;

/**
 * The source to try after `current` fails or times out, or null when there
 * are no sources. After the last configured pass, passes continue with the
 * last pass's timeout and a one-minute wait.
 */
export const getNextBibleAudioSourceAttempt = (
  current: BibleAudioSourceAttempt,
  sourceCount: number,
): NextBibleAudioSourceAttempt | null => {
  if (sourceCount <= 0) return null;
  if (current.sourceIndex + 1 < sourceCount) {
    return { sourceIndex: current.sourceIndex + 1, pass: current.pass, delayMs: 0 };
  }
  const nextPass = current.pass + 1;
  return {
    sourceIndex: 0,
    pass: nextPass,
    delayMs: nextPass < BIBLE_AUDIO_SOURCE_PASSES.length
      ? BIBLE_AUDIO_SOURCE_PASSES[nextPass].startDelayMs
      : BIBLE_AUDIO_RETRY_DELAY_MS,
  };
};

/**
 * Whether a source has loaded or is audibly playing. Once it has, a load
 * timeout never swaps it for another mirror, and an error reloads the same
 * source where it stopped.
 *
 * The position alone is not progress: a reload seeks to where the listener
 * was before any audio arrives. Neither is `playing` while buffering, which
 * Android reports as the playback it intends once loading finishes.
 */
export const hasBibleAudioSourceStarted = (status: {
  duration: number;
  isBuffering?: boolean;
  isLoaded?: boolean;
  playing: boolean;
}) =>
  (status.playing && !status.isBuffering) ||
  (Boolean(status.isLoaded) && status.duration > 0);
