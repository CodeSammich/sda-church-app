/**
 * Bulletin API for the SDA Church mobile app.
 * Canonical source:
 * https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/blob/main/google-apps-script/BulletinApi.gs
 *
 * Deployment settings:
 *   Type: Web app
 *   Execute as: Me (the deploying account)
 *   Who has access: Anyone
 *
 * Production endpoint:
 * https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec
 *
 * Example request: append ?date=2026-08-08 to the production endpoint.
 */

var CONFIG = Object.freeze({
  scheduleSheetName: 'Sabbath Calendar',
  // Replaced the 'Sabbath Sermon Data' tab in #558.
  intakeSheetName: 'Weekly Data',
  cacheSeconds: 120,
  // Bump when the public bulletin shape or source contract changes so cached
  // pre-migration responses do not hide newly added roster fields.
  cacheVersion: 'v8',
  dateHeaders: ['Date', 'Service Date', 'Sabbath Date', 'What date is this Sabbath?'],
});

// The order is intentional: it disambiguates the duplicated Queens/Brooklyn
// headers in the spreadsheet.
var COLUMN_SCHEMA = Object.freeze([
  { header: 'Date', path: ['date'] },
  { header: 'Quarter', path: ['quarter'] },
  { header: 'Special Remark', path: ['specialRemark'] },
  { header: 'Tithe Purpose', path: ['tithePurpose'] },
  { header: 'Pastor Travel', path: ['pastorTravel'] },
  { header: 'Announcements', path: ['announcements'] },
  { header: 'Sunset Time', path: ['sunsetTime'] },
  { header: 'Queens Sermon', path: ['queens', 'sermon'], person: true },
  { header: 'Translation', path: ['queens', 'translation'], person: true },
  { header: 'Chinese Teacher', path: ['queens', 'chineseTeacher'], person: true },
  { header: 'English Teacher', path: ['queens', 'englishTeacher'], person: true },
  { header: 'Youth Teacher', path: ['queens', 'youthTeacher'], person: true },
  { header: 'Kids Teacher', path: ['queens', 'kidsTeacher'], person: true },
  {
    header: 'Chair/Pastoral Prayer',
    path: ['queens', 'chairPastoralPrayer'],
    person: true,
  },
  { header: 'Special Music', path: ['queens', 'specialMusic'], person: true },
  { header: 'Offering Prayer', path: ['queens', 'offeringPrayer'], person: true },
  { header: 'Pianist', path: ['queens', 'pianist'], person: true },
  { header: 'SS Chair', path: ['queens', 'ssChair'], person: true },
  {
    header: 'SS Opening Prayer',
    path: ['queens', 'ssOpeningPrayer'],
    person: true,
  },
  // Keep `closingPrayer` in the public object for backwards compatibility;
  // the spreadsheet header makes its Sabbath School role explicit.
  { header: 'SS Closing Prayer', path: ['queens', 'closingPrayer'], person: true },
  { header: 'Flower Offering', path: ['queens', 'flowerOffering'], person: true },
  { header: 'Brooklyn Sermon', path: ['brooklyn', 'sermon'], person: true },
  {
    header: 'Chair/Pastoral Prayer',
    path: ['brooklyn', 'chairPastoralPrayer'],
    person: true,
  },
  { header: 'Offering Prayer', path: ['brooklyn', 'offeringPrayer'], person: true },
  { header: 'Technician', path: ['brooklyn', 'technician'], person: true },
  { header: 'Encouragement', path: ['brooklyn', 'encouragement'], person: true },
  { header: 'Sabbath School', path: ['brooklyn', 'sabbathSchool'], person: true },
]);

var SAFE_SINGLE_VALUES = Object.freeze([
  'choir',
  'tbd',
  'n/a',
  'na',
  'none',
  'vacant',
  'open',
  '-',
]);

var PRIVATE_NAME_PLACEHOLDER = 'Name withheld';

