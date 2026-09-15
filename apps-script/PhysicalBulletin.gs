/**
 * Staff-only physical bulletin generator.
 *
 * This file belongs in the same spreadsheet-bound Apps Script project as
 * BulletinApi.gs. It deliberately has no public web route: the generated document
 * contains full names and must only be created by an authorized Sheets user.
 */

var PHYSICAL_BULLETIN_CONFIG = Object.freeze({
  churchName: 'New York Chinese Seventh-day Adventist Church',
  churchNameChinese: '紐約華人基督復臨安息日會',
  outputFolderProperty: 'PHYSICAL_BULLETIN_FOLDER_ID',
  outputFolderId: '11p4-PzJNGLNfWdZBAMNIBlLxmBrgo_zZ',
  churchSketchImageProperty: 'CHURCH_SKETCH_IMAGE_FILE_ID',
  lastSupperImageProperty: 'LAST_SUPPER_IMAGE_FILE_ID',
  legacyBrooklynCoverImageProperty: 'BROOKLYN_BULLETIN_COVER_IMAGE_FILE_ID',
  churchSketchImageFileId: '1ZmxAI0l-689nnz5l1pEtmpNTDquA8_No',
  lastSupperImageFileId: '1ZGPxK1cidxies9jAguiAIPVlk9Vqk-Kd',
  documentPropertyPrefix: 'PHYSICAL_BULLETIN_DOC_ID_',
  pdfPropertyPrefix: 'PHYSICAL_BULLETIN_PDF_ID_',
  pageWidth: 792,
  pageHeight: 612,
  pageMargin: 28,
  studyTime: '10:00 am–11:20 am\n上午 10:00–11:20',
  worshipTime: '11:40 am–1:00 pm\n上午 11:40–下午 1:00',
  communionScripture: '1 Corinthians 11:23–26',
  footWashingScripture: 'John 13:1–10; 12–17',
  footWashingInstruction:
    'Please quietly proceed downstairs for foot washing: brothers to the basement, sisters to the second floor.\n請安靜地前往樓下洗腳：弟兄到地下室，姊妹到二樓。',
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Physical Bulletin')
    .addItem('Create Google Doc…', 'createPhysicalBulletinFromPrompt')
    .addItem('Install form auto-generation', 'installPhysicalBulletinTrigger')
    .addToUi();
}

/**
 * Opens a staff-only prompt. Run this from the bound spreadsheet, or use the
 * Physical Bulletin menu after reloading the spreadsheet.
 */
function createPhysicalBulletinFromPrompt() {
  var ui = SpreadsheetApp.getUi();
  var dateResponse = ui.prompt(
    'Create physical bulletin',
    'Enter the Sabbath date (YYYY-MM-DD or M/D/YYYY).',
    ui.ButtonSet.OK_CANCEL,
  );

  if (dateResponse.getSelectedButton() !== ui.Button.OK) {
    return null;
  }

  var locationResponse = ui.prompt(
    'Bulletin location',
    'Enter queens or brooklyn. Leave blank for queens.',
    ui.ButtonSet.OK_CANCEL,
  );

  if (locationResponse.getSelectedButton() !== ui.Button.OK) {
    return null;
  }

  var formatResponse = ui.prompt(
    'Bulletin format',
    'Enter regular or communion. Leave blank to detect it from Special Remark.',
    ui.ButtonSet.OK_CANCEL,
  );

  if (formatResponse.getSelectedButton() !== ui.Button.OK) {
    return null;
  }

  try {
    var result = createPhysicalBulletin_(
      dateResponse.getResponseText(),
      formatResponse.getResponseText(),
      locationResponse.getResponseText(),
    );
    ui.alert(
      'Physical bulletin ' +
        result.action +
        ':\nGoogle Doc: ' +
        result.url +
        '\nPDF: ' +
        result.pdfUrl,
    );
    return result.url;
  } catch (error) {
    ui.alert(
      'Physical bulletin could not be created:\n' +
        (error && error.message ? error.message : String(error)),
    );
    throw error;
  }
}

/**
 * Creates the one-time installable trigger used for Queens and Brooklyn form
 * submissions.
 * A trigger is not created automatically because Google requires an
 * authorized staff member to approve Docs/Drive access first.
 */
function installPhysicalBulletinTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var alreadyInstalled = triggers.some(function (trigger) {
    return (
      (trigger.getHandlerFunction() === 'handlePhysicalBulletinFormSubmit_' ||
        trigger.getHandlerFunction() === 'handleQueensFormSubmit_') &&
      trigger.getEventType() === ScriptApp.EventType.ON_FORM_SUBMIT
    );
  });

  if (!alreadyInstalled) {
    ScriptApp.newTrigger('handlePhysicalBulletinFormSubmit_')
      .forSpreadsheet(SpreadsheetApp.getActive())
      .onFormSubmit()
      .create();
  }

  SpreadsheetApp.getUi().alert(
    alreadyInstalled
      ? 'Physical bulletin form auto-generation is already installed.'
      : 'Physical bulletin form auto-generation is now installed for Queens and Brooklyn.',
  );
}

/**
 * Install this handler as a spreadsheet "On form submit" trigger. It ignores
 * submissions from other sheets in the workbook.
 */
function handlePhysicalBulletinFormSubmit_(event) {
  var sheet = event && event.range ? event.range.getSheet() : null;
  var location = getPhysicalBulletinLocationForSheet_(sheet);
  if (!location) {
    return;
  }

  var date = getSubmittedDate_(event, sheet);
  if (!date) {
    throw new Error(location + ' form submission did not contain a valid Sabbath date');
  }

  var result = createPhysicalBulletin_(date, 'auto', location);
  Logger.log(
    location + ' physical bulletin ' + result.action + ': ' + result.url + ' / ' + result.pdfUrl,
  );
}

// Keep previously installed Queens triggers working after the Brooklyn layout
// is enabled. The installer recognizes this legacy handler name and the
// implementation now routes both response tabs.
function handleQueensFormSubmit_(event) {
  return handlePhysicalBulletinFormSubmit_(event);
}

