import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const INTAKE_HEADERS = [
  'Date',
  'Location',
  'English Hymn of Praise',
  'Chinese Hymn of Praise',
  'English Sermon Title',
  'Chinese Sermon Title',
  'English Hymn of Response',
  'Chinese Hymn of Response',
  'Bible Verses',
];

// Added for the Sabbath School hymns and special music (#558).
const NEW_INTAKE_HEADERS = [
  'Sabbath School Hymn 1',
  'Sabbath School Hymn 2',
  'Sabbath School Hymn 3',
  'Special Music Title',
];

// The Weekly Data tab's headers since #558: the speaker's columns, then the
// hymns in the order they're sung, with one cell for each hymn.
const WEEKLY_HEADERS = [
  'Date', 'Location', 'Bible Verses', 'English Sermon Title', 'Chinese Sermon Title',
  'Sabbath School Hymn 1', 'Sabbath School Hymn 2', 'Sabbath School Hymn 3',
  'Hymn of Praise', 'Special Music Title', 'Hymn of Response',
];

const createSheet = (name: string, headers: string[], rows: string[][] = []) => ({
  getName: () => name,
  getDataRange: () => ({
    getValues: () => [headers, ...rows],
    getDisplayValues: () => [headers, ...rows],
  }),
});

const createIntakeSheet = (rows: string[][], headers = INTAKE_HEADERS) =>
  createSheet('Weekly Data', headers, rows);

const loadBulletinApi = (globals: Record<string, unknown> = {}) => {
  const context = createContext(globals);
  runInContext(
    readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
    context,
  );
  return context;
};

// The Sabbath Calendar's expected headers, in order.
const getScheduleHeaders = () =>
  JSON.parse(
    runInContext(`JSON.stringify(BULLETIN_SHEET_COLUMNS['Sabbath Calendar'])`, loadBulletinApi()) as string,
  ) as string[];

// The columns reported missing for a workbook with these Sabbath Calendar
// headers and a weekly tab with these headers under this name.
const getMissingColumns = (
  headers: string[],
  tabName = 'Weekly Data',
  scheduleHeaders = getScheduleHeaders(),
) => {
  const context = loadBulletinApi();
  context.testSpreadsheet = {
    getSheetByName: (name: string) =>
      name === 'Sabbath Calendar'
        ? createSheet(name, scheduleHeaders)
        : name === tabName
          ? createSheet(name, headers)
          : null,
  };
  return JSON.parse(
    runInContext('JSON.stringify(getMissingBulletinColumns_(testSpreadsheet))', context) as string,
  ) as string[];
};

// The Weekly Data fields read from one row under these headers.
const readWeeklyRows = (headers: string[], rows: string[][]) => {
  const context = loadBulletinApi({
    testSpreadsheet: {
      getSheetByName: (name: string) =>
        name === 'Weekly Data' ? createSheet(name, headers, rows) : null,
    },
  });
  return JSON.parse(
    runInContext(
      `JSON.stringify((function () {
        var location = createLocation_();
        populateBulletinIntake_(
          location,
          getBulletinIntakeRows_(testSpreadsheet, '2026-11-07', 'queens')
        );
        return location;
      })())`,
      context,
    ) as string,
  );
};

const readWeeklyRow = (headers: string[], row: string[]) => readWeeklyRows(headers, [row]);

