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
  // Since #562, read by name like the rest, so last here.
  'Announcements',
];

const SABBATH = '2026-11-07';
// The API answers only for Sabbaths near today, so the tests fix today.
const TODAY = '2026-11-04';

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

const load = (
  workbook: FakeWorkbook,
  properties?: Map<string, string>,
  scriptProperties?: Map<string, string>,
) => {
  const cache = new Map<string, string>();
  const propertyStore = (store: Map<string, string>) => ({
    getProperty: (key: string) => store.get(key) ?? null,
    setProperty: (key: string, value: string) => store.set(key, value),
  });
  const context = createContext({
    CacheService: {
      getScriptCache: () => ({
        get: (key: string) => cache.get(key) ?? null,
        put: (key: string, value: string) => cache.set(key, value),
        removeAll: (keys: string[]) => keys.forEach((key) => cache.delete(key)),
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
    PropertiesService:
      properties || scriptProperties
        ? {
            ...(properties ? { getDocumentProperties: () => propertyStore(properties) } : {}),
            ...(scriptProperties ? { getScriptProperties: () => propertyStore(scriptProperties) } : {}),
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
    'AnnouncementPublishing.gs',
  ].forEach((file) =>
    runInContext(readFileSync(join(process.cwd(), 'google-apps-script', file), 'utf8'), context),
  );
  runInContext(`getPrintedBulletinToday_ = function () { return '${TODAY}'; }`, context);
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
    // The lines go in through the context, so no code is built from them.
    const take = (lines: string[]) =>
      run<string[]>(Object.assign(context, { testLines: lines }), 'takeNewBulletinRenames_(testLines)');

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
        'doGet({ parameter: testParameter }).text',
        Object.assign(context, { testParameter: { date: SABBATH, ...(appVersion ? { appVersion } : {}) } }),
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

    expect(
      run(Object.assign(context, { testVersion: version }), 'isAppVersionAtLeast_(testVersion, SCHEDULE_NOT_SET_APP_VERSION)'),
    ).toBe(expected);
  });
});

describe('changeovers kept for older apps', () => {
  type Status = {
    id: string;
    retiresWith: string;
    watchedSince: string;
    olderAppLastCalled: string;
    quietDays: number;
    ready: boolean;
  };

  const LAST_CALLED = 'bulletin.changeover.schedule-not-set.olderAppLastCalled';
  const WATCHED_SINCE = 'bulletin.changeover.schedule-not-set.watchedSince';

  // The script's day is set by the test, and every property write is counted.
  const setUp = (today = '2026-11-20') => {
    const scriptProperties = new Map<string, string>();
    const writes: string[] = [];
    const set = scriptProperties.set.bind(scriptProperties);
    scriptProperties.set = (key: string, value: string) => {
      writes.push(key);
      return set(key, value);
    };
    const context = load(createChurchWorkbook(), undefined, scriptProperties);
    const setToday = (day: string) =>
      runInContext(
        'getPrintedBulletinToday_ = function () { return testToday; }',
        Object.assign(context, { testToday: day }),
      );
    setToday(today);
    const ask = (parameter: Record<string, string>) =>
      JSON.parse(
        runInContext('doGet({ parameter: testParameter }).text', Object.assign(context, { testParameter: parameter })) as string,
      );
    const status = () => {
      const response = ask({ changeovers: '1' });
      expect(response.ok).toBe(true);
      return response.changeovers as Status[];
    };
    return { scriptProperties, writes, context, setToday, ask, status };
  };

  it.each([
    ['without a version, as apps before 1.6.0 do', {}],
    ['from 1.5.0', { appVersion: '1.5.0' }],
  ])('notes the day an older app asks for a bulletin: %s', (_, parameter) => {
    const { scriptProperties, ask } = setUp();

    expect(ask({ date: SABBATH, ...parameter }).ok).toBe(true);

    expect(scriptProperties.get(LAST_CALLED)).toBe('2026-11-20');
  });

  it.each([
    ['an app on the changeover version', { appVersion: '1.6.0' }],
    ['a newer app', { appVersion: '1.7.2' }],
    ["the API's own checks", { client: 'check' }],
    ["something that isn't the app", { appVersion: 'latest' }],
    ['a request without a valid date', { date: 'soon' }],
  ])("doesn't take %s for an older app", (_, parameter) => {
    const { scriptProperties, ask } = setUp();

    ask({ date: SABBATH, ...parameter });

    expect(scriptProperties.has(LAST_CALLED)).toBe(false);
  });

  it('writes the day once while the cache remembers it, however many older apps ask', () => {
    const { writes, ask, setToday, scriptProperties } = setUp();

    ask({ date: SABBATH });
    ask({ date: SABBATH, appVersion: '1.5.0' });
    ask({ date: SABBATH });
    expect(writes).toEqual([LAST_CALLED]);

    setToday('2026-11-21');
    ask({ date: SABBATH });
    expect(writes).toEqual([LAST_CALLED, LAST_CALLED]);
    expect(scriptProperties.get(LAST_CALLED)).toBe('2026-11-21');
  });

  it.each([
    ['the script properties are unavailable', ''],
    ["the day can't be read", "getPrintedBulletinToday_ = function () { throw new Error('no clock'); };"],
  ])("still gives the bulletin when %s", (_, breakIt) => {
    const context = load(createChurchWorkbook());
    runInContext(breakIt, context);

    const response = JSON.parse(
      runInContext(`doGet({ parameter: { date: '${SABBATH}' } }).text`, context) as string,
    );

    expect(response.ok).toBe(true);
    expect(response.bulletin.date).toBe(SABBATH);
  });

  it('starts watching the first time the status is read, so nothing is ready at once', () => {
    const { status, scriptProperties } = setUp();

    expect(status()).toEqual([
      expect.objectContaining({
        id: 'schedule-not-set',
        retiresWith: '1.6.0',
        watchedSince: '2026-11-20',
        olderAppLastCalled: '',
        quietDays: 14,
        ready: false,
      }),
    ]);
    expect(scriptProperties.get(WATCHED_SINCE)).toBe('2026-11-20');
  });

  it('is ready once no older app has asked for 14 days', () => {
    const { scriptProperties, status, setToday } = setUp();
    scriptProperties.set(WATCHED_SINCE, '2026-11-03');
    scriptProperties.set(LAST_CALLED, '2026-11-20');

    setToday('2026-12-03');
    expect(status()[0].ready).toBe(false);

    setToday('2026-12-04');
    expect(status()[0]).toMatchObject({ olderAppLastCalled: '2026-11-20', ready: true });
  });

  it('waits 14 days from when watching started when no older app has asked', () => {
    const { scriptProperties, status, setToday } = setUp();
    scriptProperties.set(WATCHED_SINCE, '2026-11-03');

    setToday('2026-11-16');
    expect(status()[0].ready).toBe(false);

    setToday('2026-11-17');
    expect(status()[0].ready).toBe(true);
  });

  it('marks each changeover with an app version and what to remove', () => {
    const context = load(createChurchWorkbook());

    const list = run<{ id: string; retiresWith: string; cleanup: string }[]>(context, 'BULLETIN_CHANGEOVERS');

    expect(list.length).toBeGreaterThan(0);
    list.forEach((changeover) => {
      expect(changeover.id).toMatch(/^[a-z0-9-]+$/);
      expect(run(Object.assign(context, { testVersion: changeover.retiresWith }), "isAppVersionAtLeast_(testVersion, '0')")).toBe(true);
      expect(changeover.cleanup.length).toBeGreaterThan(20);
    });
    expect(new Set(list.map((changeover) => changeover.id)).size).toBe(list.length);
  });
});

describe('the public API', () => {
  const ask = (context: object, parameter: Record<string, string>) =>
    JSON.parse(runInContext(`doGet({ parameter: ${JSON.stringify(parameter)} }).text`, context) as string) as {
      ok: boolean;
      error?: string;
      bulletin?: { date: string };
    };

  it.each([
    ['14 days back', '2026-10-21'],
    ['today', TODAY],
    ['120 days ahead', '2027-03-04'],
  ])('answers for a date %s', (_, date) => {
    const context = load(createChurchWorkbook());

    const response = ask(context, { date, appVersion: '1.6.0' });

    expect(response.ok).toBe(true);
    expect(response.bulletin?.date).toBe(date);
  });

  it.each([
    ['more than 14 days back', '2026-10-20'],
    ['a year back', '2025-11-08'],
    ['more than 120 days ahead', '2027-03-05'],
  ])("doesn't answer for a date %s, and says which dates it does", (_, date) => {
    const context = load(createChurchWorkbook());

    expect(ask(context, { date, appVersion: '1.6.0' })).toEqual({
      ok: false,
      error: 'Bulletins are available from 2026-10-21 to 2027-03-04',
    });
    // Nor for the API's own checks or an older app.
    expect(ask(context, { date, client: 'check' }).ok).toBe(false);
    expect(ask(context, { date }).ok).toBe(false);
  });

  it('still says what a bad date is', () => {
    const context = load(createChurchWorkbook());

    expect(ask(context, { date: '2026-02-30' })).toEqual({
      ok: false,
      error: 'A valid date query parameter is required (YYYY-MM-DD)',
    });
  });

  it("logs any other failure and answers with a fixed message, so Google's own error text never leaves", () => {
    const workbook = createChurchWorkbook();
    const context = load(workbook);
    const logged: string[] = [];
    runInContext('console = { error: function (text) { logged.push(String(text)); } };', Object.assign(context, { logged }));
    workbook.getSheetByName = () => {
      throw new Error('Service Spreadsheets failed while accessing document with id 1abc.');
    };

    expect(ask(context, { date: SABBATH, appVersion: '1.6.0' })).toEqual({
      ok: false,
      error: 'The bulletin is unavailable right now. Please try again later.',
    });
    expect(logged.join('\n')).toContain('Service Spreadsheets failed');
  });
});

describe('announcements (#562)', () => {
  // Announcements in column C, where it's added by hand, before the tab's
  // other columns: it's read by name wherever it is.
  const headers = ['Date', 'Location', 'Announcements', ...WEEKLY_HEADERS.slice(2, -1)];
  const weeklyRow = (location: string, announcements: string) =>
    [SABBATH, location, announcements, 'John 10:11-16', 'The Good Shepherd', '好牧人', '', '', '', '', '', ''];
  const announcementsWorkbook = () =>
    createWorkbook({
      'Sabbath Calendar': [SCHEDULE_HEADERS, scheduleRow()],
      'Weekly Data': [
        headers,
        weeklyRow('Queens', 'Fellowship lunch after the service.\nEveryone is welcome.'),
        weeklyRow('Brooklyn', '查經班改到週三。'),
      ],
      'Name Dictionary': [['English Name', 'Chinese Name'], ['Ada Lin', '林愛達']],
      Leadership: [['Pastors', 'Elders'], ['Ada Lin', 'Ben Hall']],
    });
  const withTranslator = (context: object) =>
    Object.assign(context, {
      LanguageApp: { translate: (text: string, _source: string, target: string) => text.split('\n').map((line) => `[${target}] ${line}`).join('\n') },
    });

  it('reads the column by name, in column C as in the sheet', () => {
    expect(headers.slice(0, 4)).toEqual(['Date', 'Location', 'Announcements', 'Bible Verses']);
    expect(weeklyRow('Queens', 'x')).toHaveLength(headers.length);
  });

  it("sends each location's own, in English, Chinese and Spanish", () => {
    const context = withTranslator(load(announcementsWorkbook()));
    const response = JSON.parse(
      runInContext(`doGet({ parameter: { date: '${SABBATH}', appVersion: '1.9.0' } }).text`, context) as string,
    );
    expect(response.ok).toBe(true);
    // The cell is one announcement, in every language, its line break kept.
    expect(response.bulletin.queens.announcements).toEqual([
      {
        english: '[en] Fellowship lunch after the service.\n[en] Everyone is welcome.',
        chinese: '[zh-TW] Fellowship lunch after the service.\n[zh-TW] Everyone is welcome.',
        spanish: '[es] Fellowship lunch after the service.\n[es] Everyone is welcome.',
      },
    ]);
    expect(response.bulletin.brooklyn.announcements).toEqual([
      { english: '[en] 查經班改到週三。', chinese: '查經班改到週三。', spanish: '[es] 查經班改到週三。' },
    ]);
    // Only the list goes out, not the cells it came from.
    expect(JSON.stringify(response)).not.toContain('announcementText');
  });

  it('prints the same ones, in Chinese and English', () => {
    const context = withTranslator(load(announcementsWorkbook()));
    expect(
      run(context, `getPhysicalPrintedAnnouncementEntries_(buildBulletin_('${SABBATH}', { includeFullNames: true }), 'brooklyn')`),
    ).toEqual([{ english: '[en] 查經班改到週三。', chinese: '查經班改到週三。' }]);
  });

  it("fills the print dialog with the same ones, and prints them unchanged when they're sent back untouched", () => {
    const context = withTranslator(load(announcementsWorkbook()));
    const shown = run<{ english: string; chinese: string }[]>(
      context,
      `getPrintedBulletinPromptData('${SABBATH}', 'queens').announcements`,
    );
    expect(shown).toEqual([
      {
        english: '[en] Fellowship lunch after the service.\n[en] Everyone is welcome.',
        chinese: '[zh-TW] Fellowship lunch after the service.\n[zh-TW] Everyone is welcome.',
      },
    ]);
    expect(run(context, `completePrintedAnnouncements_(${JSON.stringify(shown)}, 'queens')`)).toEqual(
      run(context, `getPhysicalPrintedAnnouncementEntries_(buildBulletin_('${SABBATH}', { includeFullNames: true }), 'queens')`),
    );
  });

  it("prints the dialog's changes, translating a side left blank, for that location only", () => {
    const context = withTranslator(load(announcementsWorkbook()));
    expect(
      run(
        context,
        `completePrintedAnnouncements_(${JSON.stringify([
          { english: 'Potluck at noon.\nBring a dish.', chinese: '' },
          { english: '', chinese: '查經班。' },
          { english: 'Both typed.', chinese: '兩邊都有。' },
          { english: ' ', chinese: '' },
          // As a dialog opened before #562 sends them.
          { scope: 'brooklyn', english: 'Brooklyn only.', chinese: '' },
          { scope: 'all', english: 'Both locations.', chinese: '' },
        ])}, 'queens')`,
      ),
    ).toEqual([
      // Line by line, so the line break stays.
      { english: 'Potluck at noon.\nBring a dish.', chinese: '[zh-TW] Potluck at noon.\n[zh-TW] Bring a dish.' },
      { english: '[en] 查經班。', chinese: '查經班。' },
      { english: 'Both typed.', chinese: '兩邊都有。' },
      { english: 'Both locations.', chinese: '[zh-TW] Both locations.' },
    ]);
    expect(run(context, `completePrintedAnnouncements_([], 'queens')`)).toEqual([]);
    expect(run(context, `completePrintedAnnouncements_('nope', 'queens')`)).toEqual([]);
    expect(run(context, `completePrintedAnnouncements_([null, { english: 'A' }], 'queens')`)).toEqual([
      { english: 'A', chinese: '[zh-TW] A' },
    ]);
  });

  it("passes the dialog's announcements to the print, and none to print Weekly Data's", () => {
    const context = load(announcementsWorkbook());
    const sent = run<unknown[]>(
      context,
      `(function () {
        var calls = [];
        createPrintedBulletin_ = function () { calls.push(arguments[4]); return {}; };
        prunePrintedBulletinProperties_ = function () {};
        createPrintedBulletinFromRequest({ date: '${SABBATH}', location: 'queens', announcements: [{ english: 'A', chinese: '' }] });
        createPrintedBulletinFromRequest({ date: '${SABBATH}', location: 'queens' });
        return calls;
      })()`,
    );
    expect(sent).toEqual([[{ english: 'A', chinese: '' }], null]);
    expect(runInContext('createPrintedBulletinUnlocked_.toString()', context)).toContain(
      'completePrintedAnnouncements_(printAnnouncements, location)',
    );
  });

  it('sends an empty list for blank cells, or a location with no Weekly Data row', () => {
    // Queens's row leaves the cell blank, and Brooklyn has no row.
    const context = load(createChurchWorkbook());
    const bulletin = run<{ queens: { announcements: unknown }; brooklyn: { announcements: unknown } }>(
      context,
      `buildBulletin_('${SABBATH}', {})`,
    );
    expect(bulletin.queens.announcements).toEqual([]);
    expect(bulletin.brooklyn.announcements).toEqual([]);
  });

  // Phones notify only of an announcement staff published (#709), and only a
  // short list of accounts can publish. Made-up accounts throughout.
  describe('published to phones (#709)', () => {
    const PUBLISHER = 'avery.publisher@example.org';
    const QUEENS = 'Fellowship lunch after the service.\nEveryone is welcome.';
    const publishing = (
      { email = PUBLISHER, publishers = `${PUBLISHER}, casey.it@example.org`, brooklyn = '查經班改到週三。' } = {},
      scriptProperties = new Map<string, string>(),
    ) => {
      if (publishers) scriptProperties.set('ANNOUNCEMENT_PUBLISHER_EMAILS', publishers);
      const workbook = createWorkbook({
        'Sabbath Calendar': [SCHEDULE_HEADERS, scheduleRow()],
        'Weekly Data': [headers, weeklyRow('Queens', QUEENS), weeklyRow('Brooklyn', brooklyn)],
        'Name Dictionary': [['English Name', 'Chinese Name'], ['Ada Lin', '林愛達']],
        Leadership: [['Pastors', 'Elders'], ['Ada Lin', 'Ben Hall']],
      });
      const ui = { alerts: [] as string[], dialogs: [] as string[] };
      const context = withTranslator(load(workbook, undefined, scriptProperties));
      Object.assign(context, {
        Session: { getActiveUser: () => ({ getEmail: () => email }), getScriptTimeZone: () => 'America/New_York' },
        LockService: { getScriptLock: () => ({ waitLock: () => undefined, releaseLock: () => undefined }) },
        HtmlService: {
          createHtmlOutput: (html: string) => {
            const output = { html, setWidth: () => output, setHeight: () => output };
            return output;
          },
        },
      });
      (context as unknown as { SpreadsheetApp: Record<string, unknown> }).SpreadsheetApp.getUi = () => ({
        ButtonSet: { OK: 'OK' },
        alert: (_title: string, message: string) => ui.alerts.push(message),
        showModalDialog: (output: { html: string }) => ui.dialogs.push(output.html),
      });
      return { context, scriptProperties, ui };
    };
    const api = (context: object) =>
      JSON.parse(runInContext(`doGet({ parameter: { date: '${SABBATH}', appVersion: '1.10.0' } }).text`, context) as string)
        .bulletin as { queens: Record<string, unknown>; brooklyn: Record<string, unknown> };
    const publish = (context: object, texts: Record<string, string>, date = SABBATH) =>
      run<{ published: string[]; at: string }>(context, `publishAnnouncementsFromDialog(${JSON.stringify({ date, texts })})`);
    const stored = (scriptProperties: Map<string, string>) =>
      JSON.parse(scriptProperties.get('announcements.published') ?? '{}');

    it('is for the coming Sabbath, or next week’s once it’s the Sabbath', () => {
      const { context } = publishing();
      expect(run(context, `getAnnouncementsPublishDate_('2026-11-24')`)).toBe('2026-11-28');
      expect(run(context, `getAnnouncementsPublishDate_('2026-11-27')`)).toBe('2026-11-28');
      expect(run(context, `getAnnouncementsPublishDate_('2026-11-28')`)).toBe('2026-12-05');
    });

    it('sends no publish time until someone publishes, then each published location’s', () => {
      const { context, scriptProperties } = publishing();
      expect(api(context).queens.announcementsPublishedAt).toBe('');
      expect(api(context).brooklyn.announcementsPublishedAt).toBe('');

      const result = publish(context, { queens: QUEENS });
      expect(result.published).toEqual(['queens']);
      expect(stored(scriptProperties)).toEqual({ [SABBATH]: { queens: { at: result.at, text: QUEENS } } });
      // The API's two-minute copy from before is cleared, so a phone gets it at once.
      expect(api(context).queens.announcementsPublishedAt).toBe(result.at);
      expect(api(context).brooklyn.announcementsPublishedAt).toBe('');
      // No sheet changes: the time is only in Script Properties.
      expect(JSON.stringify(api(context))).not.toContain(PUBLISHER);
    });

    it('publishes each location once', () => {
      const { context, scriptProperties } = publishing();
      const first = publish(context, { queens: QUEENS });
      expect(publish(context, { queens: QUEENS, brooklyn: '查經班改到週三。' }).published).toEqual(['brooklyn']);
      expect(stored(scriptProperties)[SABBATH].queens.at).toBe(first.at);
    });

    it('counts changed text as not published, even cleared and typed again, until someone publishes it', () => {
      const { context, scriptProperties } = publishing();
      const first = publish(context, { queens: QUEENS });
      expect(api(context).queens.announcementsPublishedAt).toBe(first.at);

      // Someone types a new announcement over the published one.
      const sheet = (context as unknown as { workbook: FakeWorkbook }).workbook.sheet('Weekly Data');
      sheet.grid[1][2] = 'Choir practice moved to 3 pm.';
      runInContext(`CacheService.getScriptCache().removeAll(['bulletin:' + CONFIG.cacheVersion + ':schedule-optional:${SABBATH}'])`, context);
      expect(api(context).queens.announcements).toHaveLength(1);
      expect(api(context).queens.announcementsPublishedAt).toBe('');
      // The dialog offers it again, saying why, and publishing it makes it so.
      const data = run<{ locations: { key: string; publishedAt: string; changed: boolean }[] }>(
        context,
        `getPublishAnnouncementsData_(workbook, '${TODAY}')`,
      );
      expect(data.locations[0]).toMatchObject({ key: 'queens', publishedAt: '', changed: true });
      const again = publish(context, { queens: 'Choir practice moved to 3 pm.' });
      expect(again.published).toEqual(['queens']);
      expect(api(context).queens.announcementsPublishedAt).toBe(again.at);
      expect(stored(scriptProperties)[SABBATH].queens.text).toBe('Choir practice moved to 3 pm.');
    });

    it('says so when the publish times would outgrow their property', () => {
      const { context } = publishing();
      runInContext('ANNOUNCEMENTS_PUBLISHED_MAX_LENGTH = 50', context);
      expect(() => publish(context, { queens: QUEENS })).toThrow(/too long to publish/);
    });

    it('lets only the accounts on its own list publish, checked where the time is written', () => {
      const refused = /Only a few accounts can publish announcements to phones[\s\S]*只有少数账号/;
      // No list: nobody, not even a bulletin admin.
      const scriptProperties = new Map([['PHYSICAL_BULLETIN_ADMIN_EMAILS', PUBLISHER]]);
      const empty = publishing({ publishers: '' }, scriptProperties);
      expect(() => publish(empty.context, { queens: QUEENS })).toThrow(refused);
      expect(() => runInContext(`writeAnnouncementsPublished_({})`, empty.context)).toThrow(refused);
      expect(scriptProperties.has('announcements.published')).toBe(false);
      // Not on it, or Google doesn't say who it is.
      expect(() => publish(publishing({ email: 'drew.editor@example.org' }).context, { queens: QUEENS })).toThrow(refused);
      expect(() => publish(publishing({ email: '' }).context, { queens: QUEENS })).toThrow(refused);
      // On it, in any case, with any separator.
      const listed = publishing({ email: 'Casey.IT@example.org', publishers: `${PUBLISHER};\ncasey.it@example.org` });
      expect(publish(listed.context, { queens: QUEENS }).published).toEqual(['queens']);
    });

    it('says so, rather than showing the dialog, to an account not on the list', () => {
      const { context, ui } = publishing({ publishers: '' });
      runInContext('openPublishAnnouncementsDialog()', context);
      expect(ui.dialogs).toEqual([]);
      expect(ui.alerts).toEqual([expect.stringContaining('ask the technology team (IT)')]);
    });

    it('publishes only what the dialog showed, for the Sabbath it showed', () => {
      const { context, scriptProperties } = publishing({ brooklyn: '' });
      expect(() => publish(context, { queens: 'Fellowship lunch.' })).toThrow(/changed in Weekly Data since this opened/);
      expect(() => publish(context, { brooklyn: '' })).toThrow(/Weekly Data has no announcement/);
      expect(() => publish(context, {})).toThrow(/Choose a location/);
      expect(() => publish(context, { queens: QUEENS }, '2026-11-14')).toThrow(/This dialog is out of date/);
      expect(scriptProperties.has('announcements.published')).toBe(false);
    });

    it('sends no time for a location without an announcement, and reads a broken property as nothing published', () => {
      const scriptProperties = new Map([['announcements.published', JSON.stringify({ [SABBATH]: { brooklyn: { at: '2026-11-04T15:00:00.000Z', text: '' } } })]]);
      expect(api(publishing({ brooklyn: '' }, scriptProperties).context).brooklyn.announcementsPublishedAt).toBe('');

      const broken = publishing({}, new Map([['announcements.published', 'not json']]));
      expect(api(broken.context).queens.announcementsPublishedAt).toBe('');
      expect(api(broken.context).queens.announcements).toHaveLength(1);
    });

    it('drops Sabbaths more than five weeks old', () => {
      const scriptProperties = new Map([
        ['announcements.published', JSON.stringify({ '2026-09-26': { queens: { at: 'x', text: 'x' } }, '2026-10-31': { queens: { at: 'y', text: 'y' } }, junk: {} })],
      ]);
      const { context } = publishing({}, scriptProperties);
      publish(context, { queens: QUEENS });
      expect(Object.keys(stored(scriptProperties)).sort()).toEqual(['2026-10-31', SABBATH]);
    });

    it('shows the text and asks first, saying plainly in both languages that it notifies everyone', () => {
      const { context, ui } = publishing({ brooklyn: '<b>Bring a dish</b> & a friend' }, new Map([
        ['announcements.published', JSON.stringify({ [SABBATH]: { queens: { at: '2026-11-04T15:00:00.000Z', text: QUEENS } } })],
      ]));
      // The dialog translates nothing, so Apps Script's date formatter is all it needs here.
      Object.assign(context, {
        Utilities: { formatDate: (date: Date, zone: string, pattern: string) => `${pattern} in ${zone}: ${date.toISOString()}` },
      });
      runInContext('openPublishAnnouncementsDialog()', context);
      expect(ui.dialogs).toHaveLength(1);
      const html = ui.dialogs[0];
      expect(html).toContain('This notifies everyone with the app / 这会通知所有使用应用的人');
      expect(html).toContain('within a few hours');
      expect(html).toContain('some iPhones only when the app is next opened');
      expect(html).toContain('after sunset on Friday');
      expect(html).toContain('It can’t be taken back.');
      expect(html).toContain('发布后无法撤回');
      expect(html).toContain('Publish &amp; notify / 发布并通知');
      expect(html).toContain(`Sabbath / 安息日：${SABBATH}`);
      // Queens was published: it says when, and can't be again. Brooklyn's
      // text shows as typed, never as markup.
      expect(html).toContain('✓ Published / 已发布 · EEE, MMM d, h:mm a in America/New_York: 2026-11-04T15:00:00.000Z');
      expect(html).toMatch(/value="queens" disabled/);
      expect(html).toMatch(/value="brooklyn" checked/);
      expect(html).toContain('&lt;b&gt;Bring a dish&lt;/b&gt; &amp; a friend');
      expect(html).not.toContain('<b>Bring a dish</b>');
    });
  });
});
