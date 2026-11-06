/**
 * Keeps the long-running Sabbath Calendar sheet usable without deleting
 * historical rows. This file is intentionally separate from bulletin rendering
 * so schedule maintenance can evolve without changing printed layouts.
 *
 * Policy:
 * - Keep the current calendar quarter visible.
 * - Keep the immediately preceding seven days visible at a quarter boundary.
 * - Hide older dated rows, but never delete them.
 * - Keep a year of Saturdays to plan in: the three quarters after the current
 *   one always have rows. A sheet that has fallen behind catches up on the
 *   next run, appending the missing quarters in date order.
 * - During the final 21 days of a quarter, also append the fourth quarter
 *   ahead. Each quarter-end window therefore adds exactly one quarter, which
 *   starts three weeks and three quarters later.
 * - Append only Saturdays that are not already present, and never append past
 *   that fourth quarter, even when planners entered later dates by hand.
 *
 * The bound spreadsheet's simple onOpen trigger runs this automatically for
 * every user who opens the sheet. It deliberately does not use an admin email
 * allowlist or add a setup action to the visible menu.
 */

var BULLETIN_SCHEDULE_MAINTENANCE_CONFIG = Object.freeze({
  scheduleSheetName: 'Sabbath Calendar',
  dateHeader: 'Date',
  quarterHeader: 'Quarter',
  // Quarters after the current one that always have rows. With the current
  // quarter, that is a year of Saturdays.
  quartersAhead: 3,
  // During a quarter's final days, one more quarter is appended.
  populateLeadDays: 21,
  previousWeekDays: 7,
  // Weekly Data gets a row per location for this coming Sabbath and the two
  // after. The app shows the first two; the third is there because the pastor
  // usually knows a sermon about two weeks ahead.
  weeklyDataSabbaths: 3,
  weeklyDataLocations: Object.freeze(['Queens', 'Brooklyn']),
});

// The bulletin's column names are maintained by the technology team. Keep the
// protected header/column ranges editable by this Google Group only; ordinary
// sheet sharing still controls who may view or edit the unprotected schedule
// cells.
var BULLETIN_HEADER_PROTECTION_EDITOR = 'technology@nyccsda.org';
var BULLETIN_HEADER_PROTECTION_DESCRIPTION =
  'Bulletin column names: the app and printed bulletin read each column by its name.';

// Staff-facing text (dialogs, alerts, errors, notes) is in English and
// Simplified Chinese, because the people who run the bulletin read Simplified.
// Everything printed stays in Traditional Chinese on purpose. Keep the two
// apart: see "Chinese script" in docs/operations/bulletin-automation.md.
function getSabbathCalendarEnglishValidationHelpText_() {
  return (
    'Invalid input: Chinese characters are not allowed in the Sabbath Calendar. ' +
    'Please enter English only. To protect privacy and comply with applicable ' +
    'privacy regulations, the mobile app redacts last names for anonymity. ' +
    'Use the Name Dictionary tab in this master spreadsheet to find the approved English name.\n\n' +
    '输入无效：安息日日历不允许输入中文，请只使用英文。为保护隐私并遵守适用的隐私法规，' +
    '手机应用会隐去姓氏，以维持匿名。请使用此主电子表格中的“Name Dictionary”工作表查找核准的英文姓名。'
  );
}

var WEEKLY_DATA_DATE_HELP_TEXT =
  'Date must be a Saturday, typed as YYYY-MM-DD, such as 2026-11-07. / ' +
  '日期必须是星期六，格式为 YYYY-MM-DD，例如 2026-11-07。';

var WEEKLY_DATA_LOCATION_HELP_TEXT =
  'Location must be Queens or Brooklyn. / 地点必须是 Queens 或 Brooklyn。';

function getSabbathCalendarEnglishValidationToastText_() {
  return (
    'No Chinese characters are allowed in the Sabbath Calendar. / ' +
    '安息日日历不允许输入中文。\n' +
    'To protect privacy and comply with applicable privacy regulations, the mobile app ' +
    'redacts last names for anonymity. Use the Name Dictionary tab in this master spreadsheet ' +
    'to find the approved English name. / 为保护隐私并遵守适用的隐私法规，手机应用会隐去姓氏，以维持匿名。' +
    '请使用此主电子表格中的“Name Dictionary”工作表查找核准的英文姓名。'
  );
}

/**
 * Keeps the Sabbath Calendar's user-editable schedule cells English-only.
 *
 * This simple onEdit guard handles both typed and pasted Chinese: the
 * validation rule allows invalid input so typing reaches it, and pasting whole
 * cells from the Name Dictionary can overwrite validation metadata anyway. It
 * is intentionally limited to the Sabbath Calendar tab and columns A:Y. It
 * clears only pasted/edited cells containing CJK Han characters and leaves all
 * other tabs and columns untouched.
 */
