/**
 * Publish & Notify Phones (#709): the Announcements menu's one item. Phones
 * notify members of a week's announcement only after someone presses Publish
 * here, never because a cell changed. Staff see, in English and Chinese, that
 * it sends a notification to everyone who has the app and turned them on, and
 * the text it's for, before they confirm.
 *
 * Publishing keeps the time, per Sabbath and location, in a Script Property
 * (ANNOUNCEMENTS_PUBLISHED_PROPERTY), so the sheet doesn't change. The bulletin
 * API sends it as each location's `announcementsPublishedAt`
 * (getAnnouncementsPublishedAt_ in BulletinApi.gs). Phones check every few
 * hours, and each notifies once a Sabbath at most, in the daytime, and not
 * after sunset on Friday: see "Notifications" in
 * docs/feature_designs/announcements.md.
 */

// Old Sabbaths' entries are dropped after this, so the property stays small.
var ANNOUNCEMENTS_PUBLISHED_KEEP_DAYS = 35;

// Who may publish: a short list of its own, kept apart from the print and
// admin lists so it stays short. The Google accounts in this Script Property,
// separated by commas, semicolons, spaces or new lines. Unset or blank, nobody
// can publish.
var ANNOUNCEMENT_PUBLISHERS_PROPERTY = 'ANNOUNCEMENT_PUBLISHER_EMAILS';

var ANNOUNCEMENT_PUBLISHER_REFUSAL =
  'Only a few accounts can publish announcements to phones, and yours isn’t one of them. To be added, ' +
  'ask the technology team (IT) to put your Google account in the ' +
  ANNOUNCEMENT_PUBLISHERS_PROPERTY +
  ' Script Property.\n' +
  '只有少数账号可以向手机发布报告事项，您的账号不在其中。如需加入，请联系技术团队（IT），将您的 Google 账号加入 ' +
  ANNOUNCEMENT_PUBLISHERS_PROPERTY +
  ' 脚本属性。';

function getAnnouncementPublisherEmails_() {
  var listed = String(PropertiesService.getScriptProperties().getProperty(ANNOUNCEMENT_PUBLISHERS_PROPERTY) || '');
  return listed
    .split(/[;,\s]+/)
    .map(function (email) {
      return email.trim().toLowerCase();
    })
    .filter(Boolean);
}

// The account using the sheet, not the script's owner, is the one that must be
// on the list. Google may not say who it is, and then it isn't.
function isAnnouncementPublisher_() {
  var email = '';
  try {
    email = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  } catch (error) {
    return false;
  }
  return Boolean(email) && getAnnouncementPublisherEmails_().indexOf(email) !== -1;
}

function requireAnnouncementPublisher_() {
  if (!isAnnouncementPublisher_()) {
    throw new Error(ANNOUNCEMENT_PUBLISHER_REFUSAL);
  }
}

// The one place the publish times are written, so its first step is the
// publishers check, whatever called it.
function writeAnnouncementsPublished_(published) {
  requireAnnouncementPublisher_();
  getAnnouncementsPublishedStore_().setProperty(ANNOUNCEMENTS_PUBLISHED_PROPERTY, JSON.stringify(published));
}

// The Sabbath a publish is for: the coming one, or next week's on a Sabbath,
// when phones no longer notify for that day's.
function getAnnouncementsPublishDate_(today) {
  var date = getClosestSaturdayDate_(today);
  return date === today ? addPrintedBulletinDays_(today, 7) : date;
}

// A location's announcement for a Sabbath as typed in Weekly Data, its lines
// as the API reads them, or blank.
function getWeeklyDataAnnouncementText_(spreadsheet, date, location) {
  var place = createLocation_();
  populateBulletinIntake_(place, getBulletinIntakeRows_(spreadsheet, date, location));
  return place.announcements.join('\n');
}

// What the dialog shows: the Sabbath, and each location's announcement and
// when it was published, if it was.
function getPublishAnnouncementsData_(spreadsheet, today) {
  var date = getAnnouncementsPublishDate_(today);
  var published = readAnnouncementsPublished_()[date] || {};
  return {
    date: date,
    locations: BULLETIN_ANNOUNCEMENT_LOCATIONS.map(function (location) {
      return {
        key: location.key,
        label: location.label,
        text: getWeeklyDataAnnouncementText_(spreadsheet, date, location.key),
        publishedAt: typeof published[location.key] === 'string' ? published[location.key] : '',
      };
    }),
  };
}

// The menu item: only this, so the menu can call it from anywhere.
function openPublishAnnouncementsDialog() {
  showPublishAnnouncementsDialog_(getBulletinSpreadsheet_(), getPrintedBulletinToday_());
  return null;
}

function showPublishAnnouncementsDialog_(spreadsheet, today) {
  var ui = SpreadsheetApp.getUi();
  if (!isAnnouncementPublisher_()) {
    ui.alert('Publish & Notify Phones / 发布并通知手机', ANNOUNCEMENT_PUBLISHER_REFUSAL, ui.ButtonSet.OK);
    return;
  }
  var data = getPublishAnnouncementsData_(spreadsheet, today);
  var output = HtmlService.createHtmlOutput(buildPublishAnnouncementsHtml_(data)).setWidth(560).setHeight(640);
  ui.showModalDialog(output, 'Publish & Notify Phones / 发布并通知手机');
}