// Weekly Data is the reviewed, staff-managed source for sermon content.
// These headers are intentionally concise so final owners can correct a week's
// content directly without an append-only response workflow.
var BULLETIN_INTAKE_SCHEMA = Object.freeze([
  { headers: ['Bible Verses'], path: ['bibleVerses'] },
  { headers: ['English Sermon Title'], path: ['sermonTitle', 'english'] },
  { headers: ['Chinese Sermon Title'], path: ['sermonTitle', 'chinese'] },
  // One hymn per cell, typed in either language. They're sung again as the
  // closing hymns, so there's no closing-hymn column.
  { headers: ['Sabbath School Hymn 1'], path: ['sabbathSchoolHymns', 0] },
  { headers: ['Sabbath School Hymn 2'], path: ['sabbathSchoolHymns', 1] },
  { headers: ['Sabbath School Hymn 3'], path: ['sabbathSchoolHymns', 2] },
  // One cell each, typed in either language like the Sabbath School hymns,
  // and filed under the language it's written in. The hymnal lookup fills in
  // the other.
  { headers: ['Hymn of Praise'], path: ['hymnOfPraise'], hymn: true },
  // The piece performed. Who performs it is the Sabbath Calendar's Special Music.
  { headers: ['Special Music Title'], path: ['specialMusicTitle'] },
  { headers: ['Hymn of Response'], path: ['hymnOfResponse'], hymn: true },
  // Until #558 each of those had an English and a Chinese column. A tab that
  // still has them is read the same way.
  { headers: ['English Hymn of Praise'], path: ['hymnOfPraise', 'english'] },
  { headers: ['Chinese Hymn of Praise'], path: ['hymnOfPraise', 'chinese'] },
  { headers: ['English Hymn of Response'], path: ['hymnOfResponse', 'english'] },
  { headers: ['Chinese Hymn of Response'], path: ['hymnOfResponse', 'chinese'] },
]);

// The columns each tab should have. Every column is read by its header name,
// wherever it is (#558): a column can be moved, and others added, without
// changing anything here. A missing column leaves only its own field blank,
// and opening the spreadsheet names it (getMissingBulletinColumns_). The
// Sabbath Calendar's roster checks find their columns by name too
// (getSchedulePersonColumns_). Its repeated headers can be named with their
// location, or go by which side of Brooklyn Sermon they're on
// (findScheduleColumn_).
var BULLETIN_SHEET_COLUMNS = Object.freeze({
  'Sabbath Calendar': Object.freeze([
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
  ]),
  // The speaker's columns, then the hymns in the order they're sung (#558).
  'Weekly Data': Object.freeze([
    'Date',
    'Location',
    'Bible Verses',
    'English Sermon Title',
    'Chinese Sermon Title',
    'Sabbath School Hymn 1',
    'Sabbath School Hymn 2',
    'Sabbath School Hymn 3',
    'Hymn of Praise',
    'Special Music Title',
    'Hymn of Response',
  ]),
});

// Older names that still count as an expected column.
var BULLETIN_COLUMN_ALTERNATIVES = Object.freeze({
  'Hymn of Praise': Object.freeze(['English Hymn of Praise', 'Chinese Hymn of Praise']),
  'Hymn of Response': Object.freeze(['English Hymn of Response', 'Chinese Hymn of Response']),
});

/**
 * The expected columns a tab is missing, such as "Weekly Data: Bible Verses",
 * or the tab itself. Order and extra columns don't matter. A repeated
 * Sabbath Calendar header is named with its location.
 */
function getMissingBulletinColumns_(spreadsheet) {
  var missing = [];
  Object.keys(BULLETIN_SHEET_COLUMNS).forEach(function (sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      missing.push(sheetName + ' (tab)');
      return;
    }
    var headers = readTable_(sheet).headers;
    var expected = BULLETIN_SHEET_COLUMNS[sheetName];
    var isSchedule = sheetName === CONFIG.scheduleSheetName;
    var brooklynStart = expected.indexOf('Brooklyn Sermon');
    var seen = {};
    expected.forEach(function (header, index) {
      var occurrence = seen[header] || 0;
      seen[header] = occurrence + 1;
      var location = '';
      if (isSchedule && expected.indexOf(header) !== expected.lastIndexOf(header)) {
        location = index >= brooklynStart ? 'brooklyn' : 'queens';
      }
      var found = isSchedule
        ? findScheduleColumn_(headers, header, location, occurrence) !== -1
        : findFirstHeaderIndex_(
            headers,
            [header].concat(BULLETIN_COLUMN_ALTERNATIVES[header] || []),
          ) !== -1;
      if (!found) {
        var label = location ? (location === 'brooklyn' ? 'Brooklyn ' : 'Queens ') + header : header;
        missing.push(sheetName + ': ' + label);
      }
    });
  });
  return missing;
}

