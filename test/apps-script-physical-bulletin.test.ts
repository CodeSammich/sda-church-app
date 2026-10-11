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
      readFileSync(join(process.cwd(), 'google-apps-script/ScheduleAssignmentChecks.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'google-apps-script/PrintedBulletin.gs'), 'utf8') +
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

  it('preloads the reviewed Sabbath Sermon Data verse ahead of print memory', () => {
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
    const context = loadAppsScript({
      SpreadsheetApp: {
        getActiveSpreadsheet: () => ({
          getSheetByName: (name: string) =>
            name === 'Sabbath Calendar'
              ? scheduleSheet
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

    expect(output.scheduleVerse).toBe('Luke 7:36-39');
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
      join(process.cwd(), 'google-apps-script/PrintedBulletin.gs'),
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

  it('stores printed Bible verse overrides separately from reviewed intake data', () => {
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
        getA1Notation: () => `A${row}:Y${row + numRows - 1}`,
      };
    };

    return {
      getName: () => 'Sabbath Calendar',
      getLastRow: () => values.length,
      getLastColumn: () => width,
      getMaxRows: () => maxRows,
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
      'Date', 'Location', 'English Hymn of Praise', 'Chinese Hymn of Praise',
      'English Sermon Title', 'Chinese Sermon Title', 'English Hymn of Response',
      'Chinese Hymn of Response', 'Bible Verses',
    ];
    const sermonSheet = {
      getName: () => 'Sabbath Sermon Data',
      getDataRange: () => ({
        getValues: () => [sermonHeaders],
        getDisplayValues: () => [sermonHeaders],
      }),
      getRange: () => ({ setDataValidation: () => undefined }),
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
            ({ 'Sabbath Calendar': sheet, 'Sabbath Sermon Data': sermonSheet } as Record<
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
      runInContext(`formatBulletinScheduleMaintenanceResult_(${JSON.stringify(result)})`, context),
    ).toBe('Schedule maintenance complete. Added 39 upcoming Saturday(s) and hid 0 old row(s).');
  });
});
