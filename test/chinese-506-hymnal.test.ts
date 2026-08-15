import {
  CHINESE_506_DIRECTORY_URL,
  getChinese506HymnUrl,
  getSortedChinese506Hymns,
} from '@/features/hymnal/Chinese506Hymnal';
import { getHymnalSearchItems } from '@/features/hymnal/HymnalSearch';

describe('Chinese 506 hymnal directory', () => {
  const hymns = getSortedChinese506Hymns();

  it('contains every hymn published by the source directory', () => {
    expect(hymns).toHaveLength(506);
    expect(hymns[0]).toEqual({
      number: 1,
      title: '圣哉真神',
      pageId: 2662,
    });
    expect(hymns.at(-1)).toEqual({
      number: 506,
      title: '阿门',
      pageId: 3709,
    });
  });

  it('maps hymn numbers to the source page IDs and falls back safely', () => {
    expect(getChinese506HymnUrl(1)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=90&id=2662',
    );
    expect(getChinese506HymnUrl(506)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=90&id=3709',
    );
    expect(getChinese506HymnUrl(507)).toBe(CHINESE_506_DIRECTORY_URL);
  });

  it('adds 506 hymns to reader search with their own route', () => {
    const item = getHymnalSearchItems('zh-cn').find(
      ({ title, route }) =>
        title === '1. 圣哉真神' &&
        route.startsWith('/home/chinese-506-hymnal'),
    );

    expect(item).toMatchObject({
      route:
        '/home/chinese-506-hymnal?hymnNum=1&backTo=/home/hymnal-selection',
      isHymn: true,
    });
  });
});
