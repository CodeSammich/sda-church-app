import {
  CHILDREN_AGE_GROUPS,
  findChildrenLesson,
  findChildrenLessonUrl,
  getChildrenQuarter,
  type ChildrenSabbathSchoolCurriculum,
} from '@/features/sabbath-school/ChildrenLessons';
import {
  AIJ_PDF,
  PDF,
  V2,
  V3,
  WEB_PAGE,
  day,
  englishCatalog,
  everything,
  fakeFetch,
  lessons,
} from './helpers/adventech-catalog';

const wednesday = day('2026-09-30');

describe('children’s Sabbath School lessons', () => {
  it('opens Junior, Teen, and Youth although the catalog lists this quarter with last quarter’s dates', async () => {
    const fetch = fakeFetch(everything);
    await expect(findChildrenLessonUrl('junior', 'en', wednesday, fetch)).resolves.toBe(
      `${PDF}/en/2026-04-pp/01-student.pdf`,
    );
    await expect(findChildrenLessonUrl('teen-teacher', 'en', wednesday, fetch)).resolves.toBe(
      `${PDF}/en/2026-04-rt/01-teacher.pdf`,
    );
    // Week 4 of the quarter, by number, since the lessons' dates are wrong too.
    await expect(findChildrenLessonUrl('youth', 'en', day('2026-10-17'), fetch)).resolves.toBe(
      `${PDF}/en/2026-04-cc/04-student.pdf`,
    );
  });

  it('prefers this quarter’s issue over next quarter’s with the wrong dates', async () => {
    // On 19 September both 2026-03-pp and the misdated 2026-04-pp claim today.
    await expect(
      findChildrenLessonUrl('junior', 'en', day('2026-09-19'), fakeFetch(everything)),
    ).resolves.toBe(`${PDF}/en/2026-03-pp/13-student.pdf`);
  });

  it('gives the days a lesson is for, from the catalog, but none for one picked by its number (#529)', async () => {
    const fetch = fakeFetch(everything);
    // An Alive in Jesus week runs Sunday to Sabbath.
    await expect(findChildrenLesson('beginner-student', 'en', wednesday, fetch)).resolves.toMatchObject({
      startsOn: day('2026-09-27'),
      endsOn: day('2026-10-03'),
    });
    // A quarterly lesson, Sabbath to Friday.
    await expect(findChildrenLesson('junior', 'en', day('2026-09-19'), fetch)).resolves.toMatchObject({
      url: `${PDF}/en/2026-03-pp/13-student.pdf`,
      startsOn: day('2026-09-19'),
      endsOn: day('2026-09-25'),
    });
    // The misdated quarter's lesson, picked by its number, and the website have no days.
    expect(await findChildrenLesson('junior', 'en', wednesday, fetch)).toEqual({ url: `${PDF}/en/2026-04-pp/01-student.pdf` });
    expect(await findChildrenLesson('junior', 'en', wednesday, fakeFetch({}))).toEqual({
      url: CHILDREN_AGE_GROUPS.junior.website,
    });
  });

  it('opens this week’s Alive in Jesus PDF from the newer catalog', async () => {
    const fetch = fakeFetch(everything);
    await expect(findChildrenLessonUrl('beginner-student', 'en', wednesday, fetch)).resolves.toBe(
      `${AIJ_PDF}/en/aij/2026-04-bg/01.pdf`,
    );
    await expect(findChildrenLessonUrl('beginner-teacher', 'en', wednesday, fetch)).resolves.toBe(
      `${AIJ_PDF}/en/aij/2026-04-bg-tg/01.pdf`,
    );
    expect(fetch).toHaveBeenCalledWith(`${V3}/en/aij/2026-04-bg/pdf.json`, expect.anything());
  });

  it('starts Alive in Jesus weeks on Sunday', async () => {
    const fetch = fakeFetch(everything);
    await expect(
      findChildrenLessonUrl('beginner-student', 'en', day('2026-09-26'), fetch),
    ).resolves.toBe(`${AIJ_PDF}/en/aij/2026-03-bg/13.pdf`);
    await expect(
      findChildrenLessonUrl('beginner-student', 'en', day('2026-09-27'), fetch),
    ).resolves.toBe(`${AIJ_PDF}/en/aij/2026-04-bg/01.pdf`);
  });

  it('opens the Chinese lesson when there is one', async () => {
    const fetch = fakeFetch(everything);
    await expect(findChildrenLessonUrl('beginner-teacher', 'zh', wednesday, fetch)).resolves.toBe(
      `${PDF}/zh/2026-04-bg/01-teacher.pdf`,
    );
    await expect(findChildrenLessonUrl('beginner-student', 'zh-cn', wednesday, fetch)).resolves.toBe(
      `${PDF}/zh/2026-04-bg/01-student.pdf`,
    );
  });

  it('opens the English lesson when there’s no Chinese one this week', async () => {
    const fetch = fakeFetch(everything);
    await expect(findChildrenLessonUrl('junior', 'zh', wednesday, fetch)).resolves.toBe(
      `${PDF}/en/2026-04-pp/01-student.pdf`,
    );
    await expect(findChildrenLessonUrl('youth-teacher', 'zh', wednesday, fetch)).resolves.toBe(
      `${PDF}/en/2026-04-cc/01-teacher.pdf`,
    );
    await expect(findChildrenLessonUrl('primary-student', 'zh', wednesday, fetch)).resolves.toBe(
      `${AIJ_PDF}/en/aij/2026-04-pr/01.pdf`,
    );
    // There are no Chinese Teen lessons, so it goes straight to English.
    fetch.mockClear();
    await findChildrenLessonUrl('teen', 'zh', wednesday, fetch);
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain(`${V2}/zh/quarterlies/index.json`);
  });

  it('opens English lessons in Spanish, which has no children’s lessons', async () => {
    await expect(
      findChildrenLessonUrl('junior-teacher', 'es', wednesday, fakeFetch(everything)),
    ).resolves.toBe(`${PDF}/en/2026-04-pp/01-teacher.pdf`);
  });

  it('opens the age group’s website when there’s no lesson', async () => {
    // Kindergarten's book for this quarter isn't out: the reader returns a web page.
    const missingBook = fakeFetch({
      [`${V3}/en/aij/2026-04-kd/sections/index.json`]: WEB_PAGE,
      [`${V3}/en/aij/2026-04-kd/pdf.json`]: WEB_PAGE,
    });
    await expect(
      findChildrenLessonUrl('kindergarten-student', 'en', wednesday, missingBook),
    ).resolves.toBe('https://kindergarten.aliveinjesus.info/');

    const offline = jest.fn(async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    await expect(findChildrenLessonUrl('teen', 'zh', wednesday, offline)).resolves.toBe(
      'https://teen.aliveinjesus.info/',
    );
  });

  it('opens the website when the lookup takes too long', async () => {
    let signal: AbortSignal | undefined;
    const hanging = jest.fn((_url: string, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;
    await expect(findChildrenLessonUrl('junior', 'en', wednesday, hanging, 20)).resolves.toBe(
      'https://junior.aliveinjesus.info/',
    );
    expect(signal?.aborted).toBe(true);
  });

  it('only opens PDFs from Adventech', async () => {
    const elsewhere = fakeFetch({
      ...englishCatalog,
      [`${V2}/en/quarterlies/2026-04-pp/lessons/01/index.json`]: {
        pdfs: [{ src: 'https://example.com/lesson.pdf' }],
      },
    });
    await expect(findChildrenLessonUrl('junior', 'en', wednesday, elsewhere)).resolves.toBe(
      'https://junior.aliveinjesus.info/',
    );
  });

  it('gives every age group a website and English lessons', () => {
    for (const [curriculum, ageGroup] of Object.entries(CHILDREN_AGE_GROUPS)) {
      const level = (curriculum as ChildrenSabbathSchoolCurriculum).replace(/-(student|teacher)$/, '');
      expect(ageGroup.website).toBe(`https://${level}.aliveinjesus.info/`);
      expect(ageGroup.sources.en?.length).toBeGreaterThan(0);
    }
  });
});

describe('children’s Sabbath School quarters', () => {
  it('starts a quarter on the Sabbath on or before its first day', () => {
    expect(getChildrenQuarter(day('2026-09-25'), 'saturday')).toEqual({ id: '2026-03', week: 13 });
    expect(getChildrenQuarter(day('2026-09-26'), 'saturday')).toEqual({ id: '2026-04', week: 1 });
    expect(getChildrenQuarter(day('2026-10-03'), 'saturday')).toEqual({ id: '2026-04', week: 2 });
  });

  it('starts an Alive in Jesus quarter on the Sunday after', () => {
    expect(getChildrenQuarter(day('2026-09-26'), 'sunday')).toEqual({ id: '2026-03', week: 13 });
    expect(getChildrenQuarter(day('2026-09-27'), 'sunday')).toEqual({ id: '2026-04', week: 1 });
  });

  it('starts next year’s first quarter in late December', () => {
    expect(getChildrenQuarter(day('2025-12-27'), 'saturday')).toEqual({ id: '2026-01', week: 1 });
    expect(getChildrenQuarter(day('2025-12-27'), 'sunday')).toEqual({ id: '2025-04', week: 13 });
  });

  it('counts weeks across a daylight saving change', () => {
    // 2026-01 starts on 27 December; clocks go forward on 8 March.
    expect(getChildrenQuarter(day('2026-03-21'), 'saturday')).toEqual({ id: '2026-01', week: 13 });
  });
});