function installQueensPhysicalBulletinTrigger() {
  return installPhysicalBulletinTrigger();
}

function getPhysicalBulletinLocationForSheet_(sheet) {
  if (!sheet) {
    return '';
  }
  if (CONFIG.responseSheets.queens.indexOf(sheet.getName()) !== -1) {
    return 'queens';
  }
  if (CONFIG.responseSheets.brooklyn.indexOf(sheet.getName()) !== -1) {
    return 'brooklyn';
  }
  return '';
}

function getSubmittedDate_(event, sheet) {
  var table = readTable_(sheet);
  var dateColumn = findFirstHeaderIndex_(table.headers, CONFIG.dateHeaders);
  var values = event && event.values ? event.values : [];
  if (dateColumn !== -1 && values[dateColumn]) {
    return toIsoDate_(values[dateColumn]);
  }

  var namedValues = (event && event.namedValues) || {};
  var keys = Object.keys(namedValues);
  for (var index = 0; index < keys.length; index += 1) {
    var key = keys[index];
    if (findFirstHeaderIndex_([key], CONFIG.dateHeaders) !== -1) {
      var answer = namedValues[key];
      return toIsoDate_(Array.isArray(answer) ? answer[0] : answer);
    }
  }
  return '';
}

/**
 * Creates or updates a landscape Google Doc. This function is intentionally
 * not called by doGet(), because the public bulletin endpoint must never
 * expose full names or create Drive files for anonymous callers.
 */
function createPhysicalBulletin_(requestedDate, requestedFormat, requestedLocation) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    return createPhysicalBulletinUnlocked_(requestedDate, requestedFormat, requestedLocation);
  } finally {
    lock.releaseLock();
  }
}

function createPhysicalBulletinUnlocked_(requestedDate, requestedFormat, requestedLocation) {
  var date = toIsoDate_(requestedDate);
  if (!date) {
    throw new Error('A valid Sabbath date is required');
  }

  var location = normalizePhysicalBulletinLocation_(requestedLocation);
  var nameDictionary = buildPhysicalNameDictionary_();
  var bulletin = preparePhysicalBulletinForPrint_(
    buildBulletin_(date, { includeFullNames: true }),
    nameDictionary,
  );
  var format = resolvePhysicalBulletinFormat_(requestedFormat, bulletin);
  var nextBulletin = tryBuildPrivateBulletin_(getNextSabbathDate_(date), nameDictionary);
  var title = getPhysicalBulletinTitle_(location, date, format);
  var documentPropertyKey = getPhysicalBulletinPropertyKey_(
    PHYSICAL_BULLETIN_CONFIG.documentPropertyPrefix,
    location,
    date,
  );
  var pdfPropertyKey = getPhysicalBulletinPropertyKey_(
    PHYSICAL_BULLETIN_CONFIG.pdfPropertyPrefix,
    location,
    date,
  );
  var properties = PropertiesService.getScriptProperties();
  var legacyDocumentPropertyKey = PHYSICAL_BULLETIN_CONFIG.documentPropertyPrefix + date;
  var legacyPdfPropertyKey = PHYSICAL_BULLETIN_CONFIG.pdfPropertyPrefix + date;
  var existingDocumentId = properties.getProperty(documentPropertyKey);
  if (!existingDocumentId && location === 'queens') {
    existingDocumentId = properties.getProperty(legacyDocumentPropertyKey);
  }
  var document = null;
  var action = 'created';

  if (existingDocumentId) {
    try {
      document = DocumentApp.openById(existingDocumentId);
      action = 'updated';
    } catch (error) {
      properties.deleteProperty(documentPropertyKey);
    }
  }

  document = document || DocumentApp.create(title);
  if (action === 'updated') {
    DriveApp.getFileById(document.getId()).setName(title);
  }
  renderPhysicalBulletinDocument_(document, bulletin, nextBulletin, format, location);
  document.saveAndClose();

  movePhysicalBulletinToConfiguredFolder_(document.getId());
  properties.setProperty(documentPropertyKey, document.getId());
  if (location === 'queens' && legacyDocumentPropertyKey !== documentPropertyKey) {
    properties.deleteProperty(legacyDocumentPropertyKey);
  }
  if (!properties.getProperty(pdfPropertyKey) && location === 'queens') {
    var legacyPdfId = properties.getProperty(legacyPdfPropertyKey);
    if (legacyPdfId) {
      properties.setProperty(pdfPropertyKey, legacyPdfId);
      properties.deleteProperty(legacyPdfPropertyKey);
    }
  }
  var pdf = createOrReplacePhysicalBulletinPdf_(
    document.getId(),
    title,
    pdfPropertyKey,
  );

  return {
    id: document.getId(),
    title: title,
    format: format,
    action: action,
    url: document.getUrl(),
    pdfAction: pdf.action,
    pdfId: pdf.id,
    pdfUrl: pdf.url,
  };
}

function normalizePhysicalBulletinLocation_(requestedLocation) {
  var location = String(requestedLocation || 'queens').trim().toLowerCase();
  if (location === 'queens' || location === 'brooklyn') {
    return location;
  }
  throw new Error('Location must be queens or brooklyn');
}

function getPhysicalBulletinTitle_(location, date, format) {
  var churchName =
    location === 'brooklyn'
      ? 'New York Chinese SDA Church — Brooklyn Fellowship'
      : PHYSICAL_BULLETIN_CONFIG.churchName;
  return (
    churchName +
    ' — ' +
    formatDateForPrint_(date) +
    (format === 'communion' ? ' — Communion' : '')
  );
}

function getPhysicalBulletinPropertyKey_(prefix, location, date) {
  return prefix + location.toUpperCase() + '_' + date;
}

