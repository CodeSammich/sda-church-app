import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

// The bulletin survives a reorganized spreadsheet (#580): renamed and moved
// tabs and columns are still found by the developer metadata tags the
// open-time upkeep puts on them, and a missing schedule gives a bulletin that
// says so, for the app versions that show it.

const SCHEDULE_HEADERS = [
  'Date', 'Quarter', 'Special Remark', 'Tithe Purpose', 'Pastor Travel',
  'Queens Sermon', 'Translation', 'Chinese Teacher', 'English Teacher',
  'Youth Teacher', 'Kids Teacher', 'Chair/Pastoral Prayer', 'Special Music',
  'Offering Prayer', 'Pianist', 'SS Chair', 'SS Opening Prayer',
  'SS Closing Prayer', 'Flower Offering', 'Brooklyn Sermon',
  'Chair/Pastoral Prayer', 'Offering Prayer', 'Technician',
  'Encouragement', 'Sabbath School',
];

const WEEKLY_HEADERS = [
  'Date', 'Location', 'Bible Verses', 'English Sermon Title', 'Chinese Sermon Title',
  'Sabbath School Hymn 1', 'Sabbath School Hymn 2', 'Sabbath School Hymn 3',
  'Hymn of Praise', 'Special Music Title', 'Hymn of Response',
];

const SABBATH = '2026-11-07';

// Each cell names its own column, so a value shows where it was read from.
const scheduleRow = () =>
  SCHEDULE_HEADERS.map((header, index) =>
    index === 0 ? SABBATH : index === 1 ? 'Q4' : `${header} ${index + 1}`,
  );

type Entry = { key: string; value: string; sheet: FakeSheet; column?: number };

type FakeSheet = {
  name: string;
  id: number;
  grid: string[][];
  getName: () => string;
  setName: (name: string) => void;
  getSheetId: () => number;
  getIndex: () => number;
  getParent: () => FakeWorkbook;
  getLastRow: () => number;
  getLastColumn: () => number;
  getMaxColumns: () => number;
  insertColumnsAfter: (after: number, count: number) => void;
  getDataRange: () => { getValues: () => string[][]; getDisplayValues: () => string[][] };
  getRange: (...args: (number | string)[]) => unknown;
  addDeveloperMetadata: (key: string, value: string) => void;
  createDeveloperMetadataFinder: () => unknown;
  insertColumn: (index: number, header: string, value?: string) => void;
  deleteColumn: (index: number) => void;
  setHeader: (index: number, header: string) => void;
};

type FakeWorkbook = {
  sheets: FakeSheet[];
  entries: Entry[];
  finderCalls: number;
  inserted: string[];
  getSheetByName: (name: string) => FakeSheet | null;
  createDeveloperMetadataFinder: () => unknown;
  insertSheet: (name: string) => FakeSheet;
  addSheet: (name: string, grid: string[][], position?: number) => FakeSheet;
  sheet: (name: string) => FakeSheet;
  tags: (sheet: FakeSheet) => Record<string, number>;
};

const columnNumber = (letters: string) =>
  letters.split('').reduce((total, letter) => total * 26 + letter.charCodeAt(0) - 64, 0);

