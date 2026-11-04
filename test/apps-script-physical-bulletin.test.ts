import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// HymnalData.gs is made at deploy (#619), so the tests make it the same way.
const HYMNAL_DATA_GS: string = require('../scripts/build-hymnal-apps-script.cjs').buildHymnalAppsScript();

const loadAppsScript = (context: Record<string, unknown>) => {
  const vmContext = createContext(context);
  runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/SabbathEncouragement.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinScheduleMaintenance.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/ScheduleAssignmentChecks.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedBulletin.gs'), 'utf8') +
      '\n' +
      HYMNAL_DATA_GS +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedHymnLookup.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedCommunionBulletin.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedQueensBulletin.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedBrooklynBulletin.gs'), 'utf8'),
    vmContext,
  );
  return vmContext;
};

describe('printed bulletin Apps Script helpers', () => {
  it('maps Brooklyn Sabbath encouragement pages from the supplied anchor', () => {
    const context = loadAppsScript({});

    expect(runInContext(`getSabbathEncouragementPageNumber_('2026-08-22')`, context)).toBe(20);
    expect(runInContext(`getSabbathEncouragementPageNumber_('2026-08-29')`, context)).toBe(21);
    expect(runInContext(`getSabbathEncouragementPageNumber_('2027-04-03')`, context)).toBe(52);
    expect(runInContext(`getSabbathEncouragementPageNumber_('2027-04-10')`, context)).toBe(1);
    expect(runInContext(`getSabbathEncouragementPageText_('2026-08-22')`, context)).toContain('安息日时间的起止');
  });

  it('parses Chinese Bible references and corrects the source PDF typo', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          grouped: parseSabbathBibleReferences_('出 31:12-13，16-17'),
          shorthand: parseSabbathBibleReferences_('诗 100:3; 95:6'),
          typo: parseSabbathBibleReferences_('帖后 2:34')
        })`,
        context,
      ) as string,
    );

    expect(output.grouped).toEqual([
      { bookId: 'EXO', bookLabel: 'Exodus', chapter: 31, verseStart: 12, verseEnd: 13 },
      { bookId: 'EXO', bookLabel: 'Exodus', chapter: 31, verseStart: 16, verseEnd: 17 },
    ]);
    expect(output.shorthand).toEqual([
      { bookId: 'PSA', bookLabel: 'Psalm', chapter: 100, verseStart: 3, verseEnd: 3 },
      { bookId: 'PSA', bookLabel: 'Psalm', chapter: 95, verseStart: 6, verseEnd: 6 },
    ]);
    expect(output.typo).toEqual([
      { bookId: '2TH', bookLabel: '2 Thessalonians', chapter: 2, verseStart: 3, verseEnd: 4 },
    ]);
  });

  it('uses direct BSB text inside the machine-translated English encouragement', () => {
    const cache = new Map<string, string>();
    const context = loadAppsScript({
      CacheService: {
        getScriptCache: () => ({
          get: (key: string) => cache.get(key) || null,
          put: (key: string, value: string) => cache.set(key, value),
        }),
      },
      LanguageApp: {
        translate: (text: string) => text,
      },
      UrlFetchApp: {
        fetch: () => ({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              chapter: {
                content: [
                  { type: 'verse', number: 1, text: 'BSB verse one' },
                  { type: 'verse', number: 2, text: 'BSB verse two' },
                  { type: 'verse', number: 3, text: 'BSB verse three' },
                ],
              },
            }),
        }),
      },
    });

    const output = runInContext(
      `translateSabbathEncouragementParagraph_('「中文經文」(创 2:1-3)')`,
      context,
    ) as string;

    expect(output).toContain('BSB verse one BSB verse two BSB verse three');
    expect(output).toContain('Genesis 2:1-3, BSB');
    expect(output).not.toContain('中文經文');
  });

  it('fits each Zoom study time on the cover on one line in its column', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `var slots = [];
         var columnWidths = [];
         appendBrooklynOnlineText_ = function () {};
         appendBrooklynOnlineSlot_ = function (cell, slot) { slots.push(slot); };
         appendSpacer_ = function () {};
         var fakeCell = {
           appendHorizontalRule: function () { return { getParent: function () { return null; } }; },
           appendTable: function () {
             return {
               setBorderWidth: function () {},
               setColumnWidth: function (index, width) { columnWidths[index] = width; },
               getCell: function () {
                 return { clear: function () {}, setPaddingLeft: function () {}, setPaddingRight: function () {}, setPaddingTop: function () {}, setPaddingBottom: function () {} };
               },
             };
           },
         };
         appendBrooklynOnlineZoomPanel_(fakeCell);
         JSON.stringify({ slots: slots, columnWidths: columnWidths })`,
        context,
      ) as string,
    ) as { slots: string[][]; columnWidths: number[] };

    // Times New Roman advance widths in 2048ths of an em (Liberation Serif's
    // are the same), at 10 points; each Chinese character is 10 points.
    const timesWidths: Record<string, number> = {
      ' ': 512, '0': 1024, '8': 1024, '9': 1024, ':': 569, '–': 1024, '|': 410, A: 1479, M: 1821,
      P: 1139, T: 1251, W: 1933, a: 909, d: 1024, e: 909, n: 1024, s: 797, u: 1024, y: 1024,
    };
    const width = (text: string) =>
      [...text].reduce((total, character) => {
        if (/[\u3400-\u9fff]/.test(character)) return total + 10;
        expect(timesWidths[character]).toBeDefined();
        return total + (timesWidths[character] / 2048) * 10;
      }, 0);

    expect(output.columnWidths).toEqual([184, 184]);
    expect(output.slots.map((slot) => slot[0])).toEqual([
      'Tue 8:00–9:00 AM | 週二早 8:00–9:00',
      'Wed 8:00–9:00 AM | 週三早 8:00–9:00',
      'Wed 8:00–9:00 PM | 週三晚 8:00–9:00',
    ]);
    // The two side by side fit their 184-point columns with room to spare.
    // "Wednesday 8:00–9:00 AM | 週三早 8:00–9:00" was 188 points, and wrapped.
    output.slots.slice(0, 2).forEach(([time]) => {
      expect(width(time)).toBeLessThanOrEqual(184 - 10);
    });
    expect(width('Wednesday 8:00–9:00 AM | 週三早 8:00–9:00')).toBeGreaterThan(184);
  });

  it('adds the document and font actions to the Sheets menu', () => {
    const menuItems: string[] = [];
    let menuTitle = '';
    const menu = {
      addItem: (label: string) => {
        menuItems.push(label);
        return menu;
      },
      addToUi: () => menu,
    };
    const context = loadAppsScript({
      SpreadsheetApp: {
        getUi: () => ({
          createMenu: (title: string) => {
            menuTitle = title;
            return menu;
          },
        }),
      },
    });

    runInContext(`onOpen()`, context);

    expect(menuTitle).toBe('Printed Bulletin');
    expect(menuItems).toEqual([
      'Create Word Doc…',
      'Fonts…',
    ]);
  });

  it('builds the menu before the upkeep, so an open that runs out of time still has it', () => {
    const calls: string[] = [];
    const menu = {
      addItem: (label: string) => {
        calls.push(`item ${label}`);
        return menu;
      },
      addToUi: () => {
        calls.push('menu shown');
        return menu;
      },
    };
    const context = loadAppsScript({
      testCalls: calls,
      SpreadsheetApp: {
        getUi: () => ({ createMenu: () => menu }),
        getActiveSpreadsheet: () => ({}),
      },
    });
    // The upkeep never returns, as when Apps Script stops it at 30 seconds.
    runInContext(
      `maintainBulletinScheduleOnOpen_ = function () {
        testCalls.push('upkeep');
        throw new Error('Exceeded maximum execution time');
      };`,
      context,
    );
    expect(() => runInContext('onOpen()', context)).not.toThrow();

    expect(calls.slice(0, 4)).toEqual([
      'item Create Word Doc…',
      'item Fonts…',
      'menu shown',
      'upkeep',
    ]);
  });

  it('names the expected columns it cannot find when the sheet opens', () => {
    const alerts: string[] = [];
    const menu = { addItem: () => menu, addToUi: () => menu };
    const tab = (name: string, headers: string[]) => ({
      getName: () => name,
      getDataRange: () => ({ getValues: () => [headers], getDisplayValues: () => [headers] }),
    });
    const context = loadAppsScript({
      SpreadsheetApp: {
        getUi: () => ({
          createMenu: () => menu,
          alert: (title: string, message: string) => alerts.push(`${title}\n${message}`),
          ButtonSet: { OK: 'OK' },
        }),
        getActiveSpreadsheet: () => ({
          getSheetByName: (name: string) =>
            name === 'Weekly Data'
              ? tab(name, ['Hymn of Response', 'Date', 'Location', 'Notes'])
              : null,
        }),
      },
    });

    runInContext(`onOpen()`, context);

    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('Bulletin columns not found / 找不到周刊列');
    expect(alerts[0]).toContain('A column can be in any position.');
    expect(alerts[0].split('\n\n')[1].split('\n')).toEqual([
      'Sabbath Calendar (tab)',
      'Weekly Data: Bible Verses',
      'Weekly Data: English Sermon Title',
      'Weekly Data: Chinese Sermon Title',
      'Weekly Data: Sabbath School Hymn 1',
      'Weekly Data: Sabbath School Hymn 2',
      'Weekly Data: Sabbath School Hymn 3',
      'Weekly Data: Hymn of Praise',
      'Weekly Data: Special Music Title',
    ]);
  });

  describe('Weekly Data rows for the next Sabbaths (#558)', () => {
    const HEADERS = [
      'Date', 'Location', 'Bible Verses', 'English Sermon Title', 'Chinese Sermon Title',
      'Sabbath School Hymn 1', 'Sabbath School Hymn 2', 'Sabbath School Hymn 3',
      'Hymn of Praise', 'Special Music Title', 'Hymn of Response',
    ];
    // Dates the script writes come from its own vm context, so instanceof
    // Date doesn't recognize them here.
    const isDate = (value: unknown): value is Date =>
      typeof (value as Date | null)?.getFullYear === 'function';
    // A sheet whose cells are `values`, with a grid of `maxRows` rows and
    // `maxColumns` columns. With `headers` null, the tab starts empty.
    const weeklySheet = (
      rows: unknown[][],
      maxRows = 40,
      headers: string[] | null = HEADERS,
      maxColumns = headers ? headers.length : 26,
    ) => {
      const values: unknown[][] = headers
        ? [[...headers], ...rows.map((row) => [...row, ...Array(Math.max(0, headers.length - row.length)).fill('')])]
        : [];
      const formats: string[] = [];
      const rules: string[] = [];
      const calls: string[] = [];
      const display = (value: unknown) =>
        isDate(value)
          ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
          : String(value ?? '');
      return {
        values,
        formats,
        rules,
        calls,
        getLastRow: () => values.length,
        getLastColumn: () => Math.max(0, ...values.map((line) => line.length)),
        getMaxRows: () => maxRows,
        getMaxColumns: () => maxColumns,
        insertRowsAfter: (_after: number, count: number) => {
          maxRows += count;
        },
        insertColumnsAfter: (_after: number, count: number) => {
          maxColumns += count;
        },
        setFrozenRows: (count: number) => calls.push(`frozen:${count}`),
        getRange: (row: number, column: number, numRows = 1, numColumns = 1) => {
          const read = (format: (value: unknown) => unknown) =>
            Array.from({ length: numRows }, (_, r) =>
              Array.from({ length: numColumns }, (_, c) => format(values[row - 1 + r]?.[column - 1 + c] ?? '')),
            );
          return {
            getValues: () => read((value) => value),
            getDisplayValues: () => read(display),
            setValues: (next: unknown[][]) => {
              if (row - 1 + numRows > maxRows || column - 1 + numColumns > maxColumns) {
                throw new Error('Those cells are out of bounds.');
              }
              next.forEach((line, r) => {
                const target = (values[row - 1 + r] = values[row - 1 + r] ?? []);
                line.forEach((value, c) => {
                  while (target.length < column - 1 + c) target.push('');
                  target[column - 1 + c] = value;
                });
              });
            },
            setFontWeight: (weight: string) => calls.push(`${weight}:${row}:${column}:${numColumns}`),
            setNumberFormat: (format: string) => formats.push(`${row}:${column}:${numRows}:${format}`),
            setDataValidation: (rule: string) => rules.push(`${row}:${column}:${numRows}:${rule}`),
            getA1Notation: () => `${String.fromCharCode(64 + column)}${row}`,
          };
        },
      };
    };
    type WeeklySheet = ReturnType<typeof weeklySheet>;
    // A spreadsheet holding `sheet` as Weekly Data, which can add a tab and
    // keeps its notices.
    const book = (sheet: WeeklySheet | null) => {
      const tabs: Record<string, WeeklySheet> = sheet ? { 'Weekly Data': sheet } : {};
      const toasts: string[] = [];
      return {
        tabs,
        toasts,
        getSheetByName: (name: string) => tabs[name] ?? null,
        insertSheet: (name: string) => (tabs[name] = weeklySheet([], 1000, null)),
        toast: (message: string) => toasts.push(message),
      };
    };
    const added = (sheet: WeeklySheet, from: number) =>
      sheet.values.slice(from).map((row) => [
        isDate(row[0]) ? row[0].toDateString() : row[0],
        row[1],
      ]);
    // A data validation builder that writes the rule out as text.
    const ruleBuilder = () => {
      const parts: string[] = [];
      const builder: Record<string, (...values: unknown[]) => unknown> = {
        build: () => parts.join(' | '),
      };
      ['requireValueInList', 'requireFormulaSatisfied', 'setAllowInvalid', 'setHelpText'].forEach((name) => {
        builder[name] = (...values) => {
          parts.push(`${name}(${values.map(String).join(', ')})`);
          return builder;
        };
      });
      return builder;
    };
    const run = (target: WeeklySheet | ReturnType<typeof book> | null, date: string) => {
      const context = loadAppsScript({ SpreadsheetApp: { newDataValidation: ruleBuilder } });
      (context as { testSpreadsheet: unknown }).testSpreadsheet =
        target && 'tabs' in target ? target : book(target);
      return runInContext(
        `populateUpcomingWeeklyDataRows_(testSpreadsheet, new Date('${date}T12:00:00'))`,
        context,
      ) as number;
    };
    const LOCATION_RULE =
      'requireValueInList(Queens,Brooklyn, true) | setAllowInvalid(false) | ' +
      'setHelpText(Location must be Queens or Brooklyn. / 地点必须是 Queens 或 Brooklyn。)';

    it('adds a Queens and a Brooklyn row for this coming Sabbath and the next', () => {
      const sheet = weeklySheet([['2026-10-31', 'Queens', 'Matthew 6:10']]);
      // A Wednesday: the coming Sabbath is November 7.
      expect(run(sheet, '2026-11-04')).toBe(4);
      expect(added(sheet, 2)).toEqual([
        ['Sat Nov 07 2026', 'Queens'],
        ['Sat Nov 07 2026', 'Brooklyn'],
        ['Sat Nov 14 2026', 'Queens'],
        ['Sat Nov 14 2026', 'Brooklyn'],
      ]);
      expect(sheet.values[1][2]).toBe('Matthew 6:10');
    });

    it('takes only a Saturday in Date, shown as YYYY-MM-DD, on every open', () => {
      const sheet = weeklySheet([
        ['2026-11-07', 'Queens'],
        ['2026-11-07', 'Brooklyn'],
        ['2026-11-14', 'Queens'],
        ['2026-11-14', 'Brooklyn'],
      ]);
      expect(run(sheet, '2026-11-04')).toBe(0);
      // From under the header to the bottom of the 40-row grid.
      expect(sheet.formats).toEqual(['2:1:39:yyyy-mm-dd']);
      expect(sheet.rules).toEqual([
        `2:2:39:${LOCATION_RULE}`,
        '2:1:39:' +
          'requireFormulaSatisfied(=IF(ISNUMBER(A2),AND(A2>=DATE(2020,1,1),WEEKDAY(A2)=7),' +
          'OR(A2="",REGEXMATCH(TO_TEXT(A2),"(?i)^example")))) | ' +
          'setAllowInvalid(false) | ' +
          'setHelpText(Date must be a Saturday, typed as YYYY-MM-DD, such as 2026-11-07. / ' +
          '日期必须是星期六，格式为 YYYY-MM-DD，例如 2026-11-07。)',
      ]);
    });

    it("ignores the example rows at the top, whose Date isn't a date", () => {
      const sheet = weeklySheet([
        ['Example', 'Queens', 'John 10:11-16', 'The Good Shepherd'],
        ['Example', 'Brooklyn', 'Psalms 23:1-6'],
      ]);
      expect(run(sheet, '2026-11-04')).toBe(4);
      expect(sheet.values.slice(1, 3).map((row) => row[0])).toEqual(['Example', 'Example']);
    });

    it('never repeats a row staff already added, however its date is written', () => {
      const sheet = weeklySheet([
        ['2026-11-07', 'queens'],
        [new Date(2026, 10, 14), 'Brooklyn'],
      ]);
      expect(run(sheet, '2026-11-07')).toBe(2);
      expect(added(sheet, 3)).toEqual([
        ['Sat Nov 07 2026', 'Brooklyn'],
        ['Sat Nov 14 2026', 'Queens'],
      ]);
      expect(run(sheet, '2026-11-07')).toBe(0);
    });

    it('adds grid rows when the tab has run out', () => {
      const sheet = weeklySheet([['2026-10-31', 'Queens']], 2);
      expect(run(sheet, '2026-11-01')).toBe(4);
      expect(sheet.values).toHaveLength(6);
      // The rules cover the grown grid too.
      expect(sheet.rules.map((rule) => rule.split(':').slice(0, 3).join(':'))).toEqual(['2:2:5', '2:1:5']);
    });

    it('sets a deleted or emptied tab up again, with its headers and examples', () => {
      for (const spreadsheet of [book(null), book(weeklySheet([], 1000, null))]) {
        expect(run(spreadsheet, '2026-11-04')).toBe(4);
        const sheet = spreadsheet.tabs['Weekly Data'];
        expect(sheet.values[0]).toEqual(HEADERS);
        expect(added(sheet, 1)).toEqual([
          ['Example', 'Queens'],
          ['Example', 'Brooklyn'],
          ['Sat Nov 07 2026', 'Queens'],
          ['Sat Nov 07 2026', 'Brooklyn'],
          ['Sat Nov 14 2026', 'Queens'],
          ['Sat Nov 14 2026', 'Brooklyn'],
        ]);
        expect(sheet.values[2]).toEqual([
          'Example', 'Brooklyn', 'Psalms 23:1-6', 'The Lord Is My Shepherd', '耶和華是我的牧者',
          '205', 'Amazing Grace', '', '第5首 讚美上主', '奇異恩典', 'AH 86 How Great Thou Art',
        ]);
        expect(sheet.calls).toEqual(['bold:1:1:11', 'frozen:1']);
        expect(spreadsheet.toasts).toEqual([
          'Weekly Data was missing, so it was set up again with its columns and two example rows. / ' +
            'Weekly Data 工作表缺失，已重新建立，含所有列和两行示例。',
        ]);
      }
    });

    it('puts a missing column back at the far right, and leaves the rest alone', () => {
      const headers = HEADERS.filter((header) => header !== 'Bible Verses' && header !== 'Special Music Title');
      headers[headers.indexOf('Location')] = 'Campus';
      const sheet = weeklySheet([['2026-11-07', 'Queens', 'Sermon']], 40, headers);
      const spreadsheet = book(sheet);
      run(spreadsheet, '2026-11-04');
      expect(sheet.values[0]).toEqual([...headers, 'Location', 'Bible Verses', 'Special Music Title']);
      expect(sheet.values[1].slice(0, 3)).toEqual(['2026-11-07', 'Queens', 'Sermon']);
      expect(sheet.calls).toEqual(['bold:1:10:3']);
      expect(spreadsheet.toasts).toEqual([
        'Weekly Data: added these missing columns at the far right: Location, Bible Verses, Special Music Title. / ' +
          'Weekly Data：已在最右侧补上缺少的列：Location、Bible Verses、Special Music Title。',
      ]);
      // Once they're there, there's nothing to add or say.
      run(spreadsheet, '2026-11-04');
      expect(spreadsheet.toasts).toHaveLength(1);
    });

    it('counts the older English and Chinese hymn columns as present', () => {
      const headers = [...HEADERS.filter((header) => !header.startsWith('Hymn of')),
        'English Hymn of Praise', 'Chinese Hymn of Praise', 'English Hymn of Response', 'Chinese Hymn of Response'];
      const spreadsheet = book(weeklySheet([], 40, headers));
      run(spreadsheet, '2026-11-04');
      expect(spreadsheet.toasts).toEqual([]);
      expect(spreadsheet.tabs['Weekly Data'].values[0]).toEqual(headers);
    });

    it('has an example cell for every column', () => {
      const context = loadAppsScript({});
      const widths = JSON.parse(
        runInContext(
          `JSON.stringify(WEEKLY_DATA_EXAMPLE_ROWS.map(function (row) { return row.length; }).concat(BULLETIN_SHEET_COLUMNS['Weekly Data'].length))`,
          context,
        ) as string,
      );
      expect(widths).toEqual([11, 11, 11]);
    });
  });

  it('calculates quarter boundaries and date keys', () => {
    const context = loadAppsScript({});
    const values = JSON.parse(
      runInContext(
        `JSON.stringify({
          start: formatBulletinMaintenanceDateKey_(getBulletinQuarterStart_(new Date(2026, 8, 22))),
          end: formatBulletinMaintenanceDateKey_(getBulletinQuarterEnd_(new Date(2026, 8, 22))),
          key: formatBulletinMaintenanceDateKey_(new Date(2026, 9, 3))
        })`,
        context,
      ) as string,
    );

    expect(values).toEqual({
      start: '2026-07-01',
      end: '2026-09-30',
      key: '2026-10-03',
    });
  });

  it('restricts managed header and date/quarter protections to the technology group', () => {
    const calls: string[] = [];
    // Only methods Apps Script's Protection has: until #642 the code called
    // setEditors, which it doesn't, and a fake that had one hid the bug.
    const fakeProtection = (rows: number, columns: number, state: { editors: string[]; warning: boolean; domain: boolean; description: string }) => ({
      getRange: () => ({ getRow: () => 1, getColumn: () => 1, getNumRows: () => rows, getNumColumns: () => columns }),
      getDescription: () => state.description,
      setDescription: (value: string) => calls.push(`description:${value}`),
      isWarningOnly: () => state.warning,
      setWarningOnly: (value: boolean) => calls.push(`warning:${value}`),
      canDomainEdit: () => state.domain,
      setDomainEdit: (value: boolean) => calls.push(`domain:${value}`),
      getEditors: () => state.editors.map((email) => ({ getEmail: () => email })),
      addEditor: (email: string) => calls.push(`add:${email}`),
      removeEditors: (emails: string[]) => calls.push(`remove editors:${emails.join(',')}`),
      remove: () => calls.push('remove'),
    });
    const loose = { editors: ['Someone@example.com'], warning: true, domain: true, description: 'old' };
    const headerProtection = fakeProtection(1, 25, { ...loose });
    const columnProtection = fakeProtection(53, 2, { ...loose });
    const sheet = {
      getRange: (notation: string) => ({
        protect: () => {
          calls.push(`protect:${notation}`);
          return notation === 'A:B' ? columnProtection : headerProtection;
        },
      }),
      getProtections: () => [headerProtection, columnProtection],
      getMaxRows: () => 53,
      getName: () => 'Sabbath Calendar',
    };
    const context = loadAppsScript({
      SpreadsheetApp: { ProtectionType: { RANGE: 'RANGE' } },
    });

    (context as { testSheet: unknown }).testSheet = sheet;
    runInContext(
      `ensureBulletinHeaderProtection_(testSheet, 25); ensureBulletinScheduleFixedColumnProtection_(testSheet);`,
      context,
    );

    expect(calls.filter((call) => /^(add|remove editors):/.test(call))).toEqual([
      'add:technology@nyccsda.org',
      'remove editors:someone@example.com',
      'add:technology@nyccsda.org',
      'remove editors:someone@example.com',
    ]);
    expect(calls.filter((call) => call === 'domain:false')).toHaveLength(2);
    expect(calls.filter((call) => call === 'warning:false')).toHaveLength(2);

    // Already restricted: an open only reads them.
    calls.length = 0;
    const tight = { editors: ['technology@nyccsda.org'], warning: false, domain: false, description: 'Fixed date and quarter columns; technology team only.' };
    const done = fakeProtection(53, 2, tight);
    (context as { doneSheet: unknown }).doneSheet = { ...sheet, getProtections: () => [done] };
    runInContext(`ensureBulletinScheduleFixedColumnProtection_(doneSheet);`, context);
    expect(calls).toEqual([]);
  });

  it('finds no missing Saturdays in a complete quarter', () => {
    const context = loadAppsScript({});
    const values = JSON.parse(
      runInContext(
        `JSON.stringify((function() {
          var start = new Date(2026, 9, 1);
          var end = new Date(2026, 11, 31);
          var dates = getBulletinQuarterSaturdays_(start, end);
          var existing = {};
          dates.forEach(function(date) {
            existing[formatBulletinMaintenanceDateKey_(date)] = true;
          });
          var missing = getBulletinMissingQuarterSaturdays_(start, end, existing);
          return {
            count: dates.length,
            missing: missing.length,
            followingQuarter: formatBulletinMaintenanceDateKey_(new Date(2027, 0, 1))
          };
        })())`,
        context,
      ) as string,
    );

    expect(values).toEqual({
      count: 13,
      missing: 0,
      followingQuarter: '2027-01-01',
    });
  });

  it('does not treat setup actions as public when no admin allowlist is configured', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
      Session: {
        getActiveUser: () => ({ getEmail: () => 'editor@example.com' }),
        getEffectiveUser: () => ({ getEmail: () => 'editor@example.com' }),
      },
    });

    expect(runInContext(`isPrintedBulletinAdmin_()`, context)).toBe(false);
  });

  it('recognizes a configured admin allowlist case-insensitively', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: () => 'bulletin-admin@nyccsda.org, backup@nyccsda.org',
        }),
      },
      Session: {
        getActiveUser: () => ({ getEmail: () => 'BULLETIN-ADMIN@NYCCSDA.ORG' }),
        getEffectiveUser: () => ({ getEmail: () => '' }),
      },
    });

    expect(runInContext(`isPrintedBulletinAdmin_()`, context)).toBe(true);
  });

  it('rejects direct setup calls from accounts outside the allowlist', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: () => 'bulletin-admin@nyccsda.org',
        }),
      },
      Session: {
        getActiveUser: () => ({ getEmail: () => 'editor@example.com' }),
        getEffectiveUser: () => ({ getEmail: () => 'editor@example.com' }),
      },
    });

    const message = runInContext(
      `try { requirePrintedBulletinAdmin_(); 'allowed'; } catch (error) { error.message; }`,
      context,
    );

    expect(message).toContain('PHYSICAL_BULLETIN_ADMIN_EMAILS');
  });

  // A Sabbath with a schedule row and a Weekly Data row whose Bible Verses is
  // `verse`. Every Script Property reads as an old print-only verse.
  const loadPromptFixture = (verse: string, extra: Record<string, unknown> = {}) => {
    const makeSheet = (name: string, rows: string[][]) => ({
      getName: () => name,
      getDataRange: () => ({
        getValues: () => rows,
        getDisplayValues: () => rows,
      }),
    });
    const scheduleHeaders = [
      'Date', 'Quarter', 'Special Remark', 'Tithe Purpose', 'Pastor Travel',
      'Queens Sermon', 'Translation', 'Chinese Teacher', 'English Teacher',
      'Youth Teacher', 'Kids Teacher', 'Chair/Pastoral Prayer', 'Special Music',
      'Offering Prayer', 'Pianist', 'SS Chair', 'SS Opening Prayer',
      'SS Closing Prayer', 'Flower Offering', 'Brooklyn Sermon',
      'Chair/Pastoral Prayer', 'Offering Prayer', 'Technician',
      'Encouragement', 'Sabbath School',
    ];
    const scheduleSheet = makeSheet('Sabbath Calendar', [
      scheduleHeaders,
      ['2026-09-05', ...Array(24).fill('')],
    ]);
    const intakeSheet = makeSheet('Weekly Data', [[
      'Date', 'Location', 'Bible Verses', 'English Sermon Title', 'Chinese Sermon Title',
      'Sabbath School Hymn 1', 'Sabbath School Hymn 2', 'Sabbath School Hymn 3',
      'Hymn of Praise', 'Special Music Title', 'Hymn of Response',
    ], [
      '2026-09-05', 'brooklyn', verse, '', '', '', '', '', '', '', '',
    ]]);
    return loadAppsScript({
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getSheetByName: (name: string) =>
            name === 'Sabbath Calendar'
              ? scheduleSheet
              : name === 'Weekly Data'
                ? intakeSheet
                : null,
        }),
      },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => 'John 12:24' }),
      },
      Logger: { log: () => undefined },
      ...extra,
    });
  };
  const promptDataFor = (verse: string) =>
    JSON.parse(
      runInContext(
        `JSON.stringify(getPrintedBulletinPromptData('2026-09-05', 'brooklyn'))`,
        loadPromptFixture(verse),
      ) as string,
    );

  it('shows Weekly Data\'s verse, as the app does, and ignores an old print-only verse', () => {
    const output = promptDataFor('Luke 7:36-39');

    expect(output.verse).toBe('Luke 7:36-39');
    expect(output.verseLabels).toEqual({ english: 'Luke 7:36–39', chinese: '路加福音 7:36–39' });
    expect(output.verseProblem).toBe('');
    expect(output).not.toHaveProperty('hasVerseOverride');
  });

  it('shows every passage of a reference with several', () => {
    const output = promptDataFor('John 3:16; Psalm 23 and Jeremiah:29:11-15');

    expect(output.verseLabels).toEqual({
      english: 'John 3:16; Psalms 23; Jeremiah 29:11–15',
      chinese: '約翰福音 3:16；詩篇 23；耶利米書 29:11–15',
    });
    expect(output.verseProblem).toBe('');
  });

  it('stops on a blank or TBD verse, in English and Simplified Chinese', () => {
    ['', '  ', 'TBD'].forEach((verse) => {
      const output = promptDataFor(verse);
      expect(output.verseLabels).toBeNull();
      expect(output.verseProblem).toContain('Weekly Data has no Bible Verses for this Sabbath and location.');
      expect(output.verseProblem).toContain('“Weekly Data”中没有这个安息日和地点的“Bible Verses”');
    });
  });

  it('names each passage it can\'t read, rather than printing the rest', () => {
    const output = promptDataFor('John 3:16; Jhon 3:17, 18; John 22:1; John 3:0; John 3:18-16');

    expect(output.verseLabels).toBeNull();
    expect(output.verseProblem).toContain(
      'Weekly Data\'s Bible Verses can\'t be read: “Jhon 3:17”, “18”, “John 22:1”, “John 3:0”, “John 3:18-16”.',
    );
    expect(output.verseProblem).toContain('无法读取“Weekly Data”中的“Bible Verses”：“Jhon 3:17”、“18”');
    expect(output.verseProblem).not.toContain('“John 3:16”');
  });

  it('won\'t create the Doc without a readable Weekly Data verse, whatever the request says', () => {
    const created: string[] = [];
    const run = (verse: string) => {
      const context = loadPromptFixture(verse, {
        LockService: {
          getScriptLock: () => ({ waitLock: () => undefined, tryLock: () => true, releaseLock: () => undefined }),
        },
        DocumentApp: { create: (name: string) => created.push(name) },
        DriveApp: { getFileById: () => created.push('drive') },
      });
      return runInContext(
        `try {
          createPrintedBulletinFromRequest({
            date: '2026-09-05', location: 'brooklyn', format: 'regular', verse: 'John 3:16'
          });
          'created';
        } catch (error) { error.message; }`,
        context,
      ) as string;
    };

    expect(run('')).toContain('Weekly Data has no Bible Verses');
    expect(run('Jhon 3:16')).toContain('can\'t be read: “Jhon 3:16”');
    expect(created).toEqual([]);
  });

  it('makes only a Google Doc, and trashes a PDF made for the same bulletin before', () => {
    const properties: Record<string, string> = {
      PHYSICAL_BULLETIN_PDF_ID_QUEENS_2026_10_31: 'unrelated',
      'PHYSICAL_BULLETIN_PDF_ID_QUEENS_2026-10-31': 'queens-pdf',
      'PHYSICAL_BULLETIN_PDF_ID_2026-10-31': 'legacy-pdf',
      'PHYSICAL_BULLETIN_PDF_ID_BROOKLYN_2026-10-31': 'brooklyn-pdf',
    };
    const trashed: string[] = [];
    const context = loadAppsScript({
      DriveApp: {
        getFileById: (id: string) => ({
          setTrashed: () => {
            if (id === 'legacy-pdf') throw new Error('Gone');
            trashed.push(id);
          },
        }),
      },
      testProperties: {
        getProperty: (key: string) => properties[key] || null,
        deleteProperty: (key: string) => {
          delete properties[key];
        },
      },
    });

    runInContext(`trashPrintedBulletinPdf_(testProperties, 'queens', '2026-10-31')`, context);
    const html = runInContext(`buildPrintedBulletinPromptHtml_('2026-10-31')`, context) as string;

    expect(trashed).toEqual(['queens-pdf']);
    expect(Object.keys(properties).sort()).toEqual([
      'PHYSICAL_BULLETIN_PDF_ID_BROOKLYN_2026-10-31',
      'PHYSICAL_BULLETIN_PDF_ID_QUEENS_2026_10_31',
    ]);
    expect(html).toContain('Open Google Doc / 打开 Google 文档');
    expect(html).not.toMatch(/pdf/i);
  });

  it('links the dialog straight to the Weekly Data tab', () => {
    const context = loadAppsScript({
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getUrl: () => 'https://docs.google.com/spreadsheets/d/sheet-id/edit',
          getSheetByName: (name: string) => (name === 'Weekly Data' ? { getSheetId: () => 42 } : null),
        }),
      },
    });

    expect(runInContext('getBulletinIntakeSheetUrl_()', context)).toBe(
      'https://docs.google.com/spreadsheets/d/sheet-id/edit#gid=42',
    );
  });

  it('builds three numbered cards, a few words each, with Preview', () => {
    const context = loadAppsScript({});
    const html = runInContext(
      `buildPrintedBulletinPromptHtml_('2026-09-26')`,
      context,
    ) as string;

    expect(html).toContain('Queens / 皇后区');
    expect(html).toContain('Brooklyn / 布鲁克林');
    expect(html).toContain('Regular / 普通');
    expect(html).toContain('Communion / 圣餐');
    // Notes that say what the form already shows are gone.
    expect(html).not.toContain('Brooklyn Communion is not currently available');
    expect(html).not.toContain('closest upcoming Saturday');
    expect(html).toContain('updateLocationFormatAvailability');
    expect(html).toContain('.choice:disabled');
    expect(html).not.toContain('Detect from response');
    expect(html).toContain('eng_kjv');
    expect(html).toContain('English Bible / 英文圣经');
    expect(html).not.toContain('Chinese is always CUV');
    expect(html).not.toContain('cmn_cu1');
    expect(html).toContain('getPrintedBulletinPromptWarning');
    expect(html).toContain('Add announcement / 添加通知');
    expect(html).toContain('getPrintedBulletinPromptData');
    // Three numbered cards, each a few words: no help paragraphs, only step
    // 3's Mac note.
    expect(html.match(/<div (id="[^"]+" )?class="step">/g)).toHaveLength(3);
    expect(html).toContain('<span class="step-number">1</span>Fill in Weekly Data / 填写 Weekly Data');
    expect(html).toContain('<span class="step-number">2</span>Preview &amp; check / 预览并检查');
    expect(html).toContain('<span class="step-number">3</span>Convert and send .docx to pastor / 转换 .docx 发给牧师');
    expect(html.match(/class="help">/g)).toBeNull();
    expect(html.match(/class="mac-note">/g)).toHaveLength(1);
    expect(html).toContain('Announcements (print only) / 通知（仅印刷）');
    // No empty announcement card to start with: just the Add button.
    expect(html).toContain('(entries||[]).forEach(addAnnouncementEntry)');
    expect(html).not.toContain('admin-reminder"');
    expect(html).toContain('>Preview / 预览</button>');
    expect(html).not.toContain('Create / 创建');
    expect(html).toContain('<h2>Preview ready / 预览已完成</h2>');
    expect(html).toContain('↗ Open Weekly Data / 打开 Weekly Data');
    // Outside the spreadsheet, the link opens the spreadsheet itself.
    expect(html).toContain('href="https://docs.google.com/spreadsheets/d/1FqFJ8YvBA-IybOlVU1SW6ynrBGNs8Cd-9xlWz6SkkDA/edit"');
    expect(html).not.toContain('forms.gle');
    expect(html).not.toContain('Worship Data form');
    expect(html).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(html).toContain('white-space:normal');
    expect(html).toContain('class="required-mark"');
    expect(html).toContain('function updateSubmitState');
    expect(html).toContain('function showGenerationError');
    expect(html).toContain('function focusStatusView_');
    expect(html).toContain('scrollIntoView');
    expect(html).toContain('class="status-slot"');
    expect(html).toContain('document.getElementById("bulletinForm").hidden=true');
    expect(html).toContain('block:"nearest"');
    expect(html.indexOf('English Bible / 英文圣经')).toBeLessThan(html.indexOf('Announcements (print only)'));
    // The verse is in Weekly Data, so the dialog doesn't show it: only, by
    // Preview, why Preview is off when it's blank or unreadable (#622).
    expect(html).toContain('<div id="verseView" class="verse-view problem" role="alert" hidden></div>');
    expect(html).not.toContain('Bible reading');
    expect(html).not.toContain('From the Bible Verses column in Weekly Data');
    expect(html.indexOf('id="verseView"')).toBeLessThan(html.indexOf('id="submit"'));
    // "Preview ready" shows under step 2, above step 3.
    expect(html.indexOf('id="statusView"')).toBeGreaterThan(html.indexOf('</form>'));
    expect(html.indexOf('id="statusView"')).toBeLessThan(html.indexOf('id="wordCopySection"'));
    expect(html).not.toMatch(/id="(book|chapter|verses)"/);
    expect(html).not.toContain('Choose a book');
    expect(html).not.toContain('选择书卷');
    expect(html).not.toContain('verseOverrideDirty');
    expect(html).toContain('verseReady');
  });

  it('stores ordered printed announcements in Apps Script properties', () => {
    const properties: Record<string, string> = {};
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (key: string) => properties[key] ?? null,
          setProperty: (key: string, value: string) => {
            properties[key] = value;
          },
        }),
      },
      LockService: {
        getScriptLock: () => ({
          waitLock: () => undefined,
          releaseLock: () => undefined,
        }),
      },
    });

    const output = JSON.parse(
      runInContext(
        `savePrintedBulletinAnnouncements_('2026-09-26', [
          { scope: 'all', english: 'Potluck after worship', chinese: '崇拜後聚餐' },
          { scope: 'queens', english: 'Queens-only notice', chinese: '' },
          { scope: 'brooklyn', english: '', chinese: '' }
        ]); JSON.stringify(readPrintedBulletinAnnouncements_('2026-09-26'))`,
        context,
      ) as string,
    );

    expect(output).toEqual({
      found: true,
      entries: [
        { scope: 'all', english: 'Potluck after worship', chinese: '崇拜後聚餐' },
        { scope: 'queens', english: 'Queens-only notice', chinese: '' },
      ],
    });
    expect(properties['PRINTED_ANNOUNCEMENTS_2026-09-26']).toContain('Queens-only notice');
  });

  it('renders only matching printed announcement scopes', () => {
    const context = loadAppsScript({});
    const output = runInContext(
      `getPhysicalPrintedAnnouncementText_({
        hasPrintedAnnouncements: true,
        printedAnnouncements: [
          { scope: 'all', english: 'Everyone', chinese: '' },
          { scope: 'queens', english: 'Queens only', chinese: '皇后區' },
          { scope: 'brooklyn', english: 'Brooklyn only', chinese: '' }
        ]
      }, 'queens')`,
      context,
    );

    expect(output).toBe('Everyone\n\n皇后區\nQueens only');
  });

  it('bolds the first sentence of each printed announcement language', () => {
    const context = loadAppsScript({});

    expect(
      runInContext(
        `getFirstPrintedAnnouncementSentenceLength_('Please donate. Additional details follow.')`,
        context,
      ),
    ).toBe('Please donate.'.length);
    expect(
      runInContext(
        `getFirstPrintedAnnouncementSentenceLength_('請奉獻。詳情如下。')`,
        context,
      ),
    ).toBe('請奉獻。'.length);
  });

  it('keeps Chinese announcement punctuation with the preceding character', () => {
    const context = loadAppsScript({});
    const output = runInContext(
      `protectPrintedChinesePunctuation_('請於十月二十四日參加選舉，謝謝。')`,
      context,
    ) as string;

    expect(output).toContain('選舉\uFEFF，謝謝\uFEFF。');
  });

  it('numbers each printed announcement consistently in both languages', () => {
    const context = loadAppsScript({});

    expect(
      runInContext(
        `formatPrintedAnnouncementNumberedText_('報告事項', 0)`,
        context,
      ),
    ).toBe('1. 報告事項');
    expect(
      runInContext(
        `formatPrintedAnnouncementNumberedText_('Announcement', 1)`,
        context,
      ),
    ).toBe('2. Announcement');
    expect(runInContext(`formatPrintedAnnouncementNumberedText_('', 2)`, context)).toBe('');
  });

  it('prints the giving text without the stocks line that pushed it onto a second page', () => {
    const printed = (reuseLeadingParagraph: boolean) => {
      const makeParagraph = (initial: string) => {
        const paragraph = {
          text: initial,
          getType: () => 'PARAGRAPH',
          asParagraph: () => paragraph,
          getText: () => paragraph.text,
          setText: (value: string) => {
            paragraph.text = value;
          },
          setAlignment: () => undefined,
          setLineSpacing: () => undefined,
          setSpacingBefore: () => undefined,
          setSpacingAfter: () => undefined,
          editAsText: () => ({}),
        };
        return paragraph;
      };
      // A footer cell after clear(): one empty paragraph.
      const paragraphs = [makeParagraph('')];
      const cell = {
        getNumChildren: () => paragraphs.length,
        getChild: (index: number) => paragraphs[index],
        appendParagraph: (value: string) => {
          const paragraph = makeParagraph(value);
          paragraphs.push(paragraph);
          return paragraph;
        },
      };
      const context = loadAppsScript({
        DocumentApp: {
          ElementType: { PARAGRAPH: 'PARAGRAPH' },
          HorizontalAlignment: { CENTER: 'CENTER' },
        },
      });
      Object.assign(context, { styleText_: () => undefined, testCell: cell });
      runInContext(
        `appendGivingText_(testCell, { reuseLeadingParagraph: ${reuseLeadingParagraph} })`,
        context,
      );
      return paragraphs.map((paragraph) => paragraph.text);
    };

    for (const reuseLeadingParagraph of [true, false]) {
      const lines = printed(reuseLeadingParagraph);
      if (!reuseLeadingParagraph) {
        // Not asked to reuse it, the cell's own empty paragraph stays first.
        expect(lines.shift()).toBe('');
      }
      // The heading, the half spacer, and the cash-offering line in Chinese
      // and English, with no empty paragraph left over. One more line pushed
      // the bulletin onto a second page at the 10-point minimum, so a new line
      // needs room made for it first.
      expect(lines).toHaveLength(4);
      expect(lines[0]).toBe('Tithes & Offerings | 什一奉獻與自由奉獻');
      expect(lines[1]).toBe(' ');
      expect(lines[2]).toMatch(/^現金奉獻：/);
      expect(lines[3]).toMatch(/^Cash offerings: /);
      // Stock gifts stay in the app's Give page, in every language.
      for (const line of lines) {
        expect(line).not.toMatch(/stocks?\b|equities|donor[- ]advised|\bEIN\b/i);
      }
    }

    const givePage = readFileSync(join(process.cwd(), 'app/(tabs)/home/give.tsx'), 'utf8');
    expect(givePage).toContain("dafTitle: 'Stocks/Equities'");
    expect(givePage).toContain('EIN 11-3004814');
  });

  it('lists the giving QR codes for each location', () => {
    const source = readFileSync(
      join(process.cwd(), 'google-apps-script/PrintedBulletin.gs'),
      'utf8',
    );
    const givingQrItemsStart = source.indexOf('function getGivingQrItems_');
    const givingQrItems = source.slice(
      givingQrItemsStart,
      source.indexOf('\nfunction ', givingQrItemsStart + 10),
    );

    expect(givingQrItems).toContain("'Zelle® (zelle@nyccsda.org)', 'Zelle® 轉賬'");

    const context = loadAppsScript({});
    expect(JSON.parse(runInContext(
      `JSON.stringify(getGivingQrItems_('brooklyn').map(function (item) { return item.kind; }))`,
      context,
    ) as string)).toEqual(['mobileApp', 'adventistGiving', 'unused']);
    expect(JSON.parse(runInContext(
      `JSON.stringify(getGivingQrItems_('queens').map(function (item) { return item.kind; }))`,
      context,
    ) as string)).toEqual(['mobileApp', 'adventistGiving', 'zelle']);
    // The mobile app and ACH/card codes print. Zelle stays reserved until the
    // treasury confirms the address (#384), and Brooklyn has no Zelle.
    for (const location of ['queens', 'brooklyn']) {
      expect(JSON.parse(runInContext(
        `JSON.stringify(getGivingQrItems_('${location}').map(function (item) { return Boolean(item.reserved); }))`,
        context,
      ) as string)).toEqual([false, false, true]);
    }
    expect(runInContext(`getGivingQrItems_('queens')[0].label`, context)).toBe(
      '下載 APP\nDownload Mobile App',
    );
    expect(runInContext(`getGivingQrItems_('brooklyn')[0].label`, context)).toBe(
      '下載 APP\nDownload Mobile App',
    );
  });

  it('leaves the mobile app slot blank, with no placeholder, when its code is missing', () => {
    const context = loadAppsScript({
      Logger: { log: () => undefined },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });
    const calls: string[] = [];
    context.tableCell = new Proxy(
      {},
      {
        get: (_target, name) => () => {
          calls.push(String(name));
        },
      },
    );

    expect(runInContext(`getPrintedBulletinQrImageFileId_('mobileApp')`, context)).toBe('');
    runInContext(
      `appendGivingQrPlaceholderCell_(tableCell, getGivingQrItems_('queens')[0], {})`,
      context,
    );
    expect(calls).toEqual(['clear']);
  });

  it('uses the shared dummy QR image for giving slots until their Drive IDs are configured', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });

    expect(runInContext(`getPrintedBulletinQrImageFileId_('zelle')`, context)).toBe(
      '12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq',
    );
    expect(runInContext(`getPrintedBulletinQrImageFileId_('adventistGiving')`, context)).toBe(
      '12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq',
    );
  });

  // The QR codes live in one folder of a restricted shared drive (#237).
  const qrFolderId = '11esgvM1uhY5e94A_eL2ITI0iKNLIFEEr';
  type DriveListArgs = {
    q: string;
    corpora?: string;
    includeItemsFromAllDrives?: boolean;
    supportsAllDrives?: boolean;
  };
  /** A Drive advanced service whose folder holds `filesInFolder`, by name. */
  const driveApi = (filesInFolder: Record<string, string>, calls: DriveListArgs[] = []) => ({
    Files: {
      list: (args: DriveListArgs) => {
        calls.push(args);
        const name = /name = '([^']+)'/.exec(args.q)?.[1] ?? '';
        const inFolder = args.q.includes(`'${qrFolderId}' in parents`);
        const id = inFolder ? filesInFolder[name] : undefined;
        return { files: id ? [{ id }] : [] };
      },
    },
  });
  // Searching all of Drive by name would let a same-named file anywhere the
  // person can see replace a code, so the lookup must never do it.
  const driveAppWithoutGlobalSearch = (folders: Record<string, unknown> = {}) => ({
    getFilesByName: () => {
      throw new Error('searched all of Drive by name');
    },
    getFolderById: (id: string) => {
      if (!folders[id]) throw new Error(`no access to folder ${id}`);
      return folders[id];
    },
  });

  it('finds each QR file by name in the QR code folder, across shared drives', () => {
    const calls: DriveListArgs[] = [];
    const context = loadAppsScript({
      Drive: driveApi(
        {
          'brooklyn_adventist_giving_qr_code_368x368.jpg': 'brooklyn-giving-code',
          'queens_zelle_qr_code_368x368.jpg': 'queens-zelle-code',
          'mobile_app_qr_code_368x368.jpg': 'mobile-app-code',
        },
        calls,
      ),
      DriveApp: driveAppWithoutGlobalSearch(),
      Logger: { log: () => undefined },
    });

    expect(runInContext(`getPrintedBulletinQrImageFileId_('adventistGiving', 'brooklyn')`, context)).toBe(
      'brooklyn-giving-code',
    );
    expect(runInContext(`getPrintedBulletinQrImageFileId_('zelle', 'queens')`, context)).toBe(
      'queens-zelle-code',
    );
    expect(runInContext(`getPrintedBulletinQrImageFileId_('mobileApp', 'brooklyn')`, context)).toBe(
      'mobile-app-code',
    );
    expect(calls.map((call) => call.q)).toEqual([
      `'${qrFolderId}' in parents and name = 'brooklyn_adventist_giving_qr_code_368x368.jpg' and trashed = false`,
      `'${qrFolderId}' in parents and name = 'queens_zelle_qr_code_368x368.jpg' and trashed = false`,
      `'${qrFolderId}' in parents and name = 'mobile_app_qr_code_368x368.jpg' and trashed = false`,
    ]);
    // Viewers of a shared drive only find its files when the search asks for
    // shared drives explicitly.
    for (const call of calls) {
      expect(call).toMatchObject({
        corpora: 'allDrives',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
      });
    }
  });

  it('searches the folder set in Script Properties instead, when there is one', () => {
    const calls: DriveListArgs[] = [];
    const context = loadAppsScript({
      Drive: driveApi({}, calls),
      DriveApp: driveAppWithoutGlobalSearch(),
      Logger: { log: () => undefined },
      PropertiesService: {
        getScriptProperties: () => ({
          getProperty: (name: string) =>
            name === 'PRINTED_BULLETIN_QR_FOLDER_ID' ? 'replacement-folder' : '',
        }),
      },
    });

    runInContext(`getPrintedBulletinQrImageFileId_('mobileApp', 'queens')`, context);
    expect(calls[0].q).toContain(`'replacement-folder' in parents`);
  });

  it('falls back to searching the folder with DriveApp, skipping trashed files', () => {
    const filesNamed: Record<string, { id: string; trashed: boolean }[]> = {
      'mobile_app_qr_code_368x368.jpg': [
        { id: 'old-trashed-code', trashed: true },
        { id: 'current-code', trashed: false },
      ],
      'queens_adventist_giving_qr_code_368x368.jpg': [{ id: 'trashed-only', trashed: true }],
    };
    const folder = {
      getFilesByName: (name: string) => {
        const files = [...(filesNamed[name] ?? [])];
        return {
          hasNext: () => files.length > 0,
          next: () => {
            const file = files.shift()!;
            return { getId: () => file.id, isTrashed: () => file.trashed };
          },
        };
      },
    };
    const context = loadAppsScript({
      // As when the Drive API isn't turned on for the script yet.
      Drive: {
        Files: {
          list: () => {
            throw new Error('Drive API has not been used in this project');
          },
        },
      },
      DriveApp: driveAppWithoutGlobalSearch({ [qrFolderId]: folder }),
      Logger: { log: () => undefined },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });

    expect(runInContext(`getPrintedBulletinQrImageFileId_('mobileApp', 'queens')`, context)).toBe(
      'current-code',
    );
    expect(
      runInContext(`getPrintedBulletinQrImageFileId_('adventistGiving', 'queens')`, context),
    ).toBe('12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq');
  });

  it('leaves the mobile app slot blank when nobody can read the QR code folder', () => {
    const context = loadAppsScript({
      Drive: driveApi({}),
      DriveApp: driveAppWithoutGlobalSearch(),
      Logger: { log: () => undefined },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });

    expect(runInContext(`getPrintedBulletinQrImageFileId_('mobileApp', 'queens')`, context)).toBe('');
  });

  it('escapes quotes in Drive search values', () => {
    const context = loadAppsScript({});
    expect(runInContext(`escapeDriveQueryValue_("it's a \\\\ test")`, context)).toBe(
      "it\\'s a \\\\ test",
    );
  });

  it('searches the folder the QR code workflow uploads to, with the Drive API turned on', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github/workflows/generate-physical-bulletin-qr.yml'),
      'utf8',
    );
    expect(workflow).toContain(`GOOGLE_DRIVE_FOLDER_ID: ${qrFolderId}`);
    const context = loadAppsScript({});
    expect(runInContext('PRINTED_BULLETIN_CONFIG.qrImageFolderId', context)).toBe(qrFolderId);

    const manifest = JSON.parse(
      readFileSync(join(process.cwd(), 'google-apps-script/appsscript.json'), 'utf8'),
    );
    expect(manifest.dependencies.enabledAdvancedServices).toContainEqual({
      userSymbol: 'Drive',
      serviceId: 'drive',
      version: 'v3',
    });
  });

  it('splits printed bilingual values into horizontal English and Chinese columns', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify(splitPrintedBilingualValue_('林志遠\\nEverett Lin'))`,
        context,
      ) as string,
    );

    expect(output).toEqual({ english: 'Everett Lin', chinese: '林志遠' });
  });

  it('formats the shared cover date in the reference layout', () => {
    const context = loadAppsScript({});

    expect(runInContext(`formatSharedCoverDate_('2026-09-19')`, context)).toBe(
      '2026.9.19',
    );
  });

  it('uses bilingual TBD text for blank schedule assignments', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          blank: formatPrintedScheduleValue_(''),
          nextMissing: formatPrintedScheduleValue_(null)
        })`,
        context,
      ) as string,
    );

    expect(output).toEqual({
      blank: '尚未確定\nTBD',
      nextMissing: '尚未確定\nTBD',
    });
  });

  it('prunes per-week Script Properties more than four weeks old, and every old print-only verse', () => {
    const properties: Record<string, string> = {
      // Older than four weeks before 2026-11-03 (the cutoff is 2026-10-06).
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-09-12': 'doc-a',
      'PHYSICAL_BULLETIN_DOC_ID_BROOKLYN_2026-10-03': 'doc-b',
      'PHYSICAL_BULLETIN_DOC_ID_2026-09-05': 'doc-c',
      'PHYSICAL_BULLETIN_PDF_ID_QUEENS_2026-09-12': 'pdf-a',
      'PHYSICAL_BULLETIN_PDF_ID_2026-09-05': 'pdf-b',
      'PRINTED_ANNOUNCEMENTS_2026-09-12': '[]',
      // Every old print-only verse goes, even next week's.
      'PRINTED_BIBLE_VERSE_QUEENS_2026-09-12': 'John 1:1',
      'PRINTED_BIBLE_VERSE_BROOKLYN_2026-11-07': 'John 1:2',
      // Recent and future weeks stay, so a reprint still updates its Doc.
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-10-10': 'doc-d',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-11-07': 'doc-e',
      'PHYSICAL_BULLETIN_PDF_ID_BROOKLYN_2026-10-06': 'pdf-c',
      'PRINTED_ANNOUNCEMENTS_2026-11-07': '[]',
      // Anything else stays: settings, other prefixes, odd forms and dates.
      'bulletin.changeover.schedule-not-set.watchedSince': '2026-09-01',
      PRINTED_BULLETIN_CJK_FONT: 'Some Font',
      PHYSICAL_BULLETIN_ADMIN_EMAILS: 'admin@example.com',
      SCHEDULE_NAME_CHECK_TRIGGER: 'installed',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026_09_12': 'underscored',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-02-30': 'not a date',
      'PHYSICAL_BULLETIN_DOC_ID_MANHATTAN_2026-09-12': 'unknown location',
      'PRINTED_ANNOUNCEMENTS_QUEENS_2026-09-12': 'no location form',
      'PRINTED_BIBLE_VERSE_2026-09-12': 'no location form',
      'XPHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-09-12': 'other prefix',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-09-12_COPY': 'suffix',
    };
    const logs: string[] = [];
    const locks: string[] = [];
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({
          getKeys: () => Object.keys(properties),
          deleteProperty: (key: string) => {
            delete properties[key];
          },
        }),
      },
      LockService: {
        getScriptLock: () => ({
          tryLock: () => {
            locks.push('lock');
            return true;
          },
          releaseLock: () => locks.push('release'),
        }),
      },
      Logger: { log: (message: string) => logs.push(message) },
    });

    const removed = runInContext(`prunePrintedBulletinProperties_('2026-11-03')`, context);

    expect(removed).toBe(8);
    expect(Object.keys(properties).sort()).toEqual([
      'PHYSICAL_BULLETIN_ADMIN_EMAILS',
      'PHYSICAL_BULLETIN_DOC_ID_MANHATTAN_2026-09-12',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-02-30',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-09-12_COPY',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-10-10',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-11-07',
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026_09_12',
      'PHYSICAL_BULLETIN_PDF_ID_BROOKLYN_2026-10-06',
      'PRINTED_ANNOUNCEMENTS_2026-11-07',
      'PRINTED_ANNOUNCEMENTS_QUEENS_2026-09-12',
      'PRINTED_BIBLE_VERSE_2026-09-12',
      'PRINTED_BULLETIN_CJK_FONT',
      'SCHEDULE_NAME_CHECK_TRIGGER',
      'XPHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-09-12',
      'bulletin.changeover.schedule-not-set.watchedSince',
    ]);
    expect(logs).toEqual(['Pruned 8 old printed bulletin Script Properties.']);
    expect(locks).toEqual(['lock', 'release']);
  });

  it('skips pruning, without failing, while another run holds the lock or the properties fail', () => {
    const deleted: string[] = [];
    const load = (tryLock: boolean, getKeys: () => string[]) =>
      loadAppsScript({
        PropertiesService: {
          getScriptProperties: () => ({ getKeys, deleteProperty: (key: string) => deleted.push(key) }),
        },
        LockService: {
          getScriptLock: () => ({ tryLock: () => tryLock, releaseLock: () => undefined }),
        },
        Logger: { log: () => undefined },
      });

    const keys = () => ['PRINTED_BIBLE_VERSE_QUEENS_2026-09-12'];
    expect(runInContext(`prunePrintedBulletinProperties_('2026-11-03')`, load(false, keys))).toBe(0);
    expect(
      runInContext(
        `prunePrintedBulletinProperties_('2026-11-03')`,
        load(true, () => {
          throw new Error('Service unavailable');
        }),
      ),
    ).toBe(0);
    expect(deleted).toEqual([]);
  });

  it('detects communion format from the schedule remark', () => {
    const context = loadAppsScript({});
    const format = runInContext(
      `resolvePrintedBulletinFormat_('', { specialRemark: 'Communion Sabbath' })`,
      context,
    );

    expect(format).toBe('communion');
  });

  it('rejects the unsupported Brooklyn Communion combination server-side', () => {
    const context = loadAppsScript({});
    const message = runInContext(
      `try {
        validatePrintedBulletinRequest_({
          date: '2026-09-26',
          location: 'brooklyn',
          format: 'communion',
          verse: 'John 12:24'
        });
        'allowed';
      } catch (error) { error.message; }`,
      context,
    );

    expect(message).toContain('Brooklyn Communion bulletins are not available yet');
  });

  it('keeps Communion references fixed and separate from the submitted study verse', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          service: getPrintedCommunionServiceScripture_(),
          responseHymn: getPrintedCommunionResponseHymn_(),
          wholeCongregation: getPrintedCommunionWholeCongregation_(),
          communionPastor: getPrintedCommunionPastor_({ communionPastor: '溫保羅牧師\\nPastor Paul Wen' }),
          missingPastor: getPrintedCommunionPastor_({ communionPastor: '' }),
          footWashing: getPrintedCommunionFootWashingScripture_(),
          footWashingLookup: getPrintedCommunionFootWashingLookupScripture_(),
          passageDefinitions: {
            communion: getPrintedCommunionPassageDefinition_('communion'),
            footWashing: getPrintedCommunionPassageDefinition_('footWashing')
          },
          instruction: getPrintedCommunionFootWashingInstruction_(),
          readings: getPrintedCommunionReadingRows_()
        })`,
        context,
      ) as string,
    );

    expect(output.service).toBe('1 Corinthians 11:23–26');
    expect(output.responseHymn).toBe('第413首 教會基礎\nAH 348 The Church Has One Foundation');
    expect(output.wholeCongregation).toBe('會眾\nCongregation');
    expect(output.communionPastor).toBe('溫保羅牧師\nPastor Paul Wen');
    expect(output.missingPastor).toBe('尚未安排\nTBD');
    expect(output.footWashing).toBe('John 13:1–10; 12–17');
    expect(output.footWashingLookup).toBe('John 13:1–10; John 13:12–17');
    expect(output.passageDefinitions).toEqual({
      communion: {
        lookup: '1 Corinthians 11:23–26',
        english: '1 Corinthians 11:23–26',
        chinese: '哥林多前書 11:23–26',
      },
      footWashing: {
        lookup: 'John 13:1–10',
        english: 'John 13:1–10',
        chinese: '約翰福音 13:1–10',
      },
    });
    expect(output.instruction).toContain('brothers to the basement');
    expect(output.instruction).toContain('弟兄到地下室');
    expect(output.readings).toEqual([
      ['餅\nThe Bread', '1 Corinthians 11:24', '會眾\nCongregation'],
      ['杯\nThe Cup', '1 Corinthians 11:25', '會眾\nCongregation'],
      ['宣告\nThe Proclamation', '1 Corinthians 11:26', '會眾\nCongregation'],
    ]);
  });

  it.each([
    ['Queens', 'appendWorshipPanel_'],
    ['Brooklyn', 'appendBrooklynWorshipPanel_'],
  ])('leaves room under the %s silent prayer for the giving footer divider', (_name, panel) => {
    const renderWorshipEnding = (includeClosingRows: boolean) => {
      const calls: string[] = [];
      const context = loadAppsScript({});
      const record = (name: string) => () => {
        calls.push(name);
      };
      Object.assign(context, {
        appendPanelHeading_: record('heading'),
        appendCenteredText_: record('text'),
        appendHalfSpacer_: record('half spacer'),
        appendCompactItalicCenteredText_: record('italic text'),
        appendProgramTable_: record('table'),
        appendBrooklynProgramTable_: record('table'),
        appendSermonRow_: record('sermon'),
        appendSilentPrayerHeading_: record('silent prayer'),
        appendSpacer_: record('spacer'),
        printValue_: () => '',
        printBrooklynPerson_: () => '',
        formatHymnForPrint_: () => '',
        formatBibleReferenceForPrint_: () => '',
        formatPhysicalOfferingValue_: () => '',
        formatSermonTitleForPrint_: () => '',
      });
      runInContext(
        `${panel}({}, { queens: {}, brooklyn: {} }, ${includeClosingRows})`,
        context,
      );
      return calls.slice(calls.lastIndexOf('table'));
    };

    expect(renderWorshipEnding(true)).toEqual(['table', 'silent prayer', 'spacer', 'spacer']);
    // Communion worship panels have no closing rows and keep their layout.
    expect(renderWorshipEnding(false)).toEqual(['table']);
  });

  it('keeps the giving text in from the sheet edge without padding the QR cells', () => {
    const makeCell = () => {
      const cell = {
        padding: {} as Record<string, number>,
        clear: () => undefined,
        setVerticalAlignment: () => undefined,
        setPaddingTop: (value: number) => (cell.padding.top = value),
        setPaddingBottom: (value: number) => (cell.padding.bottom = value),
        setPaddingLeft: (value: number) => (cell.padding.left = value),
        setPaddingRight: (value: number) => (cell.padding.right = value),
      };
      return cell;
    };
    const cells = Array.from({ length: 5 }, makeCell);
    const container = {
      appendHorizontalRule: () => ({ getParent: () => null }),
      appendTable: () => ({
        setBorderWidth: () => undefined,
        setColumnWidth: () => undefined,
        getCell: (_row: number, column: number) => cells[column],
      }),
    };
    const context = loadAppsScript({
      DocumentApp: { VerticalAlignment: { TOP: 'TOP' }, ElementType: { PARAGRAPH: 'PARAGRAPH' } },
    });

    runInContext(
      `appendBookletFooter_(testContainer, function () {}, { qrColumns: true, qrCount: 3 })`,
      Object.assign(context, { testContainer: container }),
    );

    const [left, gutter, ...qr] = cells;
    expect(left.padding).toEqual({ top: 0, bottom: 0, left: 6, right: 6 });
    for (const cell of [gutter, ...qr]) {
      expect(cell.padding).toEqual({ top: 0, bottom: 0, left: 0, right: 0 });
    }
  });

  it('gives the Queens and Brooklyn giving dividers the same top spacing', () => {
    const footerOptions: Record<string, unknown> = {};
    const context = loadAppsScript({});
    Object.assign(context, {
      appendBookletPage_: (
        _body: unknown,
        _left: unknown,
        _right: unknown,
        _isFirstPage: boolean,
        footerRenderer?: unknown,
        options?: { ruleSpacingBefore?: number },
      ) => {
        if (footerRenderer) footerOptions[context.currentLocation as string] = options;
      },
      appendBrooklynEncouragementPage_: () => undefined,
    });

    Object.assign(context, { currentLocation: 'queens' });
    runInContext(`renderQueensRegularPrintedBulletinDocument_({}, {}, {}, 'regular')`, context);
    Object.assign(context, { currentLocation: 'brooklyn' });
    runInContext(`renderBrooklynPrintedBulletinDocument_({}, {}, {}, 'regular')`, context);

    expect(footerOptions).toEqual({
      queens: { ruleSpacingBefore: 4, qrColumns: true, qrCount: 3 },
      brooklyn: { ruleSpacingBefore: 4, qrColumns: true, qrCount: 3 },
    });
  });

  it('puts each Queens QR code in its own footer column and reuses leading paragraphs', () => {
    const calls: Array<[string, unknown, unknown]> = [];
    const footerOptions: unknown[] = [];
    const context = loadAppsScript({});
    Object.assign(context, {
      appendBookletPage_: (
        _body: unknown,
        _left: unknown,
        _right: unknown,
        _isFirstPage: boolean,
        footerRenderer?: (left: unknown, right: unknown, qrCells: unknown) => void,
        options?: unknown,
      ) => {
        if (!footerRenderer) return;
        footerOptions.push(options);
        footerRenderer('left cell', null, ['qr 1', 'qr 2', 'qr 3']);
      },
      appendGivingText_: (cell: unknown, options: unknown) => calls.push(['text', cell, options]),
      appendGivingQrPlaceholderCells_: (cells: unknown, options: unknown) =>
        calls.push(['qr', cells, options]),
    });

    runInContext(
      `renderQueensRegularPrintedBulletinDocument_({}, {}, {}, 'regular')`,
      context,
    );

    // A table nested in the right footer cell keeps a blank line above it,
    // which pushed the QR captions onto a new page.
    expect(footerOptions).toEqual([{ ruleSpacingBefore: 4, qrColumns: true, qrCount: 3 }]);
    expect(calls).toEqual([
      ['text', 'left cell', { reuseLeadingParagraph: true }],
      [
        'qr',
        ['qr 1', 'qr 2', 'qr 3'],
        { compact: true, location: 'queens', reuseLeadingParagraph: true },
      ],
    ]);
  });

  it('routes Queens regular, Communion, and Brooklyn output through separate renderers', () => {
    const calls: string[] = [];
    const body = {
      clear: () => undefined,
      setPageWidth: () => undefined,
      setPageHeight: () => undefined,
      setMarginTop: () => undefined,
      setMarginBottom: () => undefined,
      setMarginLeft: () => undefined,
      setMarginRight: () => undefined,
    };
    const context = loadAppsScript({
      DocumentApp: {},
    });
    Object.assign(context, {
      renderQueensRegularPrintedBulletinDocument_: () => calls.push('queens-regular'),
      renderCommunionPrintedBulletinDocument_: () => calls.push('communion'),
      renderBrooklynPrintedBulletinDocument_: () => calls.push('brooklyn'),
    });

    runInContext(
      `renderPrintedBulletinDocument_({ getBody: () => testBody }, {}, {}, 'regular', 'queens')`,
      Object.assign(context, { testBody: body }),
    );
    runInContext(
      `renderPrintedBulletinDocument_({ getBody: () => testBody }, {}, {}, 'communion', 'queens')`,
      Object.assign(context, { testBody: body }),
    );
    runInContext(
      `renderPrintedBulletinDocument_({ getBody: () => testBody }, {}, {}, 'regular', 'brooklyn')`,
      Object.assign(context, { testBody: body }),
    );

    expect(calls).toEqual(['queens-regular', 'communion', 'brooklyn']);
  });

  describe('page breaks between booklet spreads', () => {
    const documentApp = {
      ElementType: { PARAGRAPH: 'PARAGRAPH', TABLE: 'TABLE' },
      Attribute: {
        FONT_SIZE: 'FONT_SIZE',
        LINE_SPACING: 'LINE_SPACING',
        SPACING_BEFORE: 'SPACING_BEFORE',
        SPACING_AFTER: 'SPACING_AFTER',
      },
    };
    const compactAttributes = {
      FONT_SIZE: 1,
      LINE_SPACING: 1,
      SPACING_BEFORE: 0,
      SPACING_AFTER: 0,
    };
    const makeParagraph = (text: string, calls: string[], name: string) => {
      const paragraph = {
        getType: () => 'PARAGRAPH',
        getText: () => text,
        asParagraph: () => paragraph,
        attributes: undefined as unknown,
        appendPageBreak: () => {
          calls.push(`break in ${name}`);
          return { getParent: () => paragraph };
        },
        setAttributes: (attributes: unknown) => {
          paragraph.attributes = attributes;
        },
      };
      return paragraph;
    };

    it('puts the break in the empty paragraph after the last table and shrinks it', () => {
      const calls: string[] = [];
      const trailing = makeParagraph('', calls, 'trailing paragraph');
      const body = {
        getNumChildren: () => 2,
        getChild: (index: number) =>
          index === 1 ? trailing : { getType: () => 'TABLE' },
        appendPageBreak: () => {
          throw new Error('A trailing empty paragraph must be reused.');
        },
      };
      const context = loadAppsScript({ DocumentApp: documentApp });

      runInContext('appendCompactPageBreak_(testBody)', Object.assign(context, { testBody: body }));

      expect(calls).toEqual(['break in trailing paragraph']);
      expect(trailing.attributes).toEqual(compactAttributes);
    });

    it('appends a compact break paragraph when the body ends with text', () => {
      const calls: string[] = [];
      const appended = makeParagraph('', calls, 'appended paragraph');
      const body = {
        getNumChildren: () => 1,
        getChild: () => makeParagraph('Closing text', calls, 'text'),
        appendPageBreak: () => {
          calls.push('appended break');
          return { getParent: () => appended };
        },
      };
      const context = loadAppsScript({ DocumentApp: documentApp });

      runInContext('appendCompactPageBreak_(testBody)', Object.assign(context, { testBody: body }));

      expect(calls).toEqual(['appended break']);
      expect(appended.attributes).toEqual(compactAttributes);
    });
  });

  it('preserves full-width booklet panels beside the explicit fold gutter', () => {
    const columnWidths: Array<[number, number]> = [];
    const makeCell = () => ({
      clear: () => undefined,
      getNumChildren: () => 0,
      setPaddingBottom: () => undefined,
      setPaddingLeft: () => undefined,
      setPaddingRight: () => undefined,
      setPaddingTop: () => undefined,
      setVerticalAlignment: () => undefined,
    });
    const cells = [makeCell(), makeCell(), makeCell()];
    const table = {
      setBorderWidth: () => undefined,
      setColumnWidth: (column: number, width: number) => columnWidths.push([column, width]),
      getCell: (_row: number, column: number) => cells[column],
    };
    const body = {
      appendTable: (rows: string[][]) => {
        expect(rows).toEqual([['', '', '']]);
        return table;
      },
    };
    const context = loadAppsScript({});

    runInContext(
      `appendBookletPage_(testBody, function() {}, function() {}, true)`,
      Object.assign(context, { testBody: body }),
    );

    expect(columnWidths).toEqual([
      [0, 368],
      [1, 28],
      [2, 368],
    ]);
  });

  it('treats a trashed saved Google Doc as missing and clears both property keys', () => {
    const deletedKeys: string[] = [];
    const context = loadAppsScript({
      DriveApp: {
        getFileById: () => ({ isTrashed: () => true }),
      },
      DocumentApp: {
        openById: () => {
          throw new Error('A trashed document must not be opened.');
        },
      },
    });
    const result = runInContext(
      `tryOpenExistingPrintedBulletinDocument_(
        'trashed-id',
        { deleteProperty: (key) => deletedKeys.push(key) },
        'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-09-26',
        'PHYSICAL_BULLETIN_DOC_ID_2026-09-26',
        'queens'
      )`,
      Object.assign(context, { deletedKeys }),
    );

    expect(result).toBeNull();
    expect(deletedKeys).toEqual([
      'PHYSICAL_BULLETIN_DOC_ID_QUEENS_2026-09-26',
      'PHYSICAL_BULLETIN_DOC_ID_2026-09-26',
    ]);
  });

  it('defaults a blank date to the closest upcoming Saturday', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          friday: getDefaultPrintedBulletinDate_('2026-09-18'),
          saturday: getDefaultPrintedBulletinDate_('2026-09-19'),
          sunday: getDefaultPrintedBulletinDate_('2026-09-20')
        })`,
        context,
      ) as string,
    );

    expect(output).toEqual({
      friday: '2026-09-19',
      saturday: '2026-09-19',
      sunday: '2026-09-26',
    });
  });

  it('defaults to regular format when no communion remark is present', () => {
    const context = loadAppsScript({});
    const format = runInContext(
      `resolvePrintedBulletinFormat_('auto', { specialRemark: '' })`,
      context,
    );

    expect(format).toBe('regular');
  });

  it('uses location-specific output keys, folders, and short format titles', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          key: getPrintedBulletinPropertyKey_('PHYSICAL_BULLETIN_DOC_ID_', 'brooklyn', '2026-08-22'),
          regularTitle: getPrintedBulletinTitle_('brooklyn', '2026-08-22', 'regular'),
          communionTitle: getPrintedBulletinTitle_('queens', '2026-08-22', 'communion'),
          queensFolder: getPrintedBulletinOutputFolderId_('queens'),
          brooklynFolder: getPrintedBulletinOutputFolderId_('brooklyn')
        })`,
        context,
      ) as string,
    );

    expect(output.key).toBe('PHYSICAL_BULLETIN_DOC_ID_BROOKLYN_2026-08-22');
    expect(output.regularTitle).toBe('2026-08-22 Bulletin - Regular Worship');
    expect(output.communionTitle).toBe('2026-08-22 Bulletin - Holy Communion');
    expect(output.queensFolder).toBe('1S5Z2ls_ixCb2-ToTsU-T4ImJrf0vJ8Lu');
    expect(output.brooklynFolder).toBe('1C1L98At-T_a9Dyq7mo-ZPCj2FkHddx3J');
  });

  it('uses the shared three-location cover for Brooklyn bulletins', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `var calls = [];
         appendSharedCoverPanel_ = function(cell, bulletin, format, location) {
           calls.push({ cell: cell, date: bulletin.date, format: format, location: location });
         };
         appendBrooklynOnlineZoomPanel_ = function(cell) {
           calls.push({ online: cell });
         };
         renderPrintedBrooklynCoverPanel_('cover-cell', { date: '2026-09-26' }, 'regular');
         JSON.stringify(calls)`,
        context,
      ) as string,
    );

    expect(output).toEqual([
      { cell: 'cover-cell', date: '2026-09-26', format: 'regular', location: 'brooklyn' },
      { online: 'cover-cell' },
    ]);
  });

  it('prints the Sabbath School hymns, the lesson, and the special music piece', () => {
    const context = loadAppsScript({});
    const rows = JSON.parse(
      runInContext(
        `var captured = [];
         appendPanelHeading_ = appendCenteredText_ = appendBibleReadingPanel_ = function () {};
         appendHalfSpacer_ = appendCompactItalicCenteredText_ = function () {};
         appendProgramTable_ = appendBrooklynProgramTable_ = function (cell, rows) {
           captured = captured.concat(rows);
         };
         var location = {
           sabbathSchoolHymns: ['第413首 教會根基', 'Amazing Love'],
           specialMusicTitle: 'It Is Well',
           specialMusic: 'Ruoxi Tan',
           encouragement: 'Mei Chen',
           sabbathSchool: 'Haoran Du',
         };
         var bulletin = {
           queens: location,
           brooklyn: location,
           sabbathSchoolLesson: { english: 'Lesson 5: Revelation and Inspiration', chinese: '第5課 啟示與默示' },
         };
         appendStudyPanel_('study', bulletin);
         var queensStudy = captured;
         captured = [];
         appendBrooklynStudyPanel_('brooklyn-study', bulletin);
         var worship = [];
         appendSermonRow_ = function () {};
         appendProgramTable_ = function (cell, rows) { worship = worship.concat(rows); };
         appendWorshipPanel_('worship', bulletin, false);
         JSON.stringify({ study: queensStudy, brooklyn: captured, worship: worship })`,
        context,
      ) as string,
    );
    const row = (list: string[][], label: string) => list.find(([first]) => first.includes(label));

    // The Sabbath School in its order: the opening hymns one per line after
    // the opening prayer, and the closing hymns after the lesson, saying
    // they're the opening hymns again rather than listing them twice.
    const english = (list: string[][]) => list.map(([label]) => label.split('\n').pop());
    expect(english(rows.study)).toEqual([
      'SS Chair',
      'Opening Prayer',
      'Opening Hymns',
      'Lesson / Study',
      'Closing Hymns',
      'Closing Prayer',
    ]);
    expect(row(rows.study, 'Opening Hymns')).toEqual([
      '開會詩歌\nOpening Hymns',
      '1. 第413首 教會根基\nAH 348 The Church Has One Foundation\n2. Amazing Love',
      '會眾\nCongregation',
    ]);
    expect(row(rows.study, 'Closing Hymns')).toEqual([
      '結會詩歌\nClosing Hymns',
      '同開會詩歌\nSame as Opening Hymns',
      '會眾\nCongregation',
    ]);
    expect(row(rows.study, 'Lesson / Study')?.[1]).toBe('第5課 啟示與默示\nLesson 5: Revelation and Inspiration');
    expect(english(rows.brooklyn)).toEqual([
      'Song and Bible Verse',
      'Opening Hymns',
      'Prayer',
      'Sabbath Encouragement',
      'Sabbath School',
      'Closing Hymns',
      'Closing Prayer',
    ]);
    expect(row(rows.brooklyn, 'Opening Hymns')?.slice(0, 2)).toEqual([
      '開會唱詩\nOpening Hymns',
      '1. 第413首 教會根基\nAH 348 The Church Has One Foundation\n2. Amazing Love',
    ]);
    expect(row(rows.brooklyn, 'Closing Hymns')?.slice(0, 2)).toEqual([
      '合班唱詩\nClosing Hymns',
      '同開會唱詩\nSame as Opening Hymns',
    ]);
    expect(row(rows.brooklyn, '安息日學課')?.[1]).toBe('第5課 啟示與默示\nLesson 5: Revelation and Inspiration');
    // An English-only piece goes on the English line, beside "Special Music".
    expect(row(rows.worship, 'Special Music')?.slice(1)).toEqual(['—\nIt Is Well', 'Ruoxi Tan']);
  });

  it('carries the Weekly Data hymn cells into both printed Sabbath School rows', () => {
    const makeSheet = (name: string, rows: string[][]) => ({
      getName: () => name,
      getDataRange: () => ({ getValues: () => rows, getDisplayValues: () => rows }),
    });
    const context = loadAppsScript({ Logger: { log: () => undefined } });
    const scheduleHeaders = JSON.parse(
      runInContext(`JSON.stringify(BULLETIN_SHEET_COLUMNS['Sabbath Calendar'])`, context) as string,
    ) as string[];
    const weeklyHeaders = JSON.parse(
      runInContext(`JSON.stringify(BULLETIN_SHEET_COLUMNS['Weekly Data'])`, context) as string,
    ) as string[];
    const weeklyRow = (location: string, hymns: string[]) => {
      const row = weeklyHeaders.map(() => '');
      row[weeklyHeaders.indexOf('Date')] = '2026-11-07';
      row[weeklyHeaders.indexOf('Location')] = location;
      hymns.forEach((hymn, index) => {
        row[weeklyHeaders.indexOf(`Sabbath School Hymn ${index + 1}`)] = hymn;
      });
      return row;
    };
    (context as { SpreadsheetApp: unknown }).SpreadsheetApp = {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) =>
          ({
            'Sabbath Calendar': makeSheet(name, [scheduleHeaders, ['2026-11-07', ...Array(scheduleHeaders.length - 1).fill('')]]),
            'Weekly Data': makeSheet(name, [
              weeklyHeaders,
              weeklyRow('Queens', ['第413首 教會根基', '', 'AH 73 Holy, Holy, Holy']),
              weeklyRow('Brooklyn', ['205']),
            ]),
          } as Record<string, unknown>)[name] ?? null,
      }),
    };

    const rows = JSON.parse(
      runInContext(
        `var captured = [];
         appendPanelHeading_ = appendCenteredText_ = appendBibleReadingPanel_ = function () {};
         appendHalfSpacer_ = appendCompactItalicCenteredText_ = function () {};
         appendProgramTable_ = appendBrooklynProgramTable_ = function (cell, rows) {
           captured = captured.concat(rows);
         };
         // As the Create Word Doc dialog builds it.
         var bulletin = preparePrintedBulletinForPrint_(
           buildBulletin_('2026-11-07', { includeFullNames: true }),
           {},
         );
         appendStudyPanel_('study', bulletin);
         appendBrooklynStudyPanel_('brooklyn-study', bulletin);
         JSON.stringify(captured)`,
        context,
      ) as string,
    ) as string[][];
    const row = (label: string) => rows.find(([first]) => first.includes(label))?.[1];

    // Queens: in order, without the blank middle cell.
    // AH 73 Holy, Holy, Holy is 505 #2, 聖哉真神.
    expect(row('開會詩歌')).toBe('1. 第413首 教會根基\nAH 348 The Church Has One Foundation\n2. 第2首 聖哉真神\nAH 73 Holy, Holy, Holy');
    // Brooklyn: a bare number is a Chinese hymnal number. With one hymn, the
    // rows say Hymn, not Hymns.
    expect(row('開會唱詩')).toBe('第205首\nAH 206 Face to Face');
    expect(rows.find(([first]) => first.includes('合班唱詩'))?.slice(0, 2)).toEqual([
      '合班唱詩\nClosing Hymn',
      '同開會唱詩\nSame as Opening Hymn',
    ]);
  });

  it('merges adjacent Brooklyn Sabbath School rows with the same assignment', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify(mergeBrooklynStudyRowsByAssignment_([
          ['Welcome', '', 'Ruoxi Tan'],
          ['Song and Bible Verse', '', 'Ruoxi Tan'],
          ['Opening Hymn', '', 'Congregation'],
          ['Prayer', '', 'Ruoxi Tan'],
          ['Sabbath Message', 'Grace Upon Grace', 'Ruoxi Tan'],
          ['Sabbath School', '', 'Haoran Du']
        ]))`,
        context,
      ) as string,
    );

    expect(output).toEqual([
      ['Song and Bible Verse', '', 'Ruoxi Tan'],
      ['Opening Hymn', '', 'Congregation'],
      ['Prayer\nSabbath Message', 'Grace Upon Grace', 'Ruoxi Tan'],
      ['Sabbath School', '', 'Haoran Du'],
    ]);
  });

  it('selects the church sketch for regular covers and Last Supper for communion', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });
    const imageIds = JSON.parse(
      runInContext(
        `JSON.stringify({
          regular: getPrintedBulletinImageFileId_('churchSketch'),
          communion: getPrintedBulletinImageFileId_('lastSupper')
        })`,
        context,
      ) as string,
    );

    expect(imageIds.regular).toBe('1ZmxAI0l-689nnz5l1pEtmpNTDquA8_No');
    expect(imageIds.communion).toBe('1ZGPxK1cidxies9jAguiAIPVlk9Vqk-Kd');
  });

  it('keeps regular covers large while constraining Communion covers', () => {
    const context = loadAppsScript({});
    const widths = JSON.parse(
      runInContext(
        `JSON.stringify({
          regular: PRINTED_BULLETIN_CONFIG.regularCoverImageMaxWidth,
          communion: PRINTED_BULLETIN_CONFIG.communionCoverImageMaxWidth
        })`,
        context,
      ) as string,
    );

    expect(widths).toEqual({ regular: 460, communion: 320 });
  });

  it('defaults physical output to the configured Queens Drive folder', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });

    const folderId = runInContext(`getPrintedBulletinOutputFolderId_()`, context);

    expect(folderId).toBe('1S5Z2ls_ixCb2-ToTsU-T4ImJrf0vJ8Lu');
  });

  it('looks up either name direction and leaves an unmatched language alone', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          english: formatPhysicalPersonValue_('Yuting Chen', {
            englishToChinese: { 'yuting chen': '陳雨婷' },
            chineseToEnglish: { '陳雨婷': 'Yuting Chen' },
            pinyinToChinese: {},
            pinyinToEnglish: {}
          }),
          chinese: formatPhysicalPersonValue_('陳雨婷', {
            englishToChinese: { 'yuting chen': '陳雨婷' },
            chineseToEnglish: { '陳雨婷': 'Yuting Chen' },
            pinyinToChinese: {},
            pinyinToEnglish: {}
          }),
          pinyin: formatPhysicalPersonValue_('givenname familyname', {
            englishToChinese: {},
            chineseToEnglish: {},
            pinyinToChinese: { 'givenname familyname': '中文姓名' },
            pinyinToEnglish: { 'givenname familyname': 'Official Person' }
          }),
          unmatchedEnglish: formatPhysicalPersonValue_('Unknown Person', {
            englishToChinese: {}, chineseToEnglish: {}
          }),
          unmatchedChinese: formatPhysicalPersonValue_('未知姓名', {
            englishToChinese: {}, chineseToEnglish: {}
          }),
          tbd: formatPhysicalPersonValue_('TBD', {
            englishToChinese: {}, chineseToEnglish: {}
          })
        })`,
        context,
      ) as string,
    );

    expect(output.english).toBe('陳雨婷\nYuting Chen');
    expect(output.chinese).toBe('陳雨婷\nYuting Chen');
    expect(output.pinyin).toBe('中文姓名\nOfficial Person');
    expect(output.unmatchedEnglish).toBe('—\nUnknown Person');
    expect(output.unmatchedChinese).toBe('未知姓名\n—');
    expect(output.tbd).toBe('尚未安排\nTBD');
  });

  it('derives pinyin aliases from the Chinese Name column', () => {
    const dictionarySheet = {
      getDataRange: () => ({
        getValues: () => [
          ['English Name', 'Chinese Name'],
          ['Yuting Chen', '陳雨婷'],
          ['English Only', ''],
          ['', '只有中文'],
          ['Official Person', '中文姓名'],
        ],
        getDisplayValues: () => [
          ['English Name', 'Chinese Name'],
          ['Yuting Chen', '陳雨婷'],
          ['English Only', ''],
          ['', '只有中文'],
          ['Official Person', '中文姓名'],
        ],
      }),
    };
    const spreadsheet = {
      getSheetByName: (name: string) => (name === 'Name Dictionary' ? dictionarySheet : null),
    };
    const context = loadAppsScript({
      pinyinPro: {
        pinyin: (value: string) => (value === '中文姓名' ? ['zhong', 'wen'] : []),
      },
      SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
      Logger: { log: () => undefined },
    });
    const dictionary = JSON.parse(
      runInContext(`JSON.stringify(buildPhysicalNameDictionary_())`, context) as string,
    );

    expect(dictionary.englishToChinese['yuting chen']).toBe('陳雨婷');
    expect(dictionary.chineseToEnglish['陳雨婷']).toBe('Yuting Chen');
    expect(dictionary.pinyinToChinese['wen zhong']).toBe('中文姓名');
    expect(dictionary.pinyinToEnglish['wen zhong']).toBe('Official Person');
    expect(dictionary.englishToChinese['english only']).toBeUndefined();
    expect(dictionary.chineseToEnglish['只有中文']).toBeUndefined();
  });

  it('reads Pastor and Elder titles from the Leadership tab', () => {
    const nameDictionaryRows = [
      ['English Name', 'Chinese Name'],
      ['Paul Wen', '溫保羅'],
      ['Wei He', '何　偉'],
      ['Mark Sun', '孫馬可'],
      ['Grace Lin', '林恩典'],
      ['Elderidge Moss', '莫艾德'],
    ];
    const loadDictionary = (leadershipRows: string[][] | null, withNameDictionary = true) => {
      const logs: string[] = [];
      const sheetFor = (rows: string[][]) => ({
        getDataRange: () => ({ getValues: () => rows, getDisplayValues: () => rows }),
      });
      const sheets: Record<string, unknown> = {};
      if (withNameDictionary) {
        sheets['Name Dictionary'] = sheetFor(nameDictionaryRows);
      }
      if (leadershipRows) {
        sheets.Leadership = sheetFor(leadershipRows);
      }
      const context = loadAppsScript({
        SpreadsheetApp: {
          getActiveSpreadsheet: () => ({ getSheetByName: (name: string) => sheets[name] || null }),
        },
        Logger: { log: (message: string) => logs.push(message) },
      });
      const output = JSON.parse(
        runInContext(
          `var dictionary = buildPhysicalNameDictionary_();
          JSON.stringify({
            dictionary: dictionary,
            paddedChinese: formatPhysicalPersonValue_('何偉', dictionary, { titles: true }),
            communionPastor: preparePrintedBulletinForPrint_(
              { queens: {}, brooklyn: {} },
              dictionary
            ).communionPastor
          })`,
          context,
        ) as string,
      );
      return { ...output, logs };
    };

    const output = loadDictionary([
      ['', 'Pastors 牧師', 'Elder(s)'],
      ['', 'Pastor Paul Wen', '何偉長老'],
      ['Head', '牧师 林恩典', 'Elder: Mark Sun'],
      ['', '', '溫保羅'],
      ['', '', 'Elderidge Moss'],
    ]);
    const { dictionary } = output;

    // A title typed before or after a name is dropped, but a name that merely
    // starts with a title's letters is kept; the lists keep sheet order.
    expect(dictionary.titledNames).toEqual({
      pastor: ['Paul Wen', '林恩典'],
      elder: ['何偉', 'Mark Sun', '溫保羅', 'Elderidge Moss'],
    });
    expect(dictionary.heads).toEqual({ pastor: '林恩典', elder: 'Mark Sun' });
    // Each list entry titles both of the person's names, and a person on both
    // lists stays Pastor even when the lists use different languages.
    expect(dictionary.titles['paul wen']).toEqual({ english: 'Pastor', chinese: '牧師' });
    expect(dictionary.titles['溫保羅']).toEqual({ english: 'Pastor', chinese: '牧師' });
    expect(dictionary.titles['grace lin']).toEqual({ english: 'Pastor', chinese: '牧師' });
    expect(dictionary.titles['wei he']).toEqual({ english: 'Elder', chinese: '長老' });
    expect(dictionary.titles['mark sun']).toEqual({ english: 'Elder', chinese: '長老' });
    expect(dictionary.titles.head).toBeUndefined();
    // A padded two-character name matches with or without the padding.
    expect(dictionary.chineseToEnglish['何偉']).toBe('Wei He');
    expect(output.paddedChinese).toBe('何偉長老\nElder Wei He');
    // The Head row's pastor leads Communion, wherever the row is.
    expect(output.communionPastor).toBe('林恩典牧師\nPastor Grace Lin');
    expect(output.logs).toEqual([]);

    // Without a Head row, the first pastor leads Communion.
    const noHead = loadDictionary([
      ['', 'Pastors', 'Elders'],
      ['', 'Paul Wen', 'Mark Sun'],
      ['', 'Grace Lin', ''],
    ]);
    expect(noHead.communionPastor).toBe('溫保羅牧師\nPastor Paul Wen');

    const noElders = loadDictionary([['Pastor Travel'], ['Paul Wen']]);
    expect(noElders.dictionary.titles).toEqual({});
    expect(noElders.communionPastor).toBe('');
    expect(noElders.logs).toEqual([
      'Leadership has no Pastors column; printing without that title.',
      'Leadership has no Elders column; printing without that title.',
    ]);

    const noLeadership = loadDictionary(null);
    expect(noLeadership.dictionary.titles).toEqual({});
    expect(noLeadership.dictionary.englishToChinese['paul wen']).toBe('溫保羅');
    expect(noLeadership.logs).toEqual([
      'Leadership sheet not found; printing names without titles.',
    ]);

    // The Leadership tab still applies without a Name Dictionary.
    const noNameDictionary = loadDictionary(
      [['Head', 'Pastors'], ['Head', 'Paul Wen']],
      false,
    );
    expect(noNameDictionary.communionPastor).toBe('—\nPastor Paul Wen');
    expect(noNameDictionary.logs).toEqual([
      'Name Dictionary sheet not found; printing source names only.',
      'Leadership has no Elders column; printing without that title.',
    ]);
  });

  it('adds Leadership titles in either language without hardcoded names', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `var dictionary = {
          englishToChinese: { 'paul wen': '溫　保羅', 'ruth ho': '何路得', 'grace lin': '林恩典' },
          chineseToEnglish: { '溫保羅': 'Paul Wen', '何路得': 'Ruth Ho', '林恩典': 'Grace Lin' },
          pinyinToChinese: { 'he lude': '何路得' },
          pinyinToEnglish: { 'he lude': 'Ruth Ho' },
          titles: {
            'paul wen': { english: 'Pastor', chinese: '牧師' },
            '林恩典': { english: 'Pastor', chinese: '牧師' },
            'ruth ho': { english: 'Elder', chinese: '長老' },
            'mark sun': { english: 'Elder', chinese: '長老' }
          },
          titledNames: { pastor: ['Paul Wen', '林恩典'], elder: ['Ruth Ho', 'Mark Sun'] }
        };
        JSON.stringify({
          english: formatPhysicalPersonValue_('Paul Wen', dictionary, { titles: true }),
          chinese: formatPhysicalPersonValue_('溫 保羅', dictionary, { titles: true }),
          listedInChinese: formatPhysicalPersonValue_('Grace Lin', dictionary, { titles: true }),
          pinyin: formatPhysicalPersonValue_('he lude', dictionary, { titles: true }),
          notInDictionary: formatPhysicalPersonValue_('Mark Sun', dictionary, { titles: true }),
          pair: formatPhysicalPersonValue_('Ruth Ho / Unknown Person', dictionary, { titles: true }),
          untitled: formatPhysicalPersonValue_('Paul Wen', dictionary),
          prepared: preparePrintedBulletinForPrint_(
            { queens: { sermon: 'Paul Wen', pianist: 'Ruth Ho' }, brooklyn: { chair: 'Grace Lin' } },
            dictionary
          ),
          noPastors: preparePrintedBulletinForPrint_(
            { queens: {}, brooklyn: {} },
            { englishToChinese: {}, chineseToEnglish: {} }
          ).communionPastor
        })`,
        context,
      ) as string,
    );

    expect(output.english).toBe('溫保羅牧師\nPastor Paul Wen');
    expect(output.chinese).toBe('溫保羅牧師\nPastor Paul Wen');
    expect(output.listedInChinese).toBe('林恩典牧師\nPastor Grace Lin');
    expect(output.pinyin).toBe('何路得長老\nElder Ruth Ho');
    expect(output.notInDictionary).toBe('—\nElder Mark Sun');
    expect(output.pair).toBe('何路得長老\nElder Ruth Ho / —\nUnknown Person');
    expect(output.untitled).toBe('溫　保羅\nPaul Wen');
    expect(output.prepared.queens.sermon).toBe('溫保羅牧師\nPastor Paul Wen');
    expect(output.prepared.queens.rosterNames).toEqual({
      sermon: '溫　保羅\nPaul Wen',
      pianist: '何路得\nRuth Ho',
    });
    expect(output.prepared.brooklyn.chair).toBe('林恩典牧師\nPastor Grace Lin');
    expect(output.prepared.communionPastor).toBe('溫保羅牧師\nPastor Paul Wen');
    expect(output.noPastors).toBe('');
  });

  it('keeps the roster grid on plain names while other rows show titles', () => {
    const tables: string[][][] = [];
    const context = loadAppsScript({
      capturedTables: tables,
      DocumentApp: { HorizontalAlignment: { LEFT: 'left', CENTER: 'center' } },
    });
    runInContext(
      `appendDataTable_ = function (cell, rows) { capturedTables.push(rows); };
      appendHorizontalScheduleTable_({}, {
        sermon: '溫保羅牧師\\nPastor Paul Wen',
        sunsetTime: '6:12 PM',
        rosterNames: { sermon: '溫　保羅\\nPaul Wen' }
      }, null, [
        [printedBilingualText_('Sermon', '崇拜證道'), function (location) { return location.sermon; }],
        [printedBilingualText_('Sunset Times', '日落時間'), function (location) { return location.sunsetTime; }]
      ])`,
      context,
    );

    expect(tables[0][1].slice(3, 5)).toEqual(['Paul Wen', '溫　保羅']);
    expect(tables[0][2][3]).toBe('6:12 PM');
  });

  it("prints each roster grid label on one line, with the pastor's four-character Chinese labels", () => {
    type RosterTable = {
      rows: string[][];
      options: { columnWidths: number[]; paddingLeft: number; paddingRight: number };
    };
    const tables: RosterTable[] = [];
    const context = loadAppsScript({
      capturedTables: tables,
      DocumentApp: { HorizontalAlignment: { LEFT: 'left', CENTER: 'center' } },
    });
    runInContext(
      `appendDataTable_ = function (cell, rows, options) {
        capturedTables.push({ rows: rows, options: options });
      };
      appendCenteredText_ = function () {};
      appendPrintedAnnouncementsTable_ = function () {};
      appendScheduleTable_({}, { queens: {} }, null);
      appendBrooklynMeetingsPanel_({}, { brooklyn: {} }, null);`,
      context,
    );
    const [queens, brooklyn] = tables;

    // The Queens grid prints in Regular and Communion bulletins alike, in the
    // pastor's order: Offerings before Flower Offering.
    expect(queens.rows.slice(1).map((row) => [row[1], row[2]])).toEqual([
      ['SS Pianist', '學課･司琴'],
      ['SS Teacher E.', '英文教師'],
      ['SS Teacher C.', '中文教師'],
      ['DS Chair', '崇拜･主席'],
      ['DS Pianist', '崇拜･司琴'],
      ['Offering Prayer', '奉獻祈禱'],
      ['DS Sermon', '崇拜･證道'],
      ['DS Interpreter', '崇拜･翻譯'],
      ['Special Music', '特別音樂'],
      ['Offerings', '奉獻事項'],
      ['Flower Offering', '鮮花奉獻'],
      ['Sunset Times', '日落時間'],
    ]);
    expect(brooklyn.rows.slice(1).map((row) => row[2])).toEqual([
      '主席',
      '技術同工',
      '勉勵',
      '奉獻祈禱',
      '安息日學',
      '崇拜･證道',
      '日落時間',
    ]);

    const { columnWidths, paddingLeft, paddingRight } = queens.options;
    expect(brooklyn.options.columnWidths).toEqual(columnWidths);
    const room = (column: number) => columnWidths[column] - paddingLeft - paddingRight;

    // The grid is no wider than the announcements table above it, which
    // prints in the same panel every week.
    const announcementWidths: number[] = [];
    const announcementCell = {
      clear: () => undefined,
      setPaddingTop: () => undefined,
      setPaddingBottom: () => undefined,
      setPaddingLeft: () => undefined,
      setPaddingRight: () => undefined,
      setVerticalAlignment: () => undefined,
    };
    const announcementContext = loadAppsScript({
      DocumentApp: { VerticalAlignment: { TOP: 'top' } },
    });
    Object.assign(announcementContext, {
      appendPrintedAnnouncementTableCell_: () => undefined,
      testPanel: {
        appendTable: () => ({
          setBorderWidth: () => undefined,
          setColumnWidth: (column: number, width: number) => {
            announcementWidths[column] = width;
          },
          getRow: () => ({ getCell: () => announcementCell }),
        }),
      },
    });
    runInContext(
      `appendPrintedAnnouncementsTable_(testPanel, [{ english: 'Potluck after worship.', chinese: '崇拜後聚餐。' }])`,
      announcementContext,
    );
    const sum = (widths: number[]) => widths.reduce((total, width) => total + width, 0);
    expect(sum(announcementWidths)).toBe(360);
    expect(sum(columnWidths)).toBeLessThanOrEqual(sum(announcementWidths));

    // Times New Roman advance widths in 2048ths of an em, for the characters
    // the English labels use (Liberation Serif has the same widths).
    const timesWidths: Record<string, number> = {
      ' ': 512, '-': 682, '.': 512, C: 1366, D: 1479, E: 1251, F: 1139, G: 1479, I: 682,
      M: 1821, O: 1479, P: 1139, S: 1139, T: 1251, a: 909, b: 1024, c: 909, e: 909, f: 682,
      g: 1024, h: 1024, i: 569, l: 569, m: 1593, n: 1024, o: 1024, p: 1024, r: 682, s: 797,
      t: 569, u: 1024, w: 1479, y: 1024,
    };
    const timesWidth = (text: string) =>
      [...text].reduce((total, character) => {
        expect(timesWidths[character]).toBeDefined();
        return total + (timesWidths[character] / 2048) * 10;
      }, 0);
    // Each English role label fits its column with 1.5 points to spare.
    // "Flower Offering", the widest, is 65.3 points.
    for (const table of [queens, brooklyn]) {
      for (const row of table.rows.slice(1)) {
        expect(timesWidth(row[1])).toBeLessThanOrEqual(room(1) - 1.5);
      }
    }

    // At 10 points each UoqMunThenKhung character is 10 points wide and its
    // half-width dot (U+FF65) is 5. Each character has to be in the font, or
    // it prints in the fallback.
    const chineseWidth = (label: string) =>
      [...label].reduce((sum, character) => {
        expect(
          runInContext(
            `isPrintedCharacterInDefaultChineseFont_(${character.charCodeAt(0)})`,
            context,
          ),
        ).toBe(true);
        return sum + (character === '･' ? 5 : 10);
      }, 0);
    for (const table of [queens, brooklyn]) {
      for (const row of table.rows) {
        expect(chineseWidth(row[2])).toBeLessThanOrEqual(room(2));
      }
    }
    // The Chinese name columns hold 尚未安排 (TBD), 40 points.
    expect(room(4)).toBeGreaterThanOrEqual(40);
    expect(room(6)).toBeGreaterThanOrEqual(40);
    // Docs won't break "Sacrifice-Global" (66.1 points) at the hyphen. Both
    // English name columns hold it with 1.5 points to spare.
    expect(timesWidth('Sacrifice-Global')).toBeLessThanOrEqual(room(3) - 1.5);
    expect(timesWidth('Sacrifice-Global')).toBeLessThanOrEqual(room(5) - 1.5);
  });

  it('keeps bilingual labels and content in the physical output helpers', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          label: printedBilingualText_('Hymn of Praise', '讚美詩'),
          hymn: formatHymnForPrint_({ english: '100 - Great Is Thy Faithfulness', chinese: '100 - 祢的信實廣大' }),
          date: formatDateForPrint_('2026-08-22')
        })`,
        context,
      ) as string,
    );

    expect(output.label).toBe('讚美詩\nHymn of Praise');
    expect(output.hymn).toBe('100 - 祢的信實廣大\n100 - Great Is Thy Faithfulness');
    expect(output.date).toBe('August 22, 2026\n2026年8月22日');
  });

  it('fills only a missing hymn side, with its number and title, from the lookup', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          englishOnly: formatHymnForPrint_({ english: 'AH 348 The Church Has One Foundation', chinese: '' }),
          chineseOnly: formatHymnForPrint_({ english: '', chinese: '第413首 教會根基' }),
          both: formatHymnForPrint_({ english: 'AH 348 The Church Has One Foundation', chinese: '第413首 教會根基' }),
          bareNumber: formatHymnForPrint_({ english: '', chinese: '413' }),
          englishNoTwin: formatHymnForPrint_({ english: 'Amazing Love', chinese: '' }),
          chineseNoTwin: formatHymnForPrint_({ english: '', chinese: '還要等多久' }),
          sermonEnglish: formatSermonTitleForPrint_({ sermonTitle: { english: 'The Good Shepherd', chinese: '' } }),
          sermonChinese: formatSermonTitleForPrint_({ sermonTitle: { english: '', chinese: '好牧人' } }),
          sermonBoth: formatSermonTitleForPrint_({ sermonTitle: { english: 'The Good Shepherd', chinese: '好牧人' } }),
          specialMusicTbd: printedOneLanguageText_('TBD'),
        })`,
        context,
      ) as string,
    );

    // A title in one language goes on that language's line, Chinese first,
    // and "—" holds the other, as in the offering and name cells.
    expect(output.englishNoTwin).toBe('—\nAmazing Love');
    expect(output.chineseNoTwin).toBe('還要等多久\n—');
    expect(output.sermonEnglish).toBe('—\nThe Good Shepherd');
    expect(output.sermonChinese).toBe('好牧人\n—');
    expect(output.sermonBoth).toBe('好牧人\nThe Good Shepherd');
    expect(output.specialMusicTbd).toBe('尚未確定\nTBD');
    // The app's title for 505 #413 is 教會基礎; a typed title prints as typed.
    expect(output.bareNumber).toBe('第413首\nAH 348 The Church Has One Foundation');
    expect(output.englishOnly).toBe('第413首 教會基礎\nAH 348 The Church Has One Foundation');
    expect(output.chineseOnly).toBe('第413首 教會根基\nAH 348 The Church Has One Foundation');
    expect(output.both).toBe('第413首 教會根基\nAH 348 The Church Has One Foundation');
  });

  it('prints each Sabbath School hymn Chinese first and numbered, filling the other language by number', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          mixed: formatSabbathSchoolHymnsForPrint_([
            '第413首 教會根基',
            '',
            'AH 348 The Church Has One Foundation',
            '413',
            '還要等多久',
          ]),
          englishOnly: formatSabbathSchoolHymnsForPrint_(['Amazing Love']),
          chineseOnly: formatSabbathSchoolHymnsForPrint_(['還要等多久']),
          blank: formatSabbathSchoolHymnsForPrint_(['', '  ']),
          missing: formatSabbathSchoolHymnsForPrint_(undefined),
          noHymnRows: getPrintedSabbathSchoolHymnRows_([], '開會詩歌', '結會詩歌'),
        })`,
        context,
      ) as string,
    );

    // Chinese first, as in every other row, and numbered, so a hymn's two
    // lines read as one hymn and 還要等多久 isn't taken for a translation.
    expect(output.mixed).toBe(
      [
        '1. 第413首 教會根基\nAH 348 The Church Has One Foundation',
        '2. 第413首 教會基礎\nAH 348 The Church Has One Foundation',
        '3. 第413首\nAH 348 The Church Has One Foundation',
        '4. 還要等多久',
      ].join(
        '\n',
      ),
    );
    // One hymn isn't numbered, and one language goes on its own line, beside
    // the label in that language.
    expect(output.englishOnly).toBe('—\nAmazing Love');
    expect(output.chineseOnly).toBe('還要等多久\n—');
    expect(output.blank).toBe('尚未確定\nTBD');
    expect(output.missing).toBe('尚未確定\nTBD');
    // With no hymns, both rows say TBD rather than "the same as" nothing.
    expect(output.noHymnRows.opening.slice(0, 2)).toEqual(['開會詩歌\nOpening Hymn', '尚未確定\nTBD']);
    expect(output.noHymnRows.closing.slice(0, 2)).toEqual(['結會詩歌\nClosing Hymn', '尚未確定\nTBD']);
  });

  it("looks up the lesson the class discusses: the week that ends the day before", () => {
    const requested: string[] = [];
    const catalogs: Record<string, unknown> = {
      'https://sabbath-school.adventech.io/api/v2/en/quarterlies/2026-04/index.json': {
        lessons: [
          { id: '05', title: 'Revelation and Inspiration', start_date: '24/10/2026', end_date: '30/10/2026' },
          { id: '06', title: 'The Prophetic Writings', start_date: '31/10/2026', end_date: '06/11/2026' },
        ],
      },
      'https://sabbath-school.adventech.io/api/v2/zh/quarterlies/2026-04-hant/index.json': {
        lessons: [
          { id: '05', title: '啟示與默示', start_date: '24/10/2026', end_date: '30/10/2026' },
          { id: '06', title: '先知的著作', start_date: '31/10/2026', end_date: '06/11/2026' },
        ],
      },
    };
    const context = loadAppsScript({
      Logger: { log: () => undefined },
      UrlFetchApp: {
        fetch: (url: string) => {
          requested.push(url);
          if (url.includes('2026-03')) throw new Error('Offline');
          return {
            getResponseCode: () => (catalogs[url] ? 200 : 404),
            getContentText: () => JSON.stringify(catalogs[url] || {}),
          };
        },
      },
    });
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          lesson: getPhysicalSabbathSchoolLesson_('2026-10-31'),
          printed: formatSabbathSchoolLessonForPrint_(getPhysicalSabbathSchoolLesson_('2026-10-31')),
          // The first Sabbath of a quarter discusses the last lesson of the one before.
          quarterStart: getPhysicalSabbathSchoolLesson_('2026-09-26'),
          unavailable: formatSabbathSchoolLessonForPrint_(getPhysicalSabbathSchoolLesson_('2026-09-26')),
        })`,
        context,
      ) as string,
    );

    expect(output.lesson).toEqual({
      english: 'Lesson 5: Revelation and Inspiration',
      chinese: '第5課 啟示與默示',
    });
    expect(output.printed).toBe('第5課 啟示與默示\nLesson 5: Revelation and Inspiration');
    expect(output.quarterStart).toEqual({ english: '', chinese: '' });
    expect(output.unavailable).toBe('尚未確定\nTBD');
    expect(requested).toContain('https://sabbath-school.adventech.io/api/v2/en/quarterlies/2026-03/index.json');
    expect(requested).toContain('https://sabbath-school.adventech.io/api/v2/zh/quarterlies/2026-03-hant/index.json');
  });

  it('uses the app status labels for physical TBD content', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          generic: printValue_('TBD'),
          person: formatPhysicalPersonValue_('TBD', {
            englishToChinese: {}, chineseToEnglish: {}
          })
        })`,
        context,
      ) as string,
    );

    expect(output.generic).toBe('尚未確定\nTBD');
    expect(output.person).toBe('尚未安排\nTBD');
  });

  it('parses the form scripture reference for both HelloAO translations', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          standard: parsePhysicalBibleReferences_('1 Corinthians 11:23–26'),
          colon: parsePhysicalBibleReferences_('Jeremiah:29:11-15'),
          labels: formatPhysicalBibleReferenceLabels_({ bibleVerses: 'Jeremiah:29:11-15' }),
          worshipReference: formatBibleReferenceForPrint_({ bibleVerses: 'John 3:14-17' }),
          warning: getPhysicalBibleReferenceWarning_('Jeremiah:29:11-19'),
          fiveVerseWarning: getPhysicalBibleReferenceWarning_('Jeremiah:29:11-15'),
          shortWarning: getPhysicalBibleReferenceWarning_('John 12:24')
        })`,
        context,
      ) as string,
    );

    expect(output.standard).toEqual([
      { bookId: '1CO', chapter: 11, verseStart: 23, verseEnd: 26 },
    ]);
    expect(output.colon).toEqual([
      { bookId: 'JER', chapter: 29, verseStart: 11, verseEnd: 15 },
    ]);
    expect(output.labels).toEqual({
      english: 'Jeremiah 29:11–15 (BSB)',
      chinese: '耶利米書 29:11–15（和合本）',
    });
    expect(output.worshipReference).toBe('約翰福音 3:14–17（和合本）\nJohn 3:14–17 (BSB)');
    expect(output.warning).toContain('approximately 9 verses');
    expect(output.fiveVerseWarning).toBe('');
    expect(output.shortWarning).toBe('');
  });

  it('does not repeat the long-verse warning after confirmation', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify(getPrintedBulletinPromptWarning('Jeremiah 29:11-15', true))`,
        context,
      ) as string,
    );

    expect(output).toEqual({ requiresConfirmation: false });
  });

  it('preflights the fetched English text length before warning', () => {
    const longVerse = Array(100).fill('word').join(' ');
    const context = loadAppsScript({
      CacheService: {
        getScriptCache: () => ({ get: () => null, put: () => undefined }),
      },
      UrlFetchApp: {
        fetch: () => ({
          getResponseCode: () => 200,
          getContentText: () =>
            JSON.stringify({
              chapter: {
                content: [
                  { type: 'verse', number: 1, text: longVerse },
                  { type: 'verse', number: 2, text: longVerse },
                ],
              },
            }),
        }),
      },
      Logger: { log: () => undefined },
    });

    const output = JSON.parse(
      runInContext(
        `JSON.stringify(getPrintedBulletinPromptWarning('John 12:1-2', false, { englishTranslation: 'BSB' }))`,
        context,
      ) as string,
    );

    expect(output.requiresConfirmation).toBe(true);
    expect(output.warning).toContain('approximately 200 English words');
    expect(output.warningChinese).toContain('200 个英文单词');
  });

  it('formats Bible labels using the selected HelloAO translations', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify(formatPhysicalBibleReferenceLabels_({ bibleVerses: 'John 12:24' }, { englishTranslation: 'eng_kjv', chineseTranslation: 'cmn_cuv' }))`,
        context,
      ) as string,
    );

    expect(output).toEqual({
      english: 'John 12:24 (KJV)',
      chinese: '約翰福音 12:24（和合本）',
    });
  });

  it('keeps offering text aligned when one language is unavailable', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({ english: formatPhysicalOfferingValue_('Local Church'), chinese: formatPhysicalOfferingValue_('本地教會') })`,
        context,
      ) as string,
    );

    expect(output.english).toBe('—\nLocal Church');
    expect(output.chinese).toBe('本地教會\n—');
  });

  it('translates only English-only offering text to Traditional Chinese', () => {
    const context = loadAppsScript({
      LanguageApp: {
        translate: (text: string, source: string, target: string) => {
          expect(source).toBe('en');
          expect(target).toBe('zh-TW');
          return '本地教會';
        },
      },
    });
    const translated = runInContext(
      `formatPhysicalOfferingValue_('Local Church')`,
      context,
    );

    expect(translated).toBe('本地教會\nLocal Church');
  });

  it('gets sunset times from the Sunrise-Sunset API', () => {
    const urls: string[] = [];
    const context = loadAppsScript({
      UrlFetchApp: {
        fetch: (url: string) => {
          urls.push(url);
          return {
            getResponseCode: () => 200,
            getContentText: () =>
              JSON.stringify({
                status: 'OK',
                results: { sunset: '2026-08-22T23:22:00+00:00' },
              }),
          };
        },
      },
      Utilities: {
        formatDate: () => '7:22 PM',
      },
      Logger: { log: () => undefined },
    });

    const sunset = runInContext(`getPhysicalSunsetTime_('2026-08-22')`, context);

    expect(sunset).toBe('7:22 PM');
    expect(urls[0]).toContain('https://api.sunrise-sunset.org/json');
    expect(urls[0]).toContain('lat=40.74546');
    expect(urls[0]).toContain('lng=-73.88914');
    expect(urls[0]).toContain('date=2026-08-22');
  });

  it('calculates the following Sabbath without a timezone rollover', () => {
    const context = loadAppsScript({});
    const nextDate = runInContext(
      `getNextSabbathDate_('2026-12-26')`,
      context,
    );

    expect(nextDate).toBe('2027-01-02');
  });

  it('keeps full names for the private document builder but not the public API builder', () => {
    const headers = [
      'Date',
      'Quarter',
      'Special Remark',
      'Tithe Purpose',
      'Pastor Travel',
      'Queens Sermon',
      'Translation',
      'Chinese Teacher',
      'English Teacher',
      'Youth Teacher',
      'Kids Teacher',
      'Chair/Pastoral Prayer',
      'Special Music',
      'Offering Prayer',
      'Pianist',
      'SS Chair',
      'SS Opening Prayer',
      'SS Closing Prayer',
      'Flower Offering',
      'Brooklyn Sermon',
      'Chair/Pastoral Prayer',
      'Offering Prayer',
      'Technician',
      'Encouragement',
      'Sabbath School',
    ];
    const values = [
      '2026-08-22',
      'Q3',
      'Communion Sabbath',
      'Local Conference',
      '',
      'Moses Fang',
      'Peter Huang',
      'Ruth Feng',
      'Joy Soh',
      '',
      'Lan Xu',
      'Wen Jie Koh',
      'Church Choir',
      'Caleb Soh',
      'Esther Lin',
      'Yunxi Pan',
      'Ruth Feng',
      'Rachel Huang',
      'Joy Soh',
      'Moses Fang',
      'Timothy Huang',
      'Hannah Ho',
      'Jordan Ho',
      'Hannah Huang',
      'Timothy Huang',
    ];
    const scheduleSheet = {
      getName: () => 'Sabbath Calendar',
      getDataRange: () => ({
        getValues: () => [headers, values],
        getDisplayValues: () => [headers, values],
      }),
    };
    const intakeSheet = {
      getName: () => 'Weekly Data',
      getDataRange: () => ({
        getValues: () => [[
          'Date',
          'Location',
          'Bible Verses',
          'English Sermon Title',
          'Chinese Sermon Title',
          'Sabbath School Hymn 1',
          'Sabbath School Hymn 2',
          'Sabbath School Hymn 3',
          'English Hymn of Praise',
          'Chinese Hymn of Praise',
          'Special Music Title',
          'English Hymn of Response',
          'Chinese Hymn of Response',
        ]],
        getDisplayValues: () => [[
          'Date',
          'Location',
          'Bible Verses',
          'English Sermon Title',
          'Chinese Sermon Title',
          'Sabbath School Hymn 1',
          'Sabbath School Hymn 2',
          'Sabbath School Hymn 3',
          'English Hymn of Praise',
          'Chinese Hymn of Praise',
          'Special Music Title',
          'English Hymn of Response',
          'Chinese Hymn of Response',
        ]],
      }),
    };
    const spreadsheet = {
      getSheetByName: (name: string) =>
        name === 'Sabbath Calendar'
          ? scheduleSheet
          : name === 'Weekly Data'
            ? intakeSheet
            : null,
    };
    const context = loadAppsScript({
      SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
    });

    const names = JSON.parse(
      runInContext(
        `JSON.stringify({
          public: buildBulletin_('2026-08-22'),
          private: buildBulletin_('2026-08-22', { includeFullNames: true })
        })`,
        context,
      ) as string,
    );

    expect(names.public.queens.sermon).toBe('Moses F.');
    expect(names.private.queens.sermon).toBe('Moses Fang');
    expect(names.private.queens.chairPastoralPrayer).toBe('Wen Jie Koh');
    expect(names.private.brooklyn.technician).toBe('Jordan Ho');
    expect(names.private.brooklyn.encouragement).toBe('Hannah Huang');
  });
});

describe('Sabbath Calendar year-ahead rows', () => {
  const SCHEDULE_HEADERS = [
    'Date', 'Quarter', 'Special Remark', 'Tithe Purpose', 'Pastor Travel',
    'Queens Sermon', 'Translation', 'Chinese Teacher', 'English Teacher',
    'Youth Teacher', 'Kids Teacher', 'Chair/Pastoral Prayer', 'Special Music',
    'Offering Prayer', 'Pianist', 'SS Chair', 'SS Opening Prayer',
    'SS Closing Prayer', 'Flower Offering', 'Brooklyn Sermon',
    'Chair/Pastoral Prayer', 'Offering Prayer', 'Technician',
    'Encouragement', 'Sabbath School',
  ];
  const QUEENS_SERMON = 6;
  const BROOKLYN_SERMON = 20;
  const CONFLICT = '#ea9999';
  const WHITE = '#ffffff';

  const pad = (value: number) => String(value).padStart(2, '0');
  // Appended rows hold Date objects from the script's own realm, so check the
  // type by tag rather than instanceof.
  const isDate = (value: unknown): value is Date =>
    Object.prototype.toString.call(value) === '[object Date]';
  const dateKey = (value: unknown) =>
    isDate(value)
      ? `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`
      : String(value);

  // Every Saturday of one calendar quarter, as ISO dates.
  const quarterSaturdays = (year: number, quarter: number) => {
    const dates: string[] = [];
    const cursor = new Date(Date.UTC(year, (quarter - 1) * 3, 1));
    const end = new Date(Date.UTC(year, quarter * 3, 0));
    cursor.setUTCDate(cursor.getUTCDate() + ((6 - cursor.getUTCDay() + 7) % 7));
    while (cursor <= end) {
      dates.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }
    return dates;
  };

  // Seeded rows keep their dates as ISO text, which the maintenance parser
  // reads from the display value.
  const quarterRows = (year: number, quarter: number, label: unknown = `Q${quarter}`) =>
    quarterSaturdays(year, quarter).map((date): unknown[] => [date, label]);

  const createScheduleSheet = (rows: unknown[][], spareRows = 100) => {
    const width = SCHEDULE_HEADERS.length;
    const values: unknown[][] = [SCHEDULE_HEADERS, ...rows].map((row) =>
      Array.from({ length: width }, (_, index) => row[index] ?? ''),
    );
    const backgrounds: string[][] = values.map(() => Array(width).fill(WHITE));
    const calls: string[] = [];
    let maxRows = values.length + spareRows;

    const makeRange = (row: number, column = 1, numRows = 1, numColumns = 1) => {
      const read = <T,>(grid: T[][], blank: T) =>
        Array.from({ length: numRows }, (_, r) =>
          Array.from({ length: numColumns }, (_, c) => grid[row - 1 + r]?.[column - 1 + c] ?? blank),
        );
      const write = <T,>(grid: T[][], blank: T, next: T[][]) => {
        if (row + numRows - 1 > maxRows) {
          throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
        }
        next.forEach((line, r) => {
          grid[row - 1 + r] = grid[row - 1 + r] ?? Array(width).fill(blank);
          line.forEach((value, c) => {
            grid[row - 1 + r][column - 1 + c] = value;
          });
        });
      };
      return {
        getRow: () => row,
        getNumRows: () => numRows,
        getValues: () => read(values, ''),
        getDisplayValues: () =>
          read(values, '').map((line) =>
            line.map((value) =>
              isDate(value)
                ? `${value.getMonth() + 1}/${value.getDate()}/${value.getFullYear()}`
                : String(value),
            ),
          ),
        getValue: () => values[row - 1]?.[column - 1] ?? '',
        setValues: (next: unknown[][]) => write(values, '', next),
        getBackgrounds: () => read(backgrounds, WHITE),
        setBackgrounds: (next: (string | null)[][]) =>
          write(backgrounds, WHITE, next.map((line) => line.map((color) => color ?? WHITE))),
        getNotes: () => read<string>([], ''),
        setNotes: () => undefined,
        getNumberFormat: () => 'yyyy-mm-dd',
        setNumberFormat: (format: string) => calls.push(`numberFormat:${row}:${numRows}:${format}`),
        // Like PASTE_FORMAT, repeats the source row's fills down the target.
        copyTo: (target: { getRow: () => number; getNumRows: () => number }) => {
          for (let r = 0; r < target.getNumRows(); r += 1) {
            backgrounds[target.getRow() - 1 + r] = [...backgrounds[row - 1]];
          }
        },
        setDataValidation: () => calls.push(`validation:${row}:${numRows}`),
        // No header rules are left, so there's nothing to clear.
        getDataValidations: () => read<string | null>([], null),
        clearDataValidations: () => calls.push(`clearValidation:${row}:${numColumns}`),
        getA1Notation: () => `A${row}:Y${row + numRows - 1}`,
      };
    };

    return {
      getName: () => 'Sabbath Calendar',
      getLastRow: () => values.length,
      getLastColumn: () => width,
      getMaxRows: () => maxRows,
      getMaxColumns: () => width,
      insertRowsAfter: (after: number, count: number) => {
        calls.push(`insert:${after}:${count}`);
        maxRows += count;
      },
      getRange: makeRange,
      getDataRange: () => makeRange(1, 1, values.length, width),
      hideRows: (start: number, count: number) => calls.push(`hide:${start}:${count}`),
      showRows: (start: number, count: number) => calls.push(`show:${start}:${count}`),
      values,
      backgrounds,
      calls,
    };
  };

  const loadMaintenance = (
    sheet: ReturnType<typeof createScheduleSheet>,
    spreadsheetApp: Record<string, unknown> = {},
    extra: Record<string, unknown> = {},
  ) => {
    const context = loadAppsScript({
      Logger: { log: () => undefined },
      SpreadsheetApp: { CopyPasteType: { PASTE_FORMAT: 'PASTE_FORMAT' }, ...spreadsheetApp },
      ...extra,
    });
    (context as { testSheet: unknown }).testSheet = sheet;
    return context;
  };

  // Noon keeps the test date clear of midnight in any time zone.
  const populate = (context: object, date: string) =>
    runInContext(
      `populateUpcomingBulletinQuarters_(testSheet, new Date('${date}T12:00:00'))`,
      context,
    ) as number;

  const datesFrom = (sheet: ReturnType<typeof createScheduleSheet>, firstRow: number) =>
    sheet.values.slice(firstRow - 1).map((row) => dateKey(row[0]));
  const quartersFrom = (sheet: ReturnType<typeof createScheduleSheet>, firstRow: number) =>
    sheet.values.slice(firstRow - 1).map((row) => row[1]);

  it('catches up to a year ahead, in date order, from a sheet that ends at the current quarter', () => {
    const sheet = createScheduleSheet(quarterRows(2026, 4));
    const context = loadMaintenance(sheet);

    expect(populate(context, '2026-10-10')).toBe(39);

    const added = datesFrom(sheet, 15);
    expect(added).toEqual([
      ...quarterSaturdays(2027, 1),
      ...quarterSaturdays(2027, 2),
      ...quarterSaturdays(2027, 3),
    ]);
    expect(added[0]).toBe('2027-01-02');
    expect(added[added.length - 1]).toBe('2027-09-25');
    expect(quartersFrom(sheet, 15)).toEqual([
      ...Array(13).fill('Q1'),
      ...Array(13).fill('Q2'),
      ...Array(13).fill('Q3'),
    ]);
    expect(sheet.values.slice(14).every((row) => row.slice(2).every((cell) => cell === ''))).toBe(
      true,
    );
    expect(sheet.calls).toContain('numberFormat:15:39:yyyy-mm-dd');
  });

  it('adds nothing outside the final 21 days once a year of rows exists', () => {
    const sheet = createScheduleSheet([
      ...quarterRows(2026, 4),
      ...quarterRows(2027, 1),
      ...quarterRows(2027, 2),
      ...quarterRows(2027, 3),
    ]);
    const context = loadMaintenance(sheet);

    expect(populate(context, '2026-10-01')).toBe(0);
    expect(populate(context, '2026-11-15')).toBe(0);
    // 22 days before the quarter ends: one day before the window opens.
    expect(populate(context, '2026-12-09')).toBe(0);
    expect(sheet.values).toHaveLength(53);
  });

  it('adds exactly the fourth quarter ahead in the final 21 days, across the year boundary', () => {
    const sheet = createScheduleSheet([
      ...quarterRows(2026, 4),
      ...quarterRows(2027, 1),
      ...quarterRows(2027, 2),
      ...quarterRows(2027, 3),
    ]);
    const context = loadMaintenance(sheet);

    // Q4 2026 + 4 is Q4 2027.
    expect(populate(context, '2026-12-10')).toBe(13);
    expect(datesFrom(sheet, 54)).toEqual(quarterSaturdays(2027, 4));
    expect(quartersFrom(sheet, 54)).toEqual(Array(13).fill('Q4'));

    // Later runs in the same window, and the next quarter before its own
    // window, find the year already in place.
    expect(populate(context, '2026-12-31')).toBe(0);
    expect(populate(context, '2027-01-01')).toBe(0);
    expect(populate(context, '2027-03-09')).toBe(0);

    // Q1 2027's window adds Q1 2028, whose first day is a Saturday.
    expect(populate(context, '2027-03-20')).toBe(13);
    expect(datesFrom(sheet, 67)).toEqual(quarterSaturdays(2028, 1));
    expect(datesFrom(sheet, 67)[0]).toBe('2028-01-01');
    expect(quartersFrom(sheet, 67)).toEqual(Array(13).fill('Q1'));
  });

  it('opens the window 21 days before the quarter ends, even across a daylight-saving change', () => {
    // In the script's America/New_York time zone, clocks change on
    // 2027-03-14, so these spans are an hour short of whole days there.
    const sheet = createScheduleSheet([
      ...quarterRows(2027, 1),
      ...quarterRows(2027, 2),
      ...quarterRows(2027, 3),
      ...quarterRows(2027, 4),
    ]);
    const context = loadMaintenance(sheet);

    expect(populate(context, '2027-03-09')).toBe(0);
    expect(populate(context, '2027-03-10')).toBe(13);
    expect(datesFrom(sheet, 54)).toEqual(quarterSaturdays(2028, 1));
  });

  it('never duplicates a date or appends past the fourth quarter ahead', () => {
    const sheet = createScheduleSheet([
      ...quarterRows(2026, 4),
      // Entered by hand ahead of the automatic rows.
      ['2027-01-02', 'Q1'],
      ['2027-01-16', 'Q1'],
      ['2028-06-03', 'Q2'],
    ]);
    const context = loadMaintenance(sheet);

    expect(populate(context, '2026-10-10')).toBe(37);
    expect(populate(context, '2026-12-20')).toBe(13);
    expect(populate(context, '2026-12-21')).toBe(0);

    const dates = datesFrom(sheet, 2);
    expect(new Set(dates).size).toBe(dates.length);
    expect(dates.filter((date) => date === '2027-01-02' || date === '2027-01-16')).toHaveLength(2);
    expect(dates.filter((date) => date > '2027-12-31')).toEqual(['2028-06-03']);
    expect([...dates].sort()).toEqual([
      ...quarterSaturdays(2026, 4),
      ...quarterSaturdays(2027, 1),
      ...quarterSaturdays(2027, 2),
      ...quarterSaturdays(2027, 3),
      ...quarterSaturdays(2027, 4),
      '2028-06-03',
    ]);
  });

  it.each([
    ['Q4', ['Q1', 'Q2', 'Q3']],
    ['q 4', ['Q1', 'Q2', 'Q3']],
    ['4', ['1', '2', '3']],
    [4, [1, 2, 3]],
  ])('writes the Quarter cell in the style of the last row (%p)', (style, expected) => {
    const sheet = createScheduleSheet(quarterRows(2026, 4, style));
    const context = loadMaintenance(sheet);

    populate(context, '2026-10-10');

    expect([...new Set(quartersFrom(sheet, 15))]).toEqual(expected);
  });

  it('adds grid rows first when the sheet has no blank rows left', () => {
    const sheet = createScheduleSheet(quarterRows(2026, 4), 0);
    const context = loadMaintenance(sheet);

    expect(populate(context, '2026-10-10')).toBe(39);
    expect(sheet.calls).toContain('insert:14:39');
    expect(sheet.values).toHaveLength(53);
  });

  it('hides only past rows and shows the year ahead in one range', () => {
    const sheet = createScheduleSheet([
      ...quarterRows(2026, 3),
      ...quarterRows(2026, 4),
      ...quarterRows(2027, 1),
      ...quarterRows(2027, 2),
      ...quarterRows(2027, 3),
    ]);
    const context = loadMaintenance(sheet);
    const hide = (date: string) =>
      runInContext(
        `hideOldBulletinScheduleRows_(testSheet, new Date('${date}T12:00:00'))`,
        context,
      ) as number;

    expect(hide('2026-10-10')).toBe(13);
    expect(sheet.calls).toEqual(['hide:2:13', 'show:15:52']);

    // At a quarter boundary the previous Sabbath stays visible.
    sheet.calls.length = 0;
    expect(hide('2026-10-02')).toBe(12);
    expect(sheet.calls).toEqual(['hide:2:12', 'show:14:53']);
  });

  it('runs validation and the roster scan over every appended row', () => {
    const rows = quarterRows(2026, 4);
    const lastRow = rows[rows.length - 1];
    lastRow[QUEENS_SERMON - 1] = 'Avery Example';
    lastRow[BROOKLYN_SERMON - 1] = 'Avery Example';
    const sheet = createScheduleSheet(rows, 0);
    // Painted by an earlier scan, so the format copy carries it into new rows.
    sheet.backgrounds[13][QUEENS_SERMON - 1] = CONFLICT;
    sheet.backgrounds[13][BROOKLYN_SERMON - 1] = CONFLICT;

    const sermonHeaders = [
      'Date', 'Location', 'Bible Verses', 'English Sermon Title', 'Chinese Sermon Title',
      'Sabbath School Hymn 1', 'Sabbath School Hymn 2', 'Sabbath School Hymn 3',
      'Hymn of Praise', 'Special Music Title', 'Hymn of Response',
    ];
    const sermonCalls: string[] = [];
    const sermonSheet = {
      getName: () => 'Weekly Data',
      getMaxColumns: () => sermonHeaders.length,
      getDataRange: () => ({
        getValues: () => [sermonHeaders],
        getDisplayValues: () => [sermonHeaders],
      }),
      getRange: (row: number, _column: number, _numRows: number, numColumns: number) => ({
        setDataValidation: () => undefined,
        // One fixed-name rule left over from before #558.
        getDataValidations: () => [['rule', ...Array(numColumns - 1).fill(null)]],
        clearDataValidations: () => sermonCalls.push(`clearValidation:${row}:${numColumns}`),
      }),
    };
    const builder: Record<string, unknown> = { build: () => 'rule' };
    ['requireValueInList', 'requireFormulaSatisfied', 'setAllowInvalid', 'setHelpText'].forEach(
      (name) => {
        builder[name] = () => builder;
      },
    );
    const context = loadMaintenance(
      sheet,
      {
        ProtectionType: { RANGE: 'RANGE' },
        getActiveSpreadsheet: () => ({
          getSheetByName: (name: string) =>
            ({ 'Sabbath Calendar': sheet, 'Weekly Data': sermonSheet } as Record<
              string,
              unknown
            >)[name] ?? null,
        }),
        newDataValidation: () => builder,
        flush: () => undefined,
      },
      {
        LockService: {
          getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => undefined }),
        },
      },
    );

    const result = JSON.parse(
      runInContext(
        `JSON.stringify(runBulletinScheduleMaintenance_(new Date('2026-10-10T12:00:00')))`,
        context,
      ) as string,
    );

    expect(result.populated).toBe(39);
    // A header row loses its old fixed-name rules (#558), and one without
    // any is left alone.
    expect(sermonCalls).toEqual(['clearValidation:1:11']);
    expect(sheet.calls.filter((call) => call.startsWith('clearValidation'))).toEqual([]);
    expect(result.validation).toEqual({
      installed: 'A2:Y14',
      updatedAfterQuarterAppend: 'A2:Y53',
    });
    expect(result.hidden).toBe(0);
    expect(sheet.calls).toContain('show:2:52');
    expect(result.conflicts).toBe(2);
    expect(sheet.backgrounds[13][QUEENS_SERMON - 1]).toBe(CONFLICT);
    expect(
      sheet.backgrounds
        .slice(14)
        .every((row) => row[QUEENS_SERMON - 1] === WHITE && row[BROOKLYN_SERMON - 1] === WHITE),
    ).toBe(true);
    expect(
      runInContext('formatBulletinScheduleMaintenanceResult_(testResult)', Object.assign(context, { testResult: result })),
    ).toBe(
      'Schedule maintenance complete. Added 39 upcoming Saturday(s) and 0 Weekly Data row(s), and hid 0 old row(s).',
    );
  });
});
