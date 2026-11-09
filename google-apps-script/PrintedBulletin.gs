/**
 * Staff-only printed bulletin generator: shared code.
 *
 * This file belongs in the same spreadsheet-bound Apps Script project as
 * BulletinApi.gs. It deliberately has no public web route: the generated document
 * contains full names and must only be created by an authorized Sheets user.
 *
 * It holds everything the locations share: the Sheet menu and prompts, the data
 * join, Google Doc creation, page and table primitives, and the shared
 * cover, giving, and announcement blocks. Each location's page layout lives in
 * its own file (PrintedQueensBulletin.gs, PrintedBrooklynBulletin.gs), and the
 * Communion service content both locations print is in PrintedCommunionBulletin.gs.
 */

/**
 * The pastor's type rules for the printed bulletin (#603): English in Times New
 * Roman, Chinese in one Song (Ming) style face, and no text under 10 points.
 * The Chinese font must come from Google Docs' own font list: Docs prints
 * nothing else, so a Mac font such as 宋體-繁 would print in Docs' fallback.
 * UoqMunThenKhung is the only Ming style face in that list.
 *
 * UoqMunThenKhung has every common Traditional character but lacks most
 * Simplified-only ones (张, 陈) and some rare ones. Each character it lacks
 * prints in the fallback font, and the rest of its name or verse stays in
 * UoqMunThenKhung.
 *
 * Staff can change the Chinese and English fonts without a deploy, in
 * Printed Bulletin → Fonts… (#624), which sets their Script Properties. The
 * fallback font is set only in Script Properties (Apps Script → Project
 * Settings → Script properties), as a name from Docs' Font → More fonts list;
 * see readPrintedBulletinFonts_.
 */
var PRINTED_BULLETIN_TYPE = Object.freeze({
  latinFont: 'Times New Roman',
  chineseFont: 'UoqMunThenKhung',
  chineseFallbackFont: 'Noto Sans SC',
  latinFontProperty: 'PRINTED_BULLETIN_LATIN_FONT',
  chineseFontProperty: 'PRINTED_BULLETIN_CJK_FONT',
  chineseFallbackFontProperty: 'PRINTED_BULLETIN_CJK_FALLBACK_FONT',
  bodySize: 10,
  subheadingSize: 11,
  headingSize: 13,
  lineSpacing: 1,
});

/**
 * The Word copy for printing on a Mac (#627). Docs can't print Songti TC (宋體-繁),
 * the pastor's preferred Chinese font, but Word on a Mac can. The copy is the
 * week's Doc as it stands, exported as .docx, with every Chinese character set
 * to Songti TC. Songti's lines are taller in Word, which pushed a bulletin onto
 * extra pages, so each paragraph of text gets an exact line height of
 * `lineHeight` times its largest font size. Paragraphs with pictures keep their
 * own spacing: an exact height would crop the picture. `lineHeightProperty`
 * changes the multiple without a deploy.
 */
// Free, for printing the Word copy on a computer without Word.
var PRINTED_BULLETIN_LIBREOFFICE_URL = 'https://www.libreoffice.org/download/download-libreoffice/';

var PRINTED_BULLETIN_WORD_COPY = Object.freeze({
  chineseFont: 'Songti TC',
  lineHeight: 1.15,
  lineHeightProperty: 'PRINTED_BULLETIN_WORD_LINE_HEIGHT',
  mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  nameSuffix: ' (Word, Songti TC).docx',
});

var PRINTED_BULLETIN_CONFIG = Object.freeze({
  churchName: 'New York Chinese Seventh-day Adventist Church',
  churchNameChinese: '基督復臨安息日會紐約華人教會',
  outputFolderProperty: 'PHYSICAL_BULLETIN_FOLDER_ID',
  queensOutputFolderProperty: 'PHYSICAL_BULLETIN_QUEENS_FOLDER_ID',
  brooklynOutputFolderProperty: 'PHYSICAL_BULLETIN_BROOKLYN_FOLDER_ID',
  adminEmailsProperty: 'PHYSICAL_BULLETIN_ADMIN_EMAILS',
  outputFolderId: '11p4-PzJNGLNfWdZBAMNIBlLxmBrgo_zZ',
  queensOutputFolderId: '1S5Z2ls_ixCb2-ToTsU-T4ImJrf0vJ8Lu',
  brooklynOutputFolderId: '1C1L98At-T_a9Dyq7mo-ZPCj2FkHddx3J',
  // These IDs are only Drive location pointers, not credentials. Drive or
  // Shared Drive permissions must keep the configured folders restricted to
  // authorized church accounts; the IDs alone do not grant access.
  churchSketchImageProperty: 'CHURCH_SKETCH_IMAGE_FILE_ID',
  lastSupperImageProperty: 'LAST_SUPPER_IMAGE_FILE_ID',
  sdaLogoImageProperty: 'SDA_LOGO_IMAGE_FILE_ID',
  adventistGivingQrImageProperty: 'ADVENTIST_GIVING_QR_IMAGE_FILE_ID',
  zelleQrImageProperty: 'ZELLE_QR_IMAGE_FILE_ID',
  mobileAppQrImageProperty: 'MOBILE_APP_QR_IMAGE_FILE_ID',
  // The QR codes live in one folder of a restricted shared drive: admins
  // change them, and everyone else who makes bulletins can only view them.
  // Only this folder is searched, so a same-named file elsewhere in Drive can't
  // take a code's place. The QR code workflow uploads to the same folder.
  qrImageFolderProperty: 'PRINTED_BULLETIN_QR_FOLDER_ID',
  qrImageFolderId: '11esgvM1uhY5e94A_eL2ITI0iKNLIFEEr',
  legacyBrooklynCoverImageProperty: 'BROOKLYN_BULLETIN_COVER_IMAGE_FILE_ID',
  // The dialog links to the Weekly Data tab itself (getBulletinIntakeSheetUrl_);
  // this opens the spreadsheet when the tab can't be looked up.
  bulletinIntakeSheetUrl:
    'https://docs.google.com/spreadsheets/d/1FqFJ8YvBA-IybOlVU1SW6ynrBGNs8Cd-9xlWz6SkkDA/edit',
  printedAnnouncementsPropertyPrefix: 'PRINTED_ANNOUNCEMENTS_',
  // The old verse picker saved a print-only verse under this prefix (#622).
  // prunePrintedBulletinProperties_ deletes any left.
  printedBibleVersePropertyPrefix: 'PRINTED_BIBLE_VERSE_',
  // Per-week Script Properties are kept this long after their Sabbath.
  weeklyPropertyRetentionDays: 28,
  printedAnnouncementsMaxEntries: 12,
  printedAnnouncementsMaxSerializedBytes: 8000,
  churchSketchImageFileId: '1ZmxAI0l-689nnz5l1pEtmpNTDquA8_No',
  lastSupperImageFileId: '1ZGPxK1cidxies9jAguiAIPVlk9Vqk-Kd',
  sdaLogoImageFileId: '19NBpTBQZyj2oSYY9qSQOvEkoPFd4M3E5',
  qrPlaceholderImageFileId: '12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq',
  documentPropertyPrefix: 'PHYSICAL_BULLETIN_DOC_ID_',
  // Bulletins were also exported as PDFs before #558. A remembered PDF is
  // trashed when its Doc is made again, so it can't be mistaken for the edited Doc.
  pdfPropertyPrefix: 'PHYSICAL_BULLETIN_PDF_ID_',
  pageWidth: 792,
  pageHeight: 612,
  pageMargin: 28,
  // Preserve the original 368-point content panels. The horizontal margins
  // are narrowed only for booklet pages so the fold gutter is added without
  // squeezing or clipping the fixed-width inner tables.
  bookletHorizontalMargin: 14,
  bookletHalfWidth: 368,
  bookletFoldGutter: 28,
  // The cover art is a little smaller than before #603 to leave room for the
  // 10-point contact and Zoom lines below it.
  regularCoverImageMaxWidth: 460,
  communionCoverImageMaxWidth: 320,
  studyTime: '10:00 am–11:25 am  |  上午 10:00–11:25',
  worshipTime: '11:40 am–1:00 pm  |  上午 11:40–下午 1:00',
  bibleApiBaseUrl: 'https://bible.helloao.org/api',
  bibleEnglishTranslation: 'BSB',
  bibleChineseTranslation: 'cmn_cuv',
  bibleCacheSeconds: 21600,
  sunsetApiBaseUrl: 'https://api.sunrise-sunset.org/json',
  // This week's adult lesson title comes from the same Adventech catalog as
  // the app's Sabbath School links.
  sabbathSchoolApiBaseUrl: 'https://sabbath-school.adventech.io/api/v2',
  sunsetLatitude: 40.74546,
  sunsetLongitude: -73.88914,
  sunsetTimeZone: 'America/New_York',
});

var PRINTED_BIBLE_TRANSLATION_OPTIONS = Object.freeze({
  english: Object.freeze({
    BSB: { id: 'BSB', label: 'BSB — Berean Standard Bible' },
    KJV: { id: 'eng_kjv', label: 'KJV — King James Version' },
  }),
  chinese: Object.freeze({
    CUV: { id: 'cmn_cuv', label: 'CUV — 和合本（Traditional Chinese）' },
  }),
});

var PRINTED_BIBLE_BOOK_IDS = Object.freeze({
  genesis: 'GEN',
  exodus: 'EXO',
  leviticus: 'LEV',
  numbers: 'NUM',
  deuteronomy: 'DEU',
  joshua: 'JOS',
  judges: 'JDG',
  ruth: 'RUT',
  '1 samuel': '1SA',
  '2 samuel': '2SA',
  '1 kings': '1KI',
  '2 kings': '2KI',
  '1 chronicles': '1CH',
  '2 chronicles': '2CH',
  ezra: 'EZR',
  nehemiah: 'NEH',
  esther: 'EST',
  job: 'JOB',
  psalm: 'PSA',
  psalms: 'PSA',
  proverbs: 'PRO',
  ecclesiastes: 'ECC',
  'song of solomon': 'SNG',
  isaiah: 'ISA',
  jeremiah: 'JER',
  lamentations: 'LAM',
  ezekiel: 'EZK',
  daniel: 'DAN',
  hosea: 'HOS',
  joel: 'JOL',
  amos: 'AMO',
  obadiah: 'OBA',
  jonah: 'JON',
  micah: 'MIC',
  nahum: 'NAH',
  habakkuk: 'HAB',
  zephaniah: 'ZEP',
  haggai: 'HAG',
  zechariah: 'ZEC',
  malachi: 'MAL',
  matthew: 'MAT',
  mark: 'MRK',
  luke: 'LUK',
  john: 'JHN',
  acts: 'ACT',
  romans: 'ROM',
  '1 corinthians': '1CO',
  '2 corinthians': '2CO',
  galatians: 'GAL',
  ephesians: 'EPH',
  philippians: 'PHP',
  colossians: 'COL',
  '1 thessalonians': '1TH',
  '2 thessalonians': '2TH',
  '1 timothy': '1TI',
  '2 timothy': '2TI',
  titus: 'TIT',
  philemon: 'PHM',
  hebrews: 'HEB',
  james: 'JAS',
  '1 peter': '1PE',
  '2 peter': '2PE',
  '1 john': '1JN',
  '2 john': '2JN',
  '3 john': '3JN',
  jude: 'JUD',
  revelation: 'REV',
});

var PRINTED_BIBLE_BOOK_LABELS = Object.freeze({
  GEN: { english: 'Genesis', chinese: '創世記' },
  EXO: { english: 'Exodus', chinese: '出埃及記' },
  LEV: { english: 'Leviticus', chinese: '利未記' },
  NUM: { english: 'Numbers', chinese: '民數記' },
  DEU: { english: 'Deuteronomy', chinese: '申命記' },
  JOS: { english: 'Joshua', chinese: '約書亞記' },
  JDG: { english: 'Judges', chinese: '士師記' },
  RUT: { english: 'Ruth', chinese: '路得記' },
  '1SA': { english: '1 Samuel', chinese: '撒母耳記上' },
  '2SA': { english: '2 Samuel', chinese: '撒母耳記下' },
  '1KI': { english: '1 Kings', chinese: '列王紀上' },
  '2KI': { english: '2 Kings', chinese: '列王紀下' },
  '1CH': { english: '1 Chronicles', chinese: '歷代志上' },
  '2CH': { english: '2 Chronicles', chinese: '歷代志下' },
  EZR: { english: 'Ezra', chinese: '以斯拉記' },
  NEH: { english: 'Nehemiah', chinese: '尼希米記' },
  EST: { english: 'Esther', chinese: '以斯帖記' },
  JOB: { english: 'Job', chinese: '約伯記' },
  PSA: { english: 'Psalms', chinese: '詩篇' },
  PRO: { english: 'Proverbs', chinese: '箴言' },
  ECC: { english: 'Ecclesiastes', chinese: '傳道書' },
  SNG: { english: 'Song of Solomon', chinese: '雅歌' },
  ISA: { english: 'Isaiah', chinese: '以賽亞書' },
  JER: { english: 'Jeremiah', chinese: '耶利米書' },
  LAM: { english: 'Lamentations', chinese: '耶利米哀歌' },
  EZK: { english: 'Ezekiel', chinese: '以西結書' },
  DAN: { english: 'Daniel', chinese: '但以理書' },
  HOS: { english: 'Hosea', chinese: '何西阿書' },
  JOL: { english: 'Joel', chinese: '約珥書' },
  AMO: { english: 'Amos', chinese: '阿摩司書' },
  OBA: { english: 'Obadiah', chinese: '俄巴底亞書' },
  JON: { english: 'Jonah', chinese: '約拿書' },
  MIC: { english: 'Micah', chinese: '彌迦書' },
  NAH: { english: 'Nahum', chinese: '那鴻書' },
  HAB: { english: 'Habakkuk', chinese: '哈巴谷書' },
  ZEP: { english: 'Zephaniah', chinese: '西番雅書' },
  HAG: { english: 'Haggai', chinese: '哈該書' },
  ZEC: { english: 'Zechariah', chinese: '撒迦利亞書' },
  MAL: { english: 'Malachi', chinese: '瑪拉基書' },
  MAT: { english: 'Matthew', chinese: '馬太福音' },
  MRK: { english: 'Mark', chinese: '馬可福音' },
  LUK: { english: 'Luke', chinese: '路加福音' },
  JHN: { english: 'John', chinese: '約翰福音' },
  ACT: { english: 'Acts', chinese: '使徒行傳' },
  ROM: { english: 'Romans', chinese: '羅馬書' },
  '1CO': { english: '1 Corinthians', chinese: '哥林多前書' },
  '2CO': { english: '2 Corinthians', chinese: '哥林多後書' },
  GAL: { english: 'Galatians', chinese: '加拉太書' },
  EPH: { english: 'Ephesians', chinese: '以弗所書' },
  PHP: { english: 'Philippians', chinese: '腓立比書' },
  COL: { english: 'Colossians', chinese: '歌羅西書' },
  '1TH': { english: '1 Thessalonians', chinese: '帖撒羅尼迦前書' },
  '2TH': { english: '2 Thessalonians', chinese: '帖撒羅尼迦後書' },
  '1TI': { english: '1 Timothy', chinese: '提摩太前書' },
  '2TI': { english: '2 Timothy', chinese: '提摩太後書' },
  TIT: { english: 'Titus', chinese: '提多書' },
  PHM: { english: 'Philemon', chinese: '腓利門書' },
  HEB: { english: 'Hebrews', chinese: '希伯來書' },
  JAS: { english: 'James', chinese: '雅各書' },
  '1PE': { english: '1 Peter', chinese: '彼得前書' },
  '2PE': { english: '2 Peter', chinese: '彼得後書' },
  '1JN': { english: '1 John', chinese: '約翰一書' },
  '2JN': { english: '2 John', chinese: '約翰二書' },
  '3JN': { english: '3 John', chinese: '約翰三書' },
  JUD: { english: 'Jude', chinese: '猶大書' },
  REV: { english: 'Revelation', chinese: '啟示錄' },
});

var PRINTED_BIBLE_CHAPTER_COUNTS = Object.freeze({
  GEN: 50,
  EXO: 40,
  LEV: 27,
  NUM: 36,
  DEU: 34,
  JOS: 24,
  JDG: 21,
  RUT: 4,
  '1SA': 31,
  '2SA': 24,
  '1KI': 22,
  '2KI': 25,
  '1CH': 29,
  '2CH': 36,
  EZR: 10,
  NEH: 13,
  EST: 10,
  JOB: 42,
  PSA: 150,
  PRO: 31,
  ECC: 12,
  SNG: 8,
  ISA: 66,
  JER: 52,
  LAM: 5,
  EZK: 48,
  DAN: 12,
  HOS: 14,
  JOL: 3,
  AMO: 9,
  OBA: 1,
  JON: 4,
  MIC: 7,
  NAH: 3,
  HAB: 3,
  ZEP: 3,
  HAG: 2,
  ZEC: 14,
  MAL: 4,
  MAT: 28,
  MRK: 16,
  LUK: 24,
  JHN: 21,
  ACT: 28,
  ROM: 16,
  '1CO': 16,
  '2CO': 13,
  GAL: 6,
  EPH: 6,
  PHP: 4,
  COL: 4,
  '1TH': 5,
  '2TH': 3,
  '1TI': 6,
  '2TI': 4,
  TIT: 3,
  PHM: 1,
  HEB: 13,
  JAS: 5,
  '1PE': 5,
  '2PE': 3,
  '1JN': 5,
  '2JN': 1,
  '3JN': 1,
  JUD: 1,
  REV: 22,
});

var PRINTED_OFFERING_TRANSLATION_CACHE = {};

function onOpen() {
  var openedAt = new Date().getTime();
  // The menu first: a simple trigger stops at 30 seconds, and an open that
  // ran out of time in the upkeep below once left staff with no menu at all.
  var ui = SpreadsheetApp.getUi();
  ui
    .createMenu('Printed Bulletin')
    .addItem('Create Word Doc…', 'createPrintedBulletinFromPrompt')
    .addItem('Fonts…', 'openPrintedBulletinFontsDialog')
    .addToUi();
  try {
    maintainBulletinScheduleOnOpen_();
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Automatic schedule maintenance skipped: ' + error);
    }
  }
  // After the upkeep, which puts back what it can of Weekly Data and tags
  // what it finds.
  var missingColumns = [];
  var renamed = [];
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    missingColumns = getMissingBulletinColumns_(spreadsheet);
    renamed = takeNewBulletinRenames_(getRenamedBulletinTabsAndColumns_(spreadsheet));
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Bulletin column check failed: ' + error);
    }
  }
  // Last, and only with time to spare: it's usually one Document Property
  // read, but a rewrite after a deploy takes seconds (#639).
  var used = new Date().getTime() - openedAt;
  if (used < HYMN_BANK_OPEN_BUDGET_MS) {
    ensureHymnBankTabSafely_();
  } else if (typeof Logger !== 'undefined') {
    Logger.log('Skipped the Hymn Bank check: this open has used ' + used + ' ms.');
  }
  if (!ui.alert || !ui.ButtonSet || !ui.ButtonSet.OK) {
    return;
  }
  if (missingColumns.length) {
    ui.alert(
      'Bulletin columns not found / 找不到周刊列',
      getMissingBulletinColumnsMessage_(missingColumns) +
        (renamed.length ? '\n\n' + getRenamedBulletinMessage_(renamed) : ''),
      ui.ButtonSet.OK,
    );
  } else if (renamed.length) {
    ui.alert(
      'Bulletin tabs or columns changed / 周刊工作表或列有变动',
      getRenamedBulletinMessage_(renamed),
      ui.ButtonSet.OK,
    );
  }
}

function getMissingBulletinColumnsMessage_(missingColumns) {
  return (
    'The app and the printed bulletin leave these blank until a tab or column ' +
    'with this exact name is back. A column can be in any position.\n' +
    '在恢复名称完全相同的工作表或列之前，手机应用和纸质周刊中的这些内容会留空。列可以放在任何位置。\n\n' +
    missingColumns.join('\n')
  );
}

function getRenamedBulletinMessage_(renamed) {
  return (
    'The app and the printed bulletin read these as listed. Nothing else needs doing.\n' +
    '手机应用和纸质周刊会按以下说明读取这些内容，无需其他操作。\n\n' +
    renamed.join('\n')
  );
}

// Each rename is announced once, on the next open by anyone: the ones shown
// are kept in the document's properties. A rename that's undone and made
// again is announced again. Where the properties can't be read, every open
// announces them.
var BULLETIN_RENAMES_SHOWN_PROPERTY = 'bulletin.renamesShown';

function takeNewBulletinRenames_(renamed) {
  var properties;
  var shown = [];
  try {
    properties = PropertiesService.getDocumentProperties();
    shown = JSON.parse(properties.getProperty(BULLETIN_RENAMES_SHOWN_PROPERTY) || '[]');
  } catch (error) {
    return renamed;
  }
  if (!Array.isArray(shown)) {
    shown = [];
  }
  var fresh = renamed.filter(function (line) {
    return shown.indexOf(line) === -1;
  });
  if (fresh.length || shown.length !== renamed.length) {
    try {
      properties.setProperty(BULLETIN_RENAMES_SHOWN_PROPERTY, JSON.stringify(renamed));
    } catch (error) {
      return renamed;
    }
  }
  return fresh;
}

/**
 * Opens a staff-only prompt. Run this from the bound spreadsheet, or use the
 * Printed Bulletin menu after reloading the spreadsheet.
 */
function createPrintedBulletinFromPrompt() {
  // Menu clicks run with full authorization, unlike onOpen, so this is where
  // the unknown-name dialog trigger can install itself.
  ensureScheduleNameCheckTrigger_();
  var defaultDate = getDefaultPrintedBulletinDate_();
  var output = HtmlService.createHtmlOutput(
    buildPrintedBulletinPromptHtml_(defaultDate),
  )
    .setWidth(650)
    .setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(
    output,
    'Create Word Doc / 制作 Word 文档',
  );
  return null;
}