const createWorkbook = (tabs: Record<string, string[][]>): FakeWorkbook => {
  let nextId = 1;
  const toMetadata = (entry: Entry) => ({
    getKey: () => entry.key,
    getValue: () => entry.value,
    getLocation: () => ({
      getSheet: () => (entry.column ? null : entry.sheet),
      getColumn: () => (entry.column ? { getColumn: () => entry.column } : null),
    }),
    remove: () => {
      workbook.entries.splice(workbook.entries.indexOf(entry), 1);
    },
  });
  const finder = (inScope: (entry: Entry) => boolean) => {
    workbook.finderCalls += 1;
    let key: string | undefined;
    let value: string | undefined;
    const api = {
      withKey: (wanted: string) => {
        key = wanted;
        return api;
      },
      withValue: (wanted: string) => {
        value = wanted;
        return api;
      },
      find: () =>
        workbook.entries
          .filter(
            (entry) =>
              inScope(entry) &&
              (key === undefined || entry.key === key) &&
              (value === undefined || entry.value === value),
          )
          .map(toMetadata),
    };
    return api;
  };

  const makeSheet = (name: string, grid: string[][]): FakeSheet => {
    const sheet: FakeSheet = {
      name,
      id: nextId++,
      grid: grid.map((row) => [...row]),
      getName: () => sheet.name,
      setName: (next) => {
        sheet.name = next;
      },
      getSheetId: () => sheet.id,
      getIndex: () => workbook.sheets.indexOf(sheet) + 1,
      getParent: () => workbook,
      getLastRow: () => sheet.grid.length,
      getLastColumn: () => Math.max(0, ...sheet.grid.map((row) => row.length)),
      getMaxColumns: () => sheet.getLastColumn(),
      // The grid grows as values are written past its edge.
      insertColumnsAfter: () => undefined,
      getDataRange: () => ({
        getValues: () => sheet.grid.map((row) => [...row]),
        getDisplayValues: () => sheet.grid.map((row) => [...row]),
      }),
      getRange: (...args) => {
        if (typeof args[0] === 'string') {
          const match = /^([A-Z]+):\1$/.exec(args[0]);
          if (!match) {
            throw new Error(`Only whole columns take developer metadata, not ${args[0]}`);
          }
          return {
            addDeveloperMetadata: (key: string, value: string) => {
              workbook.entries.push({ key, value, sheet, column: columnNumber(match[1]) });
            },
          };
        }
        const [row, column, numRows = 1, numColumns = 1] = args as number[];
        const read = () =>
          Array.from({ length: numRows }, (_, r) =>
            Array.from({ length: numColumns }, (_, c) => sheet.grid[row - 1 + r]?.[column - 1 + c] ?? ''),
          );
        return {
          getDisplayValues: read,
          getValues: read,
          setValues: (values: string[][]) =>
            values.forEach((line, r) =>
              line.forEach((value, c) => {
                sheet.grid[row - 1 + r] = sheet.grid[row - 1 + r] ?? [];
                sheet.grid[row - 1 + r][column - 1 + c] = value;
              }),
            ),
          setFontWeight: () => undefined,
        };
      },
      addDeveloperMetadata: (key, value) => {
        workbook.entries.push({ key, value, sheet });
      },
      createDeveloperMetadataFinder: () => finder((entry) => entry.sheet === sheet),
      // Like inserting a column in Sheets: the tags on later columns move with them.
      insertColumn: (index, header, value = '') => {
        sheet.grid.forEach((row, rowIndex) => row.splice(index, 0, rowIndex === 0 ? header : value));
        workbook.entries.forEach((entry) => {
          if (entry.sheet === sheet && entry.column && entry.column > index) {
            entry.column += 1;
          }
        });
      },
      // Deleting a column deletes its tags.
      deleteColumn: (index) => {
        sheet.grid.forEach((row) => row.splice(index, 1));
        workbook.entries = workbook.entries.filter(
          (entry) => !(entry.sheet === sheet && entry.column === index + 1),
        );
        workbook.entries.forEach((entry) => {
          if (entry.sheet === sheet && entry.column && entry.column > index + 1) {
            entry.column -= 1;
          }
        });
      },
      setHeader: (index, header) => {
        sheet.grid[0][index] = header;
      },
    };
    return sheet;
  };

  const workbook: FakeWorkbook = {
    sheets: [],
    entries: [],
    finderCalls: 0,
    inserted: [],
    getSheetByName: (name) => workbook.sheets.find((sheet) => sheet.name === name) ?? null,
    createDeveloperMetadataFinder: () => finder(() => true),
    insertSheet: (name) => {
      workbook.inserted.push(name);
      return workbook.addSheet(name, []);
    },
    addSheet: (name, grid, position = workbook.sheets.length) => {
      const sheet = makeSheet(name, grid);
      workbook.sheets.splice(position, 0, sheet);
      return sheet;
    },
    sheet: (name) => {
      const found = workbook.getSheetByName(name);
      if (!found) {
        throw new Error(`No tab ${name}`);
      }
      return found;
    },
    // Each column tag on the tab, by tag, with its 1-based column.
    tags: (sheet) =>
      Object.fromEntries(
        workbook.entries
          .filter((entry) => entry.sheet === sheet && entry.column)
          .map((entry) => [entry.value, entry.column as number]),
      ),
  };
  Object.entries(tabs).forEach(([name, grid]) => workbook.addSheet(name, grid));
  return workbook;
};

