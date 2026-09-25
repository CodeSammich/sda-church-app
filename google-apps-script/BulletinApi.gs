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
  intakeSheetName: 'Sabbath Sermon Data',
  cacheSeconds: 120,
  // Bump when the public bulletin shape or source contract changes so cached
  // pre-migration responses do not hide newly added roster fields.
  cacheVersion: 'v7',
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

// Sabbath Sermon Data is the reviewed, staff-managed source for sermon content.
// These headers are intentionally concise so final owners can correct a week's
// content directly without an append-only response workflow.
var BULLETIN_INTAKE_SCHEMA = Object.freeze([
  { headers: ['English Hymn of Praise'], path: ['hymnOfPraise', 'english'] },
  { headers: ['Chinese Hymn of Praise'], path: ['hymnOfPraise', 'chinese'] },
  { headers: ['English Sermon Title'], path: ['sermonTitle', 'english'] },
  { headers: ['Chinese Sermon Title'], path: ['sermonTitle', 'chinese'] },
  { headers: ['English Hymn of Response'], path: ['hymnOfResponse', 'english'] },
  { headers: ['Chinese Hymn of Response'], path: ['hymnOfResponse', 'chinese'] },
  { headers: ['Bible Verses'], path: ['bibleVerses'] },
]);

// These first-row headers are a versioned interface between the spreadsheet,
// Apps Script, and the mobile app. If a header is added, removed, renamed, or
// reordered, update all three consumers before changing the sheet.
var BULLETIN_HEADER_CONTRACTS = Object.freeze({
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
  'Sabbath Sermon Data': Object.freeze([
    'Date',
    'Location',
    'English Hymn of Praise',
    'Chinese Hymn of Praise',
    'English Sermon Title',
    'Chinese Sermon Title',
    'English Hymn of Response',
    'Chinese Hymn of Response',
    'Bible Verses',
  ]),
});

var BULLETIN_HEADER_CONTRACT_HELP_TEXT =
  'Fixed bulletin column. Before adding, removing, renaming, or reordering columns, update Apps Script and the mobile app first. / 固定週刊欄位。新增、刪除、重新命名或重新排序欄位前，請先更新 Apps Script 和手機應用程式。';

function getBulletinHeaderContractIssues_(spreadsheet) {
  var issues = [];
  Object.keys(BULLETIN_HEADER_CONTRACTS).forEach(function (sheetName) {
    var sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      issues.push('Missing required sheet: ' + sheetName);
      return;
    }

    var expected = BULLETIN_HEADER_CONTRACTS[sheetName];
    var actual = readTable_(sheet).headers;
    var width = Math.max(expected.length, actual.length);
    for (var index = 0; index < width; index += 1) {
      var expectedHeader = expected[index] || '';
      var actualHeader = actual[index] || '';
      if (normalizeHeader_(actualHeader) !== normalizeHeader_(expectedHeader)) {
        issues.push(
          sheetName + '! column ' + (index + 1) + ' must be "' + expectedHeader +
            '" (found "' + actualHeader + '")',
        );
      }
    }
  });
  return issues;
}

function assertBulletinHeaderContracts_(spreadsheet) {
  var issues = getBulletinHeaderContractIssues_(spreadsheet);
  if (issues.length) {
    throw new Error(
      'Bulletin column contract violation. Update Apps Script and the mobile app before editing these headers. / ' +
        '週刊欄位契約違規。編輯這些欄位標題前，請先更新 Apps Script 和手機應用程式。\n' +
        issues.join('\n'),
    );
  }
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
  assertBulletinHeaderContracts_(spreadsheet);
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

    var scheduleValue = valueForHeader_(
      scheduleTable.headers,
      scheduleRow,
      field.header,
      occurrence,
    );
    var value = scheduleValue;

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

  // Sabbath Sermon Data is the sole reviewed content source for both locations.
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
      if (!isBlank_(value)) {
        setPath_(location, field.path, displayValue_(value));
      }
    });
  });
}

function getBulletinIntakeRows_(spreadsheet, requestedDate, location) {
  var sheet = spreadsheet.getSheetByName(CONFIG.intakeSheetName);
  if (!sheet) {
    return null;
  }

  var table = readTable_(sheet);
  var dateColumn = findFirstHeaderIndex_(table.headers, ['Date']);
  var locationColumn = findFirstHeaderIndex_(table.headers, ['Location']);
  if (dateColumn === -1 || locationColumn === -1) {
    throw new Error(
      CONFIG.intakeSheetName + ' must contain Date and Location columns',
    );
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

function valueForHeader_(headers, row, expectedHeader, occurrence) {
  var wanted = normalizeHeader_(expectedHeader);
  var seen = 0;

  for (var index = 0; index < headers.length; index += 1) {
    if (normalizeHeader_(headers[index]) !== wanted) {
      continue;
    }
    if (seen === occurrence) {
      return row[index];
    }
    seen += 1;
  }

  return '';
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
