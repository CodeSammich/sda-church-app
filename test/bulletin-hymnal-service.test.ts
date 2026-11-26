import {
  QUEENS_FIXED_HYMNS,
  resolveBulletinHymnDisplayText,
  resolveBulletinHymnDestination,
  resolveBulletinHymnPresentation,
  toBulletinHymnText,
} from '@/services/BulletinHymnalService';

// The other hymnals load the first time a bulletin hymn isn't in the church's
// two, and each answer is looked up once, so a test about that first look gets
// a copy of the service of its own.
const loadServiceAfresh = () => {
  let service!: typeof import('@/services/BulletinHymnalService');
  jest.isolateModules(() => {
    service = require('@/services/BulletinHymnalService');
  });
  return service;
};

describe('bulletin hymnal resolution', () => {
  it('uses the submitted number despite an English title typo', () => {
    expect(
      resolveBulletinHymnDestination(
        {
          english: '1. Praze to the Lrod',
          chinese: '5. 赞美上主',
        },
        'en',
      ),
    ).toEqual({
      hymnalId: 'sdah-1985-en',
      hymnNumber: 1,
      route: '/home/english-hymnal',
    });
  });

  it('opens the submitted Chinese 505 hymn for a Chinese reader', () => {
    expect(
      resolveBulletinHymnDestination(
        {
          english: '1. Praise to the Lord',
          chinese: '5. 讚美上主',
        },
        'zh',
      ),
    ).toEqual({
      hymnalId: 'chinese-hymnal-505',
      hymnNumber: 5,
      route: '/home/chinese-505-hymnal',
    });
  });

  it('maps an English-only submission into the preferred Chinese hymnal', () => {
    expect(
      resolveBulletinHymnDestination(
        { english: 'SDAH #1 Praize to the Lord', chinese: '' },
        'zh-cn',
      ),
    ).toEqual({
      hymnalId: 'chinese-hymnal-505',
      hymnNumber: 5,
      route: '/home/chinese-505-hymnal',
    });
  });

  it('maps a Chinese-only submission into the preferred English hymnal', () => {
    expect(
      resolveBulletinHymnDestination(
        { english: '', chinese: '第5首 讚美上主' },
        'en',
      ),
    ).toEqual({
      hymnalId: 'sdah-1985-en',
      hymnNumber: 1,
      route: '/home/english-hymnal',
    });
  });

  it('falls back to the submitted hymnal when no cross-reference exists', () => {
    expect(
      resolveBulletinHymnDestination(
        { english: '3. God Himslef Is With Us', chinese: '' },
        'zh',
      ),
    ).toEqual({
      hymnalId: 'sdah-1985-en',
      hymnNumber: 3,
      route: '/home/english-hymnal',
    });
  });

  it('opens a 505 hymn that has no page online by its number', () => {
    // Hymn 90 is listed by its score's title, without a page (#606).
    expect(
      resolveBulletinHymnDestination(
        { english: '', chinese: '90. 中文標題可能有錯字' },
        'zh',
      ),
    ).toEqual({
      hymnalId: 'chinese-hymnal-505',
      hymnNumber: 90,
      route: '/home/chinese-505-hymnal',
    });
  });

  it('uses title and script evidence when a value is entered in the wrong field', () => {
    expect(
      resolveBulletinHymnDestination(
        { english: '5. 赞美上主', chinese: '' },
        'en',
      ),
    ).toEqual({
      hymnalId: 'sdah-1985-en',
      hymnNumber: 1,
      route: '/home/english-hymnal',
    });
  });

  it('reads a bare 第12首 in the English field as the 505 hymn, by its Chinese script alone', () => {
    // There's no title to go on, and the 1985's hymn 12 is Joyful, Joyful, We Adore Thee.
    expect(resolveBulletinHymnPresentation({ english: '第12首', chinese: '' }, 'en')).toEqual({
      displayText: '12. 赞美上帝大君王',
      destination: {
        hymnalId: 'chinese-hymnal-505',
        hymnNumber: 12,
        route: '/home/chinese-505-hymnal',
      },
    });
  });

  it('can resolve a slightly mistyped title when no number is present', () => {
    expect(
      resolveBulletinHymnDestination(
        { english: 'Prais to the Lord', chinese: '' },
        'en',
      ),
    ).toEqual({
      hymnalId: 'sdah-1985-en',
      hymnNumber: 1,
      route: '/home/english-hymnal',
    });
  });

  it('finds a title typed with up to 3 in 10 of its characters missing, and no more', () => {
    // "Deeper Yet" is ten characters with its space: "Dpr Yet" is three short, "Dpr Yt" four.
    expect(resolveBulletinHymnDisplayText({ english: 'Dpr Yet', chinese: '' }, 'en')).toBe('302. Deeper Yet');
    expect(resolveBulletinHymnPresentation({ english: 'Dpr Yt', chinese: '' }, 'en')).toEqual({
      displayText: 'Dpr Yt',
      youtubeSearchQuery: 'Dpr Yt',
    });
  });

  it('finds a hymn from the first words of its title', () => {
    expect(resolveBulletinHymnDisplayText({ english: 'Joyful, Joyful', chinese: '' }, 'en')).toBe(
      '12. Joyful, Joyful, We Adore Thee',
    );
  });

  it('prefers the hymn with exactly the typed title over an earlier one whose title holds it', () => {
    // Hymn 46 is Abide With Me, 'Tis Eventide, and hymn 482 Father, Lead Me Day by Day.
    expect(resolveBulletinHymnDisplayText({ english: 'Abide With Me', chinese: '' }, 'en')).toBe('50. Abide With Me');
    expect(resolveBulletinHymnDisplayText({ english: 'Day by Day', chinese: '' }, 'en')).toBe('532. Day by Day');
  });

  it("matches no hymn to a dash, or to a hymnal's name alone", () => {
    for (const value of ['—', 'AH']) {
      const presentation = resolveBulletinHymnPresentation({ english: value, chinese: '' }, 'en');
      expect(presentation.displayText).toBe(value);
      expect(presentation.destination).toBeUndefined();
    }
  });

  it('reads a title by its words when its only number is too big for any hymnal, such as a year', () => {
    expect(resolveBulletinHymnDisplayText({ english: 'Amazing Grace (1779)', chinese: '' }, 'en')).toBe(
      '108. Amazing Grace',
    );
  });

  it('does not invent a destination for blank values', () => {
    expect(
      resolveBulletinHymnDestination({ english: '', chinese: '' }, 'en'),
    ).toBeUndefined();
    // Nor a YouTube search, or any text in place of the bulletin's own TBD.
    expect(resolveBulletinHymnPresentation({ english: '', chinese: '' }, 'zh')).toEqual({ displayText: '' });
  });

  it('keeps display text and routing on the same selected form answer', () => {
    const conflictingAnswers = {
      english: '1. Praise to the Lord',
      chinese: '165. 奇哉生命之道',
    };

    expect(resolveBulletinHymnPresentation(conflictingAnswers, 'en')).toEqual({
      displayText: '1. Praise to the Lord',
      destination: {
        hymnalId: 'sdah-1985-en',
        hymnNumber: 1,
        route: '/home/english-hymnal',
      },
    });
    expect(resolveBulletinHymnPresentation(conflictingAnswers, 'zh')).toEqual({
      displayText: '165. 奇哉生命之道',
      destination: {
        hymnalId: 'chinese-hymnal-505',
        hymnNumber: 165,
        route: '/home/chinese-505-hymnal',
      },
    });
  });

  it('maps a lone English submission for a Chinese UI', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: '1. Praise to the Lord', chinese: '' },
        'zh',
      ),
    ).toBe('5. 赞美上主');
  });

  it('maps Chinese text put in the English field for an English UI', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: '5. 讚美上主', chinese: '' },
        'en',
      ),
    ).toBe('1. Praise to the Lord');
  });

  it('keeps the source language when no cross-hymnal mapping exists', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: '3. God Himslef Is With Us', chinese: '' },
        'zh-cn',
      ),
    ).toBe('3. God Himself Is With Us');
  });

  it('keeps an unrecognized raw submission instead of guessing', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: 'A hymn that is not in either catalog', chinese: '' },
        'zh',
      ),
    ).toBe('A hymn that is not in either catalog');
  });

  it('repairs a mistyped submitted title from its correct number', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: '1. Praze to the Lrod', chinese: '5. 讚美上主' },
        'en',
      ),
    ).toBe('1. Praise to the Lord');
  });

  it('maps a lone Chinese submission for an English UI', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: '', chinese: '5. 讚美上主' },
        'en',
      ),
    ).toBe('1. Praise to the Lord');
  });

  it('keeps a lone Chinese submission when no English mapping exists', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: '', chinese: '8. 萬眾頌讚' },
        'en',
      ),
    ).toBe('8. 万众颂赞');
  });

  it('fuzzy-matches a title-only submission across both catalogs', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: 'Prais to the Lord', chinese: '' },
        'zh',
      ),
    ).toBe('5. 赞美上主');
    expect(
      resolveBulletinHymnDisplayText(
        { english: '讚美上主', chinese: '' },
        'en',
      ),
    ).toBe('1. Praise to the Lord');
  });

  it('keeps a song no hymnal has as typed, rather than a hymn that shares words (#751)', () => {
    // A Hymn of Response typed in both languages, a song in no hymnal. It
    // shares most of AH 1's letter pairs and AH 25's first words.
    expect(
      resolveBulletinHymnPresentation(
        { english: 'Praise the Lord, O My Soul', chinese: '我的心，你要称颂耶和华' },
        'en',
      ),
    ).toEqual({
      displayText: 'Praise the Lord, O My Soul',
      youtubeSearchQuery: 'Praise the Lord, O My Soul',
    });
    expect(resolveBulletinHymnDisplayText({ english: 'Amazing Love', chinese: '' }, 'en')).toBe(
      'Amazing Love',
    );
    expect(
      resolveBulletinHymnDisplayText(
        { english: 'Holy Spirit You Are Welcome Here', chinese: '' },
        'en',
      ),
    ).toBe('Holy Spirit You Are Welcome Here');
  });

  it('still finds a misspelled title in either language', () => {
    expect(
      resolveBulletinHymnDisplayText({ english: 'Grate Is Thy Faithfulness', chinese: '' }, 'en'),
    ).toBe('100. Great Is Thy Faithfulness');
    expect(
      resolveBulletinHymnDisplayText({ english: 'The Church Has One Fundation', chinese: '' }, 'en'),
    ).toBe('348. The Church Has One Foundation');
    expect(resolveBulletinHymnDisplayText({ english: 'Amazing Grase', chinese: '' }, 'en')).toBe(
      '108. Amazing Grace',
    );
    expect(resolveBulletinHymnDisplayText({ english: '', chinese: '赞美上猪' }, 'zh')).toBe(
      '5. 赞美上主',
    );
  });

  it('expands the current Queens and Brooklyn number-only submissions', () => {
    expect(
      resolveBulletinHymnDisplayText(
        { english: '286 Wonderful Words of Life', chinese: '' },
        'zh',
      ),
    ).toBe('165. 奇哉生命之道');
    expect(
      resolveBulletinHymnDisplayText({ english: '200', chinese: '' }, 'en'),
    ).toBe('200. The Lord Is Coming');
    expect(
      resolveBulletinHymnDisplayText({ english: '', chinese: '165' }, 'en'),
    ).toBe('286. Wonderful Words of Life');
  });

  it.each([
    ['doxology', 694, 497],
    ['pastoralPrayer', 684, 498],
    ['postlude', 690, 504],
  ] as const)(
    'routes the fixed Queens %s to the selected language hymnal',
    (piece, englishNumber, chineseNumber) => {
      expect(resolveBulletinHymnDestination(QUEENS_FIXED_HYMNS[piece], 'en')).toEqual({
        hymnalId: 'sdah-1985-en',
        hymnNumber: englishNumber,
        route: '/home/english-hymnal',
      });
      expect(resolveBulletinHymnDestination(QUEENS_FIXED_HYMNS[piece], 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-505',
        hymnNumber: chineseNumber,
        route: '/home/chinese-505-hymnal',
      });
    },
  );

  describe('every hymnal (#558)', () => {
    it('answers from every hymnal in a copy of the service that has looked nothing up yet', () => {
      const service = loadServiceAfresh();

      // The church's own two, the 505's hymn known by its script alone.
      expect(service.resolveBulletinHymnDisplayText({ english: '1. Praise to the Lord', chinese: '' }, 'en')).toBe(
        '1. Praise to the Lord',
      );
      expect(service.resolveBulletinHymnDisplayText({ english: '第12首', chinese: '' }, 'en')).toBe('12. 赞美上帝大君王');
      // The others, which load the first time they're needed: by number, then by title.
      expect(service.resolveBulletinHymnDestination({ english: '', chinese: '第1首 聖哉真神' }, 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-506',
        hymnNumber: 1,
        route: '/home/chinese-506-hymnal',
      });
      expect(service.resolveBulletinHymnDisplayText({ english: '', chinese: '頌主造化' }, 'zh')).toBe(
        '10. 颂主造化（707 新編簡譜）',
      );
    });

    it("leaves out a 707 hymn numbered with a letter, which can't be opened by its number", () => {
      // 三一頌 is only hymn 260B, in the 707's standard and four-part editions.
      expect(
        loadServiceAfresh().resolveBulletinHymnPresentation({ english: '', chinese: '三一頌' }, 'zh'),
      ).toEqual({
        displayText: '三一頌',
        youtubeSearchQuery: '三一頌',
      });
    });

    it("opens a number past the 1985's 695 hymns, or the 505's 505, in a hymnal that has it", () => {
      expect(resolveBulletinHymnDisplayText({ english: '695', chinese: '' }, 'en')).toBe(
        '695. Praise God, From Whom All Blessings',
      );
      expect(resolveBulletinHymnDestination({ english: '696', chinese: '' }, 'en')).toEqual({
        hymnalId: 'chinese-hymnal-707-v3',
        hymnNumber: 696,
        route: '/home/chinese-707-standard-hymnal',
      });
      expect(resolveBulletinHymnDisplayText({ english: '', chinese: '第505首' }, 'zh')).toBe('505. 阿门');
      expect(resolveBulletinHymnDestination({ english: '', chinese: '第506首' }, 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-506',
        hymnNumber: 506,
        route: '/home/chinese-506-hymnal',
      });
      // The 707's last hymn.
      expect(resolveBulletinHymnDestination({ english: '', chinese: '第707首' }, 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-707-v3',
        hymnNumber: 707,
        route: '/home/chinese-707-standard-hymnal',
      });
    });

    it("opens another hymnal's hymn with exactly the typed title, not a 505 hymn with a similar one", () => {
      // 敬拜真神 is the 506's hymn 4; the 505's hymn 3, 崇拜真神, differs by one character.
      expect(resolveBulletinHymnDestination({ english: '', chinese: '敬拜真神' }, 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-506',
        hymnNumber: 4,
        route: '/home/chinese-506-hymnal',
      });
    });

    it('finds a hymn only another hymnal has, and names that hymnal', () => {
      expect(resolveBulletinHymnPresentation({ english: '', chinese: '奇異恩典' }, 'zh')).toEqual({
        displayText: '61. 奇异恩典（中文 506）',
        destination: {
          hymnalId: 'chinese-hymnal-506',
          hymnNumber: 61,
          route: '/home/chinese-506-hymnal',
        },
      });
      expect(resolveBulletinHymnDisplayText({ english: '', chinese: '奇異恩典' }, 'en')).toBe(
        '61. 奇异恩典 (Chinese 506)',
      );
    });

    it('finds a hymn only the 707 hymnals have, in the standard edition first', () => {
      expect(resolveBulletinHymnPresentation({ english: '', chinese: '榮耀歸至高真神' }, 'zh')).toEqual({
        displayText: '3. 荣耀归至高真神（707 標準版）',
        destination: {
          hymnalId: 'chinese-hymnal-707-v3',
          hymnNumber: 3,
          route: '/home/chinese-707-standard-hymnal',
        },
      });
    });

    it("finds a hymn only the 707's four-part or new simplified edition has", () => {
      expect(resolveBulletinHymnPresentation({ english: '', chinese: '有福的確據' }, 'zh')).toEqual({
        displayText: '156. 有福的确据（707 四聲部）',
        destination: {
          hymnalId: 'chinese-hymnal-707-v2',
          hymnNumber: 156,
          route: '/home/chinese-707-four-part-hymnal',
        },
      });
      expect(resolveBulletinHymnPresentation({ english: '', chinese: '頌主造化' }, 'zh')).toEqual({
        displayText: '10. 颂主造化（707 新編簡譜）',
        destination: {
          hymnalId: 'chinese-hymnal-707-v1',
          hymnNumber: 10,
          route: '/home/chinese-707-new-simplified-hymnal',
        },
      });
    });

    it("follows the title to another hymnal when the church's hymnal has a different hymn at that number", () => {
      // 圣哉真神 is 505 #2 but 506 #1.
      expect(resolveBulletinHymnDestination({ english: '', chinese: '第1首 聖哉真神' }, 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-506',
        hymnNumber: 1,
        route: '/home/chinese-506-hymnal',
      });
      expect(resolveBulletinHymnDestination({ english: '', chinese: '第2首 聖哉真神' }, 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-505',
        hymnNumber: 2,
        route: '/home/chinese-505-hymnal',
      });
    });

    it("keeps a bare number in the church's own hymnal", () => {
      expect(resolveBulletinHymnDestination({ english: '', chinese: '12' }, 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-505',
        hymnNumber: 12,
        route: '/home/chinese-505-hymnal',
      });
    });

    it('offers a YouTube search for the text as typed when no hymnal has the hymn', () => {
      expect(
        resolveBulletinHymnPresentation({ english: 'Zqx Unwritten Song', chinese: '' }, 'en'),
      ).toEqual({
        displayText: 'Zqx Unwritten Song',
        youtubeSearchQuery: 'Zqx Unwritten Song',
      });
      expect(resolveBulletinHymnPresentation({ english: '', chinese: '還要等多久' }, 'zh')).toEqual({
        displayText: '還要等多久',
        youtubeSearchQuery: '還要等多久',
      });
      expect(
        resolveBulletinHymnPresentation({ english: '73 Holy, Holy, Holy', chinese: '' }, 'en')
          .youtubeSearchQuery,
      ).toBeUndefined();
    });
  });

  it.each([
    ['第12首 讚美上帝大君王', { english: '', chinese: '第12首 讚美上帝大君王' }],
    ['12', { english: '', chinese: '12' }],
    [' AH 73 Holy, Holy, Holy ', { english: 'AH 73 Holy, Holy, Holy', chinese: '' }],
    ['Amazing Grace', { english: 'Amazing Grace', chinese: '' }],
  ])('reads the Sabbath School hymn %j as the right language', (value, expected) => {
    expect(toBulletinHymnText(value)).toEqual(expected);
  });
});
