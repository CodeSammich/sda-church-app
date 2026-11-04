import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

import chinese505 from '@/features/hymnal/Chinese505Hymnal.json';
import { SDA_HYMNAL_1985 } from '@/features/hymnal/EnglishHymnal';
import mappings from '@/features/hymnal/HymnalNumberMappings.json';

// The bulletin scripts' copy of the app's hymnals (#619): HymnalData.gs, made
// on every deploy, which the printed bulletin's hymn lookup and the Hymn Bank
// tab's upkeep read.
const generator = require('../scripts/build-hymnal-apps-script.cjs');
const hymnBank = require('../scripts/export-hymn-bank.cjs');

const data = generator.buildHymnalData();
const HYMNAL_DATA_GS: string = generator.buildHymnalAppsScript(data);

const load = (files: string[], context: Record<string, unknown> = {}, withData = true) => {
  const vmContext = createContext({ Logger: { log: () => undefined }, ...context });
  runInContext(
    files
      .map((file) => readFileSync(join(process.cwd(), 'google-apps-script', file), 'utf8'))
      .concat(withData ? [HYMNAL_DATA_GS] : [])
      .join('\n'),
    vmContext,
  );
  return vmContext;
};

describe('HymnalData.gs (#619)', () => {
  it("matches the app's hymnal files", () => {
    // English titles, checked against the app's own module, not the parser
    // the generator uses.
    expect(Object.keys(data.englishTitles)).toHaveLength(695);
    for (const [number, title] of Object.entries(data.englishTitles)) {
      expect(SDA_HYMNAL_1985.en[Number(number)]?.title).toBe(title);
    }
    // Chinese titles in Traditional, as the Hymn Bank prints them.
    const chineseEntries = Object.entries(chinese505 as Record<string, { title?: string }>).filter(
      ([, hymn]) => hymn.title,
    );
    expect(Object.keys(data.chineseTitles)).toHaveLength(chineseEntries.length);
    for (const [number, hymn] of chineseEntries) {
      expect(data.chineseTitles[number]).toBe(hymnBank.toTraditional(hymn.title));
    }
    expect(data.chineseTitles['2']).toBe('聖哉真神');
    // The number maps, exactly as reviewed.
    const map = (id: string) => mappings.mappings.find((mapping) => mapping.id === id)?.numberMap;
    expect(data.numberMaps).toEqual({
      englishToChinese: map('sdah-1985-en-to-chinese-hymnal-505'),
      chineseToEnglish: map('chinese-hymnal-505-to-sdah-1985-en'),
    });
    // The Hymn Bank tab's rows, as the export script writes them.
    expect(data.hymnBankRows).toEqual(hymnBank.buildHymnBank(hymnBank.readHymnals()));
  });

  it('defines BULLETIN_HYMNAL_DATA, and says it is generated', () => {
    const context = load([]);

    expect(JSON.parse(runInContext('JSON.stringify(BULLETIN_HYMNAL_DATA)', context))).toEqual(data);
    expect(HYMNAL_DATA_GS).toMatch(/^\/\/ Generated from features\/hymnal\/ by scripts\/build-hymnal-apps-script\.cjs/);
    expect(HYMNAL_DATA_GS).toContain('Do not edit this generated file directly');
  });

  it('is made before every push, and never committed', () => {
    const deploy = readFileSync(join(process.cwd(), 'scripts/deploy-apps-script.mjs'), 'utf8');

    expect(deploy.indexOf('generateHymnalAppsScriptFile();')).toBeGreaterThan(-1);
    expect(deploy.indexOf('generateHymnalAppsScriptFile();')).toBeLessThan(
      deploy.indexOf("runClasp(['push', '--force']);"),
    );
    expect(readFileSync(join(process.cwd(), '.gitignore'), 'utf8')).toContain('google-apps-script/HymnalData.gs');
  });
});

describe('the printed hymn lookup (#619)', () => {
  const resolve = (context: object, english: string, chinese: string) =>
    JSON.parse(runInContext(`JSON.stringify(resolvePrintedHymnText_(${JSON.stringify(english)}, ${JSON.stringify(chinese)}))`, context));

  it("fills in the other hymnal's number and title", () => {
    const context = load(['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs']);

    expect(resolve(context, 'AH 73 Holy, Holy, Holy', '')).toEqual({
      english: 'AH 73 Holy, Holy, Holy',
      chinese: '第2首 聖哉真神',
    });
    expect(resolve(context, '', '第2首 聖哉真神')).toEqual({
      english: 'AH 73 Holy, Holy, Holy',
      chinese: '第2首 聖哉真神',
    });
    // A bare number, and a typed title that differs from the app's, stay as typed.
    expect(resolve(context, 'AH 73', '')).toEqual({ english: 'AH 73', chinese: '第2首 聖哉真神' });
    expect(resolve(context, '', '第2首 聖哉')).toEqual({ english: 'AH 73 Holy, Holy, Holy', chinese: '第2首 聖哉' });
    // No pair: nothing is filled in, and English never goes in the Chinese slot.
    expect(resolve(context, 'AH 2 All Creatures of Our God and King', '')).toEqual({
      english: 'AH 2 All Creatures of Our God and King',
      chinese: '',
    });
    expect(resolve(context, 'TBD', '')).toEqual({ english: 'TBD', chinese: '' });
  });

  it('prints a hymn as typed if HymnalData.gs is missing', () => {
    const context = load(['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs'], {}, false);

    expect(resolve(context, 'AH 73 Holy, Holy, Holy', '')).toEqual({ english: 'AH 73 Holy, Holy, Holy', chinese: '' });
  });
});