function renderPhysicalBulletinDocument_(document, bulletin, nextBulletin, format, location) {
  var body = document.getBody();

  body.clear();
  body.setPageWidth(PHYSICAL_BULLETIN_CONFIG.pageWidth);
  body.setPageHeight(PHYSICAL_BULLETIN_CONFIG.pageHeight);
  body.setMarginTop(PHYSICAL_BULLETIN_CONFIG.pageMargin);
  body.setMarginBottom(PHYSICAL_BULLETIN_CONFIG.pageMargin);
  body.setMarginLeft(PHYSICAL_BULLETIN_CONFIG.pageMargin);
  body.setMarginRight(PHYSICAL_BULLETIN_CONFIG.pageMargin);

  if (location === 'brooklyn') {
    renderBrooklynPhysicalBulletinDocument_(body, bulletin, nextBulletin, format);
    return;
  }

  appendBookletPage_(
    body,
    function (cell) {
      appendAnnouncementsPanel_(cell, bulletin, nextBulletin);
    },
    function (cell) {
      appendCoverPanel_(cell, bulletin, format);
    },
    true,
  );

  appendBookletPage_(
    body,
    function (cell) {
      appendStudyPanel_(cell, bulletin);
    },
    function (cell) {
      appendWorshipPanel_(cell, bulletin);
    },
    false,
  );

  if (format === 'communion') {
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

    appendBookletPage_(
      body,
      function (cell) {
        appendCommunionReadingPanel_(cell, bulletin);
      },
      function (cell) {
        appendCommunionClosingPanel_(cell, bulletin);
      },
      false,
    );
  }
}

function renderBrooklynPhysicalBulletinDocument_(body, bulletin, nextBulletin, format) {
  // The supplied Brooklyn reference is a two-page, landscape, two-column
  // bulletin: Sabbath School and worship first, then the rotating schedule
  // table and the fellowship cover/contact block.
  appendBookletPage_(
    body,
    function (cell) {
      appendBrooklynStudyPanel_(cell, bulletin);
    },
    function (cell) {
      appendBrooklynWorshipPanel_(cell, bulletin);
    },
    true,
  );

  appendBookletPage_(
    body,
    function (cell) {
      appendBrooklynMeetingsPanel_(cell, bulletin, nextBulletin);
    },
    function (cell) {
      appendBrooklynCoverPanel_(cell, bulletin, format);
    },
    false,
  );

  if (format === 'communion') {
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
    appendBookletPage_(
      body,
      function (cell) {
        appendBrooklynCommunionReadingPanel_(cell);
      },
      function (cell) {
        appendBrooklynClosingPanel_(cell, bulletin);
      },
      false,
    );
  }
}

