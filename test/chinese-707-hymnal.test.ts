import {
  getChinese707DirectoryUrl,
  getChinese707HymnUrl,
  getSortedChinese707Hymns,
} from '@/constants/Chinese707Hymnal';
import { getSearchableItems } from '@/constants/SearchTerms';

describe('Chinese 707 hymnal directories', () => {
  it('keeps the three source mappings distinct', () => {
    const version1 = getSortedChinese707Hymns(1);
    const version2 = getSortedChinese707Hymns(2);
    const version3 = getSortedChinese707Hymns(3);

    expect(version1).toHaveLength(707);
    expect(version2).toHaveLength(715);
    expect(version3).toHaveLength(715);

    expect(version1[0]).toEqual({
      number: 1,
      title: '圣哉圣哉圣哉',
      pageId: 36,
    });
    expect(version2[0]).toEqual({
      number: 1,
      title: '圣哉圣哉圣哉',
      pageId: 785,
    });
    expect(version3[0]).toEqual({
      number: 1,
      title: '圣哉圣哉圣哉',
      pageId: 16752,
    });
    expect(version1.at(-1)?.number).toBe(707);
    expect(version2.at(-1)?.number).toBe(707);
    expect(version3.at(-1)?.number).toBe(707);
  });

  it('preserves the eight B arrangements in versions 2 and 3', () => {
    const version2 = getSortedChinese707Hymns(2);
    const hymn260Index = version2.findIndex(({ number }) => number === 260);

    expect(version2[hymn260Index + 1]).toEqual({
      number: '260B',
      title: '三一颂',
      pageId: 1053,
    });
    expect(getChinese707HymnUrl(3, '705B')).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=234&id=17464',
    );
  });

  it('maps each version to its own directory and safely handles missing hymns', () => {
    expect(getChinese707HymnUrl(1, 707)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=15&id=784',
    );
    expect(getChinese707HymnUrl(2, 707)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=20&id=1784',
    );
    expect(getChinese707HymnUrl(3, 707)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=234&id=17466',
    );
    expect(getChinese707HymnUrl(2, 708)).toBe(getChinese707DirectoryUrl(2));
  });

  it('adds each 707 edition and its B arrangements to unified search', () => {
    const item = getSearchableItems('zh-cn').find(
      ({ title, route }) =>
        title === '260B. 三一颂' &&
        route.startsWith('/resources/chinese-707-four-part-hymnal'),
    );

    expect(item).toMatchObject({
      route:
        '/resources/chinese-707-four-part-hymnal?hymnNum=260B&backTo=/resources/hymnal-selection',
      isHymn: true,
    });
  });
});
