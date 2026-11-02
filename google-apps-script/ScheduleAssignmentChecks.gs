/**
 * Planner safeguards for the Sabbath Calendar roster.
 *
 * 1. Conflict highlighting: when the same person is assigned to more than one
 *    role on the same Sabbath (row), every cell holding that person is painted
 *    pale red, with a hover note naming their other roles. Queens and Brooklyn columns are compared together because one
 *    person cannot serve both locations at once. The scan always covers every
 *    data row, including rows hidden by schedule maintenance and rows appended
 *    for upcoming quarters, so highlights never drift from the sheet's contents.
 *
 * 2. Unknown-name warning: when an edited person cell contains a name that is
 *    not in the Name Dictionary, the editor gets a popup with close spellings
 *    from the dictionary as suggestions. The value is kept. Once the
 *    installable trigger exists, the popup is a dialog that can apply a
 *    suggestion or add the name (and its Chinese name) to the dictionary; the
 *    trigger installs itself the first time a bulletin admin uses the Printed
 *    Bulletin menu. Until then it is a plain alert, because Google does not
 *    let simple triggers open HTML dialogs.
 *
 * Only the roster's person columns are read or painted, each found by its
 * header wherever it is: columns can be moved, inserted, or added without
 * changing anything here. Row 1 (headers) and the date, quarter, and service
 * metadata columns are never touched. Only fills and notes the script wrote
 * are ever changed.
 */

// Staff-facing text (dialogs, alerts, errors, notes) is in English and
// Simplified Chinese, because the people who run the bulletin read Simplified.
// Everything printed stays in Traditional Chinese on purpose. Keep the two
// apart: see "Chinese script" in docs/operations/bulletin-automation.md.
var SCHEDULE_ASSIGNMENT_CHECK_CONFIG = Object.freeze({
  nameDictionarySheetName: 'Name Dictionary',
  firstPersonHeader: 'Queens Sermon',
  // Google Sheets palette "light red 2".
  conflictColor: '#ea9999',
  notePrefix: 'Duplicate / 重复:',
  // Earlier wordings of the note, including the Traditional Chinese one from
  // before #565. Still recognized as the script's own, so those notes are
  // rewritten instead of being kept as planner notes.
  legacyNotePrefixes: ['Roster check / 名單檢查', 'Duplicate / 重複:'],
  maxSuggestions: 3,
  nameCheckTriggerHandler: 'onScheduleNameCheckEdit',
  nameCheckTriggerProperty: 'SCHEDULE_NAME_CHECK_TRIGGER',
});

var SCHEDULE_NAME_SEPARATOR_PATTERN = /(\s*(?:\/|&|\+|,|;|\n|\band\b)\s*)/i;

/**
 * The roster's person columns, in sheet order: each expected header from
 * Queens Sermon on, found by name in the sheet's own header row (#558's
 * follow-up). A repeated header (Chair/Pastoral Prayer, Offering Prayer) is
 * found as findScheduleColumn_ finds it, and labeled with its location. A
 * missing column is skipped, and a column the bulletin doesn't know is left
 * alone.
 */
function getSchedulePersonColumns_(sheet) {
  var expected =
    BULLETIN_SHEET_COLUMNS[BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName];
  var first = expected.indexOf(SCHEDULE_ASSIGNMENT_CHECK_CONFIG.firstPersonHeader);
  var brooklynStart = expected.indexOf('Brooklyn Sermon');
  var lastColumn = Math.max(1, sheet.getLastColumn());
  var headers = getBulletinHeaders_(
    sheet,
    BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName,
    sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0],
  );
  var seen = {};
  var columns = [];
  expected.forEach(function (header, index) {
    var occurrence = seen[header] || 0;
    seen[header] = occurrence + 1;
    if (index < first) {
      return;
    }
    var location = '';
    if (expected.indexOf(header) !== expected.lastIndexOf(header)) {
      location = index >= brooklynStart ? 'brooklyn' : 'queens';
    }
    var found = findScheduleColumn_(headers, header, location, occurrence);
    var columnNumber = found + 1;
    if (found === -1 || columns.some(function (column) { return column.number === columnNumber; })) {
      return;
    }
    columns.push({
      number: columnNumber,
      label: location ? (location === 'brooklyn' ? 'Brooklyn ' : 'Queens ') + header : header,
    });
  });
  return columns.sort(function (a, b) {
    return a.number - b.number;
  });
}