function doGet(event) {
  try {
    var requestedDate = getRequestedDate_(event);
    var bulletin = getBulletin_(requestedDate);

    return jsonResponse_({ ok: true, bulletin: bulletin });
  } catch (error) {
    return jsonResponse_({
      ok: false,
      error: error && error.message ? error.message : String(error),
    });
  }
}

function getBulletin_(requestedDate) {
  var cache = CacheService.getScriptCache();
  var cacheKey = 'bulletin:' + CONFIG.cacheVersion + ':' + requestedDate;

  var cachedJson = cache.get(cacheKey);
  if (cachedJson) {
    return JSON.parse(cachedJson);
  }

  var bulletin = buildBulletin_(requestedDate);
  cache.put(cacheKey, JSON.stringify(bulletin), CONFIG.cacheSeconds);
  return bulletin;
}

function buildBulletin_(requestedDate, options) {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var scheduleSheetName = getScheduleSheetName_(requestedDate);
  var scheduleSheet = spreadsheet.getSheetByName(scheduleSheetName);

  if (!scheduleSheet) {
    throw new Error('Schedule sheet not found: ' + scheduleSheetName);
  }

  var scheduleTable = readTable_(scheduleSheet);
  var scheduleRow = findDateRow_(scheduleTable, requestedDate);

  if (!scheduleRow) {
    throw new Error('No schedule found for ' + requestedDate);
  }

  var bulletin = {
    date: requestedDate,
    quarter: '',
    specialRemark: '',
    tithePurpose: '',
    pastorTravel: '',
    announcements: '',
    sunsetTime: '',
    queens: createLocation_(),
    brooklyn: createLocation_(),
  };

  var headerOccurrences = {};
  COLUMN_SCHEMA.forEach(function (field) {
    var normalizedHeader = normalizeHeader_(field.header);
    var occurrence = headerOccurrences[normalizedHeader] || 0;
    headerOccurrences[normalizedHeader] = occurrence + 1;

    if (field.path.length === 1 && field.path[0] === 'date') {
      return;
    }

    var column = findScheduleColumn_(
      scheduleTable.headers,
      field.header,
      field.path.length > 1 ? field.path[0] : '',
      occurrence,
    );
    var value = column === -1 ? '' : scheduleRow[column];

    if (field.person && !(options && options.includeFullNames)) {
      value = redactNameValue_(value);
    } else {
      value = displayValue_(value);
    }

    setPath_(bulletin, field.path, value);
  });

  // The public bulletin data follows the same field/order contract as the
  // printed Brooklyn bulletin. The mobile UI intentionally renders only the
  // useful subset: redundant fields and fields that are usually TBD remain
  // available for print/admin compatibility but are omitted from the mobile
  // presentation so they do not become dead UI. Person names are always
  // privacy-redacted in the public app to reduce the risk of exposing more
  // personal information than necessary; only the authorized physical-print
  // workflow may request full names.
  populateOptionalBrooklynScheduleFields_(
    bulletin.brooklyn,
    scheduleTable.headers,
    scheduleRow,
    Boolean(options && options.includeFullNames),
  );

  // Weekly Data is the sole reviewed content source for both locations.
  // Nonblank values are applied after the schedule join so a final owner can
  // correct sermon material without changing the roster sheet.
  populateBulletinIntake_(
    bulletin.queens,
    getBulletinIntakeRows_(spreadsheet, requestedDate, 'queens'),
  );
  populateBulletinIntake_(
    bulletin.brooklyn,
    getBulletinIntakeRows_(spreadsheet, requestedDate, 'brooklyn'),
  );

  // The public app may localize these three English-only schedule metadata
  // fields. Bible text and Bible references must never pass through
  // LanguageApp; they are handled by the exact HelloAO Bible API paths.
  if (!(options && options.includeFullNames)) {
    bulletin.metadataTranslations = buildBulletinMetadataTranslations_(bulletin);
  }

  return bulletin;
}

var BULLETIN_METADATA_TRANSLATION_TARGETS = Object.freeze({
  zh: 'zh-TW',
  'zh-cn': 'zh-CN',
  es: 'es',
});

function buildBulletinMetadataTranslations_(bulletin) {
  return {
    specialRemark: translateBulletinMetadataValue_(bulletin.specialRemark),
    tithePurpose: translateBulletinMetadataValue_(bulletin.tithePurpose),
    pastorTravel: translateBulletinMetadataValue_(bulletin.pastorTravel),
  };
}