function onEdit(e) {
  if (!e || !e.range) {
    return;
  }

  var range = e.range;
  var sheet = range.getSheet();
  if (sheet.getName() === HYMN_BANK_TAB_NAME) {
    forgetHymnBankFingerprint_();
    return;
  }
  if (isBulletinTab_(sheet, SCHEDULE_ASSIGNMENT_CHECK_CONFIG.nameDictionarySheetName)) {
    // Dictionary edits can merge or split pinyin aliases, which changes
    // which roster cells count as the same person.
    refreshScheduleRosterChecksSafely_();
    return;
  }
  if (!isBulletinTab_(sheet, BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName)) {
    return;
  }

  var values = range.getDisplayValues();
  var invalidCount = 0;
  var englishColumns = getSabbathCalendarColumnNumbers_(sheet);
  values.forEach(function (row, rowIndex) {
    row.forEach(function (value, columnIndex) {
      var rowNumber = range.getRow() + rowIndex;
      var columnNumber = range.getColumn() + columnIndex;
      if (rowNumber < 2 || englishColumns.indexOf(columnNumber) === -1) {
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

  var lookup = null;
  try {
    lookup = loadScheduleNameLookup_();
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Name Dictionary lookup skipped: ' + error);
    }
  }
  refreshScheduleRosterChecksSafely_(sheet, lookup);

  // The installable trigger shows the interactive dialog instead; showing
  // this alert as well would stack two warnings for one edit.
  if (!invalidCount && !isScheduleNameCheckTriggerInstalled_()) {
    var unknown = findUnknownScheduleNames_(range, lookup);
    if (unknown.length) {
      showUnknownScheduleNamesNotice_(unknown);
    }
  }
}

function showSabbathCalendarEnglishValidationNotice_() {
  var message = getSabbathCalendarEnglishValidationHelpText_();
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui && ui.alert && ui.ButtonSet && ui.ButtonSet.OK) {
      ui.alert('Invalid input / 输入无效', message, ui.ButtonSet.OK);
      return;
    }
  } catch (error) {
    // Background or non-editor executions may not have a Sheets UI. Fall back
    // to a toast so the edit is still explained without failing the guard.
  }

  if (SpreadsheetApp.getActiveSpreadsheet) {
    SpreadsheetApp.getActiveSpreadsheet().toast(
      getSabbathCalendarEnglishValidationToastText_(),
      'Invalid input / 输入无效',
      8,
    );
  }
}

function maintainBulletinScheduleOnOpen_() {
  return runBulletinScheduleMaintenance_();
}

// `now` defaults to the current time; tests pass a fixed date.
function runBulletinScheduleMaintenance_(now) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(5000)) {
    return { skipped: true, reason: 'another maintenance run is active' };
  }

  // Logs each step's time, so an open that runs out of its 30 seconds shows
  // in Executions which step took them (#642).
  var lap = new Date().getTime();
  var timed = function (step) {
    var now = new Date().getTime();
    if (typeof Logger !== 'undefined') {
      Logger.log('Upkeep: ' + step + ' took ' + (now - lap) + ' ms');
    }
    lap = now;
  };
  try {
    var sheet = getBulletinScheduleMaintenanceSheet_();
    ensureBulletinHeaderProtections_();
    timed('header protections');
    var validation = {
      installed: installSabbathCalendarEnglishValidation_(sheet),
      updatedAfterQuarterAppend: false,
    };
    timed('English-only rule');
    var populated = populateUpcomingBulletinQuarters_(sheet, now);
    if (populated) {
      validation.updatedAfterQuarterAppend = updateSabbathCalendarEnglishValidation_(
        sheet,
      );
    }
    timed('quarter rows');
    var weeklyRows = populateUpcomingWeeklyDataRowsSafely_(now);
    timed('Weekly Data');
    var hidden = hideOldBulletinScheduleRows_(sheet, now);
    timed('hiding old rows');
    // Runs after quarter rows are appended so the scan covers every row.
    var conflicts = refreshScheduleRosterChecksSafely_(sheet);
    timed('conflict scan');
    SpreadsheetApp.flush();
    return {
      populated: populated,
      weeklyRows: weeklyRows,
      hidden: hidden,
      conflicts: conflicts,
      validation: validation,
    };
  } finally {
    // Last, so a Weekly Data tab made again above is tagged too, and even
    // when a step above stops the upkeep, such as on a Sabbath Calendar
    // without its Date column, so the other tabs and columns keep their tags.
    try {
      tagBulletinTabsAndColumnsSafely_(SpreadsheetApp.getActiveSpreadsheet());
      timed('tags');
    } finally {
      lock.releaseLock();
    }
  }
}