function findSchedulePersonColumn_(columns, columnNumber) {
  for (var index = 0; index < columns.length; index += 1) {
    if (columns[index].number === columnNumber) {
      return columns[index];
    }
  }
  return null;
}

function isSchedulePersonCell_(sheet, rowNumber, columnNumber) {
  return rowNumber >= 2 && !!findSchedulePersonColumn_(getSchedulePersonColumns_(sheet), columnNumber);
}

/**
 * Splits a roster cell such as "John Chen / Mary Lin" into individual names,
 * skipping placeholders like TBD and Choir that are not people.
 */
function splitScheduleCellNames_(value) {
  return String(value || '')
    .split(SCHEDULE_NAME_SEPARATOR_PATTERN)
    .filter(function (part, index) {
      return index % 2 === 0;
    })
    .map(function (part) {
      return part.trim().replace(/\s+/g, ' ');
    })
    .filter(function (name) {
      return name && SAFE_SINGLE_VALUES.indexOf(name.toLowerCase()) === -1;
    });
}

/**
 * Reads the Name Dictionary into lookups keyed by normalized English name and
 * by derived pinyin alias. Returns null when the sheet does not exist, which
 * disables unknown-name warnings rather than flagging every name.
 */
function loadScheduleNameLookup_() {
  var sheet = getBulletinSheet_(
    SpreadsheetApp.getActiveSpreadsheet(),
    SCHEDULE_ASSIGNMENT_CHECK_CONFIG.nameDictionarySheetName,
  );
  if (!sheet) {
    return null;
  }

  var lookup = { englishByKey: {}, englishByPinyinKey: {}, names: [] };
  readTable_(sheet).displayRows.forEach(function (row) {
    var english = String(row[0] || '').trim().replace(/\s+/g, ' ');
    var chinese = String(row[1] || '').trim();
    var englishKey = normalizePhysicalNameKey_(english);
    if (!englishKey) {
      return;
    }
    if (!lookup.englishByKey[englishKey]) {
      lookup.englishByKey[englishKey] = english;
      lookup.names.push(english);
    }
    getPhysicalPinyinAliases_(chinese).forEach(function (alias) {
      var pinyinKey = normalizePhysicalPinyinKey_(alias);
      if (pinyinKey && !lookup.englishByPinyinKey[pinyinKey]) {
        lookup.englishByPinyinKey[pinyinKey] = english;
      }
    });
  });
  return lookup;
}

/**
 * Returns the dictionary's English spelling for a name, or '' when unknown.
 * Pinyin aliases resolve too, so "Chen Wei" and "Wei Chen" count as the same
 * dictionary entry.
 */
function resolveScheduleName_(name, lookup) {
  if (!lookup) {
    return '';
  }
  return (
    lookup.englishByKey[normalizePhysicalNameKey_(name)] ||
    lookup.englishByPinyinKey[normalizePhysicalPinyinKey_(name)] ||
    ''
  );
}

function getScheduleNameIdentity_(name, lookup) {
  return normalizePhysicalNameKey_(resolveScheduleName_(name, lookup) || name);
}

/**
 * For each person cell in one roster row, lists the other cells (as indexes
 * into the row) that hold one of the same people. An empty list means no
 * conflict. A repeated name inside a single cell is not a conflict.
 */
function findScheduleRowConflicts_(row, lookup) {
  var identitiesByCell = row.map(function (value) {
    var identities = {};
    splitScheduleCellNames_(value).forEach(function (name) {
      identities[getScheduleNameIdentity_(name, lookup)] = true;
    });
    return Object.keys(identities);
  });

  var cellsByIdentity = {};
  identitiesByCell.forEach(function (identities, columnIndex) {
    identities.forEach(function (identity) {
      (cellsByIdentity[identity] = cellsByIdentity[identity] || []).push(columnIndex);
    });
  });

  return identitiesByCell.map(function (identities, columnIndex) {
    var others = [];
    identities.forEach(function (identity) {
      cellsByIdentity[identity].forEach(function (otherIndex) {
        if (otherIndex !== columnIndex && others.indexOf(otherIndex) === -1) {
          others.push(otherIndex);
        }
      });
    });
    return others.sort(function (x, y) {
      return x - y;
    });
  });
}