// The dialog's Publish & notify. Run by the dialog, so not ending in an
// underscore, and only this.
function publishAnnouncementsFromDialog(request) {
  return publishAnnouncements_(getBulletinSpreadsheet_(), request, getPrintedBulletinToday_(), new Date());
}

/**
 * Publishes each location the dialog names, for the Sabbath it showed, if
 * Weekly Data still has the text it showed and it isn't published already.
 * Returns the locations published. Only for an account on the publishers
 * list, checked here, where the publish time is written, whatever called it.
 */
function publishAnnouncements_(spreadsheet, request, today, now) {
  requireAnnouncementPublisher_();
  var date = String((request && request.date) || '');
  var texts = (request && request.texts) || {};
  if (date !== getAnnouncementsPublishDate_(today)) {
    throw new Error(
      'This dialog is out of date. Close it, and open Announcements → Publish & Notify Phones… again.\n' +
        '此窗口已过期。请关闭后，重新打开 Announcements → Publish & Notify Phones…。',
    );
  }
  var chosen = BULLETIN_ANNOUNCEMENT_LOCATIONS.filter(function (location) {
    return typeof texts[location.key] === 'string';
  });
  if (!chosen.length) {
    throw new Error('Choose a location to publish. / 请选择要发布的地点。');
  }
  chosen.forEach(function (location) {
    var text = getWeeklyDataAnnouncementText_(spreadsheet, date, location.key);
    if (!text) {
      throw new Error(
        location.label + ': Weekly Data has no announcement for ' + date + '. / Weekly Data 中没有该日的报告事项。',
      );
    }
    if (text !== texts[location.key]) {
      throw new Error(
        location.label +
          ': the announcement changed in Weekly Data since this opened. Close this, and open it again to see the new text.\n' +
          '打开此窗口后，Weekly Data 中的报告事项已有修改。请关闭后重新打开，查看新内容。',
      );
    }
  });

  var at = now.toISOString();
  var done = [];
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var published = readAnnouncementsPublished_();
    var entry = published[date] || {};
    chosen.forEach(function (location) {
      if (!entry[location.key]) {
        entry[location.key] = at;
        done.push(location.key);
      }
    });
    published[date] = entry;
    var cutoff = addPrintedBulletinDays_(today, -ANNOUNCEMENTS_PUBLISHED_KEEP_DAYS);
    Object.keys(published).forEach(function (key) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(key) || key < cutoff) {
        delete published[key];
      }
    });
    writeAnnouncementsPublished_(published);
  } finally {
    lock.releaseLock();
  }
  // So a phone that checks in the next two minutes gets it, rather than the
  // API's copy from before.
  try {
    CacheService.getScriptCache().removeAll([
      'bulletin:' + CONFIG.cacheVersion + ':' + date,
      'bulletin:' + CONFIG.cacheVersion + ':schedule-optional:' + date,
    ]);
  } catch (error) {
    if (typeof Logger !== 'undefined') {
      Logger.log('Could not clear the bulletin cache after publishing: ' + error);
    }
  }
  return { published: done, at: at };
}

function formatAnnouncementsPublishedAt_(value) {
  var date = new Date(value);
  if (isNaN(date.getTime())) {
    return '';
  }
  if (typeof Utilities !== 'undefined' && typeof Session !== 'undefined') {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), 'EEE, MMM d, h:mm a');
  }
  return date.toISOString();
}