// Header rows are protected for the technology group, but no longer locked to
// fixed names: until #558 a rule on each header cell rejected any other name,
// and the open-time check stopped the bulletin when one changed. Columns are
// now read by name, so the leftover rules are removed.
function ensureBulletinHeaderProtections_() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(BULLETIN_SHEET_COLUMNS).forEach(function (sheetName) {
    var sheet = getBulletinSheet_(spreadsheet, sheetName);
    if (!sheet) {
      return;
    }
    try {
      var headerRow = sheet.getRange(1, 1, 1, sheet.getMaxColumns());
      if (headerRow.getDataValidations()[0].some(Boolean)) {
        headerRow.clearDataValidations();
      }
      ensureBulletinHeaderProtection_(sheet, BULLETIN_SHEET_COLUMNS[sheetName].length);
    } catch (error) {
      // A simple onOpen trigger may run as an ordinary editor who cannot
      // change the protected header row. Keep the rest of maintenance working;
      // the live header protections are already group-restricted, and the
      // next technology-group open removes any leftover rules.
      if (typeof Logger !== 'undefined') {
        Logger.log(
          'Could not tidy the header row of ' + sheetName + ': ' + error,
        );
      }
    }
    if (sheetName === BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName) {
      try {
        ensureBulletinScheduleFixedColumnProtection_(sheet);
      } catch (error) {
        if (typeof Logger !== 'undefined') {
          Logger.log('Could not normalize date/quarter protection: ' + error);
        }
      }
    }
  });
}

/**
 * Tags each tab in BULLETIN_TABS, and each expected column of the bulletin
 * tabs, so a later rename doesn't lose it (#580). Only what's found by its
 * name is tagged. A renamed tab or column keeps the tag it has, and a missing
 * one has nothing to tag. The name wins, as when the scripts read: a tag left
 * on another tab or column moves to the one with the name, such as from a
 * duplicated tab, or a renamed column that someone made again under its old
 * name. An editor who can't change a protected range leaves its tag for the
 * next open by the technology group.
 */
function tagBulletinTabsAndColumns_(spreadsheet) {
  var visibility = SpreadsheetApp.DeveloperMetadataVisibility.DOCUMENT;
  Object.keys(BULLETIN_TABS).forEach(function (name) {
    var tab = BULLETIN_TABS[name];
    var tagged = findBulletinTabTags_(spreadsheet, tab.tag);
    var sheet = spreadsheet.getSheetByName(name);
    if (!sheet && !tagged.length) {
      sheet = getBulletinSheet_(spreadsheet, name);
    }
    if (!sheet) {
      return;
    }
    var hasTag = false;
    tagged.forEach(function (entry) {
      if (entry.sheet.getSheetId() === sheet.getSheetId()) {
        hasTag = true;
      } else {
        tryBulletinTagChange_(name, function () {
          entry.metadata.remove();
        });
      }
    });
    if (!hasTag) {
      tryBulletinTagChange_(name, function () {
        sheet.addDeveloperMetadata(BULLETIN_TAB_TAG_KEY, tab.tag, visibility);
      });
    }
  });

  Object.keys(BULLETIN_SHEET_COLUMNS).forEach(function (name) {
    var sheet = getBulletinSheet_(spreadsheet, name);
    if (!sheet || sheet.getLastColumn() < 1) {
      return;
    }
    var headers = getBulletinHeaders_(
      sheet,
      name,
      sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0],
    );
    var tags = findBulletinColumnTags_(sheet);
    getBulletinExpectedColumns_(name).forEach(function (column) {
      var index = findBulletinColumn_(name, headers, column);
      if (index === -1) {
        return;
      }
      var hasTag = false;
      tags.forEach(function (entry) {
        if (entry.tag !== column.tag) {
          return;
        }
        if (entry.index === index) {
          hasTag = true;
        } else {
          tryBulletinTagChange_(name + ': ' + column.label, function () {
            entry.metadata.remove();
          });
        }
      });
      if (!hasTag) {
        tryBulletinTagChange_(name + ': ' + column.label, function () {
          getBulletinWholeColumn_(sheet, index + 1).addDeveloperMetadata(
            BULLETIN_COLUMN_TAG_KEY,
            column.tag,
            visibility,
          );
        });
      }
    });
  });
}

function tagBulletinTabsAndColumnsSafely_(spreadsheet) {
  try {
    tagBulletinTabsAndColumns_(spreadsheet);
  } catch (error) {
    logBulletinTagError_('Could not tag the bulletin tabs and columns', error);
  }
}