/**
 * Names the person's other roles that Sabbath by column, for example
 * "Duplicate / 重复: English Teacher". The repeated Chair/Pastoral Prayer and
 * Offering Prayer headers carry their location, so the note is unambiguous.
 */
function buildScheduleConflictNote_(otherLabels) {
  if (!otherLabels.length) {
    return '';
  }
  return SCHEDULE_ASSIGNMENT_CHECK_CONFIG.notePrefix + ' ' + otherLabels.join(', ');
}

function isScheduleConflictNote_(note) {
  var config = SCHEDULE_ASSIGNMENT_CHECK_CONFIG;
  return [config.notePrefix].concat(config.legacyNotePrefixes).some(function (prefix) {
    return note.indexOf(prefix) === 0;
  });
}

/**
 * Repaints conflict highlights across every data row of the Sabbath Calendar:
 * a person in more than one cell of a row turns those cells pale red, with a
 * hover note listing the person's other roles that Sabbath. Only fills and
 * notes this script wrote are ever changed or cleared, which also clears
 * fills copied into newly appended quarter rows. A cell with a planner's own
 * note keeps that note and is only colored.
 */
function refreshScheduleRosterChecks_(sheet, lookup) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return 0;
  }

  var config = SCHEDULE_ASSIGNMENT_CHECK_CONFIG;
  var columns = getSchedulePersonColumns_(sheet);
  if (!columns.length) {
    return 0;
  }
  // One read and write over the span the person columns cover; any other
  // column inside it is read but left as it was.
  var firstColumn = columns[0].number;
  var span = columns[columns.length - 1].number - firstColumn + 1;
  var range = sheet.getRange(2, firstColumn, lastRow - 1, span);
  var values = range.getDisplayValues();
  var backgrounds = range.getBackgrounds();
  var notes = range.getNotes();
  var conflictCells = 0;
  var backgroundsChanged = false;
  var notesChanged = false;

  values.forEach(function (row, rowIndex) {
    var people = columns.map(function (column) {
      return row[column.number - firstColumn];
    });
    findScheduleRowConflicts_(people, lookup).forEach(function (others, personIndex) {
      var columnIndex = columns[personIndex].number - firstColumn;
      var current = String(backgrounds[rowIndex][columnIndex] || '').toLowerCase();
      if (others.length) {
        conflictCells += 1;
        if (current !== config.conflictColor) {
          backgrounds[rowIndex][columnIndex] = config.conflictColor;
          backgroundsChanged = true;
        }
      } else if (current === config.conflictColor) {
        backgrounds[rowIndex][columnIndex] = null;
        backgroundsChanged = true;
      }

      var currentNote = String(notes[rowIndex][columnIndex] || '');
      if (currentNote && !isScheduleConflictNote_(currentNote)) {
        return;
      }
      var wantedNote = buildScheduleConflictNote_(
        others.map(function (otherIndex) {
          return columns[otherIndex].label;
        }),
      );
      if (wantedNote !== currentNote) {
        notes[rowIndex][columnIndex] = wantedNote;
        notesChanged = true;
      }
    });
  });

  if (backgroundsChanged) {
    range.setBackgrounds(backgrounds);
  }
  if (notesChanged) {
    range.setNotes(notes);
  }
  return conflictCells;
}

function refreshScheduleRosterChecksSafely_(sheet, lookup) {
  try {
    return refreshScheduleRosterChecks_(
      sheet || getBulletinScheduleMaintenanceSheet_(),
      typeof lookup === 'undefined' ? loadScheduleNameLookup_() : lookup,
    );
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Schedule roster checks skipped: ' + error);
    }
    return 0;
  }
}

/**
 * Suggests dictionary names that are likely what the editor meant: small
 * spelling mistakes, swapped name order, or a first name typed on its own.
 */
