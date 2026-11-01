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

const createSheet = (name: string, headers: string[], rows: string[][] = []) => ({
  getName: () => name,
  getDataRange: () => ({
    getValues: () => [headers, ...rows],
    getDisplayValues: () => [headers, ...rows],
  }),
});

const createIntakeSheet = (rows: string[][], headers = INTAKE_HEADERS) =>
  createSheet('Sabbath Sermon Data', headers, rows);

const loadBulletinApi = (globals: Record<string, unknown> = {}) => {
  const context = createContext(globals);
  runInContext(
    readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8'),
    context,
  );
  return context;
};

// The header problems for a workbook whose Sabbath Calendar matches its
// contract and whose weekly tab has these headers under this name.
const getIntakeContractIssues = (headers: string[], tabName = 'Sabbath Sermon Data') => {
  const context = loadBulletinApi();
  const scheduleHeaders = JSON.parse(
    runInContext(`JSON.stringify(BULLETIN_HEADER_CONTRACTS['Sabbath Calendar'])`, context) as string,
  );
  context.testSpreadsheet = {
    getSheetByName: (name: string) =>
      name === 'Sabbath Calendar'
        ? createSheet(name, scheduleHeaders)
        : name === tabName
          ? createSheet(name, headers)
          : null,
  };
  return JSON.parse(
    runInContext('JSON.stringify(getBulletinHeaderContractIssues_(testSpreadsheet))', context) as string,
  ) as string[];
};

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

  it('uses the reviewed Sabbath Sermon Data row for bulletin content', () => {
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
        name === 'Sabbath Sermon Data'
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
        // The tab may already have its new name.
        name === 'Weekly Hymns & Sermon'
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

  it('accepts the weekly tab before and after its new headers are added, under either name', () => {
    expect(getIntakeContractIssues(INTAKE_HEADERS)).toEqual([]);
    expect(getIntakeContractIssues([...INTAKE_HEADERS, '', '', '', ''])).toEqual([]);
    expect(getIntakeContractIssues([...INTAKE_HEADERS, 'Sabbath School Hymn 1'])).toEqual([]);
    expect(getIntakeContractIssues([...INTAKE_HEADERS, ...NEW_INTAKE_HEADERS])).toEqual([]);
    expect(
      getIntakeContractIssues([...INTAKE_HEADERS, ...NEW_INTAKE_HEADERS], 'Weekly Hymns & Sermon'),
    ).toEqual([]);
  });

  it('still rejects a wrong, moved, or extra header on the weekly tab', () => {
    expect(getIntakeContractIssues([...INTAKE_HEADERS, 'Opening Hymn'])).toEqual([
      'Sabbath Sermon Data! column 10 must be "Sabbath School Hymn 1" (found "Opening Hymn")',
    ]);
    expect(
      getIntakeContractIssues([...INTAKE_HEADERS, '', '', '', 'Special Music', 'Notes']),
    ).toEqual([
      'Sabbath Sermon Data! column 13 must be "Special Music Title" (found "Special Music")',
      'Sabbath Sermon Data! column 14 must be "" (found "Notes")',
    ]);
    expect(getIntakeContractIssues(INTAKE_HEADERS.slice(0, 8))).toEqual([
      'Sabbath Sermon Data! column 9 must be "Bible Verses" (found "")',
    ]);
    expect(getIntakeContractIssues(INTAKE_HEADERS, 'Weekly Sermon Data')).toEqual([
      'Missing required sheet: Sabbath Sermon Data',
    ]);
  });
});
