/**
 * Printed-bulletin hymn lookup between the 1985 SDA Hymnal and the 505 Chinese
 * Hymnal.
 *
 * The data is BULLETIN_HYMNAL_DATA, in HymnalData.gs, which
 * scripts/deploy-apps-script.mjs makes from features/hymnal/ on every deploy
 * (#619). Manually entered bilingual values always take precedence; the lookup
 * fills only the missing side, with the other hymnal's number and title, such
 * as "AH 73 Holy, Holy, Holy" for "第2首 聖哉真神", and never copies English
 * into the Chinese field. A hymn typed by title alone, such as "holy holy
 * holy", is found by its title too (findPrintedHymnByTitle_).
 */

// The generated data, or empty data if HymnalData.gs is missing, so a hymn
// still prints as typed.
function getBulletinHymnalData_() {
  return typeof BULLETIN_HYMNAL_DATA !== 'undefined'
    ? BULLETIN_HYMNAL_DATA
    : { englishTitles: {}, chineseTitles: {}, numberMaps: {}, hymnBankRows: [] };
}

// A title as it's compared: lower case, without spaces or punctuation.
function normalizePrintedHymnTitle_(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[\s.,;:!?'"’‘“”()\[\]\-–—、，。！？；：「」『』（）·・･]/g, '');
}

var printedHymnTitleIndex_ = null;

// Each normalized title, in each hymnal, with the numbers that have it.
function getPrintedHymnTitleIndex_() {
  if (printedHymnTitleIndex_) {
    return printedHymnTitleIndex_;
  }
  var data = getBulletinHymnalData_();
  var index = { english: {}, chinese: {} };
  var add = function (titles, map) {
    Object.keys(titles || {}).forEach(function (number) {
      var key = normalizePrintedHymnTitle_(titles[number]);
      if (!key) return;
      map[key] = map[key] || [];
      if (map[key].indexOf(Number(number)) === -1) map[key].push(Number(number));
    });
  };
  add(data.englishTitles, index.english);
  add(data.chineseTitles, index.chinese);
  add(data.chineseTitlesSimplified, index.chinese);
  printedHymnTitleIndex_ = index;
  return index;
}

/**
 * A hymn typed by title alone, in "english" or "chinese": its number, and its
 * twin's in the other hymnal. Only an exact match counts. Where hymns share
 * the title, such as "Holy, Holy, Holy" (#73 and #661), the one with a twin
 * wins; if every one with a twin has the same twin, only the twin is known;
 * otherwise nothing is.
 */
function findPrintedHymnByTitle_(language, text) {
  var numbers = getPrintedHymnTitleIndex_()[language][normalizePrintedHymnTitle_(text)] || [];
  var source = language === 'english' ? 'englishToChinese' : 'chineseToEnglish';
  var twinned = numbers.filter(function (number) {
    return getPrintedMappedHymnNumber_(source, number);
  });
  if (numbers.length === 1 || twinned.length === 1) {
    var number = numbers.length === 1 ? numbers[0] : twinned[0];
    return { number: number, twin: getPrintedMappedHymnNumber_(source, number) };
  }
  var twins = twinned
    .map(function (number) {
      return getPrintedMappedHymnNumber_(source, number);
    })
    .filter(function (twin, index, all) {
      return all.indexOf(twin) === index;
    });
  return twins.length === 1 ? { number: null, twin: twins[0] } : null;
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
  var missing = function (value) {
    return !value || isPhysicalTbd_(value);
  };

  // One side typed by title alone: print it with its number, and its twin.
  if (!missing(resolvedEnglish) && missing(resolvedChinese) && !getPrintedHymnNumber_(resolvedEnglish)) {
    var english = findPrintedHymnByTitle_("english", resolvedEnglish);
    if (english) {
      if (english.number) resolvedEnglish = formatPrintedEnglishHymn_(english.number);
      if (english.twin) resolvedChinese = formatPrintedChineseHymn_(english.twin);
    }
  } else if (!missing(resolvedChinese) && missing(resolvedEnglish) && !getPrintedHymnNumber_(resolvedChinese)) {
    var chineseHymn = findPrintedHymnByTitle_("chinese", resolvedChinese);
    if (chineseHymn) {
      if (chineseHymn.number) resolvedChinese = formatPrintedChineseHymn_(chineseHymn.number);
      if (chineseHymn.twin) resolvedEnglish = formatPrintedEnglishHymn_(chineseHymn.twin);
    }
  }

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