// Staff-facing text (dialogs, alerts, errors, notes) is in English and
// Simplified Chinese, because the people who run the bulletin read Simplified.
// Everything printed stays in Traditional Chinese on purpose. Keep the two
// apart: see "Chinese script" in docs/operations/bulletin-automation.md.
function buildPrintedBulletinPromptHtml_(defaultDate) {
  var englishTranslationOptions = Object.keys(PRINTED_BIBLE_TRANSLATION_OPTIONS.english)
    .map(function (key) {
      var option = PRINTED_BIBLE_TRANSLATION_OPTIONS.english[key];
      return (
        '<option value="' +
        escapePrintedBulletinHtml_(option.id) +
        '"' +
        (option.id === PRINTED_BULLETIN_CONFIG.bibleEnglishTranslation ? ' selected' : '') +
        '>' +
        escapePrintedBulletinHtml_(option.label) +
        '</option>'
      );
    })
    .join('');
  var requestJson = JSON.stringify({ date: defaultDate })
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return (
    '<!doctype html>' +
    '<html><head><base target="_blank"><style>' +
    'body{font-family:Arial,sans-serif;color:#202124;padding:18px 22px;}' +
    'h2{font-size:19px;margin:0 0 4px;}' +
    '.intro{color:#5f6368;font-size:13px;line-height:1.45;margin:0 0 16px;}' +
    'label{display:block;font-weight:600;font-size:13px;margin:14px 0 6px;}' +
    '.required-mark{color:#d93025;font-weight:700;margin-left:2px;}' +
    'input,select{box-sizing:border-box;width:100%;font:14px Arial,sans-serif;' +
    'border:1px solid #bdc1c6;border-radius:4px;padding:9px 10px;background:#fff;}' +
    '.help{color:#5f6368;font-size:12px;line-height:1.4;margin-top:5px;}' +
    '.admin-reminder{background:#e8f0fe;border:1px solid #8ab4f8;border-radius:8px;color:#174ea6;font-size:13px;line-height:1.5;margin:0 0 16px;padding:13px 14px;}' +
    '.section-heading{align-items:center;display:flex;font-size:19px;gap:10px;margin:0 0 12px;}' +
    '.step{border:1px solid #dadce0;border-radius:12px;margin:0 0 14px;padding:14px 16px;}' +
    '.step-number{align-items:center;background:#1a73e8;border-radius:50%;color:#fff;display:inline-flex;flex:none;font-size:17px;font-weight:700;height:32px;justify-content:center;width:32px;}' +
    '.download{background:#1a73e8;border-radius:4px;color:#fff;display:inline-block;font-size:15px;font-weight:600;padding:10px 18px;text-decoration:none;}' +
    '.form-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:11px;}' +
    '.form-button{align-items:center;background:#fff;border:1px solid #1a73e8;border-radius:5px;box-sizing:border-box;color:#174ea6;display:flex;font-size:13px;font-weight:600;justify-content:center;line-height:1.3;min-width:0;padding:9px 8px;text-align:center;text-decoration:none;white-space:normal;}' +
    '.choices{display:flex;gap:8px;flex-wrap:wrap;}' +
    '.choice{background:#fff;border:1px solid #bdc1c6;border-radius:18px;' +
    'color:#3c4043;cursor:pointer;font-size:13px;padding:8px 13px;}' +
    '.choice.selected{background:#e8f0fe;border-color:#1a73e8;color:#174ea6;' +
    'box-shadow:inset 0 0 0 1px #1a73e8;}' +
    '.choice:disabled{cursor:not-allowed;opacity:.48;box-shadow:none;}' +
    '.verse-view{background:#f8f9fa;border:1px solid #dadce0;border-radius:4px;font-size:14px;line-height:1.45;padding:9px 10px;white-space:pre-wrap;}' +
    '.verse-view.problem{background:#fce8e6;border-color:#f4b4ae;color:#a50e0e;font-size:13px;}' +
    '.announcement-entry{border:1px solid #dadce0;border-radius:8px;margin:10px 0;padding:12px;}' +
    '.announcement-header{align-items:center;display:flex;justify-content:space-between;gap:8px;}' +
    '.announcement-header strong{font-size:13px;}' +
    '.announcement-entry textarea{box-sizing:border-box;width:100%;font:14px Arial,sans-serif;' +
    'border:1px solid #bdc1c6;border-radius:4px;min-height:72px;padding:9px 10px;resize:vertical;}' +
    '.announcement-entry select{margin-top:8px;}' +
    '.announcement-remove{background:#fce8e6;color:#a50e0e;font-size:12px;padding:6px 9px;}' +
    '.announcement-add{background:#e8f0fe;color:#174ea6;font-size:13px;margin-top:4px;}' +
    '.actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;}' +
    '.status-slot{box-sizing:border-box;padding-top:8px;}' +
    '#statusView{min-height:164px;}' +
    'button{font:14px Arial,sans-serif;border:0;border-radius:4px;cursor:pointer;' +
    'padding:9px 17px;}' +
    '.submit{background:#1a73e8;color:#fff;}' +
    '.download-row{display:flex;justify-content:flex-end;margin-top:10px;}' +
    '.preview-note{color:#5f6368;font-size:13px;line-height:1.45;margin:-4px 0 0;}' +
    '.mac-note{background:#fef7e0;border:1px solid #f9ab00;border-radius:8px;color:#3c4043;font-size:13px;line-height:1.45;margin:0 0 4px;padding:12px 14px;}' +
    '.mac-note strong{color:#202124;display:block;font-size:18px;line-height:1.35;margin-bottom:4px;}' +
    '.submit:disabled{background:#9aa0a6;cursor:wait;}' +
    '.error{color:#b3261e;font-size:13px;line-height:1.4;margin-top:12px;' +
    'white-space:pre-wrap;}' +
    '.loading{text-align:center;padding:30px 8px;}' +
    '.spinner{width:34px;height:34px;margin:0 auto 18px;border:4px solid #dadce0;' +
    'border-top-color:#1a73e8;border-radius:50%;animation:spin .85s linear infinite;}' +
    '@keyframes spin{to{transform:rotate(360deg)}}' +
    '.link{display:block;border:1px solid #dadce0;border-radius:6px;color:#1a73e8;' +
    'font-size:14px;margin:10px 0;padding:11px 12px;text-decoration:none;}' +
    '</style></head><body>' +
    // Three numbered cards, each a few words and its button: people skim.
    '<div id="formView" class="step">' +
    '<h2 class="section-heading"><span class="step-number">1</span>Fill in Weekly Data / 填写 Weekly Data</h2>' +
    '<div class="form-links"><a class="form-button" href="' +
    escapePrintedBulletinHtml_(getBulletinIntakeSheetUrl_()) +
    '">↗ Open Weekly Data / 打开 Weekly Data</a></div></div>' +
    '<div class="step">' +
    '<h2 class="section-heading"><span class="step-number">2</span>Preview &amp; check / 预览并检查</h2>' +
    // Docs gives a line with Chinese its font's height, up to 1.45 times the
    // size for a character in the fallback font; the .docx sets every line's
    // height from the size alone (#627). Outside the form, so it stays after
    // the preview is made.
    '<p class="preview-note">ⓘ Preview may run taller than print: Docs spaces Chinese more. Step 3\'s .docx fixes it.<br>' +
    'ⓘ 预览可能比打印稿长：Google 文档的中文行距较大。第 3 步的 .docx 会修正。</p>' +
    '<form id="bulletinForm">' +
    '<label for="date">Sabbath date / 安息日日期 <span class="required-mark" aria-hidden="true">*</span></label>' +
    '<input id="date" type="date" value="' +
    escapePrintedBulletinHtml_(defaultDate) +
    '" required>' +
    '<label>Location / 地点</label>' +
    '<div class="choices" id="locationChoices">' +
    '<button type="button" class="choice selected" data-value="queens">Queens / 皇后区</button>' +
    '<button type="button" class="choice" data-value="brooklyn">Brooklyn / 布鲁克林</button>' +
    '</div>' +
    '<label>Format / 格式</label>' +
    '<div class="choices" id="formatChoices">' +
    '<button type="button" class="choice selected" data-value="regular">Regular / 普通</button>' +
    '<button type="button" class="choice" data-value="communion">Communion / 圣餐</button>' +
    '</div>' +
    // Chinese is always CUV, so only English has a choice.
    '<label for="englishTranslation">English Bible / 英文圣经</label>' +
    '<select id="englishTranslation">' +
    englishTranslationOptions +
    '</select>' +
    '<label>Announcements (print only) / 通知（仅印刷）</label>' +
    '<div id="announcementList"></div>' +
    '<button type="button" class="announcement-add" id="addAnnouncement">+ Add announcement / 添加通知</button>' +
    // The verse is in Weekly Data, so it isn't shown here: only why Preview is
    // off, when Weekly Data's verse is blank or can't be read (#622).
    '<div id="verseView" class="verse-view problem" role="alert" hidden></div>' +
    '<div id="error" class="error" hidden></div>' +
    '<div class="actions"><button type="submit" class="submit" id="submit" disabled>Preview / 预览</button></div>' +
    '</form>' +
    // In step 2's card, so "Preview ready" shows where it was made.
    '<div class="status-slot"><div id="statusView" hidden></div></div></div>' +
    // The print version is a Word file because Docs can't print the final
    // fonts and spacing (#627). On a Mac, Word or LibreOffice prints the
    // Chinese in Songti TC; elsewhere they put in a similar Chinese font, and
    // the exact line heights, set by font size, keep the layout.
    '<div id="wordCopySection" class="step"><h2 class="section-heading"><span class="step-number">3</span>Convert and send .docx to pastor / 转换 .docx 发给牧师</h2>' +
    // The one tip that changes the printout, so it's the first thing in the card.
    '<div class="mac-note"><strong>Mac preferred: font looks better<br>建议用 Mac：字体更好看</strong>Open in Microsoft Word or free <a href="' +
    PRINTED_BULLETIN_LIBREOFFICE_URL +
    '">LibreOffice</a>. / 用 Microsoft Word 或免费的 <a href="' +
    PRINTED_BULLETIN_LIBREOFFICE_URL +
    '">LibreOffice</a> 打开。</div>' +
    '<div class="actions"><button type="button" class="submit" id="wordCopy">Make .docx / 制作 .docx</button></div>' +
    '<div id="wordCopyStatus" class="help" aria-live="polite"></div></div>' +
    '<script>' +
    'var initialRequest=' +
    requestJson +
    ';' +
    'var locationValue="queens";var formatValue="regular";var announcementsDirty=false;var promptData=null;var promptRequest=0;' +
    'function selectChoice(group,value){' +
    'var buttons=document.querySelectorAll("#"+group+" .choice");' +
    'Array.prototype.forEach.call(buttons,function(button){' +
    'var selected=button.getAttribute("data-value")===value;' +
    'button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",selected?"true":"false");});}' +
    'function updateLocationFormatAvailability(){var brooklynButton=document.querySelector("#locationChoices .choice[data-value=brooklyn]");var communionButton=document.querySelector("#formatChoices .choice[data-value=communion]");var brooklynDisabled=formatValue==="communion";var communionDisabled=locationValue==="brooklyn";brooklynButton.disabled=brooklynDisabled;communionButton.disabled=communionDisabled;brooklynButton.setAttribute("aria-disabled",brooklynDisabled?"true":"false");communionButton.setAttribute("aria-disabled",communionDisabled?"true":"false");}' +
    'function escapeHtml(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\\x27/g,"&#39;");}' +
    'function updateSubmitState(){var date=document.getElementById("date").value.trim();var unsupported=locationValue==="brooklyn"&&formatValue==="communion";var verseReady=Boolean(promptData&&promptData.verse&&!promptData.verseProblem);document.getElementById("submit").disabled=Boolean(unsupported||!date||!verseReady);}' +
    'function showError(message){var error=document.getElementById("error");error.textContent=message;error.hidden=false;updateSubmitState();}' +
    'function announcementMarkup(entry,index){entry=entry||{};var scope=entry.scope||"all";return "<div class=\\"announcement-entry\\"><div class=\\"announcement-header\\"><strong>Announcement "+(index+1)+" / 通知 "+(index+1)+"</strong><button type=\\"button\\" class=\\"announcement-remove\\">Remove / 移除</button></div><select class=\\"announcement-scope\\"><option value=\\"all\\""+(scope==="all"?" selected":"")+">Both locations / 两个地点</option><option value=\\"queens\\""+(scope==="queens"?" selected":"")+">Queens / 皇后区</option><option value=\\"brooklyn\\""+(scope==="brooklyn"?" selected":"")+">Brooklyn / 布鲁克林</option></select><label>English announcement / 英文通知</label><textarea class=\\"announcement-english\\" placeholder=\\"Optional English announcement\\">"+escapeHtml(entry.english||"")+"</textarea><label>Traditional Chinese announcement / 繁体中文通知</label><textarea class=\\"announcement-chinese\\" placeholder=\\"Optional Traditional Chinese announcement\\">"+escapeHtml(entry.chinese||"")+"</textarea></div>";}' +
    'function refreshAnnouncementLabels(){Array.prototype.forEach.call(document.querySelectorAll(".announcement-entry strong"),function(label,index){label.textContent="Announcement "+(index+1)+" / 通知 "+(index+1);});}' +
    'function addAnnouncementEntry(entry){var list=document.getElementById("announcementList");var index=list.children.length;list.insertAdjacentHTML("beforeend",announcementMarkup(entry,index));refreshAnnouncementLabels();}' +
    'function renderAnnouncements(entries){var list=document.getElementById("announcementList");list.innerHTML="";(entries||[]).forEach(addAnnouncementEntry);refreshAnnouncementLabels();announcementsDirty=false;updateSubmitState();}' +
    'function renderVerse(data){var view=document.getElementById("verseView");var problem=data&&data.verseProblem;view.hidden=!problem;view.textContent=problem||"";}' +
    'function renderPromptData(data){promptData=data||null;renderAnnouncements((data&&data.announcements)||[]);renderVerse(data);updateSubmitState();}' +
    // A reply for an earlier date or location is dropped, so the verse shown is
    // always the one for the current choices.
    'function loadPromptData(){var request=++promptRequest;promptData=null;renderVerse(null);updateSubmitState();google.script.run.withSuccessHandler(function(data){if(request===promptRequest){renderPromptData(data);}}).withFailureHandler(function(error){if(request===promptRequest){renderPromptData({announcements:[],verse:"",verseProblem:"Could not read Weekly Data. Close this dialog, then open it again.\\n无法读取 Weekly Data。请关闭此对话框后重新打开。\\n\\n"+(error&&error.message?error.message:String(error))});}}).getPrintedBulletinPromptData(document.getElementById("date").value||initialRequest.date,locationValue);}' +
    'function collectAnnouncements(){var entries=[];Array.prototype.forEach.call(document.querySelectorAll(".announcement-entry"),function(card){var english=card.querySelector(".announcement-english").value.trim();var chinese=card.querySelector(".announcement-chinese").value.trim();if(english||chinese){entries.push({scope:card.querySelector(".announcement-scope").value,english:english,chinese:chinese});}});return entries;}' +
    'function showLoading(){document.getElementById("bulletinForm").hidden=true;document.getElementById("statusView").hidden=false;document.getElementById("statusView").innerHTML=' +
    '"<div class=\'loading\'><div class=\'spinner\'></div><h2>Making the preview…<br>正在生成预览…</h2><p class=\'intro\'>This may take a minute while the Google Doc is prepared.<br>创建 Google 文档可能需要一点时间。</p></div>";focusStatusView_();}' +
    'function focusStatusView_(){setTimeout(function(){var status=document.getElementById("statusView");if(status&&status.scrollIntoView){status.scrollIntoView({behavior:"smooth",block:"nearest"});}},0);}' +
    'function showGenerationError(error){document.getElementById("statusView").hidden=true;document.getElementById("bulletinForm").hidden=false;showError("Could not create bulletin / 无法创建周刊\\n\\n"+(error&&error.message?error.message:String(error)));setTimeout(function(){var message=document.getElementById("error");if(message&&message.scrollIntoView){message.scrollIntoView({behavior:"smooth",block:"center"});}},0);}' +
    'function showResult(result){document.getElementById("statusView").innerHTML=' +
    '"<h2>Preview ready / 预览已完成</h2><p class=\'intro\'>"+escapeHtml(result.title||"Your bulletin is ready. / 您的周刊已准备好。")+"</p>"+'+
    '(result.scheduleNotSet?"<p class=\'intro\'>The Sabbath Calendar has no schedule for this Sabbath yet, so its roster says TBD.<br>安息日日历还没有这个安息日的安排，所以名单显示为 TBD。</p>":"")+'+
    '"<a class=\'link\' href=\'"+escapeHtml(result.url)+"\'>Open Google Doc / 打开 Google 文档</a>";}' +
    'function runRequest(request){document.getElementById("submit").disabled=true;google.script.run.withSuccessHandler(function(result){' +
    'if(result&&result.requiresConfirmation){var message=result.warning+"\\n\\n"+result.warningChinese+"\\n\\nContinue anyway? / 仍要继续吗？";if(window.confirm(message)){request.confirmLongVerse=true;runRequest(request);}else{updateSubmitState();}return;}' +
    'showLoading();google.script.run.withSuccessHandler(showResult).withFailureHandler(function(error){showGenerationError(error);}).createPrintedBulletinFromRequest(request);' +
    '}).withFailureHandler(function(error){showError(error&&error.message?error.message:String(error));}).getPrintedBulletinPromptWarning((promptData&&promptData.verse)||"",Boolean(request.confirmLongVerse),{englishTranslation:request.englishTranslation});}' +
    'document.getElementById("locationChoices").addEventListener("click",function(event){if(event.target.classList.contains("choice")&&!event.target.disabled){locationValue=event.target.getAttribute("data-value");selectChoice("locationChoices",locationValue);updateLocationFormatAvailability();loadPromptData();}});' +
    'document.getElementById("formatChoices").addEventListener("click",function(event){if(event.target.classList.contains("choice")&&!event.target.disabled){formatValue=event.target.getAttribute("data-value");selectChoice("formatChoices",formatValue);updateLocationFormatAvailability();updateSubmitState();}});' +
    'document.getElementById("addAnnouncement").addEventListener("click",function(){addAnnouncementEntry({});announcementsDirty=true;});' +
    'document.getElementById("announcementList").addEventListener("input",function(){announcementsDirty=true;});' +
    'document.getElementById("announcementList").addEventListener("change",function(){announcementsDirty=true;});' +
    'document.getElementById("announcementList").addEventListener("click",function(event){if(event.target.classList.contains("announcement-remove")){event.target.closest(".announcement-entry").remove();refreshAnnouncementLabels();announcementsDirty=true;}});' +
    'document.getElementById("date").addEventListener("change",function(){loadPromptData();updateSubmitState();});' +
    'document.getElementById("bulletinForm").addEventListener("submit",function(event){event.preventDefault();var date=document.getElementById("date").value.trim();if(!date){showError("Sabbath date is required. / 安息日日期为必填。");return;}if(!promptData||!promptData.verse||promptData.verseProblem){showError((promptData&&promptData.verseProblem)||"Reading Weekly Data… / 正在读取 Weekly Data…");return;}var request={date:date,format:formatValue,location:locationValue,englishTranslation:document.getElementById("englishTranslation").value};if(announcementsDirty){request.announcements=collectAnnouncements();}runRequest(request);});' +
    'function makeWordCopy(){var date=document.getElementById("date").value.trim();var wordStatus=document.getElementById("wordCopyStatus");var button=document.getElementById("wordCopy");if(!date){wordStatus.className="error";wordStatus.textContent="Choose the Sabbath date first. / 请先选择安息日日期。";return;}' +
    'button.disabled=true;wordStatus.className="help";wordStatus.textContent="Making the .docx… / 正在制作 .docx…";google.script.run.withSuccessHandler(function(result){button.disabled=false;' +
    'wordStatus.className="download-row";wordStatus.innerHTML="<a class=\'download\' href=\'"+escapeHtml(result.downloadUrl)+"\'>⬇ Download .docx / 下载 .docx</a>";})' +
    '.withFailureHandler(function(error){button.disabled=false;wordStatus.className="error";wordStatus.textContent=(error&&error.message)||String(error);}).createPrintedBulletinWordCopy({date:date,location:locationValue});}' +
    'document.getElementById("wordCopy").addEventListener("click",makeWordCopy);' +
    'selectChoice("locationChoices",locationValue);selectChoice("formatChoices",formatValue);updateLocationFormatAvailability();loadPromptData();' +
    '</script></body></html>'
  );
}

function getPrintedBulletinPromptWarning(reference, confirmed, bibleTranslations) {
  if (confirmed) {
    return { requiresConfirmation: false };
  }
  var passage = null;
  if (parsePhysicalBibleReferences_(reference).length) {
    try {
      passage = resolvePhysicalBiblePassage_(reference, bibleTranslations);
    } catch (error) {
      Logger.log('Could not preflight Bible passage length: ' + error);
    }
  }
  var warning = getPhysicalBibleReferenceWarning_(reference, passage);
  if (!warning) {
    return { requiresConfirmation: false };
  }
  var stats = passage ? getPhysicalBibleTextStats_(passage.english) : null;
  return {
    requiresConfirmation: true,
    warning: warning,
    warningChinese: stats
      ? '这段经文约有 ' +
        stats.words +
        ' 个英文单词（' +
        stats.characters +
        ' 个字符）。双语经文栏可能会有较多换行，甚至使周刊增加页数。'
      : '这段经文较长，双语经文栏可能会有较多换行，甚至使周刊增加页数。',
  };
}

function getDefaultPrintedBulletinDate_(today) {
  var date = toIsoDate_(today || getPrintedBulletinToday_());
  return getClosestSaturdayDate_(date);
}

function getPrintedBulletinToday_() {
  var now = new Date();
  if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
    return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return [now.getFullYear(), pad2_(now.getMonth() + 1), pad2_(now.getDate())].join('-');
}

