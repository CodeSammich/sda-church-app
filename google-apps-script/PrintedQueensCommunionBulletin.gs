/**
 * Communion-only printed bulletin layout.
 *
 * Queens regular bulletins intentionally stay in PrintedQueensBulletin.gs. This file
 * owns the ceremony page order and the fixed Scripture references so a
 * Communion bulletin cannot accidentally inherit or overwrite the regular
 * Queens schedule layout.
 */

var PRINTED_COMMUNION_LAYOUT = Object.freeze({
  serviceScripture: '1 Corinthians 11:23–26',
  responseHymn: 'AH 348 The Church Has One Foundation',
  responseHymnChinese: '第413首 教會基礎',
  wholeCongregation: 'Congregation',
  wholeCongregationChinese: '會眾',
  communionPastor: 'Moses Fang',
  communionPastorChinese: '方舟',
  footWashingScripture: 'John 13:1–10; 12–17',
  footWashingLookupScripture: 'John 13:1–10; John 13:12–17',
  footWashingBoxScripture: 'John 13:1–10',
  communionReferenceChinese: '哥林多前書 11:23–26',
  footWashingReferenceChinese: '約翰福音 13:1–10; 12–17',
  footWashingBoxReferenceChinese: '約翰福音 13:1–10',
  footWashingInstruction:
    '請安靜地前往樓下洗腳：弟兄到地下室，姊妹到二樓。\nPlease quietly proceed downstairs for foot washing: brothers to the basement, sisters to the second floor.',
  readings: Object.freeze([
    Object.freeze({
      english: 'The Bread',
      chinese: '餅',
      reference: '1 Corinthians 11:24',
      referenceChinese: '哥林多前書 11:24',
    }),
    Object.freeze({
      english: 'The Cup',
      chinese: '杯',
      reference: '1 Corinthians 11:25',
      referenceChinese: '哥林多前書 11:25',
    }),
    Object.freeze({
      english: 'The Proclamation',
      chinese: '宣告',
      reference: '1 Corinthians 11:26',
      referenceChinese: '哥林多前書 11:26',
    }),
  ]),
});

function getPrintedCommunionServiceScripture_() {
  return PRINTED_COMMUNION_LAYOUT.serviceScripture;
}

function getPrintedCommunionResponseHymn_() {
  return printedBilingualText_(
    PRINTED_COMMUNION_LAYOUT.responseHymn,
    PRINTED_COMMUNION_LAYOUT.responseHymnChinese,
  );
}

function getPrintedCommunionWholeCongregation_() {
  return printedBilingualText_(
    PRINTED_COMMUNION_LAYOUT.wholeCongregation,
    PRINTED_COMMUNION_LAYOUT.wholeCongregationChinese,
  );
}

function getPrintedCommunionPastor_() {
  return printedBilingualText_(
    PRINTED_COMMUNION_LAYOUT.communionPastor,
    PRINTED_COMMUNION_LAYOUT.communionPastorChinese,
  );
}

function getPrintedCommunionFootWashingScripture_() {
  return PRINTED_COMMUNION_LAYOUT.footWashingScripture;
}

function getPrintedCommunionFootWashingLookupScripture_() {
  return PRINTED_COMMUNION_LAYOUT.footWashingLookupScripture;
}

function getPrintedCommunionFootWashingInstruction_() {
  return PRINTED_COMMUNION_LAYOUT.footWashingInstruction;
}

function getPrintedCommunionPassageDefinition_(kind) {
  if (kind === 'footWashing') {
    return {
      lookup: PRINTED_COMMUNION_LAYOUT.footWashingBoxScripture,
      english: PRINTED_COMMUNION_LAYOUT.footWashingBoxScripture,
      chinese: PRINTED_COMMUNION_LAYOUT.footWashingBoxReferenceChinese,
    };
  }
  return {
    lookup: getPrintedCommunionServiceScripture_(),
    english: getPrintedCommunionServiceScripture_(),
    chinese: PRINTED_COMMUNION_LAYOUT.communionReferenceChinese,
  };
}

