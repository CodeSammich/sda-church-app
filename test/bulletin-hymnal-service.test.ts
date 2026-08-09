import {
  QUEENS_FIXED_HYMNS,
  resolveBulletinHymnDisplayText,
  resolveBulletinHymnDestination,
  resolveBulletinHymnPresentation,
} from '@/services/BulletinHymnalService';

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
      route: '/resources/english-hymnal',
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
      route: '/resources/chinese-505-hymnal',
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
      route: '/resources/chinese-505-hymnal',
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
      route: '/resources/english-hymnal',
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
      route: '/resources/english-hymnal',
    });
  });

  it('uses an English cross-reference when a Chinese source page is unavailable', () => {
    expect(
      resolveBulletinHymnDestination(
        { english: '', chinese: '90. 中文標題可能有錯字' },
        'zh',
      ),
    ).toEqual({
      hymnalId: 'sdah-1985-en',
      hymnNumber: 254,
      route: '/resources/english-hymnal',
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
      route: '/resources/english-hymnal',
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
      route: '/resources/english-hymnal',
    });
  });

  it('does not invent a destination for blank values', () => {
    expect(
      resolveBulletinHymnDestination({ english: '', chinese: '' }, 'en'),
    ).toBeUndefined();
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
        route: '/resources/english-hymnal',
      },
    });
    expect(resolveBulletinHymnPresentation(conflictingAnswers, 'zh')).toEqual({
      displayText: '165. 奇哉生命之道',
      destination: {
        hymnalId: 'chinese-hymnal-505',
        hymnNumber: 165,
        route: '/resources/chinese-505-hymnal',
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
        route: '/resources/english-hymnal',
      });
      expect(resolveBulletinHymnDestination(QUEENS_FIXED_HYMNS[piece], 'zh')).toEqual({
        hymnalId: 'chinese-hymnal-505',
        hymnNumber: chineseNumber,
        route: '/resources/chinese-505-hymnal',
      });
    },
  );
});