function translateBulletinMetadataValue_(value) {
  var source = displayValue_(value);
  var translations = {
    en: source,
    zh: source,
    'zh-cn': source,
    es: source,
  };

  if (isBlank_(source) || typeof LanguageApp === 'undefined' || !LanguageApp.translate) {
    return translations;
  }

  Object.keys(BULLETIN_METADATA_TRANSLATION_TARGETS).forEach(function (language) {
    try {
      var translated = displayValue_(
        LanguageApp.translate(
          source,
          'en',
          BULLETIN_METADATA_TRANSLATION_TARGETS[language],
        ),
      );
      if (!isBlank_(translated)) {
        translations[language] = translated;
      }
    } catch (error) {
      // A translation quota/service failure must not hide the original English
      // metadata from the bulletin.
      Logger.log('Bulletin metadata translation failed for ' + language + ': ' + error);
    }
  });

  return translations;
}

function populateOptionalBrooklynScheduleFields_(location, headers, row, includeFullNames) {
  [
    {
      aliases: ['Brooklyn Chair', 'Brooklyn Chairman', 'Chair', 'Chairman'],
      path: ['chair'],
      person: true,
    },
    {
      aliases: ['Brooklyn Song Leader', 'Song Leader'],
      path: ['songLeader'],
      person: true,
    },
    {
      aliases: ['Brooklyn Sabbath Message', 'Sabbath Message'],
      path: ['sabbathMessage'],
      person: true,
    },
    {
      aliases: ['Brooklyn Sabbath Message Title', 'Sabbath Message Title'],
      path: ['sabbathMessageTitle'],
    },
    {
      aliases: ['Brooklyn Technician', 'Technician'],
      path: ['technician'],
      person: true,
    },
    {
      aliases: [
        'Brooklyn Encouragement',
        'Encouragement',
        // Preserve older schedule rows while the workbook transitions away
        // from the former Testimonies heading.
        'Brooklyn Testimonies',
        'Testimonies',
      ],
      path: ['encouragement'],
      person: true,
    },
    {
      aliases: ['Brooklyn Sunset Time', 'Brooklyn Sunset Times', 'Sunset Time', 'Sunset Times'],
      path: ['sunsetTime'],
    },
  ].forEach(function (field) {
    var value = valueForAliases_(headers, row, field.aliases);
    if (isBlank_(value)) {
      return;
    }
    setPath_(
      location,
      field.path,
      field.person && !includeFullNames ? redactNameValue_(value) : displayValue_(value),
    );
  });
}

function getScheduleSheetName_(requestedDate) {
  return CONFIG.scheduleSheetName;
}

function createLocation_() {
  return {
    hymnOfPraise: { english: '', chinese: '' },
    sermonTitle: { english: '', chinese: '' },
    hymnOfResponse: { english: '', chinese: '' },
    bibleVerses: '',
    sabbathSchoolHymns: [],
    specialMusicTitle: '',
    announcements: '',
  };
}

function populateBulletinIntake_(location, intakeRows) {
  if (!intakeRows) {
    return;
  }

  // The sheet is intended to have one row per date/location. Supporting
  // multiple matching rows makes the migration safer and gives the latest
  // nonblank owner entry precedence if a duplicate is ever created.
  intakeRows.rows.forEach(function (row) {
    BULLETIN_INTAKE_SCHEMA.forEach(function (field) {
      var value = valueForAliases_(intakeRows.headers, row, field.headers);
      if (isBlank_(value)) {
        return;
      }
      var text = displayValue_(value);
      setPath_(
        location,
        field.hymn ? field.path.concat(getBulletinHymnLanguage_(text)) : field.path,
        text,
      );
    });
  });
  // Keep the entered hymns in order, without the blank cells between them.
  var hymns = [];
  for (var index = 0; index < location.sabbathSchoolHymns.length; index += 1) {
    if (!isBlank_(location.sabbathSchoolHymns[index])) {
      hymns.push(location.sabbathSchoolHymns[index]);
    }
  }
  location.sabbathSchoolHymns = hymns;
}

