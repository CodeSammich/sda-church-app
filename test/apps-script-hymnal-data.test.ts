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
  // The values go in through the context, so no code is built from them.
  const resolve = (context: object, english: string, chinese: string) =>
    JSON.parse(
      runInContext(
        'JSON.stringify(resolvePrintedHymnText_(testHymn.english, testHymn.chinese))',
        Object.assign(context, { testHymn: { english, chinese } }),
      ),
    );

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

  it('finds a hymn typed by title alone, in either hymnal and either script', () => {
    const context = load(['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs']);
    const holy = { english: 'AH 73 Holy, Holy, Holy', chinese: '第2首 聖哉真神' };

    // Case, spaces and punctuation don't matter.
    expect(resolve(context, 'Holy, Holy, Holy', '')).toEqual(holy);
    expect(resolve(context, 'holy holy holy', '')).toEqual(holy);
    expect(resolve(context, '', '聖哉真神')).toEqual(holy);
    expect(resolve(context, '', '圣哉真神')).toEqual(holy);
    // A title only one hymnal has gets its number.
    expect(resolve(context, 'Amazing Grace', '')).toEqual({ english: 'AH 108 Amazing Grace', chinese: '' });
    // Not a hymnal's title, or typed with both sides: as typed.
    expect(resolve(context, 'Not a hymn', '')).toEqual({ english: 'Not a hymn', chinese: '' });
    expect(resolve(context, 'Holy, Holy, Holy', '聖哉')).toEqual({ english: 'Holy, Holy, Holy', chinese: '聖哉' });
  });

  it('picks, among hymns that share a title, the only one with a twin, and otherwise guesses nothing', () => {
    const context = load(['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs']);

    // #73 and #661 are both "Holy, Holy, Holy"; only #73 has a 505 twin.
    expect(resolve(context, 'Holy, Holy, Holy', '').english).toBe('AH 73 Holy, Holy, Holy');
    expect(resolve(context, 'Just As I Am', '')).toEqual({ english: 'AH 314 Just as I Am', chinese: '第174首 來就耶穌' });
    // 505 #72 and #73 are both 思想十架, with different twins.
    expect(resolve(context, '', '思想十架')).toEqual({ english: '', chinese: '思想十架' });

    // Two tunes of one hymn, both with the same twin: the twin is known, the
    // number isn't, so the typed title stays as it is.
    const tunes = load(['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs'], {}, false);
    runInContext(
      `var BULLETIN_HYMNAL_DATA = {
        englishTitles: { 10: 'Two Tunes', 11: 'Two Tunes' },
        chineseTitles: { 5: '同一首' },
        chineseTitlesSimplified: { 5: '同一首' },
        numberMaps: { englishToChinese: { 10: [5], 11: [5] }, chineseToEnglish: { 5: [10] } },
        hymnBankRows: [],
      };`,
      tunes,
    );
    expect(resolve(tunes, 'Two Tunes', '')).toEqual({ english: 'Two Tunes', chinese: '第5首 同一首' });
  });

  it('prints a hymn typed by title in the Sabbath School as both languages, on two lines', () => {
    const context = load(['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs']);

    expect(
      runInContext(
        'formatSabbathSchoolHymnsForPrint_(testHymns)',
        Object.assign(context, { testHymns: ['holy holy holy', '聖哉真神', 'Not a hymn'] }),
      ),
    ).toBe('1. 第2首 聖哉真神\nAH 73 Holy, Holy, Holy\n2. 第2首 聖哉真神\nAH 73 Holy, Holy, Holy\n3. Not a hymn');
  });

  it('prints a hymn as typed if HymnalData.gs is missing', () => {
    const context = load(['BulletinApi.gs', 'PrintedBulletin.gs', 'PrintedHymnLookup.gs'], {}, false);

    expect(resolve(context, 'AH 73 Holy, Holy, Holy', '')).toEqual({ english: 'AH 73 Holy, Holy, Holy', chinese: '' });
  });
});

