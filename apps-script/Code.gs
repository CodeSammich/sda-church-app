/**
 * Bulletin API for the SDA Church PWA.
 * Canonical source:
 * https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/blob/main/apps-script/Code.gs
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
  scheduleSheetSuffix: ' Sabbath',
  cacheSeconds: 120,
  cacheVersion: 'v2',
  responseSheets: Object.freeze({
    queens: ['Queens Worship Data'],
    brooklyn: ['Brooklyn Worship Data'],
  }),
  dateHeaders: ['Date', 'Service Date', 'Sabbath Date', 'What date is this Sabbath?'],
  timestampHeaders: ['Timestamp', 'Submitted At'],
});

// The order is intentional: it disambiguates the duplicated Queens/Brooklyn
// headers in the spreadsheet.
var COLUMN_SCHEMA = Object.freeze([
  { header: 'Date', path: ['date'] },
  { header: 'Quarter', path: ['quarter'] },
  { header: 'Special Remark', path: ['specialRemark'] },
  { header: 'Tithe Purpose', path: ['tithePurpose'] },
  { header: 'Pastor Travel', path: ['pastorTravel'] },
  { header: 'Queens Sermon', path: ['queens', 'sermon'], person: true },
  { header: 'Translation', path: ['queens', 'translation'], person: true },
  { header: 'Chinese Teacher', path: ['queens', 'chineseTeacher'], person: true },
  { header: 'English Teacher', path: ['queens', 'englishTeacher'], person: true },
  { header: 'Children Teacher', path: ['queens', 'childrenTeacher'], person: true },
  {
    header: 'Chair/Pastoral Prayer',
    path: ['queens', 'chairPastoralPrayer'],
    person: true,
  },
  { header: 'Special Music', path: ['queens', 'specialMusic'], person: true },
  { header: 'Offering Prayer', path: ['queens', 'offeringPrayer'], person: true },
  { header: 'Pianist', path: ['queens', 'pianist'], person: true },
  { header: 'SS Chair', path: ['queens', 'ssChair'], person: true },
  { header: 'Opening Prayer', path: ['queens', 'openingPrayer'], person: true },
  { header: 'Closing Prayer', path: ['queens', 'closingPrayer'], person: true },
  { header: 'Brooklyn Sermon', path: ['brooklyn', 'sermon'], person: true },
  {
    header: 'Chair/Pastoral Prayer',
    path: ['brooklyn', 'chairPastoralPrayer'],
    person: true,
  },
  { header: 'Offering Prayer', path: ['brooklyn', 'offeringPrayer'], person: true },
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

var FORM_RESPONSE_SCHEMA = Object.freeze([
  {
    headers: ['What is the English name and number for the Hymn of Praise this week?'],
    path: ['hymnOfPraise', 'english'],
  },
  {
    headers: ['What is the Chinese name and number for the Hymn of Praise this week?'],
    path: ['hymnOfPraise', 'chinese'],
  },
  {
    headers: ['What is the sermon title in English?'],
    path: ['sermonTitle', 'english'],
  },
  {
    headers: ['What is the sermon title in Chinese?'],
    path: ['sermonTitle', 'chinese'],
  },
  {
    headers: ['What is the Hymn of Response in English?'],
    path: ['hymnOfResponse', 'english'],
  },
  {
    headers: ['What is the Hymn of Response in Chinese?'],
    path: ['hymnOfResponse', 'chinese'],
  },
  {
    headers: ['What are the Bible verses for this week?'],
    path: ['bibleVerses'],
  },
]);

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

function buildBulletin_(requestedDate) {
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

    if (field.person) {
      value = redactNameValue_(value);
    } else {
      value = displayValue_(value);
    }

    setPath_(bulletin, field.path, value);
  });

  populateFormResponses_(
    bulletin.queens,
    getResponseRows_(spreadsheet, CONFIG.responseSheets.queens, requestedDate),
  );
  populateFormResponses_(
    bulletin.brooklyn,
    getResponseRows_(spreadsheet, CONFIG.responseSheets.brooklyn, requestedDate),
  );

  return bulletin;
}

function getScheduleSheetName_(requestedDate) {
  return requestedDate.slice(0, 4) + CONFIG.scheduleSheetSuffix;
}

function createLocation_() {
  return {
    hymnOfPraise: { english: '', chinese: '' },
    sermonTitle: { english: '', chinese: '' },
    hymnOfResponse: { english: '', chinese: '' },
    bibleVerses: '',
  };
}

function populateFormResponses_(location, responseRows) {
  if (!responseRows) {
    return;
  }

  // Rows are oldest-to-newest. Each nonblank answer is applied so submissions
  // can contribute different fields, while the latest answer wins a conflict.
  responseRows.rows.forEach(function (row) {
    FORM_RESPONSE_SCHEMA.forEach(function (field) {
      var value = valueForAliases_(responseRows.headers, row, field.headers);
      if (!isBlank_(value)) {
        setPath_(location, field.path, displayValue_(value));
      }
    });
  });
}

function getResponseRows_(spreadsheet, sheetNames, requestedDate) {
  var sheet = findFirstSheet_(spreadsheet, sheetNames);
  if (!sheet) {
    return null;
  }

  var table = readTable_(sheet);
  var dateColumn = findFirstHeaderIndex_(table.headers, CONFIG.dateHeaders);
  if (dateColumn === -1) {
    throw new Error(
      'No Sabbath date column found in ' +
        sheet.getName() +
        '. Expected one of: ' +
        CONFIG.dateHeaders.join(', '),
    );
  }

  var timestampColumn = findFirstHeaderIndex_(table.headers, CONFIG.timestampHeaders);
  var matchingRows = [];
  table.rows.forEach(function (row, index) {
    if (
      dateMatches_(
        row[dateColumn],
        table.displayRows[index][dateColumn],
        requestedDate,
      )
    ) {
      matchingRows.push({ values: row, sourceIndex: index });
    }
  });

  if (!matchingRows.length) {
    return null;
  }

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

function findFirstSheet_(spreadsheet, sheetNames) {
  for (var index = 0; index < sheetNames.length; index += 1) {
    var sheet = spreadsheet.getSheetByName(sheetNames[index]);
    if (sheet) {
      return sheet;
    }
  }
  return null;
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
      // Google Form response headers include the translated question after a
      // newline. Matching the English question prefix keeps the mapping stable.
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