describe('Apps Script bulletin response merging', () => {
  it('maps the Sabbath School opening prayer under its explicit API field', () => {
    const context = createContext({});
    runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
      context,
    );

    const field = JSON.parse(
      runInContext(
        "JSON.stringify(COLUMN_SCHEMA.find(function (entry) { return entry.header === 'SS Opening Prayer'; }))",
        context,
      ) as string,
    );

    expect(field).toEqual({
      header: 'SS Opening Prayer',
      path: ['queens', 'ssOpeningPrayer'],
      person: true,
    });
  });

  it('maps the Queens youth teacher beside the children teacher', () => {
    const context = createContext({});
    runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
      context,
    );

    const field = JSON.parse(
      runInContext(
        "JSON.stringify(COLUMN_SCHEMA.find(function (entry) { return entry.header === 'Youth Teacher'; }))",
        context,
      ) as string,
    );

    expect(field).toEqual({
      header: 'Youth Teacher',
      path: ['queens', 'youthTeacher'],
      person: true,
    });
  });

  it('returns all supported metadata translations with English fallback', () => {
    const context = createContext({
      LanguageApp: {
        translate: (value: string, _source: string, target: string) =>
          `${target}:${value}`,
      },
    });
    runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
      context,
    );

    const output = JSON.parse(
      runInContext(
        `JSON.stringify(buildBulletinMetadataTranslations_({
          specialRemark: 'Communion Sabbath',
          tithePurpose: 'Local Conference Advance',
          pastorTravel: 'Pastor travel',
        }))`,
        context,
      ) as string,
    );

    expect(output.tithePurpose).toEqual({
      en: 'Local Conference Advance',
      zh: 'zh-TW:Local Conference Advance',
      'zh-cn': 'zh-CN:Local Conference Advance',
      es: 'es:Local Conference Advance',
    });
  });

  it('maps the Queens flower offering after the closing prayer', () => {
    const context = createContext({});
    runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
      context,
    );

    const field = JSON.parse(
      runInContext(
        "JSON.stringify(COLUMN_SCHEMA.find(function (entry) { return entry.header === 'Flower Offering'; }))",
        context,
      ) as string,
    );

    expect(field).toEqual({
      header: 'Flower Offering',
      path: ['queens', 'flowerOffering'],
      person: true,
    });
  });

  it('maps the Brooklyn roster columns in spreadsheet order', () => {
    const context = createContext({});
    runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
      context,
    );

    const fields = JSON.parse(
      runInContext(
        `JSON.stringify(COLUMN_SCHEMA.filter(function (entry) {
          return entry.path[0] === 'brooklyn';
        }).map(function (entry) {
          return { header: entry.header, path: entry.path };
        }))`,
        context,
      ) as string,
    );

    expect(fields).toEqual([
      { header: 'Brooklyn Sermon', path: ['brooklyn', 'sermon'] },
      { header: 'Chair/Pastoral Prayer', path: ['brooklyn', 'chairPastoralPrayer'] },
      { header: 'Offering Prayer', path: ['brooklyn', 'offeringPrayer'] },
      { header: 'Technician', path: ['brooklyn', 'technician'] },
      { header: 'Encouragement', path: ['brooklyn', 'encouragement'] },
      { header: 'Sabbath School', path: ['brooklyn', 'sabbathSchool'] },
    ]);
  });

  it('uses the reviewed Weekly Data row for bulletin content', () => {
    const intakeRows = [
      [
        '2026-08-08',
        'Queens',
        'Reviewed hymn',
        '審核後讚美詩',
        'Reviewed sermon',
        '審核後講題',
        '',
        '',
        'John 3:16',
      ],
    ];
    const spreadsheet = {
      getSheetByName: (name: string) =>
        name === 'Weekly Data'
          ? createIntakeSheet(intakeRows)
          : null,
    };
    const context = createContext({ testSpreadsheet: spreadsheet });
    runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
      context,
    );

    const location = JSON.parse(
      runInContext(
        `JSON.stringify((function () {
          var location = createLocation_();
          populateBulletinIntake_(
            location,
            getBulletinIntakeRows_(testSpreadsheet, '2026-08-08', 'queens')
          );
          return location;
        })())`,
        context,
      ) as string,
    );

    expect(location.hymnOfPraise).toEqual({
      english: 'Reviewed hymn',
      chinese: '審核後讚美詩',
    });
    expect(location.sermonTitle).toEqual({
      english: 'Reviewed sermon',
      chinese: '審核後講題',
    });
    expect(location.bibleVerses).toBe('John 3:16');
    expect(location.sabbathSchoolHymns).toEqual([]);
    expect(location.specialMusicTitle).toBe('');
  });

  it('reads the Sabbath School hymns in order without blank cells, and the special music title', () => {
    const headers = [...INTAKE_HEADERS, ...NEW_INTAKE_HEADERS];
    const row = ['2026-10-31', 'Brooklyn', '', '', '', '', '', '', ''];
    const spreadsheet = {
      getSheetByName: (name: string) =>
        name === 'Weekly Data'
          ? createSheet(name, headers, [
              [...row, '第413首 教會根基', '', 'AH 73 Holy, Holy, Holy', 'It Is Well'],
            ])
          : null,
    };
    const context = loadBulletinApi({ testSpreadsheet: spreadsheet });

    const location = JSON.parse(
      runInContext(
        `JSON.stringify((function () {
          var location = createLocation_();
          populateBulletinIntake_(
            location,
            getBulletinIntakeRows_(testSpreadsheet, '2026-10-31', 'brooklyn')
          );
          return location;
        })())`,
        context,
      ) as string,
    );

    expect(location.sabbathSchoolHymns).toEqual(['第413首 教會根基', 'AH 73 Holy, Holy, Holy']);
    expect(location.specialMusicTitle).toBe('It Is Well');
  });

  it('files each one-cell hymn under the language it is typed in', () => {
    const row = ['2026-11-07', 'Queens', '', '', '', '', '', '', 'AH 1 Praise to the Lord', '', '第452首 遵命有福'];
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: 'AH 1 Praise to the Lord', chinese: '' },
      hymnOfResponse: { english: '', chinese: '第452首 遵命有福' },
    });
    // A bare number is a Chinese hymnal number.
    row[8] = '205';
    row[10] = 'Cover With His Life 412';
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: '', chinese: '205' },
      hymnOfResponse: { english: 'Cover With His Life 412', chinese: '' },
    });
  });

  it('gives a blank Hymn of Praise and Hymn of Response their defaults, as if typed', () => {
    const row = ['2026-11-07', 'Queens', 'John 10:11-16', 'The Good Shepherd', '好牧人', '', '', '', '', '', ''];
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: 'AH 1 Praise to the Lord', chinese: '' },
      hymnOfResponse: { english: 'AH 348 The Church Has One Foundation', chinese: '' },
    });
    // A typed hymn is kept, in either language. A typed TBD goes out blank,
    // with no default: the app shows its own TBD, and the print its bilingual one.
    row[8] = '第5首 讚美上主';
    row[10] = ' tbd ';
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: '', chinese: '第5首 讚美上主' },
      hymnOfResponse: { english: '', chinese: '' },
    });
    // A hymn typed in a duplicate row wins over the blank one.
    row[8] = '';
    row[10] = '';
    const duplicate = [...row.slice(0, 8), 'AH 86 How Great Thou Art', '', '第452首 遵命有福'];
    expect(readWeeklyRows(WEEKLY_HEADERS, [row, duplicate])).toMatchObject({
      hymnOfPraise: { english: 'AH 86 How Great Thou Art', chinese: '' },
      hymnOfResponse: { english: '', chinese: '第452首 遵命有福' },
    });
    // With no row for the week, there's no cell to default.
    expect(readWeeklyRow(WEEKLY_HEADERS, ['2026-11-14', 'Queens', '', '', '', '', '', '', '', '', ''])).toMatchObject({
      hymnOfPraise: { english: '', chinese: '' },
      hymnOfResponse: { english: '', chinese: '' },
    });
  });

  it("gives a week with nothing else in it no defaults, so an empty Brooklyn keeps the app's joint-service note", () => {
    const empty = ['2026-11-07', 'Queens', '', '', '', '', '', '', '', '', ''];
    expect(readWeeklyRow(WEEKLY_HEADERS, empty)).toMatchObject({
      hymnOfPraise: { english: '', chinese: '' },
      hymnOfResponse: { english: '', chinese: '' },
    });
    // TBD isn't content either, as in the app.
    const tbd = ['2026-11-07', 'Queens', 'TBD', 'tbd', '', '', '', '', '', '', ''];
    expect(readWeeklyRow(WEEKLY_HEADERS, tbd).hymnOfPraise).toEqual({ english: '', chinese: '' });
    // One filled cell is enough, even a Sabbath School hymn.
    const oneHymn = ['2026-11-07', 'Queens', '', '', '', '第12首', '', '', '', '', ''];
    expect(readWeeklyRow(WEEKLY_HEADERS, oneHymn)).toMatchObject({
      hymnOfPraise: { english: 'AH 1 Praise to the Lord', chinese: '' },
      hymnOfResponse: { english: 'AH 348 The Church Has One Foundation', chinese: '' },
    });
  });

  it('counts a location as having content just as the app does', () => {
    const context = loadBulletinApi();
    // The same fields as the app's isBulletinLocationEmpty.
    const app = readFileSync(join(process.cwd(), 'services/BulletinService.ts'), 'utf8');
    const appCheck = app.slice(app.indexOf('export const isBulletinLocationEmpty'));
    const appFields = [...appCheck.slice(0, appCheck.indexOf('.some(hasBulletinValue)')).matchAll(/location\.(\w+)/g)]
      .map((match) => match[1]);
    expect(appFields.length).toBeGreaterThan(20);
    expect(JSON.parse(runInContext('JSON.stringify(BULLETIN_LOCATION_CONTENT_FIELDS)', context)).sort())
      .toEqual([...new Set(appFields)].sort());

    const hasContent = (location: object) =>
      runInContext(`bulletinLocationHasContent_(${JSON.stringify(location)})`, context);
    expect(hasContent({ hymnOfPraise: { english: '', chinese: '' }, sabbathSchoolHymns: [], announcements: '' })).toBe(false);
    // Fields the app doesn't count, such as announcements and a sunset time, don't count here.
    expect(hasContent({ announcements: 'Potluck after service', sunsetTime: '4:39 PM', sermon: ' TBD ' })).toBe(false);
    expect(hasContent({ sermon: 'Name withheld' })).toBe(true);
    expect(hasContent({ sabbathSchoolHymns: ['', '205'] })).toBe(true);
    expect(hasContent({ sermonTitle: { english: '', chinese: '好牧人' } })).toBe(true);
  });

  it('splits a service hymn typed in both languages, either way round, into its two sides', () => {
    const row = ['2026-11-07', 'Queens', '', 'The Good Shepherd', '', '', '', '',
      'How Long Do We Have To Wait? (还要等多久?)', '', '奇妙的愛（Amazing Love）'];
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: 'How Long Do We Have To Wait?', chinese: '还要等多久?' },
      hymnOfResponse: { english: 'Amazing Love', chinese: '奇妙的愛' },
    });
    // Anything else is filed whole, as before: parentheses in one language,
    // a hymn number, or both languages on one side.
    row[8] = 'Holy, Holy, Holy (Nicaea)';
    row[10] = '第5首 讚美上主 (Praise to the Lord)';
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: 'Holy, Holy, Holy (Nicaea)', chinese: '' },
      hymnOfResponse: { english: '', chinese: '第5首 讚美上主 (Praise to the Lord)' },
    });
    row[8] = 'Jesus 愛我 (Jesus Loves Me)';
    row[10] = 'AH 73 Holy, Holy, Holy';
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: '', chinese: 'Jesus 愛我 (Jesus Loves Me)' },
      hymnOfResponse: { english: 'AH 73 Holy, Holy, Holy', chinese: '' },
    });
    // TBD in either language is never split, so it still prints as TBD.
    row[8] = 'TBD (待定)';
    row[10] = '尚未確定（tbd）';
    expect(readWeeklyRow(WEEKLY_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: '', chinese: 'TBD (待定)' },
      hymnOfResponse: { english: '', chinese: '尚未確定（tbd）' },
    });
  });

  it('reads several Sabbath School hymns typed in one cell, separated by semicolons, as one each', () => {
    const row = ['2026-11-07', 'Queens', '', '', '', '第12首',
      'When the King Comes In (蒙召赴宴); Trust and Obey (信而从主)；',
      "I'll Soar Like An Eagle (如鹰展翅)", '', '', ''];
    expect(readWeeklyRow(WEEKLY_HEADERS, row).sabbathSchoolHymns).toEqual([
      '第12首',
      'When the King Comes In (蒙召赴宴)',
      'Trust and Obey (信而从主)',
      "I'll Soar Like An Eagle (如鹰展翅)",
    ]);
    // A semicolon inside parentheses, and a line break, don't split a hymn.
    row[6] = 'AH 73 Holy, Holy, Holy (verses 1; 3)';
    row[7] = 'Amazing Grace\n奇異恩典';
    expect(readWeeklyRow(WEEKLY_HEADERS, row).sabbathSchoolHymns).toEqual([
      '第12首',
      'AH 73 Holy, Holy, Holy (verses 1; 3)',
      'Amazing Grace\n奇異恩典',
    ]);
  });

  it('reads each column by its name, wherever it is', () => {
    const shuffled = [...WEEKLY_HEADERS, 'Notes'].reverse();
    const row = ['2026-11-07', 'Queens', 'John 10:11-16', 'The Good Shepherd', '好牧人',
      '第12首', '', '', 'AH 1', 'It Is Well', '第452首', 'a note'].reverse();
    expect(readWeeklyRow(shuffled, row)).toMatchObject({
      bibleVerses: 'John 10:11-16',
      sermonTitle: { english: 'The Good Shepherd', chinese: '好牧人' },
      sabbathSchoolHymns: ['第12首'],
      hymnOfPraise: { english: 'AH 1', chinese: '' },
      specialMusicTitle: 'It Is Well',
      hymnOfResponse: { english: '', chinese: '第452首' },
    });
    expect(getMissingColumns(shuffled)).toEqual([]);
  });

  it('reads a missing column as blank, and gives a missing hymn column its default, and names it, without failing the rest', () => {
    const headers = WEEKLY_HEADERS.filter((header) => header !== 'Bible Verses');
    headers[headers.indexOf('Hymn of Praise')] = 'Opening Hymn';
    const row = ['2026-11-07', 'Queens', 'The Good Shepherd', '好牧人', '', '', '', 'AH 1', '', ''];
    // A missing hymn column reads as blank, like any other, so it gets its
    // default. Opening the sheet puts the column back and names it.
    expect(readWeeklyRow(headers, row)).toMatchObject({
      bibleVerses: '',
      sermonTitle: { english: 'The Good Shepherd', chinese: '好牧人' },
      hymnOfPraise: { english: 'AH 1 Praise to the Lord', chinese: '' },
      hymnOfResponse: { english: 'AH 348 The Church Has One Foundation', chinese: '' },
    });
    expect(getMissingColumns(headers)).toEqual([
      'Weekly Data: Bible Verses',
      'Weekly Data: Hymn of Praise',
    ]);
    // Without Date or Location no row matches, and nothing throws.
    expect(readWeeklyRow(WEEKLY_HEADERS.slice(1), row.slice(1)).sermonTitle).toEqual({
      english: '',
      chinese: '',
    });
    expect(getMissingColumns(WEEKLY_HEADERS, 'Sabbath Sermon Data')).toEqual(['Weekly Data (tab)']);
  });

  it('still reads a tab with the English and Chinese hymn columns from before #558', () => {
    expect(getMissingColumns(INTAKE_HEADERS)).toEqual([
      'Weekly Data: Sabbath School Hymn 1',
      'Weekly Data: Sabbath School Hymn 2',
      'Weekly Data: Sabbath School Hymn 3',
      'Weekly Data: Special Music Title',
    ]);
    const row = ['2026-11-07', 'Queens', 'AH 1', '第5首', 'Sermon', '講題', '', '413', 'John 3:16'];
    expect(readWeeklyRow(INTAKE_HEADERS, row)).toMatchObject({
      hymnOfPraise: { english: 'AH 1', chinese: '第5首' },
      hymnOfResponse: { english: '', chinese: '413' },
      bibleVerses: 'John 3:16',
    });
    // One side supplied is enough; both blank gets the default.
    row[2] = '';
    expect(readWeeklyRow(INTAKE_HEADERS, row).hymnOfPraise).toEqual({ english: '', chinese: '第5首' });
    row[3] = '';
    expect(readWeeklyRow(INTAKE_HEADERS, row).hymnOfPraise).toEqual({
      english: 'AH 1 Praise to the Lord',
      chinese: '',
    });
  });

  it("keeps each location's repeated Sabbath Calendar column on its own side", () => {
    const scheduleHeaders = getScheduleHeaders();
    expect(getMissingColumns(WEEKLY_HEADERS, 'Weekly Data', scheduleHeaders)).toEqual([]);
    // Removing Queens's Offering Prayer leaves Brooklyn's as Brooklyn's.
    const withoutQueensOffering = scheduleHeaders.filter(
      (header, index) => !(header === 'Offering Prayer' && index < scheduleHeaders.indexOf('Brooklyn Sermon')),
    );
    expect(getMissingColumns(WEEKLY_HEADERS, 'Weekly Data', withoutQueensOffering)).toEqual([
      'Sabbath Calendar: Queens Offering Prayer',
    ]);
    const context = loadBulletinApi();
    const find = (headers: string[], location: string, occurrence: number) =>
      runInContext(
        "findScheduleColumn_(testHeaders, 'Offering Prayer', testLocation, testOccurrence)",
        Object.assign(context, { testHeaders: headers, testLocation: location, testOccurrence: occurrence }),
      );
    expect(find(withoutQueensOffering, 'queens', 0)).toBe(-1);
    expect(find(withoutQueensOffering, 'brooklyn', 1)).toBe(
      withoutQueensOffering.indexOf('Offering Prayer'),
    );
    // A column added on the Queens side doesn't move Brooklyn's either.
    const withExtra = ['Notes', ...scheduleHeaders];
    expect(find(withExtra, 'brooklyn', 1)).toBe(withExtra.lastIndexOf('Offering Prayer'));
    expect(getMissingColumns(WEEKLY_HEADERS, 'Weekly Data', withExtra)).toEqual([]);
  });
});