function getClosestSaturdayDate_(requestedDate) {
  var date = toIsoDate_(requestedDate);
  if (!date) {
    return '';
  }
  var parts = date.split('-');
  var current = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])));
  var daysUntilSaturday = (6 - current.getUTCDay() + 7) % 7;
  var saturday = new Date(
    Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + daysUntilSaturday),
  );
  return [
    saturday.getUTCFullYear(),
    pad2_(saturday.getUTCMonth() + 1),
    pad2_(saturday.getUTCDate()),
  ].join('-');
}

function getPhysicalBibleReferenceWarning_(reference, passage) {
  var passages = parsePhysicalBibleReferences_(reference);
  if (!passages.length) {
    return '';
  }

  var verseCount = 0;
  var wholeChapter = false;
  passages.forEach(function (passage) {
    if (!passage.verseStart) {
      wholeChapter = true;
      return;
    }
    verseCount += passage.verseEnd - passage.verseStart + 1;
  });

  var stats = passage ? getPhysicalBibleTextStats_(passage.english) : null;
  if (stats && !wholeChapter) {
    if (stats.words <= 180 && stats.characters <= 1000) {
      return '';
    }
  } else if (!wholeChapter && verseCount < 9) {
    return '';
  }

  var estimate = wholeChapter
    ? 'a full chapter or more'
    : stats
      ? 'approximately ' + stats.words + ' English words (' + stats.characters + ' characters)'
      : 'approximately ' + verseCount + ' verses';
  return (
    'This selection contains ' +
    estimate +
    '. Longer passages can make the bilingual verse panel wrap heavily or push the bulletin onto another page. The warning is based on the fetched English text length, not just the verse count.'
  );
}

function getPhysicalBibleTextStats_(text) {
  var value = String(text || '').trim();
  return {
    words: value ? value.split(/\s+/).filter(Boolean).length : 0,
    characters: value.length,
  };
}

/**
 * Called asynchronously by the progress dialog after the user finishes the
 * prompts. Keeping the expensive Docs/Drive work in a google.script.run call
 * lets the browser repaint the spinner instead of appearing frozen.
 */
function createPrintedBulletinFromRequest(request) {
  request = request || {};
  validatePrintedBulletinRequest_(request);
  if (Object.prototype.hasOwnProperty.call(request, 'announcements')) {
    savePrintedBulletinAnnouncements_(request.date, request.announcements);
  }
  // The verse is always Weekly Data's, as in the app (#622), so a verse sent
  // with the request is ignored.
  var result = createPrintedBulletin_(
    request.date,
    request.format,
    request.location,
    {
      englishTranslation: request.englishTranslation,
      chineseTranslation: request.chineseTranslation,
    },
  );
  prunePrintedBulletinProperties_();
  return result;
}

function validatePrintedBulletinRequest_(request) {
  if (!toIsoDate_(request.date)) {
    throw new Error('Sabbath date is required. / 安息日日期为必填。');
  }
  var location = normalizePrintedBulletinLocation_(request.location);
  var requestedFormat = String(request.format || '').trim().toLowerCase();
  if (requestedFormat === 'communion') {
    validatePrintedBulletinCombination_(location, requestedFormat);
  }
}

/**
 * Reads the printed-only announcement list for the selected Sabbath. This is
 * deliberately separate from the public bulletin payload and the staff-managed
 * schedule data.
 */
function getPrintedBulletinAnnouncements(requestedDate) {
  return readPrintedBulletinAnnouncements_(requestedDate).entries;
}

function getPrintedBulletinPromptData(requestedDate, requestedLocation) {
  var date = toIsoDate_(requestedDate);
  var location = normalizePrintedBulletinLocation_(requestedLocation);
  var bulletin = null;
  var readError = '';
  if (date) {
    try {
      bulletin = buildBulletin_(date, { allowMissingSchedule: true });
    } catch (error) {
      Logger.log('Could not load schedule data for the printed bulletin prompt: ' + error);
      readError = String((error && error.message) || error);
    }
  }
  var verse = bulletin && bulletin[location] ? String(bulletin[location].bibleVerses || '').trim() : '';
  var storedAnnouncements = readPrintedBulletinAnnouncements_(date);
  var announcements = storedAnnouncements.entries;
  if (!storedAnnouncements.found && bulletin) {
    announcements = [];
    if (hasPrintValue_(bulletin.announcements)) {
      announcements.push({ scope: 'all', english: bulletin.announcements, chinese: '' });
    }
    if (bulletin[location] && hasPrintValue_(bulletin[location].announcements)) {
      announcements.push({
        scope: location,
        english: bulletin[location].announcements,
        chinese: '',
      });
    }
  }
  // The dialog shows Weekly Data's verse read-only, the same one the app
  // shows, and can't create the Doc while it's blank or unreadable (#622).
  var verseProblem = readError
    ? 'Could not read Weekly Data. Close this dialog, then open it again.\n' +
      '无法读取 Weekly Data。请关闭此对话框后重新打开。\n\n' +
      readError
    : getPrintedBibleVerseProblem_(verse);
  return {
    announcements: announcements,
    verse: verse,
    verseLabels: verseProblem ? null : formatPrintedBibleVerseLabels_(verse),
    verseProblem: verseProblem,
  };
}

/**
 * Why the printed bulletin can't use this Weekly Data "Bible Verses" value,
 * in English and Simplified Chinese, or '' if it can. Blank and TBD can't be
 * printed, and nor can a passage the parser would drop, such as a misspelled
 * book or a chapter the book doesn't have, so nothing is left out quietly.
 */
function getPrintedBibleVerseProblem_(reference) {
  var value = String(reference || '').trim();
  if (!value || isPhysicalTbd_(value)) {
    return (
      'Weekly Data has no Bible Verses for this Sabbath and location. Close this dialog, add the ' +
      'reference in Weekly Data, then open the dialog again.\n' +
      '“Weekly Data”中没有这个安息日和地点的“Bible Verses”。请关闭此对话框，在“Weekly Data”中' +
      '填写经文后重新打开。'
    );
  }
  var unreadable = parsePhysicalBibleReferencePieces_(value)
    .filter(function (piece) {
      return !piece.reference;
    })
    .map(function (piece) {
      return '“' + piece.text + '”';
    });
  if (!unreadable.length) {
    return '';
  }
  return (
    'Weekly Data\'s Bible Verses can\'t be read: ' + unreadable.join(', ') + '. Write each passage ' +
    'as book chapter:verse, such as John 3:16 or John 3:16-18, with a semicolon between passages. ' +
    'Close this dialog, fix it in Weekly Data, then open the dialog again.\n' +
    '无法读取“Weekly Data”中的“Bible Verses”：' + unreadable.join('、') + '。每段经文请写成“书卷 章:节”，' +
    '例如 John 3:16 或 John 3:16-18，多段经文之间用分号隔开。请关闭此对话框，在“Weekly Data”中修改后重新打开。'
  );
}

// The passages as the bulletin prints them, without the translation names,
// such as "John 3:16–18; Psalm 23" and "約翰福音 3:16–18；詩篇 23".
function formatPrintedBibleVerseLabels_(reference) {
  var passages = parsePhysicalBibleReferences_(reference);
  return {
    english: passages.map(function (passage) {
      return formatPhysicalBibleReference_(passage, 'english');
    }).join('; '),
    chinese: passages.map(function (passage) {
      return formatPhysicalBibleReference_(passage, 'chinese');
    }).join('；'),
  };
}

function savePrintedBulletinAnnouncements_(requestedDate, entries) {
  var date = toIsoDate_(requestedDate);
  if (!date) {
    throw new Error('A valid Sabbath date is required for printed announcements');
  }

  var normalized = normalizePrintedBulletinAnnouncements_(entries);
  var serialized = JSON.stringify(normalized);
  if (
    getPhysicalUtf8ByteLength_(serialized) >
    PRINTED_BULLETIN_CONFIG.printedAnnouncementsMaxSerializedBytes
  ) {
    throw new Error(
      'The printed announcements are too long. Please shorten them or use fewer entries.',
    );
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    PropertiesService.getScriptProperties().setProperty(
      getPrintedBulletinAnnouncementsPropertyKey_(date),
      serialized,
    );
  } finally {
    lock.releaseLock();
  }
  return normalized;
}

function readPrintedBulletinAnnouncements_(requestedDate) {
  var date = toIsoDate_(requestedDate);
  if (!date || typeof PropertiesService === 'undefined') {
    return { found: false, entries: [] };
  }

  var raw = PropertiesService.getScriptProperties().getProperty(
    getPrintedBulletinAnnouncementsPropertyKey_(date),
  );
  if (raw === null || typeof raw === 'undefined') {
    return { found: false, entries: [] };
  }

  try {
    return {
      found: true,
      entries: normalizePrintedBulletinAnnouncements_(JSON.parse(raw)),
    };
  } catch (error) {
    Logger.log('Could not read printed announcements for ' + date + ': ' + error);
    return { found: true, entries: [] };
  }
}

/**
 * Script Properties keep each bulletin's Doc ID, and each week's printed
 * announcements, by Sabbath. The project settings page can manage only 50
 * properties by hand, so after each Doc is made this deletes the per-week ones
 * for Sabbaths more than four weeks past, and every print-only verse the old
 * verse picker left (#622). Recent and future weeks stay, so a reprint still
 * updates its Doc. The Docs and PDFs stay in Drive, and no other property is
 * touched. Returns the number deleted.
 */
function prunePrintedBulletinProperties_(today) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    Logger.log('Skipped pruning Script Properties: another run holds the lock.');
    return 0;
  }
  try {
    var properties = PropertiesService.getScriptProperties();
    var cutoff = addPrintedBulletinDays_(
      toIsoDate_(today) || getPrintedBulletinToday_(),
      -PRINTED_BULLETIN_CONFIG.weeklyPropertyRetentionDays,
    );
    var expired = properties.getKeys().filter(function (key) {
      return isExpiredPrintedBulletinProperty_(key, cutoff);
    });
    expired.forEach(function (key) {
      properties.deleteProperty(key);
    });
    Logger.log('Pruned ' + expired.length + ' old printed bulletin Script Properties.');
    return expired.length;
  } catch (error) {
    // Pruning never stops the bulletin; the next run tries again.
    Logger.log('Could not prune printed bulletin Script Properties: ' + error);
    return 0;
  } finally {
    lock.releaseLock();
  }
}

// Only these exact forms are per-week keys. Locations are optional only where
// a legacy Queens key once had none.
function isExpiredPrintedBulletinProperty_(key, cutoff) {
  var config = PRINTED_BULLETIN_CONFIG;
  var match = String(key).match(/^(.+?)(?:(QUEENS|BROOKLYN)_)?(\d{4}-\d{2}-\d{2})$/);
  if (!match || toIsoDate_(match[3]) !== match[3]) {
    return false;
  }
  var prefix = match[1];
  var hasLocation = Boolean(match[2]);
  if (prefix === config.printedBibleVersePropertyPrefix) {
    return hasLocation;
  }
  var weekly =
    prefix === config.documentPropertyPrefix ||
    prefix === config.pdfPropertyPrefix ||
    (prefix === config.printedAnnouncementsPropertyPrefix && !hasLocation);
  return weekly && match[3] < cutoff;
}

function addPrintedBulletinDays_(date, days) {
  var parts = date.split('-');
  var shifted = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + days));
  return [shifted.getUTCFullYear(), pad2_(shifted.getUTCMonth() + 1), pad2_(shifted.getUTCDate())].join('-');
}

function getPrintedBulletinAnnouncementsPropertyKey_(date) {
  return PRINTED_BULLETIN_CONFIG.printedAnnouncementsPropertyPrefix + date;
}

function normalizePrintedBulletinAnnouncements_(entries) {
  if (!Array.isArray(entries)) {
    return [];
  }
  if (entries.length > PRINTED_BULLETIN_CONFIG.printedAnnouncementsMaxEntries) {
    throw new Error(
      'A maximum of ' +
        PRINTED_BULLETIN_CONFIG.printedAnnouncementsMaxEntries +
        ' printed announcements is supported.',
    );
  }

  return entries
    .map(function (entry) {
      entry = entry || {};
      var scope = String(entry.scope || 'all').trim().toLowerCase();
      if (['all', 'queens', 'brooklyn'].indexOf(scope) === -1) {
        scope = 'all';
      }
      return {
        scope: scope,
        english: normalizePrintedAnnouncementText_(entry.english),
        chinese: normalizePrintedAnnouncementText_(entry.chinese),
      };
    })
    .filter(function (entry) {
      return Boolean(entry.english || entry.chinese);
    });
}

function normalizePrintedAnnouncementText_(value) {
  return String(value === null || typeof value === 'undefined' ? '' : value)
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function getPhysicalUtf8ByteLength_(value) {
  var text = String(value || '');
  if (typeof Utilities !== 'undefined' && Utilities.newBlob) {
    return Utilities.newBlob(text).getBytes().length;
  }
  return encodeURIComponent(text).replace(/%[0-9A-F]{2}/g, 'x').length;
}

// A link straight to the Weekly Data tab, or else to the spreadsheet.
function getBulletinIntakeSheetUrl_() {
  try {
    var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = spreadsheet && getBulletinSheet_(spreadsheet, CONFIG.intakeSheetName);
    if (sheet) {
      return spreadsheet.getUrl() + '#gid=' + sheet.getSheetId();
    }
  } catch (error) {
    // Outside the bound spreadsheet, such as in tests.
  }
  return PRINTED_BULLETIN_CONFIG.bulletinIntakeSheetUrl;
}

function escapePrintedBulletinHtml_(value) {
  return String(value === null || typeof value === 'undefined' ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Returns true only for accounts listed in the Script Property
 * PHYSICAL_BULLETIN_ADMIN_EMAILS. The property accepts comma-, semicolon-,
 * or newline-separated Google account addresses.
 *
 * A configured allowlist is required rather than relying on the effective
 * user, because an installable trigger runs as its creator and a simple
 * onOpen trigger may not expose the active user's email in every account
 * configuration.
 */
function isPrintedBulletinAdmin_() {
  var properties =
    typeof PropertiesService !== 'undefined'
      ? PropertiesService.getScriptProperties()
      : null;
  var configured = properties
    ? properties.getProperty(PRINTED_BULLETIN_CONFIG.adminEmailsProperty) || ''
    : '';
  var allowed = configured
    .split(/[;,\n\r\s]+/)
    .map(function (email) {
      return String(email).trim().toLowerCase();
    })
    .filter(Boolean);

  if (!allowed.length || typeof Session === 'undefined') {
    return false;
  }

  var addresses = [];
  [Session.getActiveUser, Session.getEffectiveUser].forEach(function (getUser) {
    try {
      var user = getUser.call(Session);
      var email = user && user.getEmail ? user.getEmail() : '';
      if (email) {
        addresses.push(String(email).trim().toLowerCase());
      }
    } catch (error) {
      // Some trigger/simple-trigger contexts intentionally do not expose an
      // email address. In that case the allowlist check remains false.
    }
  });

  return addresses.some(function (email) {
    return allowed.indexOf(email) !== -1;
  });
}

function requirePrintedBulletinAdmin_() {
  if (!isPrintedBulletinAdmin_()) {
    throw new Error(
      'This setup action is restricted. Add your Google account email to the ' +
        PRINTED_BULLETIN_CONFIG.adminEmailsProperty +
        ' Script Property, then reload the spreadsheet.',
    );
  }
}

// Backward-compatible entry points for previously installed triggers and
// dialogs. The implementation and all new UI callbacks use PrintedBulletin
// names, but existing Google Apps Script triggers may still reference these
// legacy PhysicalBulletin handlers.
function createPhysicalBulletinFromPrompt() {
  return createPrintedBulletinFromPrompt();
}

function createPhysicalBulletinFromRequest(request) {
  return createPrintedBulletinFromRequest(request);
}

/**
 * Creates or updates a landscape Google Doc. This function is intentionally
 * not called by doGet(), because the public bulletin endpoint must never
 * expose full names or create Drive files for anonymous callers.
 */
function createPrintedBulletin_(
  requestedDate,
  requestedFormat,
  requestedLocation,
  requestedBibleTranslations,
) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return createPrintedBulletinUnlocked_(
      requestedDate,
      requestedFormat,
      requestedLocation,
      requestedBibleTranslations,
    );
  } finally {
    lock.releaseLock();
  }
}

function createPrintedBulletinUnlocked_(
  requestedDate,
  requestedFormat,
  requestedLocation,
  requestedBibleTranslations,
) {
  var date = toIsoDate_(requestedDate);
  if (!date) {
    throw new Error('A valid Sabbath date is required');
  }

  var location = normalizePrintedBulletinLocation_(requestedLocation);
  var bibleTranslations = normalizePhysicalBibleTranslations_(requestedBibleTranslations);
  var nameDictionary = buildPhysicalNameDictionary_();
  // Without this Sabbath's schedule the roster prints as TBD, and the dialog
  // says why (#580).
  var bulletin = buildBulletin_(date, { includeFullNames: true, allowMissingSchedule: true });
  var scheduleNotSet = Boolean(bulletin.scheduleNotSet);
  var verseProblem = getPrintedBibleVerseProblem_(bulletin[location] && bulletin[location].bibleVerses);
  if (verseProblem) {
    throw new Error(verseProblem);
  }
  var printedAnnouncements = readPrintedBulletinAnnouncements_(date);
  bulletin.printedAnnouncements = printedAnnouncements.entries;
  bulletin.hasPrintedAnnouncements = printedAnnouncements.found;
  bulletin = preparePrintedBulletinForPrint_(bulletin, nameDictionary);
  bulletin.physicalBibleTranslations = bibleTranslations;
  hydratePhysicalBibleVerses_(bulletin, bibleTranslations);
  var format = resolvePrintedBulletinFormat_(requestedFormat, bulletin);
  validatePrintedBulletinCombination_(location, format);
  var nextBulletin = tryBuildPrivateBulletin_(getNextSabbathDate_(date), nameDictionary);
  hydratePhysicalSunsetTimes_(bulletin, nextBulletin);
  bulletin.sabbathSchoolLesson = getPhysicalSabbathSchoolLesson_(date);
  var title = getPrintedBulletinTitle_(location, date, format);
  var documentPropertyKey = getPrintedBulletinPropertyKey_(
    PRINTED_BULLETIN_CONFIG.documentPropertyPrefix,
    location,
    date,
  );
  var properties = PropertiesService.getScriptProperties();
  var legacyDocumentPropertyKey = PRINTED_BULLETIN_CONFIG.documentPropertyPrefix + date;
  var existingDocumentId = properties.getProperty(documentPropertyKey);
  if (!existingDocumentId && location === 'queens') {
    existingDocumentId = properties.getProperty(legacyDocumentPropertyKey);
  }
  var document = null;
  var action = 'created';

  if (existingDocumentId) {
    var existingDocument = tryOpenExistingPrintedBulletinDocument_(
      existingDocumentId,
      properties,
      documentPropertyKey,
      legacyDocumentPropertyKey,
      location,
    );
    if (existingDocument) {
      document = existingDocument.document;
      action = 'updated';
    }
  }

  document = document || DocumentApp.create(title);
  if (action === 'updated') {
    DriveApp.getFileById(document.getId()).setName(title);
  }
  renderPrintedBulletinDocument_(document, bulletin, nextBulletin, format, location);
  document.saveAndClose();

  movePrintedBulletinToConfiguredFolder_(document.getId(), location);
  properties.setProperty(documentPropertyKey, document.getId());
  if (location === 'queens' && legacyDocumentPropertyKey !== documentPropertyKey) {
    properties.deleteProperty(legacyDocumentPropertyKey);
  }
  trashPrintedBulletinPdf_(properties, location, date);

  return {
    id: document.getId(),
    title: title,
    format: format,
    action: action,
    url: document.getUrl(),
    scheduleNotSet: scheduleNotSet,
  };
}

/**
 * Dialog action: makes the Word copy of a Sabbath's Doc for printing on a Mac
 * (#627), next to the Doc in Drive, replacing the copy made before. It reads the
 * Doc as it stands, so make it after the last edit. Any operator can.
 */
function createPrintedBulletinWordCopy(request) {
  var date = toIsoDate_(request && request.date);
  if (!date) {
    throw new Error('Sabbath date is required. / 安息日日期为必填。');
  }
  var location = normalizePrintedBulletinLocation_(request && request.location);
  var properties = PropertiesService.getScriptProperties();
  var documentId =
    properties.getProperty(
      getPrintedBulletinPropertyKey_(PRINTED_BULLETIN_CONFIG.documentPropertyPrefix, location, date),
    ) ||
    (location === 'queens' ? properties.getProperty(PRINTED_BULLETIN_CONFIG.documentPropertyPrefix + date) : null);
  var file = null;
  try {
    file = documentId ? DriveApp.getFileById(documentId) : null;
  } catch (error) {
    file = null;
  }
  if (!file || file.isTrashed()) {
    throw new Error(
      'There is no Google Doc for this Sabbath and location yet. Create it first, then make the Word copy.\n' +
        '这个安息日和地点还没有 Google 文档。请先创建，再制作 Word 副本。',
    );
  }

  var response = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' +
      encodeURIComponent(documentId) +
      '/export?mimeType=' +
      encodeURIComponent(PRINTED_BULLETIN_WORD_COPY.mimeType),
    {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
      muteHttpExceptions: true,
    },
  );
  if (response.getResponseCode() !== 200) {
    throw new Error(
      'Google Drive could not export the Doc as Word (' + response.getResponseCode() + '). Try again in a minute.\n' +
        'Google 云端硬盘无法将文档导出为 Word（' + response.getResponseCode() + '）。请稍后再试。',
    );
  }

  var lineHeight = Number(properties.getProperty(PRINTED_BULLETIN_WORD_COPY.lineHeightProperty));
  if (!(lineHeight >= 0.8 && lineHeight <= 2)) {
    lineHeight = PRINTED_BULLETIN_WORD_COPY.lineHeight;
  }
  var fonts = readPrintedBulletinFonts_();
  // A .docx is a zip, but Drive labels it as Word, and Utilities.unzip takes
  // only a blob labelled application/zip.
  var parts = Utilities.unzip(response.getBlob().setContentType('application/zip'));
  var styles = parts.filter(function (part) {
    return part.getName() === 'word/styles.xml';
  })[0];
  var defaults = readPrintedDocxDefaults_(styles ? styles.getDataAsString('UTF-8') : '');
  var name = file.getName() + PRINTED_BULLETIN_WORD_COPY.nameSuffix;
  var rewritten = parts.map(function (part) {
    var partName = part.getName();
    if (partName !== 'word/document.xml' && partName !== 'word/styles.xml') {
      return part;
    }
    var xml = part.getDataAsString('UTF-8');
    xml =
      partName === 'word/document.xml'
        ? convertPrintedDocxDocumentXml_(xml, {
            chineseFonts: [fonts.chinese, fonts.chineseFallback],
            lineHeight: lineHeight,
            defaultSize: defaults.size,
            defaultMultiple: defaults.multiple,
          })
        : setPrintedDocxEastAsiaFonts_(xml, []);
    return Utilities.newBlob(xml, 'application/xml', partName);
  });
  var docx = Utilities.zip(rewritten, name).setContentType(PRINTED_BULLETIN_WORD_COPY.mimeType);

  var parents = file.getParents();
  var folder = parents.hasNext() ? parents.next() : DriveApp.getRootFolder();
  var previous = folder.getFilesByName(name);
  while (previous.hasNext()) {
    previous.next().setTrashed(true);
  }
  var copy = folder.createFile(docx);
  return {
    name: name,
    url: copy.getUrl(),
    downloadUrl: 'https://drive.google.com/uc?export=download&id=' + copy.getId(),
  };
}