function suggestScheduleNames_(name, lookup) {
  if (!lookup) {
    return [];
  }
  var key = normalizePhysicalNameKey_(name);
  var sortedKey = key.split(' ').sort().join(' ');
  var maxDistance = key.length >= 6 ? 2 : 1;
  var candidates = [];

  lookup.names.forEach(function (english) {
    var candidateKey = normalizePhysicalNameKey_(english);
    var distance = Math.min(
      getScheduleNameEditDistance_(key, candidateKey),
      getScheduleNameEditDistance_(sortedKey, candidateKey.split(' ').sort().join(' ')),
    );
    if (distance <= maxDistance) {
      candidates.push({ name: english, score: distance });
    } else if (key.indexOf(' ') === -1 && candidateKey.split(' ')[0] === key) {
      candidates.push({ name: english, score: maxDistance + 1 });
    }
  });

  return candidates
    .sort(function (a, b) {
      return a.score - b.score || a.name.localeCompare(b.name);
    })
    .slice(0, SCHEDULE_ASSIGNMENT_CHECK_CONFIG.maxSuggestions)
    .map(function (candidate) {
      return candidate.name;
    });
}

// Optimal string alignment distance: Levenshtein plus adjacent swaps, so a
// typo such as "Jonh" is one edit from "John".
function getScheduleNameEditDistance_(a, b) {
  var rows = [];
  for (var i = 0; i <= a.length; i += 1) {
    rows[i] = [i];
  }
  for (var j = 0; j <= b.length; j += 1) {
    rows[0][j] = j;
  }
  for (i = 1; i <= a.length; i += 1) {
    for (j = 1; j <= b.length; j += 1) {
      var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + cost,
      );
      if (
        i > 1 &&
        j > 1 &&
        a.charAt(i - 1) === b.charAt(j - 2) &&
        a.charAt(i - 2) === b.charAt(j - 1)
      ) {
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
      }
    }
  }
  return rows[a.length][b.length];
}

/**
 * Lists names in the edited person cells that the Name Dictionary does not
 * know, once per name, with the cell and Sabbath where each first appears.
 */
function findUnknownScheduleNames_(range, lookup) {
  if (!lookup) {
    return [];
  }
  var sheet = range.getSheet();
  var columns = getSchedulePersonColumns_(sheet);
  var values = range.getDisplayValues();
  var seen = {};
  var unknown = [];

  values.forEach(function (row, rowIndex) {
    row.forEach(function (value, columnIndex) {
      var rowNumber = range.getRow() + rowIndex;
      var columnNumber = range.getColumn() + columnIndex;
      var personColumn = rowNumber >= 2 ? findSchedulePersonColumn_(columns, columnNumber) : null;
      if (!personColumn) {
        return;
      }
      splitScheduleCellNames_(value).forEach(function (name) {
        var key = normalizePhysicalNameKey_(name);
        if (seen[key] || resolveScheduleName_(name, lookup)) {
          return;
        }
        seen[key] = true;
        unknown.push({
          name: name,
          row: rowNumber,
          column: columnNumber,
          role: personColumn.label,
          date: sheet.getRange(rowNumber, 1).getDisplayValue(),
          suggestions: suggestScheduleNames_(name, lookup),
        });
      });
    });
  });
  return unknown;
}

function isScheduleNameCheckTriggerInstalled_() {
  try {
    return (
      PropertiesService.getScriptProperties().getProperty(
        SCHEDULE_ASSIGNMENT_CHECK_CONFIG.nameCheckTriggerProperty,
      ) === 'installed'
    );
  } catch (error) {
    return false;
  }
}

/**
 * Installs the unknown-name dialog trigger the first time a bulletin admin
 * uses the Printed Bulletin menu. It cannot run from onOpen: simple triggers
 * are not allowed to create triggers. Restricting it to admins keeps the
 * trigger owned by a long-lived staff account, and the script property keeps
 * a second admin from installing a duplicate that would double every dialog.
 */
