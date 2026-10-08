import {
  CHINESE_505_DIRECTORY_URL,
  getChinese505HymnUrl,
  getSortedChinese505Hymns,
} from '@/features/hymnal/Chinese505Hymnal';
import { getHymnalSearchItems } from '@/features/hymnal/HymnalSearch';

describe('Chinese 505 hymnal directory', () => {
  const hymns = getSortedChinese505Hymns();

  it('contains every landing page currently published by the source directory', () => {
    expect(hymns).toHaveLength(499);
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

  it("numbers each page by its score and does not invent missing links", () => {
    // Labeled 383, 194, and 207, with scores numbered 483, 193, and 206.
    expect(hymns.filter(({ pageId }) => [6291, 5992, 6003].includes(pageId))).toEqual([
      { number: 193, title: '万福根源', pageId: 5992 },
      { number: 206, title: '将进天乡', pageId: 6003 },
      { number: 483, title: '荣美之山', pageId: 6291 },
    ]);
    // "370.黄昏求恩" shows hymn 37's score, which is already listed.
    expect(hymns.filter(({ title }) => title === '黄昏求恩')).toEqual([
      { number: 37, title: '黄昏求恩', pageId: 5835 },
    ]);

    for (const missingNumber of [90, 194, 201, 207, 307, 370]) {
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

  it('adds Chinese hymns to the search across every hymnal', () => {
    const item = getHymnalSearchItems('zh-cn').find(
      ({ title }) => title === '91. 救主衣袍',
    );

    expect(item).toMatchObject({ hymnalId: 'chinese-hymnal-505', hymnNumber: 91 });
  });
});
