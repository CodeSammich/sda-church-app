import {
  CHINESE_505_DIRECTORY_URL,
  getChinese505HymnUrl,
  getSortedChinese505Hymns,
} from '@/features/hymnal/Chinese505Hymnal';
import { getHymnalSearchItems } from '@/features/hymnal/HymnalSearch';

describe('Chinese 505 hymnal directory', () => {
  const hymns = getSortedChinese505Hymns();

  it('contains every landing page currently published by the source directory', () => {
    expect(hymns).toHaveLength(500);
    expect(hymns[0]).toEqual({
      number: 1,
      title: '在主宝座前',
      pageId: 5794,
    });
    expect(hymns.at(-1)).toEqual({
      number: 505,
      title: '阿门',
      pageId: 6313,
    });
  });

  it('normalizes the source typo for hymn 483 and does not invent missing links', () => {
    expect(hymns.find(({ number }) => number === 483)).toEqual({
      number: 483,
      title: '荣美之山',
      pageId: 6291,
    });

    for (const missingNumber of [90, 193, 201, 206, 307]) {
      expect(hymns.some(({ number }) => number === missingNumber)).toBe(false);
      expect(getChinese505HymnUrl(missingNumber)).toBe(CHINESE_505_DIRECTORY_URL);
    }
  });

  it('maps hymn numbers to the source page IDs', () => {
    expect(getChinese505HymnUrl(1)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=59&id=5794',
    );
    expect(getChinese505HymnUrl(505)).toBe(
      'https://m.zgaxr.com/index.php?m=content&c=index&a=show&catid=59&id=6313',
    );
  });

  it('adds Chinese hymns to reader search with their own route', () => {
    const item = getHymnalSearchItems('zh-cn').find(
      ({ title }) => title === '91. 救主衣袍',
    );

    expect(item).toMatchObject({
      route:
        '/home/chinese-505-hymnal?hymnNum=91&backTo=/home/hymnal-selection',
      isHymn: true,
    });
  });
});