function ensureScheduleNameCheckTrigger_() {
  if (isScheduleNameCheckTriggerInstalled_() || !isPrintedBulletinAdmin_()) {
    return false;
  }
  try {
    installScheduleNameCheckTrigger();
    return true;
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Unknown-name dialog trigger not installed: ' + error);
    }
    return false;
  }
}

/**
 * Installs the unknown-name dialog trigger for the current account. Usually
 * ensureScheduleNameCheckTrigger_ does this automatically; run it from the
 * Apps Script editor only to reinstall. Safe to run again.
 */
function installScheduleNameCheckTrigger() {
  var handler = SCHEDULE_ASSIGNMENT_CHECK_CONFIG.nameCheckTriggerHandler;
  var exists = ScriptApp.getProjectTriggers().some(function (trigger) {
    return trigger.getHandlerFunction() === handler;
  });
  if (!exists) {
    ScriptApp.newTrigger(handler)
      .forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet())
      .onEdit()
      .create();
  }
  PropertiesService.getScriptProperties().setProperty(
    SCHEDULE_ASSIGNMENT_CHECK_CONFIG.nameCheckTriggerProperty,
    'installed',
  );
  return exists ? 'Trigger already installed.' : 'Trigger installed.';
}

/**
 * Installable onEdit handler. Runs alongside the simple onEdit trigger, which
 * keeps handling the English-only guard and conflict highlighting.
 */
function onScheduleNameCheckEdit(e) {
  if (
    !e ||
    !e.range ||
    !isBulletinTab_(e.range.getSheet(), BULLETIN_SCHEDULE_MAINTENANCE_CONFIG.scheduleSheetName)
  ) {
    return;
  }
  var unknown = findUnknownScheduleNames_(e.range, loadScheduleNameLookup_());
  if (!unknown.length) {
    return;
  }
  try {
    var output = HtmlService.createHtmlOutput(buildUnknownScheduleNamesHtml_(unknown))
      .setWidth(520)
      .setHeight(Math.min(640, 220 + unknown.length * 190));
    SpreadsheetApp.getUi().showModalDialog(
      output,
      'Name not in Name Dictionary / 姓名不在姓名字典中',
    );
  } catch (error) {
    showUnknownScheduleNamesNotice_(unknown);
  }
}

function getUnknownScheduleNamesNoticeText_(unknown) {
  var lines = unknown.map(function (entry) {
    return (
      '• "' + entry.name + '" (' + entry.role + ', ' + entry.date + ')' +
      (entry.suggestions.length
        ? ' — did you mean / 您是否指: ' + entry.suggestions.join(', ') + '?'
        : '')
    );
  });
  return (
    'These names are not in the Name Dictionary tab. Please check the spelling, ' +
    'or add the name (with the Chinese name if there is one) so the printed ' +
    'bulletin shows it correctly.\n' +
    '以下姓名不在“Name Dictionary”工作表中。请检查拼写，或添加此姓名（如有中文姓名请一并填写），' +
    '以便纸质周刊正确显示。\n\n' +
    lines.join('\n')
  );
}

function showUnknownScheduleNamesNotice_(unknown) {
  var title = 'Name not in Name Dictionary / 姓名不在姓名字典中';
  var message = getUnknownScheduleNamesNoticeText_(unknown);
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui && ui.alert && ui.ButtonSet && ui.ButtonSet.OK) {
      ui.alert(title, message, ui.ButtonSet.OK);
      return;
    }
  } catch (error) {
    // Fall through to a toast, matching the English-only guard's fallback.
  }
  if (SpreadsheetApp.getActiveSpreadsheet) {
    SpreadsheetApp.getActiveSpreadsheet().toast(message, title, 10);
  }
}