describe('the Hymn Bank tab, kept on open with time to spare (#619, #639)', () => {
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
  const documentProperties = (initial: Record<string, string> = {}) => {
    const values: Record<string, string> = { ...initial };
    return {
      values,
      getProperty: (key: string) => values[key] ?? null,
      setProperty: (key: string, value: string) => {
        values[key] = value;
      },
      deleteProperty: (key: string) => {
        delete values[key];
      },
    };
  };
  const run = (
    sheet: ReturnType<typeof fakeSheet> | null,
    withData = true,
    properties = documentProperties(),
  ) => {
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
      PropertiesService: { getDocumentProperties: () => properties },
    }, withData);
    const result = runInContext('ensureHymnBankTab_(testSpreadsheet)', context);
    return { result, inserted, created, properties, context };
  };
  const fingerprintOf = (context: object) =>
    runInContext('getHymnBankFingerprint_(BULLETIN_HYMNAL_DATA.hymnBankRows)', context) as string;

  it('leaves a tab that matches alone, after reading it once, and remembers it', () => {
    const sheet = fakeSheet(rows);
    const { result, properties, context } = run(sheet);

    expect(result).toBe('unchanged');
    expect(sheet.calls).toEqual([]);
    expect(properties.values).toEqual({ 'bulletin.hymnBank.fingerprint': fingerprintOf(context) });
    expect(fingerprintOf(context)).toMatch(/^916:[0-9a-f]+$/);
  });

  it("reads nothing but its fingerprint while the data hasn't changed", () => {
    const first = run(fakeSheet(rows));
    // Even an edited tab is left alone: only onEdit, a deploy, or a missing
    // tab makes it look again.
    const edited = fakeSheet([['stale']]);
    let reads = 0;
    const getDataRange = edited.getDataRange;
    edited.getDataRange = () => {
      reads += 1;
      return getDataRange();
    };

    expect(run(edited, true, first.properties).result).toBe('unchanged');
    expect(reads).toBe(0);
    expect(edited.calls).toEqual([]);

    // A deploy that changes the hymnals changes the fingerprint.
    first.properties.setProperty('bulletin.hymnBank.fingerprint', '916:old');
    expect(run(edited, true, first.properties).result).toBe('rewritten');
    expect(edited.values()).toEqual(rows);
  });

  it('looks again after an edit in the tab, and only there', () => {
    const { properties } = run(fakeSheet(rows));
    const edit = (tab: string) => {
      const context = load(['BulletinApi.gs', 'BulletinScheduleMaintenance.gs', 'ScheduleAssignmentChecks.gs'], {
        PropertiesService: { getDocumentProperties: () => properties },
        SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
      });
      const event = { range: { getSheet: () => ({ getName: () => tab }) } };
      runInContext('onEdit(testEvent)', Object.assign(context, { testEvent: event }));
    };

    edit('Leadership');
    expect(Object.keys(properties.values)).toEqual(['bulletin.hymnBank.fingerprint']);
    edit('Hymn Bank');
    expect(properties.values).toEqual({});
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

  it('puts a deleted tab back, at the end, even with its fingerprint saved', () => {
    const saved = run(fakeSheet(rows)).properties;
    const { result, inserted, created } = run(null, true, saved);

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
      PropertiesService: { getDocumentProperties: () => documentProperties() },
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

  // onOpen is a simple trigger with 30 seconds, and the first open after the
  // 1.6.1 deploy ran out of time rewriting this tab, before it built the menu.
  const openWith = (budget: number) => {
    const calls: string[] = [];
    const logs: string[] = [];
    const menu = { addItem: () => menu, addToUi: () => { calls.push('menu'); return menu; } };
    const context = load(['BulletinApi.gs', 'BulletinScheduleMaintenance.gs', 'ScheduleAssignmentChecks.gs', 'PrintedBulletin.gs'], {
      testCalls: calls,
      Logger: { log: (message: string) => logs.push(message) },
      SpreadsheetApp: { getUi: () => ({ createMenu: () => menu }), getActiveSpreadsheet: () => ({}) },
    });
    Object.assign(context, { testBudget: budget });
    runInContext(
      `HYMN_BANK_OPEN_BUDGET_MS = testBudget;
       maintainBulletinScheduleOnOpen_ = function () { testCalls.push('upkeep'); };
       getMissingBulletinColumns_ = function () { return []; };
       getRenamedBulletinTabsAndColumns_ = function () { return []; };
       ensureHymnBankTabSafely_ = function () { testCalls.push('hymn bank'); };`,
      context,
    );
    runInContext('onOpen()', context);
    return { calls, logs, context };
  };

  it('runs last in onOpen, after the menu and the upkeep', () => {
    expect(openWith(1e9).calls).toEqual(['menu', 'upkeep', 'hymn bank']);
  });

  it('skips, and says so, when the open has used its budget, and the next open tries again', () => {
    const { calls, logs } = openWith(-1);

    expect(calls).toEqual(['menu', 'upkeep']);
    expect(logs.some((line) => /^Skipped the Hymn Bank check: this open has used \d+ ms\.$/.test(line))).toBe(true);
  });

  it('is not in the open-time upkeep or the Create Word Doc… dialog', () => {
    const { context } = openWith(1e9);

    expect(runInContext('HYMN_BANK_OPEN_BUDGET_MS = 20000; HYMN_BANK_OPEN_BUDGET_MS', load(['BulletinApi.gs', 'BulletinScheduleMaintenance.gs']))).toBe(20000);
    expect(runInContext('runBulletinScheduleMaintenance_.toString()', context)).not.toContain('HymnBank');
    expect(runInContext('createPrintedBulletinFromPrompt.toString()', context)).not.toContain('HymnBank');
    expect(runInContext(`Object.keys(BULLETIN_TABS)`, context)).not.toContain('Hymn Bank');
  });
});
