import { getRoutedHymns } from '@/constants/HymnalRouting';

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
});