const createChurchWorkbook = () =>
  createWorkbook({
    'Sabbath Calendar': [SCHEDULE_HEADERS, scheduleRow()],
    'Weekly Data': [
      WEEKLY_HEADERS,
      [SABBATH, 'Queens', 'John 10:11-16', 'The Good Shepherd', '好牧人', '', '', '', '', '', ''],
    ],
    'Name Dictionary': [['English Name', 'Chinese Name'], ['Ada Lin', '林愛達']],
    Leadership: [['Pastors', 'Elders'], ['Ada Lin', 'Ben Hall']],
  });

const load = (workbook: FakeWorkbook, properties?: Map<string, string>) => {
  const cache = new Map<string, string>();
  const context = createContext({
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) => cache.get(key) ?? null,
        put: (key: string, value: string) => cache.set(key, value),
      }),
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (text: string) => ({ text, setMimeType: () => ({ text }) }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => workbook,
      DeveloperMetadataVisibility: { DOCUMENT: 'DOCUMENT' },
    },
    PropertiesService: properties
      ? {
          getDocumentProperties: () => ({
            getProperty: (key: string) => properties.get(key) ?? null,
            setProperty: (key: string, value: string) => properties.set(key, value),
          }),
        }
      : undefined,
    workbook,
  });
  [
    'BulletinApi.gs',
    'SabbathEncouragement.gs',
    'BulletinScheduleMaintenance.gs',
    'ScheduleAssignmentChecks.gs',
    'PrintedBulletin.gs',
  ].forEach((file) =>
    runInContext(readFileSync(join(process.cwd(), 'google-apps-script', file), 'utf8'), context),
  );
  return context;
};

const run = <T,>(context: object, code: string): T =>
  JSON.parse(runInContext(`JSON.stringify(${code})`, context) as string) as T;

type BulletinLocation = Record<string, string>;
type Bulletin = { date: string; quarter: string; queens: BulletinLocation; brooklyn: BulletinLocation };

const buildBulletin = (context: object) =>
  run<Bulletin>(context, `buildBulletin_('${SABBATH}', { includeFullNames: true })`);

// Opening the spreadsheet tags what it finds by name.
const tagged = () => {
  const workbook = createChurchWorkbook();
  const context = load(workbook);
  runInContext('tagBulletinTabsAndColumns_(workbook)', context);
  return { workbook, context };
};

