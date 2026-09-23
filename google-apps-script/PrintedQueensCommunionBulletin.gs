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
  footWashingScripture: 'John 13:1–10; 12–17',
  footWashingLookupScripture: 'John 13:1–10; John 13:12–17',
  communionReferenceChinese: '哥林多前書 11:23–26',
  footWashingReferenceChinese: '約翰福音 13:1–10; 12–17',
  footWashingInstruction:
    'Please quietly proceed downstairs for foot washing: brothers to the basement, sisters to the second floor.\n請安靜地前往樓下洗腳：弟兄到地下室，姊妹到二樓。',
  readings: Object.freeze([
    Object.freeze({
      english: 'The Bread',
      chinese: '餅',
      reference: '1 Corinthians 11:24',
    }),
    Object.freeze({
      english: 'The Cup',
      chinese: '杯',
      reference: '1 Corinthians 11:25',
    }),
    Object.freeze({
      english: 'The Proclamation',
      chinese: '宣告',
      reference: '1 Corinthians 11:26',
    }),
  ]),
});

function getPrintedCommunionServiceScripture_() {
  return PRINTED_COMMUNION_LAYOUT.serviceScripture;
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
      lookup: getPrintedCommunionFootWashingLookupScripture_(),
      english: getPrintedCommunionFootWashingScripture_(),
      chinese: PRINTED_COMMUNION_LAYOUT.footWashingReferenceChinese,
    };
  }
  return {
    lookup: getPrintedCommunionServiceScripture_(),
    english: getPrintedCommunionServiceScripture_(),
    chinese: PRINTED_COMMUNION_LAYOUT.communionReferenceChinese,
  };
}

function hydratePrintedCommunionPassages_(bulletin, bibleTranslations) {
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
      );
    } catch (error) {
      Logger.log('Fixed ' + kind + ' passage lookup failed: ' + error);
      bulletin[propertyName] = null;
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
  appendDataTable_(
    cell,
    [
      [definition.chinese, definition.english],
      [passage.chinese || definition.chinese, passage.english || definition.english],
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
  // back/announcements | cover, study | closing, readings | worship, then
  // foot washing | Communion.
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
    function (cell) {
      appendCommunionClosingPanel_(cell, bulletin);
    },
    false,
  );
  appendBookletPage_(
    body,
    function (cell) {
      appendCommunionReadingPanel_(cell, bulletin);
    },
    function (cell) {
      appendWorshipPanel_(cell, bulletin, false);
    },
    false,
    appendGivingFooter_,
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
