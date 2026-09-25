/**
 * Brooklyn-specific printed bulletin presentation.
 *
 * The data join and cover remain shared with Queens. Brooklyn keeps its own
 * service-flow helpers here so location-specific schedule changes do not
 * change the Queens regular reference layout.
 */

function renderPrintedBrooklynCoverPanel_(cell, bulletin, format) {
  appendSharedCoverPanel_(cell, bulletin, format, 'brooklyn');
  appendBrooklynOnlineZoomPanel_(cell);
}

function appendBrooklynOnlineZoomPanel_(cell) {
  var rule = cell.appendHorizontalRule();
  var ruleParent = rule.getParent();
  if (ruleParent && ruleParent.getType() === DocumentApp.ElementType.PARAGRAPH) {
    ruleParent.asParagraph().setLineSpacing(1);
    ruleParent.asParagraph().setSpacingBefore(0);
    ruleParent.asParagraph().setSpacingAfter(0);
  }

  appendBrooklynOnlineText_(
    cell,
    'Online Zoom / 線上 Zoom — Mandarin only / 僅限普通話',
    8,
  );
  appendBrooklynOnlineText_(
    cell,
    '254 187 9535 | Password / 密碼: 760641',
    8,
  );
  appendBrooklynOnlineSlotTable_(cell, [
    [
      'Tuesday 8:00–9:00 AM | 週二早 8:00–9:00',
      'Sabbath School Study | 安息日學研讀',
    ],
    [
      'Wednesday 8:00–9:00 AM | 週三早 8:00–9:00',
      'Theological Book Study | 神學書籍研讀',
    ],
    [
      'Wednesday 8:00–9:00 PM | 週三晚 8:00–9:00',
      'Bible Study | 聖經研讀',
    ],
  ]);
}

function appendBrooklynOnlineSlotTable_(cell, slots) {
  var table = cell.appendTable([
    ['', ''],
  ]);
  table.setBorderWidth(0);
  [0, 1].forEach(function (columnIndex) {
    table.setColumnWidth(columnIndex, 184);
  });
  slots.slice(0, 2).forEach(function (slot, index) {
    var slotCell = table.getCell(0, index);
    slotCell.clear();
    slotCell.setPaddingLeft(0);
    slotCell.setPaddingRight(0);
    slotCell.setPaddingTop(0);
    slotCell.setPaddingBottom(0);
    appendBrooklynOnlineSlot_(slotCell, slot);
  });

  // Keep the third Zoom meeting centered beneath the two-column row, matching
  // the centered Flushing Fellowship treatment on the Queens cover.
  if (slots[2]) {
    appendSpacer_(cell);
    appendBrooklynOnlineSlot_(cell, slots[2]);
  }
}

function appendBrooklynOnlineSlot_(cell, slot) {
  appendBrooklynOnlineText_(cell, slot[1], 8, false);
  appendBrooklynOnlineText_(cell, slot[0], 8, false);
}

function appendBrooklynOnlineText_(cell, text, size, bold) {
  String(text || '')
    .split(/\r?\n/)
    .forEach(function (line) {
      var paragraph = cell.appendParagraph(line);
      paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
      paragraph.setLineSpacing(1);
      paragraph.setSpacingBefore(0);
      paragraph.setSpacingAfter(0);
      var rendered = paragraph.editAsText();
      styleText_(rendered, size, bold);
      rendered.setItalic(false);
    });
}

function mergeBrooklynStudyRowsByAssignment_(rows) {
  var merged = [];
  rows.forEach(function (row) {
    var current = row.slice();
    var previous = merged.length ? merged[merged.length - 1] : null;
    if (
      previous &&
      hasPrintValue_(previous[2]) &&
      hasPrintValue_(current[2]) &&
      String(previous[2]).trim() === String(current[2]).trim()
    ) {
      var previousLabel = String(previous[0] || '');
      var currentLabel = String(current[0] || '');
      // Welcome is implicit in the Sabbath School opening and can be dropped
      // when it would consume the line needed for the following merged item.
      if (/^Welcome(?:\n歡迎)?$/.test(previousLabel)) {
        previous[0] = currentLabel;
      } else {
        previous[0] = previousLabel + '\n' + currentLabel;
      }
      if (hasPrintValue_(current[1])) {
        previous[1] = hasPrintValue_(previous[1])
          ? String(previous[1]) + '\n' + String(current[1])
          : String(current[1]);
      }
      return;
    }
    merged.push(current);
  });
  return merged;
}