// styles.xml's default font size, in points, and line spacing multiple, which a
// paragraph or run without its own uses.
function readPrintedDocxDefaults_(stylesXml) {
  var xml = String(stylesXml || '');
  var runDefaults = (xml.match(/<w:rPrDefault>[\s\S]*?<\/w:rPrDefault>/) || [''])[0];
  var paragraphDefaults = (xml.match(/<w:pPrDefault>[\s\S]*?<\/w:pPrDefault>/) || [''])[0];
  var size = runDefaults.match(/<w:sz w:val="(\d+)"/);
  var spacing = paragraphDefaults.match(/<w:spacing\b[^>]*>/);
  var multiple = 1;
  if (spacing && /w:line="(\d+)"/.test(spacing[0]) && !/w:lineRule="(exact|atLeast)"/.test(spacing[0])) {
    multiple = Number(spacing[0].match(/w:line="(\d+)"/)[1]) / 240;
  }
  return { size: size ? Number(size[1]) / 2 : 11, multiple: multiple };
}

// Every w:rFonts gets Songti TC as its East Asian font, with no theme font to
// override it. A run in one of `chineseFonts`, the Doc's Chinese and fallback
// fonts, gets Songti TC in every slot, so a character Word files under Latin,
// such as a full-width form, can't print in a font the Mac doesn't have.
function setPrintedDocxEastAsiaFonts_(xml, chineseFonts) {
  var songti = PRINTED_BULLETIN_WORD_COPY.chineseFont;
  return String(xml).replace(/<w:rFonts\b([^>]*?)(\/?)>/g, function (match, attributes, selfClosing) {
    var ascii = (attributes.match(/w:ascii="([^"]*)"/) || [])[1] || '';
    var chinese = (chineseFonts || []).indexOf(ascii) !== -1;
    var kept = attributes
      .replace(/\s+w:(eastAsia|eastAsiaTheme|hint)="[^"]*"/g, '')
      .replace(/\s+w:(ascii|hAnsi|cs|asciiTheme|hAnsiTheme|cstheme)="[^"]*"/g, function (slot) {
        return chinese ? '' : slot;
      });
    var slots = chinese
      ? ' w:ascii="' + songti + '" w:hAnsi="' + songti + '" w:cs="' + songti + '"'
      : '';
    return '<w:rFonts' + kept + slots + ' w:eastAsia="' + songti + '"' + selfClosing + '>';
  });
}

/**
 * The Word copy's document.xml: Songti TC for Chinese, no document grid for the
 * lines to snap to, and an exact line height on every paragraph without a
 * picture. The height is `lineHeight` times the paragraph's largest font size,
 * times its own line spacing (0.9 for the giving notes).
 */
function convertPrintedDocxDocumentXml_(xml, options) {
  var lineHeight = options.lineHeight;
  var defaultSize = options.defaultSize || 11;
  var defaultMultiple = options.defaultMultiple || 1;
  var converted = String(xml).replace(/<w:docGrid\b[^>]*\/>/g, '');
  // A paragraph's own opening tag, not a self-closing <w:p/>.
  converted = converted.replace(/<w:p(?:\s[^>]*[^\/>])?>[\s\S]*?<\/w:p>/g, function (paragraph) {
    if (/<w:(drawing|pict|object)\b/.test(paragraph)) {
      return paragraph;
    }
    var sizes = (paragraph.match(/<w:sz w:val="\d+"/g) || []).map(function (size) {
      return Number(size.match(/\d+/)[0]) / 2;
    });
    var largest = sizes.length ? Math.max.apply(null, sizes) : defaultSize;
    var properties = (paragraph.match(/<w:pPr>[\s\S]*?<\/w:pPr>/) || [''])[0];
    // The paragraph's own w:spacing, not a run's letter spacing, which is also
    // w:spacing but inside a w:rPr.
    var own = properties.split('<w:rPr>')[0];
    var spacing = own.match(/<w:spacing\b[^>]*\/>/);
    var multiple = defaultMultiple;
    if (spacing && /w:line="(\d+)"/.test(spacing[0]) && !/w:lineRule="(exact|atLeast)"/.test(spacing[0])) {
      multiple = Number(spacing[0].match(/w:line="(\d+)"/)[1]) / 240;
    }
    var exact = ' w:line="' + Math.round(largest * lineHeight * multiple * 20) + '" w:lineRule="exact"';
    var withSpacing;
    if (spacing) {
      withSpacing = properties.replace(
        spacing[0],
        spacing[0].replace(/\s+w:(line|lineRule)="[^"]*"/g, '').replace(/\s*\/>$/, exact + '/>'),
      );
    } else if (properties) {
      // w:spacing goes before these in w:pPr, as the schema orders them.
      var later = own.match(
        /<w:(ind|contextualSpacing|mirrorIndents|suppressOverlap|jc|textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|sectPr|pPrChange)\b/,
      );
      var before = later ? later[0] : properties.indexOf('<w:rPr>') !== -1 ? '<w:rPr>' : '</w:pPr>';
      withSpacing = properties.replace(before, '<w:spacing' + exact + '/>' + before);
    } else {
      return paragraph.replace(/^(<w:p[^>]*>)/, '$1<w:pPr><w:spacing' + exact + '/></w:pPr>');
    }
    return paragraph.replace(properties, withSpacing);
  });
  return setPrintedDocxEastAsiaFonts_(converted, options.chineseFonts);
}

function tryOpenExistingPrintedBulletinDocument_(
  documentId,
  properties,
  documentPropertyKey,
  legacyDocumentPropertyKey,
  location,
) {
  try {
    var file = DriveApp.getFileById(documentId);
    if (file.isTrashed()) {
      throw new Error('Saved bulletin document is in the Drive trash.');
    }
    return {
      document: DocumentApp.openById(documentId),
      action: 'updated',
    };
  } catch (error) {
    // A manually trashed document can still be opened by ID in some Apps Script
    // contexts. Treat it as missing so the next run creates a fresh document in
    // the configured location folder instead of updating the trashed copy.
    properties.deleteProperty(documentPropertyKey);
    if (location === 'queens' && legacyDocumentPropertyKey !== documentPropertyKey) {
      properties.deleteProperty(legacyDocumentPropertyKey);
    }
    return null;
  }
}

function normalizePrintedBulletinLocation_(requestedLocation) {
  var location = String(requestedLocation || 'queens').trim().toLowerCase();
  if (location === 'queens' || location === 'brooklyn') {
    return location;
  }
  throw new Error('Location must be queens or brooklyn');
}

function getPrintedBulletinTitle_(location, date, format) {
  return (
    date +
    ' Bulletin - ' +
    (format === 'communion' ? 'Holy Communion' : 'Regular Worship')
  );
}

function getPrintedBulletinPropertyKey_(prefix, location, date) {
  return prefix + location.toUpperCase() + '_' + date;
}

function renderPrintedBulletinDocument_(document, bulletin, nextBulletin, format, location) {
  var body = document.getBody();
  // Read the font Script Properties once per Doc, not once per paragraph.
  printedBulletinFonts_ = readPrintedBulletinFonts_();

  body.clear();
  body.setPageWidth(PRINTED_BULLETIN_CONFIG.pageWidth);
  body.setPageHeight(PRINTED_BULLETIN_CONFIG.pageHeight);
  body.setMarginTop(PRINTED_BULLETIN_CONFIG.pageMargin);
  // Regular bulletins place a footer immediately before the imposed page
  // break. A slightly smaller bottom margin leaves room for the break
  // paragraph itself and prevents an otherwise blank intervening page.
  body.setMarginBottom(
    format === 'regular'
      ? PRINTED_BULLETIN_CONFIG.pageMargin - 10
      : PRINTED_BULLETIN_CONFIG.pageMargin,
  );
  body.setMarginLeft(PRINTED_BULLETIN_CONFIG.bookletHorizontalMargin);
  body.setMarginRight(PRINTED_BULLETIN_CONFIG.bookletHorizontalMargin);

  if (location === 'brooklyn') {
    renderBrooklynPrintedBulletinDocument_(body, bulletin, nextBulletin, format);
    return;
  }

  if (format === 'communion') {
    renderCommunionPrintedBulletinDocument_(body, bulletin, nextBulletin);
    return;
  }

  // Keep the Queens regular renderer as the stable reference layout.
  renderQueensRegularPrintedBulletinDocument_(body, bulletin, nextBulletin, format);
}

function appendSharedCoverPanel_(cell, bulletin, format, location) {
  // Keep the cover's 368-point inner layout stable while the booklet page
  // gutter is handled by appendBookletPage_.
  var primaryAddress =
    normalizePrintedBulletinLocation_(location) === 'brooklyn'
      ? '5318 4th Avenue, Brooklyn, NY 11220'
      : '7606 41st Ave, Elmhurst, NY 11373';
  cell.setPaddingLeft(0);
  cell.setPaddingRight(0);
  appendPrintedBulletinLogo_(cell);
  appendPanelHeading_(
    cell,
    printedBilingualText_(
      PRINTED_BULLETIN_CONFIG.churchName,
      PRINTED_BULLETIN_CONFIG.churchNameChinese,
    ),
  );
  appendCenteredText_(cell, primaryAddress, PRINTED_BULLETIN_TYPE.bodySize, true);
  appendCenteredText_(cell, formatSharedCoverDate_(bulletin.date), PRINTED_BULLETIN_TYPE.bodySize, true);
  appendPrintedBulletinCoverImage_(cell, format);
  appendSharedCoverContactColumns_(cell);
}

function appendSharedCoverContactColumns_(cell) {
  var table = cell.appendTable([['', '']]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, 184);
  table.setColumnWidth(1, 184);
  [
    [
      { text: 'Elmhurst Service | 安息日聚會', bold: true },
      { text: 'Saturdays 10:30 AM | 每週六上午 10:30', bold: true },
      { text: '7606 41st Avenue', italic: true, bold: false },
      { text: 'Elmhurst, NY 11373', italic: true, bold: false },
    ],
    [
      { text: 'Brooklyn Service | 布魯克林安息日聚會', bold: true },
      { text: 'Saturdays 10:30 AM | 每週六上午 10:30', bold: true },
      { text: '5318 4th Avenue,', italic: true, bold: false },
      { text: 'Brooklyn, NY 11220', italic: true, bold: false },
    ],
  ].forEach(function (lines, index) {
    var tableCell = table.getCell(0, index);
    tableCell.clear();
    tableCell.setPaddingTop(2);
    tableCell.setPaddingBottom(2);
    appendSharedCoverContactLines_(tableCell, lines);
  });

  appendSpacer_(cell);
  appendSharedCoverContactLines_(cell, [
    { text: 'Flushing Fellowship | 法拉盛團契聚會', bold: true },
    { text: 'Thursday 7:30 PM (6:30 PM Dinner) | 每週四晚 7:30 (6:30 晚餐)', bold: true },
    { text: '143-11 Willets Point Boulevard', italic: true, bold: false },
    { text: 'Whitestone, NY 11357', italic: true, bold: false },
  ], DocumentApp.HorizontalAlignment.CENTER);
}

function appendSharedCoverContactLines_(cell, lines, alignment) {
  alignment = alignment || DocumentApp.HorizontalAlignment.CENTER;
  lines.forEach(function (line) {
    var paragraph = cell.appendParagraph(line.text);
    paragraph.setAlignment(alignment);
    paragraph.setLineSpacing(PRINTED_BULLETIN_TYPE.lineSpacing);
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    var rendered = paragraph.editAsText();
    styleText_(rendered, PRINTED_BULLETIN_TYPE.bodySize, line.bold !== false);
    rendered.setItalic(Boolean(line.italic));
  });
}

function formatSharedCoverDate_(date) {
  var parts = toIsoDate_(date).split('-');
  var month = Number(parts[1]);
  var day = Number(parts[2]);
  return parts[0] + '.' + month + '.' + day;
}

function appendPrintedBulletinCoverImage_(cell, format) {
  var imageKind = format === 'communion' ? 'lastSupper' : 'churchSketch';
  var fileId = getPrintedBulletinImageFileId_(imageKind);
  if (!fileId) {
    return false;
  }

  try {
    var image = cell.appendImage(DriveApp.getFileById(fileId).getBlob());
    var width = image.getWidth();
    var height = image.getHeight();
    // InlineImage#setWidth uses CSS pixels, while the Letter layout above is
    // measured in points. Communion uses a smaller square image so its title,
    // contacts, and cover content stay on the cover face.
    var maxWidth =
      format === 'communion'
        ? PRINTED_BULLETIN_CONFIG.communionCoverImageMaxWidth
        : PRINTED_BULLETIN_CONFIG.regularCoverImageMaxWidth;
    if (width > maxWidth) {
      image.setWidth(maxWidth);
      image.setHeight(Math.round((height * maxWidth) / width));
    }
    centerPrintedBulletinImage_(image);
    return true;
  } catch (error) {
    Logger.log(imageKind + ' cover image could not be loaded: ' + error);
    return false;
  }
}

function getPrintedBulletinImageFileId_(imageKind) {
  var propertyName =
    imageKind === 'lastSupper'
      ? PRINTED_BULLETIN_CONFIG.lastSupperImageProperty
      : PRINTED_BULLETIN_CONFIG.churchSketchImageProperty;
  var properties = PropertiesService.getScriptProperties();
  var configuredId = properties.getProperty(propertyName);
  if (configuredId) {
    return configuredId;
  }

  // Preserve the earlier Brooklyn-only property as a fallback for existing
  // installations that already configured the sketch there.
  if (imageKind === 'churchSketch') {
    var legacyId = properties.getProperty(
      PRINTED_BULLETIN_CONFIG.legacyBrooklynCoverImageProperty,
    );
    if (legacyId) {
      return legacyId;
    }
  }

  return imageKind === 'lastSupper'
    ? PRINTED_BULLETIN_CONFIG.lastSupperImageFileId
    : PRINTED_BULLETIN_CONFIG.churchSketchImageFileId;
}

function resolvePrintedBulletinFormat_(requestedFormat, bulletin) {
  var format = String(requestedFormat || '')
    .trim()
    .toLowerCase();

  if (!format || format === 'auto') {
    var remark = String(bulletin.specialRemark || '').toLowerCase();
    return /communion|foot\s*washing/.test(remark) ? 'communion' : 'regular';
  }
  if (format === 'regular' || format === 'communion') {
    return format;
  }
  throw new Error('Format must be regular or communion');
}

function validatePrintedBulletinCombination_(location, format) {
  if (location === 'brooklyn' && format === 'communion') {
    throw new Error(
      'Brooklyn Communion bulletins are not available yet. Choose Regular for Brooklyn. / 目前尚未提供布鲁克林圣餐周刊；布鲁克林请选择普通格式。',
    );
  }
}

function getNextSabbathDate_(requestedDate) {
  var date = toIsoDate_(requestedDate);
  if (!date) {
    throw new Error('A valid Sabbath date is required');
  }
  var parts = date.split('-');
  var next = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + 7));
  return [next.getUTCFullYear(), pad2_(next.getUTCMonth() + 1), pad2_(next.getUTCDate())].join('-');
}

function tryBuildPrivateBulletin_(requestedDate, nameDictionary) {
  try {
    return preparePrintedBulletinForPrint_(
      buildBulletin_(requestedDate, { includeFullNames: true }),
      nameDictionary || buildPhysicalNameDictionary_(),
    );
  } catch (error) {
    return null;
  }
}

function normalizePhysicalBibleTranslations_(requested) {
  requested = requested || {};
  var english = String(
    requested.englishTranslation || requested.english || PRINTED_BULLETIN_CONFIG.bibleEnglishTranslation,
  );
  var chinese = String(
    requested.chineseTranslation || requested.chinese || PRINTED_BULLETIN_CONFIG.bibleChineseTranslation,
  );
  var englishOptions = PRINTED_BIBLE_TRANSLATION_OPTIONS.english;
  var chineseOptions = PRINTED_BIBLE_TRANSLATION_OPTIONS.chinese;
  var validEnglish = Object.keys(englishOptions).some(function (key) {
    return englishOptions[key].id === english;
  });
  var validChinese = Object.keys(chineseOptions).some(function (key) {
    return chineseOptions[key].id === chinese;
  });
  return {
    english: validEnglish ? english : PRINTED_BULLETIN_CONFIG.bibleEnglishTranslation,
    chinese: validChinese ? chinese : PRINTED_BULLETIN_CONFIG.bibleChineseTranslation,
  };
}

function getPhysicalBibleTranslationShortName_(translation) {
  var groups = [
    PRINTED_BIBLE_TRANSLATION_OPTIONS.english,
    PRINTED_BIBLE_TRANSLATION_OPTIONS.chinese,
  ];
  for (var groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    var keys = Object.keys(groups[groupIndex]);
    for (var keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
      var option = groups[groupIndex][keys[keyIndex]];
      if (option.id === translation) {
        if (translation === 'cmn_cuv') {
          return '和合本';
        }
        return keys[keyIndex];
      }
    }
  }
  return translation;
}

function hydratePhysicalBibleVerses_(bulletin, bibleTranslations) {
  var translations = normalizePhysicalBibleTranslations_(bibleTranslations);
  ['queens', 'brooklyn'].forEach(function (locationKey) {
    var location = bulletin[locationKey];
    var reference = String(location.bibleVerses || '').trim();
    if (!reference) {
      location.bibleVerseText = null;
      return;
    }

    try {
      location.bibleVerseText = resolvePhysicalBiblePassage_(reference, translations);
    } catch (error) {
      Logger.log(
        'Bible text lookup failed for ' + locationKey + ' (' + reference + '): ' + error,
      );
      location.bibleVerseText = null;
    }
  });
  hydratePrintedCommunionPassages_(bulletin, translations);
  return bulletin;
}

function hydratePhysicalSunsetTimes_(bulletin, nextBulletin) {
  [bulletin, nextBulletin].forEach(function (entry) {
    if (!entry || !entry.date) {
      return;
    }
    var sunset = getPhysicalSunsetTime_(entry.date);
    if (!sunset) {
      return;
    }
    entry.sunsetTime = sunset;
    if (entry.queens) {
      entry.queens.sunsetTime = sunset;
    }
    if (entry.brooklyn) {
      entry.brooklyn.sunsetTime = sunset;
    }
  });
}

function getPhysicalSunsetTime_(date) {
  var requestedDate = toIsoDate_(date);
  if (!requestedDate || typeof UrlFetchApp === 'undefined') {
    return '';
  }

  var url =
    PRINTED_BULLETIN_CONFIG.sunsetApiBaseUrl +
    '?lat=' +
    encodeURIComponent(PRINTED_BULLETIN_CONFIG.sunsetLatitude) +
    '&lng=' +
    encodeURIComponent(PRINTED_BULLETIN_CONFIG.sunsetLongitude) +
    '&date=' +
    encodeURIComponent(requestedDate) +
    '&formatted=0';
  try {
    var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      Logger.log('Sunset API returned HTTP ' + response.getResponseCode() + ' for ' + requestedDate);
      return '';
    }
    var payload = JSON.parse(response.getContentText());
    if (!payload || payload.status !== 'OK' || !payload.results || !payload.results.sunset) {
      Logger.log('Sunset API returned no sunset for ' + requestedDate);
      return '';
    }
    return Utilities.formatDate(
      new Date(payload.results.sunset),
      PRINTED_BULLETIN_CONFIG.sunsetTimeZone,
      'h:mm a',
    );
  } catch (error) {
    Logger.log('Sunset lookup failed for ' + requestedDate + ': ' + error);
    return '';
  }
}

/**
 * This Sabbath's adult Sabbath School lesson, in English and Traditional
 * Chinese, or blanks if the catalog can't be read. The class discusses the
 * lesson studied the week before, so it's the lesson whose week (Sabbath to
 * Friday) ends the day before this Sabbath. That Friday is always in the
 * lesson's own quarter, since a quarter starts on the Sabbath on or before
 * its first day.
 */
