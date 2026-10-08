import {
  filterHeaderSearchItems,
  getHymnalSearchItems,
  getOtherHymnalSearchGroups,
} from '@/features/hymnal/HymnalSearch';
import type { HymnalBookId } from '@/features/hymnal/HymnalLabels';
import { getHymnalOrder } from '@/features/hymnal/Hymnals';

describe('hymnal search', () => {
  const items = getHymnalSearchItems('zh');

  // The other hymnals' matches for a search in one hymnal, as the hymnal page
  // shows them in that language: "hymnal: numbers".
  const search = (query: string, activeHymnalId: HymnalBookId, language = 'zh') =>
    getOtherHymnalSearchGroups(getHymnalSearchItems(language), query, {
      activeHymnalId,
      hymnalOrder: getHymnalOrder(language),
    });
  const listed = (groups: ReturnType<typeof search>) =>
    groups.map(({ hymnalId, hymns }) => `${hymnalId}: ${hymns.map((hymn) => hymn.hymnNumber).join(', ')}`);

  it('matches simplified hymn titles with a Traditional Chinese query', () => {
    const group = search('我們', 'chinese-hymnal-506').find(
      ({ hymnalId }) => hymnalId === 'chinese-hymnal-505',
    );
    const hymn = group?.hymns.find(({ hymnNumber }) => hymnNumber === 473);
    expect(hymn?.title).toContain('我们');
  });

  it('groups the matches by hymnal, the paired hymnal first, each in number order', () => {
    const groups = search('真神', 'chinese-hymnal-505');

    // The 505's own matches are listed above, so it has no group. The 1985,
    // which the cross-reference table pairs with it, comes first.
    expect(groups.map(({ hymnalId }) => hymnalId)).toEqual([
      'sdah-1985-en',
      'chinese-hymnal-506',
      'chinese-hymnal-707-v3',
      'chinese-hymnal-707-v2',
      'chinese-hymnal-707-v1',
    ]);
    for (const { hymns } of groups) {
      const numbers = hymns.map(({ hymnNumber }) => Number.parseInt(hymnNumber.toString(), 10));
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    }
    // Every 506 match, not a share of a list cut off at a total.
    const all506 = items.filter(
      ({ hymnalId, title }) => hymnalId === 'chinese-hymnal-506' && title.includes('真神'),
    );
    expect(groups[1].hymns).toHaveLength(all506.length);
  });

  it('adds the same hymn from the cross-reference tables, both ways', () => {
    // An English title finds the 505 hymn, whose title is Chinese.
    expect(listed(search('Praise God, From Whom', 'sdah-1985-en', 'en'))).toEqual([
      'chinese-hymnal-505: 497',
    ]);
    // A Chinese title finds the 1985 hymn, even from a hymnal with no table.
    const groups = listed(search('讚美上帝', 'chinese-hymnal-506'));
    expect(groups).toContain('sdah-1985-en: 694');
    expect(groups.find((group) => group.startsWith('chinese-hymnal-505:'))).toMatch(/\b497\b/);
  });

  it("leads each hymnal with its hymn of exactly that number", () => {
    const groups = search('100', 'chinese-hymnal-506', 'en');

    expect(groups.map(({ hymnalId }) => hymnalId)).not.toContain('chinese-hymnal-506');
    for (const { hymns } of groups) expect(hymns[0].hymnNumber).toBe(100);
    // SDAH 16 and 82 mention Psalm 100, and 336 is the 505's 100, so they follow.
    expect(listed(groups)[0]).toBe('sdah-1985-en: 100, 16, 82, 336');
  });

  it('finds nothing for an empty search', () => {
    expect(search('  ', 'chinese-hymnal-505')).toEqual([]);
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
