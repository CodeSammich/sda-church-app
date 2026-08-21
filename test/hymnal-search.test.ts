import {
  HYMNAL_SEARCH_RESULT_LIMIT,
  getHymnalSearchItems,
  getHymnalSearchResults,
  isHymnalSearchMatch,
} from '@/features/hymnal/HymnalSearch';

describe('hymnal search', () => {
  const items = getHymnalSearchItems('zh');

  it('matches simplified hymn titles with a Traditional Chinese query', () => {
    const hymn = items.find(
      (item) =>
        item.hymnalId === 'chinese-hymnal-505' && item.hymnNumber === 473,
    );

    expect(hymn?.title).toContain('我们');
    expect(isHymnalSearchMatch(hymn!, '我們')).toBe(true);
  });

  it('searches all hymnals and puts the active hymnal first', () => {
    const results = getHymnalSearchResults(
      items,
      '我們',
      '/home/chinese-505-hymnal',
    );

    expect(results[0]).toMatchObject({
      hymnalId: 'chinese-hymnal-505',
    });
    expect(
      results.some(
        (item) =>
          item.hymnalId === 'chinese-hymnal-505' && item.hymnNumber === 473,
      ),
    ).toBe(true);
    expect(
      results.some((item) => item.hymnalId === 'chinese-hymnal-707-v1'),
    ).toBe(true);
  });

  it('adds mapped Chinese results to an English-title search', () => {
    const results = getHymnalSearchResults(items, 'Praise God');
    const englishIndex = results.findIndex(
      (item) => item.hymnalId === 'sdah-1985-en' && item.hymnNumber === 694,
    );

    expect(englishIndex).toBeGreaterThanOrEqual(0);
    expect(results[englishIndex + 1]).toMatchObject({
      hymnalId: 'chinese-hymnal-505',
      hymnNumber: 497,
    });
  });

  it('adds mapped English results to a Chinese-title search', () => {
    const results = getHymnalSearchResults(items, '讚美上帝');
    const chineseIndex = results.findIndex(
      (item) =>
        item.hymnalId === 'chinese-hymnal-505' && item.hymnNumber === 497,
    );

    expect(chineseIndex).toBeGreaterThanOrEqual(0);
    expect(results[chineseIndex + 1]).toMatchObject({
      hymnalId: 'sdah-1985-en',
      hymnNumber: 694,
    });
  });

  it('returns the same hymn number from every indexed hymnal edition', () => {
    const results = getHymnalSearchResults(items, '1');

    expect(new Set(results.map((item) => item.hymnalId))).toEqual(
      new Set([
        'sdah-1985-en',
        'chinese-hymnal-505',
        'chinese-hymnal-506',
        'chinese-hymnal-707-v1',
        'chinese-hymnal-707-v2',
        'chinese-hymnal-707-v3',
      ]),
    );
  });

  it('caps broad searches before they can overwhelm the results overlay', () => {
    expect(getHymnalSearchResults(items, 'a')).toHaveLength(
      HYMNAL_SEARCH_RESULT_LIMIT,
    );
  });
});
