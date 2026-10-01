import {
  CHILDREN_AGE_GROUPS,
  findChildrenLessonUrl,
  getChildrenQuarter,
  type ChildrenSabbathSchoolCurriculum,
} from '@/features/sabbath-school/ChildrenLessons';

// Shaped like Adventech's real responses on 2026-09-30 (#336).
const V2 = 'https://sabbath-school.adventech.io/api/v2';
const V3 = 'https://sabbath-school.adventech.io/api/v3';
const PDF = 'https://sabbath-school-pdf.adventech.io/pdf';
const AIJ_PDF = 'https://sabbath-school-resources-media.adventech.io/pdf';
const WEB_PAGE = Symbol('web page');

type Routes = Record<string, unknown>;

const fakeFetch = (routes: Routes) =>
  jest.fn(async (url: string) => {
    if (!(url in routes)) {
      return { ok: false, status: 404, json: async () => ({}) };
    }
    const body = routes[url];
    return {
      ok: true,
      status: 200,
      json: async () => {
        // A missing Alive in Jesus book returns the reader's web page.
        if (body === WEB_PAGE) throw new SyntaxError('Unexpected token <');
        return body;
      },
    };
  }) as unknown as typeof fetch & jest.Mock;

const day = (text: string) => {
  const [year, month, date] = text.split('-').map(Number);
  return new Date(year, month - 1, date);
};
const adventechDate = (date: Date) =>
  [date.getDate(), date.getMonth() + 1].map((part) => String(part).padStart(2, '0')).join('/') +
  `/${date.getFullYear()}`;

/** Thirteen weekly lessons from a first day, plus the extras quarterlies list. */
const lessons = (firstDay: string) => [
  { id: 'introduction', start_date: adventechDate(day(firstDay)), end_date: adventechDate(day(firstDay)) },
  ...Array.from({ length: 13 }, (_, index) => {
    const start = day(firstDay);
    start.setDate(start.getDate() + index * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return {
      id: String(index + 1).padStart(2, '0'),
      start_date: adventechDate(start),
      end_date: adventechDate(end),
    };
  }),
  { id: 'answers', start_date: '24/09/2026', end_date: '24/09/2026' },
];

/** A quarterly and the PDFs of each of its lessons: student first, teacher second. */
const quarterlyRoutes = (language: string, id: string, firstDay: string): Routes => ({
  [`${V2}/${language}/quarterlies/${id}/index.json`]: { lessons: lessons(firstDay) },
  ...Object.fromEntries(
    Array.from({ length: 13 }, (_, index) => {
      const lesson = String(index + 1).padStart(2, '0');
      return [
        `${V2}/${language}/quarterlies/${id}/lessons/${lesson}/index.json`,
        {
          pdfs: [
            { src: `${PDF}/${language}/${id}/${lesson}-student.pdf` },
            { src: `${PDF}/${language}/${id}/${lesson}-teacher.pdf` },
          ],
        },
      ];
    }),
  ),
});

/** An Alive in Jesus book: its weeks, and a PDF for each week and extra. */
const aliveInJesusRoutes = (book: string, firstSunday: string): Routes => {
  const weeks = lessons(firstSunday).filter(({ id }) => /^\d+$/.test(id));
  return {
    [`${V3}/en/aij/${book}/sections/index.json`]: {
      sections: [
        {
          documents: [
            { name: '00-introduction' },
            ...weeks.map(({ id, start_date, end_date }) => ({
              name: id,
              startDate: start_date,
              endDate: end_date,
            })),
          ],
        },
      ],
    },
    [`${V3}/en/aij/${book}/pdf.json`]: [
      { target: `en/aij/${book}/00-introduction`, src: `${AIJ_PDF}/en/aij/${book}/intro.pdf` },
      ...weeks.map(({ id }) => ({
        target: `en/aij/${book}/${id}`,
        src: `${AIJ_PDF}/en/aij/${book}/${id}.pdf`,
      })),
      // Teacher guides list some weeks twice; the first is the guide.
      { target: `en/aij/${book}/01`, src: `${AIJ_PDF}/en/aij/${book}/01-handout.pdf` },
    ],
  };
};

// The English catalog on 2026-09-30: this quarter's Junior, Teen, and Youth
// issues carry last quarter's dates, and Alive in Jesus stopped at 2026-03.
const englishCatalog = {
  [`${V2}/en/quarterlies/index.json`]: [
    { id: '2026-04', start_date: '26/09/2026', end_date: '25/12/2026' },
    { id: '2026-04-rt', start_date: '26/06/2026', end_date: '24/09/2026' },
    { id: '2026-04-pp', start_date: '26/06/2026', end_date: '24/09/2026' },
    { id: '2026-04-cc', start_date: '26/06/2026', end_date: '24/09/2026' },
    { id: '2026-03-zaijbgsg', start_date: '28/06/2026', end_date: '26/09/2026' },
    { id: '2026-03-rt', start_date: '27/06/2026', end_date: '25/09/2026' },
    { id: '2026-03-pp', start_date: '27/06/2026', end_date: '25/09/2026' },
    { id: '2026-03-cc', start_date: '27/06/2026', end_date: '25/09/2026' },
  ],
  ...quarterlyRoutes('en', '2026-04-pp', '2026-06-26'),
  ...quarterlyRoutes('en', '2026-04-rt', '2026-06-26'),
  ...quarterlyRoutes('en', '2026-04-cc', '2026-06-26'),
  ...quarterlyRoutes('en', '2026-03-pp', '2026-06-27'),
};

// The Chinese catalog on 2026-09-30: Beginner is current, Junior's last issue
// ended in July, and Youth stopped in 2025.
const chineseCatalog = {
  [`${V2}/zh/quarterlies/index.json`]: [
    { id: '2026-04-bg', start_date: '26/09/2026', end_date: '25/12/2026' },
    { id: '2026-02-pp', start_date: '04/04/2026', end_date: '03/07/2026' },
    { id: '2025-04-hant-cc', start_date: '04/10/2025', end_date: '02/01/2026' },
    { id: '2025-04-cc', start_date: '04/10/2025', end_date: '02/01/2026' },
  ],
  ...quarterlyRoutes('zh', '2026-04-bg', '2026-09-26'),
};

const aliveInJesus = {
  ...aliveInJesusRoutes('2026-04-bg', '2026-09-27'),
  ...aliveInJesusRoutes('2026-04-bg-tg', '2026-09-27'),
  ...aliveInJesusRoutes('2026-03-bg', '2026-06-28'),
  ...aliveInJesusRoutes('2026-04-pr', '2026-09-27'),
};

const everything = { ...englishCatalog, ...chineseCatalog, ...aliveInJesus };
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