function appendBrooklynStudyPanel_(cell, bulletin) {
  var location = bulletin.brooklyn;
  appendPanelHeading_(
    cell,
    physicalBilingualText_('BROOKLYN CHINESE SABBATH SCHOOL', '布魯克林華人團契 安息日學'),
    physicalBilingualText_('Sabbath School', '安息日學'),
  );
  appendCenteredText_(cell, formatDateForPrint_(bulletin.date), 10, true);
  appendCenteredText_(cell, '10:00 am–11:20 am', 9, false);

  appendBrooklynProgramTable_(cell, [
    [physicalBilingualText_('Welcome', '歡迎'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [
      physicalBilingualText_('Song and Bible Verse', '詩歌頌讚與存心節'),
      '',
      printBrooklynPerson_(location.songLeader, location.chairPastoralPrayer),
    ],
    [physicalBilingualText_('Opening Hymn', '開會唱詩'), 'TBD', physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Prayer', '祈禱'), '', printValue_(location.chairPastoralPrayer)],
    [
      physicalBilingualText_('Sabbath Message', '安息日勉言'),
      printValue_(location.sabbathMessageTitle || 'TBD'),
      printBrooklynPerson_(location.sabbathMessage, location.chairPastoralPrayer),
    ],
    [physicalBilingualText_('Sabbath School', '安息日學課'), 'TBD', printValue_(location.sabbathSchool)],
    [physicalBilingualText_('Closing Hymn', '合班唱詩'), 'TBD', physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Closing Prayer', '合班禱告'), 'TBD', 'TBD'],
  ]);

  appendSectionHeading_(cell, physicalBilingualText_('Five Minutes Break', '休息五分鐘'));
  appendSectionHeading_(cell, physicalBilingualText_('BIBLE VERSE', '誦讀經文'));
  appendBodyText_(cell, printValue_(location.bibleVerses));
}

function appendBrooklynWorshipPanel_(cell, bulletin) {
  var location = bulletin.brooklyn;
  appendPanelHeading_(
    cell,
    physicalBilingualText_('BROOKLYN CHINESE SABBATH WORSHIP', '布魯克林華人團契 聖日崇拜'),
    physicalBilingualText_('Sabbath Worship', '安息日崇拜'),
  );
  appendCenteredText_(cell, formatDateForPrint_(bulletin.date), 10, true);
  appendCenteredText_(cell, '11:45 am–1:00 pm', 9, false);
  appendSectionHeading_(cell, physicalBilingualText_('Silent Prayer', '請大家默禱'));

  appendBrooklynProgramTable_(cell, [
    [physicalBilingualText_('Chairman', '主席'), '', printBrooklynPerson_(location.chair, location.chairPastoralPrayer)],
    [physicalBilingualText_('Doxology', '讚美'), physicalBilingualText_('AH 694 — Praise God', '第497首 讚美上帝'), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Invocation', '獻禱'), 'TBD', 'TBD'],
    [physicalBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Bible Readings', '讀經'), printValue_(location.bibleVerses), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Pastoral Prayer', '牧養禱告'), 'TBD', printValue_(location.chairPastoralPrayer)],
    [physicalBilingualText_('Tithe & Offering', '十一與奉獻'), printValue_(bulletin.tithePurpose), printValue_(location.offeringPrayer)],
    [physicalBilingualText_('Special Music', '特別音樂'), 'TBD', 'TBD'],
    [physicalBilingualText_('Sermon', '講道'), formatSermonTitleForPrint_(location), printValue_(location.sermon)],
    [physicalBilingualText_('Hymn of Response', '回應詩'), formatHymnForPrint_(location.hymnOfResponse), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Benediction', '散會禱告'), 'TBD', 'TBD'],
    [physicalBilingualText_('Postlude', '後奏曲'), physicalBilingualText_('AH 690 — Dismiss Us, Lord', '第504首 散會頌'), physicalBilingualText_('Congregation', '會眾')],
  ]);
  appendSectionHeading_(cell, physicalBilingualText_('Silent Prayer', '請默禱之後散會'));
}

function appendBrooklynMeetingsPanel_(cell, bulletin, nextBulletin) {
  appendPanelHeading_(
    cell,
    physicalBilingualText_('MEETINGS SCHEDULE', '節目輪值'),
    physicalBilingualText_('Today / Next Sabbath', '今日／下週'),
  );

  var current = bulletin.brooklyn;
  var next = nextBulletin ? nextBulletin.brooklyn : null;
  var rows = [[
    physicalBilingualText_('Role', '職分'),
    physicalBilingualText_('Today', '今日'),
    physicalBilingualText_('Next Sabbath', '下週'),
  ]];
  [
    [physicalBilingualText_('Chair', '主席'), function (value) { return printBrooklynPerson_(value.chair, value.chairPastoralPrayer); }],
    [physicalBilingualText_('Technician', '技術設備'), function (value) { return printValue_(value.technician); }],
    [physicalBilingualText_('Testimonies', '安息日勉言'), function (value) { return printBrooklynPerson_(value.testimonies, value.sabbathMessage); }],
    [physicalBilingualText_('Sabbath School', '安息日學'), function (value) { return printValue_(value.sabbathSchool); }],
    [physicalBilingualText_('Offering Prayer', '奉獻禱告'), function (value) { return printValue_(value.offeringPrayer); }],
    [physicalBilingualText_('Sermon', '崇拜證道'), function (value) { return printValue_(value.sermon); }],
    [physicalBilingualText_('Sunset Times', '日落時間'), function (value) { return printValue_(value.sunsetTime); }],
  ].forEach(function (entry) {
    rows.push([
      entry[0],
      entry[1](current),
      next ? entry[1](next) : '—',
    ]);
  });
  appendDataTable_(cell, rows);

  appendSectionHeading_(cell, physicalBilingualText_('Online Study', '週間網絡學習'));
  appendBrooklynProgramTable_(cell, [
    [physicalBilingualText_('Tuesday', '週二早'), '8:00–9:00 AM', 'Sabbath School lesson study'],
    [physicalBilingualText_('Wednesday', '週三早'), '8:00–9:00 AM', 'The Desire of Ages study'],
    [physicalBilingualText_('Wednesday', '週三晚'), '8:00–9:00 PM', 'Bible study: 1 Corinthians'],
  ]);
  appendBodyText_(cell, 'Zoom meeting: 254 187 9535    Password: 760641');
}

function appendBrooklynCoverPanel_(cell, bulletin, format) {
  appendPanelHeading_(
    cell,
    physicalBilingualText_(
      'New York Chinese SDA Church—Brooklyn Fellowship',
      '紐約華人基督復臨安息日教會——布魯克林團契',
    ),
    formatDateForPrint_(bulletin.date),
  );

  if (!appendPhysicalBulletinCoverImage_(cell, format)) {
    appendCenteredText_(cell, physicalBilingualText_('Brooklyn Fellowship', '布魯克林團契'), 18, true);
  }

  appendBrooklynContactBlock_(cell);
}

function appendPhysicalBulletinCoverImage_(cell, format) {
  var imageKind = format === 'communion' ? 'lastSupper' : 'churchSketch';
  var fileId = getPhysicalBulletinImageFileId_(imageKind);
  if (!fileId) {
    return false;
  }

  try {
    var image = cell.appendImage(DriveApp.getFileById(fileId).getBlob());
    var width = image.getWidth();
    var height = image.getHeight();
    var maxWidth = 310;
    if (width > maxWidth) {
      image.setWidth(maxWidth);
      image.setHeight(Math.round((height * maxWidth) / width));
    }
    return true;
  } catch (error) {
    Logger.log(imageKind + ' cover image could not be loaded: ' + error);
    return false;
  }
}

function getPhysicalBulletinImageFileId_(imageKind) {
  var propertyName =
    imageKind === 'lastSupper'
      ? PHYSICAL_BULLETIN_CONFIG.lastSupperImageProperty
      : PHYSICAL_BULLETIN_CONFIG.churchSketchImageProperty;
  var properties = PropertiesService.getScriptProperties();
  var configuredId = properties.getProperty(propertyName);
  if (configuredId) {
    return configuredId;
  }

  // Preserve the earlier Brooklyn-only property as a fallback for existing
  // installations that already configured the sketch there.
  if (imageKind === 'churchSketch') {
    var legacyId = properties.getProperty(
      PHYSICAL_BULLETIN_CONFIG.legacyBrooklynCoverImageProperty,
    );
    if (legacyId) {
      return legacyId;
    }
  }

  return imageKind === 'lastSupper'
    ? PHYSICAL_BULLETIN_CONFIG.lastSupperImageFileId
    : PHYSICAL_BULLETIN_CONFIG.churchSketchImageFileId;
}

function appendBrooklynContactBlock_(cell) {
  appendBodyText_(
    cell,
    physicalBilingualText_(
      'New York Chinese SDA Church\n7606 41st Ave, Elmhurst, NY 11373',
      '紐約華人基督復臨安息日教會\n7606 41st Ave, Elmhurst, NY 11373',
    ),
  );
  appendBodyText_(
    cell,
    physicalBilingualText_(
      'Brooklyn Chinese SDA Fellowship\nSaturday 10:30 am\nBay Ridge Spanish SDA Church\n5318 4th Avenue, Brooklyn',
      '布魯克林安息日聚會\n每週六上午 10:30\nBay Ridge Spanish SDA Church\n5318 4th Avenue, Brooklyn',
    ),
  );
  appendBodyText_(
    cell,
    physicalBilingualText_(
      'Flushing Chinese SDA Fellowship\nThursday 6:30 potluck; 7:30 Fellowship\n143-11 Willets Point Boulevard, Whitestone, NY 11357',
      '法拉盛團契聚會\n每週四 6:30 晚餐；7:30 團契聚會\n143-11 Willets Point Boulevard, Whitestone, NY 11357',
    ),
  );
}

function appendBrooklynCommunionPanel_(cell, bulletin) {
  var location = bulletin.brooklyn;
  appendPanelHeading_(cell, physicalBilingualText_('HOLY COMMUNION', '聖餐禮'), '1 Corinthians 11:23–26');
  appendBrooklynProgramTable_(cell, [
    [physicalBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Bible Reading', '讀經'), '1 Corinthians 11:23–26', physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Blessing the Bread', '祝福餅'), 'TBD', 'TBD'],
    [physicalBilingualText_('Breaking the Bread', '擘餅'), 'TBD', 'TBD'],
    [physicalBilingualText_('Blessing the Cup', '祝福杯'), 'TBD', 'TBD'],
    [physicalBilingualText_('Share the Cup', '分杯'), 'TBD', 'TBD'],
  ]);
}

function appendBrooklynCommunionReadingPanel_(cell) {
  appendPanelHeading_(cell, physicalBilingualText_('COMMUNION READINGS', '聖餐經文'), '1 Corinthians 11:23–26');
  appendBrooklynProgramTable_(cell, [
    [physicalBilingualText_('The Bread', '餅'), '1 Corinthians 11:24', physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('The Cup', '杯'), '1 Corinthians 11:25', physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('The Proclamation', '宣告'), '1 Corinthians 11:26', physicalBilingualText_('Congregation', '會眾')],
  ]);
}

function appendBrooklynClosingPanel_(cell, bulletin) {
  appendPanelHeading_(cell, physicalBilingualText_('CLOSING', '結束'), 'Brooklyn Fellowship');
  appendBrooklynProgramTable_(cell, [
    [physicalBilingualText_('Benediction', '祝禱'), 'TBD', 'TBD'],
    [physicalBilingualText_('Postlude', '後奏'), physicalBilingualText_('AH 690 — Dismiss Us, Lord', '第504首 散會頌'), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Silent Prayer', '靜默禱告'), '', physicalBilingualText_('Congregation', '會眾')],
  ]);
}

function appendBrooklynProgramTable_(cell, rows) {
  var table = cell.appendTable(
    rows.map(function (row) {
      return row.map(function (value) {
        return String(value === null || typeof value === 'undefined' ? '' : value);
      });
    }),
  );
  table.setBorderWidth(0.5);
  table.setColumnWidth(0, 130);
  table.setColumnWidth(1, 165);
  table.setColumnWidth(2, 65);
  rows.forEach(function (row, rowIndex) {
    var tableRow = table.getRow(rowIndex);
    styleText_(tableRow.getCell(0).editAsText(), 7.5, true);
    styleText_(tableRow.getCell(1).editAsText(), 7.5, false);
    styleText_(tableRow.getCell(2).editAsText(), 7.5, false);
  });
}

function printBrooklynPerson_(primary, fallback) {
  return printValue_(hasPrintValue_(primary) ? primary : fallback);
}

function resolvePhysicalBulletinFormat_(requestedFormat, bulletin) {
  var format = String(requestedFormat || '')
    .trim()
    .toLowerCase();

  if (!format || format === 'auto') {
    var remark = String(bulletin.specialRemark || '').toLowerCase();
    return /communion|foot\s*washing/.test(remark) ? 'communion' : 'regular';
  }
  if (format === 'regular' || format === 'communion') {
    return format;
  }
  throw new Error('Format must be regular or communion');
}

function getNextSabbathDate_(requestedDate) {
  var date = toIsoDate_(requestedDate);
  if (!date) {
    throw new Error('A valid Sabbath date is required');
  }
  var parts = date.split('-');
  var next = new Date(Date.UTC(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]) + 7));
  return [next.getUTCFullYear(), pad2_(next.getUTCMonth() + 1), pad2_(next.getUTCDate())].join('-');
}

function tryBuildPrivateBulletin_(requestedDate, nameDictionary) {
  try {
    return preparePhysicalBulletinForPrint_(
      buildBulletin_(requestedDate, { includeFullNames: true }),
      nameDictionary || buildPhysicalNameDictionary_(),
    );
  } catch (error) {
    return null;
  }
}

function buildPhysicalNameDictionary_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Name Dictionary');
  var dictionary = {
    englishToChinese: {},
    chineseToEnglish: {},
  };
  if (!sheet) {
    Logger.log('Name Dictionary sheet not found; printing source names only.');
    return dictionary;
  }

  var table = readTable_(sheet);
  table.rows.forEach(function (row) {
    var english = displayValue_(row[0]).trim();
    var chinese = displayValue_(row[1]).trim();
    var englishKey = normalizePhysicalNameKey_(english);
    var chineseKey = normalizePhysicalNameKey_(chinese);
    if (englishKey && chinese && !dictionary.englishToChinese[englishKey]) {
      dictionary.englishToChinese[englishKey] = chinese;
    }
    if (chineseKey && english && !dictionary.chineseToEnglish[chineseKey]) {
      dictionary.chineseToEnglish[chineseKey] = english;
    }
  });
  return dictionary;
}

function preparePhysicalBulletinForPrint_(bulletin, nameDictionary) {
  var personFields = [
    'sermon',
    'translation',
    'chineseTeacher',
    'englishTeacher',
    'childrenTeacher',
    'chairPastoralPrayer',
    'specialMusic',
    'offeringPrayer',
    'pianist',
    'ssChair',
    'ssOpeningPrayer',
    'closingPrayer',
    'sabbathSchool',
    'chair',
    'songLeader',
    'sabbathMessage',
    'technician',
    'testimonies',
  ];
  ['queens', 'brooklyn'].forEach(function (locationKey) {
    var location = bulletin[locationKey];
    personFields.forEach(function (field) {
      if (Object.prototype.hasOwnProperty.call(location, field)) {
        location[field] = formatPhysicalPersonValue_(location[field], nameDictionary);
      }
    });
  });
  return bulletin;
}

function formatPhysicalPersonValue_(value, nameDictionary) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value)
    .trim()
    .replace(/\s+/g, ' ');
  if (!text) {
    return '';
  }

  var dictionary = nameDictionary || { englishToChinese: {}, chineseToEnglish: {} };
  return text
    .split(/(\s*(?:\/|&|\+|\n|\band\b)\s*)/i)
    .map(function (part, index) {
      if (index % 2 === 1) {
        return part;
      }
      return formatPhysicalSinglePerson_(part, dictionary);
    })
    .join('');
}

