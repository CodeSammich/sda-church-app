import {
  HYMNAL_SEARCH_RESULT_LIMIT,
  filterHeaderSearchItems,
  getHymnalSearchItems,
  getHymnalSearchResults,
} from '@/features/hymnal/HymnalSearch';

describe('hymnal search', () => {
  const items = getHymnalSearchItems('zh');

  it('matches simplified hymn titles with a Traditional Chinese query', () => {
    const hymn = items.find(
      (item) =>
        item.hymnalId === 'chinese-hymnal-505' && item.hymnNumber === 473,
    );

    expect(hymn?.title).toContain('我们');
    expect(getHymnalSearchResults(items, '我們')).toContain(hymn);
  });

  it('searches all hymnals and puts the active hymnal first', () => {
    const results = getHymnalSearchResults(
      items,
      '我們',
      { activeHymnalId: 'chinese-hymnal-505' },
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

  it('adds the mapped English result to a Chinese-number search', () => {
    const results = getHymnalSearchResults(
      items,
      '497',
      { activeHymnalId: 'chinese-hymnal-505' },
    );
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

  it('caps broad searches before they can overwhelm the list', () => {
    expect(getHymnalSearchResults(items, 'a')).toHaveLength(
      HYMNAL_SEARCH_RESULT_LIMIT,
    );
  });

  it('leaves out the open hymnal on the hymnal page, but leads with its equivalents', () => {
    const results = getHymnalSearchResults(items, 'Praise God, From Whom', {
      activeHymnalId: 'sdah-1985-en',
      excludeActive: true,
    });

    expect(results.some((item) => item.hymnalId === 'sdah-1985-en')).toBe(false);
    expect(results[0]).toMatchObject({
      hymnalId: 'chinese-hymnal-505',
      hymnNumber: 497,
    });
    expect(
      getHymnalSearchResults(items, 'a', {
        activeHymnalId: 'chinese-hymnal-505',
        excludeActive: true,
      }).length,
    ).toBeLessThanOrEqual(HYMNAL_SEARCH_RESULT_LIMIT);
  });

  it("leads with each hymnal's hymn of exactly that number", () => {
    const results = getHymnalSearchResults(items, '100', {
      activeHymnalId: 'chinese-hymnal-506',
      excludeActive: true,
    });

    // SDAH 16 and 82 mention Psalm 100, but 1985's own 100 comes first, and
    // 505's 100 brings its 1985 equivalent beside it.
    expect(results.slice(0, 6).map((item) => `${item.hymnalId}:${item.hymnNumber}`)).toEqual([
      'sdah-1985-en:100',
      'chinese-hymnal-505:100',
      'sdah-1985-en:336',
      'chinese-hymnal-707-v1:100',
      'chinese-hymnal-707-v2:100',
      'chinese-hymnal-707-v3:100',
    ]);
  });

  it("matches Traditional and Simplified Chinese titles in the header's own search", () => {
    const hymn = items.find(
      (item) =>
        item.hymnalId === 'chinese-hymnal-505' && item.hymnNumber === 473,
    )!;
    const candidate = {
      searchText: hymn.keywords.join(' '),
      subtitle: '',
      title: hymn.title,
    };

    expect(filterHeaderSearchItems([candidate], '我們')).toEqual([candidate]);
    expect(filterHeaderSearchItems([candidate], '我们')).toEqual([candidate]);
  });
});
