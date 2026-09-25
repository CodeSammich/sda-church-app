/**
 * Keeps the long-running Sabbath Calendar sheet usable without deleting
 * historical rows. This file is intentionally separate from bulletin rendering
 * so schedule maintenance can evolve without changing printed layouts.
 *
 * Policy:
 * - Keep the current calendar quarter visible.
 * - Keep the immediately preceding seven days visible at a quarter boundary.
 * - Hide older dated rows, but never delete them.
 * - During the final 21 days of a quarter, append the immediately following
 *   quarter's Saturdays when they are not already present.
 * - If that following quarter is already complete, do nothing and wait until
 *   the next quarter boundary. This prevents pre-populating a later quarter
 *   just because an earlier one was entered manually.
 *
 * The bound spreadsheet's simple onOpen trigger runs this automatically for
 * every user who opens the sheet. It deliberately does not use an admin email
 * allowlist or add a setup action to the visible menu.
 */

var BULLETIN_SCHEDULE_MAINTENANCE_CONFIG = Object.freeze({
  scheduleSheetName: 'Sabbath Calendar',
  dateHeader: 'Date',
  quarterHeader: 'Quarter',
  populateLeadDays: 21,
  previousWeekDays: 7,
});

function getSabbathCalendarEnglishValidationHelpText_() {
  return (
    'Invalid input: Chinese characters are not allowed in the Sabbath Calendar. ' +
    'Please enter English only. To protect privacy and comply with applicable ' +
    'privacy regulations, the mobile app redacts last names for anonymity.\n\n' +
    '輸入無效：安息日行事曆不允許輸入中文，請只使用英文。為保護隱私並遵守適用的隱私法規，' +
    '手機應用程式會隱去姓氏，以維持匿名。'
  );
}

function getSabbathCalendarEnglishValidationToastText_() {
  return (
    'No Chinese characters are allowed in the Sabbath Calendar. / ' +
    '安息日行事曆不允許輸入中文。\n' +
    'To protect privacy and comply with applicable privacy regulations, the mobile app ' +
    'redacts last names for anonymity. / 為保護隱私並遵守適用的隱私法規，手機應用程式會隱去姓氏，以維持匿名。'
  );
}

/**
 * Keeps the Sabbath Calendar's user-editable schedule cells English-only.
 *
 * Sheets data validation is still useful for ordinary typing, but a user can
 * paste whole cells from the Name Dictionary and overwrite validation metadata.
 * This simple onEdit guard is intentionally limited to the Sabbath Calendar
 * tab and columns A:X. It clears only pasted/edited cells containing CJK Han
 * characters and leaves all other tabs and columns untouched.
 */
function onEdit(e) {
  if (!e || !e.range) {
    return;
  }

  var range = e.range;
  var sheet = range.getSheet();
  if (
    !sheet ||
    sheet.getName() !== BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName
  ) {
    return;
  }

  var values = range.getDisplayValues();
  var invalidCount = 0;
  values.forEach(function (row, rowIndex) {
    row.forEach(function (value, columnIndex) {
      var rowNumber = range.getRow() + rowIndex;
      var columnNumber = range.getColumn() + columnIndex;
      if (rowNumber < 2 || columnNumber < 1 || columnNumber > 24) {
        return;
      }

      // Apps Script's JavaScript regex supports these Unicode ranges. The
      // matching Sheets data-validation formula uses literal CJK endpoints
      // because Sheets REGEXMATCH does not support Unicode escape syntax.
      if (/[㐀-䶿一-鿿豈-﫿]/.test(String(value || ''))) {
        range.getCell(rowIndex + 1, columnIndex + 1).clearContent();
        invalidCount += 1;
      }
    });
  });

  if (invalidCount) {
    showSabbathCalendarEnglishValidationNotice_();
  }
}

function showSabbathCalendarEnglishValidationNotice_() {
  var message = getSabbathCalendarEnglishValidationHelpText_();
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui && ui.alert && ui.ButtonSet && ui.ButtonSet.OK) {
      ui.alert('Invalid input / 輸入無效', message, ui.ButtonSet.OK);
      return;
    }
  } catch (error) {
    // Background or non-editor executions may not have a Sheets UI. Fall back
    // to a toast so the edit is still explained without failing the guard.
  }

  if (SpreadsheetApp.getActiveSpreadsheet) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      getSabbathCalendarEnglishValidationToastText_(),
      'Invalid input / 輸入無效',
      8,
    );
  }
}

function maintainBulletinScheduleOnOpen_() {
  return runBulletinScheduleMaintenance_();
}