function getPhysicalSabbathSchoolLesson_(date) {
  var lesson = { english: '', chinese: '' };
  var requestedDate = toIsoDate_(date);
  if (!requestedDate || typeof UrlFetchApp === 'undefined') {
    return lesson;
  }
  var parts = requestedDate.split('-');
  var friday = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) - 1));
  var quarter =
    friday.getUTCFullYear() + '-' + pad2_(Math.floor(friday.getUTCMonth() / 3) + 1);
  var fridayKey =
    friday.getUTCFullYear() + '-' + pad2_(friday.getUTCMonth() + 1) + '-' + pad2_(friday.getUTCDate());
  [
    { key: 'english', path: '/en/quarterlies/' + quarter, format: function (number, title) { return 'Lesson ' + number + ': ' + title; } },
    { key: 'chinese', path: '/zh/quarterlies/' + quarter + '-hant', format: function (number, title) { return '第' + number + '課 ' + title; } },
  ].forEach(function (source) {
    var url = PRINTED_BULLETIN_CONFIG.sabbathSchoolApiBaseUrl + source.path + '/index.json';
    try {
      var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
        Logger.log('Sabbath School catalog returned HTTP ' + response.getResponseCode() + ' for ' + url);
        return;
      }
      var lessons = (JSON.parse(response.getContentText()) || {}).lessons || [];
      for (var index = 0; index < lessons.length; index += 1) {
        var entry = lessons[index] || {};
        var start = toAdventechIsoDate_(entry.start_date);
        var end = toAdventechIsoDate_(entry.end_date);
        var title = String(entry.title || '').trim();
        if (start && end && title && start <= fridayKey && fridayKey <= end) {
          lesson[source.key] = source.format(Number(entry.id) || entry.id, title);
          return;
        }
      }
    } catch (error) {
      Logger.log('Sabbath School lesson lookup failed for ' + url + ': ' + error);
    }
  });
  return lesson;
}

// Adventech writes dates as DD/MM/YYYY.
function toAdventechIsoDate_(value) {
  var match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? match[3] + '-' + match[2] + '-' + match[1] : '';
}

function formatSabbathSchoolLessonForPrint_(lesson) {
  lesson = lesson || {};
  var english = String(lesson.english || '').trim();
  var chinese = String(lesson.chinese || '').trim();
  return english || chinese ? printedBilingualText_(english, chinese) : physicalTbdText_();
}

// Each Sabbath School hymn, as one entry: the Chinese, then the English on the
// next line, as in every other row, where the hymnal map has the other one,
// such as "第413首 教會根基" over "AH 348 The Church Has One Foundation" for a
// typed "第413首 教會根基"; otherwise the hymn once, on one line, as typed or
// with its number and title, never repeated where the translation would go. A
// bare number is a Chinese hymnal number, and prints as 第N首. The other side
// gets its number and title from resolvePrintedHymnText_ (#619).
function getPrintedSabbathSchoolHymnLines_(hymns) {
  var lines = [];
  (hymns || []).forEach(function (value) {
    var entry = String(value === null || typeof value === 'undefined' ? '' : value).trim();
    if (!entry) {
      return;
    }
    var isEnglish = /[A-Za-z]/.test(entry) && !/[\u3400-\u9fff]/.test(entry);
    var resolved = isEnglish
      ? resolvePrintedHymnText_(entry, '')
      : resolvePrintedHymnText_('', /^\d+$/.test(entry) ? '第' + entry + '首' : entry);
    var english = resolved.english;
    var chinese = resolved.chinese;
    // Both languages on their own lines: on one, a long title wrapped mid-word.
    // A hymn with only one side prints that side once, not on both lines.
    lines.push(
      english && chinese && english !== chinese
        ? printedBilingualText_(english, chinese)
        : english || chinese || entry,
    );
  });
  return lines;
}

// Two or more hymns are numbered, so a hymn's two lines read as one hymn and
// a hymn in one language isn't taken for the one above's translation.
function formatSabbathSchoolHymnsForPrint_(hymns) {
  var lines = getPrintedSabbathSchoolHymnLines_(hymns);
  if (lines.length === 1) {
    return printedOneLanguageText_(lines[0]);
  }
  return lines.length
    ? lines
        .map(function (line, index) {
          return index + 1 + '. ' + line;
        })
        .join('\n')
    : physicalTbdText_();
}

/**
 * The Sabbath School's Opening Hymn and Closing Hymn rows. The closing sings
 * the opening hymns again, so its row says so instead of listing them twice.
 * `openingChinese` is the location's Chinese label for the opening hymns.
 */
function getPrintedSabbathSchoolHymnRows_(hymns, openingChinese, closingChinese) {
  var lines = getPrintedSabbathSchoolHymnLines_(hymns);
  var plural = lines.length > 1;
  var congregation = printedBilingualText_('Congregation', '會眾');
  return {
    opening: [
      printedBilingualText_(plural ? 'Opening Hymns' : 'Opening Hymn', openingChinese),
      formatSabbathSchoolHymnsForPrint_(hymns),
      congregation,
    ],
    closing: [
      printedBilingualText_(plural ? 'Closing Hymns' : 'Closing Hymn', closingChinese),
      lines.length
        ? printedBilingualText_(
            plural ? 'Same as Opening Hymns' : 'Same as Opening Hymn',
            '同' + openingChinese,
          )
        : physicalTbdText_(),
      congregation,
    ],
  };
}

function resolvePhysicalBiblePassage_(reference, bibleTranslations, includeVerseLines) {
  // Bible text must always come from the configured HelloAO Bible API below.
  // Do not replace this with LanguageApp, an LLM, or any other machine
  // translation: the printed bulletin must reproduce the selected Bible
  // translation exactly, in both languages.
  var references = parsePhysicalBibleReferences_(reference);
  if (!references.length) {
    return null;
  }

  var translations = normalizePhysicalBibleTranslations_(bibleTranslations);
  var englishParts = [];
  var chineseParts = [];
  references.forEach(function (passage) {
    englishParts = englishParts.concat(
      selectPhysicalBibleVerses_(
        fetchPhysicalBibleChapter_(translations.english, passage),
        passage,
      ),
    );
    chineseParts = chineseParts.concat(
      selectPhysicalBibleVerses_(
        fetchPhysicalBibleChapter_(translations.chinese, passage),
        passage,
      ),
    );
  });

  var result = {
    english: englishParts.join(' '),
    chinese: chineseParts.join(' '),
    references: references,
  };
  if (includeVerseLines) {
    result.englishVerses = englishParts;
    result.chineseVerses = chineseParts;
  }
  return result;
}

function parsePhysicalBibleReferences_(value) {
  return parsePhysicalBibleReferencePieces_(value)
    .map(function (piece) {
      return piece.reference;
    })
    .filter(Boolean);
}

// Each passage in a reference, such as "John 3:16; Psalm 23", with its parsed
// reference, or null when it can't be read.
function parsePhysicalBibleReferencePieces_(value) {
  var source = String(value || '')
    .replace(/[：]/g, ':')
    .replace(/[–—]/g, '-')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
  if (!source) {
    return [];
  }

  return source
    .split(/[;；,，\n]/)
    .reduce(function (all, piece) {
      return all.concat(piece.split(/\s+(?:and|&)\s+/i));
    }, [])
    .map(function (piece) {
      return piece.trim();
    })
    .filter(Boolean)
    .map(function (piece) {
      return { text: piece, reference: parsePhysicalBibleReferencePiece_(piece) };
    });
}

function parsePhysicalBibleReferencePiece_(piece) {
  // Accept both "Jeremiah 29:11-15" and the common shorthand
  // "Jeremiah:29:11-15".
  piece = piece.replace(/^(.+?):(\d+):/, '$1 $2:');
  var match = piece.match(
    /^(.+?)\s+(\d+)(?:\s*:\s*(\d+)(?:\s*-\s*(\d+))?)?$/,
  );
  if (!match) {
    return null;
  }

  var bookName = normalizePhysicalBibleBookName_(match[1]);
  var bookId = PRINTED_BIBLE_BOOK_IDS[bookName];
  if (!bookId) {
    return null;
  }

  var chapter = Number(match[2]);
  if (chapter < 1 || chapter > (PRINTED_BIBLE_CHAPTER_COUNTS[bookId] || chapter)) {
    return null;
  }
  var verseStart = match[3] ? Number(match[3]) : null;
  var verseEnd = match[4] ? Number(match[4]) : verseStart;
  if (verseStart === 0 || (verseStart && verseEnd < verseStart)) {
    return null;
  }

  return {
    bookId: bookId,
    chapter: chapter,
    verseStart: verseStart,
    verseEnd: verseEnd,
  };
}

function formatPhysicalBibleReferenceLabels_(location, bibleTranslations) {
  var translations = normalizePhysicalBibleTranslations_(bibleTranslations);
  var englishShortName = getPhysicalBibleTranslationShortName_(translations.english);
  var chineseShortName = getPhysicalBibleTranslationShortName_(translations.chinese);
  var references = parsePhysicalBibleReferences_(location && location.bibleVerses);
  if (!references.length) {
    return {
      english: 'TBD (' + englishShortName + ')',
      chinese: '尚未確定（' + chineseShortName + '）',
    };
  }

  return {
    english:
      references.map(function (passage) {
        return formatPhysicalBibleReference_(passage, 'english');
      }).join('; ') + ' (' + englishShortName + ')',
    chinese:
      references.map(function (passage) {
        return formatPhysicalBibleReference_(passage, 'chinese');
      }).join('；') + '（' + chineseShortName + '）',
  };
}

function formatPhysicalBibleReference_(passage, language) {
  var labels = PRINTED_BIBLE_BOOK_LABELS[passage.bookId] || {
    english: 'Bible',
    chinese: '聖經',
  };
  var reference = labels[language] + ' ' + passage.chapter;
  if (passage.verseStart) {
    reference += ':' + passage.verseStart;
    if (passage.verseEnd !== passage.verseStart) {
      reference += '–' + passage.verseEnd;
    }
  }
  return reference;
}

function normalizePhysicalBibleBookName_(value) {
  var name = String(value || '')
    .replace(/[.]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  var aliases = {
    ps: 'psalm',
    psa: 'psalm',
    'song of songs': 'song of solomon',
    canticles: 'song of solomon',
  };
  return aliases[name] || name;
}

function fetchPhysicalBibleChapter_(translation, passage) {
  // This is the single authoritative Bible-text fetch path for printed
  // bulletins and Sabbath Encouragement. The endpoint is HelloAO; callers must
  // never machine-translate Bible text after it is returned.
  var cacheKey =
    'physical-bible:' + translation + ':' + passage.bookId + ':' + passage.chapter;
  var cache = CacheService.getScriptCache();
  var cached = cache.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  var url =
    PRINTED_BULLETIN_CONFIG.bibleApiBaseUrl +
    '/' +
    encodeURIComponent(translation) +
    '/' +
    encodeURIComponent(passage.bookId) +
    '/' +
    encodeURIComponent(passage.chapter) +
    '.simple.json';
  var response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  var responseCode = response.getResponseCode();
  if (responseCode < 200 || responseCode >= 300) {
    throw new Error('HelloAO returned HTTP ' + responseCode + ' for ' + url);
  }

  var payload = JSON.parse(response.getContentText());
  var content = payload.chapter && payload.chapter.content;
  if (!Array.isArray(content)) {
    throw new Error('HelloAO returned no chapter content for ' + url);
  }

  var verses = {};
  content.forEach(function (item) {
    if (!item || item.type !== 'verse' || !item.number) {
      return;
    }
    verses[String(item.number)] = String(item.text || '').trim();
  });

  cache.put(cacheKey, JSON.stringify(verses), PRINTED_BULLETIN_CONFIG.bibleCacheSeconds);
  return verses;
}

function selectPhysicalBibleVerses_(chapter, passage) {
  var numbers = Object.keys(chapter).map(Number).sort(function (left, right) {
    return left - right;
  });
  var start = passage.verseStart || numbers[0];
  var end = passage.verseEnd || numbers[numbers.length - 1];
  return numbers
    .filter(function (number) {
      return number >= start && number <= end && chapter[String(number)];
    })
    .map(function (number) {
      return chapter[String(number)];
    });
}

/**
 * The tab listing who prints with a title. Maintainers keep it current; the
 * schedule and the Name Dictionary keep plain names.
 */
var PHYSICAL_LEADERSHIP_SHEET_NAME = 'Leadership';

/**
 * Leadership columns whose names print with a title. Each column is found by
 * a header that holds only the title words (`Pastors`, `Pastor(s)`,
 * `Pastors 牧師`, `牧師`). A person in more than one list takes the first title
 * here.
 */
var PHYSICAL_NAME_TITLES = Object.freeze([
  Object.freeze({
    key: 'pastor',
    words: /pastors?|牧[師师]/gi,
    english: 'Pastor',
    chinese: '牧師',
  }),
  Object.freeze({
    key: 'elder',
    words: /elders?|長老|长老/gi,
    english: 'Elder',
    chinese: '長老',
  }),
]);

function buildPhysicalNameDictionary_() {
  var sheet = getBulletinSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'Name Dictionary');
  var dictionary = {
    englishToChinese: {},
    chineseToEnglish: {},
    pinyinToChinese: {},
    pinyinToEnglish: {},
    titles: {},
    titledNames: {},
    heads: {},
  };
  if (!sheet) {
    Logger.log('Name Dictionary sheet not found; printing source names only.');
    readPhysicalLeadershipTitles_(dictionary);
    return dictionary;
  }

  var table = readTable_(sheet);
  table.rows.forEach(function (row) {
    var english = displayValue_(row[0]).trim();
    var chinese = displayValue_(row[1]).trim();
    // Pinyin aliases are derived from the Chinese Name value. The dictionary
    // intentionally has no stored third pinyin field, so the printed renderer
    // supports alternate pinyin input without duplicating personal data.
    var pinyinAliases = getPhysicalPinyinAliases_(chinese);
    var englishKey = normalizePhysicalNameKey_(english);
    var chineseKey = normalizePhysicalNameKey_(chinese);
    if (englishKey && chinese && !dictionary.englishToChinese[englishKey]) {
      dictionary.englishToChinese[englishKey] = chinese;
    }
    if (chineseKey && english && !dictionary.chineseToEnglish[chineseKey]) {
      dictionary.chineseToEnglish[chineseKey] = english;
    }
    pinyinAliases.forEach(function (alias) {
      var pinyinKey = normalizePhysicalPinyinKey_(alias);
      if (pinyinKey && english && chinese) {
        if (!dictionary.pinyinToChinese[pinyinKey]) {
          dictionary.pinyinToChinese[pinyinKey] = chinese;
        }
        if (!dictionary.pinyinToEnglish[pinyinKey]) {
          dictionary.pinyinToEnglish[pinyinKey] = english;
        }
      }
    });
  });
  readPhysicalLeadershipTitles_(dictionary);
  return dictionary;
}

/**
 * Reads the Leadership tab's title columns (Pastors, Elders) into a lookup
 * keyed by normalized name. A list may hold the English or the Chinese name;
 * each entry titles both of the person's names from the Name Dictionary, so
 * either language matches a schedule cell. titledNames keeps each list in
 * sheet order, and heads holds each list's name on the row labeled Head.
 */
// Titles a maintainer might type around a name in the Leadership tab, in
// English or either Chinese script.
var PHYSICAL_TYPED_TITLE_PREFIX = /^(?:(?:pastors?|elders?)[\s:：.]+|(?:牧[師师]|長老|长老)[\s:：]*)/i;
var PHYSICAL_TYPED_TITLE_SUFFIX = /\s*(?:牧[師师]|長老|长老)$/;

function readPhysicalLeadershipTitles_(dictionary) {
  PHYSICAL_NAME_TITLES.forEach(function (title) {
    dictionary.titledNames[title.key] = [];
  });
  var sheet = getBulletinSheet_(
    SpreadsheetApp.getActiveSpreadsheet(),
    PHYSICAL_LEADERSHIP_SHEET_NAME,
  );
  if (!sheet) {
    Logger.log('Leadership sheet not found; printing names without titles.');
    return;
  }

  var table = readTable_(sheet);
  var columns = PHYSICAL_NAME_TITLES.map(function (title) {
    var column = -1;
    table.headers.forEach(function (header, index) {
      var compact = String(header || '').replace(/[^A-Za-z\u3400-\u9fff]/g, '');
      if (column === -1 && compact && !compact.replace(title.words, '')) {
        column = index;
      }
    });
    return column;
  });
  // "Head" in any other cell of a row marks that row's names as the heads,
  // such as the pastor who leads Communion.
  var headRows = table.rows.map(function (row) {
    return row.some(function (value, index) {
      return columns.indexOf(index) === -1 && normalizePhysicalNameKey_(displayValue_(value)) === 'head';
    });
  });

  PHYSICAL_NAME_TITLES.forEach(function (title, titleIndex) {
    var column = columns[titleIndex];
    if (column === -1) {
      Logger.log('Leadership has no ' + title.english + 's column; printing without that title.');
      return;
    }
    table.rows.forEach(function (row, rowIndex) {
      // A title typed into the list is dropped so it doesn't print twice.
      var name = displayValue_(row[column])
        .replace(/\s+/g, ' ')
        .replace(PHYSICAL_TYPED_TITLE_PREFIX, '')
        .replace(PHYSICAL_TYPED_TITLE_SUFFIX, '')
        .trim();
      var key = normalizePhysicalNameKey_(name);
      if (!key) {
        return;
      }
      dictionary.titledNames[title.key].push(name);
      if (headRows[rowIndex] && !dictionary.heads[title.key]) {
        dictionary.heads[title.key] = name;
      }
      [
        key,
        normalizePhysicalNameKey_(dictionary.englishToChinese[key]),
        normalizePhysicalNameKey_(dictionary.chineseToEnglish[key]),
      ].forEach(function (titleKey) {
        if (titleKey && !dictionary.titles[titleKey]) {
          dictionary.titles[titleKey] = { english: title.english, chinese: title.chinese };
        }
      });
    });
  });
}

/**
 * Derives common surname-first and given-name-first pinyin forms from a
 * Chinese dictionary value. This is private print-only enrichment. The public
 * API never calls this function and never receives Chinese names or aliases.
 */
function getPhysicalPinyinAliases_(chinese) {
  if (typeof pinyinPro === 'undefined' || !pinyinPro || !pinyinPro.pinyin) {
    return [];
  }
  var compactChinese = String(chinese || '').replace(/[^\u3400-\u9fff\uf900-\ufaff]/g, '');
  if (!compactChinese) {
    return [];
  }
  try {
    var syllables = pinyinPro.pinyin(compactChinese, {
      type: 'array',
      toneType: 'none',
      separator: ' ',
    });
    if (!Array.isArray(syllables) || syllables.length < 2) {
      return [];
    }
    var surname = String(syllables[0] || '').trim();
    var givenSyllables = syllables.slice(1).map(function (syllable) {
      return String(syllable || '').trim();
    }).filter(Boolean);
    if (!surname || !givenSyllables.length) {
      return [];
    }
    var givenCompact = givenSyllables.join('');
    var givenSpaced = givenSyllables.join(' ');
    return [
      surname + ' ' + givenCompact,
      surname + ' ' + givenSpaced,
      givenCompact + ' ' + surname,
      givenSpaced + ' ' + surname,
    ];
  } catch (error) {
    Logger.log('Pinyin name enrichment failed; continuing without derived aliases: ' + error);
    return [];
  }
}

function preparePrintedBulletinForPrint_(bulletin, nameDictionary) {
  var personFields = [
    'sermon',
    'translation',
    'chineseTeacher',
    'englishTeacher',
    'youthTeacher',
    'kidsTeacher',
    'chairPastoralPrayer',
    'specialMusic',
    'offeringPrayer',
    'pianist',
    'ssChair',
    'ssOpeningPrayer',
    'closingPrayer',
    'flowerOffering',
    'sabbathSchool',
    'chair',
    'songLeader',
    'sabbathMessage',
    'technician',
    'encouragement',
  ];
  ['queens', 'brooklyn'].forEach(function (locationKey) {
    var location = bulletin[locationKey];
    // The roster grid's 7pt cells are too narrow for titles, so it reads
    // plain names from rosterNames. Every other printed row shows titles.
    location.rosterNames = {};
    personFields.forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(location, field)) {
        var value = location[field];
        location.rosterNames[field] = formatPhysicalPersonValue_(value, nameDictionary);
        location[field] = formatPhysicalPersonValue_(value, nameDictionary, { titles: true });
      }
    });
  });
  // The Leadership tab's head pastor leads Communion. Without a Head row, the
  // first name in Pastors does.
  var titledNames = (nameDictionary && nameDictionary.titledNames) || {};
  var heads = (nameDictionary && nameDictionary.heads) || {};
  var communionPastor = heads.pastor || (titledNames.pastor || [])[0] || '';
  bulletin.communionPastor = communionPastor
    ? formatPhysicalPersonValue_(communionPastor, nameDictionary, { titles: true })
    : '';
  return bulletin;
}

function formatPhysicalPersonValue_(value, nameDictionary, options) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value)
    .trim()
    .replace(/[^\S\r\n]+/g, ' ');
  if (!text) {
    return '';
  }

  var dictionary = nameDictionary || {
    englishToChinese: {},
    chineseToEnglish: {},
    pinyinToChinese: {},
    pinyinToEnglish: {},
  };
  var titles = options && options.titles ? dictionary.titles || {} : {};
  return text
    .split(/(\s*(?:\/|&|\+|\n|\band\b)\s*)/i)
    .map(function (part, index) {
      if (index % 2 === 1) {
        return part;
      }
      return formatPhysicalSinglePerson_(part, dictionary, titles);
    })
    .join('');
}

