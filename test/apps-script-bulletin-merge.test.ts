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

describe('Apps Script bulletin response merging', () => {
  it('maps the Sabbath School opening prayer under its explicit API field', () => {
    const context = createContext({});
    runInContext(
      readFileSync(join(process.cwd(), 'apps-script/Code.gs'), 'utf8'),
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
      readFileSync(join(process.cwd(), 'apps-script/Code.gs'), 'utf8'),
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
});
