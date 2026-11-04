#!/usr/bin/env node
/**
 * Writes google-apps-script/HymnalData.gs, the bulletin scripts' copy of the
 * app's hymnal data (#619): the 1985 SDA Hymnal's and the 505 Chinese Hymnal's
 * titles (the 505's in Traditional, and as the app stores them in Simplified,
 * so a hymn typed by title in either is found), the number maps between them,
 * and the Hymn Bank tab's rows.
 *
 * scripts/deploy-apps-script.mjs runs it before every push, like the generated
 * PinyinPro.gs, so the deployed script always matches features/hymnal/. The
 * file is never edited or committed. The rows and the Traditional titles come
 * from scripts/export-hymn-bank.cjs, so the tab and the printed bulletin read
 * the same titles.
 *
 * Usage: node scripts/build-hymnal-apps-script.cjs
 */
const { writeFileSync } = require('node:fs');
const { join } = require('node:path');
const { buildHymnBank, readHymnals, toTraditional } = require('./export-hymn-bank.cjs');

const OUTPUT = join(__dirname, '..', 'google-apps-script', 'HymnalData.gs');

const buildHymnalData = (hymnals = readHymnals()) => {
  const { mappings } = require(join(__dirname, '..', 'features', 'hymnal', 'HymnalNumberMappings.json'));
  const numberMap = (id) => mappings.find((mapping) => mapping.id === id).numberMap;
  return {
    englishTitles: hymnals.english,
    chineseTitles: Object.fromEntries(
      Object.entries(hymnals.chinese)
        .filter(([, title]) => title)
        .map(([number, title]) => [number, toTraditional(title)]),
    ),
    chineseTitlesSimplified: Object.fromEntries(
      Object.entries(hymnals.chinese).filter(([, title]) => title),
    ),
    numberMaps: {
      englishToChinese: numberMap('sdah-1985-en-to-chinese-hymnal-505'),
      chineseToEnglish: numberMap('chinese-hymnal-505-to-sdah-1985-en'),
    },
    hymnBankRows: buildHymnBank(hymnals),
  };
};

const buildHymnalAppsScript = (data = buildHymnalData()) =>
  '// Generated from features/hymnal/ by scripts/build-hymnal-apps-script.cjs (#619).\n' +
  '// Do not edit this generated file directly: deploying makes it again.\n' +
  `var BULLETIN_HYMNAL_DATA = Object.freeze(${JSON.stringify(data)});\n`;

if (require.main === module) {
  writeFileSync(OUTPUT, buildHymnalAppsScript());
}

module.exports = { buildHymnalAppsScript, buildHymnalData };
