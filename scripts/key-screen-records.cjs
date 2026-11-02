/**
 * Checks what a key-screens build did, not only what it showed, for the shots
 * in test/screens/screens.json that start something the Simulator can't be
 * tapped for (#551): Bible audio playing after `play=1`, and a children's
 * lesson opening in Quick Look after `popup=lesson-viewer`. The app saves a
 * record of how each went in its storage (recordForScreenshot in
 * services/ScreenshotRoute.ts), which capture-ios-screens.cjs reads from the
 * same AsyncStorage file it writes the settings to.
 *
 * Both reach the network: the audio streams from its hosts, and the lesson
 * downloads from Adventech's. When one fails, the check asks those hosts from
 * the runner itself, which the Simulator shares its network with, and says
 * whether the network was the cause.
 */
const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

// The keys the app saves its records under (SCREENSHOT_RECORD_KEYS in
// services/ScreenshotRoute.ts). test/screens.test.ts keeps them in step.
const RECORD_KEYS = { audio: 'screenshot-audio', lesson: 'screenshot-lesson' };

/**
 * A record from the app's AsyncStorage file, or null if it has none yet.
 * AsyncStorage keeps a value over 1 KB in a file of its own, named by the MD5
 * of its key, and null in the manifest (RNCAsyncStorage.mm).
 */
const readRecord = (manifest, key) => {
  try {
    const entries = JSON.parse(readFileSync(manifest, 'utf8'));
    if (!Object.hasOwn(entries, key)) return null;
    const value =
      entries[key] ?? readFileSync(join(dirname(manifest), createHash('md5').update(key).digest('hex')), 'utf8');
    return JSON.parse(value);
  } catch {
    // Missing, or caught while the app was writing it.
    return null;
  }
};

const PROBE_SECONDS = 10;

const hostOf = (url) => {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
};

/** Asks an address for its first kilobyte: whether it answered, and how. */
const probe = async (url, fetcher = fetch) => {
  try {
    const response = await fetcher(url, {
      headers: { Range: 'bytes=0-1023' },
      signal: AbortSignal.timeout(PROBE_SECONDS * 1000),
    });
    await response.body?.cancel();
    return { url, ok: response.ok, status: `HTTP ${response.status}` };
  } catch (error) {
    const status =
      error.name === 'TimeoutError' ? `no answer in ${PROBE_SECONDS} seconds` : error.cause?.code || error.message;
    return { url, ok: false, status };
  }
};

/**
 * The end of a failure's message: whether the network was the cause, from
 * whether this runner can reach the addresses the app tried.
 */
const networkVerdict = async (urls, fetcher = fetch) => {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return '';
  const probes = await Promise.all(unique.map((url) => probe(url, fetcher)));
  const answers = probes.map((each) => `${hostOf(each.url)}: ${each.status}`).join(', ');
  return probes.some((each) => each.ok)
    ? ` This runner reached them (${answers}), so the network wasn't the cause.`
    : ` The network was the cause, not the app: this runner couldn't reach them either (${answers}). Run this group again.`;
};

const clock = (seconds) =>
  Number.isFinite(seconds) ? `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}` : '?';

/**
 * Audio after play=1: playing, with the player's time ahead in the later shot
 * by at least half the time between the shots. `first` and `later` are the
 * records read just after each.
 */
const checkPlayback = async ({ first, later, seconds }, fetcher = fetch) => {
  if (!first && !later) return { problems: ['the app saved no player status, so play=1 never started the audio'] };
  const end = later || first;
  const moved = (later?.currentTime ?? 0) - (first?.currentTime ?? 0);
  if (later?.playing && moved >= seconds / 2) return { problems: [] };
  const state = [
    `${clock(first?.currentTime)} to ${clock(later?.currentTime)} in ${seconds} seconds`,
    end.playing ? 'playing' : 'not playing',
    ...(end.isBuffering ? ['buffering'] : []),
    ...(end.error ? [`error: ${end.error}`] : []),
  ].join(', ');
  if (!end.sources?.length) return { problems: [`the audio didn't play (${state}): the chapter had no recording`] };
  const verdict = await networkVerdict([end.source, ...end.sources], fetcher);
  return { problems: [`the audio didn't play (${state}).${verdict}`] };
};

// Where ChildrenLessons.ts looks lessons up (ADVENTECH_API), asked when the
// app said it was offline.
const LESSON_CATALOG = 'https://sabbath-school.adventech.io/api/v2/en/quarterlies/index.json';

/**
 * A lesson after popup=lesson-viewer: open in Quick Look. The browser counts
 * only when the week's lesson has no PDF yet, which the app can't help.
 */
const checkLesson = async ({ first }, fetcher = fetch) => {
  if (!first) return { problems: ['the app saved no record of opening the lesson, so popup=lesson-viewer never opened it'] };
  const { outcome, reason, url, error } = first;
  if (outcome === 'preview') return { problems: [] };
  if (outcome === 'browser' && reason === 'no-pdf') {
    return {
      problems: [],
      notes: [`this week's lesson has no PDF yet, so its website opened in the browser and Quick Look wasn't checked (${url})`],
    };
  }
  if (outcome === 'browser' && reason === 'download-failed') {
    return {
      problems: [
        `the lesson's PDF didn't download, so it opened in the browser instead of Quick Look.${await networkVerdict([url], fetcher)}`,
      ],
    };
  }
  if (outcome === 'browser') return { problems: [`Quick Look couldn't open the downloaded lesson (${reason}), so it opened in the browser`] };
  if (outcome === 'offline') {
    return { problems: [`the app said it was offline.${await networkVerdict([LESSON_CATALOG], fetcher)}`] };
  }
  return { problems: [`opening the lesson failed: ${error || outcome}`] };
};

/**
 * Each record a shot can name in screens.json: when it's ready for the shot,
 * how long to wait for that at most, and its check. Audio is ready once it
 * plays or fails, and a lesson once it has opened somewhere.
 */
const RECORDS = {
  [RECORD_KEYS.audio]: {
    ready: (record) => record.currentTime > 0 || !!record.error,
    waitUpTo: 20,
    check: checkPlayback,
  },
  [RECORD_KEYS.lesson]: {
    ready: (record) => !!record.outcome,
    // The lookup gives up after 12 seconds, and the download takes a few more.
    waitUpTo: 40,
    check: checkLesson,
  },
};

/** Waits, a half second at a time, until the record is ready or `waitUpTo` passes. */
const waitForRecord = async (read, { ready, waitUpTo }) => {
  const until = Date.now() + waitUpTo * 1000;
  for (;;) {
    const record = read();
    if ((record && ready(record)) || Date.now() >= until) return record;
    await new Promise((done) => setTimeout(done, 500));
  }
};

module.exports = {
  RECORD_KEYS,
  RECORDS,
  readRecord,
  probe,
  networkVerdict,
  checkPlayback,
  checkLesson,
  waitForRecord,
};
