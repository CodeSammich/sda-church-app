/**
 * Converts the 1919 Chinese Union Version from Traditional to Simplified, for
 * scripts/build-cuv-1919.mjs, and for test/cuv-1919-witnesses.test.ts, which
 * checks that the Simplified text is exactly this conversion of the
 * Traditional text, so both have the same words.
 *
 * opencc-js (Taiwan to Mainland) does the conversion, as for the app's pinyin.
 * Then:
 * - the phrases it gets wrong in this text are fixed, from
 *   services/BibleSimplifiedFixes.json, which the pinyin uses too;
 * - two rare characters it simplifies to forms outside the Basic Multilingual
 *   Plane, which many phones can't display, get usual forms: 蔯 (茵蔯,
 *   wormwood) becomes 陈, not 𫈟, and 鐏 (the butt of a spear) stays 鐏, not
 *   𨱔. Any other such character fails the conversion.
 */
const OpenCC = require('opencc-js/t2cn');

const { phrases } = require('../services/BibleSimplifiedFixes.json');

const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

const toSimplified = (text) => {
  let simplified = converter(text).replace(/𫈟/gu, '陈').replace(/𨱔/gu, '鐏');
  for (const [from, to] of phrases) simplified = simplified.split(from).join(to);
  const rare = simplified.match(/[\u{10000}-\u{10ffff}]/u);
  if (rare) throw new Error(`Simplified text has ${rare[0]}, which many phones can't display: ${text}`);
  return simplified;
};

module.exports = { toSimplified };
