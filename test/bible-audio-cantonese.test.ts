jest.mock('expo-audio', () => ({
  setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
}));

// As if the script were deployed with only an Old Testament Cantonese
// fileset, so the tests can reach a testament without a recording.
jest.mock('@/constants/ExternalLinks', () => ({
  ...jest.requireActual('@/constants/ExternalLinks'),
  BIBLE_BRAIN_AUDIO: {
    scriptUrl: 'https://script.google.com/macros/s/TEST/exec',
    cantoneseFilesets: { oldTestament: 'YUEOTN2DA', newTestament: '' },
    cantoneseNotice: '',
  },
}));

import {
  buildBibleAudioQueue,
  getBibleAudioSourceLabel,
  getBibleBrainAddressesToLookUp,
} from '@/services/BibleAudioService';
import {
  CANTONESE_CUV_READER,
  getCantoneseCuvChapterUrl,
  getCuvChapterAudioLinks,
} from '@/services/BibleAudioSources';
import {
  clearBibleBrainLinks,
  forgetBibleBrainLink,
  getPlayableBibleBrainUrl,
  getSignedLinkExpiry,
  isBibleBrainAudioUrl,
  lookUpBibleBrainAudio,
} from '@/services/BibleBrainAudio';

const SCRIPT = 'https://script.google.com/macros/s/TEST/exec';
const OFF = { scriptUrl: '', cantoneseFilesets: { oldTestament: 'X', newTestament: 'Y' }, cantoneseNotice: '' };
const NT_ONLY = {
  scriptUrl: SCRIPT,
  cantoneseFilesets: { oldTestament: '', newTestament: 'YUHUNVN2DA' },
  cantoneseNotice: '',
};
const address = (fileset: string, chapter: string) => `${SCRIPT}?fileset=${fileset}&chapters=${chapter}`;

const NOW = Date.UTC(2026, 8, 30, 14, 0, 0);
const MINUTE = 60_000;
// A signed link on FCBH's CDN, expiring `minutes` after NOW.
const signed = (chapter: string, minutes: number) =>
  `https://cdn.example.org/audio/${chapter}.mp3?Expires=${(NOW + minutes * MINUTE) / 1000}&Signature=abc&Key-Pair-Id=K`;

/** A fake script answering every chapter asked for, and recording each request. */
const fakeScript = (minutes = 120, duration = 300) =>
  jest.fn(async (url: string) => {
    const chapters = new URL(url).searchParams.get('chapters')!.split(',');
    return {
      ok: true,
      json: async () => ({
        links: Object.fromEntries(chapters.map((id) => [id, { url: signed(id, minutes), duration }])),
      }),
    };
  }) as unknown as typeof fetch & jest.Mock;

const books = ['MAL', 'MAT'].map((id) => ({
  id, name: id, commonName: id, title: null,
  numberOfChapters: id === 'MAL' ? 4 : 28, totalNumberOfVerses: 0,
}));
const queueOptions = (selectedReader: string) => ({
  albumTitle: 'Bible audio',
  artist: `CUV • ${selectedReader}`,
  books,
  currentBookId: 'MAL',
  currentChapter: 2,
  limit: 5,
  selectedAudioUrls: [],
  selectedReader,
  translationId: 'cmn_cuv',
  translationLabel: 'CUV',
  now: NOW,
});
const chaptersOf = (queue: ReturnType<typeof buildBibleAudioQueue>) =>
  queue.map(({ bookId, chapter }) => `${bookId} ${chapter}`);

beforeEach(() => clearBibleBrainLinks());

describe('Cantonese CUV chapters', () => {
  it('stays off until the script address is set', () => {
    expect(getCantoneseCuvChapterUrl('MAT', 1, OFF)).toBeNull();
    expect(Object.keys(getCuvChapterAudioLinks('MAT', 1, OFF))).toEqual(['基督徒团契 (Audio Power)']);
    expect(isBibleBrainAudioUrl(address('Y', 'MAT.1'), OFF)).toBe(false);
  });

  it('gives each chapter a stable script address', () => {
    expect(getCantoneseCuvChapterUrl('mat', 28, NT_ONLY)).toBe(address('YUHUNVN2DA', 'MAT.28'));
    expect(getCantoneseCuvChapterUrl('REV', 22, NT_ONLY)).toBe(address('YUHUNVN2DA', 'REV.22'));
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
    expect(nt[CANTONESE_CUV_READER]).toEqual([address('YUHUNVN2DA', 'JHN.3')]);
    expect(Object.keys(getCuvChapterAudioLinks('PSA', 23, NT_ONLY))).toEqual(['基督徒团契 (Audio Power)']);
  });

  it('names Faith Comes By Hearing as the source, for the address and its link', async () => {
    const chapter = address('YUEOTN2DA', 'GEN.1');
    expect(getBibleAudioSourceLabel(chapter)).toBe('Faith Comes By Hearing');
    await lookUpBibleBrainAudio([chapter], { fetchJson: fakeScript(), now: NOW });
    expect(getBibleAudioSourceLabel(getPlayableBibleBrainUrl(chapter, NOW)!)).toBe(
      'Faith Comes By Hearing',
    );
    expect(getBibleAudioSourceLabel('https://archive.org/download/CUV_201911/CUV_B01C001.mp3')).toBe(
      'Internet Archive',
    );
  });
});

