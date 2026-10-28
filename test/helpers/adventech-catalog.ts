// Adventech's catalogs, faked for tests, shaped like its real responses on
// 2026-09-30 (#336): test/children-lessons.test.ts tests the lookup with them,
// and test/children-lesson-downloads.test.ts follows a lookup through to the
// phone's copy.
export const V2 = 'https://sabbath-school.adventech.io/api/v2';
export const V3 = 'https://sabbath-school.adventech.io/api/v3';
export const PDF = 'https://sabbath-school-pdf.adventech.io/pdf';
export const AIJ_PDF = 'https://sabbath-school-resources-media.adventech.io/pdf';
export const WEB_PAGE = Symbol('web page');

export type Routes = Record<string, unknown>;

export const fakeFetch = (routes: Routes) =>
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

export const day = (text: string) => {
  const [year, month, date] = text.split('-').map(Number);
  return new Date(year, month - 1, date);
};
export const adventechDate = (date: Date) =>
  [date.getDate(), date.getMonth() + 1].map((part) => String(part).padStart(2, '0')).join('/') +
  `/${date.getFullYear()}`;

/** Thirteen weekly lessons from a first day, plus the extras quarterlies list. */
export const lessons = (firstDay: string) => [
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
export const quarterlyRoutes = (language: string, id: string, firstDay: string): Routes => ({
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
export const aliveInJesusRoutes = (book: string, firstSunday: string): Routes => {
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
export const englishCatalog = {
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
export const chineseCatalog = {
  [`${V2}/zh/quarterlies/index.json`]: [
    { id: '2026-04-bg', start_date: '26/09/2026', end_date: '25/12/2026' },
    { id: '2026-02-pp', start_date: '04/04/2026', end_date: '03/07/2026' },
    { id: '2025-04-hant-cc', start_date: '04/10/2025', end_date: '02/01/2026' },
    { id: '2025-04-cc', start_date: '04/10/2025', end_date: '02/01/2026' },
  ],
  ...quarterlyRoutes('zh', '2026-04-bg', '2026-09-26'),
};

export const aliveInJesus = {
  ...aliveInJesusRoutes('2026-04-bg', '2026-09-27'),
  ...aliveInJesusRoutes('2026-04-bg-tg', '2026-09-27'),
  ...aliveInJesusRoutes('2026-03-bg', '2026-06-28'),
  ...aliveInJesusRoutes('2026-04-pr', '2026-09-27'),
};

export const everything = { ...englishCatalog, ...chineseCatalog, ...aliveInJesus };
