import { CUV_ADVENTIST_AUDIO_URLS } from '@/constants/CuvAdventistAudioManifest';
import {
  getBabiesSabbathSchoolUrl,
  getChildrenSabbathSchoolLanguage,
  getCurrentChildrenSabbathSchoolAvailability,
  getCurrentChildrenSabbathSchoolOptions,
  getCurrentChildrenSabbathSchoolPdfUrl,
  getCurrentChildrenSabbathSchoolUrl,
  getCurrentSabbathSchoolUrl,
} from '@/constants/ExternalLinks';
import { getAudioPowerCuvChapterLinks } from '@/services/BibleAudioSources';
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
import { EGW_BOOKS } from '@/features/library/EgwBookCatalog';

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
  it('opens Babies resources in the selected app language', () => {
    expect(getBabiesSabbathSchoolUrl('en')).toBe(
      'https://babies.aliveinjesus.info/resources',
    );
    expect(getBabiesSabbathSchoolUrl('zh')).toBe(
      'https://babies.aliveinjesus.info/zh/resources',
    );
    expect(getBabiesSabbathSchoolUrl('zh-cn')).toBe(
      'https://babies.aliveinjesus.info/zh/resources',
    );
    expect(getBabiesSabbathSchoolUrl('es')).toBe(
      'https://babies.aliveinjesus.info/es/resources',
    );
  });

  it('links directly to the lesson containing the requested Sabbath School week', () => {
    expect(getCurrentSabbathSchoolUrl('en', new Date(2026, 7, 23))).toBe(
      'https://sabbath-school.adventech.io/en/2026-03/09',
    );
    expect(getCurrentSabbathSchoolUrl('zh-cn', new Date(2026, 7, 23))).toBe(
      'https://sabbath-school.adventech.io/zh/2026-03/09',
    );
    expect(getCurrentSabbathSchoolUrl('en', new Date(2026, 8, 26))).toBe(
      'https://sabbath-school.adventech.io/en/2026-04/01',
    );
  });

  it('links each children\'s age bracket directly to its current lesson', () => {
    const currentSunday = new Date(2026, 7, 23);

    expect(getCurrentChildrenSabbathSchoolUrl('beginner-student', 'en', currentSunday)).toBe(
      'https://app.beginner.aliveinjesus.info/en/2026-03-zaijbgsg/09',
    );
    expect(getCurrentChildrenSabbathSchoolUrl('beginner-teacher', 'en', currentSunday)).toBe(
      'https://app.beginner.aliveinjesus.info/en/2026-03-yaijbgtg/09',
    );
    expect(getCurrentChildrenSabbathSchoolUrl('kindergarten-student', 'en', currentSunday)).toBe(
      'https://app.kindergarten.aliveinjesus.info/en/2026-03-zaijkdsg/09',
    );
    expect(getCurrentChildrenSabbathSchoolUrl('primary-teacher', 'en', currentSunday)).toBe(
      'https://app.primary.aliveinjesus.info/en/2026-03-yaijprtg/09',
    );
    expect(getCurrentChildrenSabbathSchoolUrl('junior', 'en', currentSunday)).toBe(
      'https://sabbath-school.adventech.io/en/2026-03-pp/09',
    );
    expect(getCurrentChildrenSabbathSchoolUrl('teen', 'en', currentSunday)).toBe(
      'https://sabbath-school.adventech.io/en/2026-03-rt/09',
    );
    expect(getCurrentChildrenSabbathSchoolUrl('youth', 'en', currentSunday)).toBe(
      'https://sabbath-school.adventech.io/en/2026-03-cc/09',
    );
  });

  it('starts the Alive in Jesus lesson week on Sunday', () => {
    expect(
      getCurrentChildrenSabbathSchoolUrl('primary-student', 'en', new Date(2026, 7, 22)),
    ).toMatch(/\/2026-03-zaijprsg\/08$/);
    expect(
      getCurrentChildrenSabbathSchoolUrl('primary-student', 'en', new Date(2026, 7, 23)),
    ).toMatch(/\/2026-03-zaijprsg\/09$/);
    expect(
      getCurrentChildrenSabbathSchoolUrl('primary-student', 'en', new Date(2026, 8, 27)),
    ).toMatch(/\/2026-04-zaijprsg\/01$/);
  });

  it('resolves a children\'s lesson to its direct official PDF', async () => {
    const fetchLesson = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { id: '2026-03-yaijbgtg', start_date: '28/06/2026', end_date: '26/09/2026' },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lessons: [{ id: '09', start_date: '23/08/2026', end_date: '29/08/2026' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pdfs: [{ src: 'https://sabbath-school-pdf.adventech.io/pdf/en/current.pdf' }],
        }),
      });

    await expect(getCurrentChildrenSabbathSchoolPdfUrl(
      'beginner-teacher',
      'en',
      new Date(2026, 7, 23),
      fetchLesson,
    )).resolves.toBe('https://sabbath-school-pdf.adventech.io/pdf/en/current.pdf');
    expect(fetchLesson).toHaveBeenNthCalledWith(
      1,
      'https://sabbath-school.adventech.io/api/v2/en/quarterlies/index.json',
    );
    expect(fetchLesson).toHaveBeenNthCalledWith(
      2,
      'https://sabbath-school.adventech.io/api/v2/en/quarterlies/2026-03-yaijbgtg/index.json',
    );
    expect(fetchLesson).toHaveBeenNthCalledWith(
      3,
      'https://sabbath-school.adventech.io/api/v2/en/quarterlies/2026-03-yaijbgtg/lessons/09/index.json',
    );
  });

  it('selects the teacher PDF from older children\'s shared lesson feeds', async () => {
    const fetchLesson = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { id: '2026-03-pp', start_date: '27/06/2026', end_date: '25/09/2026' },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lessons: [{ id: '09', start_date: '22/08/2026', end_date: '28/08/2026' }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pdfs: [
            { src: 'https://sabbath-school-pdf.adventech.io/pdf/en/student.pdf' },
            { src: 'https://sabbath-school-pdf.adventech.io/pdf/en/teacher.pdf' },
          ],
        }),
      });

    await expect(getCurrentChildrenSabbathSchoolPdfUrl(
      'junior-teacher',
      'en',
      new Date(2026, 7, 23),
      fetchLesson,
    )).resolves.toBe('https://sabbath-school-pdf.adventech.io/pdf/en/teacher.pdf');
    expect(fetchLesson).toHaveBeenNthCalledWith(
      3,
      'https://sabbath-school.adventech.io/api/v2/en/quarterlies/2026-03-pp/lessons/09/index.json',
    );
  });

  it('uses language-specific children catalog entry points', () => {
    const currentWeek = new Date(2026, 8, 3);

    expect(getCurrentChildrenSabbathSchoolUrl('beginner-student', 'zh', currentWeek)).toBe(
      'https://sabbath-school.adventech.io/zh?group=%E5%88%9D%E7%BA%A7%E5%AD%A6%E8%AF%BE',
    );
    expect(getCurrentChildrenSabbathSchoolUrl('kindergarten-teacher', 'zh-cn', currentWeek)).toBe(
      'https://sabbath-school.adventech.io/zh?group=%E4%B8%AD%E7%BA%A7%E5%AD%A6%E8%AF%BE',
    );
    expect(getChildrenSabbathSchoolLanguage('beginner-student', 'zh')).toBe('zh');
    expect(getChildrenSabbathSchoolLanguage('primary-student', 'zh')).toBe('zh');
    expect(getChildrenSabbathSchoolLanguage('beginner-student', 'es')).toBe('es');
  });

  it('reports current availability for every division without cross-language fallback', async () => {
    const fetchCatalog = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: '2026-03-bg', start_date: '27/06/2026', end_date: '25/09/2026' },
        { id: '2026-03-kd', start_date: '27/06/2026', end_date: '25/09/2026' },
      ]),
    });

    await expect(getCurrentChildrenSabbathSchoolAvailability(
      'zh',
      new Date(2026, 8, 3),
      fetchCatalog,
    )).resolves.toMatchObject({
      'beginner-student': true,
      'beginner-teacher': true,
      'kindergarten-student': true,
      'kindergarten-teacher': true,
      'primary-student': false,
      junior: false,
      teen: false,
      youth: false,
    });
    expect(fetchCatalog).toHaveBeenCalledWith(
      'https://sabbath-school.adventech.io/api/v2/zh/quarterlies/index.json',
      { signal: undefined },
    );
  });

  it('uses the live provider category name for available localized lessons', async () => {
    const fetchCatalog = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ([
        {
          id: '2026-03-bg',
          start_date: '27/06/2026',
          end_date: '25/09/2026',
          quarterly_group: { name: '初级学课' },
        },
      ]),
    });

    const options = await getCurrentChildrenSabbathSchoolOptions(
      'zh',
      new Date(2026, 8, 3),
      fetchCatalog,
    );

    expect(options['beginner-student']).toEqual({
      available: true,
      categoryName: '初级学课',
    });
    expect(options['primary-student']).toEqual({
      available: false,
      categoryName: undefined,
    });
  });

  it('uses the Chinese provider lesson date range and teacher PDF', async () => {
    const fetchLesson = jest.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ([
          { id: '2026-03-bg', start_date: '27/06/2026', end_date: '25/09/2026' },
        ]),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          lessons: [
            { id: '02', start_date: '25/07/2026', end_date: '28/08/2026' },
            { id: '03', start_date: '29/08/2026', end_date: '25/09/2026' },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          pdfs: [
            { src: 'https://sabbath-school-pdf.adventech.io/pdf/zh/student.pdf' },
            { src: 'https://sabbath-school-pdf.adventech.io/pdf/zh/teacher.pdf' },
          ],
        }),
      });

    await expect(getCurrentChildrenSabbathSchoolPdfUrl(
      'beginner-teacher',
      'zh',
      new Date(2026, 8, 3),
      fetchLesson,
    )).resolves.toBe('https://sabbath-school-pdf.adventech.io/pdf/zh/teacher.pdf');
    expect(fetchLesson).toHaveBeenNthCalledWith(
      1,
      'https://sabbath-school.adventech.io/api/v2/zh/quarterlies/index.json',
    );
    expect(fetchLesson).toHaveBeenNthCalledWith(
      2,
      'https://sabbath-school.adventech.io/api/v2/zh/quarterlies/2026-03-bg/index.json',
    );
    expect(fetchLesson).toHaveBeenNthCalledWith(
      3,
      'https://sabbath-school.adventech.io/api/v2/zh/quarterlies/2026-03-bg/lessons/03/index.json',
    );
  });

  it('generates all 1,189 CUV chapters with three ordered, valid origins', () => {
    const chapters = CUV_BOOKS.flatMap(([book, count]) =>
      Array.from({ length: count }, (_, index) =>
        urls(getAudioPowerCuvChapterLinks(book, index + 1)),
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

  it('generates every curated EGW edition URL on the official host', () => {
    const editions = EGW_BOOKS.flatMap((work) => work.editions);

    expect(editions).toHaveLength(33);
    expect(editions.filter(({ language }) => language === 'en')).toHaveLength(11);
    expect(editions.filter(({ language }) => language === 'zh')).toHaveLength(11);
    expect(editions.filter(({ language }) => language === 'es')).toHaveLength(11);
    assertHttpsUrls(
      editions.map(({ url }) => url),
      'text.egwwritings.org',
    );
  });
});
