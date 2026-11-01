import {
  findAdultLesson,
  formatAdultLesson,
  getAdultLessonWeek,
} from '@/features/sabbath-school/AdultLesson';

const catalog = (lessons: object[]) => ({
  ok: true,
  json: async () => ({ lessons }),
});

const QUARTER_4 = [
  { id: '05', title: 'Revelation and Inspiration', start_date: '24/10/2026', end_date: '30/10/2026' },
  { id: '06', title: 'The Prophetic Writings', start_date: '31/10/2026', end_date: '06/11/2026' },
];

describe('adult Sabbath School lesson for a bulletin', () => {
  it("picks the lesson the class discusses: the week that ends the day before", async () => {
    const requested: string[] = [];
    const fetchJson = (async (url: string) => {
      requested.push(url);
      return catalog(QUARTER_4);
    }) as unknown as typeof fetch;

    await expect(findAdultLesson('2026-10-31', 'en', fetchJson)).resolves.toEqual({
      number: 5,
      title: 'Revelation and Inspiration',
      url: 'https://sabbath-school.adventech.io/en/2026-04/05',
    });
    expect(requested).toEqual([
      'https://sabbath-school.adventech.io/api/v2/en/quarterlies/2026-04/index.json',
    ]);
  });

  it("uses Adventech's Traditional Chinese issue for Traditional Chinese", async () => {
    const requested: string[] = [];
    const fetchJson = (async (url: string) => {
      requested.push(url);
      return catalog([{ ...QUARTER_4[0], title: '啟示與默示' }]);
    }) as unknown as typeof fetch;

    const lesson = await findAdultLesson('2026-10-31', 'zh', fetchJson);

    expect(requested).toEqual([
      'https://sabbath-school.adventech.io/api/v2/zh/quarterlies/2026-04-hant/index.json',
    ]);
    expect(lesson?.url).toBe('https://sabbath-school.adventech.io/zh/2026-04-hant/05');
    expect(formatAdultLesson(lesson!, 'zh')).toBe('第5課 啟示與默示');
  });

  it("starts a quarter with the previous quarter's last lesson", () => {
    expect(getAdultLessonWeek('2026-09-26')).toEqual({ friday: '2026-09-25', quarter: '2026-03' });
    expect(getAdultLessonWeek('2027-01-02')).toEqual({ friday: '2027-01-01', quarter: '2027-01' });
  });

  it('gives null when the catalog is unreachable, and tries again next time', async () => {
    let calls = 0;
    const failing = (async () => {
      calls += 1;
      throw new Error('Offline');
    }) as unknown as typeof fetch;

    await expect(findAdultLesson('2026-11-07', 'es', failing)).resolves.toBeNull();
    await expect(findAdultLesson('2026-11-07', 'es', failing)).resolves.toBeNull();
    expect(calls).toBe(2);

    const missing = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
    await expect(findAdultLesson('2026-11-14', 'en', missing)).resolves.toBeNull();
  });

  it.each([
    ['en', 'Lesson 6: Title'],
    ['zh-cn', '第6课 Title'],
    ['es', 'Lección 6: Title'],
  ] as const)('formats the lesson in %s', (language, expected) => {
    expect(formatAdultLesson({ number: 6, title: 'Title', url: '' }, language)).toBe(expected);
  });
});
