import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const {
  RECORD_KEYS,
  RECORDS,
  checkLesson,
  checkPlayback,
  networkVerdict,
  readRecord,
  waitForRecord,
} = require('../scripts/key-screen-records.cjs');

// A fetch that answers for the hosts in `up` and fails like a dead network for the rest.
const fetchWith = (up: string[]) =>
  jest.fn(async (url: string, _init?: { headers?: Record<string, string> }) => {
    if (up.includes(new URL(url).host)) {
      return { ok: true, status: 206, body: { cancel: async () => {} } };
    }
    throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'ENOTFOUND' } });
  });

const MP3 = 'https://audio.example.org/cuv/PSA/23.mp3';
const BACKUP = 'https://backup.example.net/cuv/19_023.mp3';

describe('reading what the app recorded', () => {
  let dir: string;
  let manifest: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'records-'));
    manifest = join(dir, 'manifest.json');
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('reads a record kept in the manifest', () => {
    writeFileSync(manifest, JSON.stringify({ [RECORD_KEYS.lesson]: JSON.stringify({ outcome: 'preview' }) }));
    expect(readRecord(manifest, RECORD_KEYS.lesson)).toEqual({ outcome: 'preview' });
  });

  it('reads a long record from the file AsyncStorage keeps it in', () => {
    // Over 1 KB, the manifest holds null and the value has a file named by the key's MD5.
    const record = { sources: Array.from({ length: 20 }, (_, index) => `${MP3}?${index}`) };
    writeFileSync(manifest, JSON.stringify({ [RECORD_KEYS.audio]: null }));
    writeFileSync(join(dir, createHash('md5').update(RECORD_KEYS.audio).digest('hex')), JSON.stringify(record));
    expect(readRecord(manifest, RECORD_KEYS.audio)).toEqual(record);
  });

  it('is null before the app records anything, and while it is part-written', () => {
    writeFileSync(manifest, JSON.stringify({ 'user-language': 'en' }));
    expect(readRecord(manifest, RECORD_KEYS.audio)).toBeNull();
    writeFileSync(manifest, '{"screenshot-au');
    expect(readRecord(manifest, RECORD_KEYS.audio)).toBeNull();
    expect(readRecord(join(dir, 'missing.json'), RECORD_KEYS.audio)).toBeNull();
  });

  it('uses the keys the app saves them under', () => {
    const { SCREENSHOT_RECORD_KEYS } = require('../services/ScreenshotRoute');
    expect(RECORD_KEYS).toEqual(SCREENSHOT_RECORD_KEYS);
    expect(Object.keys(RECORDS).sort()).toEqual(Object.values(RECORD_KEYS).sort());
  });

  it('waits for a record that is ready, and no longer than its limit', async () => {
    const reads = [null, { currentTime: 0 }, { currentTime: 1.2 }];
    const read = jest.fn(() => reads.shift() ?? null);
    const ready = await waitForRecord(read, { ...RECORDS[RECORD_KEYS.audio], waitUpTo: 5 });
    expect(ready).toEqual({ currentTime: 1.2 });
    expect(read).toHaveBeenCalledTimes(3);

    const started = Date.now();
    expect(await waitForRecord(() => null, { ready: () => true, waitUpTo: 0.6 })).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('telling a network failure from the app’s', () => {
  it('says the network was the cause when the runner can’t reach any of the hosts either', async () => {
    const verdict = await networkVerdict([MP3, BACKUP, MP3], fetchWith([]));
    expect(verdict).toMatch(/^ The network was the cause, not the app: this runner couldn't reach them either/);
    expect(verdict).toContain('audio.example.org: ENOTFOUND');
    expect(verdict).toContain('backup.example.net: ENOTFOUND');
    expect(verdict).toContain('Run this group again.');
  });

  it('says it wasn’t when the runner reaches one', async () => {
    const fetcher = fetchWith(['backup.example.net']);
    const verdict = await networkVerdict([MP3, BACKUP], fetcher);
    expect(verdict).toMatch(/so the network wasn't the cause\.$/);
    expect(verdict).toContain('backup.example.net: HTTP 206');
    // Only the first kilobyte is asked for.
    expect(fetcher.mock.calls[0][1]?.headers).toEqual({ Range: 'bytes=0-1023' });
  });
});

describe('Bible audio after play=1', () => {
  const playing = (currentTime: number) => ({ playing: true, currentTime, sources: [MP3, BACKUP], source: MP3 });

  it('passes when it plays on by at least half the time between the shots', async () => {
    expect(await checkPlayback({ first: playing(2.4), later: playing(12.1), seconds: 10 })).toEqual({ problems: [] });
    expect(await checkPlayback({ first: playing(2), later: playing(7), seconds: 10 })).toEqual({ problems: [] });
  });

  it('fails a player that stopped, and blames the network when the hosts can’t be reached', async () => {
    const stuck = { ...playing(3), playing: false, isBuffering: true };
    const { problems } = await checkPlayback({ first: playing(3), later: stuck, seconds: 10 }, fetchWith([]));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^the audio didn't play \(0:03 to 0:03 in 10 seconds, not playing, buffering\)\. The network was the cause/);
  });

  it('blames the app when the hosts answer', async () => {
    const failed = { ...playing(0), playing: false, error: 'AVPlayerItem failed' };
    const { problems } = await checkPlayback({ first: failed, later: failed, seconds: 10 }, fetchWith(['audio.example.org']));
    expect(problems[0]).toContain('error: AVPlayerItem failed');
    expect(problems[0]).toContain("so the network wasn't the cause");
  });

  it('fails one that plays too slowly, or never says it is playing', async () => {
    expect((await checkPlayback({ first: playing(3), later: playing(6), seconds: 10 }, fetchWith([MP3]))).problems).toHaveLength(1);
    const paused = { ...playing(13), playing: false };
    expect((await checkPlayback({ first: playing(3), later: paused, seconds: 10 }, fetchWith([]))).problems).toHaveLength(1);
  });

  it('says when the hook never started it, or the chapter had nothing to play', async () => {
    expect((await checkPlayback({ seconds: 10 })).problems).toEqual([
      'the app saved no player status, so play=1 never started the audio',
    ]);
    const silent = { playing: false, currentTime: 0, sources: [] };
    const { problems } = await checkPlayback({ first: silent, later: silent, seconds: 10 });
    expect(problems[0]).toMatch(/the chapter had no recording$/);
  });
});

describe('a children’s lesson after popup=lesson-viewer', () => {
  const pdf = 'https://sabbath-school-resources-media.adventech.io/pdf/en/aij/2026-04-bg/lesson.pdf';

  it('passes when Quick Look opened it', async () => {
    expect(await checkLesson({ first: { outcome: 'preview', url: pdf } })).toEqual({ problems: [] });
  });

  it('only warns when the week has no PDF yet and the website opened', async () => {
    const result = await checkLesson({
      first: { outcome: 'browser', reason: 'no-pdf', url: 'https://beginner.aliveinjesus.info/' },
    });
    expect(result.problems).toEqual([]);
    expect(result.notes[0]).toMatch(/no PDF yet.*Quick Look wasn't checked/);
  });

  it('fails a download that failed, saying whether the network was the cause', async () => {
    const first = { outcome: 'browser', reason: 'download-failed', url: pdf };
    expect((await checkLesson({ first }, fetchWith([]))).problems[0]).toMatch(
      /^the lesson's PDF didn't download, so it opened in the browser instead of Quick Look\. The network was the cause/,
    );
    expect((await checkLesson({ first }, fetchWith([new URL(pdf).host]))).problems[0]).toContain(
      "so the network wasn't the cause",
    );
  });

  it('fails when Quick Look couldn’t open a downloaded lesson', async () => {
    for (const reason of ['no-viewer', 'preview-failed']) {
      const { problems } = await checkLesson({ first: { outcome: 'browser', reason, url: pdf } });
      expect(problems).toEqual([`Quick Look couldn't open the downloaded lesson (${reason}), so it opened in the browser`]);
    }
  });

  it('fails when the app thought it was offline, asking the lesson catalog', async () => {
    const fetcher = fetchWith([]);
    const { problems } = await checkLesson({ first: { outcome: 'offline' } }, fetcher);
    expect(problems[0]).toMatch(/^the app said it was offline\. The network was the cause/);
    // Where the app looks lessons up.
    const api = /const ADVENTECH_API = '([^']+)'/.exec(
      require('node:fs').readFileSync(join(__dirname, '../features/sabbath-school/ChildrenLessons.ts'), 'utf8'),
    )![1];
    expect(fetcher.mock.calls[0][0].startsWith(`${api}/`)).toBe(true);
  });

  it('fails with the error, or when nothing was recorded', async () => {
    expect((await checkLesson({ first: { outcome: 'error', error: 'Error: boom' } })).problems).toEqual([
      'opening the lesson failed: Error: boom',
    ]);
    expect((await checkLesson({})).problems[0]).toMatch(/never opened it$/);
  });
});
