jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// A few uploaded chapters, so the tests can also reach one that isn't.
jest.mock('@/constants/CantoneseAdventistAudioManifest', () => ({
  CANTONESE_ADVENTIST_AUDIO_URLS: {
    'CANTONESE_B39C004.mp3':
      'https://assets.adventistconnect.org/newyork2/2026/09/30180000/CANTONESE_B39C004.mp3',
    'CANTONESE_B40C001.mp3':
      'https://assets.adventistconnect.org/newyork2/2026/09/30180001/CANTONESE_B40C001.mp3',
    'CANTONESE_B43C003.mp3':
      'https://assets.adventistconnect.org/newyork2/2026/09/30180002/CANTONESE_B43C003.mp3',
    'CANTONESE_B63C001.mp3':
      'https://assets.adventistconnect.org/newyork2/2026/09/30180003/CANTONESE_B63C001.mp3',
  },
}));

import {
  buildBibleAudioQueue,
  getBibleAudioSourceLabel,
} from '@/services/BibleAudioService';
import {
  CANTONESE_CUV_READER,
  CUV_AUDIO_READERS,
  getCantoneseCuvChapterUrl,
  getCuvChapterAudioLinks,
} from '@/services/BibleAudioSources';

const MANDARIN_READER = '基督徒团契 (Audio Power)';
const JOHN_3 =
  'https://assets.adventistconnect.org/newyork2/2026/09/30180002/CANTONESE_B43C003.mp3';

const books = (['MAL', 'MAT'] as const).map((id) => ({
  id,
  name: id,
  commonName: id,
  title: null,
  numberOfChapters: id === 'MAL' ? 4 : 28,
  totalNumberOfVerses: 0,
}));

describe('Cantonese CUV audio from WordProject', () => {
  it("finds the church's copy of a chapter by its canonical name", () => {
    expect(getCantoneseCuvChapterUrl('jhn', 3)).toBe(JOHN_3);
    expect(getCantoneseCuvChapterUrl('2JN', 1)).toBe(
      'https://assets.adventistconnect.org/newyork2/2026/09/30180003/CANTONESE_B63C001.mp3',
    );
  });

  it("has no Cantonese audio for a chapter that isn't uploaded or doesn't exist", () => {
    expect(getCantoneseCuvChapterUrl('JHN', 4)).toBeNull();
    expect(getCantoneseCuvChapterUrl('JHN', 0)).toBeNull();
    expect(getCantoneseCuvChapterUrl('JHN', 22)).toBeNull();
    expect(getCantoneseCuvChapterUrl('XYZ', 1)).toBeNull();
  });

  it('lists Cantonese after the Mandarin narration, which stays the default', () => {
    const links = getCuvChapterAudioLinks('JHN', 3);
    expect(Object.keys(links)).toEqual([MANDARIN_READER, CANTONESE_CUV_READER]);
    expect(Object.keys(getCuvChapterAudioLinks('JHN', 4))).toEqual([
      MANDARIN_READER,
    ]);
  });

  it("plays only the church's copy, never WordProject's servers", () => {
    expect(getCuvChapterAudioLinks('JHN', 3)[CANTONESE_CUV_READER]).toEqual([
      JOHN_3,
    ]);
    expect(getBibleAudioSourceLabel(JOHN_3)).toBe('NYCCSDA.org');
  });

  it('names every CUV narrator by its spoken language, in both scripts', () => {
    const readers = Object.keys(getCuvChapterAudioLinks('JHN', 3));
    expect(readers.map((reader) => CUV_AUDIO_READERS[reader]?.language)).toEqual([
      'mandarin',
      'cantonese',
    ]);
    expect(CUV_AUDIO_READERS[MANDARIN_READER]).toMatchObject({
      traditional: '國語',
      simplified: '国语',
    });
    expect(CUV_AUDIO_READERS[CANTONESE_CUV_READER]).toMatchObject({
      traditional: '粵語',
      simplified: '粤语',
      credit: 'WordProject',
    });
  });

  it('queues the next Cantonese chapters, across a book boundary, without fallbacks', () => {
    const queue = buildBibleAudioQueue({
      albumTitle: 'Bible audio',
      artist: `CUV • ${CANTONESE_CUV_READER}`,
      books,
      currentBookId: 'MAL',
      currentChapter: 3,
      limit: 2,
      selectedAudioUrls: [],
      selectedReader: CANTONESE_CUV_READER,
      translationId: 'cmn_cuv',
      translationLabel: 'CUV',
    });
    expect(queue.map(({ bookId, chapter }) => `${bookId} ${chapter}`)).toEqual([
      'MAL 4',
      'MAT 1',
    ]);
    expect((queue[1].source as { uri: string }).uri).toBe(
      'https://assets.adventistconnect.org/newyork2/2026/09/30180001/CANTONESE_B40C001.mp3',
    );
    expect(queue[1].fallbacks).toEqual([]);
  });
});
