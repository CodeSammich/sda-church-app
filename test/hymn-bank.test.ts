import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';
import OpenCC from 'opencc-js/t2cn';

import chinese505 from '@/features/hymnal/Chinese505Hymnal.json';
import {
  resolveBulletinHymnPresentation,
  toBulletinHymnText,
} from '@/services/BulletinHymnalService';

// The bulletin spreadsheet's Hymn Bank tab (#606): every hymn in the church's
// two hymnals, one per cell, to copy into Weekly Data.
const hymnBank = require('../scripts/export-hymn-bank.cjs');

const loadAppsScript = () => {
  const context = createContext({});
  runInContext(
    ['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs']
      .map((file) => readFileSync(join(process.cwd(), 'google-apps-script', file), 'utf8'))
      .join('\n'),
    context,
  );
  return context;
};

const rows: string[][] = hymnBank.buildHymnBank(hymnBank.readHymnals());
const [headers, ...hymns] = rows;
const getNumber = (cell: string) => Number(cell.match(/\d+/)?.[0]);

describe('scripts/export-hymn-bank.cjs', () => {
  it('pairs each 505 hymn with its 1985 twin, then lists the 1985 hymns left over', () => {
    expect(
      hymnBank.buildHymnBank({
        english: { 1: 'Morning Song', 2: 'Evening Song', 3: 'Harvest Song' },
        chinese: { 1: '晨光颂', 3: '丰收' },
        chineseCount: 3,
        chineseToEnglish: { 1: [2], 2: [3] },
      }),
    ).toEqual([
      ['Chinese Hymnal 505 中文赞美诗', 'SDA Hymnal 1985 英文诗歌本'],
      ['第1首 晨光頌', 'AH 2 Evening Song'],
      // The app has no title for this number.
      ['第2首', 'AH 3 Harvest Song'],
      ['第3首 豐收', ''],
      ['', 'AH 1 Morning Song'],
    ]);
  });

  it('lists every hymn in both hymnals once, paired as the number mappings pair them', () => {
    expect(headers).toEqual(['Chinese Hymnal 505 中文赞美诗', 'SDA Hymnal 1985 英文诗歌本']);
    const chinese = hymns.map(([cell]) => cell).filter(Boolean);
    const english = hymns.map(([, cell]) => cell).filter(Boolean);
    expect(chinese.map(getNumber)).toEqual(Array.from({ length: 505 }, (_, index) => index + 1));
    expect(english.map(getNumber).sort((a, b) => a - b)).toEqual(
      Array.from({ length: 695 }, (_, index) => index + 1),
    );
    const { chineseToEnglish } = hymnBank.readHymnals();
    const pairs = hymns.filter(([chineseCell, englishCell]) => chineseCell && englishCell);
    expect(pairs).toHaveLength(Object.values(chineseToEnglish).filter(Boolean).length);
    for (const [chineseCell, englishCell] of pairs) {
      expect(chineseToEnglish[getNumber(chineseCell)]).toEqual([getNumber(englishCell)]);
    }
  });

  it("writes Traditional titles that convert back to the app's Simplified ones", () => {
    const toSimplified = OpenCC.Converter({ from: 'tw', to: 'cn' });
    for (const [chineseCell] of hymns.slice(0, 505)) {
      const [, number, title] = chineseCell.match(/^第(\d+)首(?: (.+))?$/) ?? [];
      const appTitle = (chinese505 as Record<string, { title: string }>)[number]?.title;
      if (!appTitle) {
        expect(title).toBeUndefined();
        continue;
      }
      expect(toSimplified(title)).toBe(appTitle);
    }
  });

  it("writes cells the app's bulletin opens as that hymn", () => {
    const open = (cell: string, language: string) =>
      resolveBulletinHymnPresentation(toBulletinHymnText(cell), language).destination;
    for (const [chineseCell, englishCell] of hymns) {
      // A 505 number the app has no title for opens no hymn.
      if (/ /.test(chineseCell)) {
        expect(open(chineseCell, 'zh')).toEqual(
          expect.objectContaining({ hymnalId: 'chinese-hymnal-505', hymnNumber: getNumber(chineseCell) }),
        );
      }
      if (englishCell) {
        expect(open(englishCell, 'en')).toEqual(
          expect.objectContaining({ hymnalId: 'sdah-1985-en', hymnNumber: getNumber(englishCell) }),
        );
      }
    }
  });

  it('writes cells the printed bulletin files by language and fills in the twin', () => {
    const context = loadAppsScript();
    const read = (expression: string) =>
      JSON.parse(runInContext(`JSON.stringify(${expression})`, context));
    for (const [chineseCell, englishCell] of hymns) {
      if (chineseCell) {
        expect(read(`getBulletinHymnLanguage_(${JSON.stringify(chineseCell)})`)).toBe('chinese');
        expect(read(`resolvePrintedHymnText_('', ${JSON.stringify(chineseCell)})`)).toEqual({
          english: englishCell ? `AH ${getNumber(englishCell)}` : '',
          chinese: chineseCell,
        });
      }
      if (englishCell) {
        expect(read(`getBulletinHymnLanguage_(${JSON.stringify(englishCell)})`)).toBe('english');
        expect(read(`resolvePrintedHymnText_(${JSON.stringify(englishCell)}, '')`)).toEqual({
          english: englishCell,
          chinese: chineseCell ? `第${getNumber(chineseCell)}首` : '',
        });
      }
    }
  });

  it('reads escaped quotes in the English titles', () => {
    expect(hymnBank.readEnglishHymnal("  {\n    5: { title: 'Jesus\\' Name' },\n")).toEqual({
      5: "Jesus' Name",
    });
  });

  it('refuses a title that would split a row when pasted', () => {
    expect(() => hymnBank.toTsv([['第1首 晨光頌', 'AH 1 Morning\tSong']])).toThrow('tab or line break');
    expect(hymnBank.toTsv([['a', ''], ['', 'b']])).toBe('a\t\n\tb\n');
  });
});