function tryBulletinTagChange_(what, change) {
  try {
    change();
  } catch (error) {
    logBulletinTagError_('Could not update the tag of ' + what, error);
  }
}

// Developer metadata goes on a whole column, such as C:C.
function getBulletinWholeColumn_(sheet, columnNumber) {
  var letters = getColumnLetters_(columnNumber);
  return sheet.getRange(letters + ':' + letters);
}

/**
 * Keeps the managed header ranges locked without locking ordinary schedule
 * or intake data. This intentionally overwrites the editor list so a former
 * individual editor cannot retain access after the group-only policy lands.
 */
function ensureBulletinHeaderProtection_(sheet, headerCount) {
  var headerRange = sheet.getRange('1:1');
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var matching = protections.filter(function (protection) {
    var range = protection.getRange();
    return (
      range.getRow() === 1 &&
      range.getColumn() === 1 &&
      range.getNumRows() === 1 &&
      range.getNumColumns() >= headerCount
    );
  });

  var protection = matching.length ? matching[0] : headerRange.protect();
  restrictBulletinProtection_(
    protection,
    BULLETIN_HEADER_PROTECTION_DESCRIPTION + ' Sheet: ' + sheet.getName(),
  );

  // Remove duplicate header protections left by older manual setup so the
  // effective editor list cannot diverge between overlapping locks.
  matching.slice(1).forEach(function (duplicate) {
    duplicate.remove();
  });

  return protection;
}

/**
 * Leaves only the technology group as an editor of a managed protection, and
 * changes a setting only if it differs, so most opens just read them. Until
 * #642 this called protection.setEditors, which Apps Script doesn't have, so
 * every open failed here and nothing was restricted. Removing the owner or
 * the person running the script does nothing: Apps Script keeps them.
 */
function restrictBulletinProtection_(protection, description) {
  if (protection.getDescription() !== description) {
    protection.setDescription(description);
  }
  if (protection.isWarningOnly()) {
    protection.setWarningOnly(false);
  }
  if (protection.canDomainEdit()) {
    protection.setDomainEdit(false);
  }
  var group = BULLETIN_HEADER_PROTECTION_EDITOR.toLowerCase();
  var editors = protection.getEditors().map(function (user) {
    return String(user.getEmail() || '').toLowerCase();
  });
  if (editors.indexOf(group) === -1) {
    protection.addEditor(BULLETIN_HEADER_PROTECTION_EDITOR);
  }
  var others = editors.filter(function (email) {
    return email && email !== group;
  });
  if (others.length) {
    protection.removeEditors(others);
  }
}

function ensureBulletinScheduleFixedColumnProtection_(sheet) {
  var fixedColumnRange = sheet.getRange('A:B');
  var protections = sheet.getProtections(SpreadsheetApp.ProtectionType.RANGE);
  var matching = protections.filter(function (protection) {
    var range = protection.getRange();
    return (
      range.getColumn() === 1 &&
      range.getRow() === 1 &&
      range.getNumColumns() === 2 &&
      range.getNumRows() >= sheet.getMaxRows()
    );
  });

  var protection = matching.length ? matching[0] : fixedColumnRange.protect();
  restrictBulletinProtection_(protection, 'Fixed date and quarter columns; technology team only.');
  matching.slice(1).forEach(function (duplicate) {
    duplicate.remove();
  });
  return protection;
}

function installSabbathCalendarEnglishValidation_(sheet) {
  return applySabbathCalendarEnglishValidation_(sheet);
}

function updateSabbathCalendarEnglishValidation_(sheet) {
  return applySabbathCalendarEnglishValidation_(sheet);
}

/**
 * Marks Chinese characters in the Sabbath Calendar as invalid without help
 * text. Sheets shows a rule's help text on every selected cell and there is no
 * way to limit it to rejections, so the rule stays silent: the onEdit guard
 * clears Chinese input and shows the bilingual explanation instead. Allowing
 * invalid input lets typed Chinese reach that guard; the rule's red warning
 * corner remains as a backstop if the guard ever fails to run.
 */
function applySabbathCalendarEnglishValidation_(sheet) {
  var rowCount = Math.max(1, sheet.getMaxRows() - 1);
  var range = sheet.getRange(2, 1, rowCount, 25);
  var rule = SpreadsheetApp.newDataValidation()
    .requireFormulaSatisfied('=NOT(REGEXMATCH(TO_TEXT(A2),"[一-鿿]"))')
    .setAllowInvalid(true)
    .build();
  range.setDataValidation(rule);
  return range.getA1Notation();
}

