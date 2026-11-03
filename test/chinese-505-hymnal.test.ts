import {
  CHINESE_505_DIRECTORY_URL,
  getChinese505HymnUrl,
  getSortedChinese505Hymns,
} from '@/features/hymnal/Chinese505Hymnal';
import { getHymnalSearchItems } from '@/features/hymnal/HymnalSearch';
import {
  resolveBulletinHymnPresentation,
  toBulletinHymnText,
} from '@/services/BulletinHymnalService';

describe('Chinese 505 hymnal directory', () => {
  const hymns = getSortedChinese505Hymns();

  it('lists every hymn, with the landing pages the source directory publishes', () => {
    expect(hymns).toHaveLength(505);
    expect(hymns.filter(({ pageId }) => pageId)).toHaveLength(499);
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

  it('numbers each page by its score and does not invent missing links', () => {
    // Labeled 383, 194, and 207, with scores numbered 483, 193, and 206.
    expect(hymns.filter(({ pageId }) => pageId && [6291, 5992, 6003].includes(pageId))).toEqual([
      { number: 193, title: '万福根源', pageId: 5992 },
      { number: 206, title: '将进天乡', pageId: 6003 },
      { number: 483, title: '荣美之山', pageId: 6291 },
    ]);
    // "370.黄昏求恩" shows hymn 37's score, which is already listed.
    expect(hymns.filter(({ title }) => title === '黄昏求恩')).toEqual([
      { number: 37, title: '黄昏求恩', pageId: 5835 },
    ]);

    // Hymns with no page keep their score's title, and open the directory.
    expect(hymns.filter(({ pageId }) => !pageId)).toEqual([
      { number: 90, title: '至大神医' },
      { number: 194, title: '罪人良友' },
      { number: 201, title: '将有大喜乐' },
      { number: 207, title: '感恩信徒一齐来' },
      { number: 307, title: '我爱说主的故事' },
      { number: 370, title: '求主启示' },
    ]);
    for (const unlinkedNumber of [90, 194, 201, 207, 307, 370]) {
      expect(getChinese505HymnUrl(unlinkedNumber)).toBe(CHINESE_505_DIRECTORY_URL);
    }
  });

  it("titles hymns as their scores do where the directory's link text is wrong", () => {
    const titles = Object.fromEntries(hymns.map(({ number, title }) => [number, title]));
    expect(titles).toMatchObject({
      11: '赞美三一真神',
      63: '美哉小城',
      381: '上主是我牧者',
      492: '赞美天上真神',
    });
    // The church's hymn list has these two the other way round; the scores don't.
    expect(titles).toMatchObject({ 493: '赞美耶和华', 494: '靠恩得胜' });
  });

  it('opens each corrected or added hymn from its title alone on the bulletin', () => {
    const corrected = [
      7, 11, 27, 63, 71, 78, 79, 86, 88, 90, 99, 109, 113, 114, 127, 142, 146, 160, 183, 194, 201,
      203, 207, 235, 239, 248, 249, 260, 291, 298, 306, 307, 317, 325, 338, 344, 370, 381, 453, 492,
    ];
    for (const number of corrected) {
      const { title } = hymns.find((hymn) => hymn.number === number)!;
      expect(resolveBulletinHymnPresentation(toBulletinHymnText(title), 'zh').destination).toEqual(
        expect.objectContaining({ hymnalId: 'chinese-hymnal-505', hymnNumber: number }),
      );
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
