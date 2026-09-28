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

function renderBrooklynPrintedBulletinDocument_(body, bulletin, nextBulletin, format) {
  // The supplied Brooklyn reference is a landscape, two-column bulletin:
  // Sabbath School and worship, the rotating schedule table and fellowship
  // cover/contact block, then the bilingual rotating encouragement spread.
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
      function (leftCell, rightCell, qrCells) {
        appendBrooklynGivingFooter_(leftCell, rightCell, qrCells);
      },
      // Keep three physical QR positions so the future Mobile App asset stays
      // in slot 1, ACH/card remains in slot 2, and Brooklyn's unused slot 3
      // stays empty because Brooklyn has no Zelle QR code. The divider spacing
      // matches the Queens regular footer.
      { ruleSpacingBefore: 4, qrColumns: true, qrCount: 3 },
    );
    appendBrooklynEncouragementPage_(body, bulletin);
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
  );
  appendCenteredText_(cell, '10:00 am–11:25 am', 9, false);

  appendBrooklynProgramTable_(cell, mergeBrooklynStudyRowsByAssignment_([
    [printedBilingualText_('Welcome', '歡迎'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [
      printedBilingualText_('Song and Bible Verse', '詩歌頌讚與存心節'),
      '',
      // This combined item is led by the Sabbath School chairman. Keep the
      // printed assignment consistent even when an older sheet still has a
      // separate Song Leader value.
      printBrooklynPerson_(location.chair, location.chairPastoralPrayer),
    ],
    [printedBilingualText_('Opening Hymn', '開會唱詩'), physicalTbdText_(), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Prayer', '祈禱'), '', printValue_(location.chairPastoralPrayer)],
    [
      printedBilingualText_('Sabbath Encouragement', '安息日勉勵'),
      printValue_(location.sabbathMessageTitle),
      printBrooklynPerson_(
        location.encouragement,
        location.sabbathMessage || location.chairPastoralPrayer,
      ),
    ],
    [printedBilingualText_('Sabbath School', '安息日學課'), physicalTbdText_(), printValue_(location.sabbathSchool)],
    [printedBilingualText_('Closing Hymn', '合班唱詩'), physicalTbdText_(), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Closing Prayer', '合班禱告'), physicalTbdText_(), physicalTbdText_('尚未安排')],
  ]));

  appendHalfSpacer_(cell);
  appendCompactItalicCenteredText_(cell, '† Five Minutes Break | 休息五分鐘 †', 8.5);
}

function appendBrooklynWorshipPanel_(cell, bulletin, includeClosingRows) {
  var location = bulletin.brooklyn;
  appendPanelHeading_(
    cell,
    printedBilingualText_('BROOKLYN CHINESE SABBATH WORSHIP', '布魯克林華人團契 聖日崇拜'),
  );
  appendCenteredText_(cell, '11:30 am–1:00 pm', 9, false);
  appendHalfSpacer_(cell);
  appendCompactItalicCenteredText_(cell, '† Silent Prayer | 請默禱 †', 8.5);
  appendHalfSpacer_(cell);

  var worshipRowsBeforeSermon = [
    [printedBilingualText_('Chairman', '主席'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [printedBilingualText_('Doxology', '讚美'), printedBilingualText_('AH 694 — Praise God', '第497首 讚美上帝'), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Invocation', '獻禱'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [printedBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), printedBilingualText_('Congregation', '會眾')],
    [
      printedBilingualText_('Bible Readings', '讀經'),
      formatBibleReferenceForPrint_(location, bulletin.physicalBibleTranslations),
      printedBilingualText_('Congregation', '會眾'),
    ],
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
    // Match the Queens worship panel's room above the giving divider.
    appendSpacer_(cell);
    appendSpacer_(cell);
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
    [printedBilingualText_('Technician', '技術同工'), function (value) { return printValue_(value.technician); }],
    [printedBilingualText_('Encouragement', '勉勵'), function (value) { return printBrooklynPerson_(value.encouragement, value.sabbathMessage); }],
    [printedBilingualText_('Offering Prayer', '奉獻禱告'), function (value) { return printValue_(value.offeringPrayer); }],
    [printedBilingualText_('Sabbath School', '安息日學'), function (value) { return printValue_(value.sabbathSchool); }],
    [printedBilingualText_('Sermon', '崇拜證道'), function (value) { return printValue_(value.sermon); }],
    [printedBilingualText_('Sunset Times', '日落時間'), function (value) { return printValue_(value.sunsetTime); }],
  ]);

}

function appendBrooklynCoverPanel_(cell, bulletin, format) {
  renderPrintedBrooklynCoverPanel_(cell, bulletin, format);
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

function appendBrooklynGivingFooter_(leftCell, rightCell, qrCells) {
  leftCell.setPaddingTop(0);
  leftCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
  appendGivingText_(leftCell, { reuseLeadingParagraph: true });
  if (qrCells && qrCells.length) {
    appendGivingQrPlaceholderCells_(qrCells, {
      compact: true,
      location: 'brooklyn',
      reuseLeadingParagraph: true,
    });
    return;
  }
  rightCell.setPaddingTop(0);
  rightCell.setVerticalAlignment(DocumentApp.VerticalAlignment.TOP);
  appendGivingQrPlaceholders_(rightCell, {
    compact: true,
    location: 'brooklyn',
    reuseLeadingParagraph: true,
  });
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
