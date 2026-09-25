import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const FORM_HEADERS = [
  'Timestamp',
  'What date is this Sabbath?',
  'What is the English name and number for the Hymn of Praise this week?',
  'What is the Chinese name and number for the Hymn of Praise this week?',
  'What is the sermon title in English?',
];

const createSheet = (rows: string[][]) => ({
  getName: () => 'Queens Worship Data',
  getDataRange: () => ({
    getValues: () => [FORM_HEADERS, ...rows],
    getDisplayValues: () => [FORM_HEADERS, ...rows],
  }),
});

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

const createIntakeSheet = (rows: string[][]) => ({
  getName: () => 'Sabbath Sermon Data',
  getDataRange: () => ({
    getValues: () => [INTAKE_HEADERS, ...rows],
    getDisplayValues: () => [INTAKE_HEADERS, ...rows],
  }),
});

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

  it('merges every matching response and prefers the latest conflicting answer', () => {
    const rows = [
      [
        '2026-08-03T10:00:00Z',
        '2026-08-08',
        'Latest praise hymn',
        '',
        'Latest sermon title',
      ],
      [
        '2026-08-01T10:00:00Z',
        '2026-08-08',
        'Original praise hymn',
        '',
        'Original sermon title',
      ],
      [
        '2026-08-04T10:00:00Z',
        '2026-08-15',
        'Wrong Sabbath hymn',
        'Wrong Sabbath Chinese hymn',
        'Wrong Sabbath sermon',
      ],
      [
        '2026-08-02T10:00:00Z',
        '2026-08-08',
        '',
        '跨越全地',
        '',
      ],
    ];
    const spreadsheet = {
      getSheetByName: (name: string) =>
        name === 'Queens Worship Data' ? createSheet(rows) : null,
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
          populateFormResponses_(
            location,
            getResponseRows_(testSpreadsheet, ['Queens Worship Data'], '2026-08-08')
          );
          return location;
        })())`,
        context,
      ) as string,
    );

    expect(location.hymnOfPraise).toEqual({
      english: 'Latest praise hymn',
      chinese: '跨越全地',
    });
    expect(location.sermonTitle.english).toBe('Latest sermon title');
  });

  it('lets reviewed Sabbath Sermon Data values override legacy Form responses', () => {
    const formRows = [
      [
        '2026-08-03T10:00:00Z',
        '2026-08-08',
        'Form hymn',
        '',
        'Form sermon',
      ],
    ];
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
        name === 'Queens Worship Data'
          ? createSheet(formRows)
          : name === 'Sabbath Sermon Data'
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
          populateFormResponses_(
            location,
            getResponseRows_(testSpreadsheet, ['Queens Worship Data'], '2026-08-08')
          );
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
  });
});
