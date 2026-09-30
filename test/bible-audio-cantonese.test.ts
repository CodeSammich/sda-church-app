jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// As if the Worker were deployed with only an Old Testament Cantonese
// fileset, so the tests can reach a testament without a recording.
jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  BIBLE_BRAIN_AUDIO: {
    baseUrl: 'https://bible-audio.example.org/',
    cantoneseFilesets: { oldTestament: 'YUEOTN2DA', newTestament: '' },
    cantoneseNotice: '',
  },
}));

import { BIBLE_BRAIN_AUDIO } from '@/constants/ExternalLinks';
import {
  buildBibleAudioQueue,
  getBibleAudioSourceLabel,
} from '@/services/BibleAudioService';
import {
  CANTONESE_CUV_READER,
  getCantoneseCuvChapterUrl,
  getCuvChapterAudioLinks,
  isBibleBrainAudioUrl,
} from '@/services/BibleAudioSources';

const OFF = { baseUrl: '', cantoneseFilesets: { oldTestament: 'X', newTestament: 'Y' }, cantoneseNotice: '' };
const NT_ONLY = {
  baseUrl: 'https://bible-audio.example.org',
  cantoneseFilesets: { oldTestament: '', newTestament: 'YUHUNVN2DA' },
  cantoneseNotice: '',
};

describe('Cantonese CUV audio through the Bible Brain Worker', () => {
  it('stays off until the Worker address is set', () => {
    expect(getCantoneseCuvChapterUrl('MAT', 1, OFF)).toBeNull();
    expect(Object.keys(getCuvChapterAudioLinks('MAT', 1, OFF))).toEqual(['基督徒团契 (Audio Power)']);
    expect(isBibleBrainAudioUrl('https://bible-audio.example.org/v1/audio/Y/MAT/1', OFF)).toBe(false);
  });

  it('gives each chapter a stable Worker address the queue can hold', () => {
    expect(getCantoneseCuvChapterUrl('mat', 28, NT_ONLY)).toBe(
      'https://bible-audio.example.org/v1/audio/YUHUNVN2DA/MAT/28',
    );
    expect(getCantoneseCuvChapterUrl('REV', 22, NT_ONLY)).toBe(
      'https://bible-audio.example.org/v1/audio/YUHUNVN2DA/REV/22',
    );
  });

  it('has no Cantonese audio for a testament without a fileset, or for chapters that don’t exist', () => {
    expect(getCantoneseCuvChapterUrl('GEN', 1, NT_ONLY)).toBeNull();
    expect(getCantoneseCuvChapterUrl('MAT', 29, NT_ONLY)).toBeNull();
    expect(getCantoneseCuvChapterUrl('MAT', 0, NT_ONLY)).toBeNull();
    expect(getCantoneseCuvChapterUrl('XYZ', 1, NT_ONLY)).toBeNull();
  });

  it('lists Cantonese after the Mandarin narration, which covers every chapter', () => {
    const nt = getCuvChapterAudioLinks('JHN', 3, NT_ONLY);
    expect(Object.keys(nt)).toEqual(['基督徒团契 (Audio Power)', CANTONESE_CUV_READER]);
    expect(nt[CANTONESE_CUV_READER]).toEqual(['https://bible-audio.example.org/v1/audio/YUHUNVN2DA/JHN/3']);
    expect(Object.keys(getCuvChapterAudioLinks('PSA', 23, NT_ONLY))).toEqual(['基督徒团契 (Audio Power)']);
  });

  it('names Faith Comes By Hearing as the source of Worker audio', () => {
    expect(BIBLE_BRAIN_AUDIO.baseUrl).toBe('https://bible-audio.example.org/');
    expect(getBibleAudioSourceLabel('https://bible-audio.example.org/v1/audio/YUEOTN2DA/GEN/1')).toBe(
      'Faith Comes By Hearing',
    );
    expect(getBibleAudioSourceLabel('https://archive.org/download/CUV_201911/CUV_B01C001.mp3')).toBe(
      'Internet Archive',
    );
  });

  it('ends the queue where the Cantonese recording ends, instead of skipping ahead', () => {
    const books = ['MAL', 'MAT'].map((id) => ({
      id, name: id, commonName: id, title: null,
      numberOfChapters: id === 'MAL' ? 4 : 28, totalNumberOfVerses: 0,
    }));
    const queue = buildBibleAudioQueue({
      albumTitle: 'Bible audio',
      artist: `CUV • ${CANTONESE_CUV_READER}`,
      books,
      currentBookId: 'MAL',
      currentChapter: 2,
      limit: 5,
      selectedAudioUrls: [],
      selectedReader: CANTONESE_CUV_READER,
      translationId: 'cmn_cuv',
      translationLabel: 'CUV',
    });
    expect(queue.map(({ bookId, chapter }) => `${bookId} ${chapter}`)).toEqual(['MAL 3', 'MAL 4']);
    expect((queue[0].source as { uri: string }).uri).toBe('https://bible-audio.example.org/v1/audio/YUEOTN2DA/MAL/3');
    expect(queue[0].fallbacks).toEqual([]);
  });

  it('keeps queueing every chapter for the Mandarin narration', () => {
    const books = ['MAL', 'MAT'].map((id) => ({
      id, name: id, commonName: id, title: null,
      numberOfChapters: id === 'MAL' ? 4 : 28, totalNumberOfVerses: 0,
    }));
    const queue = buildBibleAudioQueue({
      albumTitle: 'Bible audio',
      artist: 'CUV',
      books,
      currentBookId: 'MAL',
      currentChapter: 2,
      limit: 5,
      selectedAudioUrls: [],
      selectedReader: '基督徒团契 (Audio Power)',
      translationId: 'cmn_cuv',
      translationLabel: 'CUV',
    });
    expect(queue.map(({ bookId, chapter }) => `${bookId} ${chapter}`)).toEqual([
      'MAL 3', 'MAL 4', 'MAT 1', 'MAT 2', 'MAT 3',
    ]);
  });
});