describe('the Hymn Bank tab, kept on open (#619)', () => {
  const rows: string[][] = data.hymnBankRows;

  // A fake tab that records every change.
  const fakeSheet = (values: string[][]) => {
    const calls: string[] = [];
    let current = values.map((row) => row.slice());
    const sheet = {
      calls,
      values: () => current,
      getName: () => 'Hymn Bank',
      getLastRow: () => current.length,
      getDataRange: () => ({ getDisplayValues: () => current.map((row) => row.slice()) }),
      clearContents: () => {
        calls.push('clear');
        current = [];
      },
      getRange: (row: number, column: number, height: number, width: number) => ({
        setNumberFormat: (format: string) => calls.push(`format ${row},${column} ${height}x${width} ${format}`),
        setValues: (next: string[][]) => {
          calls.push(`write ${row},${column} ${height}x${width}`);
          current = next.map((line) => line.slice());
        },
        setFontWeight: (weight: string) => calls.push(`${weight} ${row},${column} ${height}x${width}`),
      }),
      getFrozenRows: () => 0,
      setFrozenRows: (count: number) => calls.push(`freeze ${count}`),
    };
    return sheet;
  };
  const run = (sheet: ReturnType<typeof fakeSheet> | null, withData = true) => {
    const inserted: Array<[string, number]> = [];
    const created = fakeSheet([]);
    const spreadsheet = {
      getSheetByName: (name: string) => (name === 'Hymn Bank' ? sheet : null),
      getSheets: () => [{}, {}, {}],
      insertSheet: (name: string, index: number) => {
        inserted.push([name, index]);
        return created;
      },
      getDeveloperMetadata: () => [],
      createDeveloperMetadataFinder: () => ({ withKey: () => ({ find: () => [] }) }),
    };
    const context = load(['BulletinApi.gs', 'BulletinScheduleMaintenance.gs'], {
      testSpreadsheet: spreadsheet,
    }, withData);
    const result = runInContext('ensureHymnBankTab_(testSpreadsheet)', context);
    return { result, inserted, created };
  };

  it('leaves a tab that matches alone, after reading it once', () => {
    const sheet = fakeSheet(rows);

    expect(run(sheet).result).toBe('unchanged');
    expect(sheet.calls).toEqual([]);
  });

  it('rewrites a tab with a stray edit, an extra column, or a sort', () => {
    const edited = rows.map((row) => row.slice());
    edited[5][0] = '第5首 typo';
    const widened = rows.map((row, index) => row.concat(index ? '' : 'Notes'));
    const sorted = [rows[0], ...rows.slice(1).reverse()];

    for (const values of [edited, widened, sorted, []]) {
      const sheet = fakeSheet(values);
      expect(run(sheet).result).toBe('rewritten');
      expect(sheet.calls).toEqual([
        'clear',
        `format 1,1 ${rows.length}x2 @`,
        `write 1,1 ${rows.length}x2`,
        'bold 1,1 1x2',
        'freeze 1',
      ]);
      expect(sheet.values()).toEqual(rows);
    }
  });

  it('puts a deleted tab back, at the end', () => {
    const { result, inserted, created } = run(null);

    expect(result).toBe('created');
    expect(inserted).toEqual([['Hymn Bank', 3]]);
    expect(created.values()).toEqual(rows);
  });

  it('does nothing without the data, and never stops the rest of the upkeep', () => {
    const sheet = fakeSheet([['old']]);
    expect(run(sheet, false).result).toBe('no data');
    expect(sheet.calls).toEqual([]);

    const logs: string[] = [];
    const context = load(['BulletinApi.gs', 'BulletinScheduleMaintenance.gs'], {
      Logger: { log: (message: string) => logs.push(message) },
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getSheetByName: () => ({
            getLastRow: () => 1,
            getDataRange: () => ({ getDisplayValues: () => [['old']] }),
            clearContents: () => {
              throw new Error('You are trying to edit a protected cell');
            },
          }),
        }),
      },
    });
    expect(runInContext('ensureHymnBankTabSafely_()', context)).toBe('failed');
    expect(logs).toEqual(['Could not refresh the Hymn Bank tab: Error: You are trying to edit a protected cell']);
  });

  it('tags the tab, so it is still found and kept after a rename', () => {
    const context = load(['BulletinApi.gs']);

    expect(JSON.parse(runInContext(`JSON.stringify(BULLETIN_TABS['Hymn Bank'])`, context))).toEqual({
      tag: 'hymn-bank',
      earlierNames: [],
    });
  });
});