function formatPhysicalSinglePerson_(value, dictionary, titles) {
  var text = String(value || '').trim();
  var key = normalizePhysicalNameKey_(text);
  if (!key) {
    return text;
  }
  if (key === 'tbd') {
    return physicalTbdText_('尚未安排');
  }

  var chinese = dictionary.englishToChinese[key];
  if (chinese) {
    return formatPhysicalBilingualPerson_(chinese, text, titles);
  }

  var english = dictionary.chineseToEnglish[key];
  if (english) {
    return formatPhysicalBilingualPerson_(text, english, titles);
  }

  var pinyinKey = normalizePhysicalPinyinKey_(text);
  var pinyinChinese = dictionary.pinyinToChinese && dictionary.pinyinToChinese[pinyinKey];
  var pinyinEnglish = dictionary.pinyinToEnglish && dictionary.pinyinToEnglish[pinyinKey];
  if (pinyinChinese && pinyinEnglish) {
    return formatPhysicalBilingualPerson_(pinyinChinese, pinyinEnglish, titles);
  }

  return /[\u3400-\u9fff]/.test(text)
    ? formatPhysicalBilingualPerson_(text, '', titles)
    : formatPhysicalBilingualPerson_('', text, titles);
}

function formatPhysicalBilingualPerson_(chinese, english, titles) {
  var title =
    (titles && titles[normalizePhysicalNameKey_(english)]) ||
    (titles && titles[normalizePhysicalNameKey_(chinese)]);
  if (title) {
    // Chinese titles follow the name (溫保羅牧師). Drop the spacing that pads
    // a two-character name to three, since the title already lengthens it.
    chinese = chinese
      ? chinese.replace(/([\u3400-\u9fff])\s+(?=[\u3400-\u9fff])/g, '$1') + title.chinese
      : '';
    english = english ? title.english + ' ' + english : '';
  }
  // Google Docs can collapse a truly blank line in a table cell. Use a small,
  // explicit physical-only marker so the two language rows stay aligned. The
  // public digital API never uses this formatter.
  return (chinese || '—') + '\n' + (english || '—');
}

function normalizePhysicalNameKey_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    // A two-character Chinese name is often padded to three (何　偉); match
    // it with or without the padding.
    .replace(/([\u3400-\u9fff]) (?=[\u3400-\u9fff])/g, '$1')
    .toLowerCase();
}

function normalizePhysicalPinyinKey_(value) {
  return normalizePhysicalNameKey_(value).replace(/ü/g, 'u');
}

function movePrintedBulletinToConfiguredFolder_(documentId, location) {
  var folderId = getPrintedBulletinOutputFolderId_(location);
  if (!folderId) {
    return;
  }
  DriveApp.getFileById(documentId).moveTo(DriveApp.getFolderById(folderId));
}

function getPrintedBulletinOutputFolderId_(location) {
  var normalizedLocation = normalizePrintedBulletinLocation_(location);
  var locationProperty =
    normalizedLocation === 'brooklyn'
      ? PRINTED_BULLETIN_CONFIG.brooklynOutputFolderProperty
      : PRINTED_BULLETIN_CONFIG.queensOutputFolderProperty;
  var locationFolderId =
    PropertiesService.getScriptProperties().getProperty(locationProperty);
  if (locationFolderId) {
    return locationFolderId;
  }
  var configuredFolderId =
    normalizedLocation === 'brooklyn'
      ? PRINTED_BULLETIN_CONFIG.brooklynOutputFolderId
      : PRINTED_BULLETIN_CONFIG.queensOutputFolderId;
  if (configuredFolderId) {
    return configuredFolderId;
  }
  return (
    PropertiesService.getScriptProperties().getProperty(
      PRINTED_BULLETIN_CONFIG.outputFolderProperty,
    ) || PRINTED_BULLETIN_CONFIG.outputFolderId
  );
}

/**
 * Bulletins are only Google Docs now (#558): staff edit the Doc every week, so
 * a PDF made with it would soon be out of date, and Google Docs can download a
 * PDF whenever one is needed. A PDF this script made for the same date and
 * location before then goes to the trash, so it can't be mistaken for the Doc.
 */
function trashPrintedBulletinPdf_(properties, location, date) {
  var keys = [
    getPrintedBulletinPropertyKey_(PRINTED_BULLETIN_CONFIG.pdfPropertyPrefix, location, date),
  ];
  // Queens PDFs were once remembered by date alone.
  if (location === 'queens') {
    keys.push(PRINTED_BULLETIN_CONFIG.pdfPropertyPrefix + date);
  }
  keys.forEach(function (key) {
    var pdfId = properties.getProperty(key);
    if (!pdfId) {
      return;
    }
    try {
      DriveApp.getFileById(pdfId).setTrashed(true);
    } catch (error) {
      // A PDF that's already gone, or that this account can't reach, is fine.
    }
    properties.deleteProperty(key);
  });
}

function appendBookletPage_(body, leftRenderer, rightRenderer, isFirstPage, footerRenderer, footerOptions) {
  if (!isFirstPage) {
    appendCompactPageBreak_(body);
  }

  appendBookletContentTable_(body, leftRenderer, rightRenderer);

  if (footerRenderer) {
    appendBookletFooter_(body, footerRenderer, footerOptions);
  }
}

/**
 * A page break sits in its own paragraph. At the default 11pt that paragraph
 * doesn't fit under a spread that fills the page, so Docs moves it to a new
 * page and the break then leaves that page blank. Put the break in the empty
 * paragraph Docs keeps after the last table, and shrink it to fit.
 */
function appendCompactPageBreak_(body) {
  var lastIndex = body.getNumChildren() - 1;
  var last = lastIndex >= 0 ? body.getChild(lastIndex) : null;
  var paragraph =
    last &&
    last.getType() === DocumentApp.ElementType.PARAGRAPH &&
    last.asParagraph().getText() === ''
      ? last.asParagraph()
      : null;
  var pageBreak = paragraph ? paragraph.appendPageBreak() : body.appendPageBreak();
  pageBreak.getParent().setAttributes(getCompactParagraphAttributes_());
}

// A rule sits in a paragraph of Docs' default 11-point size. Three points
// leaves room for the line and gives the 10-point text the rest (#603).
function setPrintedRuleParagraphSize_(paragraph) {
  var attributes = {};
  attributes[DocumentApp.Attribute.FONT_SIZE] = 3;
  paragraph.setAttributes(attributes);
}

// One-point type and no spacing, for a paragraph that must take no room.
function getCompactParagraphAttributes_() {
  var attributes = {};
  attributes[DocumentApp.Attribute.FONT_SIZE] = 1;
  attributes[DocumentApp.Attribute.LINE_SPACING] = 1;
  attributes[DocumentApp.Attribute.SPACING_BEFORE] = 0;
  attributes[DocumentApp.Attribute.SPACING_AFTER] = 0;
  return attributes;
}

function appendBookletContentTable_(container, leftRenderer, rightRenderer) {
  var table = container.appendTable([['', '', '']]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, PRINTED_BULLETIN_CONFIG.bookletHalfWidth);
  table.setColumnWidth(1, PRINTED_BULLETIN_CONFIG.bookletFoldGutter);
  table.setColumnWidth(2, PRINTED_BULLETIN_CONFIG.bookletHalfWidth);
  var leftCell = table.getCell(0, 0);
  var gutterCell = table.getCell(0, 1);
  var rightCell = table.getCell(0, 2);
  leftCell.clear();
  gutterCell.clear();
  rightCell.clear();
  // clear() leaves an empty paragraph in Docs' default 11-point size at the
  // top of each panel. Shrinking it gives the 10-point text that room (#603).
  [leftCell, rightCell].forEach(function (cell) {
    var leadingParagraph = getLeadingEmptyParagraph_(cell);
    if (leadingParagraph) {
      leadingParagraph.setAttributes(getCompactParagraphAttributes_());
    }
  });
  leftCell.setPaddingBottom(0);
  gutterCell.setPaddingLeft(0);
  gutterCell.setPaddingRight(0);
  rightCell.setPaddingBottom(0);
  leftRenderer(leftCell);
  rightRenderer(rightCell);
}

function appendBookletFooter_(container, footerRenderer, footerOptions) {
  var rule = container.appendHorizontalRule();
  var ruleParent = rule.getParent();
  if (ruleParent && ruleParent.getType() === DocumentApp.ElementType.PARAGRAPH) {
    ruleParent.asParagraph().setLineSpacing(1);
    ruleParent.asParagraph().setSpacingBefore(
      footerOptions && footerOptions.ruleSpacingBefore
        ? footerOptions.ruleSpacingBefore
        : 0,
    );
    ruleParent.asParagraph().setSpacingAfter(0);
    setPrintedRuleParagraphSize_(ruleParent.asParagraph());
  }
  var qrColumns = footerOptions && footerOptions.qrColumns;
  var qrCount = qrColumns ? Math.max(1, footerOptions.qrCount || 3) : 0;
  var qrColumnIndexes = Array(qrCount).fill(0).map(function (_, index) {
    return index + 2;
  });
  var footerTable = container.appendTable(
    qrColumns ? [Array(qrCount + 2).fill('')] : [['', '', '']],
  );
  footerTable.setBorderWidth(0);
  footerTable.setColumnWidth(0, PRINTED_BULLETIN_CONFIG.bookletHalfWidth);
  footerTable.setColumnWidth(1, PRINTED_BULLETIN_CONFIG.bookletFoldGutter);
  if (qrColumns) {
    qrColumnIndexes.forEach(function (columnIndex) {
      footerTable.setColumnWidth(
        columnIndex,
        Math.floor((PRINTED_BULLETIN_CONFIG.bookletHalfWidth - 8) / qrCount),
      );
    });
  } else {
    footerTable.setColumnWidth(2, PRINTED_BULLETIN_CONFIG.bookletHalfWidth);
  }
  var footerLeftCell = footerTable.getCell(0, 0);
  var footerGutterCell = footerTable.getCell(0, 1);
  var footerRightCell = qrColumns ? null : footerTable.getCell(0, 2);
  var footerQrCells = qrColumns
    ? qrColumnIndexes.map(function (columnIndex) {
        return footerTable.getCell(0, columnIndex);
      })
    : [];
  [footerLeftCell, footerGutterCell].concat(footerRightCell ? [footerRightCell] : footerQrCells)
    .forEach(function (footerCell) {
      footerCell.clear();
      footerCell.setPaddingTop(0);
      footerCell.setPaddingBottom(0);
      footerCell.setPaddingLeft(0);
      footerCell.setPaddingRight(0);
    });
  // The giving text's longest lines fill the whole panel, which put them only
  // about 15pt (5mm) from the sheet edge. Many printers can't print the outer
  // 4–5mm, so keep them about 20pt in, like the rest of the page.
  footerLeftCell.setPaddingLeft(6);
  footerLeftCell.setPaddingRight(6);
  footerLeftCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
  if (footerRightCell) {
    footerRightCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
  }
  footerQrCells.forEach(function (footerCell) {
    footerCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
  });
  footerRenderer(footerLeftCell, footerRightCell, footerQrCells);
}

function appendPrintedBulletinLogo_(cell) {
  var fileId =
    PropertiesService.getScriptProperties().getProperty(
      PRINTED_BULLETIN_CONFIG.sdaLogoImageProperty,
    ) || PRINTED_BULLETIN_CONFIG.sdaLogoImageFileId;
  if (!fileId) {
    return false;
  }

  try {
    var image = cell.appendImage(DriveApp.getFileById(fileId).getBlob());
    var width = image.getWidth();
    var height = image.getHeight();
    // The source file is only 48x48, so give it a little more visual weight
    // while preserving its aspect ratio.
    var maxWidth = 56;
    if (width > maxWidth) {
      image.setWidth(maxWidth);
      image.setHeight(Math.round((height * maxWidth) / width));
    }
    centerPrintedBulletinImage_(image);
    return true;
  } catch (error) {
    Logger.log('SDA logo could not be loaded: ' + error);
    return false;
  }
}

function centerPrintedBulletinImage_(image) {
  var parent = image.getParent();
  if (parent && parent.getType() === DocumentApp.ElementType.PARAGRAPH) {
    parent.asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }
}

function appendPrintedAnnouncementsTable_(cell, entries) {
  entries = entries || [];
  if (!entries.length) {
    return;
  }

  // Keep the submitted announcement text verbatim. The table only changes
  // presentation: a wider English column and matching row heights. Long
  // announcements stay at body size (#603); staff shorten them in the Doc.
  var table = cell.appendTable(
    entries.map(function (entry) {
      return [String(entry.chinese || ''), String(entry.english || '')];
    }),
  );
  table.setBorderWidth(0);
  // Chinese is materially more compact than English. A 35/65 split gives the
  // English text more room without making the Chinese column feel cramped.
  table.setColumnWidth(0, 126);
  table.setColumnWidth(1, 234);

  entries.forEach(function (entry, rowIndex) {
    var row = table.getRow(rowIndex);
    [entry.chinese, entry.english].forEach(function (text, columnIndex) {
      var numberedText = formatPrintedAnnouncementNumberedText_(text, rowIndex);
      var tableCell = row.getCell(columnIndex);
      tableCell.clear();
      tableCell.setPaddingTop(2);
      tableCell.setPaddingBottom(2);
      tableCell.setPaddingLeft(1);
      tableCell.setPaddingRight(1);
      tableCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
      appendPrintedAnnouncementTableCell_(tableCell, numberedText);
    });
  });
}

function formatPrintedAnnouncementNumberedText_(value, rowIndex) {
  var text = String(value || '').trim();
  return text ? String(Number(rowIndex) + 1) + '. ' + text : '';
}

function appendPrintedAnnouncementTableCell_(cell, value) {
  var text = protectPrintedChinesePunctuation_(String(value || '').trim());
  if (!text) {
    return;
  }
  // Write into the empty paragraph clear() leaves, so no blank 11-point line
  // sits above each announcement.
  var paragraph = getLeadingEmptyParagraph_(cell);
  if (paragraph) {
    paragraph.setText(text);
  } else {
    paragraph = cell.appendParagraph(text);
  }
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  paragraph.setLineSpacing(PRINTED_BULLETIN_TYPE.lineSpacing);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  var rendered = paragraph.editAsText();
  styleText_(rendered, PRINTED_BULLETIN_TYPE.bodySize, false);
  var firstSentenceLength = getFirstPrintedAnnouncementSentenceLength_(text);
  if (firstSentenceLength > 0) {
    setPrintedLatinBold_(rendered, 0, firstSentenceLength - 1);
  }
}

function protectPrintedChinesePunctuation_(text) {
  text = String(text || '');
  if (!/[\u3400-\u9fff]/.test(text)) {
    return text;
  }
  // U+FEFF acts as a zero-width no-break joiner in Google Docs. Keep
  // full-width punctuation attached to the preceding character so a narrow
  // Chinese column does not start a line with a comma or period.
  return text.replace(
    /([\u3400-\u9fff])([，。！？；：、）》」』】”’])/g,
    '$1\uFEFF$2',
  );
}

function getPhysicalPrintedAnnouncementEntries_(bulletin, location) {
  if (bulletin && bulletin.hasPrintedAnnouncements) {
    return (bulletin.printedAnnouncements || [])
      .filter(function (entry) {
        return entry.scope === 'all' || entry.scope === location;
      })
      .filter(function (entry) {
        return Boolean(entry.english || entry.chinese);
      });
  }

  var locationData = bulletin && bulletin[location];
  return [
    bulletin && bulletin.announcements,
    locationData && locationData.announcements,
  ]
    .filter(function (value) {
      return hasPrintValue_(value);
    })
    .map(function (value) {
      return { english: String(value), chinese: '' };
    });
}

function getPhysicalPrintedAnnouncementText_(bulletin, location) {
  return getPhysicalPrintedAnnouncementEntries_(bulletin, location)
    .map(function (entry) {
      return printedBilingualText_(entry.english, entry.chinese);
    })
    .filter(Boolean)
    .join('\n\n');
}

