import {
  filterHeaderSearchItems,
  getHymnalSearchItems,
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

  it('uses exact hymn numbers in a header lookup while keeping both editions', () => {
    const lookupItems = items
      .filter((item) =>
        ['sdah-1985-en', 'chinese-hymnal-505'].includes(item.hymnalId),
      )
      .map((item) => ({
        searchNumber: item.hymnNumber.toString(),
        searchText: item.keywords.join(' '),
        subtitle: item.hymnalLabel,
        title: item.title,
      }));
    const results = filterHeaderSearchItems(lookupItems, '5');

    expect(results).toHaveLength(2);
    expect(results.every((item) => item.searchNumber === '5')).toBe(true);
  });

  it('matches Traditional and Simplified Chinese titles in header lookup', () => {
    const hymn = items.find(
      (item) =>
        item.hymnalId === 'chinese-hymnal-505' && item.hymnNumber === 473,
    )!;
    const candidate = {
      searchNumber: hymn.hymnNumber.toString(),
      searchText: hymn.keywords.join(' '),
      subtitle: hymn.hymnalLabel,
      title: hymn.title,
    };

    expect(filterHeaderSearchItems([candidate], '我們')).toEqual([candidate]);
    expect(filterHeaderSearchItems([candidate], '我们')).toEqual([candidate]);
  });

  it('prioritizes the preferred lookup edition for ambiguous numbers', () => {
    const english = {
      searchNumber: '497',
      searchPriority: 0,
      searchText: 'English hymn',
      subtitle: 'English hymnal',
      title: '497. English hymn',
    };
    const chinese = {
      searchNumber: '497',
      searchPriority: 1,
      searchText: 'Chinese hymn',
      subtitle: 'Chinese hymnal',
      title: '497. Chinese hymn',
    };

    expect(filterHeaderSearchItems([english, chinese], '497')).toEqual([
      chinese,
      english,
    ]);
  });
});