// Staff-facing, so in English and Simplified Chinese, as the Create Word Doc…
// dialog is.
function buildPublishAnnouncementsHtml_(data) {
  var toJson = function (value) {
    return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  };
  var cards = data.locations
    .map(function (location) {
      var state = location.publishedAt
        ? '<p class="state">✓ Published / 已发布 · ' +
          escapePrintedBulletinHtml_(formatAnnouncementsPublishedAt_(location.publishedAt)) +
          '</p>'
        : !location.text
          ? '<p class="state">No announcement in Weekly Data / Weekly Data 中没有报告事项</p>'
          : '';
      var open = !location.publishedAt && location.text;
      return (
        '<label class="location' +
        (open ? '' : ' off') +
        '"><span class="name"><input type="checkbox" name="location" value="' +
        escapePrintedBulletinHtml_(location.key) +
        '"' +
        (open ? ' checked' : ' disabled') +
        '> ' +
        escapePrintedBulletinHtml_(location.label) +
        '</span>' +
        (location.text ? '<span class="text">' + escapePrintedBulletinHtml_(location.text) + '</span>' : '') +
        state +
        '</label>'
      );
    })
    .join('');
  var anyOpen = data.locations.some(function (location) {
    return !location.publishedAt && location.text;
  });
  return (
    '<!doctype html>' +
    '<html><head><base target="_top"><style>' +
    'body{font-family:Arial,sans-serif;color:#202124;padding:18px 22px;}' +
    '.warning{background:#fef7e0;border:1px solid #f9ab00;border-radius:8px;font-size:14px;line-height:1.5;margin:0 0 16px;padding:13px 14px;}' +
    '.warning strong{display:block;font-size:16px;margin-bottom:4px;}' +
    '.date{font-size:14px;font-weight:600;margin:0 0 10px;}' +
    '.location{border:1px solid #dadce0;border-radius:8px;display:block;margin:0 0 10px;padding:12px 14px;}' +
    '.location.off{color:#5f6368;}' +
    '.name{display:block;font-size:14px;font-weight:600;}' +
    '.text{background:#f8f9fa;border:1px solid #dadce0;border-radius:4px;display:block;font-size:14px;line-height:1.45;margin-top:8px;padding:9px 10px;white-space:pre-wrap;}' +
    '.state{font-size:13px;margin:8px 0 0;}' +
    '.note{color:#5f6368;font-size:12px;line-height:1.45;margin:12px 0 0;}' +
    '.actions{display:flex;justify-content:flex-end;gap:9px;margin-top:18px;}' +
    'button{font:14px Arial,sans-serif;border:0;border-radius:4px;cursor:pointer;padding:9px 17px;}' +
    '.cancel{background:#f1f3f4;color:#202124;}' +
    '.submit{background:#1a73e8;color:#fff;font-weight:600;}' +
    '.submit:disabled{background:#9aa0a6;cursor:not-allowed;}' +
    '.error{color:#b3261e;font-size:13px;line-height:1.4;margin-top:12px;white-space:pre-wrap;}' +
    '.done{font-size:15px;line-height:1.5;}' +
    '</style></head><body>' +
    '<div id="form">' +
    '<div class="warning"><strong>This notifies everyone with the app / 这会通知所有使用应用的人</strong>' +
    'Everyone who has the church app and turned on announcement notifications for a location you check ' +
    'gets a notification of it, in their app’s language. Phones check every few hours, so it comes within ' +
    'a few hours, in the daytime; some iPhones only when the app is next opened. None is sent after sunset ' +
    'on Friday. It can’t be taken back.<br>' +
    '所有安装了教会应用、并开启了所选地点报告事项通知的人，都会收到通知，以其应用所设的语言显示。' +
    '手机每隔几小时检查一次，所以通知会在几小时内、于白天送达；部分 iPhone 要等下次打开应用时才收到。' +
    '周五日落后不再发送。发布后无法撤回。</div>' +
    '<p class="date">Sabbath / 安息日：' +
    escapePrintedBulletinHtml_(data.date) +
    '</p>' +
    cards +
    '<p class="note">A change in Weekly Data after this shows in the app’s bulletin, but sends no new ' +
    'notification: each phone notifies once a Sabbath at most. Clearing the cell stops it on phones that ' +
    'haven’t checked yet.<br>' +
    '发布后在 Weekly Data 中的修改会显示在应用的周刊中，但不会再次发送通知：每部手机每个安息日最多通知一次。' +
    '清空单元格可阻止尚未检查的手机发送通知。</p>' +
    '<div id="error" class="error"></div>' +
    '<div class="actions"><button type="button" class="cancel" onclick="google.script.host.close()">Cancel / 取消</button>' +
    '<button type="button" class="submit" id="publish"' +
    (anyOpen ? '' : ' disabled') +
    '>Publish &amp; notify / 发布并通知</button></div>' +
    '</div>' +
    '<div id="done" class="done" hidden><p>Published. Phones get it within a few hours.<br>已发布。手机会在几小时内收到。</p>' +
    '<div class="actions"><button type="button" class="submit" onclick="google.script.host.close()">OK / 确定</button></div></div>' +
    '<script>' +
    'var data=' +
    toJson(data) +
    ';var accountHint=' +
    toJson(PRINTED_BULLETIN_ACCOUNT_HINT) +
    ';var button=document.getElementById("publish");' +
    'var boxes=[].slice.call(document.querySelectorAll("input[name=location]"));' +
    'var update=function(){button.disabled=!boxes.some(function(box){return box.checked;});};' +
    'boxes.forEach(function(box){box.addEventListener("change",update);});update();' +
    'button.addEventListener("click",function(){' +
    'var texts={};data.locations.forEach(function(location){' +
    'if(boxes.some(function(box){return box.value===location.key&&box.checked;}))texts[location.key]=location.text;});' +
    'button.disabled=true;document.getElementById("error").textContent="";' +
    'google.script.run.withSuccessHandler(function(){' +
    'document.getElementById("form").hidden=true;document.getElementById("done").hidden=false;})' +
    '.withFailureHandler(function(error){' +
    'var message=error&&error.message?error.message:String(error);' +
    'document.getElementById("error").textContent=(/PERMISSION_DENIED/.test(message)?accountHint+"\\n\\n":"")+message;update();})' +
    '.publishAnnouncementsFromDialog({date:data.date,texts:texts});});' +
    '</script></body></html>'
  );
}