function formatPhysicalSinglePerson_(value, dictionary) {
  var text = String(value || '').trim();
  var key = normalizePhysicalNameKey_(text);
  if (!key) {
    return text;
  }

  var chinese = dictionary.englishToChinese[key];
  if (chinese) {
    return text + '\n' + chinese;
  }

  var english = dictionary.chineseToEnglish[key];
  if (english) {
    return english + '\n' + text;
  }

  return text;
}

function normalizePhysicalNameKey_(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function movePhysicalBulletinToConfiguredFolder_(documentId) {
  var folderId = getPhysicalBulletinOutputFolderId_();
  if (!folderId) {
    return;
  }
  DriveApp.getFileById(documentId).moveTo(DriveApp.getFolderById(folderId));
}

function getPhysicalBulletinOutputFolderId_() {
  return (
    PropertiesService.getScriptProperties().getProperty(
      PHYSICAL_BULLETIN_CONFIG.outputFolderProperty,
    ) || PHYSICAL_BULLETIN_CONFIG.outputFolderId
  );
}

function createOrReplacePhysicalBulletinPdf_(documentId, title, propertyKey) {
  var properties = PropertiesService.getScriptProperties();
  var previousPdfId = properties.getProperty(propertyKey);
  var pdfBlob = DocumentApp.openById(documentId)
    .getAs(MimeType.PDF)
    .setName(title + '.pdf');
  var folderId = getPhysicalBulletinOutputFolderId_();
  var folder = folderId
    ? DriveApp.getFolderById(folderId)
    : DriveApp.getRootFolder();
  var pdfFile = folder.createFile(pdfBlob);

  if (previousPdfId && previousPdfId !== pdfFile.getId()) {
    try {
      DriveApp.getFileById(previousPdfId).setTrashed(true);
    } catch (error) {
      // A deleted or inaccessible prior PDF should not prevent the new one.
    }
  }

  properties.setProperty(propertyKey, pdfFile.getId());
  return {
    action: previousPdfId ? 'replaced' : 'created',
    id: pdfFile.getId(),
    url: pdfFile.getUrl(),
  };
}

function appendBookletPage_(body, leftRenderer, rightRenderer, isFirstPage) {
  if (!isFirstPage) {
    body.appendPageBreak();
  }

  var table = body.appendTable([['', '']]);
  table.setBorderWidth(0);
  table.setColumnWidth(0, 360);
  table.setColumnWidth(1, 360);
  var leftCell = table.getCell(0, 0);
  var rightCell = table.getCell(0, 1);
  leftCell.clear();
  rightCell.clear();
  leftRenderer(leftCell);
  rightRenderer(rightCell);
}

function appendCoverPanel_(cell, bulletin, format) {
  appendPanelHeading_(
    cell,
    physicalBilingualText_(
      PHYSICAL_BULLETIN_CONFIG.churchName,
      PHYSICAL_BULLETIN_CONFIG.churchNameChinese,
    ),
    physicalBilingualText_('Sabbath Bulletin', '安息日週報'),
  );
  appendPhysicalBulletinCoverImage_(cell, format);
  appendCenteredText_(cell, formatDateForPrint_(bulletin.date), 13, true);
  appendCenteredText_(
    cell,
    format === 'communion'
      ? physicalBilingualText_('Communion Sabbath', '聖餐安息日')
      : physicalBilingualText_('Weekly Worship', '每週崇拜'),
    12,
    true,
  );
  appendSpacer_(cell);
  appendInfoTable_(cell, [
    [physicalBilingualText_('Special Remark', '特別事項'), printValue_(bulletin.specialRemark)],
  ]);
}

function appendAnnouncementsPanel_(cell, bulletin, nextBulletin) {
  appendPanelHeading_(
    cell,
    physicalBilingualText_('ANNOUNCEMENTS', '教會消息'),
    physicalBilingualText_(
      PHYSICAL_BULLETIN_CONFIG.churchName,
      PHYSICAL_BULLETIN_CONFIG.churchNameChinese,
    ),
  );
  var announcementRows = [];
  if (hasPrintValue_(bulletin.specialRemark)) {
    announcementRows.push([physicalBilingualText_('Special', '特別事項'), bulletin.specialRemark]);
  }
  if (hasPrintValue_(bulletin.tithePurpose)) {
    announcementRows.push([physicalBilingualText_('Offering', '奉獻'), bulletin.tithePurpose]);
  }
  if (hasPrintValue_(bulletin.pastorTravel)) {
    announcementRows.push([physicalBilingualText_('Pastor travel', '牧師行程'), bulletin.pastorTravel]);
  }
  if (announcementRows.length) {
    appendInfoTable_(cell, announcementRows);
  }

  appendSectionHeading_(cell, physicalBilingualText_('Meeting Schedule', '聚會時間表'));
  appendScheduleTable_(cell, bulletin, nextBulletin);
}

function appendScheduleTable_(cell, bulletin, nextBulletin) {
  var current = bulletin.queens;
  var next = nextBulletin ? nextBulletin.queens : null;
  var rows = [[
    physicalBilingualText_('Role', '職分'),
    physicalBilingualText_('Today', '本週'),
    physicalBilingualText_('Next Sabbath', '下安息日'),
  ]];
  [
    [physicalBilingualText_('SS Chair', '安息日學主席'), 'ssChair'],
    [physicalBilingualText_('English Teacher', '英文老師'), 'englishTeacher'],
    [physicalBilingualText_('Chinese Teacher', '中文老師'), 'chineseTeacher'],
    [physicalBilingualText_('Chair / Prayer', '主席／禱告'), 'chairPastoralPrayer'],
    [physicalBilingualText_('Pianist', '鋼琴'), 'pianist'],
    [physicalBilingualText_('Offering Prayer', '奉獻禱告'), 'offeringPrayer'],
    [physicalBilingualText_('Sermon', '講道'), 'sermon'],
    [physicalBilingualText_('Special Music', '特別音樂'), 'specialMusic'],
  ].forEach(function (entry) {
    rows.push([
      entry[0],
      printValue_(current[entry[1]]),
      next ? printValue_(next[entry[1]]) : '—',
    ]);
  });
  appendDataTable_(cell, rows);
}

function appendStudyPanel_(cell, bulletin) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    physicalBilingualText_('THE CHURCH AT STUDY', '安息日學'),
    PHYSICAL_BULLETIN_CONFIG.studyTime,
  );
  appendInfoTable_(cell, [
    [physicalBilingualText_('SS Chair', '安息日學主席'), printValue_(location.ssChair)],
    [physicalBilingualText_('Opening Prayer', '開會禱告'), printValue_(location.ssOpeningPrayer)],
    [physicalBilingualText_('Opening Hymn', '開會詩歌'), 'TBD'],
    [physicalBilingualText_('Lesson / Study', '課程／學習'), 'TBD'],
    [physicalBilingualText_('Closing Hymn', '結會詩歌'), 'TBD'],
    [physicalBilingualText_('Closing Prayer', '結會禱告'), printValue_(location.closingPrayer)],
    [physicalBilingualText_('Bible Reading', '讀經'), printValue_(location.bibleVerses)],
  ]);
}

