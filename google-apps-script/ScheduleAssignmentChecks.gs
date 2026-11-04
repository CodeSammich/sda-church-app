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
    '.status.ok{color:#137333;}.status.error{color:#a50e0e;}.status.warn{color:#b06000;line-height:1.45;white-space:pre-line;}' +
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
    'function unlock(card){Array.prototype.forEach.call(card.querySelectorAll("button,input"),function(control){control.disabled=false;});}' +
    'function run(card,status,fn,arg,okText){lock(card);google.script.run.withSuccessHandler(function(){setStatus(status,true,okText);})' +
    '.withFailureHandler(function(error){unlock(card);' +
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
    'var add=el("button","primary","Add / 添加");add.type="button";var allowSimplified=false;' +
    'chinese.oninput=function(){allowSimplified=false;add.textContent="Add / 添加";};' +
    'add.onclick=function(){if(!english.value.trim()){setStatus(status,false,"English name is required. / 必须填写英文姓名。");return;}' +
    'lock(card);google.script.run.withSuccessHandler(function(result){if(result&&result.simplifiedWarning){unlock(card);allowSimplified=true;' +
    'add.textContent="Add anyway / 仍然添加";status.className="status warn";status.textContent=result.simplifiedWarning;return;}' +
    'setStatus(status,true,"Added to Name Dictionary / 已添加到姓名字典");}).withFailureHandler(function(error){unlock(card);' +
    'setStatus(status,false,(error&&error.message)||String(error));}).addScheduleNameToDictionary({english:english.value,chinese:chinese.value,allowSimplified:allowSimplified});};' +
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
  // Names print as typed, so a Simplified name prints in Simplified. Warn once
  // here, where the name is entered, and add it if the editor confirms. Never
  // convert it: a surname such as 余, 于 or 范 is also a Traditional character.
  var simplified = findSimplifiedOnlyChinese_(chinese);
  if (simplified && !(request && request.allowSimplified)) {
    return {
      added: false,
      simplifiedWarning:
        'The Chinese name has Simplified characters: ' + simplified + '. The printed bulletin is in ' +
        'Traditional Chinese, and prints names exactly as they are in the Name Dictionary. If this ' +
        'person writes their name in Traditional, change it here. Otherwise, click Add anyway.\n' +
        '中文姓名含有简体字：' + simplified + '。纸质周刊使用繁体中文，并按姓名字典中的写法打印姓名。' +
        '如果此人的姓名用繁体书写，请在这里修改；否则请点击“仍然添加”。',
    };
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

// The Simplified characters in text that aren't also Traditional, each once,
// such as 张 and 聪 but not 余 or 范 (#623).
function findSimplifiedOnlyChinese_(text) {
  var found = '';
  String(text || '').replace(/[㐀-鿿]/g, function (character) {
    if (SIMPLIFIED_ONLY_CHINESE_CHARACTERS_.indexOf(character) !== -1 && found.indexOf(character) === -1) {
      found += character;
    }
    return character;
  });
  return found;
}

/**
 * Every character OpenCC (Apache-2.0, commit 178f05dbc5) converts to
 * Traditional that is neither one of its Traditional forms in STCharacters.txt
 * nor their Taiwan or Hong Kong form in TWVariants.txt and HKVariants.txt, in
 * Unicode order. 张 → 張 is here. 余 → 餘 余, 于 → 於 于 and 范 → 範 范 aren't,
 * because they're also Traditional, often as surnames, and nor are 温 and 峰,
 * the Taiwan forms of 溫 and 峯. Only characters below U+10000, which covers
 * names typed with a Simplified keyboard.
 */
var SIMPLIFIED_ONLY_CHINESE_CHARACTERS_ =
  '㐷㐽㑇㑈㑔㑩㓆㓥㓰㔉㖊㖞㘎㚯㛀㛟㛠㛣㛤㛿㟆㟜㟥㡎㤘㤽㥪㧏㧐㧑㧟㧰㨫㭎㭏㭣㭤㭴㱩㱮㲿㳔㳕㳠㳡㳢㳽㴋㶉㶶㶽㺍㻅㻏㻘䀥䁖䂵䃅䅉䅟䅪䇲䉤' +
  '䌶䌷䌸䌹䌺䌻䌼䌽䌾䌿䍀䍁䍠䎬䏝䑽䓓䓕䓖䓨䗖䘛䘞䙊䙌䙓䜣䜤䜥䜧䜩䝙䞌䞍䞎䞐䟢䢀䢁䢂䥺䥽䥾䥿䦀䦁䦂䦃䦅䦆䦶䦷䩄䭪䯃䯄䯅䲝䲞䲟䲠䲡䲢䲣' +
  '䴓䴔䴕䴖䴗䴘䴙䶮与专业丛东丝丢两严丧个临为丽举么义乌乐乔习乡书买乱争亏亚产亩亲亵亸亿仅从仑仓仪们众优会伛伞伟传伡伣伤伥伦伧伪伫体' +
  '佥侠侣侥侦侧侨侩侪侬侭俣俦俨俩俪俫俭债倾偬偻偾偿傤傥傧储傩儿兖兰关兴兹养兽冁内冈册写军农冯冲决况冻净凄凉减凑凛凤凫凭凯击凿刍刘则' +
  '刚创删别刬刭刹刽刾刿剀剂剐剑剥剧劝办务劢动励劲劳势勋勚匀匦匮区医华协单卖卢卤卫却卺厅历厉压厌厍厐厕厢厣厦厨厩厮县参叆叇双发变叙叠' +
  '号叹叽吓吕吗吨听启吴呐呒呓呕呖呗员呙呛呜咏咙咛咝咤响哑哒哓哔哕哗哙哜哝哟唛唝唠唡唢唤啧啬啭啮啯啰啴啸喷喽喾嗫嗳嘘嘤嘱噜嚣团园围囵' +
  '国图圆圣圹场坏块坚坛坜坝坞坟坠垄垅垆垒垦垩垫垭垯垱垲垴埘埙埚堑堕塆墙壮声壳壶壸处备复够头夹夺奁奂奋奖奥妆妇妈妩妪妫姗姹娄娅娆娇娈' +
  '娱娲娴婳婴婵婶媭嫒嫔嫱嬷孙学孪宁宝实宠审宪宫宽宾寝对寻导寿将尔尘尝尧尴尽层屃屉届属屡屦屿岁岂岖岗岘岚岛岭岽岿峃峄峡峣峤峥峦崂崃崄' +
  '崭嵘嵚嵝巅巩巯币帅师帏帐帜带帧帮帱帻帼幂并庄庆庐庑库应庙庞废庼廪开异弃弑张弥弪弯弹强归当录彟彦彨彻径徕忆忏忧忾怀态怂怃怄怅怆怜总' +
  '怼怿恋恒恳恶恸恹恺恻恼恽悫悬悭悮悯惊惧惨惩惫惬惭惮惯愤愦慑慭懑懒懔戆戋戏戗战戬戯扑执扩扪扫扬扰抚抛抟抠抡抢护报担拟拢拣拥拦拧拨择' +
  '挚挛挜挝挞挟挠挡挢挣挤挥挦捞损捡换捣掳掴掷掸掺掼揽揿搀搁搂搄搅携摄摅摆摇摈摊撄撑撵撷撸撺擜擞攒敌敛敩数斋斓斩断无旧时旷旸昙昵昼昽' +
  '显晋晒晓晔晕晖暂暅暧术机杀杂权条来杨杩构枞枢枣枥枧枨枪枫枭柠柽栀栅标栈栉栊栋栌栎栏树栖样栾桠桡桢档桤桥桦桧桨桩桪梦梼梾梿检棂椁椝' +
  '椟椠椢椤椫椭椮楼榄榇榈榉榝槚槛槟槠横樯樱橥橱橹橼檩欢欤欧歼殁殇残殒殓殚殡殴毁毂毕毙毡毵毶氇气氢氩汇汉汤汹沄沟没沣沤沥沦沧沨沩沪泞' +
  '泪泶泷泸泺泻泼泽泾洁洒洼浃浅浆浇浈浉浊测浍济浏浐浑浒浓浔浕涛涝涞涟涠涡涢涣涤润涧涨涩渊渌渍渎渐渑渔渖渗湾湿溁溃溅溆溇滗滚滞滟滠满' +
  '滢滤滥滦滨滩滪潆潇潋潍潜潴澛澜濑濒灏灭灯灵灾灿炀炉炖炜炝点炼炽烁烂烃烛烟烦烧烨烩烫烬热焕焖焘爱爷牍牦牵牺犊状犷犸犹狈狝狞独狭狮狯' +
  '狰狱狲猃猎猕猡猪猫猬献獭玑玙玚玛玮环现玱玺珐珑珰珲琎琏琐琼瑶瑷瑸璎瓒瓮瓯电画畅畴疖疗疟疠疡疬疭疮疯疱疴痈痉痒痖痨痪痫瘅瘆瘗瘘瘪瘫' +
  '瘾瘿癞癣癫皑皱皲盏盐监盖盗盘眍眦眬睁睐睑瞆瞒瞩矫矶矾矿砀码砖砗砚砜砺砻砾础硁硕硖硗硙硚硵碍碛碜碱礼祃祎祢祯祷祸禀禄禅离秃秆积称秽' +
  '秾稆稣稳穑穞穷窃窍窎窑窜窝窥窦窭竖竞笃笋笔笕笺笼笾筚筛筜筝筹筼签筿简箓箦箧箨箩箪箫篑篓篮篯篱簖籁籴类籼粜粝粤粪粮糁糇糍紧絷縆纟纠' +
  '纡红纣纤纥约级纨纩纪纫纬纭纮纯纰纱纲纳纴纵纶纷纸纹纺纻纼纽纾线绀绁绂练组绅细织终绉绊绋绌绍绎经绐绑绒结绔绕绖绗绘给绚绛络绝绞统绠' +
  '绡绢绣绤绥绦继绨绩绪绫绬续绮绯绰绱绲绳维绵绶绷绸绹绺绻综绽绾绿缀缁缂缃缄缅缆缇缈缉缊缋缌缍缎缏缐缑缒缓缔缕编缗缘缙缚缛缜缝缞缟缠' +
  '缡缢缣缤缥缦缧缨缩缪缫缬缭缮缯缰缱缲缳缴缵罂网罗罚罢罴羁羟羡翘翙翚耢耧耸耻聂聋职聍联聩聪肃肠肤肮肴肾肿胀胁胆胧胨胪胫胶脉脍脏脐脑' +
  '脓脔脚脶脸腘腭腻腼腾膑臜舆舣舰舱舻艰艳艺节芈芗芜芦苁苇苈苋苌苍苎苏苧茎茏茑茔茕茧荆荙荚荛荜荝荞荟荠荡荣荤荥荦荧荨荩荪荫荬荭荮药莅' +
  '莱莲莳莴莶获莸莹莺莼萚萝萤营萦萧萨蒇蒉蒋蒌蒏蓝蓟蓠蓣蓥蓦蔂蔷蔹蔺蔼蕰蕲蕴薮藓蘖虏虑虚虬虮虱虽虾虿蚀蚁蚂蚃蚕蚬蛊蛎蛏蛮蛰蛱蛲蛳蛴蜗' +
  '蝇蝈蝉蝼蝾螀螨蟏衅衔补衬衮袄袅袆袜袭袯装裆裈裢裣裤裥褛褴襕见观觃规觅视觇览觉觊觋觌觍觎觏觐觑觞触觯訚詟誉誊讠计订讣认讥讦讧讨让讪' +
  '讫讬训议讯记讱讲讳讴讵讶讷许讹论讻讼讽设访诀证诂诃评诅识诇诈诉诊诋诌词诎诏诐译诒诓诔试诖诗诘诙诚诛诜话诞诟诠诡询诣诤该详诧诨诩诪' +
  '诫诬语诮误诰诱诲诳说诵诶请诸诹诺读诼诽课诿谀谁谂调谄谅谆谇谈谉谊谋谌谍谎谏谐谑谒谓谔谕谖谗谘谙谚谛谜谝谞谟谠谡谢谣谤谥谦谧谨谩谪' +
  '谫谬谭谮谯谰谱谲谳谴谵谶豮贝贞负贠贡财责贤败账货质贩贪贫贬购贮贯贰贱贲贳贴贵贶贷贸费贺贻贼贽贾贿赀赁赂赃资赅赆赇赈赉赊赋赌赍赎赏' +
  '赐赑赒赓赔赕赖赗赘赙赚赛赜赝赞赟赠赡赢赣赪赵赶趋趱趸跃跄跞践跶跷跸跹跻踌踪踬踯蹑蹒蹰蹿躏躜躯车轧轨轩轪轫转轭轮软轰轱轲轳轴轵轶轷' +
  '轸轹轺轻轼载轾轿辀辁辂较辄辅辆辇辈辉辊辋辌辍辎辏辐辑辒输辔辕辖辗辘辙辚辞辩辫边辽达迁过迈运还这进远违连迟迩迳迹选逊递逦逻遗遥邓邝' +
  '邬邮邹邺邻郏郐郑郓郦郧郸酂酝酦酱酽酾酿释鉴銮錾钅钆钇针钉钊钋钌钍钎钏钐钑钒钓钔钕钖钗钘钙钚钛钜钝钞钟钠钡钢钣钤钥钦钧钨钩钪钫钬钭' +
  '钮钯钰钱钲钳钴钵钶钷钸钹钺钻钼钽钾钿铀铁铂铃铄铅铆铇铈铉铊铋铌铍铎铏铐铑铒铓铔铕铖铗铘铙铚铛铜铝铞铟铠铡铢铣铤铥铦铧铨铩铪铫铬铭' +
  '铮铯铰铱铲铳铴铵银铷铸铹铺铻铼铽链铿销锁锂锃锄锅锆锇锈锉锊锋锌锍锎锏锐锑锒锓锔锕锖锗锘错锚锛锜锝锞锟锠锡锢锣锤锥锦锧锨锩锪锫锬锭' +
  '键锯锰锱锲锳锴锵锶锷锸锹锺锻锼锽锾锿镀镁镂镃镄镅镆镇镈镉镊镋镌镍镎镏镐镑镒镓镔镕镖镗镘镙镚镛镜镝镞镟镠镡镢镣镤镥镦镧镨镩镪镫镬镭' +
  '镮镯镰镱镲镳镴镵镶长门闩闪闫闬闭问闯闰闱闲闳间闵闶闷闸闹闺闻闼闽闾闿阀阁阂阃阄阅阆阇阈阉阊阋阌阍阎阏阐阑阒阓阔阕阖阗阘阙阚阛队阳' +
  '阴阵阶际陆陇陈陉陕陦陧陨险随隐隶隽难雏雠雳雾霁霉霡霭靓靔静靥鞑鞒鞯鞲韦韧韨韩韪韫韬韵页顶顷顸项顺须顼顽顾顿颀颁颂颃预颅领颇颈颉颊' +
  '颋颌颍颎颏颐频颒颓颔颕颖颗题颙颚颛颜额颞颟颠颡颢颣颤颥颦颧风飏飐飑飒飓飔飕飖飗飘飙飚飞飨餍饣饤饥饦饧饨饩饪饫饬饭饮饯饰饱饲饳饴饵' +
  '饶饷饸饹饺饻饼饽饾饿馀馁馂馃馄馅馆馇馈馉馊馋馌馍馎馏馐馑馒馓馔馕马驭驮驯驰驱驲驳驴驵驶驷驸驹驺驻驼驽驾驿骀骁骂骃骄骅骆骇骈骉骊骋' +
  '验骍骎骏骐骑骒骓骔骕骖骗骘骙骚骛骜骝骞骟骠骡骢骣骤骥骦骧髅髋髌鬓鬶魇魉鱼鱽鱾鱿鲀鲁鲂鲃鲄鲅鲆鲇鲈鲉鲊鲋鲌鲍鲎鲏鲐鲑鲒鲓鲔鲕鲖鲗鲘' +
  '鲙鲚鲛鲜鲝鲞鲟鲠鲡鲢鲣鲤鲥鲦鲧鲨鲩鲪鲫鲬鲭鲮鲯鲰鲱鲲鲳鲴鲵鲶鲷鲸鲹鲺鲻鲼鲽鲾鲿鳀鳁鳂鳃鳄鳅鳆鳇鳈鳉鳊鳋鳌鳍鳎鳏鳐鳑鳒鳓鳔鳕鳖鳗鳘' +
  '鳙鳚鳛鳜鳝鳞鳟鳠鳡鳢鳣鳤鸟鸠鸡鸢鸣鸤鸥鸦鸧鸨鸩鸪鸫鸬鸭鸮鸯鸰鸱鸲鸳鸴鸵鸶鸷鸸鸹鸺鸻鸼鸽鸾鸿鹀鹁鹂鹃鹄鹅鹆鹇鹈鹉鹊鹋鹌鹍鹎鹏鹐鹑鹒' +
  '鹓鹔鹕鹖鹗鹘鹙鹚鹛鹜鹝鹞鹟鹠鹡鹢鹣鹤鹥鹦鹧鹨鹩鹪鹫鹬鹭鹮鹯鹰鹱鹲鹳鹴鹾麦麸麹麺麽黄黉黡黩黪黾鼋鼌鼍鼹齐齑齿龀龁龂龃龄龅龆龇龈龉龊' +
  '龋龌龙龚龛龟鿎鿏鿒鿔';
