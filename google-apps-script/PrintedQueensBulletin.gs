/**
 * Staff-only printed bulletin generator.
 *
 * This file belongs in the same spreadsheet-bound Apps Script project as
 * BulletinApi.gs. It deliberately has no public web route: the generated document
 * contains full names and must only be created by an authorized Sheets user.
 */

var PRINTED_BULLETIN_CONFIG = Object.freeze({
  churchName: 'New York Chinese Seventh-day Adventist Church',
  churchNameChinese: '基督復臨安息日會紐約華人教會',
  outputFolderProperty: 'PHYSICAL_BULLETIN_FOLDER_ID',
  adminEmailsProperty: 'PHYSICAL_BULLETIN_ADMIN_EMAILS',
  outputFolderId: '11p4-PzJNGLNfWdZBAMNIBlLxmBrgo_zZ',
  churchSketchImageProperty: 'CHURCH_SKETCH_IMAGE_FILE_ID',
  lastSupperImageProperty: 'LAST_SUPPER_IMAGE_FILE_ID',
  sdaLogoImageProperty: 'SDA_LOGO_IMAGE_FILE_ID',
  adventistGivingQrImageProperty: 'ADVENTIST_GIVING_QR_IMAGE_FILE_ID',
  zelleQrImageProperty: 'ZELLE_QR_IMAGE_FILE_ID',
  mobileAppQrImageProperty: 'MOBILE_APP_QR_IMAGE_FILE_ID',
  legacyBrooklynCoverImageProperty: 'BROOKLYN_BULLETIN_COVER_IMAGE_FILE_ID',
  queensIntakeFormUrl: 'https://forms.gle/FV7S53eQ1jwt9R7p7',
  brooklynIntakeFormUrl: 'https://forms.gle/wCsMmMeS8EqMKmJY8',
  printedAnnouncementsPropertyPrefix: 'PRINTED_ANNOUNCEMENTS_',
  printedBibleVersePropertyPrefix: 'PRINTED_BIBLE_VERSE_',
  printedAnnouncementsMaxEntries: 12,
  printedAnnouncementsMaxSerializedBytes: 8000,
  churchSketchImageFileId: '1ZmxAI0l-689nnz5l1pEtmpNTDquA8_No',
  lastSupperImageFileId: '1ZGPxK1cidxies9jAguiAIPVlk9Vqk-Kd',
  sdaLogoImageFileId: '19NBpTBQZyj2oSYY9qSQOvEkoPFd4M3E5',
  qrPlaceholderImageFileId: '12lLYC4iPLUrOA_0Lj_N6CzVM5b8VqNlq',
  documentPropertyPrefix: 'PHYSICAL_BULLETIN_DOC_ID_',
  pdfPropertyPrefix: 'PHYSICAL_BULLETIN_PDF_ID_',
  pageWidth: 792,
  pageHeight: 612,
  pageMargin: 28,
  regularCoverImageMaxWidth: 490,
  communionCoverImageMaxWidth: 340,
  studyTime: '10:00 am–11:25 am  |  上午 10:00–11:25',
  worshipTime: '11:30 am–1:00 pm  |  上午 11:30–下午 1:00',
  bibleApiBaseUrl: 'https://bible.helloao.org/api',
  bibleEnglishTranslation: 'BSB',
  bibleChineseTranslation: 'cmn_cuv',
  bibleCacheSeconds: 21600,
  sunsetApiBaseUrl: 'https://api.sunrise-sunset.org/json',
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
  SpreadsheetApp.getUi()
    .createMenu('Printed Bulletin')
    .addItem('Create Google Doc + PDF…', 'createPrintedBulletinFromPrompt')
    .addToUi();
}

/**
 * Adds the optional verse prompt to both linked response forms once.
 * The response schema already accepts this question; this helper makes the
 * form-side setup available for both locations without exposing a setup menu.
 */
function addBibleVerseQuestions() {
  requirePrintedBulletinAdmin_();

  var title = getPrintedBulletinBibleVerseQuestionTitle_();
  var sheetNames = ['Queens Worship Data', 'Brooklyn Worship Data'];
  var results = [];
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

  sheetNames.forEach(function (sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Could not find the ' + sheetName + ' response sheet');
    }
    var formUrl = sheet.getFormUrl();
    if (!formUrl) {
      throw new Error(sheetName + ' is not linked to a Google Form');
    }

    var form = FormApp.openByUrl(formUrl);
    var exists = form.getItems().some(function (item) {
      return item.getTitle && item.getTitle() === title;
    });
    if (!exists) {
      form
        .addTextItem()
        .setTitle(title)
        .setHelpText(
          'Enter a reference such as John 12:24 or Jeremiah 29:11-15. Use a hyphen (-) for a verse range; Jeremiah:29:11-15 also works.\n請輸入經文，例如 John 12:24 或 Jeremiah 29:11-15。節數範圍請使用連字號（-）；Jeremiah:29:11-15 也可以。',
        );
    }
    results.push(sheetName + (exists ? ': already present' : ': added'));
  });

  SpreadsheetApp.getUi().alert('Bible verse question setup complete:\n' + results.join('\n'));
}

// Keep the old editor entry point working for anyone who used it previously.
function addQueensBibleVerseQuestion() {
  return addBibleVerseQuestions();
}

function getPrintedBulletinBibleVerseQuestionTitle_() {
  return 'What verse should appear at the bottom of Church at Study?';
}

/**
 * Opens a staff-only prompt. Run this from the bound spreadsheet, or use the
 * Printed Bulletin menu after reloading the spreadsheet.
 */
function createPrintedBulletinFromPrompt() {
  var defaultDate = getDefaultPrintedBulletinDate_();
  var output = HtmlService.createHtmlOutput(
    buildPrintedBulletinPromptHtml_(defaultDate),
  )
    .setWidth(650)
    .setHeight(820);
  SpreadsheetApp.getUi().showModalDialog(
    output,
    'Bulletin workflow / 週刊流程',
  );
  return null;
}

