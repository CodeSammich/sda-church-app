import { CUV_ADVENTIST_AUDIO_URLS } from '@/constants/CuvAdventistAudioManifest';
import { getAudioPowerCuvChapterLinks } from '@/services/BibleService';
import { getEnglishHymnUrl, getSortedHymns } from '@/features/hymnal/EnglishHymnal';
import {
  getChinese505HymnUrl,
  getSortedChinese505Hymns,
} from '@/features/hymnal/Chinese505Hymnal';
import {
  getChinese506HymnUrl,
  getSortedChinese506Hymns,
} from '@/features/hymnal/Chinese506Hymnal';
import {
  getChinese707HymnUrl,
  getSortedChinese707Hymns,
  type Chinese707Version,
} from '@/features/hymnal/Chinese707Hymnal';

const CUV_BOOKS = [
  ['GEN', 50], ['EXO', 40], ['LEV', 27], ['NUM', 36], ['DEU', 34],
  ['JOS', 24], ['JDG', 21], ['RUT', 4], ['1SA', 31], ['2SA', 24],
  ['1KI', 22], ['2KI', 25], ['1CH', 29], ['2CH', 36], ['EZR', 10],
  ['NEH', 13], ['EST', 10], ['JOB', 42], ['PSA', 150], ['PRO', 31],
  ['ECC', 12], ['SNG', 8], ['ISA', 66], ['JER', 52], ['LAM', 5],
  ['EZK', 48], ['DAN', 12], ['HOS', 14], ['JOL', 3], ['AMO', 9],
  ['OBA', 1], ['JON', 4], ['MIC', 7], ['NAH', 3], ['HAB', 3],
  ['ZEP', 3], ['HAG', 2], ['ZEC', 14], ['MAL', 4], ['MAT', 28],
  ['MRK', 16], ['LUK', 24], ['JHN', 21], ['ACT', 28], ['ROM', 16],
  ['1CO', 16], ['2CO', 13], ['GAL', 6], ['EPH', 6], ['PHP', 4],
  ['COL', 4], ['1TH', 5], ['2TH', 3], ['1TI', 6], ['2TI', 4],
  ['TIT', 3], ['PHM', 1], ['HEB', 13], ['JAS', 5], ['1PE', 5],
  ['2PE', 3], ['1JN', 5], ['2JN', 1], ['3JN', 1], ['JUD', 1],
  ['REV', 22],
] as const;

const urls = (links: ReturnType<typeof getAudioPowerCuvChapterLinks>) =>
  ([] as string[]).concat(Object.values(links)[0]);

const assertHttpsUrls = (values: string[], expectedHost: string) => {
  expect(new Set(values).size).toBe(values.length);
  for (const value of values) {
    const url = new URL(value);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe(expectedHost);
    expect(value).not.toMatch(/placeholder|undefined|null/i);
  }
};

describe('generated external dependency URLs', () => {
  it('generates all 1,189 CUV chapters with three ordered, valid origins', () => {
    const chapters = CUV_BOOKS.flatMap(([book, count]) =>
      Array.from({ length: count }, (_, index) =>
        urls(getAudioPowerCuvChapterLinks(book, index + 1, count)),
      ),
    );

    expect(chapters).toHaveLength(1189);
    for (const chapter of chapters) {
      expect(chapter).toHaveLength(3);
      expect(chapter.map((value) => new URL(value).hostname)).toEqual([
        'assets.adventistconnect.org',
        'theaudiopower.com',
        'archive.org',
      ]);
      expect(chapter.join(' ')).not.toMatch(/placeholder|undefined|null/i);
    }

    const allUrls = chapters.flat();
    expect(new Set(allUrls).size).toBe(1189 * 3);
    expect(Object.keys(CUV_ADVENTIST_AUDIO_URLS)).toHaveLength(1189);
  });

  it('generates every English hymnal page URL', () => {
    const hymns = getSortedHymns();
    // Local title metadata currently stops at #694. URL routing remains
    // intentionally valid for all 695 canonical hymn numbers.
    expect(hymns).toHaveLength(694);
    expect(hymns.some(({ number }) => number === 695)).toBe(false);
    assertHttpsUrls(
      Array.from({ length: 695 }, (_, index) => getEnglishHymnUrl(index + 1)),
      'hymnsforworship.org',
    );
  });

  it('generates every Chinese hymnal page URL from its published page ID', () => {
    const urls505 = getSortedChinese505Hymns().map(({ number }) =>
      getChinese505HymnUrl(number),
    );
    const urls506 = getSortedChinese506Hymns().map(({ number }) =>
      getChinese506HymnUrl(number),
    );
    const urls707 = ([1, 2, 3] as Chinese707Version[]).flatMap((version) =>
      getSortedChinese707Hymns(version).map(({ number }) =>
        getChinese707HymnUrl(version, number),
      ),
    );

    assertHttpsUrls([...urls505, ...urls506, ...urls707], 'm.zgaxr.com');
    expect(urls505).toHaveLength(500);
    expect(urls506).toHaveLength(506);
    expect(urls707).toHaveLength(2137);
  });
});
