jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { setAudioModeAsync } from 'expo-audio';
import {
  activateBibleAudioLockScreen,
  buildBibleAudioQueue,
  configureBibleAudioPlayback,
  getBibleAudioSourceId,
  getBibleAudioSourceLabel,
  getFollowingBibleChapters,
  getOrderedBibleAudioReaders,
  prioritizeBibleAudioSource,
  retargetHelloAoAudioUrl,
} from '@/services/BibleAudioService';

describe('Bible audio playback', () => {
  it('configures long-form background playback', async () => {
    await configureBibleAudioPlayback();

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      interruptionMode: 'doNotMix',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
  });

  it('publishes playback to system media controls', () => {
    const player = { setActiveForLockScreen: jest.fn() };
    const metadata = {
      title: 'Genesis 1',
      artist: 'Berean Standard Bible',
      albumTitle: 'Bible audio',
    };

    activateBibleAudioLockScreen(player as any, metadata);

    expect(player.setActiveForLockScreen).toHaveBeenCalledWith(true, metadata, {
      showSeekBackward: true,
      showSeekForward: true,
    });
  });

  it('prioritizes a chosen source while preserving every fallback', () => {
    const urls = [
      'https://assets.adventistconnect.org/chapter.mp3',
      'https://theaudiopower.com/chapter.mp3',
      'https://archive.org/chapter.mp3',
    ];

    expect(getBibleAudioSourceId(urls[1])).toBe('theaudiopower.com');
    expect(prioritizeBibleAudioSource(urls, 'archive.org')).toEqual([
      urls[2],
      urls[0],
      urls[1],
    ]);
    expect(prioritizeBibleAudioSource(urls, 'unknown.example')).toEqual(urls);
  });

  it('uses concise provider labels in controls and media titles', () => {
    expect(
      getBibleAudioSourceLabel(
        'https://assets.adventistconnect.org/bibles/cuv/chapter.mp3',
      ),
    ).toBe('NYCCSDA.org');
    expect(
      getBibleAudioSourceLabel(
        'https://bible.helloao.org/api/BSB/GEN/1/audio/souer.mp3',
      ),
    ).toBe('HelloAO');
  });

  it('defaults BSB narrators to Souer, then Hays, then David', () => {
    const links = {
      david: 'https://audio.example/david.mp3',
      hays: 'https://audio.example/hays.mp3',
      souer: 'https://audio.example/souer.mp3',
    };

    expect(getOrderedBibleAudioReaders('BSB', links)).toEqual([
      ['souer', links.souer],
      ['hays', links.hays],
      ['david', links.david],
    ]);
  });

  it('preserves provider order for other translations', () => {
    const links = {
      david: 'https://audio.example/david.mp3',
      souer: 'https://audio.example/souer.mp3',
    };

    expect(getOrderedBibleAudioReaders('eng_kjv', links)).toEqual(
      Object.entries(links),
    );
  });

  it('walks chapter coordinates across book boundaries without fetching text', () => {
    const books = [
      {
        id: 'GEN',
        name: 'Genesis',
        commonName: 'Genesis',
        title: null,
        numberOfChapters: 2,
        totalNumberOfVerses: 0,
      },
      {
        id: 'EXO',
        name: 'Exodus',
        commonName: 'Exodus',
        title: null,
        numberOfChapters: 3,
        totalNumberOfVerses: 0,
      },
    ];

    expect(getFollowingBibleChapters(books, 'GEN', 1, 3)).toEqual([
      { book: books[0], chapter: 2 },
      { book: books[1], chapter: 1 },
      { book: books[1], chapter: 2 },
    ]);
  });

  it('retargets HelloAO audio without changing the narrator', () => {
    expect(
      retargetHelloAoAudioUrl(
        'https://bible.helloao.org/api/BSB/GEN/1/audio/souer.mp3',
        'BSB',
        'EXO',
        2,
      ),
    ).toBe('https://bible.helloao.org/api/BSB/EXO/2/audio/souer.mp3');
    expect(
      retargetHelloAoAudioUrl(
        'https://audio.example/chapter.mp3',
        'BSB',
        'EXO',
        2,
      ),
    ).toBeNull();
  });

  it('builds queue descriptors without loading future chapters', () => {
    const books = [
      {
        id: 'GEN',
        name: 'Genesis',
        commonName: 'Genesis',
        title: null,
        numberOfChapters: 3,
        totalNumberOfVerses: 0,
      },
    ];

    expect(
      buildBibleAudioQueue({
        albumTitle: 'Bible audio',
        artist: 'BSB • Souer',
        books,
        currentBookId: 'GEN',
        currentChapter: 1,
        limit: 2,
        selectedAudioUrls: [
          'https://bible.helloao.org/api/BSB/GEN/1/audio/souer.mp3',
        ],
        selectedReader: 'souer',
        translationId: 'BSB',
        translationLabel: 'BSB',
      }),
    ).toEqual([
      expect.objectContaining({
        bookId: 'GEN',
        chapter: 2,
        metadata: expect.objectContaining({
          title: 'Genesis 2 · BSB (HelloAO)',
        }),
        source: expect.objectContaining({
          uri: 'https://bible.helloao.org/api/BSB/GEN/2/audio/souer.mp3',
        }),
      }),
      expect.objectContaining({
        bookId: 'GEN',
        chapter: 3,
        metadata: expect.objectContaining({
          title: 'Genesis 3 · BSB (HelloAO)',
        }),
        source: expect.objectContaining({
          uri: 'https://bible.helloao.org/api/BSB/GEN/3/audio/souer.mp3',
        }),
      }),
    ]);
  });

  it('keeps every CUV mirror as a queued chapter fallback', () => {
    const books = [
      {
        id: 'GEN',
        name: 'Genesis',
        commonName: 'Genesis',
        title: null,
        numberOfChapters: 2,
        totalNumberOfVerses: 0,
      },
    ];

    const [queued] = buildBibleAudioQueue({
      albumTitle: 'Bible audio',
      artist: 'CUV',
      books,
      currentBookId: 'GEN',
      currentChapter: 1,
      limit: 1,
      preferredSourceId: 'archive.org',
      selectedAudioUrls: [],
      translationId: 'cmn_cuv',
      translationLabel: 'CUV',
    });

    expect(queued.source).toEqual(
      expect.objectContaining({ uri: expect.stringContaining('archive.org') }),
    );
    expect(queued.fallbacks).toHaveLength(2);
    expect(queued.fallbacks?.map(({ source }) => (source as any).uri)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('assets.adventistconnect.org'),
        expect.stringContaining('theaudiopower'),
      ]),
    );
  });
});