function getBulletinScheduleMaintenanceSheet_() {
  var sheet = getBulletinSheet_(
    SpreadsheetApp.getActiveSpreadsheet(),
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

/**
 * Appends the Saturdays missing from the quarters planners should already
 * see: the next `quartersAhead` quarters, plus one more during the current
 * quarter's final `populateLeadDays` days. Quarters are walked in date order
 * and existing dates are skipped, so a run appends nothing once the sheet is
 * caught up. Returns the number of rows appended.
 */
function populateUpcomingBulletinQuarters_(sheet, now) {
  var columns = getBulletinScheduleMaintenanceColumns_(sheet);
  var today = getBulletinMaintenanceDateOnly_(now || new Date());
  var currentQuarterStart = getBulletinQuarterStart_(today);
  // Round rather than floor: a daylight-saving change between the two
  // midnights makes the difference an hour off a whole number of days.
  var daysUntilQuarterEnd = Math.round(
    (getBulletinQuarterEnd_(today).getTime() - today.getTime()) / 86400000,
  );
  var quarterCount = BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.quartersAhead;
  if (daysUntilQuarterEnd <= BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.populateLeadDays) {
    quarterCount += 1;
  }

  var existingDates = getBulletinScheduleDateKeys_(sheet, columns.dateColumn);
  var width = Math.max(sheet.getLastColumn(), columns.dateColumn, columns.quarterColumn);
  var sourceRow = Math.max(2, sheet.getLastRow());
  var rows = [];
  for (var offset = 1; offset <= quarterCount; offset += 1) {
    // Month overflow rolls into later years: Q4 2026 + 4 is Q4 2027.
    var quarterStart = new Date(
      currentQuarterStart.getFullYear(),
      currentQuarterStart.getMonth() + offset * 3,
      1,
    );
    var datesToAdd = getBulletinMissingQuarterSaturdays_(
      quarterStart,
      getBulletinQuarterEnd_(quarterStart),
      existingDates,
    );
    if (!datesToAdd.length) {
      continue;
    }
    var quarterValue = getBulletinQuarterCellValue_(
      sheet,
      columns.quarterColumn,
      sourceRow,
      Math.floor(quarterStart.getMonth() / 3) + 1,
    );
    for (var index = 0; index < datesToAdd.length; index += 1) {
      var row = Array(width).fill('');
      row[columns.dateColumn - 1] = datesToAdd[index];
      row[columns.quarterColumn - 1] = quarterValue;
      rows.push(row);
    }
  }

  if (!rows.length) {
    return 0;
  }

  var firstNewRow = sheet.getLastRow() + 1;
  // A catch-up can append most of a year at once. Sheets rejects a range past
  // the grid's last row, so add grid rows first when the sheet is too short.
  var missingGridRows = firstNewRow + rows.length - 1 - sheet.getMaxRows();
  if (missingGridRows > 0) {
    sheet.insertRowsAfter(sheet.getMaxRows(), missingGridRows);
  }
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

// A new Weekly Data tab's rows after the headers: a worked example for each
// location, between them showing each way to fill a hymn cell, in the order of
// BULLETIN_SHEET_COLUMNS. Nothing reads a row whose Date isn't a date, so they
// never reach a bulletin.
var WEEKLY_DATA_EXAMPLE_ROWS = Object.freeze([
  Object.freeze([
    'Example', 'Queens', 'John 10:11-16', 'The Good Shepherd', '好牧人',
    '第12首 讚美上帝大君王', 'AH 73 Holy, Holy, Holy', '還要等多久',
    'AH 1 Praise to the Lord', 'It Is Well with My Soul', '第452首 遵命有福',
  ]),
  Object.freeze([
    'Example', 'Brooklyn', 'Psalms 23:1-6', 'The Lord Is My Shepherd', '耶和華是我的牧者',
    '205', 'Amazing Grace', '',
    '第5首 讚美上主', '奇異恩典', 'AH 86 How Great Thou Art',
  ]),
]);

// Keeps Weekly Data in shape however it's edited (#558), so nobody has to
// guard its headers. A deleted or emptied tab comes back with its headers and
// the example rows, and an expected column that's gone comes back, empty, at
// the far right. Nothing is renamed, moved or removed: a column someone
// renamed keeps its data under the new name, and the notice says which
// columns were added. Runs on open; the API itself never writes.
function ensureWeeklyDataTab_(spreadsheet) {
  var name = CONFIG.intakeSheetName;
  var expected = BULLETIN_SHEET_COLUMNS[name];
  var sheet = getBulletinSheet_(spreadsheet, name) || spreadsheet.insertSheet(name);
  if (sheet.getLastRow() === 0) {
    var rows = [expected.slice()].concat(
      WEEKLY_DATA_EXAMPLE_ROWS.map(function (row) {
        return row.slice();
      }),
    );
    sheet.getRange(1, 1, rows.length, expected.length).setValues(rows);
    sheet.getRange(1, 1, 1, expected.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    showWeeklyDataNotice_(
      spreadsheet,
      'Weekly Data was missing, so it was set up again with its columns and two example rows. / ' +
        'Weekly Data 工作表缺失，已重新建立，含所有列和两行示例。',
    );
    return sheet;
  }

  var lastColumn = sheet.getLastColumn();
  var headers = getBulletinHeaders_(
    sheet,
    name,
    sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0],
  );
  var missing = expected.filter(function (header) {
    return (
      findFirstHeaderIndex_(
        headers,
        [header].concat(BULLETIN_COLUMN_ALTERNATIVES[header] || []),
      ) === -1
    );
  });
  if (missing.length) {
    var gridColumns = lastColumn + missing.length - sheet.getMaxColumns();
    if (gridColumns > 0) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), gridColumns);
    }
    var added = sheet.getRange(1, lastColumn + 1, 1, missing.length);
    added.setValues([missing]);
    added.setFontWeight('bold');
    showWeeklyDataNotice_(
      spreadsheet,
      'Weekly Data: added these missing columns at the far right: ' + missing.join(', ') +
        '. / Weekly Data：已在最右侧补上缺少的列：' + missing.join('、') + '。',
    );
  }
  return sheet;
}