describe('looking up FCBH links through the script', () => {
  it('asks once per fileset, at most 30 chapters at a time', async () => {
    const script = fakeScript();
    const psalms = Array.from({ length: 31 }, (_, index) => address('YUEOTN2DA', `PSA.${index + 1}`));
    await lookUpBibleBrainAudio([...psalms, address('YUHUNVN2DA', 'MAT.1')], {
      config: NT_ONLY,
      fetchJson: script,
      now: NOW,
    });
    const requests = script.mock.calls.map(([url]) => new URL(url).searchParams);
    expect(requests.map((params) => params.get('fileset'))).toEqual(['YUEOTN2DA', 'YUEOTN2DA', 'YUHUNVN2DA']);
    expect(requests[0].get('chapters')!.split(',')).toHaveLength(30);
    expect(requests[1].get('chapters')).toBe('PSA.31');
    expect(getPlayableBibleBrainUrl(psalms[30], NOW)).toBe(signed('PSA.31', 120));
  });

  it('keeps a link that will last through its chapter, and looks up one that won’t', async () => {
    const chapter = address('YUEOTN2DA', 'GEN.1');
    await lookUpBibleBrainAudio([chapter], { fetchJson: fakeScript(20), now: NOW });
    const again = fakeScript();
    await lookUpBibleBrainAudio([chapter], { fetchJson: again, now: NOW + 5 * MINUTE });
    expect(again).not.toHaveBeenCalled();

    // 15 minutes later the link has 5 left: not enough for a 5-minute chapter and the margin.
    expect(getPlayableBibleBrainUrl(chapter, NOW + 15 * MINUTE)).toBeNull();
    await lookUpBibleBrainAudio([chapter], { fetchJson: again, now: NOW + 15 * MINUTE });
    expect(again).toHaveBeenCalledTimes(1);
  });

  it('looks a link up again after it fails', async () => {
    const chapter = address('YUEOTN2DA', 'GEN.1');
    await lookUpBibleBrainAudio([chapter], { fetchJson: fakeScript(), now: NOW });
    forgetBibleBrainLink(getPlayableBibleBrainUrl(chapter, NOW));
    expect(getPlayableBibleBrainUrl(chapter, NOW)).toBeNull();
  });

  it('leaves chapters without links when the script fails or answers oddly', async () => {
    const chapter = address('YUEOTN2DA', 'GEN.1');
    const offline = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
    await expect(
      lookUpBibleBrainAudio([chapter], { fetchJson: offline as unknown as typeof fetch, now: NOW }),
    ).resolves.toBeUndefined();

    const odd = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ links: { 'GEN.1': { url: 'http://insecure.example.org/a.mp3' } } }),
    });
    await lookUpBibleBrainAudio([chapter], { fetchJson: odd as unknown as typeof fetch, now: NOW });
    expect(getPlayableBibleBrainUrl(chapter, NOW)).toBeNull();
  });

  it('reads when a signed link expires', () => {
    expect(getSignedLinkExpiry('https://cdn.example.org/a.mp3?Expires=1790000000&Signature=x')).toBe(
      1_790_000_000_000,
    );
    expect(
      getSignedLinkExpiry('https://s3.example.org/a.mp3?X-Amz-Date=20260930T140000Z&X-Amz-Expires=3600'),
    ).toBe(NOW + 60 * MINUTE);
    expect(getSignedLinkExpiry('https://cdn.example.org/a.mp3')).toBeNull();
  });
});

describe('the Cantonese queue', () => {
  it('holds only chapters whose links have been looked up', async () => {
    expect(buildBibleAudioQueue(queueOptions(CANTONESE_CUV_READER))).toEqual([]);

    const toLookUp = getBibleBrainAddressesToLookUp(queueOptions(CANTONESE_CUV_READER));
    expect(toLookUp).toEqual(['MAL.2', 'MAL.3', 'MAL.4'].map((id) => address('YUEOTN2DA', id)));
    await lookUpBibleBrainAudio(toLookUp, { fetchJson: fakeScript(), now: NOW });

    // Matthew has no Cantonese fileset here, so the queue ends after Malachi.
    const queue = buildBibleAudioQueue(queueOptions(CANTONESE_CUV_READER));
    expect(chaptersOf(queue)).toEqual(['MAL 3', 'MAL 4']);
    expect((queue[0].source as { uri: string }).uri).toBe(signed('MAL.3', 120));
    expect(queue[0].fallbacks).toEqual([]);
  });

  it('ends at the first chapter whose link would expire before it finishes', async () => {
    // Links last 18 minutes; each chapter takes 5, and a link must outlast its chapter by 5.
    const options = queueOptions(CANTONESE_CUV_READER);
    await lookUpBibleBrainAudio(getBibleBrainAddressesToLookUp(options), {
      fetchJson: fakeScript(18),
      now: NOW,
    });
    // Malachi 3 starts after Malachi 2, at 5 minutes; Malachi 4 at 10 would end past 13.
    expect(chaptersOf(buildBibleAudioQueue(options))).toEqual(['MAL 3']);
  });

  it('keeps queueing every chapter for the Mandarin narration', () => {
    expect(chaptersOf(buildBibleAudioQueue(queueOptions('基督徒团契 (Audio Power)')))).toEqual([
      'MAL 3', 'MAL 4', 'MAT 1', 'MAT 2', 'MAT 3',
    ]);
    expect(getBibleBrainAddressesToLookUp(queueOptions('基督徒团契 (Audio Power)'))).toEqual([]);
  });
});