function runBulletinScheduleMaintenance_() {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    return { skipped: true, reason: 'another maintenance run is active' };
  }

  try {
    var sheet = getBulletinScheduleMaintenanceSheet_();
    var validation = {
      installed: installSabbathCalendarEnglishValidation_(sheet),
      updatedAfterQuarterAppend: false,
    };
    var populated = populateNextBulletinQuarterIfDue_(sheet);
    if (populated) {
      validation.updatedAfterQuarterAppend = updateSabbathCalendarEnglishValidation_(
        sheet,
      );
    }
    var hidden = hideOldBulletinScheduleRows_(sheet);
    SpreadsheetApp.flush();
    return { populated: populated, hidden: hidden, validation: validation };
  } finally {
    lock.releaseLock();
  }
}

function installSabbathCalendarEnglishValidation_(sheet) {
  return applySabbathCalendarEnglishValidation_(sheet);
}

function updateSabbathCalendarEnglishValidation_(sheet) {
  return applySabbathCalendarEnglishValidation_(sheet);
}

function applySabbathCalendarEnglishValidation_(sheet) {
  var rowCount = Math.max(1, sheet.getMaxRows() - 1);
  var range = sheet.getRange(2, 1, rowCount, 24);
  var rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=NOT(REGEXMATCH(TO_TEXT(A2),"[一-鿿]"))')
    .setAllowInvalid(false)
    .setHelpText(getSabbathCalendarEnglishValidationHelpText_())
    .build();
  range.setDataValidation(rule);
  return range.getA1Notation();
}

function getBulletinScheduleMaintenanceSheet_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName,
  );
  if (!sheet) {
    throw new Error(
      'Schedule sheet not found: ' +
        BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName,
    );
  }
  return sheet;
}

function populateNextBulletinQuarterIfDue_(sheet) {
  var columns = getBulletinScheduleMaintenanceColumns_(sheet);
  var today = getBulletinMaintenanceDateOnly_(new Date());
  var currentQuarterEnd = getBulletinQuarterEnd_(today);
  var daysUntilQuarterEnd = Math.floor(
    (currentQuarterEnd.getTime() - today.getTime()) / 86400000,
  );
  if (
    daysUntilQuarterEnd >
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.populateLeadDays
  ) {
    return 0;
  }

  var nextQuarterStart = new Date(
    currentQuarterEnd.getFullYear(),
    currentQuarterEnd.getMonth() + 1,
    1,
  );
  var nextQuarterEnd = new Date(
    nextQuarterStart.getFullYear(),
    nextQuarterStart.getMonth() + 3,
    0,
  );
  var quarterNumber = Math.floor(nextQuarterStart.getMonth() / 3) + 1;
  var existingDates = getBulletinScheduleDateKeys_(sheet, columns.dateColumn);
  var datesToAdd = getBulletinMissingQuarterSaturdays_(
    nextQuarterStart,
    nextQuarterEnd,
    existingDates,
  );

  // Leave a complete quarter alone. The next quarter will be considered when
  // the current quarter reaches its own final-21-day window.
  if (datesToAdd.length === 0) {
    return 0;
  }

  if (!datesToAdd.length) {
    return 0;
  }

  var width = Math.max(sheet.getLastColumn(), columns.dateColumn, columns.quarterColumn);
  var sourceRow = Math.max(2, sheet.getLastRow());
  var rows = datesToAdd.map(function (date) {
    var row = Array(width).fill('');
    row[columns.dateColumn - 1] = date;
    row[columns.quarterColumn - 1] = getBulletinQuarterCellValue_(
      sheet,
      columns.quarterColumn,
      sourceRow,
      quarterNumber,
    );
    return row;
  });
  var firstNewRow = sheet.getLastRow() + 1;
  var target = sheet.getRange(firstNewRow, 1, rows.length, width);
  target.setValues(rows);
  if (sourceRow >= 2 && sourceRow < firstNewRow) {
    sheet
      .getRange(sourceRow, 1, 1, width)
      .copyTo(target, SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
  }

  var dateFormat = sheet.getRange(sourceRow, columns.dateColumn).getNumberFormat();
  if (dateFormat) {
    sheet
      .getRange(firstNewRow, columns.dateColumn, rows.length, 1)
      .setNumberFormat(dateFormat);
  }
  return rows.length;
}

function getBulletinQuarterSaturdays_(quarterStart, quarterEnd) {
  var dates = [];
  var cursor = new Date(quarterStart);
  cursor.setDate(cursor.getDate() + ((6 - cursor.getDay() + 7) % 7));
  while (cursor <= quarterEnd) {
    dates.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 7);
  }
  return dates;
}

function getBulletinMissingQuarterSaturdays_(
  quarterStart,
  quarterEnd,
  existingDates,
) {
  return getBulletinQuarterSaturdays_(quarterStart, quarterEnd).filter(
    function (date) {
      return !existingDates[formatBulletinMaintenanceDateKey_(date)];
    },
  );
}