function buildUnknownScheduleNamesHtml_(unknown) {
  var entriesJson = JSON.stringify(unknown)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026');
  return (
    '<!doctype html><html><head><base target="_top"><style>' +
    'body{color:#202124;font:14px Arial,sans-serif;margin:0;padding:4px 2px 12px;}' +
    '.intro{color:#5f6368;font-size:13px;line-height:1.5;margin:0 0 14px;}' +
    '.entry{border:1px solid #dadce0;border-left:4px solid #ea9999;border-radius:8px;margin:0 0 12px;padding:12px 14px;}' +
    '.entry h2{font-size:16px;margin:0 0 2px;}' +
    '.where{color:#5f6368;font-size:12px;margin:0 0 10px;}' +
    '.label{color:#3c4043;font-size:12px;font-weight:600;margin:8px 0 6px;}' +
    '.suggestions{display:flex;flex-wrap:wrap;gap:6px;}' +
    '.suggestion{background:#e8f0fe;border:1px solid #1a73e8;border-radius:16px;color:#174ea6;cursor:pointer;font-size:13px;padding:6px 12px;}' +
    '.add{display:grid;gap:6px;grid-template-columns:1fr 1fr auto;}' +
    'input{border:1px solid #bdc1c6;border-radius:4px;box-sizing:border-box;font:14px Arial,sans-serif;min-width:0;padding:7px 9px;}' +
    '.primary{background:#1a73e8;border:0;border-radius:4px;color:#fff;cursor:pointer;font-size:13px;font-weight:600;padding:7px 12px;white-space:nowrap;}' +
    'button:disabled{cursor:default;opacity:.5;}' +
    '.status{font-size:12px;margin-top:8px;min-height:1em;}' +
    '.status.ok{color:#137333;}.status.error{color:#a50e0e;}' +
    '.actions{display:flex;justify-content:space-between;margin-top:6px;}' +
    '.link{background:none;border:0;color:#1a73e8;cursor:pointer;font-size:13px;padding:6px 0;}' +
    '.close{background:#f1f3f4;border:0;border-radius:4px;cursor:pointer;font-size:13px;padding:7px 14px;}' +
    '</style></head><body>' +
    '<p class="intro">These names are not in the Name Dictionary. Pick the intended name, or add a new one (with the Chinese name if there is one).<br>' +
    '以下姓名不在姓名字典中。请选择正确的姓名，或添加姓名（如有中文姓名请一并填写）。</p>' +
    '<div id="entries"></div>' +
    '<div class="actions"><button type="button" class="link" id="openDictionary">Open Name Dictionary tab / 打开姓名字典工作表</button>' +
    '<button type="button" class="close" onclick="google.script.host.close()">Close / 关闭</button></div>' +
    '<script>' +
    'var entries=' + entriesJson + ';' +
    'function el(tag,className,text){var node=document.createElement(tag);if(className){node.className=className;}if(text){node.textContent=text;}return node;}' +
    'function setStatus(node,ok,text){node.className="status "+(ok?"ok":"error");node.textContent=text;}' +
    'function lock(card){Array.prototype.forEach.call(card.querySelectorAll("button,input"),function(control){control.disabled=true;});}' +
    'function run(card,status,fn,arg,okText){lock(card);google.script.run.withSuccessHandler(function(){setStatus(status,true,okText);})' +
    '.withFailureHandler(function(error){Array.prototype.forEach.call(card.querySelectorAll("button,input"),function(control){control.disabled=false;});' +
    'setStatus(status,false,(error&&error.message)||String(error));})[fn](arg);}' +
    'entries.forEach(function(entry){var card=el("div","entry");card.appendChild(el("h2","","\\u201c"+entry.name+"\\u201d"));' +
    'card.appendChild(el("p","where",entry.role+" \\u00b7 "+entry.date));var status=el("div","status");' +
    'if(entry.suggestions.length){card.appendChild(el("div","label","Did you mean? / 您是否指："));var list=el("div","suggestions");' +
    'entry.suggestions.forEach(function(suggestion){var button=el("button","suggestion",suggestion);button.type="button";' +
    'button.onclick=function(){run(card,status,"replaceScheduleNameFromDialog",{row:entry.row,column:entry.column,from:entry.name,to:suggestion},' +
    '"Replaced with "+suggestion+" / 已改为 "+suggestion);};list.appendChild(button);});card.appendChild(list);}' +
    'card.appendChild(el("div","label","Add to Name Dictionary / 添加到姓名字典"));var form=el("div","add");' +
    'var english=el("input");english.value=entry.name;english.placeholder="English name / 英文姓名";english.setAttribute("aria-label","English name");' +
    'var chinese=el("input");chinese.placeholder="Chinese name (optional) / 中文姓名（可选）";chinese.setAttribute("aria-label","Chinese name");' +
    'var add=el("button","primary","Add / 添加");add.type="button";add.onclick=function(){if(!english.value.trim()){setStatus(status,false,"English name is required. / 必须填写英文姓名。");return;}' +
    'run(card,status,"addScheduleNameToDictionary",{english:english.value,chinese:chinese.value},"Added to Name Dictionary / 已添加到姓名字典");};' +
    'form.appendChild(english);form.appendChild(chinese);form.appendChild(add);card.appendChild(form);card.appendChild(status);' +
    'document.getElementById("entries").appendChild(card);});' +
    'document.getElementById("openDictionary").onclick=function(){google.script.run.withSuccessHandler(function(){google.script.host.close();}).openNameDictionaryFromDialog();};' +
    '</script></body></html>'
  );
}

