import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const loadAppsScript = (context: Record<string, unknown>) => {
  const vmContext = createContext(context);
  runInContext(
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinApi.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/SabbathEncouragement.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/BulletinScheduleMaintenance.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedQueensBulletin.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedHymnLookup.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedQueensCommunionBulletin.gs'), 'utf8') +
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

  it('adds only the document-generation action to the Sheets menu', () => {
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
      'Create Google Doc + PDF…',
    ]);
  });

  it('calculates quarter boundaries and next-quarter Saturday values', () => {
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
    const headerProtection = {
      getRange: () => ({
        getRow: () => 1,
        getColumn: () => 1,
        getNumRows: () => 1,
        getNumColumns: () => 25,
      }),
      setDescription: (value: string) => calls.push(`description:${value}`),
      setWarningOnly: (value: boolean) => calls.push(`warning:${value}`),
      setDomainEdit: (value: boolean) => calls.push(`domain:${value}`),
      setEditors: (value: string[]) => calls.push(`editors:${value.join(',')}`),
      remove: () => calls.push('remove'),
    };
    const columnProtection = {
      getRange: () => ({
        getRow: () => 1,
        getColumn: () => 1,
        getNumRows: () => 53,
        getNumColumns: () => 2,
      }),
      setDescription: (value: string) => calls.push(`description:${value}`),
      setWarningOnly: (value: boolean) => calls.push(`warning:${value}`),
      setDomainEdit: (value: boolean) => calls.push(`domain:${value}`),
      setEditors: (value: string[]) => calls.push(`editors:${value.join(',')}`),
      remove: () => calls.push('remove'),
    };
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
      `ensureBulletinHeaderContractProtection_(testSheet, 25); ensureBulletinScheduleFixedColumnProtection_(testSheet);`,
      context,
    );

    expect(calls.filter((call) => call.startsWith('editors:'))).toEqual([
      'editors:technology@nyccsda.org',
      'editors:technology@nyccsda.org',
    ]);
    expect(calls.filter((call) => call === 'domain:false')).toHaveLength(2);
    expect(calls.filter((call) => call === 'warning:false')).toHaveLength(2);
  });

  it('does not advance past an already complete next quarter', () => {
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

  it('uses the configured Church at Study verse question title', () => {
    const context = loadAppsScript({});
    const title = runInContext(
      `getPrintedBulletinBibleVerseQuestionTitle_()`,
      context,
    );

    expect(title).toBe('What verse should appear at the bottom of Church at Study?');
  });

  it('preloads the reviewed Sabbath Sermon Data verse ahead of legacy data and memory', () => {
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
    const intakeSheet = makeSheet('Sabbath Sermon Data', [[
      'Date', 'Location', 'English Hymn of Praise', 'Chinese Hymn of Praise',
      'English Sermon Title', 'Chinese Sermon Title', 'English Hymn of Response',
      'Chinese Hymn of Response', 'Bible Verses',
    ], [
      '2026-09-05', 'brooklyn', '', '', '', '', '', '', 'Luke 7:36-39',
    ]]);
    const brooklynSheet = makeSheet('Brooklyn Worship Data', [
      ['Timestamp', 'What date is this Sabbath?', 'What Bible verse will you use?'],
      ['2026-09-01', '2026-09-05', 'John 12:24'],
    ]);
    const context = loadAppsScript({
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getSheetByName: (name: string) =>
            name === 'Sabbath Calendar'
              ? scheduleSheet
              : name === 'Brooklyn Worship Data'
                ? brooklynSheet
                : name === 'Sabbath Sermon Data'
                  ? intakeSheet
                : null,
        }),
      },
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => 'John 12:24' }),
      },
      Logger: { log: () => undefined },
    });

    const output = JSON.parse(
      runInContext(
        `JSON.stringify(getPrintedBulletinPromptData('2026-09-05', 'brooklyn'))`,
        context,
      ) as string,
    );

    expect(output.formVerse).toBe('Luke 7:36-39');
    expect(output.verse).toBe('Luke 7:36-39');
    expect(output.hasVerseOverride).toBe(false);
  });

  it('builds a readable result dialog with separate document and PDF links', () => {
    const context = loadAppsScript({});
    const html = runInContext(
      `buildPrintedBulletinResultHtml_({
        action: 'updated',
        title: 'Queens & Communion',
        url: 'https://docs.google.com/open?id=doc-id',
        pdfUrl: 'https://drive.google.com/file/d/pdf-id/view'
      })`,
      context,
    ) as string;

    expect(html).toContain('Printed bulletin updated');
    expect(html).toContain('Open Google Doc');
    expect(html).toContain('Open PDF');
    expect(html).toContain('href="https://docs.google.com/open?id=doc-id"');
    expect(html).toContain('href="https://drive.google.com/file/d/pdf-id/view"');
    expect(html).toContain('Queens &amp; Communion');
  });

  it('builds an animated progress dialog that starts generation asynchronously', () => {
    const context = loadAppsScript({});
    const html = runInContext(
      `buildPrintedBulletinLoadingHtml_({
        date: '2026-09-26',
        format: 'regular',
        location: 'queens',
        verse: 'John 12:24'
      })`,
      context,
    ) as string;

    expect(html).toContain('class="spinner"');
    expect(html).toContain('@keyframes spin');
    expect(html).toContain('google.script.run');
    expect(html).toContain('.createPrintedBulletinFromRequest(');
    expect(html).toContain('2026-09-26');
    expect(html).toContain('This may take a minute');
  });

  it('builds a bilingual form with location/format buttons and structured Bible selectors', () => {
    const context = loadAppsScript({});
    const html = runInContext(
      `buildPrintedBulletinPromptHtml_('2026-09-26')`,
      context,
    ) as string;

    expect(html).toContain('Queens / 皇后區');
    expect(html).toContain('Regular / 普通');
    expect(html).toContain('Communion / 聖餐');
    expect(html).toContain('Brooklyn Communion is not currently available');
    expect(html).toContain('updateLocationFormatAvailability');
    expect(html).toContain('.choice:disabled');
    expect(html).not.toContain('Detect from response');
    expect(html).toContain('Bible book ');
    expect(html).toContain('聖經書卷</label>');
    expect(html).toContain('Jeremiah · 耶利米書');
    expect(html).toContain('eng_kjv');
    expect(html).toContain('CUV — 和合本（Traditional Chinese）');
    expect(html).not.toContain('cmn_cu1');
    expect(html).toContain('11 or 11-15');
    expect(html).toContain('If the speaker submitted a Bible verse in Sabbath Sermon Data');
    expect(html).toContain('getPrintedBulletinPromptWarning');
    expect(html).toContain('Add announcement / 新增消息');
    expect(html).toContain('getPrintedBulletinPromptData');
    expect(html).not.toContain('Use Form response / 使用表單回覆');
    expect(html).not.toContain('useFormVerse');
    expect(html).toContain('Instructions / 使用說明');
    expect(html).toContain('Check the current week in the app');
    expect(html).not.toContain('Admin reminder / 管理員提醒');
    expect(html).toContain('1. Update the digital bulletin / 第一步：更新數位週刊');
    expect(html).toContain('2. Create the printed bulletin / 第二步：建立實體週刊');
    expect(html).toContain('add or update one row per location in Sabbath Sermon Data');
    expect(html).toContain('請先查看本應用程式，然後在「Sabbath Sermon Data」中');
    expect(html).toContain('↗ Open Sabbath Sermon Data / 開啟安息日講道資料');
    expect(html).toContain('https://docs.google.com/spreadsheets/d/1FqFJ8YvBA-IybOlVU1SW6ynrBGNs8Cd-9xlWz6SkkDA/edit#gid=1768045043');
    expect(html).not.toContain('forms.gle');
    expect(html).not.toContain('Worship Data form');
    expect(html).toContain('grid-template-columns:repeat(2,minmax(0,1fr))');
    expect(html).toContain('white-space:normal');
    expect(html).toContain('id="book" required');
    expect(html).toContain('id="chapter" disabled required');
    expect(html).toContain('id="verses" type="text"');
    expect(html).toContain('class="required-mark"');
    expect(html).toContain('function updateSubmitState');
    expect(html).toContain('function showGenerationError');
    expect(html).toContain('function focusStatusView_');
    expect(html).toContain('scrollIntoView');
    expect(html).toContain('class="status-slot"');
    expect(html).toContain('min-height:180px');
    expect(html).toContain('document.getElementById("bulletinForm").hidden=true');
    expect(html).toContain('block:"nearest"');
    expect(html.indexOf('English Bible translation')).toBeLessThan(html.indexOf('Bible book'));
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

  it('keeps the DAF note with the left-side giving content', () => {
    const source = readFileSync(
      join(process.cwd(), 'google-apps-script/PrintedQueensBulletin.gs'),
      'utf8',
    );
    const givingTextStart = source.indexOf('function appendGivingText_');
    const givingQrStart = source.indexOf('function appendGivingQrPlaceholders_');
    const givingQrItemsStart = source.indexOf('function getGivingQrItems_');
    const givingText = source.slice(givingTextStart, givingQrStart);
    const givingQr = source.slice(givingQrStart, source.indexOf('\nfunction ', givingQrStart + 10));
    const givingQrItems = source.slice(
      givingQrItemsStart,
      source.indexOf('\nfunction ', givingQrItemsStart + 10),
    );

    expect(givingText.replace(/\\'/g, "'")).toContain(
      "Stocks/equities: We recommend donor-advised funds; see our church's mobile app or contact treasury@nyccsda.org. Nonprofit EIN: 11-3004814.",
    );
    expect(givingText).toContain('contact treasury@nyccsda.org.');
    expect(givingText).toContain('Nonprofit EIN: 11-3004814.');
    expect(givingText).toContain('Tithes & Offerings | 什一奉獻與自由奉獻');
    expect(givingQr).not.toContain('Stocks/equities:');
    expect(givingQrItems).toContain("'Zelle® (zelle@nyccsda.org)', 'Zelle® 轉賬'");

    const context = loadAppsScript({});
    expect(JSON.parse(runInContext(
      `JSON.stringify(getGivingQrItems_('brooklyn').map(function (item) { return item.kind; }))`,
      context,
    ) as string)).toEqual(['mobileApp', 'adventistGiving', 'unused']);
    expect(runInContext(`getGivingQrItems_('brooklyn')[0].reserved`, context)).toBe(true);
    expect(JSON.parse(runInContext(
      `JSON.stringify(getGivingQrItems_('queens').map(function (item) { return item.kind; }))`,
      context,
    ) as string)).toEqual(['mobileApp', 'adventistGiving', 'zelle']);
    expect(runInContext(`getGivingQrItems_('queens')[0].reserved`, context)).toBe(true);
    expect(runInContext(`getGivingQrItems_('queens')[2].reserved`, context)).toBe(true);
    expect(runInContext(`getGivingQrItems_('queens')[0].label`, context)).toBe(
      '下載 APP\nDownload Mobile App',
    );
    expect(runInContext(`getGivingQrItems_('brooklyn')[0].label`, context)).toBe(
      '下載 APP\nDownload Mobile App',
    );
  });

  it('uses the shared dummy QR image until slot-specific Drive IDs are configured', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });

    expect(runInContext(`getPrintedBulletinQrImageFileId_('mobileApp')`, context)).toBe(
      '12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq',
    );
    expect(runInContext(`getPrintedBulletinQrImageFileId_('zelle')`, context)).toBe(
      '12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq',
    );
    expect(runInContext(`getPrintedBulletinQrImageFileId_('adventistGiving')`, context)).toBe(
      '12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq',
    );
  });

  it('selects the renamed location-specific QR files by filename', () => {
    const requestedNames: string[] = [];
    const context = loadAppsScript({
      DriveApp: {
        getFilesByName: (name: string) => {
          requestedNames.push(name);
          return {
            hasNext: () => true,
            next: () => ({ getId: () => `id-for-${name}` }),
          };
        },
      },
    });

    expect(runInContext(`getPrintedBulletinQrImageFileId_('adventistGiving', 'brooklyn')`, context)).toBe(
      'id-for-brooklyn_adventist_giving_qr_code_368x368.jpg',
    );
    expect(runInContext(`getPrintedBulletinQrImageFileId_('zelle', 'queens')`, context)).toBe(
      'id-for-queens_zelle_qr_code_368x368.jpg',
    );
    expect(runInContext(`getPrintedBulletinQrImageFileId_('mobileApp', 'brooklyn')`, context)).toBe(
      'id-for-mobile_app_qr_code_368x368.jpg',
    );
    expect(requestedNames).toEqual([
      'brooklyn_adventist_giving_qr_code_368x368.jpg',
      'queens_zelle_qr_code_368x368.jpg',
      'mobile_app_qr_code_368x368.jpg',
    ]);
  });

  it('splits printed bilingual values into horizontal English and Chinese columns', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify(splitPrintedBilingualValue_('李德健\\nNathaniel Lee'))`,
        context,
      ) as string,
    );

    expect(output).toEqual({ english: 'Nathaniel Lee', chinese: '李德健' });
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

  it('stores printed Bible verse overrides separately from Form data', () => {
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
        `savePrintedBibleVerseOverride_('2026-09-26', 'queens', 'John 12:24'); JSON.stringify(readPrintedBibleVerseOverride_('2026-09-26', 'queens'))`,
        context,
      ) as string,
    );

    expect(output).toEqual({ found: true, reference: 'John 12:24' });
    expect(properties['PRINTED_BIBLE_VERSE_QUEENS_2026-09-26']).toBe('John 12:24');
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
          communionPastor: getPrintedCommunionPastor_(),
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
    expect(output.communionPastor).toBe('方舟\nMoses Fang');
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

  it('preserves full-width booklet panels beside the explicit fold gutter', () => {
    const columnWidths: Array<[number, number]> = [];
    const makeCell = () => ({
      clear: () => undefined,
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

  it('routes response tabs to separate printed bulletin locations', () => {
    const context = loadAppsScript({});
    const locations = JSON.parse(
      runInContext(
        `JSON.stringify([
          getPrintedBulletinLocationForSheet_({ getName: () => 'Queens Worship Data' }),
          getPrintedBulletinLocationForSheet_({ getName: () => 'Brooklyn Worship Data' }),
          getPrintedBulletinLocationForSheet_({ getName: () => '2026 Sabbath' })
        ])`,
        context,
      ) as string,
    );

    expect(locations).toEqual(['queens', 'brooklyn', '']);
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

  it('merges adjacent Brooklyn Sabbath School rows with the same assignment', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify(mergeBrooklynStudyRowsByAssignment_([
          ['Welcome', '', 'Shuang Geng'],
          ['Song and Bible Verse', '', 'Shuang Geng'],
          ['Opening Hymn', '', 'Congregation'],
          ['Prayer', '', 'Shuang Geng'],
          ['Sabbath Message', 'Grace Upon Grace', 'Shuang Geng'],
          ['Sabbath School', '', 'Moyan Qi']
        ]))`,
        context,
      ) as string,
    );

    expect(output).toEqual([
      ['Song and Bible Verse', '', 'Shuang Geng'],
      ['Opening Hymn', '', 'Congregation'],
      ['Prayer\nSabbath Message', 'Grace Upon Grace', 'Shuang Geng'],
      ['Sabbath School', '', 'Moyan Qi'],
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

    expect(widths).toEqual({ regular: 490, communion: 340 });
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
          english: formatPhysicalPersonValue_('Lingli Wang', {
            englishToChinese: { 'lingli wang': '王玲俐' },
            chineseToEnglish: { '王玲俐': 'Lingli Wang' },
            pinyinToChinese: {},
            pinyinToEnglish: {}
          }),
          chinese: formatPhysicalPersonValue_('王玲俐', {
            englishToChinese: { 'lingli wang': '王玲俐' },
            chineseToEnglish: { '王玲俐': 'Lingli Wang' },
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

    expect(output.english).toBe('王玲俐\nLingli Wang');
    expect(output.chinese).toBe('王玲俐\nLingli Wang');
    expect(output.pinyin).toBe('中文姓名\nOfficial Person');
    expect(output.unmatchedEnglish).toBe('—\nUnknown Person');
    expect(output.unmatchedChinese).toBe('未知姓名\n—');
    expect(output.tbd).toBe('尚未安排\nTBD');
  });

  it('reads English, Chinese, and optional pinyin aliases from the Name Dictionary', () => {
    const dictionarySheet = {
      getDataRange: () => ({
        getValues: () => [
          ['English Name', 'Chinese Name', 'Pinyin Name'],
          ['Lingli Wang', '王玲俐', 'Lingli Wang'],
          ['English Only', '', ''],
          ['', '只有中文', ''],
          ['Official Person', '中文姓名', 'givenname familyname'],
        ],
        getDisplayValues: () => [
          ['English Name', 'Chinese Name', 'Pinyin Name'],
          ['Lingli Wang', '王玲俐', 'Lingli Wang'],
          ['English Only', '', ''],
          ['', '只有中文', ''],
          ['Official Person', '中文姓名', 'givenname familyname'],
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

    expect(dictionary.englishToChinese['lingli wang']).toBe('王玲俐');
    expect(dictionary.chineseToEnglish['王玲俐']).toBe('Lingli Wang');
    expect(dictionary.pinyinToChinese['givenname familyname']).toBe('中文姓名');
    expect(dictionary.pinyinToEnglish['givenname familyname']).toBe('Official Person');
    expect(dictionary.pinyinToChinese['wen zhong']).toBe('中文姓名');
    expect(dictionary.pinyinToEnglish['wen zhong']).toBe('Official Person');
    expect(dictionary.englishToChinese['english only']).toBeUndefined();
    expect(dictionary.chineseToEnglish['只有中文']).toBeUndefined();
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

  it('fills only a missing hymn side from the reviewed bidirectional lookup', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          englishOnly: formatHymnForPrint_({ english: 'AH 348 The Church Has One Foundation', chinese: '' }),
          chineseOnly: formatHymnForPrint_({ english: '', chinese: '第413首 教會根基' }),
          both: formatHymnForPrint_({ english: 'AH 348 The Church Has One Foundation', chinese: '第413首 教會根基' }),
        })`,
        context,
      ) as string,
    );

    expect(output.englishOnly).toBe('第413首\nAH 348 The Church Has One Foundation');
    expect(output.chineseOnly).toBe('第413首 教會根基\nAH 348');
    expect(output.both).toBe('第413首 教會根基\nAH 348 The Church Has One Foundation');
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
    expect(output.warningChinese).toContain('200 個英文單字');
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

  it('gets sunset times from the same Sunrise-Sunset API endpoint used by the app', () => {
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

  it('extracts the Sabbath date from a spreadsheet form-submit event', () => {
    const context = loadAppsScript({});
    const sheet = {
      getDataRange: () => ({
        getValues: () => [['Timestamp', 'What date is this Sabbath?']],
        getDisplayValues: () => [['Timestamp', 'What date is this Sabbath?']],
      }),
    };
    const date = runInContext(
      `getSubmittedDate_({ values: ['9/14/2026 10:00:00', '8/22/2026'] }, testSheet)`,
      Object.assign(context, { testSheet: sheet }),
    );

    expect(date).toBe('2026-08-22');
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
      'Samuel Zhang',
      'Jane Gao',
      'Lily Chee',
      '',
      'Xiu Yang',
      'Enn Kong Liew',
      'Church Choir',
      'Stephen Chee',
      'Angeline Lee',
      'Caiyun Zhao',
      'Jane Gao',
      'Susie Zhang',
      'Lily Chee',
      'Moses Fang',
      'Daniel Zhang',
      'Grace Wu',
      'Morgan Wu',
      'Grace Zhang',
      'Daniel Zhang',
    ];
    const scheduleSheet = {
      getName: () => 'Sabbath Calendar',
      getDataRange: () => ({
        getValues: () => [headers, values],
        getDisplayValues: () => [headers, values],
      }),
    };
    const intakeSheet = {
      getName: () => 'Sabbath Sermon Data',
      getDataRange: () => ({
        getValues: () => [[
          'Date',
          'Location',
          'English Hymn of Praise',
          'Chinese Hymn of Praise',
          'English Sermon Title',
          'Chinese Sermon Title',
          'English Hymn of Response',
          'Chinese Hymn of Response',
          'Bible Verses',
        ]],
        getDisplayValues: () => [[
          'Date',
          'Location',
          'English Hymn of Praise',
          'Chinese Hymn of Praise',
          'English Sermon Title',
          'Chinese Sermon Title',
          'English Hymn of Response',
          'Chinese Hymn of Response',
          'Bible Verses',
        ]],
      }),
    };
    const spreadsheet = {
      getSheetByName: (name: string) =>
        name === 'Sabbath Calendar'
          ? scheduleSheet
          : name === 'Sabbath Sermon Data'
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
    expect(names.private.queens.chairPastoralPrayer).toBe('Enn Kong Liew');
    expect(names.private.brooklyn.technician).toBe('Morgan Wu');
    expect(names.private.brooklyn.encouragement).toBe('Grace Zhang');
  });
});
