import { fetchChapter } from '@/services/BibleService';
import {
  getAudioPowerCuvChapterLinks,
  type TranslationBookChapterAudioLinks,
} from '@/services/BibleAudioSources';
import { CUV_ADVENTIST_AUDIO_URLS } from '@/constants/CuvAdventistAudioManifest';

const audioUrls = (links: TranslationBookChapterAudioLinks) =>
  ([] as string[]).concat(Object.values(links)[0]);
const audioPowerUrl = (links: TranslationBookChapterAudioLinks) =>
  audioUrls(links).find((url) => url.includes('theaudiopower.com'));

describe('Audio Power CUV chapter links', () => {
  it('builds an encoded multi-chapter Old Testament URL', () => {
    expect(audioPowerUrl(getAudioPowerCuvChapterLinks('GEN', 1))).toBe(
      'https://theaudiopower.com/CUV/Recordings/%E5%88%9B%E4%B8%96%E8%AE%B0%201.mp3',
    );
  });

  it('orders Adventist Connect, Audio Power, then Archive.org', () => {
    expect(audioUrls(getAudioPowerCuvChapterLinks('GEN', 1))).toEqual([
      'https://assets.adventistconnect.org/newyork2/2026/08/12215730/CUV_B01C001.mp3',
      'https://theaudiopower.com/CUV/Recordings/%E5%88%9B%E4%B8%96%E8%AE%B0%201.mp3',
      'https://archive.org/download/CUV_201911/CUV_B01C001.mp3',
    ]);
  });

  it('contains one church-hosted URL for every canonical chapter', () => {
    expect(Object.keys(CUV_ADVENTIST_AUDIO_URLS)).toHaveLength(1189);
    expect(CUV_ADVENTIST_AUDIO_URLS['CUV_B01C001.mp3']).toContain(
      '/CUV_B01C001.mp3',
    );
    expect(CUV_ADVENTIST_AUDIO_URLS['CUV_B66C022.mp3']).toContain(
      '/CUV_B66C022.mp3',
    );
  });

  it('builds an encoded New Testament URL', () => {
    expect(audioPowerUrl(getAudioPowerCuvChapterLinks('mat', 28))).toBe(
      'https://theaudiopower.com/CUV/Recordings/%E9%A9%AC%E5%A4%AA%E7%A6%8F%E9%9F%B3%2028.mp3',
    );
  });

  it('omits the chapter suffix for one-chapter books', () => {
    expect(audioPowerUrl(getAudioPowerCuvChapterLinks('2JN', 1))).toBe(
      'https://theaudiopower.com/CUV/Recordings/%E7%BA%A6%E7%BF%B0%E4%BA%8C%E4%B9%A6.mp3',
    );
  });

  it('does not expose a URL for invalid chapter coordinates', () => {
    expect(getAudioPowerCuvChapterLinks('GEN', 0)).toEqual({});
    expect(getAudioPowerCuvChapterLinks('GEN', 51)).toEqual({});
    expect(getAudioPowerCuvChapterLinks('UNKNOWN', 1)).toEqual({});
  });

  it.each(['cmn_cuv', 'cmn_cu1'])(
    'attaches chapter and adjacent links to %s chapter data',
    async (translationId) => {
      jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
        const url = String(input);
        if (url.endsWith(`/${translationId}/books.json`)) {
          return {
            ok: true,
            json: async () => ({
              books: [
                {
                  id: 'GEN',
                  name: '创世记',
                  commonName: '创世记',
                  title: null,
                  numberOfChapters: 50,
                  totalNumberOfVerses: 1533,
                },
              ],
            }),
          } as Response;
        }

        return {
          ok: true,
          json: async () => ({
            book: 'GEN',
            contents: [[], [], [[], ['2:1 天地万物都造齐了。']]],
          }),
        } as Response;
      });

      const chapter = await fetchChapter(translationId, 'GEN', 2);

      expect(audioPowerUrl(chapter.thisChapterAudioLinks)).toContain(
        '%E5%88%9B%E4%B8%96%E8%AE%B0%202.mp3',
      );
      expect(audioPowerUrl(chapter.previousChapterAudioLinks!)).toContain(
        '%E5%88%9B%E4%B8%96%E8%AE%B0%201.mp3',
      );
      expect(audioPowerUrl(chapter.nextChapterAudioLinks!)).toContain(
        '%E5%88%9B%E4%B8%96%E8%AE%B0%203.mp3',
      );
    },
  );
});