function appendWorshipPanel_(cell, bulletin) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    physicalBilingualText_('THE CHURCH AT WORSHIP', '崇拜聚會'),
    PHYSICAL_BULLETIN_CONFIG.worshipTime,
  );
  appendInfoTable_(cell, [
    [physicalBilingualText_('Chairman', '主席'), printValue_(location.chairPastoralPrayer)],
    [physicalBilingualText_('Prelude / Pianist', '前奏／鋼琴'), printValue_(location.pianist)],
    [physicalBilingualText_('Doxology', '頌讚'), physicalBilingualText_('SDAH 694 — Praise God', 'SDAH 694 — 讚美上帝')],
    [physicalBilingualText_('Invocation', '宣召'), printValue_(location.chairPastoralPrayer)],
    [physicalBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise)],
    [physicalBilingualText_('Bible Reading', '讀經'), printValue_(location.bibleVerses)],
    [physicalBilingualText_('Pastoral Prayer', '牧者禱告'), printValue_(location.chairPastoralPrayer)],
    [physicalBilingualText_('Tithe & Offering', '十一奉獻'), printValue_(bulletin.tithePurpose)],
    [physicalBilingualText_('Offering Prayer', '奉獻禱告'), printValue_(location.offeringPrayer)],
    [physicalBilingualText_('Special Music', '特別音樂'), printValue_(location.specialMusic)],
    [physicalBilingualText_('Sermon', '講道'), formatSermonForPrint_(location)],
    [physicalBilingualText_('Hymn of Response', '回應詩'), formatHymnForPrint_(location.hymnOfResponse)],
    [physicalBilingualText_('Benediction', '祝禱'), printValue_(location.closingPrayer)],
    [physicalBilingualText_('Postlude', '後奏'), physicalBilingualText_('SDAH 690 — Dismiss Us, Lord', 'SDAH 690 — 求主遣散')],
  ]);
}