function showWeeklyDataNotice_(spreadsheet, message) {
  if (typeof spreadsheet.toast === 'function') {
    spreadsheet.toast(message, 'Bulletin / 周刊', 15);
  }
}

// Like the Sabbath Calendar's quarters, Weekly Data gets ready-to-fill rows on
// open: a Queens and a Brooklyn row for each of the next Sabbaths, with the
// date filled in (#558). A row is added only when that date and location has
// none, so a row staff added themselves is never repeated, and nothing is ever
// removed or reordered. New rows go at the bottom.
function populateUpcomingWeeklyDataRows_(spreadsheet, now) {
  var sheet = ensureWeeklyDataTab_(spreadsheet);
  var lastColumn = sheet.getLastColumn();
  var headers = getBulletinHeaders_(
    sheet,
    CONFIG.intakeSheetName,
    sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0],
  );
  var dateColumn = findFirstHeaderIndex_(headers, ['Date']) + 1;
  var locationColumn = findFirstHeaderIndex_(headers, ['Location']) + 1;
  if (!dateColumn || !locationColumn) {
    return 0;
  }

  var existing = {};
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    var range = sheet.getRange(2, 1, lastRow - 1, lastColumn);
    var rawValues = range.getValues();
    var displayValues = range.getDisplayValues();
    rawValues.forEach(function (row, index) {
      var date = parseBulletinMaintenanceDate_(
        row[dateColumn - 1],
        displayValues[index][dateColumn - 1],
      );
      if (date) {
        existing[
          formatBulletinMaintenanceDateKey_(date) + '|' +
            normalizeLocationKey_(row[locationColumn - 1])
        ] = true;
      }
    });
  }

  // This coming Sabbath, which is today on a Saturday, and the ones after.
  var sabbath = getBulletinMaintenanceDateOnly_(now || new Date());
  sabbath.setDate(sabbath.getDate() + ((6 - sabbath.getDay() + 7) % 7));
  var rows = [];
  for (var week = 0; week < BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.weeklyDataSabbaths; week += 1) {
    var date = new Date(sabbath.getFullYear(), sabbath.getMonth(), sabbath.getDate() + week * 7);
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.weeklyDataLocations.forEach(function (location) {
      if (existing[formatBulletinMaintenanceDateKey_(date) + '|' + normalizeLocationKey_(location)]) {
        return;
      }
      var row = Array(lastColumn).fill('');
      row[dateColumn - 1] = date;
      row[locationColumn - 1] = location;
      rows.push(row);
    });
  }
  if (rows.length) {
    var firstNewRow = lastRow + 1;
    var missingGridRows = firstNewRow + rows.length - 1 - sheet.getMaxRows();
    if (missingGridRows > 0) {
      sheet.insertRowsAfter(sheet.getMaxRows(), missingGridRows);
    }
    sheet.getRange(firstNewRow, 1, rows.length, lastColumn).setValues(rows);
  }
  applyWeeklyDataRules_(sheet, dateColumn, locationColumn);
  return rows.length;
}