describe('bulletin tab and column tags', () => {
  it('tags each tab, and each expected column under its own label', () => {
    const { workbook } = tagged();

    const tabTags = workbook.entries
      .filter((entry) => !entry.column)
      .map((entry) => [entry.sheet.name, entry.key, entry.value]);
    expect(tabTags).toEqual([
      ['Sabbath Calendar', 'bulletin.tab', 'sabbath-calendar'],
      ['Weekly Data', 'bulletin.tab', 'weekly-data'],
      ['Name Dictionary', 'bulletin.tab', 'name-dictionary'],
      ['Leadership', 'bulletin.tab', 'leadership'],
    ]);

    const schedule = workbook.tags(workbook.sheet('Sabbath Calendar'));
    expect(Object.keys(schedule)).toHaveLength(SCHEDULE_HEADERS.length);
    expect(schedule).toMatchObject({
      date: 1,
      'queens sermon': 6,
      'queens chair/pastoral prayer': 12,
      'queens offering prayer': 14,
      'brooklyn sermon': 20,
      'brooklyn chair/pastoral prayer': 21,
      'brooklyn offering prayer': 22,
    });
    expect(Object.keys(workbook.tags(workbook.sheet('Weekly Data')))).toHaveLength(
      WEEKLY_HEADERS.length,
    );
    expect(workbook.entries.every((entry) => entry.key.startsWith('bulletin.'))).toBe(true);
  });

  it('adds nothing when everything is already tagged', () => {
    const { workbook, context } = tagged();
    const before = workbook.entries.length;

    runInContext('tagBulletinTabsAndColumns_(workbook)', context);

    expect(workbook.entries).toHaveLength(before);
  });

  it('reads no tags while every tab and column has its name', () => {
    const { workbook, context } = tagged();
    workbook.finderCalls = 0;

    const bulletin = buildBulletin(context);

    expect(bulletin.queens.sermon).toBe('Queens Sermon 6');
    expect(workbook.finderCalls).toBe(0);
  });

  it('still reads a renamed Sabbath Calendar tab, and says so', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.setName('Calendar 2026');

    expect(buildBulletin(context).queens.sermon).toBe('Queens Sermon 6');
    expect(run(context, 'getMissingBulletinColumns_(workbook)')).toEqual([]);
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Tab "Calendar 2026" is read as Sabbath Calendar',
    ]);
    // The English-only guard and roster checks run on edits to it.
    context.calendar = calendar;
    expect(run(context, `isBulletinTab_(calendar, 'Sabbath Calendar')`)).toBe(true);
    expect(run(context, `isBulletinTab_(workbook.getSheetByName('Weekly Data'), 'Sabbath Calendar')`)).toBe(false);
  });

  it('cannot find a tab renamed before it was ever tagged', () => {
    const workbook = createChurchWorkbook();
    const context = load(workbook);
    workbook.sheet('Sabbath Calendar').setName('Calendar 2026');

    expect(() => buildBulletin(context)).toThrow('Schedule sheet not found: Sabbath Calendar');
  });

  it('reads renamed and moved columns as before, and says which were renamed', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    // A new first column moves every other one right.
    calendar.insertColumn(0, 'Notes', 'A note');
    calendar.setHeader(1, 'Sabbath');
    calendar.setHeader(6, 'Speaker');
    calendar.setHeader(22, 'Offering');

    const bulletin = buildBulletin(context);

    expect(bulletin.date).toBe(SABBATH);
    expect(bulletin.quarter).toBe('Q4');
    expect(bulletin.queens.sermon).toBe('Queens Sermon 6');
    expect(bulletin.queens.offeringPrayer).toBe('Offering Prayer 14');
    expect(bulletin.brooklyn.offeringPrayer).toBe('Offering Prayer 22');
    expect(bulletin.brooklyn.chairPastoralPrayer).toBe('Chair/Pastoral Prayer 21');
    expect(run(context, 'getMissingBulletinColumns_(workbook)')).toEqual([]);
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Sabbath Calendar: "Sabbath" is read as Date',
      'Sabbath Calendar: "Speaker" is read as Queens Sermon',
      'Sabbath Calendar: "Offering" is read as Brooklyn Offering Prayer',
    ]);
  });

  it('keeps each side of a repeated header when Brooklyn Sermon is renamed too', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.setHeader(19, 'Brooklyn Speaker');
    calendar.setHeader(20, 'Chair');
    calendar.setHeader(11, 'Chair and Prayer');

    const bulletin = buildBulletin(context);

    expect(bulletin.brooklyn.sermon).toBe('Brooklyn Sermon 20');
    expect(bulletin.queens.chairPastoralPrayer).toBe('Chair/Pastoral Prayer 12');
    expect(bulletin.brooklyn.chairPastoralPrayer).toBe('Chair/Pastoral Prayer 21');
  });

  it('reads a column made again under the old name, and moves the tag to it', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.setHeader(5, 'Old sermon list');
    calendar.insertColumn(calendar.getLastColumn(), 'Queens Sermon', 'Newly entered');

    expect(buildBulletin(context).queens.sermon).toBe('Newly entered');
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([]);

    runInContext('tagBulletinTabsAndColumns_(workbook)', context);
    const sermonTags = workbook.entries.filter(
      (entry) => entry.sheet === calendar && entry.value === 'queens sermon',
    );
    expect(sermonTags.map((entry) => entry.column)).toEqual([calendar.getLastColumn()]);
  });

  it('reads the tagged column when a new column gets its name, and keeps its tag', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    // Another fellowship's dates, added in front.
    calendar.insertColumn(0, 'Date', '2026-11-14');

    const bulletin = buildBulletin(context);

    expect(bulletin.date).toBe(SABBATH);
    expect(bulletin.queens.sermon).toBe('Queens Sermon 6');
    expect(run(context, 'getMissingBulletinColumns_(workbook)')).toEqual([]);
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Sabbath Calendar: 2 columns are named Date; column B is read',
    ]);

    runInContext('tagBulletinTabsAndColumns_(workbook)', context);
    const dateTags = workbook.entries.filter(
      (entry) => entry.sheet === calendar && entry.value === 'date',
    );
    expect(dateTags.map((entry) => entry.column)).toEqual([2]);
  });

  it('reads the first of two columns with the same name when neither is tagged, and says which', () => {
    const workbook = createChurchWorkbook();
    const context = load(workbook);
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.insertColumn(calendar.getLastColumn(), 'Queens Sermon', 'Another sermon');

    expect(buildBulletin(context).queens.sermon).toBe('Queens Sermon 6');
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Sabbath Calendar: 2 columns are named Queens Sermon; column F is read',
    ]);
  });

  it('reads the column with data when an empty one an open added gets the same name', () => {
    const workbook = createChurchWorkbook();
    const context = load(workbook);
    const weekly = workbook.sheet('Weekly Data');
    // Renamed before anything was tagged: the next open adds an empty
    // Bible Verses column and tags it.
    weekly.setHeader(2, 'Scripture');
    runInContext('ensureWeeklyDataTab_(workbook); tagBulletinTabsAndColumns_(workbook)', context);
    expect(weekly.grid[0][WEEKLY_HEADERS.length]).toBe('Bible Verses');
    // Then someone puts the old name back.
    weekly.setHeader(2, 'Bible Verses');

    const intake = run<{ bibleVerses: string }>(
      context,
      `(function () {
        var location = createLocation_();
        populateBulletinIntake_(location, getBulletinIntakeRows_(workbook, '${SABBATH}', 'queens'));
        return location;
      })()`,
    );

    expect(intake.bibleVerses).toBe('John 10:11-16');
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Weekly Data: 2 columns are named Bible Verses; column C is read',
    ]);
    runInContext('tagBulletinTabsAndColumns_(workbook)', context);
    const verseTags = workbook.entries.filter(
      (entry) => entry.sheet === weekly && entry.value === 'bible verses',
    );
    expect(verseTags.map((entry) => entry.column)).toEqual([3]);
  });

  it('keeps reading a renamed column in its old role when the name it took is still in use', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.setHeader(5, 'Translation');

    const bulletin = buildBulletin(context);

    expect(bulletin.queens.sermon).toBe('Queens Sermon 6');
    expect(bulletin.queens.translation).toBe('Translation 7');
    expect(run(context, 'getMissingBulletinColumns_(workbook)')).toEqual([]);
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Sabbath Calendar: 2 columns are named Translation; column G is read',
      'Sabbath Calendar: "Translation" is read as Queens Sermon',
    ]);
  });

  it('reads the tagged prayer column when a new one on the same side gets its name', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.insertColumn(7, 'Offering Prayer', 'Another prayer');

    const bulletin = buildBulletin(context);

    expect(bulletin.queens.offeringPrayer).toBe('Offering Prayer 14');
    expect(bulletin.brooklyn.offeringPrayer).toBe('Offering Prayer 22');
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Sabbath Calendar: 2 Queens columns are named Offering Prayer; column O is read',
    ]);
  });

  it('keeps reading a column renamed to a prayer column on its side in its old role', () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.setHeader(5, 'Offering Prayer');

    const bulletin = buildBulletin(context);

    expect(bulletin.queens.sermon).toBe('Queens Sermon 6');
    expect(bulletin.queens.offeringPrayer).toBe('Offering Prayer 14');
    expect(run(context, 'getMissingBulletinColumns_(workbook)')).toEqual([]);
    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([
      'Sabbath Calendar: 2 Queens columns are named Offering Prayer; column N is read',
      'Sabbath Calendar: "Offering Prayer" is read as Queens Sermon',
    ]);
  });

  it("blanks a deleted column's field, lists it as missing, and drops its tag", () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.deleteColumn(5);

    expect(buildBulletin(context).queens.sermon).toBe('');
    expect(buildBulletin(context).queens.translation).toBe('Translation 7');
    expect(run(context, 'getMissingBulletinColumns_(workbook)')).toEqual([
      'Sabbath Calendar: Queens Sermon',
    ]);
    expect(workbook.entries.some((entry) => entry.value === 'queens sermon')).toBe(false);
  });

  it('still tags what it finds when the upkeep stops early', () => {
    const workbook = createChurchWorkbook();
    const context = load(workbook);
    context.LockService = {
      getDocumentLock: () => ({ tryLock: () => true, releaseLock: () => undefined }),
    };
    // A Sabbath Calendar renamed before it was ever tagged stops the upkeep
    // at its first step.
    workbook.sheet('Sabbath Calendar').setName('Calendar 2026');

    expect(() =>
      runInContext(`runBulletinScheduleMaintenance_(new Date('2026-11-02T12:00:00'))`, context),
    ).toThrow();
    expect(
      workbook.entries.filter((entry) => !entry.column).map((entry) => entry.sheet.name),
    ).toEqual(['Weekly Data', 'Name Dictionary', 'Leadership']);
  });

  it("doesn't count a hymn's English and Chinese columns as the same name", () => {
    const { workbook, context } = tagged();
    const weekly = workbook.sheet('Weekly Data');
    weekly.setHeader(8, 'English Hymn of Praise');
    weekly.insertColumn(9, 'Chinese Hymn of Praise', '讚美詩');
    workbook.finderCalls = 0;

    expect(run(context, 'getRenamedBulletinTabsAndColumns_(workbook)')).toEqual([]);
    expect(workbook.finderCalls).toBe(0);
  });

  it("doesn't read a tagged column that now has another expected column's name", () => {
    const { workbook, context } = tagged();
    const calendar = workbook.sheet('Sabbath Calendar');
    calendar.deleteColumn(6);
    calendar.setHeader(5, 'Translation');

    const bulletin = buildBulletin(context);

    expect(bulletin.queens.sermon).toBe('');
    expect(bulletin.queens.translation).toBe('Queens Sermon 6');
    expect(run(context, 'getMissingBulletinColumns_(workbook)')).toEqual([
      'Sabbath Calendar: Queens Sermon',
    ]);
  });

  it('reads the original tab, not a duplicate that copied its tag, and untags the copy', () => {
    const { workbook, context } = tagged();
    const copy = workbook.addSheet(
      'Copy of Sabbath Calendar',
      [SCHEDULE_HEADERS, SCHEDULE_HEADERS.map((_, index) => (index === 0 ? SABBATH : 'copy'))],
      0,
    );
    copy.addDeveloperMetadata('bulletin.tab', 'sabbath-calendar');

    expect(buildBulletin(context).queens.sermon).toBe('Queens Sermon 6');

    runInContext('tagBulletinTabsAndColumns_(workbook)', context);
    expect(
      workbook.entries.filter((entry) => !entry.column && entry.value === 'sabbath-calendar')
        .map((entry) => entry.sheet.name),
    ).toEqual(['Sabbath Calendar']);
  });

  it("doesn't make Weekly Data again, or add a column, after a rename", () => {
    const { workbook, context } = tagged();
    const weekly = workbook.sheet('Weekly Data');
    weekly.setName('Sermons');
    weekly.setHeader(2, 'Scripture');

    runInContext('ensureWeeklyDataTab_(workbook)', context);

    expect(workbook.inserted).toEqual([]);
    expect(weekly.grid[0]).toHaveLength(WEEKLY_HEADERS.length);
    expect(
      run<{ bibleVerses: string }>(
        context,
        `(function () {
          var location = createLocation_();
          populateBulletinIntake_(location, getBulletinIntakeRows_(workbook, '${SABBATH}', 'queens'));
          return location;
        })()`,
      ).bibleVerses,
    ).toBe('John 10:11-16');
  });

  it('finds the Name Dictionary and Leadership tabs after a rename', () => {
    const { workbook, context } = tagged();
    workbook.sheet('Name Dictionary').setName('Names');
    workbook.sheet('Leadership').setName('Church Leaders');

    expect(run(context, `getBulletinSheet_(workbook, 'Name Dictionary').getName()`)).toBe('Names');
    expect(run(context, `getBulletinSheet_(workbook, 'Leadership').getName()`)).toBe('Church Leaders');
  });

  it('announces each rename once', () => {
    const properties = new Map<string, string>();
    const context = load(createChurchWorkbook(), properties);
    const take = (lines: string[]) => run<string[]>(context, `takeNewBulletinRenames_(${JSON.stringify(lines)})`);

    expect(take(['A'])).toEqual(['A']);
    expect(take(['A'])).toEqual([]);
    expect(take(['A', 'B'])).toEqual(['B']);
    // Undone, then made again.
    expect(take(['B'])).toEqual([]);
    expect(take(['A', 'B'])).toEqual(['A']);
  });

  it('announces renames on every open where document properties are unavailable', () => {
    const context = load(createChurchWorkbook());

    expect(run(context, `takeNewBulletinRenames_(['A'])`)).toEqual(['A']);
    expect(run(context, `takeNewBulletinRenames_(['A'])`)).toEqual(['A']);
  });
});

