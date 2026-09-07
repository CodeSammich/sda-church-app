import { getRoutedHymns } from '@/features/hymnal/HymnalRouting';
import {
  getHymnalSearchItems,
  getHymnalSearchNavigation,
} from '@/features/hymnal/HymnalSearch';

const hymns = [
  { number: 1, title: 'First' },
  { number: 10, title: 'Tenth' },
  { number: 101, title: 'One Hundred One' },
];

describe('hymnal route selection', () => {
  it('treats hymnNum as one exact preselected hymn', () => {
    expect(getRoutedHymns(hymns, '10', () => true)).toEqual([
      { number: 10, title: 'Tenth' },
    ]);
  });

  it('does not confuse a selected number with partial-number matches', () => {
    expect(getRoutedHymns(hymns, '1', () => true)).toEqual([
      { number: 1, title: 'First' },
    ]);
  });

  it('falls back to the ordinary filter for an unknown routed number', () => {
    expect(
      getRoutedHymns(hymns, '999', (hymn) => hymn.title.includes('One')),
    ).toEqual([{ number: 101, title: 'One Hundred One' }]);
  });

  it('builds safe navigation params for every hymnal search route', () => {
    const items = getHymnalSearchItems('en');

    for (const item of items) {
      const navigation = getHymnalSearchNavigation(item.route, 'amazing grace');
      expect(navigation.pathname).toMatch(/^\/home\/[a-z0-9-]+$/);
      expect(navigation.params.hymnNum).toBe(String(item.hymnNumber));
      expect(navigation.params.backTo).toBe('/home/hymnal-selection');
      expect(navigation.params.highlight).toBe('amazing grace');
    }
  });

  it('does not throw on malformed or flag-style route parameters', () => {
    expect(() =>
      getHymnalSearchNavigation(
        '/home/english-hymnal?hymnNum=10&broken=%E0%A4%A&flag',
        '10%',
      ),
    ).not.toThrow();
  });
});