// Weekly Data's dates show as YYYY-MM-DD, and only a Saturday can be typed in
// (#558). Sheets turns a typed 2026-11-07 or 11/7/2026 into a date; anything
// else, or a date that isn't a Saturday, is rejected with the help text, which
// also shows on a selected date cell as a hint. The Example rows at the top
// are allowed. Location is a Queens/Brooklyn dropdown. The rules start below
// the header, and are set again on every open because pasting whole cells
// replaces them.
function applyWeeklyDataRules_(sheet, dateColumn, locationColumn) {
  var rowCount = Math.max(1, sheet.getMaxRows() - 1);
  sheet.getRange(2, locationColumn, rowCount, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.weeklyDataLocations.slice(), true)
      .setAllowInvalid(false)
      .setHelpText(WEEKLY_DATA_LOCATION_HELP_TEXT)
      .build(),
  );
  var range = sheet.getRange(2, dateColumn, rowCount, 1);
  var cell = sheet.getRange(2, dateColumn).getA1Notation();
  var rule = SpreadsheetApp.newDataValidation()
    // IF, not OR: Sheets' OR passes on an error, such as WEEKDAY of a word.
    .requireFormulaSatisfied(
      '=IF(ISNUMBER(' + cell + '),' +
        'AND(' + cell + '>=DATE(2020,1,1),WEEKDAY(' + cell + ')=7),' +
        'OR(' + cell + '="",REGEXMATCH(TO_TEXT(' + cell + '),"(?i)^example")))',
    )
    .setAllowInvalid(false)
    .setHelpText(WEEKLY_DATA_DATE_HELP_TEXT)
    .build();
  range.setDataValidation(rule);
  range.setNumberFormat('yyyy-mm-dd');
}

/**
 * Keeps the Hymn Bank tab (#606) the same as the app's hymnals (#619): the rows
 * come from BULLETIN_HYMNAL_DATA, which each deploy makes from
 * features/hymnal/. The tab is read in one call, and rewritten only when a
 * cell differs, so a stray edit, sort or new column is undone, and the tab
 * needs no protection. A deleted tab comes back at the end. Returns what it
 * did.
 *
 * It runs at the end of onOpen, and only while the open has used less than
 * HYMN_BANK_OPEN_BUDGET_MS of its 30 seconds: the first open after the 1.6.1
 * deploy ran out of time rewriting this tab, before it built the menu (#639).
 *
 * Most runs read nothing but one Document Property: the fingerprint of the
 * rows last checked or written. Only a deploy that changed the hymnals, an
 * edit in the tab (onEdit clears the fingerprint), or a missing tab leads to
 * the read and compare below.
 */
function ensureHymnBankTab_(spreadsheet) {
  var rows = typeof BULLETIN_HYMNAL_DATA !== 'undefined' ? BULLETIN_HYMNAL_DATA.hymnBankRows : null;
  if (!rows || !rows.length) {
    return 'no data';
  }
  var name = HYMN_BANK_TAB_NAME;
  var properties = PropertiesService.getDocumentProperties();
  var fingerprint = getHymnBankFingerprint_(rows);
  var sheet = getBulletinSheet_(spreadsheet, name);
  if (sheet && properties.getProperty(HYMN_BANK_FINGERPRINT_PROPERTY) === fingerprint) {
    return 'unchanged';
  }
  var created = !sheet;
  if (created) {
    sheet = spreadsheet.insertSheet(name, spreadsheet.getSheets().length);
  } else {
    var current = sheet.getLastRow() ? sheet.getDataRange().getDisplayValues() : [];
    if (isSameHymnBank_(current, rows)) {
      properties.setProperty(HYMN_BANK_FINGERPRINT_PROPERTY, fingerprint);
      return 'unchanged';
    }
    sheet.clearContents();
  }
  var width = rows[0].length;
  var range = sheet.getRange(1, 1, rows.length, width);
  // Plain text, so Sheets never reads a cell as a number or a date.
  range.setNumberFormat('@');
  range.setValues(rows);
  sheet.getRange(1, 1, 1, width).setFontWeight('bold');
  if (sheet.getFrozenRows() !== 1) {
    sheet.setFrozenRows(1);
  }
  properties.setProperty(HYMN_BANK_FINGERPRINT_PROPERTY, fingerprint);
  return created ? 'created' : 'rewritten';
}

var HYMN_BANK_TAB_NAME = 'Hymn Bank';
// An open that has used more than this skips the check, which the next open
// does instead.
var HYMN_BANK_OPEN_BUDGET_MS = 20000;
// A Document Property, so it stays off the Script Properties page.
var HYMN_BANK_FINGERPRINT_PROPERTY = 'bulletin.hymnBank.fingerprint';

