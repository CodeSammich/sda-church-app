/**
 * Communion service content shared by the Queens and Brooklyn Communion bulletins.
 *
 * This file owns the fixed Scripture references, the response hymn, and the
 * foot washing and Holy Communion panels, so a Communion bulletin cannot
 * accidentally inherit or overwrite a location's regular schedule layout. Each
 * location's Communion page order lives in its own file.
 */

function appendFootWashingPanel_(cell, bulletin) {
  appendPanelHeading_(
    cell,
    printedBilingualText_('FOOT WASHING', '洗腳禮'),
  );
  appendProgramTable_(cell, [
    [printedBilingualText_('Bible Readings', '讀經'), getPrintedCommunionFootWashingScripture_(), printedBilingualText_('Congregation', '會眾')],
  ]);
  appendPrintedCommunionPassageBox_(cell, bulletin, 'footWashing');
  appendProgramTable_(cell, [
    [printedBilingualText_('Foot Washing', '洗腳禮'), '', getPrintedCommunionWholeCongregation_()],
  ]);
  appendSpacer_(cell);
  appendSpacer_(cell);
  appendCompactItalicCenteredText_(cell, getPrintedCommunionFootWashingInstruction_(), 8.5);
}

function appendCommunionOpeningActionsPanel_(cell, bulletin, locationKey) {
  appendProgramTable_(cell, [
    [printedBilingualText_('Blessing the Bread', '分餅祝福禱告'), '', getPrintedCommunionPastor_()],
    [printedBilingualText_('Breaking the Bread', '分餅'), '', getPrintedCommunionPastor_()],
  ]);
  appendProgramTable_(cell, [
    [printedBilingualText_('Prayer of Silence', '默禱'), '', printedBilingualText_('Congregation', '會眾')],
  ]);
}

function appendCommunionContinuationActionsPanel_(cell, bulletin, locationKey) {
  appendProgramTable_(cell, [
    [printedBilingualText_('Blessing the Cup', '分杯祝福禱告'), '', getPrintedCommunionPastor_()],
    [printedBilingualText_('Share the Cup', '分杯'), '', getPrintedCommunionPastor_()],
  ]);
  appendProgramTable_(cell, [
    [printedBilingualText_('Prayer of Silence', '默禱'), '', printedBilingualText_('Congregation', '會眾')],
  ]);
}

function appendCommunionActionsPanel_(cell, bulletin, locationKey) {
  appendCommunionOpeningActionsPanel_(cell, bulletin, locationKey);
  appendCommunionContinuationActionsPanel_(cell, bulletin, locationKey);
  appendCommunionClosingRows_(cell, bulletin, locationKey);
}

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

function appendCommunionClosingRows_(cell, bulletin, locationKey) {
  appendProgramTable_(cell, [
    [
      printedBilingualText_('Hymn of Response', '回應詩'),
      getPrintedCommunionResponseHymn_(),
      printedBilingualText_('Congregation', '會眾'),
    ],
    [
      printedBilingualText_('Benediction', '祝禱'),
      '',
      getPrintedCommunionPastor_(),
    ],
    [
      printedBilingualText_('Postlude', '後奏'),
      printedBilingualText_('SDAH 690 — Dismiss Us, Lord', '第504首 散會頌'),
      printedBilingualText_('Congregation', '會眾'),
    ],
  ], { columnWidths: [90, 200, 70] });
  appendSpacer_(cell);
  appendSilentPrayerHeading_(cell, 'Silent Prayer', '請默禱之後散會');
}