function getBulletinIntakeRows_(spreadsheet, requestedDate, location) {
  var sheet = spreadsheet.getSheetByName(CONFIG.intakeSheetName);
  if (!sheet) {
    return null;
  }

  var table = readTable_(sheet);
  var dateColumn = findFirstHeaderIndex_(table.headers, ['Date']);
  var locationColumn = findFirstHeaderIndex_(table.headers, ['Location']);
  // Without them no row can be matched, so the week's content stays blank;
  // the rest of the bulletin still loads.
  if (dateColumn === -1 || locationColumn === -1) {
    return null;
  }

  var matchingRows = [];
  table.rows.forEach(function (row, index) {
    if (
      dateMatches_(
        row[dateColumn],
        table.displayRows[index][dateColumn],
        requestedDate,
      ) &&
      normalizeLocationKey_(row[locationColumn]) === location
    ) {
      matchingRows.push({ values: row, sourceIndex: index });
    }
  });

  if (!matchingRows.length) {
    return null;
  }

  var timestampColumn = findFirstHeaderIndex_(table.headers, [
    'Last Updated',
    'Timestamp',
  ]);
  if (timestampColumn !== -1) {
    matchingRows.sort(function (left, right) {
      return (
        toTimestamp_(left.values[timestampColumn]) -
          toTimestamp_(right.values[timestampColumn]) ||
        left.sourceIndex - right.sourceIndex
      );
    });
  }

  return {
    headers: table.headers,
    rows: matchingRows.map(function (row) {
      return row.values;
    }),
  };
}

function normalizeLocationKey_(value) {
  var normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'queens' || normalized === 'queen') {
    return 'queens';
  }
  if (normalized === 'brooklyn') {
    return 'brooklyn';
  }
  return normalized;
}

function readTable_(sheet) {
  var range = sheet.getDataRange();
  var values = range.getValues();
  var displayValues = range.getDisplayValues();
  if (!values.length) {
    throw new Error('Sheet has no header row: ' + sheet.getName());
  }

  return {
    headers: displayValues[0],
    rows: values.slice(1),
    displayRows: displayValues.slice(1),
  };
}

function findDateRow_(table, requestedDate) {
  var dateColumn = findFirstHeaderIndex_(table.headers, CONFIG.dateHeaders);
  if (dateColumn === -1) {
    throw new Error('Schedule sheet is missing a Date column');
  }

  for (var index = 0; index < table.rows.length; index += 1) {
    if (
      dateMatches_(
        table.rows[index][dateColumn],
        table.displayRows[index][dateColumn],
        requestedDate,
      )
    ) {
      return table.rows[index];
    }
  }

  return null;
}

function dateMatches_(rawValue, displayValue, requestedDate) {
  return (
    toIsoDate_(rawValue) === requestedDate || toIsoDate_(displayValue) === requestedDate
  );
}

// Finds a Sabbath Calendar column by its header. Chair/Pastoral Prayer and
// Offering Prayer appear once for each location. A location's copy can be
// named outright, such as "Queens Offering Prayer" or "Brooklyn Chair/Pastoral
// Prayer", and is then found wherever it is. Otherwise it's looked for on its
// own side of Brooklyn Sermon: a column added, moved or removed on one side
// can't shift the other's. Without Brooklyn Sermon, the first copy is Queens's
// and the second Brooklyn's. Other headers are found wherever they are.
function findScheduleColumn_(headers, header, location, occurrence) {
  var wanted = normalizeHeader_(header);
  var expected = BULLETIN_SHEET_COLUMNS[CONFIG.scheduleSheetName];
  var normalized = headers.map(normalizeHeader_);
  if (location && expected.indexOf(header) !== expected.lastIndexOf(header)) {
    var named = normalized.indexOf(normalizeHeader_(location + ' ' + header));
    if (named !== -1) {
      return named;
    }
  }
  var from = 0;
  var to = headers.length;
  var skip = occurrence || 0;
  var brooklynStart = normalized.indexOf('brooklyn sermon');
  if (location && brooklynStart !== -1 && expected.indexOf(header) !== expected.lastIndexOf(header)) {
    if (location === 'brooklyn') {
      from = brooklynStart;
    } else {
      to = brooklynStart;
    }
    skip = 0;
  }
  for (var index = from; index < to; index += 1) {
    if (normalized[index] !== wanted) {
      continue;
    }
    if (skip === 0) {
      return index;
    }
    skip -= 1;
  }
  return -1;
}

// Which side of the bulletin a typed hymn belongs on, as the app reads a
// Sabbath School hymn: Latin letters without Chinese are English; Chinese, or
// a bare number for the Chinese hymnal, is Chinese.
function getBulletinHymnLanguage_(text) {
  return /[A-Za-z]/.test(text) && !/[\u3400-\u9fff]/.test(text) ? 'english' : 'chinese';
}

