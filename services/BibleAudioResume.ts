import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Where Bible audio picks up after the app restarts (#803). The place the
 * listener stopped in a chapter is saved for that chapter's recording, and the
 * next Play in the same chapter, with the same recording, starts there rather
 * than at 0:00, by itself, with no button or question. Only one place is kept,
 * and it's forgotten when the chapter finishes or the reader moves to another
 * chapter, so it never brings back a chapter the listener has left.
 */
export const BIBLE_AUDIO_RESUME_STORAGE_KEY = 'bible-audio-resume';

/** How far playback moves before its place is saved again. */
export const BIBLE_AUDIO_RESUME_SAVE_EVERY_MS = 5_000;

export type BibleAudioChapterPlace = Readonly<{ bookId: string; chapter: number }>;

export type BibleAudioResumePoint = BibleAudioChapterPlace &
  Readonly<{
    /** The recording: its narrator, which both CUV scripts share. */
    recording: string;
    positionMillis: number;
  }>;

const isSameChapter = (first: BibleAudioChapterPlace, second: BibleAudioChapterPlace) =>
  first.bookId === second.bookId && first.chapter === second.chapter;

const isSamePlace = (
  first: Omit<BibleAudioResumePoint, 'positionMillis'>,
  second: Omit<BibleAudioResumePoint, 'positionMillis'>,
) => first.recording === second.recording && isSameChapter(first, second);

const parsePoint = (value: string | null): BibleAudioResumePoint | null => {
  if (!value) return null;
  try {
    const point = JSON.parse(value) as Partial<BibleAudioResumePoint> | null;
    return point &&
      typeof point.recording === 'string' &&
      typeof point.bookId === 'string' &&
      Number.isInteger(point.chapter) &&
      typeof point.positionMillis === 'number' &&
      Number.isFinite(point.positionMillis) &&
      point.positionMillis > 0
      ? {
          recording: point.recording,
          bookId: point.bookId,
          chapter: point.chapter as number,
          positionMillis: point.positionMillis,
        }
      : null;
  } catch {
    return null;
  }
};

/**
 * Saves and forgets the place, for the Bible screen. Call `load` once, `note`
 * as playback moves, `save` when it pauses or the app leaves the screen,
 * `finish` when a chapter ends, and `follow` whenever the reader's chapter
 * changes.
 */
export class BibleAudioResumeTracker {
  // The place kept, as last saved; undefined until storage has been read.
  private point: BibleAudioResumePoint | null | undefined;
  // The newest place noted but not yet saved.
  private pending: BibleAudioResumePoint | null = null;
  private readerChapter: BibleAudioChapterPlace | null = null;
  private loading: Promise<void> | null = null;

  /** Reads the saved place, once. */
  load() {
    this.loading ??= AsyncStorage.getItem(BIBLE_AUDIO_RESUME_STORAGE_KEY)
      .then(parsePoint, (error) => {
        console.warn('Could not read where Bible audio stopped:', error);
        return null;
      })
      .then((saved) => {
        // A place saved or forgotten meanwhile is newer.
        if (this.point !== undefined) return;
        this.point = saved;
        // The reader opened another chapter while it was read.
        if (saved && this.readerChapter && !isSameChapter(saved, this.readerChapter)) this.forget();
      });
    return this.loading;
  }

  /**
   * Where Play starts in `place`: the position saved there for the same
   * recording, or 0.
   */
  resumeMillis(place: Omit<BibleAudioResumePoint, 'positionMillis'>) {
    const { point } = this;
    return point && isSamePlace(point, place) ? point.positionMillis : 0;
  }

  /**
   * Playback is at `point`. It's saved when it's a new place, or has moved
   * BIBLE_AUDIO_RESUME_SAVE_EVERY_MS from the place saved, so a phone that is
   * switched off loses at most that much.
   */
  note(point: BibleAudioResumePoint) {
    this.pending = point;
    const saved = this.point;
    if (
      !saved ||
      !isSamePlace(saved, point) ||
      Math.abs(saved.positionMillis - point.positionMillis) >= BIBLE_AUDIO_RESUME_SAVE_EVERY_MS
    ) {
      this.write(point);
    }
  }

  /** Saves `point` now, or the newest place noted: on a pause, or as the app goes to the background. */
  save(point: BibleAudioResumePoint | null = this.pending) {
    if (point) this.write(point);
  }

  /** The chapter played to its end, so its next Play starts at the beginning. */
  finish() {
    this.forget();
  }

  /** The reader is at `chapter`. A place in any other chapter is forgotten. */
  follow(chapter: BibleAudioChapterPlace) {
    this.readerChapter = chapter;
    const saved = this.point ?? this.pending;
    if (saved && !isSameChapter(saved, chapter)) this.forget();
  }

  private write(point: BibleAudioResumePoint) {
    this.pending = null;
    if (point.positionMillis <= 0) return;
    this.point = point;
    AsyncStorage.setItem(BIBLE_AUDIO_RESUME_STORAGE_KEY, JSON.stringify(point)).catch((error) =>
      console.warn('Could not save where Bible audio stopped:', error),
    );
  }

  private forget() {
    const hadPoint = this.point !== null;
    this.point = null;
    this.pending = null;
    if (!hadPoint) return;
    AsyncStorage.removeItem(BIBLE_AUDIO_RESUME_STORAGE_KEY).catch((error) =>
      console.warn('Could not forget where Bible audio stopped:', error),
    );
  }
}