// A short fingerprint of the rows: their count and a 32-bit hash of their text.
function getHymnBankFingerprint_(rows) {
  var text = JSON.stringify(rows);
  var hash = 5381;
  for (var index = 0; index < text.length; index += 1) {
    hash = ((hash * 33) ^ text.charCodeAt(index)) >>> 0;
  }
  return rows.length + ':' + hash.toString(16);
}

// An edit in the Hymn Bank tab means it may differ now, so the next check reads it.
function forgetHymnBankFingerprint_() {
  try {
    PropertiesService.getDocumentProperties().deleteProperty(HYMN_BANK_FINGERPRINT_PROPERTY);
  } catch (error) {
    // The next check after a deploy still compares the tab.
  }
}

function isSameHymnBank_(current, rows) {
  return (
    current.length === rows.length &&
    current.every(function (row, index) {
      return (
        row.length === rows[index].length &&
        row.every(function (cell, column) {
          return cell === rows[index][column];
        })
      );
    })
  );
}

// A Hymn Bank problem, such as a tab still protected from this editor, must
// not stop the rest of the upkeep.
function ensureHymnBankTabSafely_() {
  try {
    return ensureHymnBankTab_(SpreadsheetApp.getActiveSpreadsheet());
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Could not refresh the Hymn Bank tab: ' + error);
    }
    return 'failed';
  }
}

// A Weekly Data problem must not stop the Sabbath Calendar's upkeep.
function populateUpcomingWeeklyDataRowsSafely_(now) {
  try {
    return populateUpcomingWeeklyDataRows_(SpreadsheetApp.getActiveSpreadsheet(), now);
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Could not add Weekly Data rows: ' + error);
    }
    return 0;
  }
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

function hideOldBulletinScheduleRows_(sheet, now) {
  var columns = getBulletinScheduleMaintenanceColumns_(sheet);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  var today = getBulletinMaintenanceDateOnly_(now || new Date());
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
  // Visible rows are shown in contiguous runs too: with a year of upcoming
  // Saturdays, one call per row would be dozens of calls on every open.
  var shownStart = 0;

  function flushHiddenRange(endRow) {
    if (!hiddenStart) {
      return;
    }
    var count = endRow - hiddenStart;
    sheet.hideRows(hiddenStart, count);
    hiddenCount += count;
    hiddenStart = 0;
  }

  function flushShownRange(endRow) {
    if (!shownStart) {
      return;
    }
    sheet.showRows(shownStart, endRow - shownStart);
    shownStart = 0;
  }

  for (var index = 0; index < rowCount; index += 1) {
    var date = parseBulletinMaintenanceDate_(rawValues[index][0], displayValues[index][0]);
    var rowNumber = index + 2;
    if (!date) {
      flushHiddenRange(rowNumber);
      flushShownRange(rowNumber);
      continue;
    }

    var shouldHide =
      date < currentQuarterStart && date < previousWeekStart;
    if (shouldHide) {
      flushShownRange(rowNumber);
      if (!hiddenStart) {
        hiddenStart = rowNumber;
      }
    } else {
      flushHiddenRange(rowNumber);
      if (!shownStart) {
        shownStart = rowNumber;
      }
    }
  }
  flushHiddenRange(lastRow + 1);
  flushShownRange(lastRow + 1);
  return hiddenCount;
}

/**
 * The Sabbath Calendar's own columns (BULLETIN_SHEET_COLUMNS), each found by
 * its header wherever it is, as the bulletin finds them. These are the ones
 * kept in English; a column a planner adds is left alone.
 */
function getSabbathCalendarColumnNumbers_(sheet) {
  var expected = BULLETIN_SHEET_COLUMNS[BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName];
  var headers = getBulletinHeaders_(
    sheet,
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName,
    sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getDisplayValues()[0],
  );
  var brooklynStart = expected.indexOf('Brooklyn Sermon');
  var seen = {};
  var numbers = [];
  expected.forEach(function (header, index) {
    var occurrence = seen[header] || 0;
    seen[header] = occurrence + 1;
    var location = '';
    if (expected.indexOf(header) !== expected.lastIndexOf(header)) {
      location = index >= brooklynStart ? 'brooklyn' : 'queens';
    }
    var found = findScheduleColumn_(headers, header, location, occurrence);
    if (found !== -1 && numbers.indexOf(found + 1) === -1) {
      numbers.push(found + 1);
    }
  });
  return numbers;
}

function getBulletinScheduleMaintenanceColumns_(sheet) {
  var headers = getBulletinHeaders_(
    sheet,
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName,
    sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0],
  );
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
    ' upcoming Saturday(s) and ' +
    (result.weeklyRows || 0) +
    ' Weekly Data row(s), and hid ' +
    result.hidden +
    ' old row(s).'
  );
}
