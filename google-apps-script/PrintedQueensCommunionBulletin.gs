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

function getPrintedCommunionFootWashingInstruction_() {
  return PRINTED_COMMUNION_LAYOUT.footWashingInstruction;
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
    appendGivingFooter_,
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
