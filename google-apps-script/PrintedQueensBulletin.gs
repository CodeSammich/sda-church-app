/**
 * Queens printed bulletin layouts: the regular two-page handout and the
 * Communion booklet.
 *
 * Shared building blocks are in PrintedBulletin.gs and the Communion service
 * content is in PrintedCommunionBulletin.gs. Keep the Queens regular renderer as
 * the stable reference layout.
 */

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
    function (leftCell, rightCell, qrCells) {
      appendGivingFooter_(leftCell, qrCells, 'queens');
    },
    // Put each QR code in its own footer column, as Brooklyn does. A table
    // nested in a cell keeps a blank line above it, which pushed the QR
    // captions onto a new page.
    { ruleSpacingBefore: 4, qrColumns: true, qrCount: 3 },
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

function appendCoverPanel_(cell, bulletin, format) {
  appendSharedCoverPanel_(cell, bulletin, format);
  // Keep Queens regular and communion covers consistent with Brooklyn: the
  // Zoom schedule belongs below the shared cover artwork/contact block.
  appendBrooklynOnlineZoomPanel_(cell);
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

function appendGivingFooter_(leftCell, qrCells, location) {
  // clear() leaves an empty default-size paragraph in each footer cell. Reuse
  // it, as the Brooklyn footer does, so it doesn't open a gap under the
  // divider and push the QR captions onto a new page.
  appendGivingText_(leftCell, { reuseLeadingParagraph: true });
  appendGivingQrPlaceholderCells_(qrCells, {
    compact: true,
    location: location || 'queens',
    reuseLeadingParagraph: true,
  });
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
    [printedBilingualText_('Flower Offering', '花卉奉獻'), function (location) { return location.flowerOffering; }],
    [printedBilingualText_('Offerings', '奉獻事項'), function (location, data) { return formatPhysicalOfferingValue_(data.tithePurpose); }],
    [printedBilingualText_('Sunset Times', '日落時間'), function (location, data) { return data.sunsetTime; }],
  ], bulletin, nextBulletin);
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
    [
      printedBilingualText_('Bible Reading', '讀經'),
      formatBibleReferenceForPrint_(location, bulletin.physicalBibleTranslations),
      printedBilingualText_('Congregation', '會眾'),
    ],
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
    // When this column is taller than the study column, the giving footer's
    // divider sits right under the prayer. These spacers only add height in
    // that case; a taller study column already leaves room.
    appendSpacer_(cell);
    appendSpacer_(cell);
  }
}

function appendCommunionPanel_(cell, bulletin) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    printedBilingualText_('HOLY COMMUNION', '聖餐禮'),
  );
  appendProgramTable_(cell, [
    [printedBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), printedBilingualText_('Congregation', '會眾')],
    [printedBilingualText_('Bible Reading', '讀經'), getPrintedCommunionServiceScripture_(), printedBilingualText_('Congregation', '會眾')],
  ]);
  appendPrintedCommunionPassageBox_(cell, bulletin, 'communion');
  appendCommunionOpeningActionsPanel_(cell, bulletin);
  appendCommunionContinuationActionsPanel_(cell, bulletin);
  appendCommunionClosingRows_(cell, bulletin);
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
          setPrintedLatinBold_(headerText, 0, headerText.getText().length - 1);
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

function renderCommunionPrintedBulletinDocument_(body, bulletin, nextBulletin) {
  // Keep this imposed order in sync with the Communion reference PDF:
  // back/announcements | cover, study | blank, worship + giving |
  // foot washing | the complete Holy Communion service.
  appendBookletPage_(
    body,
    function (cell) {
      appendAnnouncementsPanel_(cell, bulletin, nextBulletin);
    },
    function (cell) {
      appendCoverPanel_(cell, bulletin, 'communion');
    },
    true,
  );
  appendBookletPage_(
    body,
    function (cell) {
      appendStudyPanel_(cell, bulletin);
    },
    function (cell) {},
    false,
  );
  appendBookletPage_(
    body,
    function (cell) {},
    function (cell) {
      appendWorshipPanel_(cell, bulletin, false);
      appendCommunionVerticalGivingPanel_(cell);
    },
    false,
  );
  appendBookletPage_(
    body,
    function (cell) {
      appendFootWashingPanel_(cell, bulletin);
    },
    function (cell) {
      appendCommunionPanel_(cell, bulletin);
    },
    false,
  );
}

function appendCommunionVerticalGivingPanel_(cell) {
  appendSpacer_(cell);
  appendCommunionSectionDivider_(cell);
  appendSpacer_(cell);
  appendGivingText_(cell);
  appendSpacer_(cell);
  appendGivingQrPlaceholders_(cell);
}

function appendCommunionSectionDivider_(cell) {
  var rule = cell.appendHorizontalRule();
  var ruleParent = rule.getParent();
  if (ruleParent && ruleParent.getType() === DocumentApp.ElementType.PARAGRAPH) {
    ruleParent.asParagraph().setLineSpacing(1);
    ruleParent.asParagraph().setSpacingBefore(0);
    ruleParent.asParagraph().setSpacingAfter(0);
  }
}