function appendFootWashingPanel_(cell, bulletin) {
  appendPanelHeading_(
    cell,
    physicalBilingualText_('FOOT WASHING', '洗腳禮'),
    PHYSICAL_BULLETIN_CONFIG.footWashingScripture,
  );
  appendInfoTable_(cell, [
    [physicalBilingualText_('Bible Reading', '讀經'), PHYSICAL_BULLETIN_CONFIG.footWashingScripture],
    [physicalBilingualText_('Reader', '讀經者'), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Foot Washing', '洗腳禮'), physicalBilingualText_('All Congregations', '全體會眾')],
  ]);
  appendBodyText_(cell, PHYSICAL_BULLETIN_CONFIG.footWashingInstruction);
  appendSectionHeading_(cell, physicalBilingualText_('Prayer of Silence', '靜默禱告'));
  appendBodyText_(cell, physicalBilingualText_('Congregation', '會眾'));
  appendBodyText_(cell, physicalBilingualText_('The service continues with the Holy Communion section.', '接著進行聖餐禮。'));
}

function appendCommunionPanel_(cell, bulletin) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    physicalBilingualText_('HOLY COMMUNION', '聖餐禮'),
    PHYSICAL_BULLETIN_CONFIG.communionScripture,
  );
  appendInfoTable_(cell, [
    [physicalBilingualText_('Hymn of Praise', '讚美詩'), formatHymnForPrint_(location.hymnOfPraise)],
    [physicalBilingualText_('Bible Reading', '讀經'), PHYSICAL_BULLETIN_CONFIG.communionScripture],
    [physicalBilingualText_('Reader', '讀經者'), physicalBilingualText_('Congregation', '會眾')],
    [physicalBilingualText_('Blessing the Bread', '祝福餅'), printValue_(location.chairPastoralPrayer)],
    [physicalBilingualText_('Breaking the Bread', '擘餅'), printValue_(location.sermon)],
    [physicalBilingualText_('Blessing the Cup', '祝福杯'), printValue_(location.chairPastoralPrayer)],
    [physicalBilingualText_('Share the Cup', '分杯'), printValue_(location.sermon)],
  ]);
  appendBodyText_(cell, physicalBilingualText_('Prayer of silence follows each communion action.', '每項聖餐禮儀後進行靜默禱告。'));
}

