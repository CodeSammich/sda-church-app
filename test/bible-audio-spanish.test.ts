jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// A few uploaded chapters, so the tests can also reach one that isn't.
jest.mock('@/constants/Rv1909AdventistAudioManifest', () => ({
  RV1909_ADVENTIST_AUDIO_URLS: {
    'RV1909_B43C003.mp3':
      'https://assets.adventistconnect.org/newyork2/2026/10/01120000/RV1909_B43C003.mp3',
    'RV1909_B43C004.mp3':
      'https://assets.adventistconnect.org/newyork2/2026/10/01120001/RV1909_B43C004.mp3',
  },
}));

import { buildBibleAudioQueue } from '@/services/BibleAudioService';
import {
  getAudioReaderPreferenceKey,
  getChurchHostedAudioLinks,
  hasChurchHostedAudio,
  RV1909_READER,
  WORDPROJECT_CREDITS,
  WORDPROJECT_SPANISH_AUDIO_URL,
} from '@/services/BibleAudioSources';

const JOHN_3 =
  'https://assets.adventistconnect.org/newyork2/2026/10/01120000/RV1909_B43C003.mp3';

describe('Reina-Valera 1909 audio from WordProject', () => {
  it("plays only the church's copy of each chapter", () => {
    expect(hasChurchHostedAudio('spa_r09')).toBe(true);
    expect(getChurchHostedAudioLinks('spa_r09', 'jhn', 3)).toEqual({
      [RV1909_READER]: [JOHN_3],
    });
  });

  it("has no audio for a chapter that isn't uploaded or doesn't exist", () => {
    expect(getChurchHostedAudioLinks('spa_r09', 'JHN', 5)).toEqual({});
    expect(getChurchHostedAudioLinks('spa_r09', 'JHN', 22)).toEqual({});
  });

  it('leaves other translations alone', () => {
    expect(hasChurchHostedAudio('BSB')).toBe(false);
    expect(getChurchHostedAudioLinks('BSB', 'JHN', 3)).toEqual({});
    expect(getAudioReaderPreferenceKey('spa_r09')).toBe('spa_r09');
  });

  it("credits WordProject's Spanish page", () => {
    expect(WORDPROJECT_CREDITS[RV1909_READER]).toEqual({
      language: 'spanish',
      url: WORDPROJECT_SPANISH_AUDIO_URL,
    });
  });

  it('queues the next RV1909 chapter without fallbacks', () => {
    const queue = buildBibleAudioQueue({
      albumTitle: 'Audio de la Biblia',
      artist: `RVR09 • ${RV1909_READER}`,
      books: [
        {
          id: 'JHN',
          name: 'Juan',
          commonName: 'Juan',
          title: null,
          numberOfChapters: 21,
          totalNumberOfVerses: 0,
        },
      ],
      currentBookId: 'JHN',
      currentChapter: 3,
      limit: 1,
      selectedAudioUrls: [],
      selectedReader: RV1909_READER,
      translationId: 'spa_r09',
      translationLabel: 'RVR09',
    });
    expect(queue.map(({ bookId, chapter }) => `${bookId} ${chapter}`)).toEqual([
      'JHN 4',
    ]);
    expect(queue[0].fallbacks).toEqual([]);
  });
});
