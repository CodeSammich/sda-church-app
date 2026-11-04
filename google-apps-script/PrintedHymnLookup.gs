/**
 * Printed-bulletin hymn lookup between the 1985 SDA Hymnal and the 505 Chinese
 * Hymnal.
 *
 * The data is BULLETIN_HYMNAL_DATA, in HymnalData.gs, which
 * scripts/deploy-apps-script.mjs makes from features/hymnal/ on every deploy
 * (#619). Manually entered bilingual values always take precedence; the lookup
 * fills only the missing side, with the other hymnal's number and title, such
 * as "AH 73 Holy, Holy, Holy" for "第2首 聖哉真神", and never copies English
 * into the Chinese field.
 */

// The generated data, or empty data if HymnalData.gs is missing, so a hymn
// still prints as typed.
function getBulletinHymnalData_() {
  return typeof BULLETIN_HYMNAL_DATA !== 'undefined'
    ? BULLETIN_HYMNAL_DATA
    : { englishTitles: {}, chineseTitles: {}, numberMaps: {}, hymnBankRows: [] };
}

function getPrintedHymnNumber_(value) {
  var match = String(value || "").match(/(?:^|[^\d])(\d{1,3})(?=$|[^\d])/);
  return match ? Number(match[1]) : null;
}

function getPrintedMappedHymnNumber_(source, number) {
  if (!number) return null;
  var map = getBulletinHymnalData_().numberMaps[source] || {};
  var mapped = map[String(number)];
  return mapped && mapped.length ? Number(mapped[0]) : null;
}

// "第2首 聖哉真神", or "第2首" if the app has no title for it.
function formatPrintedChineseHymn_(number) {
  var title = getBulletinHymnalData_().chineseTitles[String(number)];
  return "第" + number + "首" + (title ? " " + title : "");
}

// "AH 73 Holy, Holy, Holy", or "AH 73" if the app has no title for it.
function formatPrintedEnglishHymn_(number) {
  var title = getBulletinHymnalData_().englishTitles[String(number)];
  return "AH " + number + (title ? " " + title : "");
}

function resolvePrintedHymnText_(english, chinese) {
  var resolvedEnglish = String(english || "").trim();
  var resolvedChinese = String(chinese || "").trim();

  if ((!resolvedChinese || isPhysicalTbd_(resolvedChinese)) && resolvedEnglish && !isPhysicalTbd_(resolvedEnglish)) {
    var chineseNumber = getPrintedMappedHymnNumber_(
      "englishToChinese",
      getPrintedHymnNumber_(resolvedEnglish),
    );
    if (chineseNumber) {
      resolvedChinese = formatPrintedChineseHymn_(chineseNumber);
    }
  }

  if ((!resolvedEnglish || isPhysicalTbd_(resolvedEnglish)) && resolvedChinese && !isPhysicalTbd_(resolvedChinese)) {
    var englishNumber = getPrintedMappedHymnNumber_(
      "chineseToEnglish",
      getPrintedHymnNumber_(resolvedChinese),
    );
    if (englishNumber) {
      resolvedEnglish = formatPrintedEnglishHymn_(englishNumber);
    }
  }

  return { english: resolvedEnglish, chinese: resolvedChinese };
}