function buildPrintedBulletinPromptHtml_(defaultDate) {
  var bookOptions = Object.keys(PRINTED_BIBLE_BOOK_LABELS)
    .map(function (bookId) {
      var labels = PRINTED_BIBLE_BOOK_LABELS[bookId];
      return (
        '<option value="' +
        escapePrintedBulletinHtml_(bookId) +
        '" data-english="' +
        escapePrintedBulletinHtml_(labels.english) +
        '" data-chapters="' +
        (PRINTED_BIBLE_CHAPTER_COUNTS[bookId] || 1) +
        '">' +
        escapePrintedBulletinHtml_(labels.english + ' · ' + labels.chinese) +
        '</option>'
      );
    })
    .join('');
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
    '.section-heading{font-size:19px;margin:0 0 8px;}' +
    '.form-links{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:11px;}' +
    '.form-button{align-items:center;background:#fff;border:1px solid #1a73e8;border-radius:5px;box-sizing:border-box;color:#174ea6;display:flex;font-size:13px;font-weight:600;justify-content:center;line-height:1.3;min-width:0;padding:9px 8px;text-align:center;text-decoration:none;white-space:normal;}' +
    '.choices{display:flex;gap:8px;flex-wrap:wrap;}' +
    '.choice{background:#fff;border:1px solid #bdc1c6;border-radius:18px;' +
    'color:#3c4043;cursor:pointer;font-size:13px;padding:8px 13px;}' +
    '.choice.selected{background:#e8f0fe;border-color:#1a73e8;color:#174ea6;' +
    'box-shadow:inset 0 0 0 1px #1a73e8;}' +
    '.choice:disabled{cursor:not-allowed;opacity:.48;box-shadow:none;}' +
    '.row{display:grid;grid-template-columns:1fr 150px;gap:10px;}' +
    '.announcement-entry{border:1px solid #dadce0;border-radius:8px;margin:10px 0;padding:12px;}' +
    '.announcement-header{align-items:center;display:flex;justify-content:space-between;gap:8px;}' +
    '.announcement-header strong{font-size:13px;}' +
    '.announcement-entry textarea{box-sizing:border-box;width:100%;font:14px Arial,sans-serif;' +
    'border:1px solid #bdc1c6;border-radius:4px;min-height:72px;padding:9px 10px;resize:vertical;}' +
    '.announcement-entry select{margin-top:8px;}' +
    '.announcement-remove{background:#fce8e6;color:#a50e0e;font-size:12px;padding:6px 9px;}' +
    '.announcement-add{background:#e8f0fe;color:#174ea6;font-size:13px;margin-top:4px;}' +
    '.actions{display:flex;justify-content:flex-end;gap:9px;margin-top:20px;}' +
    '.status-slot{box-sizing:border-box;min-height:180px;padding-top:8px;}' +
    '#statusView{min-height:164px;}' +
    'button{font:14px Arial,sans-serif;border:0;border-radius:4px;cursor:pointer;' +
    'padding:9px 17px;}' +
    '.cancel{background:#f1f3f4;color:#3c4043;}' +
    '.submit{background:#1a73e8;color:#fff;}' +
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
    '<div id="formView">' +
    '<h2 class="section-heading">1. Update the digital bulletin / 第一步：更新數位週刊</h2>' +
    '<div class="admin-reminder"><strong>Instructions / 使用說明：</strong> Check the current week in the app or the matching Worship Data sheet. If the speaker has not submitted, complete the appropriate intake form on their behalf before continuing to the printed bulletin. If the Form asks for a passcode, ask the IT staff.' +
    '<br>請先查看本應用程式或相應的 Worship Data 工作表中的本週資料。如果講員尚未提交，請先代為填寫相應的資料表，再繼續建立實體週刊。如果資料表要求密碼，請向 IT 同工詢問。</div>' +
    '<div class="form-links"><a class="form-button" href="' +
    escapePrintedBulletinHtml_(PRINTED_BULLETIN_CONFIG.queensIntakeFormUrl) +
    '">↗ Queens Worship Data form / 皇后區崇拜資料表</a>' +
    '<a class="form-button" href="' +
    escapePrintedBulletinHtml_(PRINTED_BULLETIN_CONFIG.brooklynIntakeFormUrl) +
    '">↗ Brooklyn Worship Data form / 布碌崙崇拜資料表</a></div></div>' +
    '<h2 class="section-heading" style="margin-top:20px;">2. Create the printed bulletin / 第二步：建立實體週刊</h2>' +
    '<form id="bulletinForm">' +
    '<label for="date">Sabbath date <span class="required-mark" aria-hidden="true">*</span><br>安息日日期</label>' +
    '<input id="date" type="date" value="' +
    escapePrintedBulletinHtml_(defaultDate) +
    '" required>' +
    '<div class="help">Defaults to the closest upcoming Saturday.<br>預設為下一個最近的星期六。</div>' +
    '<label>Location<br>地點</label>' +
    '<div class="choices" id="locationChoices">' +
    '<button type="button" class="choice selected" data-value="queens">Queens / 皇后區</button>' +
    '<button type="button" class="choice" data-value="brooklyn">Brooklyn / 布碌崙</button>' +
    '</div>' +
    '<label>Format<br>格式</label>' +
    '<div class="choices" id="formatChoices">' +
    '<button type="button" class="choice selected" data-value="regular">Regular / 普通</button>' +
    '<button type="button" class="choice" data-value="communion">Communion / 聖餐</button>' +
    '</div>' +
    '<div class="help">Brooklyn Communion is not currently available. Choose Regular for Brooklyn.<br>目前尚未提供布碌崙聖餐禮週刊；布碌崙請選擇普通格式。</div>' +
    '<label for="englishTranslation">English Bible translation<br>英文聖經譯本</label>' +
    '<select id="englishTranslation">' +
    englishTranslationOptions +
    '</select>' +
    '<div class="help">Chinese Bible translation: CUV — 和合本（Traditional Chinese）.<br>中文聖經譯本：CUV — 和合本（繁體中文）。</div>' +
    '<label for="book">Bible book <span class="required-mark" aria-hidden="true">*</span><br>聖經書卷</label>' +
    '<select id="book" required><option value="">Choose a book — 選擇書卷</option>' +
    bookOptions +
    '</select>' +
    '<div class="row">' +
    '<div><label for="chapter">Chapter <span class="required-mark" aria-hidden="true">*</span><br>章</label><select id="chapter" disabled required>' +
    '<option value="">Choose a book first — 請先選擇書卷</option></select></div>' +
    '<div><label for="verses">Verse(s) <span class="required-mark" aria-hidden="true">*</span><br>節</label><input id="verses" type="text" placeholder="11 or 11-15" inputmode="text" required></div>' +
    '</div>' +
    '<div class="help">Choose a book and chapter, then type one verse or a range, such as 11 or 11-15. If the speaker submitted a Bible verse in the Worship Data form, it will appear here automatically. Check or edit it before creating.<br>選擇書卷和章，然後輸入一節或一段經文，例如 11 或 11-15。如果講員已在 Worship Data 資料表提交聖經經文，系統會自動填入。建立前請確認或修改。</div>' +
    '<label>Printed announcements / 印刷週刊消息</label>' +
    '<div class="help">Optional. Add one entry per card. These entries are printed only; they are not shown in the mobile bulletin.<br>可選。每張卡片輸入一則消息。這些消息只會印在週刊上，不會顯示在手機版週刊。</div>' +
    '<div id="announcementList"></div>' +
    '<button type="button" class="announcement-add" id="addAnnouncement">+ Add announcement / 新增消息</button>' +
    '<div id="error" class="error" hidden></div>' +
    '<div class="actions"><button type="button" class="cancel" onclick="google.script.host.close()">Cancel / 取消</button>' +
    '<button type="submit" class="submit" id="submit" disabled>Create / 建立</button></div>' +
    '</form></div>' +
    '<div class="status-slot"><div id="statusView" hidden></div></div>' +
    '<script>' +
    'var initialRequest=' +
    requestJson +
    ';' +
    'var locationValue="queens";var formatValue="regular";var announcementsDirty=false;var verseDirty=false;var suppressVerseDirty=false;var promptData={formVerse:""};' +
    'function selectChoice(group,value){' +
    'var buttons=document.querySelectorAll("#"+group+" .choice");' +
    'Array.prototype.forEach.call(buttons,function(button){' +
    'var selected=button.getAttribute("data-value")===value;' +
    'button.classList.toggle("selected",selected);button.setAttribute("aria-pressed",selected?"true":"false");});}' +
    'function updateLocationFormatAvailability(){var brooklynButton=document.querySelector("#locationChoices .choice[data-value=brooklyn]");var communionButton=document.querySelector("#formatChoices .choice[data-value=communion]");var brooklynDisabled=formatValue==="communion";var communionDisabled=locationValue==="brooklyn";brooklynButton.disabled=brooklynDisabled;communionButton.disabled=communionDisabled;brooklynButton.setAttribute("aria-disabled",brooklynDisabled?"true":"false");communionButton.setAttribute("aria-disabled",communionDisabled?"true":"false");}' +
    'function escapeHtml(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/\\x27/g,"&#39;");}' +
    'function updateSubmitState(){var date=document.getElementById("date").value.trim();var book=document.getElementById("book").value;var chapter=document.getElementById("chapter").value;var verses=document.getElementById("verses").value.trim();var unsupported=locationValue==="brooklyn"&&formatValue==="communion";document.getElementById("submit").disabled=Boolean(unsupported||!(date&&book&&chapter&&verses));}' +
    'function showError(message){var error=document.getElementById("error");error.textContent=message;error.hidden=false;updateSubmitState();}' +
    'function announcementMarkup(entry,index){entry=entry||{};var scope=entry.scope||"all";return "<div class=\\"announcement-entry\\"><div class=\\"announcement-header\\"><strong>Announcement "+(index+1)+" / 消息 "+(index+1)+"</strong><button type=\\"button\\" class=\\"announcement-remove\\">Remove / 移除</button></div><select class=\\"announcement-scope\\"><option value=\\"all\\""+(scope==="all"?" selected":"")+">Both locations / 兩地</option><option value=\\"queens\\""+(scope==="queens"?" selected":"")+">Queens / 皇后區</option><option value=\\"brooklyn\\""+(scope==="brooklyn"?" selected":"")+">Brooklyn / 布碌崙</option></select><label>English announcement / 英文消息</label><textarea class=\\"announcement-english\\" placeholder=\\"Optional English announcement\\">"+escapeHtml(entry.english||"")+"</textarea><label>Traditional Chinese announcement / 繁體中文消息</label><textarea class=\\"announcement-chinese\\" placeholder=\\"Optional Traditional Chinese announcement\\">"+escapeHtml(entry.chinese||"")+"</textarea></div>";}' +
    'function refreshAnnouncementLabels(){Array.prototype.forEach.call(document.querySelectorAll(".announcement-entry strong"),function(label,index){label.textContent="Announcement "+(index+1)+" / 消息 "+(index+1);});}' +
    'function addAnnouncementEntry(entry){var list=document.getElementById("announcementList");var index=list.children.length;list.insertAdjacentHTML("beforeend",announcementMarkup(entry,index));refreshAnnouncementLabels();}' +
    'function renderAnnouncements(entries){var list=document.getElementById("announcementList");list.innerHTML="";if(!entries||!entries.length){entries=[{}];}entries.forEach(addAnnouncementEntry);refreshAnnouncementLabels();announcementsDirty=false;updateSubmitState();}' +
    'function updateChapterOptions(selectedChapter){var book=document.getElementById("book");var selected=book.options[book.selectedIndex];var count=Number(selected.getAttribute("data-chapters")||0);var chapter=document.getElementById("chapter");chapter.innerHTML="";if(!count){chapter.disabled=true;chapter.add(new Option("Choose a book first — 請先選擇書卷",""));updateSubmitState();return;}chapter.disabled=false;chapter.add(new Option("Choose chapter — 選擇章",""));for(var i=1;i<=count;i++){chapter.add(new Option(String(i),String(i)));}if(selectedChapter){chapter.value=String(selectedChapter);}updateSubmitState();}' +
    'function setVerseReference(reference){suppressVerseDirty=true;var value=String(reference||"").replace(/[：]/g,":").replace(/^(.+?):(\\d+):/,"$1 $2:").trim();var match=value.match(/^(.+?)\\s+(\\d+):(\\d+)(?:-(\\d+))?$/);var book=document.getElementById("book");var chapter=document.getElementById("chapter");var verses=document.getElementById("verses");book.value="";chapter.innerHTML="<option value=\\"\\">Choose a book first — 請先選擇書卷</option>";chapter.disabled=true;verses.value="";if(match){for(var i=0;i<book.options.length;i++){if(String(book.options[i].getAttribute("data-english")||"").toLowerCase()===match[1].toLowerCase()){book.selectedIndex=i;updateChapterOptions(match[2]);verses.value=match[3]+(match[4]?"-"+match[4]:"");break;}}}suppressVerseDirty=false;updateSubmitState();}' +
    'function renderPromptData(data){promptData=data||{formVerse:""};renderAnnouncements(promptData.announcements||[]);setVerseReference(promptData.verse||"");verseDirty=false;updateSubmitState();}' +
    'function loadPromptData(){document.getElementById("submit").disabled=true;google.script.run.withSuccessHandler(renderPromptData).withFailureHandler(function(){renderPromptData({announcements:[],formVerse:"",verse:""});}).getPrintedBulletinPromptData(document.getElementById("date").value||initialRequest.date,locationValue);}' +
    'function collectAnnouncements(){var entries=[];Array.prototype.forEach.call(document.querySelectorAll(".announcement-entry"),function(card){var english=card.querySelector(".announcement-english").value.trim();var chinese=card.querySelector(".announcement-chinese").value.trim();if(english||chinese){entries.push({scope:card.querySelector(".announcement-scope").value,english:english,chinese:chinese});}});return entries;}' +
    'function showLoading(){document.getElementById("bulletinForm").hidden=true;document.getElementById("statusView").hidden=false;document.getElementById("statusView").innerHTML=' +
    '"<div class=\'loading\'><div class=\'spinner\'></div><h2>Creating printed bulletin…<br>正在建立實體週刊…</h2><p class=\'intro\'>This may take a minute while the Google Doc and PDF are prepared.<br>建立 Google 文件和 PDF 可能需要一點時間。</p></div>";focusStatusView_();}' +
    'function focusStatusView_(){setTimeout(function(){var status=document.getElementById("statusView");if(status&&status.scrollIntoView){status.scrollIntoView({behavior:"smooth",block:"nearest"});}},0);}' +
    'function showGenerationError(error){document.getElementById("statusView").hidden=true;document.getElementById("bulletinForm").hidden=false;showError("Could not create bulletin / 無法建立週刊\\n\\n"+(error&&error.message?error.message:String(error)));setTimeout(function(){var message=document.getElementById("error");if(message&&message.scrollIntoView){message.scrollIntoView({behavior:"smooth",block:"center"});}},0);}' +
    'function showResult(result){document.getElementById("statusView").innerHTML=' +
    '"<h2>Printed bulletin ready / 實體週刊已完成</h2><p class=\'intro\'>"+escapeHtml(result.title||"Your bulletin is ready. / 您的週刊已準備好。")+"</p>"+'+
    '"<a class=\'link\' href=\'"+escapeHtml(result.url)+"\'>Open Google Doc / 開啟 Google 文件</a>"+'+
    '"<a class=\'link\' href=\'"+escapeHtml(result.pdfUrl)+"\'>Open PDF / 開啟 PDF</a>"+'+
    '"<div class=\'actions\'><button type=\'button\' class=\'cancel\' onclick=\'google.script.host.close()\'>Close / 關閉</button></div>";}' +
    'function runRequest(request){document.getElementById("submit").disabled=true;google.script.run.withSuccessHandler(function(result){' +
    'if(result&&result.requiresConfirmation){var message=result.warning+"\\n\\n"+result.warningChinese+"\\n\\nContinue anyway? / 仍要繼續嗎？";if(window.confirm(message)){request.confirmLongVerse=true;runRequest(request);}else{updateSubmitState();}return;}' +
    'showLoading();google.script.run.withSuccessHandler(showResult).withFailureHandler(function(error){showGenerationError(error);}).createPrintedBulletinFromRequest(request);' +
    '}).withFailureHandler(function(error){showError(error&&error.message?error.message:String(error));}).getPrintedBulletinPromptWarning(request.verse||"",Boolean(request.confirmLongVerse),{englishTranslation:request.englishTranslation});}' +
    'document.getElementById("locationChoices").addEventListener("click",function(event){if(event.target.classList.contains("choice")&&!event.target.disabled){locationValue=event.target.getAttribute("data-value");selectChoice("locationChoices",locationValue);updateLocationFormatAvailability();loadPromptData();}});' +
    'document.getElementById("formatChoices").addEventListener("click",function(event){if(event.target.classList.contains("choice")&&!event.target.disabled){formatValue=event.target.getAttribute("data-value");selectChoice("formatChoices",formatValue);updateLocationFormatAvailability();updateSubmitState();}});' +
    'document.getElementById("addAnnouncement").addEventListener("click",function(){addAnnouncementEntry({});announcementsDirty=true;});' +
    'document.getElementById("announcementList").addEventListener("input",function(){announcementsDirty=true;});' +
    'document.getElementById("announcementList").addEventListener("change",function(){announcementsDirty=true;});' +
    'document.getElementById("announcementList").addEventListener("click",function(event){if(event.target.classList.contains("announcement-remove")){event.target.closest(".announcement-entry").remove();if(!document.getElementById("announcementList").children.length){addAnnouncementEntry({});}refreshAnnouncementLabels();announcementsDirty=true;}});' +
    'document.getElementById("date").addEventListener("change",function(){loadPromptData();updateSubmitState();});' +
    'document.getElementById("book").addEventListener("change",function(){updateChapterOptions();if(!suppressVerseDirty){verseDirty=true;}updateSubmitState();});' +
    'document.getElementById("chapter").addEventListener("change",function(){if(!suppressVerseDirty){verseDirty=true;}updateSubmitState();});' +
    'document.getElementById("verses").addEventListener("input",function(){if(!suppressVerseDirty){verseDirty=true;}updateSubmitState();});' +
    'document.getElementById("bulletinForm").addEventListener("submit",function(event){event.preventDefault();var date=document.getElementById("date").value.trim();var book=document.getElementById("book");var chapter=document.getElementById("chapter");var verses=document.getElementById("verses").value.trim();if(!date||!book.value||!chapter.value||!verses){showError("Sabbath date, Bible book, chapter, and verse/range are required. / 安息日日期、聖經書卷、章和節數（或節數範圍）均為必填。");return;}if(verses&&!/^\\d+(?:-\\d+)?$/.test(verses)){showError("Verse(s) must look like 11 or 11-15. / 節數格式應為 11 或 11-15。");return;}var range=verses.split("-");if(range.length===2&&Number(range[1])<Number(range[0])){showError("The ending verse must not be smaller than the starting verse. / 結束節數不可小於開始節數。");return;}var reference=book.options[book.selectedIndex].getAttribute("data-english")+" "+chapter.value+":"+verses;var request={date:date,format:formatValue,location:locationValue,verse:reference,englishTranslation:document.getElementById("englishTranslation").value};if(announcementsDirty){request.announcements=collectAnnouncements();}if(verseDirty){request.verseOverrideDirty=true;}runRequest(request);});' +
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
      ? '這段經文約有 ' +
        stats.words +
        ' 個英文單字（' +
        stats.characters +
        ' 個字元）。雙語經文欄可能會有較多換行，甚至使週刊增加頁數。'
      : '這段經文較長，雙語經文欄可能會有較多換行，甚至使週刊增加頁數。',
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

function showPrintedBulletinResultDialog_(result) {
  var output = HtmlService.createHtmlOutput(
    buildPrintedBulletinResultHtml_(result),
  )
    .setWidth(460)
    .setHeight(260);
  SpreadsheetApp.getUi().showModalDialog(
    output,
    'Printed bulletin ' +
      (result.action === 'updated' ? 'updated / 已更新' : 'created / 已建立'),
  );
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
  var verseForGeneration = request.verse;
  if (request.verseOverrideDirty) {
    savePrintedBibleVerseOverride_(
      request.date,
      request.location,
      request.verse,
    );
    verseForGeneration = '';
  }
  return createPrintedBulletin_(
    request.date,
    request.format,
    request.location,
    verseForGeneration,
    {
      englishTranslation: request.englishTranslation,
      chineseTranslation: request.chineseTranslation,
    },
  );
}

function validatePrintedBulletinRequest_(request) {
  if (!toIsoDate_(request.date)) {
    throw new Error('Sabbath date is required. / 安息日日期為必填。');
  }
  var location = normalizePrintedBulletinLocation_(request.location);
  var requestedFormat = String(request.format || '').trim().toLowerCase();
  if (requestedFormat === 'communion') {
    validatePrintedBulletinCombination_(location, requestedFormat);
  }
  var verse = String(request.verse || '').trim();
  if (!verse) {
    throw new Error('Bible book, chapter, and verse/range are required. / 聖經書卷、章和節數（或節數範圍）均為必填。');
  }
  if (!/^.+\s+\d+:\d+(?:-\d+)?$/.test(verse)) {
    throw new Error('Bible reference must include a book, chapter, and verse/range. / 聖經經文必須包括書卷、章和節數（或節數範圍）。');
  }
}

/**
 * Reads the printed-only announcement list for the selected Sabbath. This is
 * deliberately separate from the public bulletin payload and speaker form.
 */
function getPrintedBulletinAnnouncements(requestedDate) {
  return readPrintedBulletinAnnouncements_(requestedDate).entries;
}

function getPrintedBulletinPromptData(requestedDate, requestedLocation) {
  var date = toIsoDate_(requestedDate);
  var location = normalizePrintedBulletinLocation_(requestedLocation);
  var formVerse = '';
  var bulletin = null;
  if (date) {
    try {
      bulletin = buildBulletin_(date);
      formVerse = bulletin[location] ? String(bulletin[location].bibleVerses || '') : '';
    } catch (error) {
      Logger.log('Could not load form data for the printed bulletin prompt: ' + error);
    }
  }
  var override = readPrintedBibleVerseOverride_(date, location);
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
  return {
    announcements: announcements,
    formVerse: formVerse,
    verse: override.found ? override.reference : formVerse,
    hasVerseOverride: override.found,
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

function savePrintedBibleVerseOverride_(requestedDate, requestedLocation, reference) {
  var date = toIsoDate_(requestedDate);
  var location = normalizePrintedBulletinLocation_(requestedLocation);
  if (!date) {
    throw new Error('A valid Sabbath date is required for the printed Bible verse');
  }

  var normalizedReference = String(reference || '').trim();
  if (normalizedReference.length > 300) {
    throw new Error('The printed Bible verse reference is too long.');
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    PropertiesService.getScriptProperties().setProperty(
      getPrintedBibleVersePropertyKey_(date, location),
      normalizedReference,
    );
  } finally {
    lock.releaseLock();
  }
}

function readPrintedBibleVerseOverride_(requestedDate, requestedLocation) {
  var date = toIsoDate_(requestedDate);
  var location = normalizePrintedBulletinLocation_(requestedLocation);
  if (!date || typeof PropertiesService === 'undefined') {
    return { found: false, reference: '' };
  }

  var raw = PropertiesService.getScriptProperties().getProperty(
    getPrintedBibleVersePropertyKey_(date, location),
  );
  return {
    found: raw !== null && typeof raw !== 'undefined',
    reference: String(raw || '').trim(),
  };
}

function getPrintedBibleVersePropertyKey_(date, location) {
  return (
    PRINTED_BULLETIN_CONFIG.printedBibleVersePropertyPrefix +
    String(location || '').toUpperCase() +
    '_' +
    date
  );
}

function showPrintedBulletinLoadingDialog_(request) {
  var output = HtmlService.createHtmlOutput(
    buildPrintedBulletinLoadingHtml_(request),
  )
    .setWidth(460)
    .setHeight(280);
  SpreadsheetApp.getUi().showModalDialog(output, 'Creating printed bulletin');
}

function buildPrintedBulletinLoadingHtml_(request) {
  var requestJson = JSON.stringify(request || {})
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');

  return (
    '<!doctype html>' +
    '<html><head><base target="_blank"><style>' +
    'body{font-family:Arial,sans-serif;color:#202124;padding:22px;}' +
    '.state{text-align:center;padding:8px 0;}' +
    '.spinner{width:34px;height:34px;margin:4px auto 18px;border:4px solid #dadce0;' +
    'border-top-color:#1a73e8;border-radius:50%;animation:spin .85s linear infinite;}' +
    '@keyframes spin{to{transform:rotate(360deg)}}' +
    'h2{font-size:18px;margin:0 0 8px;}' +
    'p{font-size:14px;line-height:1.45;margin:0 0 16px;}' +
    '.link{display:block;border:1px solid #dadce0;border-radius:6px;' +
    'color:#1a73e8;font-size:14px;margin:10px 0;padding:11px 12px;' +
    'text-decoration:none;text-align:left;}' +
    '.link:hover{background:#f8f9fa;}' +
    'button{float:right;background:#1a73e8;border:0;border-radius:4px;' +
    'color:white;cursor:pointer;padding:8px 18px;}' +
    '.error{color:#b3261e;text-align:left;white-space:pre-wrap;}' +
    '</style></head><body>' +
    '<div id="state" class="state">' +
    '<div class="spinner" aria-label="Loading"></div>' +
    '<h2>Creating printed bulletin…<br>正在建立實體週刊…</h2>' +
    '<p>This may take a minute while the Google Doc is laid out and the PDF is exported.<br>建立 Google 文件和匯出 PDF 可能需要一點時間。</p>' +
    '</div>' +
    '<script>' +
    'function escapeHtml(value){return String(value==null?"":value)' +
    '.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")' +
    '.replace(/"/g,"&quot;").replace(/\'/g,"&#39;");}' +
    'function showResult(result){' +
    'var action=result.action==="updated"?"updated":"created";' +
    'document.getElementById("state").innerHTML=' +
    '"<h2>Printed bulletin "+escapeHtml(action)+"</h2>"+' +
    '"<p>"+escapeHtml(result.title||"Your bulletin is ready.")+"</p>"+' +
    '"<a class=\'link\' href=\'"+escapeHtml(result.url)+"\'>Open Google Doc</a>"+' +
    '"<a class=\'link\' href=\'"+escapeHtml(result.pdfUrl)+"\'>Open PDF</a>"+' +
    '"<button onclick=\'google.script.host.close()\'>Close</button>";' +
    '}' +
    'function showError(error){' +
    'var message=error&&error.message?error.message:String(error);' +
    'document.getElementById("state").innerHTML=' +
    '"<h2>Printed bulletin could not be created</h2>"+' +
    '"<p class=\'error\'>"+escapeHtml(message)+"</p>"+' +
    '"<button onclick=\'google.script.host.close()\'>Close</button>";' +
    '}' +
    'google.script.run.withSuccessHandler(showResult).withFailureHandler(showError)' +
    '.createPrintedBulletinFromRequest(' +
    requestJson +
    ');' +
    '</script></body></html>'
  );
}

function buildPrintedBulletinResultHtml_(result) {
  var action = result.action === 'updated' ? 'updated' : 'created';
  return (
    '<!doctype html>' +
    '<html><head><base target="_blank"><style>' +
    'body{font-family:Arial,sans-serif;color:#202124;padding:18px 22px;}' +
    'h2{font-size:18px;margin:0 0 8px;}' +
    'p{font-size:14px;margin:0 0 16px;}' +
    '.link{display:block;border:1px solid #dadce0;border-radius:6px;' +
    'color:#1a73e8;font-size:14px;margin:10px 0;padding:11px 12px;' +
    'text-decoration:none;}' +
    '.link:hover{background:#f8f9fa;}' +
    'button{float:right;background:#1a73e8;border:0;border-radius:4px;' +
    'color:white;cursor:pointer;padding:8px 18px;}' +
    '</style></head><body>' +
    '<h2>Printed bulletin ' +
    escapePrintedBulletinHtml_(action) +
    ' / 實體週刊</h2>' +
    '<p>' +
    escapePrintedBulletinHtml_(result.title || 'Your bulletin is ready.') +
    '</p>' +
    '<a class="link" href="' +
    escapePrintedBulletinHtml_(result.url) +
    '">Open Google Doc / 開啟 Google 文件</a>' +
    '<a class="link" href="' +
    escapePrintedBulletinHtml_(result.pdfUrl) +
    '">Open PDF / 開啟 PDF</a>' +
    '<button onclick="google.script.host.close()">Close</button>' +
    '</body></html>'
  );
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
 * Creates the one-time installable trigger used for Queens and Brooklyn form
 * submissions.
 * A trigger is not created automatically because Google requires an
 * authorized staff member to approve Docs/Drive access first.
 */
function installPrintedBulletinTrigger() {
  requirePrintedBulletinAdmin_();

  var triggers = ScriptApp.getProjectTriggers();
  var alreadyInstalled = triggers.some(function (trigger) {
    return (
      (trigger.getHandlerFunction() === 'handlePrintedBulletinFormSubmit_' ||
        trigger.getHandlerFunction() === 'handlePhysicalBulletinFormSubmit_' ||
        trigger.getHandlerFunction() === 'handleQueensFormSubmit_') &&
      trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
    );
  });

  if (!alreadyInstalled) {
    ScriptApp.newTrigger('handlePrintedBulletinFormSubmit_')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onFormSubmit()
      .create();
  }

  SpreadsheetApp.getUi().alert(
    alreadyInstalled
      ? 'Printed bulletin form auto-generation is already installed.'
      : 'Printed bulletin form auto-generation is now installed for Queens and Brooklyn.',
  );
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

/**
 * Install this handler as a spreadsheet "On form submit" trigger. It ignores
 * submissions from other sheets in the workbook.
 */
function handlePrintedBulletinFormSubmit_(event) {
  var sheet = event && event.range ? event.range.getSheet() : null;
  var location = getPrintedBulletinLocationForSheet_(sheet);
  if (!location) {
    return;
  }

  var date = getSubmittedDate_(event, sheet);
  if (!date) {
    throw new Error(location + ' form submission did not contain a valid Sabbath date');
  }

  var result = createPrintedBulletin_(date, 'auto', location);
  Logger.log(
    location + ' printed bulletin ' + result.action + ': ' + result.url + ' / ' + result.pdfUrl,
  );
}

// Keep previously installed Queens triggers working after the Brooklyn layout
// is enabled. The installer recognizes this legacy handler name and the
// implementation now routes both response tabs.
function handleQueensFormSubmit_(event) {
  return handlePrintedBulletinFormSubmit_(event);
}

function installQueensPrintedBulletinTrigger() {
  return installPrintedBulletinTrigger();
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

function handlePhysicalBulletinFormSubmit_(event) {
  return handlePrintedBulletinFormSubmit_(event);
}

function installPhysicalBulletinTrigger() {
  return installPrintedBulletinTrigger();
}

function installQueensPhysicalBulletinTrigger() {
  return installQueensPrintedBulletinTrigger();
}

function getPrintedBulletinLocationForSheet_(sheet) {
  if (!sheet) {
    return '';
  }
  if (CONFIG.responseSheets.queens.indexOf(sheet.getName()) !== -1) {
    return 'queens';
  }
  if (CONFIG.responseSheets.brooklyn.indexOf(sheet.getName()) !== -1) {
    return 'brooklyn';
  }
  return '';
}

function getSubmittedDate_(event, sheet) {
  var table = readTable_(sheet);
  var dateColumn = findFirstHeaderIndex_(table.headers, CONFIG.dateHeaders);
  var values = event && event.values ? event.values : [];
  if (dateColumn !== -1 && values[dateColumn]) {
    return toIsoDate_(values[dateColumn]);
  }

  var namedValues = (event && event.namedValues) || {};
  var keys = Object.keys(namedValues);
  for (var index = 0; index < keys.length; index += 1) {
    var key = keys[index];
    if (findFirstHeaderIndex_([key], CONFIG.dateHeaders) !== -1) {
      var answer = namedValues[key];
      return toIsoDate_(Array.isArray(answer) ? answer[0] : answer);
    }
  }
  return '';
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
  studyVerseReference,
  requestedBibleTranslations,
) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return createPrintedBulletinUnlocked_(
      requestedDate,
      requestedFormat,
      requestedLocation,
      studyVerseReference,
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
  studyVerseReference,
  requestedBibleTranslations,
) {
  var date = toIsoDate_(requestedDate);
  if (!date) {
    throw new Error('A valid Sabbath date is required');
  }

  var location = normalizePrintedBulletinLocation_(requestedLocation);
  var bibleTranslations = normalizePhysicalBibleTranslations_(requestedBibleTranslations);
  var nameDictionary = buildPhysicalNameDictionary_();
  var bulletin = buildBulletin_(date, { includeFullNames: true });
  var printedAnnouncements = readPrintedBulletinAnnouncements_(date);
  bulletin.printedAnnouncements = printedAnnouncements.entries;
  bulletin.hasPrintedAnnouncements = printedAnnouncements.found;
  var printedVerseOverride = readPrintedBibleVerseOverride_(date, location);
  if (printedVerseOverride.found && bulletin[location]) {
    bulletin[location].bibleVerses = printedVerseOverride.reference;
  }
  var promptedVerse = String(studyVerseReference || '').trim();
  if (promptedVerse && bulletin[location]) {
    bulletin[location].bibleVerses = promptedVerse;
  }
  bulletin = preparePrintedBulletinForPrint_(bulletin, nameDictionary);
  bulletin.physicalBibleTranslations = bibleTranslations;
  hydratePhysicalBibleVerses_(bulletin, bibleTranslations);
  var format = resolvePrintedBulletinFormat_(requestedFormat, bulletin);
  validatePrintedBulletinCombination_(location, format);
  var nextBulletin = tryBuildPrivateBulletin_(getNextSabbathDate_(date), nameDictionary);
  hydratePhysicalSunsetTimes_(bulletin, nextBulletin);
  var title = getPrintedBulletinTitle_(location, date, format);
  var documentPropertyKey = getPrintedBulletinPropertyKey_(
    PRINTED_BULLETIN_CONFIG.documentPropertyPrefix,
    location,
    date,
  );
  var pdfPropertyKey = getPrintedBulletinPropertyKey_(
    PRINTED_BULLETIN_CONFIG.pdfPropertyPrefix,
    location,
    date,
  );
  var properties = PropertiesService.getScriptProperties();
  var legacyDocumentPropertyKey = PRINTED_BULLETIN_CONFIG.documentPropertyPrefix + date;
  var legacyPdfPropertyKey = PRINTED_BULLETIN_CONFIG.pdfPropertyPrefix + date;
  var existingDocumentId = properties.getProperty(documentPropertyKey);
  if (!existingDocumentId && location === 'queens') {
    existingDocumentId = properties.getProperty(legacyDocumentPropertyKey);
  }
  var document = null;
  var action = 'created';

  if (existingDocumentId) {
    try {
      document = DocumentApp.openById(existingDocumentId);
      action = 'updated';
    } catch (error) {
      properties.deleteProperty(documentPropertyKey);
    }
  }

  document = document || DocumentApp.create(title);
  if (action === 'updated') {
    DriveApp.getFileById(document.getId()).setName(title);
  }
  renderPrintedBulletinDocument_(document, bulletin, nextBulletin, format, location);
  document.saveAndClose();

  movePrintedBulletinToConfiguredFolder_(document.getId());
  properties.setProperty(documentPropertyKey, document.getId());
  if (location === 'queens' && legacyDocumentPropertyKey !== documentPropertyKey) {
    properties.deleteProperty(legacyDocumentPropertyKey);
  }
  if (!properties.getProperty(pdfPropertyKey) && location === 'queens') {
    var legacyPdfId = properties.getProperty(legacyPdfPropertyKey);
    if (legacyPdfId) {
      properties.setProperty(pdfPropertyKey, legacyPdfId);
      properties.deleteProperty(legacyPdfPropertyKey);
    }
  }
  var pdf = createOrReplacePrintedBulletinPdf_(
    document.getId(),
    title,
    pdfPropertyKey,
  );

  return {
    id: document.getId(),
    title: title,
    format: format,
    action: action,
    url: document.getUrl(),
    pdfAction: pdf.action,
    pdfId: pdf.id,
    pdfUrl: pdf.url,
  };
}

function normalizePrintedBulletinLocation_(requestedLocation) {
  var location = String(requestedLocation || 'queens').trim().toLowerCase();
  if (location === 'queens' || location === 'brooklyn') {
    return location;
  }
  throw new Error('Location must be queens or brooklyn');
}

function getPrintedBulletinTitle_(location, date, format) {
  var churchName =
    location === 'brooklyn'
      ? 'New York Chinese SDA Church — Brooklyn Fellowship'
      : PRINTED_BULLETIN_CONFIG.churchName;
  return (
    churchName +
    ' — ' +
    formatDateForPrint_(date) +
    (format === 'communion' ? ' — Communion' : '')
  );
}

function getPrintedBulletinPropertyKey_(prefix, location, date) {
  return prefix + location.toUpperCase() + '_' + date;
}

function renderPrintedBulletinDocument_(document, bulletin, nextBulletin, format, location) {
  var body = document.getBody();

  body.clear();
  body.setPageWidth(PRINTED_BULLETIN_CONFIG.pageWidth);
  body.setPageHeight(PRINTED_BULLETIN_CONFIG.pageHeight);
  body.setMarginTop(PRINTED_BULLETIN_CONFIG.pageMargin);
  body.setMarginBottom(PRINTED_BULLETIN_CONFIG.pageMargin);
  body.setMarginLeft(PRINTED_BULLETIN_CONFIG.pageMargin);
  body.setMarginRight(PRINTED_BULLETIN_CONFIG.pageMargin);

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

function renderQueensRegularPrintedBulletinDocument_(body, bulletin, nextBulletin, format) {
  // The regular Queens reference is a simpler two-page handout: the interior
  // Study/Worship spread comes first, followed by the back/cover spread.
  appendBookletPage_(
    body,
    function (cell) {
      appendStudyPanel_(cell, bulletin);
    },
      function (cell) {
        appendWorshipPanel_(cell, bulletin, true);
      },
      true,
    appendGivingFooter_,
  );
  appendBookletPage_(
    body,
    function (cell) {
      appendAnnouncementsPanel_(cell, bulletin, nextBulletin);
    },
    function (cell) {
      appendCoverPanel_(cell, bulletin, format);
    },
    false,
  );
}

function renderBrooklynPrintedBulletinDocument_(body, bulletin, nextBulletin, format) {
  // The supplied Brooklyn reference is a two-page, landscape, two-column
  // bulletin: Sabbath School and worship first, then the rotating schedule
  // table and the fellowship cover/contact block.
  appendBookletPage_(
    body,
    function (cell) {
      appendBrooklynMeetingsPanel_(cell, bulletin, nextBulletin);
    },
    function (cell) {
      appendBrooklynCoverPanel_(cell, bulletin, format);
    },
    true,
  );

  if (format !== 'communion') {
    appendBookletPage_(
      body,
      function (cell) {
        appendBrooklynStudyPanel_(cell, bulletin);
      },
      function (cell) {
        appendBrooklynWorshipPanel_(cell, bulletin, true);
      },
      false,
      appendGivingFooter_,
    );
  } else {
    appendBookletPage_(
      body,
      function (cell) {
        appendBrooklynStudyPanel_(cell, bulletin);
      },
      function (cell) {
        appendBrooklynClosingPanel_(cell, bulletin);
      },
      false,
    );
    appendBookletPage_(
      body,
      function (cell) {
        appendBrooklynCommunionActionsPanel_(cell, bulletin);
      },
      function (cell) {
        appendBrooklynWorshipPanel_(cell, bulletin, false);
      },
      false,
    );
    appendBookletPage_(
      body,
      function (cell) {
        appendFootWashingPanel_(cell, bulletin);
      },
      function (cell) {
        appendBrooklynCommunionPanel_(cell, bulletin);
      },
      false,
    );
  }
}

function appendBrooklynStudyPanel_(cell, bulletin) {
  var location = bulletin.brooklyn;
  appendPanelHeading_(
    cell,
    printedBilingualText_('BROOKLYN CHINESE SABBATH SCHOOL', '布魯克林華人團契 安息日學'),
    printedBilingualText_('Sabbath School', '安息日學'),
  );
  appendCenteredText_(cell, '10:00 am–11:25 am', 9, false);

  appendBrooklynProgramTable_(cell, [
    [printedBilingualText_('Welcome', '歡迎'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [
      printedBilingualText_('Song and Bible Verse', '詩歌頌讚與存心節'),
      '',
      printBrooklynPerson_(location.songLeader, location.chairPastoralPrayer),
    ],
    [printedBilingualText_('Opening Hymn', '開會唱詩'), physicalTbdText_(), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Prayer', '祈禱'), '', printValue_(location.chairPastoralPrayer)],
    [
      printedBilingualText_('Sabbath Message', '安息日勉言'),
      printValue_(location.sabbathMessageTitle),
      printBrooklynPerson_(location.sabbathMessage, location.chairPastoralPrayer),
    ],
    [printedBilingualText_('Sabbath School', '安息日學課'), physicalTbdText_(), printValue_(location.sabbathSchool)],
    [printedBilingualText_('Closing Hymn', '合班唱詩'), physicalTbdText_(), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Closing Prayer', '合班禱告'), physicalTbdText_(), physicalTbdText_('尚未安排')],
  ]);

  appendSectionHeading_(cell, printedBilingualText_('Five Minutes Break', '休息五分鐘'));
  appendBibleReadingPanel_(cell, location, true, bulletin.physicalBibleTranslations);
}

function appendBrooklynWorshipPanel_(cell, bulletin, includeClosingRows) {
  var location = bulletin.brooklyn;
  appendPanelHeading_(
    cell,
    printedBilingualText_('BROOKLYN CHINESE SABBATH WORSHIP', '布魯克林華人團契 聖日崇拜'),
    printedBilingualText_('Sabbath Worship', '安息日崇拜'),
  );
  appendCenteredText_(cell, '11:30 am–1:00 pm', 9, false);

  var worshipRowsBeforeSermon = [
    [printedBilingualText_('Chairman', '主席'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [printedBilingualText_('Doxology', '讚美'), printedBilingualText_('AH 694 — Praise God', '第497首 讚美上帝'), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Invocation', '獻禱'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [printedBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Bible Readings', '讀經'), formatBibleReferenceForPrint_(location), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Pastoral Prayer', '牧養禱告'), '', printValue_(location.chairPastoralPrayer)],
    [printedBilingualText_('Tithe & Offering', '十一與奉獻'), formatPhysicalOfferingValue_(bulletin.tithePurpose), printValue_(location.offeringPrayer)],
    [printedBilingualText_('Special Music', '特別音樂'), '', printValue_(location.specialMusic)],
  ];
  var worshipRowsAfterSermon = [
    [printedBilingualText_('Hymn of Response', '回應詩'), formatHymnForPrint_(location.hymnOfResponse), printedBilingualText_('Congregation', '會眾')],
  ];
  var sermonRow = [
    printedBilingualText_('Sermon', '講道'),
    formatSermonTitleForPrint_(location),
    printValue_(location.sermon),
  ];
  if (includeClosingRows) {
    worshipRowsAfterSermon.push([
      printedBilingualText_('Benediction', '散會禱告'),
      '',
      printValue_(location.sermon),
    ]);
    worshipRowsAfterSermon.push([
      printedBilingualText_('Postlude', '後奏曲'),
      printedBilingualText_('SDAH 690 — Dismiss Us, Lord', '第504首 散會頌'),
      printedBilingualText_('Congregation', '會眾'),
    ]);
  }
  appendBrooklynProgramTable_(cell, worshipRowsBeforeSermon);
  appendSermonRow_(cell, sermonRow);
  appendBrooklynProgramTable_(cell, worshipRowsAfterSermon);
  if (includeClosingRows) {
    appendSilentPrayerHeading_(cell, 'Silent Prayer', '請默禱之後散會');
  }
}

function appendBrooklynMeetingsPanel_(cell, bulletin, nextBulletin) {
  var current = bulletin.brooklyn;
  var next = nextBulletin ? nextBulletin.brooklyn : null;
  appendCenteredText_(cell, 'Announcements | 報告事項', 10.5, true);
  appendPrintedAnnouncementsTable_(
    cell,
    getPhysicalPrintedAnnouncementEntries_(bulletin, 'brooklyn'),
  );
  appendHorizontalScheduleTable_(cell, current, next, [
    [printedBilingualText_('Chair', '主席'), function (value) { return printBrooklynPerson_(value.chair, value.chairPastoralPrayer); }],
    [printedBilingualText_('Technician', '技術設備'), function (value) { return printValue_(value.technician); }],
    [printedBilingualText_('Testimonies', '安息日勉言'), function (value) { return printBrooklynPerson_(value.testimonies, value.sabbathMessage); }],
    [printedBilingualText_('Sabbath School', '安息日學'), function (value) { return printValue_(value.sabbathSchool); }],
    [printedBilingualText_('Offering Prayer', '奉獻禱告'), function (value) { return printValue_(value.offeringPrayer); }],
    [printedBilingualText_('Sermon', '崇拜證道'), function (value) { return printValue_(value.sermon); }],
    [printedBilingualText_('Sunset Times', '日落時間'), function (value) { return printValue_(value.sunsetTime); }],
  ]);

  appendSectionHeading_(cell, printedBilingualText_('Online Study', '週間網絡學習'));
  appendBrooklynProgramTable_(cell, [
    [printedBilingualText_('Tuesday', '週二早'), '8:00–9:00 AM', 'Sabbath School lesson study'],
    [printedBilingualText_('Wednesday', '週三早'), '8:00–9:00 AM', 'The Desire of Ages study'],
    [printedBilingualText_('Wednesday', '週三晚'), '8:00–9:00 PM', 'Bible study: 1 Corinthians'],
  ]);
  appendBodyText_(cell, 'Zoom meeting: 254 187 9535    Password: 760641');
}

function appendBrooklynCoverPanel_(cell, bulletin, format) {
  renderPrintedBrooklynCoverPanel_(cell, bulletin, format);
}

function appendSharedCoverPanel_(cell, bulletin, format) {
  // US Letter landscape leaves 368 points for each folded cover panel after
  // the 28-point page margins.
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
  appendCenteredText_(cell, '7606 41st Ave, Elmhurst, NY 11373', 8.5, true);
  appendCenteredText_(cell, formatSharedCoverDate_(bulletin.date), 9, true);
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
      { text: '安息日聚會 | 每週六上午 10:30', bold: true },
      { text: 'Elmhurst Service | Saturdays 10:30 AM', bold: true },
      { text: '7606 41st Avenue', italic: true },
      { text: 'Elmhurst, NY 11373', italic: true },
    ],
    [
      { text: '布魯克林安息日聚會 | 每週六上午 10:30', bold: true },
      { text: 'Brooklyn Service | Saturdays 10:30 AM', bold: true },
      { text: '5318 4th Avenue,', italic: true },
      { text: 'Brooklyn, NY 11220', italic: true },
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
    { text: '法拉盛團契聚會 | 每週四晚 7:30 (6:30 晚餐)', bold: true },
    { text: 'Flushing Fellowship | Thursday 7:30 PM (6:30 PM Dinner)', bold: true },
    { text: '143-11 Willets Point Boulevard', italic: true },
    { text: 'Whitestone, NY 11357', italic: true },
  ], DocumentApp.HorizontalAlignment.CENTER);
}

function appendSharedCoverContactLines_(cell, lines, alignment) {
  alignment = alignment || DocumentApp.HorizontalAlignment.CENTER;
  lines.forEach(function (line) {
    var paragraph = cell.appendParagraph(line.text);
    paragraph.setAlignment(alignment);
    paragraph.setLineSpacing(1.05);
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    var rendered = paragraph.editAsText();
    styleText_(rendered, line.italic ? 7.5 : 8, line.bold !== false);
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

function appendBrooklynContactBlock_(cell) {
  appendBodyText_(
    cell,
    printedBilingualText_(
      'New York Chinese SDA Church\n7606 41st Ave, Elmhurst, NY 11373',
      '紐約華人基督復臨安息日教會\n7606 41st Ave, Elmhurst, NY 11373',
    ),
  );
  appendBodyText_(
    cell,
    printedBilingualText_(
      'Brooklyn Chinese SDA Fellowship\nSaturday 10:30 am\nBay Ridge Spanish SDA Church\n5318 4th Avenue, Brooklyn',
      '布魯克林安息日聚會\n每週六上午 10:30\nBay Ridge Spanish SDA Church\n5318 4th Avenue, Brooklyn',
    ),
  );
  appendBodyText_(
    cell,
    printedBilingualText_(
      'Flushing Fellowship\nThursday 7:00 pm–9:00 pm\n143-11 Willets Point Boulevard, Whitestone, NY 11357',
      '法拉盛團契\n每週四晚上 7:00–9:00\n143-11 Willets Point Boulevard, Whitestone, NY 11357',
    ),
  );
}

function appendBrooklynCommunionPanel_(cell, bulletin) {
  var location = bulletin.brooklyn;
  appendBrooklynProgramTable_(cell, [
    [printedBilingualText_('Foot Washing', '洗腳禮'), '', getPrintedCommunionWholeCongregation_()],
  ]);
  appendBodyText_(cell, getPrintedCommunionFootWashingInstruction_());
  appendPanelHeading_(
    cell,
    printedBilingualText_('HOLY COMMUNION', '聖餐禮'),
    getPrintedCommunionServiceScripture_(),
  );
  appendBrooklynProgramTable_(cell, [
    [printedBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Bible Reading', '讀經'), getPrintedCommunionServiceScripture_(), printedBilingualText_('Congregation', '會眾')],
  ]);
  appendPrintedCommunionPassageBox_(cell, bulletin, 'communion');
}

function appendBrooklynCommunionActionsPanel_(cell, bulletin) {
  appendCommunionActionsPanel_(cell, bulletin, 'brooklyn');
}

function appendBrooklynClosingPanel_(cell, bulletin) {
  appendPanelHeading_(cell, printedBilingualText_('CLOSING', '結束'), 'Brooklyn Fellowship');
  appendBrooklynClosingRows_(cell, bulletin);
}

function appendBrooklynProgramTable_(cell, rows) {
  appendProgramTable_(cell, rows);
}

function printBrooklynPerson_(primary, fallback) {
  return printValue_(hasPrintValue_(primary) ? primary : fallback);
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
      'Brooklyn Communion bulletins are not available yet. Choose Regular for Brooklyn. / 目前尚未提供布碌崙聖餐禮週刊；布碌崙請選擇普通格式。',
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

function resolvePhysicalBiblePassage_(reference, bibleTranslations) {
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

  return {
    english: englishParts.join(' '),
    chinese: chineseParts.join(' '),
    references: references,
  };
}

function parsePhysicalBibleReferences_(value) {
  var source = String(value || '')
    .replace(/[：]/g, ':')
    .replace(/[–—]/g, '-')
    .replace(/\s*\([^)]*\)\s*$/g, '')
    .trim();
  if (!source) {
    return [];
  }

  var pieces = source
    .split(/[;；,，\n]/)
    .reduce(function (all, piece) {
      return all.concat(piece.split(/\s+(?:and|&)\s+/i));
    }, [])
    .map(function (piece) {
      return piece.trim();
    })
    .filter(Boolean);
  var references = [];

  pieces.forEach(function (piece) {
    // Accept both "Jeremiah 29:11-15" and the common shorthand
    // "Jeremiah:29:11-15".
    piece = piece.replace(/^(.+?):(\d+):/, '$1 $2:');
    var match = piece.match(
      /^(.+?)\s+(\d+)(?:\s*:\s*(\d+)(?:\s*-\s*(\d+))?)?$/,
    );
    if (!match) {
      return;
    }

    var bookName = normalizePhysicalBibleBookName_(match[1]);
    var bookId = PRINTED_BIBLE_BOOK_IDS[bookName];
    if (!bookId) {
      return;
    }

    var verseStart = match[3] ? Number(match[3]) : null;
    var verseEnd = match[4] ? Number(match[4]) : verseStart;
    if (verseStart && verseEnd < verseStart) {
      return;
    }

    references.push({
      bookId: bookId,
      chapter: Number(match[2]),
      verseStart: verseStart,
      verseEnd: verseEnd,
    });
  });

  return references;
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

function buildPhysicalNameDictionary_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Name Dictionary');
  var dictionary = {
    englishToChinese: {},
    chineseToEnglish: {},
  };
  if (!sheet) {
    Logger.log('Name Dictionary sheet not found; printing source names only.');
    return dictionary;
  }

  var table = readTable_(sheet);
  table.rows.forEach(function (row) {
    var english = displayValue_(row[0]).trim();
    var chinese = displayValue_(row[1]).trim();
    var englishKey = normalizePhysicalNameKey_(english);
    var chineseKey = normalizePhysicalNameKey_(chinese);
    if (englishKey && chinese && !dictionary.englishToChinese[englishKey]) {
      dictionary.englishToChinese[englishKey] = chinese;
    }
    if (chineseKey && english && !dictionary.chineseToEnglish[chineseKey]) {
      dictionary.chineseToEnglish[chineseKey] = english;
    }
  });
  return dictionary;
}

function preparePrintedBulletinForPrint_(bulletin, nameDictionary) {
  var personFields = [
    'sermon',
    'translation',
    'chineseTeacher',
    'englishTeacher',
    'childrenTeacher',
    'chairPastoralPrayer',
    'specialMusic',
    'offeringPrayer',
    'pianist',
    'ssChair',
    'ssOpeningPrayer',
    'closingPrayer',
    'sabbathSchool',
    'chair',
    'songLeader',
    'sabbathMessage',
    'technician',
    'testimonies',
  ];
  ['queens', 'brooklyn'].forEach(function (locationKey) {
    var location = bulletin[locationKey];
    personFields.forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(location, field)) {
        location[field] = formatPhysicalPersonValue_(location[field], nameDictionary);
      }
    });
  });
  return bulletin;
}

function formatPhysicalPersonValue_(value, nameDictionary) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value)
    .trim()
    .replace(/[^\S\r\n]+/g, ' ');
  if (!text) {
    return '';
  }

  var dictionary = nameDictionary || { englishToChinese: {}, chineseToEnglish: {} };
  return text
    .split(/(\s*(?:\/|&|\+|\n|\band\b)\s*)/i)
    .map(function (part, index) {
      if (index % 2 === 1) {
        return part;
      }
      return formatPhysicalSinglePerson_(part, dictionary);
    })
    .join('');
}

function formatPhysicalSinglePerson_(value, dictionary) {
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
    return chinese + '\n' + text;
  }

  var english = dictionary.chineseToEnglish[key];
  if (english) {
    return text + '\n' + english;
  }

  // Google Docs can collapse a truly blank line in a table cell. Use a small,
  // explicit physical-only marker so the two language rows stay aligned. The
  // public digital API never uses this formatter.
  return /[\u3400-\u9fff]/.test(text) ? text + '\n—' : '—\n' + text;
}

function normalizePhysicalNameKey_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function movePrintedBulletinToConfiguredFolder_(documentId) {
  var folderId = getPrintedBulletinOutputFolderId_();
  if (!folderId) {
    return;
  }
  DriveApp.getFileById(documentId).moveTo(DriveApp.getFolderById(folderId));
}

function getPrintedBulletinOutputFolderId_() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PRINTED_BULLETIN_CONFIG.outputFolderProperty,
    ) || PRINTED_BULLETIN_CONFIG.outputFolderId
  );
}

function createOrReplacePrintedBulletinPdf_(documentId, title, propertyKey) {
  var properties = PropertiesService.getScriptProperties();
  var previousPdfId = properties.getProperty(propertyKey);
  var pdfBlob = DocumentApp.openById(documentId)
    .getAs(MimeType.PDF)
    .setName(title + '.pdf');
  var folderId = getPrintedBulletinOutputFolderId_();
  var folder = folderId
    ? DriveApp.getFolderById(folderId)
    : DriveApp.getRootFolder();
  var pdfFile = folder.createFile(pdfBlob);

  if (previousPdfId && previousPdfId !== pdfFile.getId()) {
    try {
      DriveApp.getFileById(previousPdfId).setTrashed(true);
    } catch (error) {
      // A deleted or inaccessible prior PDF should not prevent the new one.
    }
  }

  properties.setProperty(propertyKey, pdfFile.getId());
  return {
    action: previousPdfId ? 'replaced' : 'created',
    id: pdfFile.getId(),
    url: pdfFile.getUrl(),
  };
}

function appendBookletPage_(body, leftRenderer, rightRenderer, isFirstPage, footerRenderer) {
  if (!isFirstPage) {
    body.appendPageBreak();
  }

  var table = body.appendTable([['', '']]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, 368);
  table.setColumnWidth(1, 368);
  var leftCell = table.getCell(0, 0);
  var rightCell = table.getCell(0, 1);
  leftCell.clear();
  rightCell.clear();
  leftCell.setPaddingBottom(0);
  rightCell.setPaddingBottom(0);
  leftRenderer(leftCell);
  rightRenderer(rightCell);

  if (footerRenderer) {
    var rule = body.appendHorizontalRule();
    var ruleParent = rule.getParent();
    if (ruleParent && ruleParent.getType() === DocumentApp.ElementType.PARAGRAPH) {
      ruleParent.asParagraph().setLineSpacing(1);
      ruleParent.asParagraph().setSpacingBefore(0);
      ruleParent.asParagraph().setSpacingAfter(0);
    }
    var footerTable = body.appendTable([['', '']]);
    footerTable.setBorderWidth(0);
    footerTable.setColumnWidth(0, 368);
    footerTable.setColumnWidth(1, 368);
    var footerLeftCell = footerTable.getCell(0, 0);
    var footerRightCell = footerTable.getCell(0, 1);
    footerLeftCell.clear();
    footerRightCell.clear();
    footerLeftCell.setPaddingTop(0);
    footerLeftCell.setPaddingBottom(0);
    footerRightCell.setPaddingTop(0);
    footerRightCell.setPaddingBottom(0);
    footerLeftCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
    footerRightCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
    footerRenderer(footerLeftCell, footerRightCell);
  }
}

function appendCoverPanel_(cell, bulletin, format) {
  appendSharedCoverPanel_(cell, bulletin, format);
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

function appendCoverMeetingSchedule_(cell) {
  appendSpacer_(cell);
  [
    ['安息日學（週六）', 'Sabbath School (Sat): 10:00 am - 11:25 am'],
    ['聖日崇拜（週六）', 'Divine Worship (Sat): 11:30 am - 01:00 pm'],
    ['青年團契（週六）', 'Youth Fellowship (Sat): 02:00 pm - 03:30 pm'],
    ['法拉盛團契（週四）', 'Flushing Fellowship (Thurs): 07:00 pm - 09:00 pm'],
  ].forEach(function (line) {
    var paragraph = cell.appendParagraph(line[0] + '  ' + line[1]);
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    styleText_(paragraph.editAsText(), 8, false);
  });
  appendSpacer_(cell);
}

function appendCoverWelcomeBlock_(cell) {
  appendCenteredText_(cell, '歡迎各界人士來研究聖經，崇拜上帝，與祂主恩', 9, true);
  appendCenteredText_(cell, 'All Are Welcome to Our Meetings', 10, true);
  appendCenteredText_(cell, '76-06 41st Avenue, Elmhurst, NY 11373-1030', 8, false);
  appendCenteredText_(cell, 'Telephone: 1-718-205-8618', 8, false);
}

function appendAnnouncementsPanel_(cell, bulletin, nextBulletin) {
  // Printed bulletins may contain the full, human-approved announcement block.
  // Keep this separate from the mobile bulletin: announcements are intentionally
  // not rendered digitally because their content and formatting are fluid and
  // they are already delivered in person and on the livestream.
  appendCenteredText_(cell, 'Announcements | 報告事項', 10.5, true);
  appendPrintedAnnouncementsTable_(
    cell,
    getPhysicalPrintedAnnouncementEntries_(bulletin, 'queens'),
  );
  appendScheduleTable_(cell, bulletin, nextBulletin);
}

function appendPrintedAnnouncementsTable_(cell, entries) {
  entries = entries || [];
  if (!entries.length) {
    return;
  }

  // Keep the submitted announcement text verbatim. The table only changes
  // presentation: a wider English column, matching row heights, and a smaller
  // font for unusually long rows when the available page area is tight.
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
    var rowFontSize = getPrintedAnnouncementRowFontSize_(entry);
    [entry.chinese, entry.english].forEach(function (text, columnIndex) {
      var numberedText = formatPrintedAnnouncementNumberedText_(text, rowIndex);
      var tableCell = row.getCell(columnIndex);
      tableCell.clear();
      tableCell.setPaddingTop(2);
      tableCell.setPaddingBottom(2);
      tableCell.setPaddingLeft(1);
      tableCell.setPaddingRight(1);
      tableCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
      appendPrintedAnnouncementTableCell_(tableCell, numberedText, rowFontSize);
    });
  });
}

function formatPrintedAnnouncementNumberedText_(value, rowIndex) {
  var text = String(value || '').trim();
  return text ? String(Number(rowIndex) + 1) + '. ' + text : '';
}

function appendPrintedAnnouncementTableCell_(cell, value, fontSize) {
  var text = protectPrintedChinesePunctuation_(String(value || '').trim());
  if (!text) {
    return;
  }
  var paragraph = cell.appendParagraph(text);
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  paragraph.setLineSpacing(1.25);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  var rendered = paragraph.editAsText();
  styleText_(rendered, fontSize, false);
  var firstSentenceLength = getFirstPrintedAnnouncementSentenceLength_(text);
  if (firstSentenceLength > 0) {
    rendered.setBold(0, firstSentenceLength - 1, true);
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

function getPrintedAnnouncementRowFontSize_(entry) {
  var chineseLines = estimatePrintedAnnouncementLines_(entry && entry.chinese);
  var englishLines = estimatePrintedAnnouncementLines_(entry && entry.english);
  var estimatedLines = Math.max(chineseLines, englishLines);
  if (estimatedLines > 24) {
    return 6.5;
  }
  if (estimatedLines > 19) {
    return 7;
  }
  if (estimatedLines > 15) {
    return 7.5;
  }
  if (estimatedLines > 12) {
    return 8;
  }
  return 8.5;
}

function estimatePrintedAnnouncementLines_(value) {
  var text = String(value || '').trim();
  if (!text) {
    return 0;
  }
  return text.split(/\r?\n/).reduce(function (total, line) {
    var widthUnits = Array.prototype.reduce.call(line, function (sum, character) {
      return sum + (/^[\u3400-\u9fff]$/.test(character) ? 1 : 0.5);
    }, 0);
    return total + Math.max(1, Math.ceil(widthUnits / 34));
  }, 0);
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

function appendPrintedAnnouncement_(cell, entry) {
  [entry && entry.chinese, entry && entry.english].forEach(function (text) {
    text = String(text || '').trim();
    if (!text) {
      return;
    }
    var paragraph = cell.appendParagraph(text);
    paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
    paragraph.setLineSpacing(1.25);
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    var rendered = paragraph.editAsText();
    styleText_(rendered, 9, false);
    var firstSentenceLength = getFirstPrintedAnnouncementSentenceLength_(text);
    if (firstSentenceLength > 0) {
      rendered.setBold(0, firstSentenceLength - 1, true);
    }
  });
  appendSpacer_(cell);
}

function getFirstPrintedAnnouncementSentenceLength_(text) {
  var value = String(text || '');
  if (!value) {
    return 0;
  }
  var match = value.match(/^[\s\S]*?[.!?。！？](?:["'’”」』）)]*)/);
  return match ? match[0].length : value.length;
}

function appendGivingFooter_(leftCell, rightCell) {
  appendGivingText_(leftCell);
  appendGivingQrPlaceholders_(rightCell);
}

function appendGivingText_(cell) {
  appendCompactCenteredText_(
    cell,
    'Tithes & Offerings | 什一奉獻與自由奉獻',
    10.5,
    true,
  );
  appendHalfSpacer_(cell);
  appendCenteredText_(
    cell,
    printedBilingualText_(
      'Cash offerings: for a tax-deductible receipt, use a church envelope and write your name in English.',
      '現金奉獻：如需可扣稅收據，請使用教會奉獻信封並以英文寫上姓名。',
    ),
    8.5,
    false,
  );
  appendHalfSpacer_(cell);
  appendCenteredText_(
    cell,
    'Stocks/equities: We recommend donor-advised funds; see our church\'s mobile app or contact treasury@nyccsda.org. Nonprofit EIN: 11-3004814.',
    8.5,
    false,
  );
}

function appendGivingQrPlaceholders_(cell) {
  var table = cell.appendTable([['', '', '']]);
  table.setBorderWidth(0);
  [
    { label: printedBilingualText_('Download Mobile App', '下載手機應用程式'), kind: 'mobileApp' },
    {
      label: printedBilingualText_('Zelle® (zelle@nyccsda.org)', 'Zelle® 轉賬'),
      kind: 'zelle',
    },
    {
      label: printedBilingualText_('ACH or card', 'ACH／信用卡'),
      kind: 'adventistGiving',
    },
  ].forEach(function (item, index) {
    var width = 120;
    table.setColumnWidth(index, width);
    var tableCell = table.getCell(0, index);
    tableCell.clear();
    tableCell.setPaddingTop(3);
    tableCell.setPaddingBottom(3);
    var fileId = getPrintedBulletinQrImageFileId_(item.kind);
    if (fileId) {
      try {
        var image = tableCell.appendImage(DriveApp.getFileById(fileId).getBlob());
        var imageWidth = image.getWidth();
        var imageHeight = image.getHeight();
        var maxWidth = 58;
        if (imageWidth > maxWidth) {
          image.setWidth(maxWidth);
          image.setHeight(Math.round((imageHeight * maxWidth) / imageWidth));
        }
        centerPrintedBulletinImage_(image);
      } catch (error) {
        Logger.log(item.label + ' QR image could not be loaded: ' + error);
      }
    }
    appendCompactCenteredText_(tableCell, item.label, 8, true);
  });
}

function getPrintedBulletinQrImageFileId_(kind) {
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
  return configuredFileId || PRINTED_BULLETIN_CONFIG.qrPlaceholderImageFileId;
}

function appendScheduleTable_(cell, bulletin, nextBulletin) {
  var current = bulletin.queens;
  var next = nextBulletin ? nextBulletin.queens : null;
  appendHorizontalScheduleTable_(cell, current, next, [
    [printedBilingualText_('SS Pianist', '安息日學鋼琴'), function (location) { return location.pianist; }],
    [printedBilingualText_('SS Teacher E.', '安息日學英文老師'), function (location) { return location.englishTeacher; }],
    [printedBilingualText_('SS Teacher C.', '安息日學中文老師'), function (location) { return location.chineseTeacher; }],
    [printedBilingualText_('DS Chair', '崇拜主席'), function (location) { return location.chairPastoralPrayer; }],
    [printedBilingualText_('DS Pianist', '崇拜鋼琴'), function (location) { return location.pianist; }],
    [printedBilingualText_('Offering Prayer', '奉獻禱告'), function (location) { return location.offeringPrayer; }],
    [printedBilingualText_('DS Sermon', '崇拜證道'), function (location) { return location.sermon; }],
    [printedBilingualText_('DS Interpreter', '崇拜翻譯'), function (location) { return location.translation; }],
    [printedBilingualText_('Special Music', '特別音樂'), function (location) { return location.specialMusic; }],
    [printedBilingualText_('Offerings', '奉獻事項'), function (location, data) { return formatPhysicalOfferingValue_(data.tithePurpose); }],
    [printedBilingualText_('Sunset Times', '日落時間'), function (location, data) { return data.sunsetTime; }],
  ], bulletin, nextBulletin);
}

function appendHorizontalScheduleTable_(cell, current, next, entries, currentData, nextData) {
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
    columnWidths: [18, 55, 58, 50, 58, 50, 58],
    alignments: [
      DocumentApp.HorizontalAlignment.LEFT,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
      DocumentApp.HorizontalAlignment.CENTER,
    ],
    fontSize: 7,
    headerFontSize: 7,
    paddingTop: 0,
    paddingBottom: 0,
  });
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

function appendStudyPanel_(cell, bulletin) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    printedBilingualText_('THE CHURCH AT STUDY', '安息日學'),
  );
  appendCenteredText_(cell, PRINTED_BULLETIN_CONFIG.studyTime, 9, false);
  var studyRows = [
    [printedBilingualText_('SS Chair', '安息日學主席'), '', printValue_(location.ssChair)],
    [printedBilingualText_('Opening Prayer', '開會禱告'), '', printValue_(location.ssOpeningPrayer)],
    [printedBilingualText_('Opening Hymn', '開會詩歌'), physicalTbdText_(), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Lesson / Study', '課程／學習'), physicalTbdText_(), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Closing Hymn', '結會詩歌'), physicalTbdText_(), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Closing Prayer', '結會禱告'), '', printValue_(location.closingPrayer)],
  ];
  appendProgramTable_(cell, studyRows);
  appendBibleReadingPanel_(cell, location, true, bulletin.physicalBibleTranslations);
}

function appendWorshipPanel_(cell, bulletin, includeClosingRows) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    printedBilingualText_('THE CHURCH AT WORSHIP', '崇拜聚會'),
  );
  appendCenteredText_(cell, PRINTED_BULLETIN_CONFIG.worshipTime, 9, false);
  var worshipRowsBeforeSermon = [
    [printedBilingualText_('Chairman', '主席'), '', printValue_(location.chairPastoralPrayer)],
    [printedBilingualText_('Doxology', '頌讚'), printedBilingualText_('SDAH 694 — Praise God', '第497首 讚美上帝'), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Invocation', '宣召'), '', printValue_(location.chairPastoralPrayer)],
    [printedBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Bible Reading', '讀經'), formatBibleReferenceForPrint_(location), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Pastoral Prayer', '牧者禱告'), '', printValue_(location.chairPastoralPrayer)],
    [printedBilingualText_('Tithe & Offering', '十一奉獻'), formatPhysicalOfferingValue_(bulletin.tithePurpose), printValue_(location.offeringPrayer)],
    [printedBilingualText_('Special Music', '特別音樂'), '', printValue_(location.specialMusic)],
  ];
  var worshipRowsAfterSermon = [
    [printedBilingualText_('Hymn of Response', '回應詩'), formatHymnForPrint_(location.hymnOfResponse), printedBilingualText_('Congregation', '會眾')],
  ];
  var sermonRow = [
    printedBilingualText_('Sermon', '講道'),
    formatSermonTitleForPrint_(location),
    printValue_(location.sermon),
  ];
  if (includeClosingRows) {
    worshipRowsAfterSermon.push([
      printedBilingualText_('Benediction', '祝禱'),
      '',
      printValue_(location.sermon),
    ]);
    worshipRowsAfterSermon.push([
      printedBilingualText_('Postlude', '後奏'),
      printedBilingualText_('SDAH 690 — Dismiss Us, Lord', '第504首 散會頌'),
      printedBilingualText_('Congregation', '會眾'),
    ]);
  }
  appendProgramTable_(cell, worshipRowsBeforeSermon);
  appendSermonRow_(cell, sermonRow);
  appendProgramTable_(cell, worshipRowsAfterSermon);
  if (includeClosingRows) {
    appendSilentPrayerHeading_(cell, 'Silent Prayer', '請默禱之後散會');
  }
}

function appendFootWashingPanel_(cell, bulletin) {
  appendPanelHeading_(
    cell,
    printedBilingualText_('FOOT WASHING', '洗腳禮'),
    getPrintedCommunionFootWashingScripture_(),
  );
  appendProgramTable_(cell, [
    [printedBilingualText_('Bible Readings', '讀經'), getPrintedCommunionFootWashingScripture_(), printedBilingualText_('Congregation', '會眾')],
  ]);
  appendPrintedCommunionPassageBox_(cell, bulletin, 'footWashing');
  appendProgramTable_(cell, [
    [printedBilingualText_('Foot Washing', '洗腳禮'), '', getPrintedCommunionWholeCongregation_()],
  ]);
  appendSpacer_(cell);
  appendCompactItalicCenteredText_(cell, getPrintedCommunionFootWashingInstruction_(), 8.5);
}

function appendCommunionPanel_(cell, bulletin) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    printedBilingualText_('HOLY COMMUNION', '聖餐禮'),
    getPrintedCommunionServiceScripture_(),
  );
  appendProgramTable_(cell, [
    [printedBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Bible Reading', '讀經'), getPrintedCommunionServiceScripture_(), printedBilingualText_('Congregation', '會眾')],
  ]);
  appendPrintedCommunionPassageBox_(cell, bulletin, 'communion');
}

function appendCommunionActionsPanel_(cell, bulletin, locationKey) {
  var location = bulletin[locationKey || 'queens'];
  appendProgramTable_(cell, [
    [printedBilingualText_('Blessing the Bread', '分餅祝福禱告'), '', printValue_(location.chairPastoralPrayer)],
    [printedBilingualText_('Breaking the Bread', '分餅'), '', printValue_(location.sermon)],
  ]);
  appendPrintedCommunionReadingPassageBox_(cell, bulletin, 0);
  appendProgramTable_(cell, [
    [printedBilingualText_('Prayer of Silence', '默禱'), '', printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Blessing the Cup', '分杯祝福禱告'), '', printValue_(location.chairPastoralPrayer)],
    [printedBilingualText_('Share the Cup', '分杯'), '', printValue_(location.sermon)],
  ]);
  appendPrintedCommunionReadingPassageBox_(cell, bulletin, 1);
  appendProgramTable_(cell, [
    [printedBilingualText_('Prayer of Silence', '默禱'), '', printedBilingualText_('Congregation', '會眾')],
  ]);
  appendPrintedCommunionReadingPassageBox_(cell, bulletin, 2);
}

function appendPanelHeading_(cell, title, subtitle) {
  appendCenteredText_(cell, title, 15, true);
  if (subtitle) {
    appendCenteredText_(cell, subtitle, 9, false);
  }
  appendSpacer_(cell);
}

function appendSectionHeading_(cell, text) {
  appendCenteredText_(cell, text, 11, true);
  appendSpacer_(cell);
}

function appendSilentPrayerHeading_(cell, english, traditionalChinese) {
  appendSpacer_(cell);
  appendCompactItalicCenteredText_(
    cell,
    '† ' + english + ' | ' + traditionalChinese + ' †',
    8.5,
  );
}

function appendCenteredText_(cell, text, size, bold) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (line) {
      var paragraph = cell.appendParagraph(line);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      paragraph.setLineSpacing(1.25);
      paragraph.setSpacingBefore(0);
      paragraph.setSpacingAfter(0);
      styleText_(paragraph.editAsText(), size, bold);
    });
}

function appendCompactCenteredText_(cell, text, size, bold) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (line) {
      var paragraph = cell.appendParagraph(line);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      paragraph.setLineSpacing(1);
      paragraph.setSpacingBefore(0);
      paragraph.setSpacingAfter(0);
      styleText_(paragraph.editAsText(), size, bold);
    });
}

function appendCompactItalicCenteredText_(cell, text, size) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (line) {
      var paragraph = cell.appendParagraph(line);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      paragraph.setLineSpacing(1);
      paragraph.setSpacingBefore(0);
      paragraph.setSpacingAfter(0);
      var rendered = paragraph.editAsText();
      styleText_(rendered, size, false);
      rendered.setItalic(true);
    });
}