function getFirstPrintedAnnouncementSentenceLength_(text) {
  var value = String(text || '');
  if (!value) {
    return 0;
  }
  var match = value.match(/^[\s\S]*?[.!?。！？](?:["'’”」』）)]*)/);
  return match ? match[0].length : value.length;
}

function appendGivingText_(cell, options) {
  options = options || {};
  appendGivingHeadingText_(
    cell,
    'Tithes & Offerings | 什一奉獻與自由奉獻',
    PRINTED_BULLETIN_TYPE.subheadingSize,
    true,
    options.reuseLeadingParagraph,
  );
  appendHalfSpacer_(cell);
  appendCompactCenteredText_(
    cell,
    printedBilingualText_(
      'Cash offerings: for a tax-deductible receipt, write your English name on the church envelope as Last, First or First Last. Please print clearly (no cursive or calligraphy) so the treasurer can read it.',
      '現金奉獻：如需可扣稅收據，請在教會奉獻信封上以英文或拼音清楚寫上「姓，名」或「名姓」。為方便司庫辨認，請用正楷，不要使用草書或行書。',
    ),
    PRINTED_BULLETIN_TYPE.bodySize,
    false,
    0.9,
  );
  // Stock and donor-advised fund gifts are left to the app's Give page, which
  // has the EIN and the steps in every language. An English-only line for them
  // here pushed the bulletin onto a second page at the 10-point minimum.
}

function appendGivingQrPlaceholders_(cell, options) {
  options = options || {};
  var compact = Boolean(options.compact);
  var location = options.location || 'queens';
  var imageMaxWidth = compact ? 50 : 58;
  var cellPadding = compact ? 0 : 3;
  var reuseLeadingParagraph = Boolean(options.reuseLeadingParagraph);
  // The outer footer cell starts with an empty paragraph after clear(). Keep a
  // reference and remove it only after inserting the QR table; removing it
  // first can cause Docs to recreate a new blank paragraph before the table.
  var leadingParagraph = reuseLeadingParagraph
    ? getLeadingEmptyParagraph_(cell)
    : null;
  var table = cell.appendTable([['', '', '']]);
  table.setBorderWidth(0);
  if (leadingParagraph) {
    leadingParagraph.removeFromParent();
  }
  getGivingQrItems_(location).forEach(function (item, index) {
    var width = 120;
    table.setColumnWidth(index, width);
    var tableCell = table.getCell(0, index);
    tableCell.clear();
    tableCell.setPaddingTop(cellPadding);
    tableCell.setPaddingBottom(cellPadding);
    tableCell.setPaddingLeft(0);
    tableCell.setPaddingRight(0);
    tableCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
    // Put each code in the paragraph clear() leaves, so no blank 11-point
    // line sits above it.
    appendGivingQrPlaceholderCell_(tableCell, item, {
      imageMaxWidth: imageMaxWidth,
      location: location,
      reuseLeadingParagraph: true,
    });
  });
}

function appendGivingQrPlaceholderCells_(cells, options) {
  options = options || {};
  var compact = Boolean(options.compact);
  var imageMaxWidth = compact ? 50 : 58;
  var cellPadding = compact ? 0 : 3;
  getGivingQrItems_(options.location || 'queens').forEach(function (item, index) {
    var tableCell = cells[index];
    if (!tableCell) {
      return;
    }
    tableCell.clear();
    tableCell.setPaddingTop(cellPadding);
    tableCell.setPaddingBottom(cellPadding);
    tableCell.setPaddingLeft(0);
    tableCell.setPaddingRight(0);
    tableCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
    appendGivingQrPlaceholderCell_(tableCell, item, {
      imageMaxWidth: imageMaxWidth,
      location: options.location || 'queens',
      reuseLeadingParagraph: Boolean(options.reuseLeadingParagraph),
    });
  });
}

function appendGivingQrPlaceholderCell_(tableCell, item, options) {
  options = options || {};
  if (item && item.reserved) {
    // Keep the reserved slot's dimensions stable while its QR asset is WIP.
    tableCell.clear();
    return;
  }
  var fileId = getPrintedBulletinQrImageFileId_(item.kind, options.location || 'queens');
  if (!fileId) {
    // Only the mobile-app slot has no placeholder image. Without its real code,
    // print nothing rather than a caption with no code above it.
    Logger.log(item.label + ' QR image was not found; leaving its slot blank.');
    tableCell.clear();
    return;
  }
  try {
    var imageParagraph = options.reuseLeadingParagraph
      ? getLeadingEmptyParagraph_(tableCell)
      : null;
    var image = imageParagraph
      ? imageParagraph.appendInlineImage(DriveApp.getFileById(fileId).getBlob())
      : tableCell.appendImage(DriveApp.getFileById(fileId).getBlob());
    var imageWidth = image.getWidth();
    var imageHeight = image.getHeight();
    if (imageWidth > options.imageMaxWidth) {
      image.setWidth(options.imageMaxWidth);
      image.setHeight(Math.round((imageHeight * options.imageMaxWidth) / imageWidth));
    }
    centerPrintedBulletinImage_(image);
  } catch (error) {
    Logger.log(item.label + ' QR image could not be loaded: ' + error);
  }
  appendCompactCenteredText_(tableCell, item.label, PRINTED_BULLETIN_TYPE.bodySize, true);
}

function getGivingQrItems_(location) {
  var items = [
    { label: getPrintedMobileAppQrLabel_(), kind: 'mobileApp' },
    {
      label: printedBilingualText_('ACH or card', 'ACH／信用卡'),
      kind: 'adventistGiving',
    },
    {
      label: printedBilingualText_('Zelle® (zelle@nyccsda.org)', 'Zelle® 轉賬'),
      kind: 'zelle',
    },
  ];
  // A reserved slot prints nothing but keeps its space, so the three-slot
  // giving layout doesn't shift. The mobile app code points at the store
  // download page, so deploy this script only once both apps are public (#323).
  if (String(location || '').trim().toLowerCase() === 'brooklyn') {
    // Zelle does not exist for Brooklyn.
    return [items[0], items[1], { kind: 'unused', reserved: true }];
  }
  // Queens keeps the Zelle slot reserved until the treasury confirms the
  // address (#384). Leave its definition above intact so restoring it later
  // only requires removing its reserved flag.
  return [items[0], items[1], { kind: 'zelle', reserved: true }];
}

function getPrintedMobileAppQrLabel_() {
  return printedBilingualText_('Download Mobile App', '下載 APP');
}

function appendGivingHeadingText_(cell, text, size, bold, reuseLeadingParagraph) {
  if (!reuseLeadingParagraph) {
    appendCompactCenteredText_(cell, text, size, bold);
    return;
  }

  var paragraph = getLeadingEmptyParagraph_(cell);
  if (!paragraph) {
    appendCompactCenteredText_(cell, text, size, bold);
    return;
  }
  paragraph.setText(String(text || ''));
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  paragraph.setLineSpacing(1);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  styleText_(paragraph.editAsText(), size, bold);
}

function getLeadingEmptyParagraph_(cell) {
  if (!cell || !cell.getNumChildren()) {
    return null;
  }
  var first = cell.getChild(0);
  if (first.getType() !== DocumentApp.ElementType.PARAGRAPH) {
    return null;
  }
  var paragraph = first.asParagraph();
  return paragraph.getText() === '' ? paragraph : null;
}

function getPrintedBulletinQrImageFileId_(kind, location) {
  var fileName = getPrintedBulletinQrImageFileName_(kind, location);
  var foundFileId = fileName ? findPrintedBulletinQrImageInFolder_(fileName) : '';
  if (foundFileId) {
    return foundFileId;
  }

  var propertyName =
    kind === 'adventistGiving'
      ? PRINTED_BULLETIN_CONFIG.adventistGivingQrImageProperty
      : kind === 'mobileApp'
        ? PRINTED_BULLETIN_CONFIG.mobileAppQrImageProperty
        : kind === 'zelle'
          ? PRINTED_BULLETIN_CONFIG.zelleQrImageProperty
          : '';
  var configuredFileId = propertyName
    ? PropertiesService.getScriptProperties().getProperty(propertyName) || ''
    : '';
  // A stand-in code under "Download Mobile App" would lead nowhere, so the
  // mobile-app slot gets no placeholder and stays blank without its file.
  if (kind === 'mobileApp') {
    return configuredFileId;
  }
  return configuredFileId || PRINTED_BULLETIN_CONFIG.qrPlaceholderImageFileId;
}

function getPrintedBulletinQrImageFolderId_() {
  var configuredFolderId =
    typeof PropertiesService !== 'undefined'
      ? PropertiesService.getScriptProperties().getProperty(
          PRINTED_BULLETIN_CONFIG.qrImageFolderProperty,
        )
      : '';
  return configuredFolderId || PRINTED_BULLETIN_CONFIG.qrImageFolderId;
}

/**
 * Finds a QR image by name in the QR code folder, or returns ''.
 *
 * The folder is in a shared drive where most people who make bulletins are
 * viewers, and DriveApp's name search doesn't reach shared-drive files for
 * them. So this asks the Drive API (the Drive advanced service, enabled in
 * appsscript.json) to search that one folder, and falls back to DriveApp's
 * folder search, which works at least for the drive's managers.
 */
function findPrintedBulletinQrImageInFolder_(fileName) {
  var folderId = getPrintedBulletinQrImageFolderId_();
  if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.list) {
    try {
      var response = Drive.Files.list({
        q:
          "'" + escapeDriveQueryValue_(folderId) + "' in parents and name = '" +
          escapeDriveQueryValue_(fileName) + "' and trashed = false",
        corpora: 'allDrives',
        includeItemsFromAllDrives: true,
        supportsAllDrives: true,
        pageSize: 1,
        fields: 'files(id)',
      });
      var found = (response && response.files) || [];
      if (found.length && found[0].id) {
        return found[0].id;
      }
    } catch (error) {
      Logger.log('Drive API QR image lookup failed for ' + fileName + ': ' + error);
    }
  }
  if (typeof DriveApp !== 'undefined' && DriveApp.getFolderById) {
    try {
      var files = DriveApp.getFolderById(folderId).getFilesByName(fileName);
      while (files.hasNext()) {
        var file = files.next();
        // getFilesByName also returns trashed files, so skip them, or a
        // replaced code in the trash could still print.
        if (!file.isTrashed()) {
          return file.getId();
        }
      }
    } catch (error) {
      Logger.log('QR image lookup failed for ' + fileName + ': ' + error);
    }
  }
  return '';
}

function escapeDriveQueryValue_(value) {
  return String(value || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function getPrintedBulletinQrImageFileName_(kind, location) {
  var normalizedLocation = location === 'brooklyn' ? 'brooklyn' : 'queens';
  if (kind === 'mobileApp') {
    return 'mobile_app_qr_code_368x368.jpg';
  }
  if (kind === 'adventistGiving') {
    return normalizedLocation + '_adventist_giving_qr_code_368x368.jpg';
  }
  if (kind === 'zelle') {
    return normalizedLocation + '_zelle_qr_code_368x368.jpg';
  }
  return '';
}

// The roster's Chinese role labels follow the pastor's: four characters, with
// this dot between two-character pairs (崇拜･主席), so each fits on one line.
// U+FF65 is UoqMunThenKhung's half-width middle dot, centred on the
// characters. U+00B7 is narrower but sits low, U+30FB is a full character
// wide, and the font has no U+2027.
var PRINTED_ROLE_DOT = '･';

function appendHorizontalScheduleTable_(cell, current, next, entries, currentData, nextData) {
  current = withPhysicalRosterNames_(current);
  next = withPhysicalRosterNames_(next);
  var rows = [['', 'Meetings Schedule', '節目輪值', 'Today', '今日', 'Next Sab', '下週']];
  entries.forEach(function (entry, index) {
    var role = splitPrintedBilingualValue_(entry[0]);
    var today = splitPrintedBilingualValue_(
      formatPrintedScheduleValue_(entry[1](current, currentData)),
    );
    var nextValue = next
      ? formatPrintedScheduleValue_(entry[1](next, nextData))
      : physicalTbdText_();
    var nextSabbath = splitPrintedBilingualValue_(nextValue);
    rows.push([
      String(index + 1),
      role.english,
      role.chinese,
      today.english,
      today.chinese,
      nextSabbath.english,
      nextSabbath.chinese,
    ]);
  });
  appendDataTable_(cell, rows, {
    borderWidth: 0.75,
    borderColor: '#000000',
    // Sized for 10-point text with 1-point side padding, so each column holds
    // 2 points less than its width. In Times New Roman, "Flower Offering" is
    // 65.3 points and "Sacrifice-Global" 66.1. The widest Chinese role label
    // (崇拜･主席) is 45 points and 尚未安排 is 40. At 359 points the grid is
    // still narrower than the 360-point announcements table above it.
    columnWidths: [14, 69, 48, 70, 44, 70, 44],
    alignments: [
      DocumentApp.HorizontalAlignment.LEFT,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
    ],
    paddingTop: 0,
    paddingBottom: 0,
    paddingLeft: 1,
    paddingRight: 1,
  });
}

// Swaps in the untitled names preparePrintedBulletinForPrint_ kept for the
// roster grid; other fields, such as sunset times, stay as they are.
function withPhysicalRosterNames_(location) {
  return location && location.rosterNames
    ? Object.assign({}, location, location.rosterNames)
    : location;
}

function formatPrintedScheduleValue_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return text ? text : physicalTbdText_();
}

function splitPrintedBilingualValue_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  if (!text) {
    return { english: '', chinese: '' };
  }
  var lines = text.split(/\r?\n/);
  if (lines.length > 1) {
    return { english: lines.slice(1).join(' '), chinese: lines[0] };
  }
  return /[\u3400-\u9fff]/.test(text)
    ? { english: '', chinese: text }
    : { english: text, chinese: '' };
}

function appendPanelHeading_(cell, title, subtitle) {
  // Single line spacing keeps the Chinese title close above the English one
  // (#603).
  appendCompactCenteredText_(cell, title, PRINTED_BULLETIN_TYPE.headingSize, true, 1);
  if (subtitle) {
    appendCenteredText_(cell, subtitle, PRINTED_BULLETIN_TYPE.bodySize, false);
  }
  appendSpacer_(cell);
}

function appendSilentPrayerHeading_(cell, english, traditionalChinese) {
  appendSpacer_(cell);
  appendCompactItalicCenteredText_(
    cell,
    '† ' + english + ' | ' + traditionalChinese + ' †',
  );
}

function appendCenteredText_(cell, text, size, bold) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (line) {
      var paragraph = cell.appendParagraph(line);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      paragraph.setLineSpacing(PRINTED_BULLETIN_TYPE.lineSpacing);
      paragraph.setSpacingBefore(0);
      paragraph.setSpacingAfter(0);
      styleText_(paragraph.editAsText(), size, bold);
    });
}

function appendCompactCenteredText_(cell, text, size, bold, lineSpacing) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (line) {
      var paragraph = cell.appendParagraph(line);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      paragraph.setLineSpacing(lineSpacing || 1);
      paragraph.setSpacingBefore(0);
      paragraph.setSpacingAfter(0);
      styleText_(paragraph.editAsText(), size, bold);
    });
}

function appendCompactItalicCenteredText_(cell, text) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (line) {
      var paragraph = cell.appendParagraph(line);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      paragraph.setLineSpacing(1);
      paragraph.setSpacingBefore(0);
      paragraph.setSpacingAfter(0);
      var rendered = paragraph.editAsText();
      styleText_(rendered, PRINTED_BULLETIN_TYPE.bodySize, false);
      rendered.setItalic(true);
    });
}

function appendBodyText_(cell, text) {
  var paragraph = cell.appendParagraph(String(text || ''));
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  paragraph.setLineSpacing(PRINTED_BULLETIN_TYPE.lineSpacing);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  styleText_(paragraph.editAsText(), PRINTED_BULLETIN_TYPE.bodySize, false);
}

function appendSpacer_(cell) {
  var paragraph = cell.appendParagraph(' ');
  paragraph.setLineSpacing(PRINTED_BULLETIN_TYPE.lineSpacing);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  styleText_(paragraph.editAsText(), 3, false);
}

function appendHalfSpacer_(cell) {
  var paragraph = cell.appendParagraph(' ');
  paragraph.setLineSpacing(1);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  styleText_(paragraph.editAsText(), 1.5, false);
}

// A layout can widen a column (options.columnWidths), add room under each row
// (options.rowPaddingBottom), and add room between numbered hymns
// (options.numberedListGap), as Queens does (PRINTED_QUEENS_LAYOUT).
function appendProgramTable_(cell, rows, options) {
  options = options || {};
  var columnWidths = options.columnWidths || [105, 160, 95];
  var rowPaddingBottom =
    typeof options.rowPaddingBottom === 'number' ? options.rowPaddingBottom : 0.5;
  // A numbered list's lines each become a paragraph, so each can be indented.
  var lists = {};
  var table = cell.appendTable(
    rows.map(function (row, rowIndex) {
      return row.map(function (value, columnIndex) {
        var text = String(value === null || typeof value === 'undefined' ? '' : value);
        if (columnIndex === 1 && isPrintedNumberedList_(text)) {
          lists[rowIndex] = text.split('\n');
          return lists[rowIndex][0];
        }
        return text;
      });
    }),
  );
  table.setBorderWidth(0);
  columnWidths.forEach(function (width, columnIndex) {
    table.setColumnWidth(columnIndex, width);
  });
  rows.forEach(function (row, rowIndex) {
    var tableRow = table.getRow(rowIndex);
    for (var columnIndex = 0; columnIndex < 3; columnIndex += 1) {
      var tableCell = tableRow.getCell(columnIndex);
      var list = columnIndex === 1 ? lists[rowIndex] : null;
      if (list) {
        list.slice(1).forEach(function (line) {
          tableCell.appendParagraph(line);
        });
      }
      tableCell.setPaddingTop(0);
      tableCell.setPaddingBottom(rowPaddingBottom);
      setPrintedProgramCellSidePadding_(tableCell);
      styleTableCell_(
        tableCell,
        PRINTED_BULLETIN_TYPE.bodySize,
        false,
        columnIndex === 0
          ? DocumentApp.HorizontalAlignment.LEFT
          : columnIndex === 1
            ? DocumentApp.HorizontalAlignment.CENTER
            : DocumentApp.HorizontalAlignment.RIGHT,
      );
      if (list) {
        alignPrintedNumberedList_(tableCell, columnWidths[1], options.numberedListGap);
      }
    }
  });
}

// Two or more Sabbath School hymns, as formatSabbathSchoolHymnsForPrint_
// numbers them: "1. …", maybe its translation on the next line, "2. …".
function isPrintedNumberedList_(text) {
  return /^1\. /.test(text) && /\n2\. /.test(text);
}

// The numbers in one column, and each hymn's lines, its translation too, at
// one indent after them: a hanging indent of "1. ", which in Times New Roman
// is a digit (half an em), a period and a space (a quarter each), one em in
// all. Centred lines put each number somewhere else. The block is moved in by
// half the room its widest line leaves, so it still sits in the middle.
// `gap` is extra space, in points, above each number after the first: between
// the hymns, not between a hymn and its translation.
function alignPrintedNumberedList_(tableCell, width, gap) {
  var size = PRINTED_BULLETIN_TYPE.bodySize;
  var marker = size;
  var paragraphs = [];
  for (var childIndex = 0; childIndex < tableCell.getNumChildren(); childIndex += 1) {
    var child = tableCell.getChild(childIndex);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      paragraphs.push(child.asParagraph());
    }
  }
  var numbered = paragraphs.map(function (paragraph) {
    return /^\d+\. /.test(paragraph.getText());
  });
  var widest = 0;
  paragraphs.forEach(function (paragraph, index) {
    var lineWidth = estimatePrintedTextWidth_(paragraph.getText(), size) + (numbered[index] ? 0 : marker);
    widest = Math.max(widest, lineWidth);
  });
  // The cell's side padding is 2 points each side.
  var start = Math.max(0, Math.floor((width - 4 - widest) / 2));
  paragraphs.forEach(function (paragraph, index) {
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    // Docs measures both from the cell's edge: the first line at the number,
    // the rest, and a wrapped title, after it.
    paragraph.setIndentFirstLine(numbered[index] ? start : start + marker);
    paragraph.setIndentStart(start + marker);
    if (gap && numbered[index] && index > 0) {
      paragraph.setSpacingBefore(gap);
    }
  });
}

// A line's width in points, near enough to centre a block: Chinese is one em,
// and the rest is Times New Roman's typical widths.
function estimatePrintedTextWidth_(text, size) {
  var ems = 0;
  Array.from(String(text || '')).forEach(function (character) {
    if (/[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(character) || character.length > 1) {
      ems += 1;
    } else if (/[A-Z]/.test(character)) {
      ems += 0.67;
    } else if (/[a-z]/.test(character)) {
      ems += 0.45;
    } else if (/[0-9]/.test(character)) {
      ems += 0.5;
    } else if (/[ .,:;'’!|]/.test(character)) {
      ems += 0.25;
    } else {
      ems += 0.4;
    }
  });
  return ems * size;
}

// The sermon row, in a thin box so it stands out at a glance. A Docs border
// belongs to a whole table and would also rule between the cells, so the row
// sits in a one-cell table that draws only the outer box. `columnWidths` are
// the program table's around it, if a layout changes them.
function appendSermonRow_(cell, row, columnWidths) {
  columnWidths = columnWidths || [105, 160, 95];
  var box = cell.appendTable([['']]);
  box.setBorderWidth(0.5);
  box.setBorderColor('#000000');
  box.setColumnWidth(0, 360);
  var boxCell = box.getCell(0, 0);
  boxCell.setPaddingTop(1);
  boxCell.setPaddingBottom(1);
  boxCell.setPaddingLeft(0);
  boxCell.setPaddingRight(0);
  var table = boxCell.appendTable([
    row.map(function (value) {
      return String(value === null || typeof value === 'undefined' ? '' : value);
    }),
  ]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, columnWidths[0]);
  // A point narrower than the rows above, for the box's border.
  table.setColumnWidth(1, columnWidths[1] - 1);
  table.setColumnWidth(2, columnWidths[2]);
  // A cell can't end with a table, and the paragraph Docs would add after it
  // is full height. Add it here, and shrink it and the cell's first paragraph
  // to one-point slivers.
  boxCell.appendParagraph(' ');
  for (var childIndex = 0; childIndex < boxCell.getNumChildren(); childIndex += 1) {
    var child = boxCell.getChild(childIndex);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      var sliver = child.asParagraph();
      sliver.setText(' ');
      sliver.setLineSpacing(1);
      sliver.setSpacingBefore(0);
      sliver.setSpacingAfter(0);
      styleText_(sliver.editAsText(), 1, false);
    }
  }
  for (var columnIndex = 0; columnIndex < 3; columnIndex += 1) {
    var tableCell = table.getCell(0, columnIndex);
    tableCell.setPaddingTop(0);
    tableCell.setPaddingBottom(0.5);
    setPrintedProgramCellSidePadding_(tableCell);
    styleTableCell_(
      tableCell,
      PRINTED_BULLETIN_TYPE.bodySize,
      false,
      columnIndex === 0
        ? DocumentApp.HorizontalAlignment.LEFT
        : columnIndex === 1
          ? DocumentApp.HorizontalAlignment.CENTER
          : DocumentApp.HorizontalAlignment.RIGHT,
    );
  }
}

// Docs pads each side of a cell by 5 points. Two leaves the 10-point titles
// and names more room before they wrap (#603).
function setPrintedProgramCellSidePadding_(tableCell) {
  tableCell.setPaddingLeft(2);
  tableCell.setPaddingRight(2);
}

function appendDataTable_(cell, rows, options) {
  options = options || {};
  var paddingTop =
    typeof options.paddingTop === 'number' ? options.paddingTop : 0.5;
  var paddingBottom =
    typeof options.paddingBottom === 'number' ? options.paddingBottom : 0.5;
  var table = cell.appendTable(
    rows.map(function (row) {
      return row.map(function (value) {
        return String(value === null || typeof value === 'undefined' ? '' : value);
      });
    }),
  );
  table.setBorderWidth(
    typeof options.borderWidth === 'number' ? options.borderWidth : 0,
  );
  if (options.borderColor) {
    table.setBorderColor(options.borderColor);
  }
  if (options.columnWidths) {
    options.columnWidths.forEach(function (width, index) {
      table.setColumnWidth(index, width);
    });
  }
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    var row = table.getRow(rowIndex);
    for (var columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      var tableCell = row.getCell(columnIndex);
      tableCell.setPaddingTop(paddingTop);
      tableCell.setPaddingBottom(paddingBottom);
      if (typeof options.paddingLeft === 'number') {
        tableCell.setPaddingLeft(options.paddingLeft);
      }
      if (typeof options.paddingRight === 'number') {
        tableCell.setPaddingRight(options.paddingRight);
      }
      styleTableCell_(
        tableCell,
        PRINTED_BULLETIN_TYPE.bodySize,
        rowIndex === 0,
        options.alignments && options.alignments[columnIndex]
          ? options.alignments[columnIndex]
          : DocumentApp.HorizontalAlignment.LEFT,
      );
    }
  }
}

function styleTableCell_(tableCell, size, bold, alignment) {
  for (var childIndex = 0; childIndex < tableCell.getNumChildren(); childIndex += 1) {
    var child = tableCell.getChild(childIndex);
    if (child.getType() !== DocumentApp.ElementType.PARAGRAPH) {
      continue;
    }
    var paragraph = child.asParagraph();
    paragraph.setAlignment(alignment);
    paragraph.setLineSpacing(PRINTED_BULLETIN_TYPE.lineSpacing);
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    styleText_(paragraph.editAsText(), size, bold);
  }
}

function styleText_(text, size, bold) {
  var value = text.getText();
  text.setFontSize(size);
  text.setBold(Boolean(bold));
  // Regular bulletin text must not inherit italics from a preceding prayer,
  // disclaimer, or other intentionally italicized paragraph. Dedicated
  // italic helpers opt back in after this shared reset.
  text.setItalic(false);
  setPrintedFontFamilies_(text, value);
  if (bold) {
    setPrintedCjkBold_(text, value, false);
  }
}

// Chinese characters, Chinese punctuation and full-width forms, and the
// surrogate pairs of rarer characters (some names use them).
function isPrintedCjkCharacter_(character) {
  return /[\u2e80-\u2fdf\u3000-\u303f\u3400-\u9fff\uf900-\ufaff\ufe30-\ufe4f\ufeff\uff00-\uffef\ud800-\udfff]/.test(
    character,
  );
}

// Calls back with the first and last index of each run of Chinese characters.
function forEachPrintedCjkRun_(value, callback) {
  var cjkStart = -1;
  for (var index = 0; index <= value.length; index += 1) {
    if (index < value.length && isPrintedCjkCharacter_(value.charAt(index))) {
      if (cjkStart < 0) {
        cjkStart = index;
      }
      continue;
    }
    if (cjkStart >= 0) {
      callback(cjkStart, index - 1);
      cjkStart = -1;
    }
  }
}

// The fonts for the Doc being made, read by renderPrintedBulletinDocument_.
var printedBulletinFonts_ = null;

// The Script Properties' fonts, or the defaults when a property is unset or
// blank. A name Docs doesn't offer prints in Docs' fallback font, so clearing
// the property is the way back.
function readPrintedBulletinFonts_() {
  var properties =
    typeof PropertiesService !== 'undefined' ? PropertiesService.getScriptProperties() : null;
  var read = function (propertyName, fallback) {
    var value = properties ? String(properties.getProperty(propertyName) || '').trim() : '';
    return value || fallback;
  };
  return {
    latin: read(PRINTED_BULLETIN_TYPE.latinFontProperty, PRINTED_BULLETIN_TYPE.latinFont),
    chinese: read(PRINTED_BULLETIN_TYPE.chineseFontProperty, PRINTED_BULLETIN_TYPE.chineseFont),
    chineseFallback: read(
      PRINTED_BULLETIN_TYPE.chineseFallbackFontProperty,
      PRINTED_BULLETIN_TYPE.chineseFallbackFont,
    ),
  };
}

