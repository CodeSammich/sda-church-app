import { getHymnTitle, type HymnalBookId } from '@/features/hymnal/HymnalLabels';
import { getHymnalSearchItems } from '@/features/hymnal/HymnalSearch';
import { HYMNALS } from '@/features/hymnal/Hymnals';
import { simplifiedToTraditional } from '@/services/ChineseScript';

// The printed bulletin's Traditional titles, from opencc-js's whole
// Mainland-to-Taiwan converter and the church's corrections.
const { toTraditional } = require('../scripts/export-hymn-bank.cjs');

const CHINESE_HYMNALS = (Object.keys(HYMNALS) as HymnalBookId[]).filter(
  (hymnalId) => HYMNALS[hymnalId].language === 'zh',
);

const title = (hymnalId: HymnalBookId, number: number) =>
  HYMNALS[hymnalId].getHymns().find((hymn) => hymn.number === number)!.title;

describe('hymn titles in the reader’s script (#795)', () => {
  it.each(CHINESE_HYMNALS)("writes every %s title in Traditional as the printed bulletin's converter does", (hymnalId) => {
    const hymns = HYMNALS[hymnalId].getHymns();
    expect(hymns.length).toBeGreaterThan(400);
    const different = hymns
      .map((hymn) => [hymn.title, simplifiedToTraditional(hymn.title), toTraditional(hymn.title)])
      .filter(([, app, printed]) => app !== printed);
    // A title listed here needs a phrase in services/ChineseScript.ts.
    expect(different).toEqual([]);
  });

  it('shows the Chinese hymnals’ titles in Traditional in the 繁體中文 app', () => {
    expect(getHymnTitle('chinese-hymnal-505', title('chinese-hymnal-505', 2), 'zh')).toBe('聖哉真神');
    expect(getHymnTitle('chinese-hymnal-505', title('chinese-hymnal-505', 5), 'zh')).toBe('讚美上主');
    expect(getHymnTitle('chinese-hymnal-505', title('chinese-hymnal-505', 16), 'zh')).toBe('快樂頌');
    expect(getHymnTitle('chinese-hymnal-505', title('chinese-hymnal-505', 413), 'zh')).toBe('教會基礎');
    expect(getHymnTitle('chinese-hymnal-707-v3', title('chinese-hymnal-707-v3', 23), 'zh')).toBe('祢真偉大');
  });

  it('keeps them in Simplified for every other language, and an English title as it is', () => {
    for (const language of ['zh-cn', 'en', 'es']) {
      expect(getHymnTitle('chinese-hymnal-505', '赞美上主', language)).toBe('赞美上主');
    }
    expect(getHymnTitle('sdah-1985-en', 'Praise to the Lord', 'zh')).toBe('Praise to the Lord');
  });

  it('lists the other hymnals’ matches in the reader’s script', () => {
    const find = (language: string) =>
      getHymnalSearchItems(language).find(
        (item) => item.hymnalId === 'chinese-hymnal-506' && item.hymnNumber === 5,
      )!;
    expect(find('zh').title).toBe('5. 讚美上主');
    expect(find('zh-cn').title).toBe('5. 赞美上主');
    // Search still finds it typed in either script.
    expect(find('zh').normalizedSearchText).toBe(find('zh-cn').normalizedSearchText);
  });
});