function valueForAliases_(headers, row, aliases) {
  var index = findFirstHeaderIndex_(headers, aliases);
  return index === -1 ? '' : row[index];
}

function findFirstHeaderIndex_(headers, candidates) {
  var normalizedCandidates = candidates.map(normalizeHeader_);
  for (var index = 0; index < headers.length; index += 1) {
    var normalizedHeader = normalizeHeader_(headers[index]);
    for (
      var candidateIndex = 0;
      candidateIndex < normalizedCandidates.length;
      candidateIndex += 1
    ) {
      var candidate = normalizedCandidates[candidateIndex];
      // Imported spreadsheet headers may include translated text after a
      // newline. Matching a normalized prefix keeps the mapping stable.
      if (
        normalizedHeader === candidate ||
        normalizedHeader.indexOf(candidate + ' ') === 0
      ) {
        return index;
      }
    }
  }
  return -1;
}

/**
 * Converts "First Last" to "First L.". Multiple assignees separated by /, &,
 * +, newlines, or "and" are redacted individually. The literal value "Choir"
 * is preserved. Names that cannot be safely reduced using a Latin-script
 * Latin-script single-token names are treated as first names and preserved.
 * Non-Latin names return a privacy placeholder instead of attempting
 * unreliable transliteration.
 */
function redactNameValue_(value) {
  var text = displayValue_(value).trim();
  if (!text) {
    return '';
  }

  return text
    .split(/(\s*(?:\/|&|\+|\n|\band\b)\s*)/i)
    .map(function (part, index) {
      if (index % 2 === 1) {
        return part.replace(/\s+/g, ' ').trim().toLowerCase() === 'and'
          ? ' and '
          : ' ' + part.trim() + ' ';
      }
      return redactSingleName_(part);
    })
    .join('')
    .trim();
}

function redactSingleName_(value) {
  var text = String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) {
    return '';
  }

  var lowered = text.toLowerCase();
  if (SAFE_SINGLE_VALUES.indexOf(lowered) !== -1) {
    return lowered === 'choir' ? 'Choir' : text;
  }

  var words = text.split(' ');
  if (!isLatinName_(text)) {
    return PRIVATE_NAME_PLACEHOLDER;
  }

  if (words.length === 1) {
    return words[0];
  }

  var initialMatch = words[words.length - 1].match(/[\p{L}\p{N}]/u);
  return words[0] + (initialMatch ? ' ' + initialMatch[0].toUpperCase() + '.' : '');
}

function isLatinName_(value) {
  // Allow Latin letters (including common diacritics), spaces, apostrophes,
  // periods, and hyphens. Any other writing system uses the placeholder.
  return /^[A-Za-z\u00C0-\u024F .'’-]+$/.test(value);
}

function getRequestedDate_(event) {
  var date = event && event.parameter ? event.parameter.date : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || toIsoDate_(date) !== date) {
    throw new Error('A valid date query parameter is required (YYYY-MM-DD)');
  }
  return date;
}

function toIsoDate_(value) {
  if (
    Object.prototype.toString.call(value) === '[object Date]' &&
    !isNaN(value.getTime())
  ) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }

  var text = String(value || '').trim();
  var isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (
    isoMatch &&
    isRealDate_(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]))
  ) {
    return text;
  }

  var usMatch = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (
    usMatch &&
    isRealDate_(Number(usMatch[3]), Number(usMatch[1]), Number(usMatch[2]))
  ) {
    return [usMatch[3], pad2_(usMatch[1]), pad2_(usMatch[2])].join('-');
  }

  return '';
}

function isRealDate_(year, month, day) {
  var date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function toTimestamp_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return value.getTime();
  }
  var parsed = new Date(value).getTime();
  return isNaN(parsed) ? 0 : parsed;
}

function pad2_(value) {
  return ('0' + value).slice(-2);
}

function normalizeHeader_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function displayValue_(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  }
  return String(value).trim();
}

function isBlank_(value) {
  return value === null || typeof value === 'undefined' || String(value).trim() === '';
}

function setPath_(target, path, value) {
  var cursor = target;
  for (var index = 0; index < path.length - 1; index += 1) {
    cursor[path[index]] = cursor[path[index]] || {};
    cursor = cursor[path[index]];
  }
  cursor[path[path.length - 1]] = value;
}

function jsonResponse_(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