// The fonts Printed Bulletin → Fonts… offers (#624). Each is in Docs' Font →
// More fonts list, so Docs can print it: a name Docs doesn't know would print
// in its fallback font without saying why. The Chinese ones have the
// Traditional characters the bulletin uses; Docs' others in that list add
// bopomofo or are display faces.
var PRINTED_BULLETIN_FONT_CHOICES = Object.freeze({
  chinese: [
    { font: 'Noto Sans TC', label: 'Noto Sans TC 思源黑体 (sans / 黑体)' },
    { font: 'Chocolate Classical Sans', label: 'Chocolate Classical Sans 朱古力黑体 (classic sans / 古典黑体)' },
    { font: 'Iansui', label: 'Iansui 芫荽 (brush / 楷体风格)' },
  ],
  latin: [
    { font: 'Georgia', label: 'Georgia' },
    { font: 'EB Garamond', label: 'EB Garamond' },
  ],
});

// What the dialog shows: each slot's choices, the default first, and the
// font now set. A font set by hand that isn't a choice is added, so saving
// the dialog keeps it.
function getPrintedBulletinFontSettings_() {
  var properties = PropertiesService.getScriptProperties();
  var slot = function (key, propertyName, defaultFont, defaultLabel) {
    var current = String(properties.getProperty(propertyName) || '').trim();
    var choices = [{ font: '', label: defaultLabel }].concat(PRINTED_BULLETIN_FONT_CHOICES[key]);
    var known = choices.some(function (choice) {
      return choice.font === current;
    });
    if (current && !known) {
      choices.push({ font: current, label: current + ' (set by hand / 手动设置)' });
    }
    return { current: current === defaultFont ? '' : current, choices: choices };
  };
  return {
    chinese: slot(
      'chinese',
      PRINTED_BULLETIN_TYPE.chineseFontProperty,
      PRINTED_BULLETIN_TYPE.chineseFont,
      'Default: UoqMunThenKhung 宇文天穹 (Ming / 明体)',
    ),
    latin: slot(
      'latin',
      PRINTED_BULLETIN_TYPE.latinFontProperty,
      PRINTED_BULLETIN_TYPE.latinFont,
      'Default: Times New Roman',
    ),
  };
}

function openPrintedBulletinFontsDialog() {
  var output = HtmlService.createHtmlOutput(
    buildPrintedBulletinFontsHtml_(getPrintedBulletinFontSettings_()),
  )
    .setWidth(520)
    .setHeight(430);
  SpreadsheetApp.getUi().showModalDialog(output, 'Printed bulletin fonts / 纸质周刊字体');
  return null;
}

/**
 * Dialog action: saves the Chinese and English fonts. Any operator can, as
 * each week's Doc is checked before it's printed. A blank font is the default
 * and deletes its property. Only a listed font, or the one already set, is
 * accepted.
 */
function savePrintedBulletinFonts(request) {
  var settings = getPrintedBulletinFontSettings_();
  var changes = [
    ['chinese', PRINTED_BULLETIN_TYPE.chineseFontProperty],
    ['latin', PRINTED_BULLETIN_TYPE.latinFontProperty],
  ].map(function (entry) {
    var font = String((request && request[entry[0]]) || '').trim();
    var allowed = settings[entry[0]].choices.some(function (choice) {
      return choice.font === font;
    });
    if (!allowed) {
      throw new Error('Choose a font from the list. / 请从列表中选择字体。');
    }
    return { propertyName: entry[1], font: font };
  });
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var properties = PropertiesService.getScriptProperties();
    changes.forEach(function (change) {
      if (change.font) {
        properties.setProperty(change.propertyName, change.font);
      } else {
        properties.deleteProperty(change.propertyName);
      }
    });
  } finally {
    lock.releaseLock();
  }
  return getPrintedBulletinFontSettings_();
}

function buildPrintedBulletinFontsHtml_(settings) {
  var select = function (id, slot) {
    return (
      '<select id="' + id + '">' +
      slot.choices
        .map(function (choice) {
          return (
            '<option value="' + escapePrintedBulletinHtml_(choice.font) + '"' +
            (choice.font === slot.current ? ' selected' : '') + '>' +
            escapePrintedBulletinHtml_(choice.label) + '</option>'
          );
        })
        .join('') +
      '</select>'
    );
  };
  return (
    '<!doctype html><html><head><base target="_top"><style>' +
    'body{color:#202124;font:14px Arial,sans-serif;margin:0;padding:4px 2px 12px;}' +
    '.intro{color:#5f6368;font-size:13px;line-height:1.5;margin:0 0 14px;}' +
    'label{display:block;font-size:13px;font-weight:600;margin:14px 0 6px;}' +
    'select{background:#fff;border:1px solid #bdc1c6;border-radius:4px;box-sizing:border-box;font:14px Arial,sans-serif;padding:8px 9px;width:100%;}' +
    '.status{font-size:13px;line-height:1.45;margin-top:12px;min-height:1.2em;white-space:pre-line;}' +
    '.status.ok{color:#137333;}.status.error{color:#a50e0e;}' +
    '.actions{display:flex;gap:9px;justify-content:flex-end;margin-top:16px;}' +
    'button{border:0;border-radius:4px;cursor:pointer;font:14px Arial,sans-serif;padding:8px 16px;}' +
    '.cancel{background:#f1f3f4;color:#3c4043;}.save{background:#1a73e8;color:#fff;}' +
    'button:disabled{cursor:default;opacity:.5;}' +
    '</style></head><body>' +
    '<p class="intro">These fonts are for every printed bulletin made from now on, by anyone. A Doc already made keeps its fonts until it\'s made again with Create Word Doc…. A different font can change the line heights, so check that the next Doc still fits its pages.<br>' +
    '这些字体将用于此后任何人创建的所有纸质周刊。已创建的文档保留原字体，直到再次使用“Create Word Doc…”创建。更换字体可能改变行高，请检查下一份文档是否仍在原页数内。</p>' +
    '<p class="intro">Songti TC (宋體-繁) isn\'t here: Google Docs can\'t print it. The .docx from step 3 of Create Word Doc… has it, on a Mac.<br>' +
    '这里没有宋体-繁（Songti TC）：Google 文档无法打印该字体。“Create Word Doc…”第三步的 .docx 在 Mac 上使用该字体。</p>' +
    '<label for="chinese">Chinese font<br>中文字体</label>' + select('chinese', settings.chinese) +
    '<label for="latin">English font<br>英文字体</label>' + select('latin', settings.latin) +
    '<div id="status" class="status" aria-live="polite"></div>' +
    '<div class="actions"><button type="button" class="cancel" onclick="google.script.host.close()">Cancel / 取消</button>' +
    '<button type="button" class="save" id="save">Save / 保存</button></div>' +
    '<script>' +
    'var save=document.getElementById("save");var saveStatus=document.getElementById("status");' +
    'save.onclick=function(){save.disabled=true;saveStatus.className="status";saveStatus.textContent="Saving… / 正在保存…";' +
    'google.script.run.withSuccessHandler(function(){save.disabled=false;saveStatus.className="status ok";' +
    'saveStatus.textContent="Saved. The next Create Word Doc… uses these fonts.\\n已保存。下次“Create Word Doc…”将使用这些字体。";})' +
    '.withFailureHandler(function(error){save.disabled=false;saveStatus.className="status error";saveStatus.textContent=(error&&error.message)||String(error);})' +
    '.savePrintedBulletinFonts({chinese:document.getElementById("chinese").value,latin:document.getElementById("latin").value});};' +
    '</script></body></html>'
  );
}

function getPrintedBulletinFonts_() {
  return (
    printedBulletinFonts_ || {
      latin: PRINTED_BULLETIN_TYPE.latinFont,
      chinese: PRINTED_BULLETIN_TYPE.chineseFont,
      chineseFallback: PRINTED_BULLETIN_TYPE.chineseFallbackFont,
    }
  );
}

// A Doc holds one font per run, so Chinese runs get the Chinese font and
// everything else, digits and Latin punctuation included, the Latin font. Each
// character the default Chinese font lacks then gets the fallback font, alone,
// so one rare character doesn't change the font of a whole verse. Coverage is
// only known for the default font; another font set in the Script Property is
// used for every Chinese character.
function setPrintedFontFamilies_(text, value) {
  var fonts = getPrintedBulletinFonts_();
  var checkCoverage = fonts.chinese === PRINTED_BULLETIN_TYPE.chineseFont;
  text.setFontFamily(fonts.latin);
  forEachPrintedCjkRun_(value, function (start, end) {
    text.setFontFamily(start, end, fonts.chinese);
    if (!checkCoverage) {
      return;
    }
    for (var index = start; index <= end; index += 1) {
      if (!isPrintedCharacterInDefaultChineseFont_(value.charCodeAt(index))) {
        text.setFontFamily(index, index, fonts.chineseFallback);
      }
    }
  });
}

// Whether UoqMunThenKhung has the character with this UTF-16 code: one in
// U+4E00–U+9FFF is looked up in its coverage map, Chinese punctuation and
// full-width forms count as covered, and rarer characters (Extension A,
// compatibility ideographs, both halves of a surrogate pair) as not.
function isPrintedCharacterInDefaultChineseFont_(code) {
  if (code >= 0x4e00 && code <= 0x9fff) {
    var offset = code - 0x4e00;
    var nibble = parseInt(PRINTED_DEFAULT_CHINESE_FONT_COVERAGE_.charAt(offset >> 2), 16);
    return Boolean((nibble >> (3 - (offset & 3))) & 1);
  }
  return !(
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xd800 && code <= 0xdfff)
  );
}

function setPrintedCjkBold_(text, value, bold) {
  forEachPrintedCjkRun_(value, function (start, end) {
    text.setBold(start, end, Boolean(bold));
  });
}

function setPrintedLatinBold_(text, start, end) {
  text.setBold(start, end, true);
  setPrintedCjkBold_(text, text.getText(), false);
}

function physicalTbdText_(traditionalChinese) {
  return printedBilingualText_('TBD', traditionalChinese || '尚未確定');
}

function formatHymnForPrint_(hymn) {
  hymn = hymn || {};
  // A bare number is a Chinese hymnal number, printed as 第N首.
  var chineseInput = String(hymn.chinese || '').trim();
  var resolved = resolvePrintedHymnText_(
    hymn.english,
    /^\d+$/.test(chineseInput) ? '第' + chineseInput + '首' : chineseInput,
  );
  var english = resolved.english;
  var chinese = resolved.chinese;
  if (isPhysicalTbd_(english) || isPhysicalTbd_(chinese)) {
    return physicalTbdText_();
  }
  if (english && chinese && english !== chinese) {
    return printedBilingualText_(english, chinese);
  }
  return printedOneLanguageText_(english || chinese) || physicalTbdText_();
}

function formatBibleReferenceForPrint_(location, bibleTranslations) {
  var reference = String((location && location.bibleVerses) || '').trim();
  if (!reference || isPhysicalTbd_(reference)) {
    return physicalTbdText_();
  }

  // The schedule has one scripture-reference field, but the printed table
  // has separate Chinese and English lines. Resolve the book name for each
  // line instead of copying the English reference into both language slots.
  var labels = formatPhysicalBibleReferenceLabels_(location, bibleTranslations);
  return printedBilingualText_(labels.english, labels.chinese);
}

function formatSermonForPrint_(location) {
  var titleText = formatSermonTitleForPrint_(location);
  var speaker = printValue_(location.sermon);
  return titleText && !isPhysicalTbd_(titleText) ? titleText + ' — ' + speaker : speaker;
}

function formatSermonTitleForPrint_(location) {
  var title = location.sermonTitle || {};
  var englishTitle = String(title.english || '').trim();
  var chineseTitle = String(title.chinese || '').trim();
  if (isPhysicalTbd_(englishTitle) || isPhysicalTbd_(chineseTitle)) {
    return physicalTbdText_();
  }
  return (
    englishTitle && chineseTitle && englishTitle !== chineseTitle
      ? printedBilingualText_(englishTitle, chineseTitle)
      : printedOneLanguageText_(englishTitle || chineseTitle)
  ) || physicalTbdText_();
}

function isPhysicalTbd_(value) {
  return String(value || '')
    .replace(/[\r\n]/g, ' ')
    .toUpperCase()
    .indexOf('TBD') !== -1;
}

function formatDateForPrint_(date) {
  var parts = toIsoDate_(date).split('-');
  var monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return (
    monthNames[Number(parts[1]) - 1] +
    ' ' +
    Number(parts[2]) +
    ', ' +
    parts[0] +
    '\n' +
    parts[0] +
    '年' +
    Number(parts[1]) +
    '月' +
    Number(parts[2]) +
    '日'
  );
}

function printedBilingualText_(english, traditionalChinese) {
  var lines = [];
  if (traditionalChinese) {
    lines.push(String(traditionalChinese));
  }
  if (english) {
    lines.push(String(english));
  }
  return lines.join('\n');
}

// A title in only one language goes on that language's line, beside the
// row's label in it: Chinese on the first line, English on the second. "—"
// holds the other line, as in the offering and name cells.
function printedOneLanguageText_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  if (!text || /\n/.test(text)) {
    return text;
  }
  if (isPhysicalTbd_(text)) {
    return physicalTbdText_();
  }
  return /[\u3400-\u9fff]/.test(text) ? text + '\n—' : '—\n' + text;
}

function printValue_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return !text || isPhysicalTbd_(text) ? physicalTbdText_() : text;
}

function formatPhysicalOfferingValue_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value)
    .trim()
    .replace(/[^\S\r\n]+/g, ' ');
  if (!text || isPhysicalTbd_(text)) {
    return physicalTbdText_();
  }
  if (/\r?\n/.test(text)) {
    return text;
  }
  if (/[\u3400-\u9fff]/.test(text)) {
    return text + '\n—';
  }

  var translated = translatePhysicalOfferingToTraditionalChinese_(text);
  return translated ? translated + '\n' + text : '—\n' + text;
}

function translatePhysicalOfferingToTraditionalChinese_(text) {
  var source = String(text || '').trim();
  if (!source || /[\u3400-\u9fff]/.test(source)) {
    return '';
  }
  var cacheKey = source.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(PRINTED_OFFERING_TRANSLATION_CACHE, cacheKey)) {
    return PRINTED_OFFERING_TRANSLATION_CACHE[cacheKey];
  }

  var translated = '';
  if (typeof LanguageApp !== 'undefined' && LanguageApp.translate) {
    try {
      translated = String(LanguageApp.translate(source, 'en', 'zh-TW') || '').trim();
    } catch (error) {
      Logger.log('Offering translation failed; keeping the English value: ' + error);
    }
  }
  PRINTED_OFFERING_TRANSLATION_CACHE[cacheKey] = translated;
  return translated;
}

function hasPrintValue_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return Boolean(text && text.toLowerCase() !== 'tbd');
}

// UoqMunThenKhung's characters in U+4E00–U+9FFF, one bit each, high bit
// first, as hexadecimal: 7,920 of 20,992. That's every common Traditional
// character and the Simplified forms Japanese shares (国, 会), but not most
// Simplified-only ones (张, 陈). Made from the font's character map (Google
// Fonts, ofl/uoqmunthenkhung); see isPrintedCharacterInDefaultChineseFont_.
var PRINTED_DEFAULT_CHINESE_FONT_COVERAGE_ =
  'd1f6cfc342b4e2d9349737cf20405002a6fa7cdbee9e9220fb370fc75c86b71dd077c4ec00018aec1387dfffb049963b1ab56bb4c01707013877c9b7dc0b56a3865d6aeb7efc0248b3cb8628040dafa4840c4ae8300d3d12256746a215464c50eec0aea1402035b9dffead282dfe47c8a76df744aef8ff0e1e5c021cc36cd6e6dbb26f040de293f0597f0a1e1c63fd0539e47819927d4c5ad54425d7bb00b4f3e6858764d82550f3d7e479aac243fdd1280012a586c6b21070fe0b557efff7b85affe817835e56deb2e248013aa1d79deabbaf282ffd709febd3028267e6202d4b43ca20010fd5c2de29970f5e20071abb7308ef01faf6100f427a2d5ec1234682ce9b9b0143ead1600e91d0acf94ae087239c40a6820b09f0ee59b7d932b06599d5328913cf9192a13fc8404ee1150930d01010b82a9400b3923f09d8040d68b7700444c821cc24c03869e26054e4469460118b02d230f2452a55cb2c5be17c20718ef8ad7f618289c3ddb4b5ee1ac4782532d61c8b30720674f8ec16ba0611504850b994410608c2600420222c01010000213a0100300e605883a05240043000d803146828aa839408dfbd3e58d4a595dd15fd3e029ec1bf48b8976fda96a36ff75222a8ac41ffcebfd4defc8f42400088c80042dc53ba05102040c0e58e3443124ff129400804211ab048004d120029188844a00a01ec004cba1677927d1732184ef5041593849d0a0d1178103eff59210728831407c278e59235f0c8dbbb58fdff9147455d8a46aa53ce7f7cd149fdf8f1cac0ee1d4c140ce3cec832c4950003ae5cc7f144207234a465bcfd85015c7c2b3193e07e9c073054abd380fb70d2c76439d198890f29be14e53593df0a2132cae009da222233fc800112802faf81eefe376223ba97c1d67c929287524bba607f9a0298445d2ffffbfcc00f5f0f61c8424101b12067265f850801d26334b8cba2d1f5fbac129a45a230d0660e6002059b0a07ac0e26f0026889814512f03180b4663c5eb05bed3628a0fb0deb3e86010acc3c390fd304c74fc63208ad8031cac5594d1d814c7e1b2350e7cc4038b36b1c098d874e197c5921672fcb9b2259cec3c4a29268cb4bc0026c8248bdff90d70f1703be4fa542cbd34bfe25f50b4558b52ce2419fd0ca23f8e62d4b5c333c001382607028ccfecef84d11000b0376071995e385d6680af52da1d1836470cc9f207876a08a4520201c7ef0b71dce62224e9893966913513e90c6299430556438795370f286e40b9000c16210308388068908b02b1090700050372cb800b00c61a205d10021e6134a98597f6139d1ba74069208377d3986173bb1001910042481dff15bbb9983e206857fe0e1ba2676cdbaf0601a50ff4c68177cf4b3d400481a215305f276d64c0000681e6b09c025ea1e58002b24898f1966e64afa75f805f01475df5f28ea18260a9911533203a04982ad25316b2d2d5a5c060009298362415c20b179708344004899aa07a8a8eb864900db205e40f2000c91c85bd622475144b71388a002000840861851828c06622c40081f11f000b108c50801494408611968e201c209036a264a2fca208408a12d418088444258c2ad49870e0cdb020c801000aca6ff839822d5e1412846e9002210a109e246ba02a150e04c11dc4020135f2c730b130c03a10090a0adba8b50020186d03114a4e62202946644a61764003026ebbe21c810057bb865d202d150808b33c0800500210a28bb42e3805c0e54ab36ddf1bc0a7f487caf759b81237348643c1074ce35242cd2b040f82bc0541001eb4088b02388228965eae2bebb92927a020289e136a62b1b5d2328da49d800138ec003aa8301003a76b80047091a5003852c925d010411383547100c200c2c05c704a9a11402000408192829434e55a11161942a4630cc2001890924410260400238802ac3c09727a4840121cc2708140322d067c0d064815b488010849609eb8002611fb25f8100f0508a6558803781806382211db5746df73582e52ab140d2868a164006ddea04850acd200b152defc0244880cb590054ce441302810c790351300187900d8a819c0a34067054a5916d967446a42226cfa101aab2af748df8e01bf469be9b86127282f6444041507bb01fedb7013166eed8c928504cf0e01772136d7756b42e664374905d30ebba1800000000000000000000000000000000000002a40d8ecc8181f2a5c037ba082658c322cd462a2c01c252d058de1ce5c842801215022022a36081fb470f5812b4647d68201a0a02764c05d88c27e002301851d042021adc010612d8e1b0a114bc98c094a7b2c550e1b5ac183ae5eeab9b20fa17c0811000e52ab3638200142045161dd1d60400795b571158707e42038810916ec09661a88020001599076232a3a1b04404452a1a898051eb94193e1000a068448c02c20110725f45602810884b400428d9ca74d268000a080982005da1560c0406d0f215e210f4010289a0c9580afb80604045840c0c600172233053202005808100068c3b01104070003814081871c6008b568853084f00d2b3e470a824400911005a154192a20a8130040003201110348b90e0008009235205074e0171004250aa0c31567090a547609423422812cd017c212ccd40813cce2928b42e44302294580c02038a2d290353b113a8436930258000282c13000888b0abf79534245b3a4280ee12b2def0582d4c54a2dfaca24b295d223beb1653aae92b8b74c2981042424b12f90219e904902ab268000000000000000000000000000000000000012142ea8c20603c10e8246e1886e1ffbb9dfda6703afa2c88bc0db5bb1000000000000000000b14db004420044110801822221b42355ab1142900e180076070cc4029f884419a082a286d7458404039e02286bd28113010009e14683c5f066110d32e4e0909780000000000001b1387e1392e0248202ef589e4d617df77f10266ca6577fedef5c72fadf9f1c40032a146805022001668840506204025c20104e84000fe2b8034683d803154a10a383b4ca0c7dfc3ff5f4606090366cc02104809ef8cd6c1722b00419a948056b8018c31584501b5408964b0f92a0184e6f69b363008b40b38840a840a20280ba0290e90401284c38f6c800084110098e0401276a04c807032b820a50f4000000000000000000000000000000000000000000000000000000000000100b1737ac0fdc4605a13bc8e88640000000000000840ab6011a81d809f7e28bfa40eb70ddc91a1ebd8cf7e665a30f1a3508be7524a0920b0d63ac5625aead44a684e1580889294180052d810080006365176a9f1a8481c89dc021f1db20511d8000000000000a152281a0000192177280e1468b8b6c98a04072458e50a00000000000003c2048e58084e80e4d5200660914403324000908502b40625312c7000000000000000858188c8017acb72374910120400a135e360187c0748a000012d001003730180b6485082e16a107980e4048aecbc104c07e07203c02b218100038000000000000000000000000005589a0013c2241112b800134a80c04ec839a02001410020085128b06a011140060520e4000000720000000000000000000004cd6098750506640cfb180fe8de84810b5c01821440c009081200332809f328230000048c0c800000000000000000000000';