function getScheduleDialogText_(value, label) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value)
    .trim()
    .replace(/\s+/g, ' ');
  if (!text || text.length > 80) {
    throw new Error(label + ' must be 1–80 characters. / ' + label + ' 必须为 1–80 个字符。');
  }
  return text;
}

/**
 * Dialog action: appends an English name, and optionally its Chinese name, to
 * the Name Dictionary. Returns without writing if the English name exists.
 */
function addScheduleNameToDictionary(request) {
  var english = getScheduleDialogText_(request && request.english, 'English name');
  if (/[㐀-䶿一-鿿豈-﫿]/.test(english)) {
    throw new Error(
      'Put Chinese characters in the Chinese name box. / 请将中文字填入中文姓名框。',
    );
  }
  var chinese = String((request && request.chinese) || '').trim();
  if (chinese.length > 80) {
    throw new Error('Chinese name is too long. / 中文姓名过长。');
  }

  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getBulletinSheet_(
    spreadsheet,
    SCHEDULE_ASSIGNMENT_CHECK_CONFIG.nameDictionarySheetName,
  );
  if (!sheet) {
    throw new Error('Name Dictionary sheet not found. / 找不到姓名字典工作表。');
  }
  var lookup = loadScheduleNameLookup_();
  if (lookup.englishByKey[normalizePhysicalNameKey_(english)]) {
    return { added: false };
  }
  sheet.appendRow([english, chinese]);
  refreshScheduleRosterChecksSafely_();
  return { added: true };
}

/**
 * Dialog action: replaces one name inside a roster cell with a dictionary
 * suggestion, leaving any other names and separators in the cell unchanged.
 */
function replaceScheduleNameFromDialog(request) {
  var row = Number(request && request.row);
  var column = Number(request && request.column);
  var sheet = getBulletinScheduleMaintenanceSheet_();
  if (!isSchedulePersonCell_(sheet, row, column)) {
    throw new Error('That cell is not a roster name cell. / 此单元格不是名单中的姓名单元格。');
  }
  var from = normalizePhysicalNameKey_(request.from);
  var to = getScheduleDialogText_(request.to, 'Name');
  var cell = sheet.getRange(row, column);
  var replaced = false;
  var updated = String(cell.getDisplayValue())
    .split(SCHEDULE_NAME_SEPARATOR_PATTERN)
    .map(function (part, index) {
      if (index % 2 === 0 && !replaced && normalizePhysicalNameKey_(part) === from) {
        replaced = true;
        return to;
      }
      return part;
    })
    .join('');
  if (!replaced) {
    throw new Error('The cell has changed since this check. / 此单元格的内容在检查后已被更改。');
  }
  cell.setValue(updated);
  refreshScheduleRosterChecksSafely_(sheet);
  return { replaced: true };
}

function openNameDictionaryFromDialog() {
  var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = getBulletinSheet_(
    spreadsheet,
    SCHEDULE_ASSIGNMENT_CHECK_CONFIG.nameDictionarySheetName,
  );
  if (sheet) {
    spreadsheet.setActiveSheet(sheet);
    sheet.setActiveRange(sheet.getRange(sheet.getLastRow() + 1, 1));
  }
  return null;
}
