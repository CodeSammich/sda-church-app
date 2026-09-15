import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

const loadAppsScript = (context: Record<string, unknown>) => {
  const vmContext = createContext(context);
  runInContext(
      readFileSync(join(process.cwd(), 'apps-script/BulletinApi.gs'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'apps-script/PhysicalBulletin.gs'), 'utf8'),
    vmContext,
  );
  return vmContext;
};

describe('physical bulletin Apps Script helpers', () => {
  it('detects communion format from the schedule remark', () => {
    const context = loadAppsScript({});
    const format = runInContext(
      `resolvePhysicalBulletinFormat_('', { specialRemark: 'Communion Sabbath' })`,
      context,
    );

    expect(format).toBe('communion');
  });

  it('defaults to regular format when no communion remark is present', () => {
    const context = loadAppsScript({});
    const format = runInContext(
      `resolvePhysicalBulletinFormat_('auto', { specialRemark: '' })`,
      context,
    );

    expect(format).toBe('regular');
  });

  it('routes response tabs to separate physical bulletin locations', () => {
    const context = loadAppsScript({});
    const locations = JSON.parse(
      runInContext(
        `JSON.stringify([
          getPhysicalBulletinLocationForSheet_({ getName: () => 'Queens Worship Data' }),
          getPhysicalBulletinLocationForSheet_({ getName: () => 'Brooklyn Worship Data' }),
          getPhysicalBulletinLocationForSheet_({ getName: () => '2026 Sabbath' })
        ])`,
        context,
      ) as string,
    );

    expect(locations).toEqual(['queens', 'brooklyn', '']);
  });

  it('uses location-specific output keys and Brooklyn titles', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          key: getPhysicalBulletinPropertyKey_('PHYSICAL_BULLETIN_DOC_ID_', 'brooklyn', '2026-08-22'),
          title: getPhysicalBulletinTitle_('brooklyn', '2026-08-22', 'regular')
        })`,
        context,
      ) as string,
    );

    expect(output.key).toBe('PHYSICAL_BULLETIN_DOC_ID_BROOKLYN_2026-08-22');
    expect(output.title).toContain('Brooklyn Fellowship');
    expect(output.title).toContain('August 22, 2026');
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
          regular: getPhysicalBulletinImageFileId_('churchSketch'),
          communion: getPhysicalBulletinImageFileId_('lastSupper')
        })`,
        context,
      ) as string,
    );

    expect(imageIds.regular).toBe('1ZmxAI0l-689nnz5l1pEtmpNTDquA8_No');
    expect(imageIds.communion).toBe('1ZGPxK1cidxies9jAguiAIPVlk9Vqk-Kd');
  });

  it('defaults physical output to the configured shared Drive folder', () => {
    const context = loadAppsScript({
      PropertiesService: {
        getScriptProperties: () => ({ getProperty: () => '' }),
      },
    });

    const folderId = runInContext(`getPhysicalBulletinOutputFolderId_()`, context);

    expect(folderId).toBe('11p4-PzJNGLNfWdZBAMNIBlLxmBrgo_zZ');
  });

  it('looks up either name direction and leaves an unmatched language alone', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          english: formatPhysicalPersonValue_('Lingli Wang', {
            englishToChinese: { 'lingli wang': '王玲俐' },
            chineseToEnglish: { '王玲俐': 'Lingli Wang' }
          }),
          chinese: formatPhysicalPersonValue_('王玲俐', {
            englishToChinese: { 'lingli wang': '王玲俐' },
            chineseToEnglish: { '王玲俐': 'Lingli Wang' }
          }),
          unmatchedEnglish: formatPhysicalPersonValue_('Unknown Person', {
            englishToChinese: {}, chineseToEnglish: {}
          }),
          unmatchedChinese: formatPhysicalPersonValue_('未知姓名', {
            englishToChinese: {}, chineseToEnglish: {}
          })
        })`,
        context,
      ) as string,
    );

    expect(output.english).toBe('Lingli Wang\n王玲俐');
    expect(output.chinese).toBe('Lingli Wang\n王玲俐');
    expect(output.unmatchedEnglish).toBe('Unknown Person');
    expect(output.unmatchedChinese).toBe('未知姓名');
  });

  it('reads the Name Dictionary from columns A and B', () => {
    const dictionarySheet = {
      getDataRange: () => ({
        getValues: () => [
          ['English Name', 'Chinese Name'],
          ['Lingli Wang', '王玲俐'],
          ['English Only', ''],
          ['', '只有中文'],
        ],
        getDisplayValues: () => [
          ['English Name', 'Chinese Name'],
          ['Lingli Wang', '王玲俐'],
          ['English Only', ''],
          ['', '只有中文'],
        ],
      }),
    };
    const spreadsheet = {
      getSheetByName: (name: string) => (name === 'Name Dictionary' ? dictionarySheet : null),
    };
    const context = loadAppsScript({
      SpreadsheetApp: { getActiveSpreadsheet: () => spreadsheet },
      Logger: { log: () => undefined },
    });
    const dictionary = JSON.parse(
      runInContext(`JSON.stringify(buildPhysicalNameDictionary_())`, context) as string,
    );

    expect(dictionary.englishToChinese['lingli wang']).toBe('王玲俐');
    expect(dictionary.chineseToEnglish['王玲俐']).toBe('Lingli Wang');
    expect(dictionary.englishToChinese['english only']).toBeUndefined();
    expect(dictionary.chineseToEnglish['只有中文']).toBeUndefined();
  });

  it('keeps bilingual labels and content in the physical output helpers', () => {
    const context = loadAppsScript({});
    const output = JSON.parse(
      runInContext(
        `JSON.stringify({
          label: physicalBilingualText_('Hymn of Praise', '讚美詩'),
          hymn: formatHymnForPrint_({ english: '100 - Great Is Thy Faithfulness', chinese: '100 - 祢的信實廣大' }),
          date: formatDateForPrint_('2026-08-22')
        })`,
        context,
      ) as string,
    );

    expect(output.label).toBe('Hymn of Praise\n讚美詩');
    expect(output.hymn).toBe('100 - Great Is Thy Faithfulness\n100 - 祢的信實廣大');
    expect(output.date).toBe('August 22, 2026\n2026年8月22日');
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
      'Children Teacher',
      'Chair/Pastoral Prayer',
      'Special Music',
      'Offering Prayer',
      'Pianist',
      'SS Chair',
      'SS Opening Prayer',
      'Closing Prayer',
      'Brooklyn Sermon',
      'Chair/Pastoral Prayer',
      'Offering Prayer',
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
      'Xiu Yang',
      'Enn Kong Liew',
      'Church Choir',
      'Stephen Chee',
      'Angeline Lee',
      'Caiyun Zhao',
      'Jane Gao',
      'Susie Zhang',
      'Moses Fang',
      'Daniel Zhang',
      'Grace Wu',
      'Daniel Zhang',
    ];
    const scheduleSheet = {
      getName: () => '2026 Sabbath',
      getDataRange: () => ({
        getValues: () => [headers, values],
        getDisplayValues: () => [headers, values],
      }),
    };
    const spreadsheet = {
      getSheetByName: (name: string) =>
        name === '2026 Sabbath' ? scheduleSheet : null,
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
  });
});