function hydratePrintedCommunionPassages_(bulletin, bibleTranslations) {
  bulletin.physicalCommunionReadingPassages = {};
  ['communion', 'footWashing'].forEach(function (kind) {
    var definition = getPrintedCommunionPassageDefinition_(kind);
    var propertyName =
      kind === 'footWashing'
        ? 'physicalFootWashingPassageText'
        : 'physicalCommunionPassageText';
    try {
      bulletin[propertyName] = resolvePhysicalBiblePassage_(
        definition.lookup,
        bibleTranslations,
        kind === 'footWashing',
      );
    } catch (error) {
      Logger.log('Fixed ' + kind + ' passage lookup failed: ' + error);
      bulletin[propertyName] = null;
    }
  });
  PRINTED_COMMUNION_LAYOUT.readings.forEach(function (reading) {
    try {
      bulletin.physicalCommunionReadingPassages[reading.reference] =
        resolvePhysicalBiblePassage_(reading.reference, bibleTranslations);
    } catch (error) {
      Logger.log('Fixed Communion reading lookup failed: ' + error);
      bulletin.physicalCommunionReadingPassages[reading.reference] = null;
    }
  });
  return bulletin;
}

function appendPrintedCommunionPassageBox_(cell, bulletin, kind) {
  var definition = getPrintedCommunionPassageDefinition_(kind);
  var propertyName =
    kind === 'footWashing'
      ? 'physicalFootWashingPassageText'
      : 'physicalCommunionPassageText';
  var passage = bulletin[propertyName] || {};
  var chineseText =
    kind === 'footWashing' && passage.chineseVerses
      ? passage.chineseVerses.join('\n')
      : passage.chinese;
  var englishText =
    kind === 'footWashing' && passage.englishVerses
      ? passage.englishVerses.join('\n')
      : passage.english;
  appendDataTable_(
    cell,
    [
      [definition.chinese, definition.english],
      [chineseText || definition.chinese, englishText || definition.english],
    ],
    {
      borderWidth: 0.75,
      borderColor: '#000000',
      columnWidths: [170, 190],
      alignments: [
        DocumentApp.HorizontalAlignment.LEFT,
        DocumentApp.HorizontalAlignment.LEFT,
      ],
      fontSize: 8,
      headerFontSize: 8,
      paddingTop: 1,
      paddingBottom: 1,
    },
  );
}

function appendPrintedCommunionReadingPassageBox_(cell, bulletin, readingIndex) {
  var reading = PRINTED_COMMUNION_LAYOUT.readings[readingIndex];
  var passages = bulletin.physicalCommunionReadingPassages || {};
  var passage = passages[reading.reference] || {};
  appendDataTable_(
    cell,
    [
      [reading.referenceChinese, reading.reference],
      [passage.chinese || reading.referenceChinese, passage.english || reading.reference],
    ],
    {
      borderWidth: 0.75,
      borderColor: '#000000',
      columnWidths: [170, 190],
      alignments: [
        DocumentApp.HorizontalAlignment.LEFT,
        DocumentApp.HorizontalAlignment.LEFT,
      ],
      fontSize: 8,
      headerFontSize: 8,
      paddingTop: 1,
      paddingBottom: 1,
    },
  );
}

function getPrintedCommunionReadingRows_() {
  return PRINTED_COMMUNION_LAYOUT.readings.map(function (reading) {
    return [
      printedBilingualText_(reading.english, reading.chinese),
      reading.reference,
      printedBilingualText_('Congregation', '會眾'),
    ];
  });
}

function renderCommunionPrintedBulletinDocument_(body, bulletin, nextBulletin) {
  // Keep this imposed order in sync with the Communion reference PDF:
  // back/announcements | cover, study | blank, Communion continued |
  // worship + giving, then foot washing | Communion opening.
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
    function (cell) {
      appendCommunionContinuationPanel_(cell, bulletin);
      appendCommunionStudyContinuationRows_(cell, bulletin);
    },
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

function appendCommunionStudyContinuationRows_(cell, bulletin) {
  var location = bulletin.queens;
  appendProgramTable_(cell, [
    [
      printedBilingualText_('Hymn of Response', '回應詩'),
      getPrintedCommunionResponseHymn_(),
      printedBilingualText_('Congregation', '會眾'),
    ],
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
  appendSpacer_(cell);
  appendSilentPrayerHeading_(cell, 'Silent Prayer', '請默禱之後散會');
}