describe('a bulletin without its schedule', () => {
  type Response = { ok: boolean; error?: string; bulletin?: Bulletin & { scheduleNotSet?: boolean } };

  const request = (context: object, appVersion?: string) =>
    JSON.parse(
      runInContext(
        `doGet({ parameter: ${JSON.stringify({ date: SABBATH, ...(appVersion ? { appVersion } : {}) })} }).text`,
        context,
      ) as string,
    ) as Response;

  const softBulletin = (context: object) =>
    run<Bulletin & { scheduleNotSet?: boolean }>(
      context,
      `buildBulletin_('${SABBATH}', { includeFullNames: true, allowMissingSchedule: true })`,
    );

  // Each way the Sabbath Calendar can lose the bulletin's schedule, and the
  // error older apps still get.
  const breakages: Array<[string, (workbook: FakeWorkbook) => void, string]> = [
    [
      'the tab is deleted',
      (workbook) => workbook.sheets.splice(workbook.sheets.indexOf(workbook.sheet('Sabbath Calendar')), 1),
      'Schedule sheet not found: Sabbath Calendar',
    ],
    [
      'its Date column is deleted',
      (workbook) => workbook.sheet('Sabbath Calendar').deleteColumn(0),
      'Schedule sheet is missing a Date column',
    ],
    [
      "this Sabbath's row is missing",
      (workbook) => workbook.sheet('Sabbath Calendar').grid.splice(1, 1),
      `No schedule found for ${SABBATH}`,
    ],
  ];

  it.each(breakages)('still gives the week when %s, saying the schedule is not set', (_, breakIt) => {
    const workbook = createChurchWorkbook();
    breakIt(workbook);
    const context = load(workbook);

    const bulletin = softBulletin(context);

    expect(bulletin.scheduleNotSet).toBe(true);
    expect(bulletin.date).toBe(SABBATH);
    expect(bulletin.quarter).toBe('');
    expect(bulletin.queens.sermon).toBe('');
    expect(bulletin.brooklyn.offeringPrayer).toBe('');
    // Weekly Data's content still comes.
    expect(bulletin.queens.bibleVerses).toBe('John 10:11-16');
    expect(bulletin.queens.sermonTitle).toEqual({ english: 'The Good Shepherd', chinese: '好牧人' });
  });

  it.each(breakages)('gives older apps the same error as before when %s', (_, breakIt, error) => {
    const workbook = createChurchWorkbook();
    breakIt(workbook);
    const context = load(workbook);

    expect(() => buildBulletin(context)).toThrow(error);
    expect(request(context)).toEqual({ ok: false, error });
    expect(request(context, '1.5.0')).toEqual({ ok: false, error });
    expect(request(context, '1.6.0')).toMatchObject({ ok: true, bulletin: { scheduleNotSet: true } });
  });

  it('leaves scheduleNotSet out while the schedule is there', () => {
    const context = load(createChurchWorkbook());

    const response = request(context, '1.6.0');

    expect(response.ok).toBe(true);
    expect(response.bulletin).not.toHaveProperty('scheduleNotSet');
    expect(response.bulletin?.quarter).toBe('Q4');
  });

  it("doesn't hand an older app a bulletin cached for a newer one", () => {
    const workbook = createChurchWorkbook();
    workbook.sheet('Sabbath Calendar').grid.splice(1, 1);
    const context = load(workbook);

    expect(request(context, '1.6.0').ok).toBe(true);
    expect(request(context, '1.5.0').ok).toBe(false);
  });

  it.each([
    ['1.6.0', true],
    ['1.6.2', true],
    ['1.10.0', true],
    ['2', true],
    ['1.6', true],
    ['1.5.9', false],
    ['0.43.0', false],
    ['', false],
    ['1.6.0-beta', false],
    ['latest', false],
  ])('counts app version %p as showing it: %p', (version, expected) => {
    const context = load(createChurchWorkbook());

    expect(run(context, `isAppVersionAtLeast_(${JSON.stringify(version)}, SCHEDULE_NOT_SET_APP_VERSION)`)).toBe(expected);
  });
});