function appendCommunionReadingPanel_(cell, bulletin) {
  appendPanelHeading_(
    cell,
    physicalBilingualText_('COMMUNION READINGS', '聖餐經文'),
    PHYSICAL_BULLETIN_CONFIG.communionScripture,
  );
  appendInfoTable_(cell, [
    [physicalBilingualText_('The Bread', '餅'), '1 Corinthians 11:24'],
    [physicalBilingualText_('The Cup', '杯'), '1 Corinthians 11:25'],
    [physicalBilingualText_('The Proclamation', '宣告'), '1 Corinthians 11:26'],
    [physicalBilingualText_('Reader', '讀經者'), physicalBilingualText_('Congregation', '會眾')],
  ]);
  appendBodyText_(cell, physicalBilingualText_('See the Scripture references above.', '請參閱以上經文。'));
}

function appendCommunionClosingPanel_(cell, bulletin) {
  var location = bulletin.queens;
  appendPanelHeading_(
    cell,
    physicalBilingualText_('CLOSING', '結束'),
    physicalBilingualText_(
      PHYSICAL_BULLETIN_CONFIG.churchName,
      PHYSICAL_BULLETIN_CONFIG.churchNameChinese,
    ),
  );
  appendInfoTable_(cell, [
    [physicalBilingualText_('Benediction', '祝禱'), printValue_(location.closingPrayer)],
    [physicalBilingualText_('Postlude', '後奏'), physicalBilingualText_('SDAH 690 — Dismiss Us, Lord', 'SDAH 690 — 求主遣散')],
    [physicalBilingualText_('Silent Prayer', '靜默禱告'), physicalBilingualText_('Congregation', '會眾')],
  ]);
  appendCenteredText_(cell, physicalBilingualText_('Thank you for worshiping with us.', '感謝您與我們一同崇拜。'), 10, false);
}

function appendPanelHeading_(cell, title, subtitle) {
  appendCenteredText_(cell, title, 15, true);
  if (subtitle) {
    appendCenteredText_(cell, subtitle, 9, false);
  }
  appendSpacer_(cell);
}

function appendSectionHeading_(cell, text) {
  appendCenteredText_(cell, text, 11, true);
  appendSpacer_(cell);
}

function appendCenteredText_(cell, text, size, bold) {
  var paragraph = cell.appendParagraph(String(text || ''));
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  styleText_(paragraph.editAsText(), size, bold);
}

function appendBodyText_(cell, text) {
  var paragraph = cell.appendParagraph(String(text || ''));
  paragraph.setAlignment(DocumentApp.HorizontalAlignment.LEFT);
  styleText_(paragraph.editAsText(), 8, false);
}

function appendSpacer_(cell) {
  var paragraph = cell.appendParagraph(' ');
  styleText_(paragraph.editAsText(), 3, false);
}

function appendInfoTable_(cell, rows) {
  appendDataTable_(
    cell,
    [[physicalBilingualText_('Item', '項目'), physicalBilingualText_('Details', '內容')]].concat(rows),
  );
}

function appendDataTable_(cell, rows) {
  var table = cell.appendTable(
    rows.map(function (row) {
      return row.map(function (value) {
        return String(value === null || typeof value === 'undefined' ? '' : value);
      });
    }),
  );
  table.setBorderWidth(0.5);
  for (var rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    var row = table.getRow(rowIndex);
    for (var columnIndex = 0; columnIndex < rows[rowIndex].length; columnIndex += 1) {
      styleText_(row.getCell(columnIndex).editAsText(), rowIndex === 0 ? 7 : 7.5, rowIndex === 0);
    }
  }
}

function styleText_(text, size, bold) {
  text.setFontFamily('Arial');
  text.setFontSize(size);
  text.setBold(Boolean(bold));
}

function formatHymnForPrint_(hymn) {
  hymn = hymn || {};
  var english = String(hymn.english || '').trim();
  var chinese = String(hymn.chinese || '').trim();
  if (english && chinese && english !== chinese) {
    return physicalBilingualText_(english, chinese);
  }
  return english || chinese || 'TBD';
}

function formatSermonForPrint_(location) {
  var titleText = formatSermonTitleForPrint_(location);
  var speaker = printValue_(location.sermon);
  return titleText && titleText !== 'TBD' ? titleText + ' — ' + speaker : speaker;
}

function formatSermonTitleForPrint_(location) {
  var title = location.sermonTitle || {};
  var englishTitle = String(title.english || '').trim();
  var chineseTitle = String(title.chinese || '').trim();
  return (
    englishTitle && chineseTitle && englishTitle !== chineseTitle
      ? physicalBilingualText_(englishTitle, chineseTitle)
      : englishTitle || chineseTitle
  ) || 'TBD';
}

function formatDateForPrint_(date) {
  var parts = toIsoDate_(date).split('-');
  var monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  return (
    monthNames[Number(parts[1]) - 1] +
    ' ' +
    Number(parts[2]) +
    ', ' +
    parts[0] +
    '\n' +
    parts[0] +
    '年' +
    Number(parts[1]) +
    '月' +
    Number(parts[2]) +
    '日'
  );
}

function physicalBilingualText_(english, traditionalChinese) {
  return String(english || '') + '\n' + String(traditionalChinese || '');
}

function printValue_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return text || 'TBD';
}

function hasPrintValue_(value) {
  var text = String(value === null || typeof value === 'undefined' ? '' : value).trim();
  return Boolean(text && text.toLowerCase() !== 'tbd');
}