function appendBodyText_(cell, text) {
  var paragraph = cell.appendParagraph(String(text || ''));
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  paragraph.setLineSpacing(1.25);
  paragraph.setSpacingBefore(0);
  paragraph.setSpacingAfter(0);
  styleText_(paragraph.editAsText(), 9, false);
}

function appendSpacer_(cell) {
  var paragraph = cell.appendParagraph(' ');
  paragraph.setLineSpacing(1.25);
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

function appendInfoTable_(cell, rows) {
  appendDataTable_(
    cell,
    [[printedBilingualText_('Item', '項目'), printedBilingualText_('Details', '內容')]].concat(rows),
  );
}

function appendProgramTable_(cell, rows) {
  var table = cell.appendTable(
    rows.map(function (row) {
      return row.map(function (value) {
        return String(value === null || typeof value === 'undefined' ? '' : value);
      });
    }),
  );
  table.setBorderWidth(0);
  table.setColumnWidth(0, 105);
  table.setColumnWidth(1, 160);
  table.setColumnWidth(2, 95);
  rows.forEach(function (row, rowIndex) {
    var tableRow = table.getRow(rowIndex);
    for (var columnIndex = 0; columnIndex < 3; columnIndex += 1) {
      var tableCell = tableRow.getCell(columnIndex);
      tableCell.setPaddingTop(0.5);
      tableCell.setPaddingBottom(0.5);
      styleTableCell_(
        tableCell,
        9,
        false,
        columnIndex === 0
          ? DocumentApp.HorizontalAlignment.LEFT
          : columnIndex === 1
            ? DocumentApp.HorizontalAlignment.CENTER
            : DocumentApp.HorizontalAlignment.RIGHT,
      );
    }
  });
}

function appendSermonRow_(cell, row) {
  var table = cell.appendTable([
    row.map(function (value) {
      return String(value === null || typeof value === 'undefined' ? '' : value);
    }),
  ]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, 105);
  table.setColumnWidth(1, 160);
  table.setColumnWidth(2, 95);
  for (var columnIndex = 0; columnIndex < 3; columnIndex += 1) {
    var tableCell = table.getCell(0, columnIndex);
    tableCell.setPaddingTop(1.5);
    tableCell.setPaddingBottom(1.5);
    styleTableCell_(
      tableCell,
      9,
      columnIndex === 1,
      columnIndex === 0
        ? DocumentApp.HorizontalAlignment.LEFT
        : columnIndex === 1
          ? DocumentApp.HorizontalAlignment.CENTER
          : DocumentApp.HorizontalAlignment.RIGHT,
    );
  }
}

function appendBibleReadingPanel_(cell, location, showPlaceholder, bibleTranslations) {
  var reference = formatBibleReferenceForPrint_(location);
  if ((!reference || isPhysicalTbd_(reference)) && !showPlaceholder) {
    return;
  }

  var verseText = location.bibleVerseText || {};
  var referenceLabels = formatPhysicalBibleReferenceLabels_(location, bibleTranslations);
  var table = cell.appendTable([
    ['今日經文', "Today's Verse"],
    [referenceLabels.chinese, referenceLabels.english],
    [verseText.chinese || referenceLabels.chinese, verseText.english || referenceLabels.english],
  ]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, 170);
  table.setColumnWidth(1, 190);

  var alignments = [
    [DocumentApp.HorizontalAlignment.CENTER, DocumentApp.HorizontalAlignment.CENTER],
    [DocumentApp.HorizontalAlignment.CENTER, DocumentApp.HorizontalAlignment.CENTER],
    [DocumentApp.HorizontalAlignment.LEFT, DocumentApp.HorizontalAlignment.LEFT],
  ];
  for (var rowIndex = 0; rowIndex < 3; rowIndex += 1) {
    var row = table.getRow(rowIndex);
    for (var columnIndex = 0; columnIndex < 2; columnIndex += 1) {
      styleTableCell_(
        row.getCell(columnIndex),
        rowIndex === 0 ? 9 : rowIndex === 1 ? 9 : 9,
        rowIndex < 2,
        alignments[rowIndex][columnIndex],
      );
      if (rowIndex < 2) {
        var headerParagraph = row.getCell(columnIndex).getChild(0).asParagraph();
        var headerText = headerParagraph.editAsText();
        if (headerText.getText().length > 0) {
          headerText.setBold(0, headerText.getText().length - 1, true);
        }
      }
      row.getCell(columnIndex).setPaddingTop(0);
      row.getCell(columnIndex).setPaddingBottom(0);
    }
  }
}

function appendQueensClosingRows_(cell, bulletin) {
  var location = bulletin.queens;
  appendProgramTable_(cell, [
    [
      printedBilingualText_('Benediction', '祝禱'),
      '',
      printValue_(location.sermon),
    ],
    [
      printedBilingualText_('Postlude', '後奏'),
      printedBilingualText_('SDAH 690 — Dismiss Us, Lord', '第504首 散會頌'),
      printedBilingualText_('Congregation', '會眾'),
    ],
  ]);
  appendSilentPrayerHeading_(cell, 'Silent Prayer', '請默禱之後散會');
}

function appendBrooklynClosingRows_(cell, bulletin) {
  var location = bulletin.brooklyn;
  appendProgramTable_(cell, [
    [
      printedBilingualText_('Benediction', '散會禱告'),
      '',
      printValue_(location.sermon),
    ],
    [
      printedBilingualText_('Postlude', '後奏曲'),
      printedBilingualText_('SDAH 690 — Dismiss Us, Lord', '第504首 散會頌'),
      printedBilingualText_('Congregation', '會眾'),
    ],
  ]);
  appendSilentPrayerHeading_(cell, 'Silent Prayer', '請默禱之後散會');
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
      styleTableCell_(
        tableCell,
        rowIndex === 0 ? options.headerFontSize || 8 : options.fontSize || 8,
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
    paragraph.setLineSpacing(1.25);
    paragraph.setSpacingBefore(0);
    paragraph.setSpacingAfter(0);
    styleText_(paragraph.editAsText(), size, bold);
  }
}

function styleText_(text, size, bold) {
  text.setFontFamily('Times New Roman');
  text.setFontSize(size);
  text.setBold(Boolean(bold));
}

function physicalTbdText_(traditionalChinese) {
  return printedBilingualText_('TBD', traditionalChinese || '尚未確定');
}

function formatHymnForPrint_(hymn) {
  hymn = hymn || {};
  var english = String(hymn.english || '').trim();
  var chinese = String(hymn.chinese || '').trim();
  if (isPhysicalTbd_(english) || isPhysicalTbd_(chinese)) {
    return physicalTbdText_();
  }
  if (english && chinese && english !== chinese) {
    return printedBilingualText_(english, chinese);
  }
  return english || chinese || physicalTbdText_();
}

function formatBibleReferenceForPrint_(location) {
  var reference = String((location && location.bibleVerses) || '').trim();
  return !reference || isPhysicalTbd_(reference) ? physicalTbdText_() : reference;
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
      : englishTitle || chineseTitle
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
