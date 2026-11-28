jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

import { setAudioModeAsync } from 'expo-audio';
import { CANTONESE_CUV_READER, RV1909_READER } from '@/services/BibleAudioSources';
import {
  activateBibleAudioLockScreen,
  buildBibleAudioQueue,
  configureBibleAudioPlayback,
  getBibleAudioArtist,
  getBibleAudioSourceId,
  getBibleAudioSourceLabel,
  getFollowingBibleChapters,
  getPrecedingBibleChapters,
  getOrderedBibleAudioReaders,
  initializeBibleAudioPlayback,
  prioritizeBibleAudioSource,
  releaseBibleAudioFocus,
  retargetHelloAoAudioUrl,
  shouldStopBibleAudioAtChapterEnd,
  withDownloadedCopy,
} from '@/services/BibleAudioService';

describe('Bible audio playback', () => {
  it('configures long-form background playback', async () => {
    await configureBibleAudioPlayback();

    expect(setAudioModeAsync).toHaveBeenCalledWith({
      interruptionMode: 'doNotMixPersistent',
      playsInSilentMode: true,
      shouldPlayInBackground: true,
    });
  });

  // expo-audio on Android refuses every play from outside the app while audio
  // is off, so the notification's play did nothing after a pause in the app.
  it('releases the audio focus but leaves Android able to play from the notification (#804)', async () => {
    const calls: Array<[string, boolean]> = [];
    const record = (platform: string) => async (active: boolean) => { calls.push([platform, active]); };
    await releaseBibleAudioFocus('android', record('android'));
    await releaseBibleAudioFocus('ios', record('ios'));
    await releaseBibleAudioFocus('web', record('web'));
    expect(calls).toEqual([['android', false], ['android', true], ['ios', false]]);
  });

  it('publishes playback to system media controls', () => {
    const player = { setActiveForLockScreen: jest.fn() };
    const metadata = {
      title: 'Genesis 1',
      artist: 'Berean Standard Bible',
      albumTitle: 'Bible audio',
    };

    activateBibleAudioLockScreen(player as any, metadata);

    // The intervals must be given: expo-audio 58.0.10 on Android leaves a
    // missing one at 0, so a lock-screen skip moved 0.1 seconds.
    expect(player.setActiveForLockScreen).toHaveBeenCalledWith(true, metadata, {
      showSeekBackward: true,
      showSeekForward: true,
      seekBackwardIntervalSeconds: 10,
      seekForwardIntervalSeconds: 30,
    });
  });

  it('seeds the native queue before activating lock-screen controls', () => {
    const calls: string[] = [];
    const player = {
      setCurrentChapter: jest.fn(() => calls.push('current-chapter')),
      setQueue: jest.fn(() => calls.push('queue')),
      setPreviousQueue: jest.fn(() => calls.push('previous-queue')),
      setActiveForLockScreen: jest.fn(() => calls.push('lock-screen')),
    };
    const metadata = {
      title: 'Genesis 1',
      artist: 'Berean Standard Bible',
      albumTitle: 'Bible audio',
    };

    initializeBibleAudioPlayback({
      player,
      currentChapter: {
        bookId: 'GEN',
        chapter: 1,
        translationId: 'BSB',
        source: { uri: 'https://example.com/genesis-1.mp3' },
        metadata,
      },
      queue: [
        {
          bookId: 'GEN',
          chapter: 2,
          translationId: 'BSB',
          source: { uri: 'https://example.com/genesis-2.mp3' },
          metadata,
        },
      ],
      previousQueue: [],
      metadata,
    });

    expect(calls).toEqual(['current-chapter', 'queue', 'previous-queue', 'lock-screen']);
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

  it('lists Mandarin before Cantonese, and narrators it does not know after those it does', () => {
    const mandarin = '基督徒团契 (Audio Power)';
    const { CANTONESE_CUV_READER } = jest.requireActual('../services/BibleAudioSources');
    const cuv = { [CANTONESE_CUV_READER]: 'c.mp3', [mandarin]: 'm.mp3' };
    expect(getOrderedBibleAudioReaders('cmn_cuv', cuv).map(([reader]) => reader)).toEqual([mandarin, CANTONESE_CUV_READER]);
    const bsb = { someone: 'x.mp3', gilbert: 'g.mp3', hays: 'h.mp3' };
    expect(getOrderedBibleAudioReaders('BSB', bsb).map(([reader]) => reader)).toEqual(['hays', 'gilbert', 'someone']);
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
    // Back from Exodus 2: nearest first, into the book before, and no further.
    expect(getPrecedingBibleChapters(books, 'EXO', 2, 9)).toEqual([
      { book: books[1], chapter: 1 },
      { book: books[0], chapter: 2 },
      { book: books[0], chapter: 1 },
    ]);
    expect(getPrecedingBibleChapters(books, 'GEN', 1, 9)).toEqual([]);
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
      }),
    ).toEqual([
      expect.objectContaining({
        bookId: 'GEN',
        chapter: 2,
        metadata: expect.objectContaining({
          title: 'Genesis 2',
        }),
        source: expect.objectContaining({
          uri: 'https://bible.helloao.org/api/BSB/GEN/2/audio/souer.mp3',
        }),
      }),
      expect.objectContaining({
        bookId: 'GEN',
        chapter: 3,
        metadata: expect.objectContaining({
          title: 'Genesis 3',
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
    });

    expect(queued.source).toEqual(
      expect.objectContaining({ uri: expect.stringContaining('archive.org') }),
    );
    expect(queued.fallbacks?.map(({ source }) => (source as any).uri)).toEqual([
      expect.stringContaining('audio.bible.helloao.org'),
      expect.stringContaining('assets.adventistconnect.org'),
      expect.stringContaining('theaudiopower'),
    ]);
  });
});


describe('Downloaded Bible audio in the queue (#556)', () => {
  const books = [
    { id: 'GEN', name: 'Genesis', commonName: 'Genesis', title: null, numberOfChapters: 3, totalNumberOfVerses: 0 },
  ];
  const DOWNLOADED = 'file:///data/user/0/org.nyccsda.app/files/bible-audio/cuv-mandarin/GEN/2.mp3';

  it("plays the phone's copy first, even with another source chosen, then the streamed sources in their usual order", () => {
    const [second, third] = buildBibleAudioQueue({
      albumTitle: 'Bible audio',
      artist: 'CUV',
      books,
      currentBookId: 'GEN',
      currentChapter: 1,
      getDownloadedUri: (bookId, chapter) => (bookId === 'GEN' && chapter === 2 ? DOWNLOADED : null),
      preferredSourceId: 'archive.org',
      selectedAudioUrls: [],
      translationId: 'cmn_cuv',
    });

    expect([second.source, ...(second.fallbacks ?? []).map(({ source }) => source)].map((source) => (source as any).uri))
      .toEqual([
        DOWNLOADED,
        expect.stringContaining('archive.org'),
        expect.stringContaining('audio.bible.helloao.org'),
        expect.stringContaining('assets.adventistconnect.org'),
        expect.stringContaining('theaudiopower'),
      ]);
    // The lock screen names the chapter alone, whichever copy plays (#804).
    expect(second.metadata.title).toBe('Genesis 2');
    expect(second.fallbacks?.map(({ metadata }) => metadata.title)).toEqual(
      second.fallbacks?.map(() => 'Genesis 2'),
    );
    // A chapter that isn't on the phone streams.
    expect((third.source as any).uri).toContain('archive.org');
  });

  it('orders a chapter the same way for the reader', () => {
    const streamed = ['https://assets.adventistconnect.org/a.mp3', 'https://archive.org/a.mp3'];
    expect(withDownloadedCopy(streamed, DOWNLOADED)).toEqual([DOWNLOADED, ...streamed]);
    expect(withDownloadedCopy(streamed, null)).toEqual(streamed);
  });
});

describe('The narrator on the lock screen and in the media notification (#804)', () => {
  it("is named in the app's language, as Offline Bible Audio names it", () => {
    const cuv = { id: 'cmn_cuv', name: 'CUV' };
    expect(getBibleAudioArtist(cuv, CANTONESE_CUV_READER, 'zh')).toBe('粵語（和合本）');
    expect(getBibleAudioArtist(cuv, CANTONESE_CUV_READER, 'zh-cn')).toBe('粤语（和合本）');
    expect(getBibleAudioArtist(cuv, CANTONESE_CUV_READER, 'en')).toBe('Cantonese (Chinese Union Version)');
    expect(getBibleAudioArtist({ id: 'BSB', name: 'BSB' }, 'souer', 'es')).toBe('Inglés – Souer (BSB)');
    expect(getBibleAudioArtist({ id: 'spa_r09', name: 'RVR09' }, RV1909_READER, 'es'))
      .toBe('Español (Reina-Valera 1909)');
  });

  it("falls back to the translation's name for a narrator it doesn't know", () => {
    expect(getBibleAudioArtist({ id: 'BSB', name: 'BSB' }, 'newcomer', 'en')).toBe('BSB • newcomer');
    expect(getBibleAudioArtist({ id: 'BSB', name: 'BSB' }, undefined, 'en')).toBe('BSB');
  });
});

describe('Bible audio sleep timer boundaries', () => {
  const options = {
    albumTitle: 'Bible audio', artist: 'Souer',
    books: ['GEN', 'EXO'].map((id) => ({
      id, name: id, commonName: id, title: null,
      numberOfChapters: 50, totalNumberOfVerses: 0,
    })),
    currentBookId: 'GEN', currentChapter: 48,
    selectedAudioUrls: ['https://bible.helloao.org/api/BSB/GEN/48/audio/souer.mp3'],
    translationId: 'BSB',
  };

  it('retains 24 chapter descriptors for background playback by default', () => {
    const queue = buildBibleAudioQueue(options);
    expect(queue).toHaveLength(24);
    expect(queue[2]).toMatchObject({ bookId: 'EXO', chapter: 1 });
  });

  it('queues the remaining book and excludes the next book', () => {
    expect(buildBibleAudioQueue({ ...options, sleepTimer: 'book' })
      .map(({ bookId, chapter }) => [bookId, chapter]))
      .toEqual([['GEN', 49], ['GEN', 50]]);
    expect(buildBibleAudioQueue({ ...options, currentChapter: 50, sleepTimer: 'book' }))
      .toEqual([]);
  });

  it('applies the same timer rules to the chapters before (#543)', () => {
    const preceding = { ...options, currentBookId: 'EXO', currentChapter: 2, direction: 'preceding' as const };
    expect(buildBibleAudioQueue(preceding).slice(0, 3).map(({ bookId, chapter }) => [bookId, chapter]))
      .toEqual([['EXO', 1], ['GEN', 50], ['GEN', 49]]);
    expect(buildBibleAudioQueue(preceding)).toHaveLength(24);
    expect(buildBibleAudioQueue({ ...preceding, sleepTimer: 'book' })
      .map(({ bookId, chapter }) => [bookId, chapter]))
      .toEqual([['EXO', 1]]);
    expect(buildBibleAudioQueue({ ...preceding, sleepTimer: 'chapter' })).toEqual([]);
  });

  it('keeps a chapter timer effective when playback is started or the queue is refilled', () => {
    expect(buildBibleAudioQueue({ ...options, sleepTimer: 'chapter' })).toEqual([]);
    expect(buildBibleAudioQueue({ ...options, sleepTimer: null })).toHaveLength(24);
  });

  it.each([
    ['book', 49, false], ['book', 50, true],
    ['chapter', 49, true], [null, 50, false], [15, 50, false],
  ] as const)('handles %s at chapter %s', (setting, chapter, stop) => {
    expect(shouldStopBibleAudioAtChapterEnd(setting, chapter, 50)).toBe(stop);
  });
});