function hideOldBulletinScheduleRows_(sheet) {
  var columns = getBulletinScheduleMaintenanceColumns_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  var today = getBulletinMaintenanceDateOnly_(new Date());
  var currentQuarterStart = getBulletinQuarterStart_(today);
  var previousWeekStart = new Date(today);
  previousWeekStart.setDate(
    previousWeekStart.getDate() -
      BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.previousWeekDays,
  );
  var rowCount = lastRow - 1;
  var dateRange = sheet.getRange(2, columns.dateColumn, rowCount, 1);
  var rawValues = dateRange.getValues();
  var displayValues = dateRange.getDisplayValues();
  var hiddenCount = 0;
  var hiddenStart = 0;

  function flushHiddenRange(endRow) {
    if (!hiddenStart) {
      return;
    }
    var count = endRow - hiddenStart;
    sheet.hideRows(hiddenStart, count);
    hiddenCount += count;
    hiddenStart = 0;
  }

  for (var index = 0; index < rowCount; index += 1) {
    var date = parseBulletinMaintenanceDate_(rawValues[index][0], displayValues[index][0]);
    var rowNumber = index + 2;
    if (!date) {
      flushHiddenRange(rowNumber);
      continue;
    }

    var shouldHide =
      date < currentQuarterStart && date < previousWeekStart;
    if (shouldHide) {
      if (!hiddenStart) {
        hiddenStart = rowNumber;
      }
    } else {
      flushHiddenRange(rowNumber);
      sheet.showRows(rowNumber, 1);
    }
  }
  flushHiddenRange(lastRow + 1);
  return hiddenCount;
}

function getBulletinScheduleMaintenanceColumns_(sheet) {
  var headers = sheet
    .getRange(1, 1, 1, sheet.getLastColumn())
    .getDisplayValues()[0];
  var dateColumn = findBulletinMaintenanceHeaderColumn_(
    headers,
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.dateHeader,
  );
  var quarterColumn = findBulletinMaintenanceHeaderColumn_(
    headers,
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.quarterHeader,
  );
  if (!dateColumn || !quarterColumn) {
    throw new Error('Sabbath Calendar must have Date and Quarter columns.');
  }
  return { dateColumn: dateColumn, quarterColumn: quarterColumn };
}

function findBulletinMaintenanceHeaderColumn_(headers, wanted) {
  var normalized = String(wanted).trim().toLowerCase();
  for (var index = 0; index < headers.length; index += 1) {
    if (String(headers[index]).trim().toLowerCase() === normalized) {
      return index + 1;
    }
  }
  return 0;
}

function getBulletinScheduleDateKeys_(sheet, dateColumn) {
  var lastRow = sheet.getLastRow();
  var keys = {};
  if (lastRow < 2) {
    return keys;
  }
  var range = sheet.getRange(2, dateColumn, lastRow - 1, 1);
  var rawValues = range.getValues();
  var displayValues = range.getDisplayValues();
  rawValues.forEach(function (row, index) {
    var date = parseBulletinMaintenanceDate_(row[0], displayValues[index][0]);
    if (date) {
      keys[formatBulletinMaintenanceDateKey_(date)] = true;
    }
  });
  return keys;
}

function getBulletinQuarterStart_(date) {
  return new Date(date.getFullYear(), Math.floor(date.getMonth() / 3) * 3, 1);
}

function getBulletinQuarterEnd_(date) {
  var start = getBulletinQuarterStart_(date);
  return new Date(start.getFullYear(), start.getMonth() + 3, 0);
}

function getBulletinQuarterCellValue_(sheet, quarterColumn, row, quarterNumber) {
  var raw = sheet.getRange(row, quarterColumn).getValue();
  if (typeof raw === 'number') {
    return quarterNumber;
  }
  var text = String(raw || '').trim();
  return /^q\s*/i.test(text) ? 'Q' + quarterNumber : String(quarterNumber);
}

function parseBulletinMaintenanceDate_(rawValue, displayValue) {
  if (rawValue instanceof Date && !isNaN(rawValue.getTime())) {
    return getBulletinMaintenanceDateOnly_(rawValue);
  }
  var text = String(displayValue || rawValue || '').trim();
  var match = text.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (!match) {
    match = text.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
    if (!match) {
      return null;
    }
    return new Date(Number(match[3]), Number(match[1]) - 1, Number(match[2]));
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function getBulletinMaintenanceDateOnly_(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatBulletinMaintenanceDateKey_(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function formatBulletinScheduleMaintenanceResult_(result) {
  if (result.skipped) {
    return 'Schedule maintenance skipped: ' + result.reason + '.';
  }
  return (
    'Schedule maintenance complete. Added ' +
    result.populated +
    ' next-quarter date(s) and hid ' +
    result.hidden +
    ' old row(s).'
  );
}
