import {
  BIBLE_AUDIO_RESUME_STORAGE_KEY,
  BibleAudioResumeTracker,
  type BibleAudioResumePoint,
} from '@/services/BibleAudioResume';
import { CANTONESE_CUV_READER, getBibleAudioNarrator } from '@/services/BibleAudioSources';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readFileSync } from 'node:fs';

// After the app restarts, Bible audio picks up where the listener stopped,
// by itself, rather than at 0:00 (#803).
const CANTONESE = 'cuv-cantonese';
const JOHN_5 = { recording: CANTONESE, bookId: 'JHN', chapter: 5 };
const at = (positionMillis: number, place = JOHN_5): BibleAudioResumePoint => ({ ...place, positionMillis });
const flush = async () => {
  for (let i = 0; i < 5; i += 1) await Promise.resolve();
};
const stored = async () => {
  await flush();
  const value = await AsyncStorage.getItem(BIBLE_AUDIO_RESUME_STORAGE_KEY);
  return value ? (JSON.parse(value) as BibleAudioResumePoint) : null;
};
/** The app is closed and opened again. */
const restart = async () => {
  await flush();
  const tracker = new BibleAudioResumeTracker();
  await tracker.load();
  return tracker;
};

beforeEach(async () => {
  await AsyncStorage.clear();
});

it('picks up John 5 at 3:35 after the app restarts, as the persona expected', async () => {
  const before = await restart();
  before.follow({ bookId: 'JHN', chapter: 5 });
  for (let millis = 200_000; millis <= 215_000; millis += 1_000) before.note(at(millis));
  before.save(at(215_000));

  const after = await restart();
  after.follow({ bookId: 'JHN', chapter: 5 });
  expect(after.resumeMillis(JOHN_5)).toBe(215_000);
});

it('keeps the place for its recording and chapter only', async () => {
  const before = await restart();
  before.save(at(215_000));
  const after = await restart();
  expect(after.resumeMillis({ ...JOHN_5, recording: 'cuv-mandarin' })).toBe(0);
  expect(after.resumeMillis({ ...JOHN_5, chapter: 6 })).toBe(0);
  expect(after.resumeMillis({ ...JOHN_5, bookId: 'LUK' })).toBe(0);
});

it("is the same place in the CUV's two scripts, which share the recordings", () => {
  expect(getBibleAudioNarrator('cmn_cuv', CANTONESE_CUV_READER)).toBe(CANTONESE);
  expect(getBibleAudioNarrator('cmn_cu1', CANTONESE_CUV_READER)).toBe(CANTONESE);
});

it('saves as playback moves, every 5 seconds, and exactly on a pause or leaving the app', async () => {
  const tracker = await restart();
  tracker.note(at(1_000));
  expect(await stored()).toMatchObject({ positionMillis: 1_000 });
  tracker.note(at(4_000));
  expect(await stored()).toMatchObject({ positionMillis: 1_000 });
  tracker.note(at(6_000));
  expect(await stored()).toMatchObject({ positionMillis: 6_000 });
  tracker.note(at(9_500));
  // The app goes to the background, where it can be closed.
  tracker.save();
  expect(await stored()).toMatchObject({ positionMillis: 9_500 });
  // A drag back is saved at once.
  tracker.note(at(2_000));
  expect(await stored()).toMatchObject({ positionMillis: 2_000 });
  // Pausing saves where the player is.
  tracker.save(at(3_200));
  expect(await stored()).toEqual(at(3_200));
});

it('forgets a chapter played to its end, even when the app is left afterwards', async () => {
  const tracker = await restart();
  tracker.note(at(290_000));
  tracker.note(at(292_000));
  tracker.finish();
  tracker.save();
  expect(await stored()).toBeNull();
  expect((await restart()).resumeMillis(JOHN_5)).toBe(0);
});

it('forgets the place when another chapter is chosen, and keeps it in the same one', async () => {
  const tracker = await restart();
  tracker.save(at(215_000));
  tracker.follow({ bookId: 'JHN', chapter: 5 });
  expect(await stored()).toEqual(at(215_000));
  tracker.follow({ bookId: 'JHN', chapter: 6 });
  expect(await stored()).toBeNull();
  // Coming back doesn't bring it back.
  tracker.follow({ bookId: 'JHN', chapter: 5 });
  expect(tracker.resumeMillis(JOHN_5)).toBe(0);
});

it('forgets it when the reader opened another chapter before the saved place was read', async () => {
  await (await restart()).save(at(215_000));
  await flush();
  const tracker = new BibleAudioResumeTracker();
  tracker.follow({ bookId: 'GEN', chapter: 1 });
  await tracker.load();
  expect(tracker.resumeMillis(JOHN_5)).toBe(0);
  expect(await stored()).toBeNull();
});

it('ignores a saved value it cannot read', async () => {
  await AsyncStorage.setItem(BIBLE_AUDIO_RESUME_STORAGE_KEY, '{"bookId":"JHN"');
  expect((await restart()).resumeMillis(JOHN_5)).toBe(0);
  await AsyncStorage.setItem(BIBLE_AUDIO_RESUME_STORAGE_KEY, JSON.stringify({ ...JOHN_5, positionMillis: -1 }));
  expect((await restart()).resumeMillis(JOHN_5)).toBe(0);
});

describe('on the Bible screen', () => {
  const bible = readFileSync('app/(tabs)/bible/index.tsx', 'utf8');

  it("names the recording by its narrator, and Play starts at the place saved for the reader's chapter", () => {
    expect(bible).toContain('getBibleAudioNarrator(supportedTranslation.id, selectedAudioReader) ??');
    expect(bible).toMatch(/getSavedPositionMillis: \(target\) => \{[^}]*audioResume\.resumeMillis\(/);
  });

  it('saves while playing, on a pause, the sleep timer, leaving the app, and a translation switch', () => {
    expect(bible).toMatch(/audioResume\.note\(\{ \.\.\.audioResumePlace, positionMillis: audioPositionMillis \}\);\s*\}, \[audioPositionMillis\]\);/);
    expect(bible).toContain('audioResume.save({ ...audioResumePlace, positionMillis: getCurrentAudioPositionMillis() });');
    expect(bible).toMatch(/else audioResume\.save\(\);/);
    expect(bible).toMatch(/const unloadAudio = \(\) => \{[^}]*audioResume\.save\(\);/);
    expect(bible.match(/audioResume\.save\(\);/g)?.length).toBe(3);
  });

  it('forgets it when a chapter finishes or the reader moves on', () => {
    expect(bible).toMatch(/if \(audioStatus\.didJustFinish\) \{[^}]*audioResume\.finish\(\);/);
    expect(bible).toContain('if (book) audioResume.follow({ bookId: book.id, chapter: chapterNum });');
  });
});
