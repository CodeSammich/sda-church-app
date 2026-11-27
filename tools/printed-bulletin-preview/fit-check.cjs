// Decides whether a preview passes, and writes its summary.
//
// Widths and type sizes come straight from the Doc's structure, so they're
// checked as they are. Heights are drawn with stand-in fonts and modelled
// line heights, and the cover art's real size isn't known, so a few panels
// read a little over even when the printed bulletin fits (the covers, the
// Brooklyn Encouragement). With a base to compare with, a height fails only
// when a half that fit on the base no longer fits, or one already over grows.
'use strict';

// Points a half may grow while already over, before it counts as worse.
const TOLERANCE_PT = 1;

function regions(page) {
  const halves = Object.keys(page.panels || {});
  if (halves.length) return halves.map((half) => ({ key: `${page.page}:${half}`, name: `page ${page.page}, ${half} half`, slack: page.panels[half] }));
  return [{ key: `${page.page}:page`, name: `page ${page.page}`, slack: page.slackPt }];
}

// Points over, at least "under 1" for a fraction of a point.
const by = (n) => (Math.abs(n) < 0.5 ? 'under 1' : String(Math.abs(Math.round(n))));
const pt = (n) => (n >= 0 ? `+${Math.round(n)}` : `−${by(n) === 'under 1' ? '<1' : by(n)}`);

/**
 * `head` and `base` map each variant's name to its result: pages (measured
 * in Chrome) plus smallText, tooWide, unknownCalls, missingUrls,
 * unknownImages and unknownFonts (from build.cjs). `base` may be null.
 * `realCheck` names what settles a half that was already over.
 */
function evaluate(head, base, { realCheck = 'a real Doc' } = {}) {
  const failures = [];
  const notes = [];
  const rows = [];
  Object.keys(head).forEach((name) => {
    const result = head[name];
    const before = base && base[name];
    result.unknownCalls.forEach((call) => failures.push(`${name}: the fake Google Docs has no ${call}; add it to the preview tool`));
    result.missingUrls.forEach((url) => failures.push(`${name}: no made-up response for ${url}; add it to bible-chapters.json`));
    result.unknownImages.forEach((id) => failures.push(`${name}: an image with an unknown Drive ID (${id}); add its size to made-up-data.cjs`));
    result.smallText.forEach((run) => failures.push(`${name}, page ${run.page}: "${run.text}" is ${run.size} pt, under the 10 pt minimum`));
    result.tooWide.forEach((item) => failures.push(`${name}, page ${item.page}: a ${item.what} ${item.widthPt} pt wide is in ${item.availablePt} pt ("${item.text}")`));
    result.unknownFonts.forEach((font) => notes.push(`${name}: the preview has no line height for the font ${font}, so it uses Times New Roman's`));
    if (before && before.pages.length !== result.pages.length) {
      notes.push(`${name}: ${result.pages.length} pages, ${before.pages.length} on the base`);
    }

    const baseSlack = new Map();
    if (before) before.pages.forEach((page) => regions(page).forEach((r) => baseSlack.set(r.key, r.slack)));
    result.pages.forEach((page) => regions(page).forEach((region) => {
      const was = baseSlack.has(region.key) ? baseSlack.get(region.key) : null;
      let status = 'fits';
      if (region.slack < 0) {
        const over = `${name}, ${region.name}: overflows by ${by(region.slack)} pt`;
        if (!base) {
          status = 'overflows';
          failures.push(over);
        } else if (was === null) {
          status = 'overflows';
          failures.push(`${over}, a page the base doesn't have`);
        } else if (was >= 0) {
          status = 'overflows';
          failures.push(`${over}; it fit on the base, with ${Math.round(was)} pt to spare`);
        } else if (region.slack < was - TOLERANCE_PT) {
          status = 'overflows more';
          failures.push(`${over}, ${Math.round(was - region.slack)} pt more than on the base`);
        } else {
          status = 'over on the base too';
          notes.push(`${over}, as on the base (${by(was)} pt), so not because of this change; ${realCheck} shows whether it fits`);
        }
      }
      rows.push({ variant: name, region: region.name, slack: region.slack, base: was, status });
    }));
  });
  return { failures, notes, rows };
}

function summaryMarkdown({ failures, notes, rows }, { baseLabel, pageCounts, wordCopy } = {}) {
  const lines = [wordCopy ? '## Printed bulletin preview in Songti TC' : '## Printed bulletin preview', ''];
  lines.push(failures.length ? `**${failures.length} problem${failures.length === 1 ? '' : 's'}:**` : '**Every page fits.**');
  failures.forEach((f) => lines.push(`- ${f}`));
  lines.push('');
  lines.push(baseLabel
    ? `Heights are compared with the base, ${baseLabel}: one already over there fails only if it grows.`
    : 'No base to compare with, so any height over the page fails.');
  if (pageCounts) {
    lines.push(`Pages drawn: ${Object.keys(pageCounts).map((name) => `${name} (${pageCounts[name]})`).join(', ')}. Each layout's folder holds \`page-1.png\`, \`page-2.png\`, and so on.`);
  }
  lines.push('Room left at the foot of each booklet half, in points: + to spare, − over.');
  lines.push('');
  lines.push('| Layout | Where | Room left | On the base | |');
  lines.push('| --- | --- | ---: | ---: | --- |');
  rows.forEach((row) => {
    lines.push(`| ${row.variant} | ${row.region} | ${pt(row.slack)} | ${row.base === null ? '—' : pt(row.base)} | ${row.status === 'fits' ? '' : row.status} |`);
  });
  if (notes.length) {
    lines.push('', '**Notes**', '');
    notes.forEach((n) => lines.push(`- ${n}`));
  }
  lines.push('', wordCopy
    ? 'This draws the Word copy printed on a Mac: Chinese in Songti TC, at the copy\'s exact line heights. Chrome lays it out, not Word, with grey boxes for the QR codes and pictures, so the final check is a real print.'
    : 'The preview imitates Google Docs: stand-in fonts, grey boxes for the QR codes and pictures, and approximate line heights. Check a real Doc after the deploy.');
  return lines.join('\n') + '\n';
}

module.exports = { TOLERANCE_PT, evaluate, summaryMarkdown };
