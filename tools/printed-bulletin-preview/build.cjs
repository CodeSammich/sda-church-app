// Runs the printed bulletin's Apps Script renderers against the fake Google
// Docs and made-up data, checks what can be checked without drawing (type
// size, widths), and writes each Doc as an HTML page for Chrome to lay out.
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createDocumentModel } = require('./fake-document-app.cjs');
const { IMAGE_SIZES, bulletinWeek, fakeTranslate } = require('./made-up-data.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const BIBLE = require('./bible-chapters.json').chapters;

// The smallest type the printed bulletin may use (#603).
const MIN_FONT_SIZE = 10;
// CSS pixels to points: Docs sizes images in pixels, pages in points.
const PX_TO_PT = 0.75;

// Docs fonts: the fonts drawn in their place (Liberation is metric-compatible
// with Times New Roman and Arial), and each font's line height in em, from its
// ascent, descent and line gap. Docs lays a line out at the tallest run's
// line height times the paragraph's line spacing.
const CJK_STANDINS = ['Noto Serif CJK TC', 'Noto Sans CJK TC', 'Noto Sans TC', 'Noto Sans CJK SC'];
const FONT_TABLE = {
  'Times New Roman': { css: ['Times New Roman', 'Liberation Serif', 'Tinos'], ratio: 1.107, cjk: false },
  Arial: { css: ['Arial', 'Liberation Sans', 'Arimo'], ratio: 1.117, cjk: false },
  UoqMunThenKhung: { css: ['UoqMunThenKhung', 'Noto Serif CJK TC', 'Noto Serif TC'], ratio: 1.128, cjk: true },
  'Noto Sans TC': { css: ['Noto Sans TC', 'Noto Sans CJK TC'], ratio: 1.448, cjk: true },
  'Noto Sans SC': { css: ['Noto Sans SC', 'Noto Sans CJK SC'], ratio: 1.448, cjk: true },
  'Noto Serif TC': { css: ['Noto Serif TC', 'Noto Serif CJK TC'], ratio: 1.437, cjk: true },
};
const UNKNOWN_FONT = { css: ['Times New Roman', 'Liberation Serif'], ratio: 1.107, cjk: false };
const CJK_RE = /[⺀-⿟　-〿㐀-鿿豈-﫿︰-﹏＀-￯]|[\ud840-\ud87f][\udc00-\udfff]/;
const GENERATED = new Set(['HymnalData.gs', 'PinyinPro.gs']);

// ---------- The Apps Script, with fake Google services ----------

function readAppsScript(codeDir) {
  const files = fs.readdirSync(codeDir).filter((f) => f.endsWith('.gs') && !GENERATED.has(f)).sort();
  if (!files.includes('PrintedBulletin.gs')) throw new Error(`No PrintedBulletin.gs in ${codeDir}`);
  // HymnalData.gs is made at deploy (#619); make it the same way.
  const hymnal = require(path.join(REPO, 'scripts/build-hymnal-apps-script.cjs')).buildHymnalAppsScript();
  return files.map((f) => fs.readFileSync(path.join(codeDir, f), 'utf8')).concat(hymnal).join('\n');
}

function makeContext(source) {
  const model = createDocumentModel();
  const problems = { missingUrls: new Set(), unknownImages: new Set() };
  const logs = [];
  const imageIds = {};
  const response = (code, body) => ({ getResponseCode: () => code, getContentText: () => body });
  const bibleUrl = /^https:\/\/bible\.helloao\.org\/api\/([^/]+)\/([0-9A-Z]{3})\/(\d+)\.simple\.json$/;

  const ctx = {
    DocumentApp: model.DocumentApp,
    Logger: { log: (message) => { logs.push(String(message)); } },
    PropertiesService: {
      getScriptProperties: () => ({ getProperty: () => null, setProperty: () => undefined, deleteProperty: () => undefined, getProperties: () => ({}) }),
    },
    CacheService: { getScriptCache: () => ({ get: () => null, put: () => undefined }) },
    LanguageApp: { translate: fakeTranslate },
    UrlFetchApp: {
      fetch: (url) => {
        const match = bibleUrl.exec(decodeURIComponent(String(url)));
        const verses = match && BIBLE[`${match[1]}/${match[2]}/${match[3]}`];
        if (!verses) {
          problems.missingUrls.add(String(url));
          return response(404, '');
        }
        const content = Object.keys(verses).map((number) => ({ type: 'verse', number: Number(number), text: verses[number] }));
        return response(200, JSON.stringify({ chapter: { content } }));
      },
    },
    DriveApp: {
      getFileById: (id) => ({
        getBlob: () => {
          const kind = String(id).startsWith('qr:') ? 'qr' : imageIds[id];
          if (!kind) problems.unknownImages.add(String(id));
          const [w, h] = IMAGE_SIZES[kind || 'qr'];
          return { w, h };
        },
        isTrashed: () => false,
      }),
      getFolderById: () => ({
        getFilesByName: (fileName) => {
          let done = false;
          return {
            hasNext: () => !done,
            next: () => { done = true; return { isTrashed: () => false, getId: () => 'qr:' + fileName }; },
          };
        },
      }),
    },
  };
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  const config = vm.runInContext('PRINTED_BULLETIN_CONFIG', ctx);
  imageIds[config.sdaLogoImageFileId] = 'logo';
  imageIds[config.churchSketchImageFileId] = 'churchSketch';
  imageIds[config.lastSupperImageFileId] = 'lastSupper';
  return { ctx, model, problems, logs };
}

// Docs keeps an empty paragraph after a table that ends a body or a cell.
function addTrailingParagraphs(container) {
  container.children.forEach((child) => {
    if (child.kind === 'TABLE') child.rows.forEach((row) => row.cells.forEach(addTrailingParagraphs));
  });
  const last = container.children[container.children.length - 1];
  if (last && last.kind === 'TABLE') container.appendParagraph('');
}

/** Renders one variant with the Apps Script in `source`, into a fake Doc. */
function buildVariant(source, variant) {
  const { ctx, model, problems, logs } = makeContext(source);
  const { bulletin, next } = bulletinWeek(variant.longWeek);
  ctx.__bulletin = bulletin;
  ctx.__next = next;
  ctx.__body = model.createBody();
  ctx.__format = variant.format;
  ctx.__location = variant.location;
  vm.runInContext(`
    __bulletin.physicalBibleTranslations = normalizePhysicalBibleTranslations_();
    hydratePhysicalBibleVerses_(__bulletin, __bulletin.physicalBibleTranslations);
    __next.physicalBibleTranslations = __bulletin.physicalBibleTranslations;
    renderPrintedBulletinDocument_({ getBody: function () { return __body; } }, __bulletin, __next, __format, __location);
  `, ctx);
  const body = ctx.__body;
  addTrailingParagraphs(body);
  // The Word copy's font and line height, as the Apps Script sets them (#627).
  const wordCopy = vm.runInContext(
    "typeof PRINTED_BULLETIN_WORD_COPY === 'undefined' ? null : { chineseFont: PRINTED_BULLETIN_WORD_COPY.chineseFont, lineHeight: PRINTED_BULLETIN_WORD_COPY.lineHeight }",
    ctx,
  );
  return {
    body,
    wordCopy: wordCopy && { chineseFont: wordCopy.chineseFont, lineHeight: wordCopy.lineHeight },
    unknownCalls: [...model.unknown],
    missingUrls: [...problems.missingUrls],
    unknownImages: [...problems.unknownImages],
    logs,
  };
}

// ---------- Checks on the Doc's structure ----------

function splitPages(body) {
  const pages = [[]];
  body.children.forEach((child) => {
    pages[pages.length - 1].push(child);
    if (child.kind === 'P' && child.inline.some((i) => i.type === 'pagebreak')) pages.push([]);
  });
  return pages;
}

function columnWidths(table, containerWidth) {
  const columns = Math.max(...table.rows.map((r) => r.cells.length));
  return Array.from({ length: columns }, (_, i) => (typeof table.widths[i] === 'number' ? table.widths[i] : containerWidth / columns));
}

function runsOf(p) {
  const runs = [];
  for (let i = 0; i < p.text.length; i += 1) {
    const style = p.chars[i];
    const key = JSON.stringify(style);
    if (runs.length && runs[runs.length - 1].key === key) runs[runs.length - 1].text += p.text[i];
    else runs.push({ key, style, text: p.text[i] });
  }
  return runs;
}

function textOf(container, limit = 60) {
  const parts = [];
  const walk = (c) => c.children.forEach((child) => {
    if (child.kind === 'P') parts.push(child.text);
    else child.rows.forEach((row) => row.cells.forEach(walk));
  });
  walk(container);
  const text = parts.join(' ').replace(/\s+/g, ' ').trim();
  return text.length > limit ? text.slice(0, limit) + '…' : text;
}

/**
 * What can be checked without drawing: every visible run at least 10 pt,
 * every table and image within the width it sits in (the page, a booklet
 * half, a cell), and the fonts the model knows. A table or image may run into
 * its cell's padding, as the 360-point tables do in a 368-point half, but not
 * past the cell.
 */
function checkStructure(body) {
  const findings = { smallText: [], tooWide: [], unknownFonts: new Set() };
  const contentWidth = body.page.width - body.page.left - body.page.right;

  // `width` lays the text out; `limit` is the cell's own width.
  const visit = (container, width, limit, page) => {
    container.children.forEach((child) => {
      if (child.kind === 'P') {
        runsOf(child).forEach((run) => {
          if (!FONT_TABLE[run.style.font]) findings.unknownFonts.add(run.style.font);
          if (/\S/.test(run.text) && run.style.size < MIN_FONT_SIZE) {
            findings.smallText.push({ page, size: run.style.size, text: run.text.trim().slice(0, 50) });
          }
        });
        child.inline.filter((i) => i.type === 'image').forEach((image) => {
          const widthPt = image.w * PX_TO_PT;
          if (widthPt > limit + 0.5) {
            findings.tooWide.push({ page, what: 'image', widthPt: round(widthPt), availablePt: round(limit), text: textOf(container) });
          }
        });
        return;
      }
      const widths = columnWidths(child, width);
      const total = widths.reduce((a, b) => a + b, 0);
      if (total > limit + 0.5) {
        findings.tooWide.push({ page, what: 'table', widthPt: round(total), availablePt: round(limit), text: textOf({ children: [child] }) });
      }
      child.rows.forEach((row) => row.cells.forEach((cell, i) => {
        visit(cell, widths[i] - cell.padding.left - cell.padding.right, widths[i], page);
      }));
    });
  };
  splitPages(body).forEach((children, index) => visit({ children }, contentWidth, contentWidth, index + 1));
  return { smallText: findings.smallText, tooWide: findings.tooWide, unknownFonts: [...findings.unknownFonts] };
}

function round(n) {
  return Math.round(n * 10) / 10;
}

// ---------- The Doc as HTML ----------

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const cssFamilies = (names) => names.map((n) => `'${n}'`).join(', ');

// With `wordCopy`, the Word copy printed on a Mac (#627): a run in a Chinese
// font is all in its Chinese font (Songti TC), and any other run's Chinese
// characters are too.
function fontFor(style, wordCopy) {
  const entry = FONT_TABLE[style.font] || UNKNOWN_FONT;
  const own = [style.font].concat(entry.css.filter((n) => n !== style.font));
  const names = wordCopy
    ? (entry.cjk ? [] : own).concat(wordCopy.chineseFont, CJK_STANDINS)
    : own.concat(CJK_STANDINS);
  return { family: cssFamilies([...new Set(names)]), ratio: entry.ratio };
}

function paragraphHtml(p, opts) {
  const wordCopy = opts.wordCopy;
  const runs = runsOf(p);
  let lineHeight = 0;
  let largest = 0;
  const html = runs.map((run) => {
    const f = fontFor(run.style, wordCopy);
    lineHeight = Math.max(lineHeight, f.ratio * run.style.size);
    largest = Math.max(largest, run.style.size);
    const s = run.style;
    return `<span style="font-family:${esc(f.family)};font-size:${s.size}pt;font-weight:${s.bold ? 700 : 400};font-style:${s.italic ? 'italic' : 'normal'};text-decoration:${s.underline ? 'underline' : 'none'}">${esc(run.text)}</span>`;
  });
  if (!runs.length) {
    const f = fontFor(p.base, wordCopy);
    lineHeight = f.ratio * p.base.size;
    largest = p.base.size;
    html.push(`<span style="font-family:${esc(f.family)};font-size:${p.base.size}pt">​</span>`);
  }
  p.inline.forEach((item) => {
    // Grey boxes stand in for the QR codes, the logo and the cover art.
    if (item.type === 'image') html.push(`<span class="img" style="width:${item.w}px;height:${item.h}px"></span>`);
    if (item.type === 'hr') html.push('<span class="hr"></span>');
  });
  // The Word copy gives every paragraph without a picture an exact line
  // height: lineHeight times its largest size, times its line spacing.
  const exact = wordCopy && !p.inline.some((item) => item.type === 'image');
  const lh = ((exact ? wordCopy.lineHeight * largest : lineHeight) * p.lineSpacing).toFixed(2);
  const align = { LEFT: 'left', CENTER: 'center', RIGHT: 'right', JUSTIFY: 'justify' }[p.align] || 'left';
  const first = p.indentFirstLine == null ? p.indentStart : p.indentFirstLine;
  const indent = `padding-left:${p.indentStart || 0}pt;padding-right:${p.indentEnd || 0}pt;text-indent:${first - (p.indentStart || 0)}pt;`;
  return `<div class="p" style="${indent}text-align:${align};padding-top:${p.spacingBefore}pt;padding-bottom:${p.spacingAfter}pt;line-height:${lh}pt">${html.join('')}</div>`;
}

function containerHtml(container, width, opts) {
  return container.children.map((child) => (child.kind === 'TABLE' ? tableHtml(child, width, opts) : paragraphHtml(child, opts))).join('');
}

function tableHtml(t, containerWidth, opts) {
  const widths = columnWidths(t, containerWidth);
  const total = widths.reduce((a, b) => a + b, 0);
  const border = t.borderWidth > 0 ? `${t.borderWidth}pt solid ${t.borderColor}` : 'none';
  const rows = t.rows.map((row) => '<tr>' + row.cells.map((cell, i) => {
    const pad = cell.padding;
    const inner = widths[i] - pad.left - pad.right;
    const valign = { TOP: 'top', CENTER: 'middle', BOTTOM: 'bottom' }[cell.valign] || 'top';
    return `<td style="padding:${pad.top}pt ${pad.right}pt ${pad.bottom}pt ${pad.left}pt;vertical-align:${valign};border:${border}">${containerHtml(cell, inner, opts)}</td>`;
  }).join('') + '</tr>').join('');
  return `<table style="width:${total}pt"><colgroup>${widths.map((w) => `<col style="width:${w}pt">`).join('')}</colgroup>${rows}</table>`;
}

// Measured in the page: each page's height against the room between its
// margins, and each booklet half's (the first table's outer cells), with
// what's under the table (the footer).
const MEASURE_SCRIPT = `
window.__fit = document.fonts.ready.then(function () {
  var PT = 0.75;
  return Array.prototype.map.call(document.querySelectorAll('.sheet'), function (sheet, i) {
    var content = sheet.querySelector('.content');
    var heightPt = content.getBoundingClientRect().height * PT;
    var available = Number(sheet.dataset.available);
    var panels = {};
    var first = content.querySelector(':scope > table');
    if (first && first.rows[0].cells.length === 3) {
      var cells = first.rows[0].cells;
      var rest = heightPt - first.getBoundingClientRect().height * PT;
      [['left', 0], ['right', 2]].forEach(function (pair) {
        var cell = cells[pair[1]];
        var h = 0;
        Array.prototype.forEach.call(cell.children, function (el) { h += el.getBoundingClientRect().height; });
        var style = getComputedStyle(cell);
        h = (h + parseFloat(style.paddingTop) + parseFloat(style.paddingBottom)) * PT;
        panels[pair[0]] = Math.round((available - rest - h) * 10) / 10;
      });
    }
    var slack = Math.round((available - heightPt) * 10) / 10;
    var label = sheet.querySelector('.meas');
    var worst = Math.min.apply(null, [slack].concat(Object.keys(panels).map(function (k) { return panels[k]; })));
    label.style.color = worst < 0 ? '#c00' : '#070';
    label.textContent = (worst < 0 ? 'OVERFLOWS by ' + Math.abs(Math.round(worst)) + ' pt' : 'fits, ' + Math.round(worst) + ' pt to spare') +
      (panels.left !== undefined ? ' (left half ' + Math.round(panels.left) + ', right half ' + Math.round(panels.right) + ')' : '');
    var rect = sheet.getBoundingClientRect();
    var bottom = Math.max(rect.bottom, content.getBoundingClientRect().bottom + 8);
    return {
      page: i + 1,
      heightPt: Math.round(heightPt * 10) / 10,
      availablePt: available,
      slackPt: slack,
      panels: panels,
      clip: { x: Math.max(0, rect.left - 12), y: Math.max(0, rect.top - 40), width: rect.width + 24, height: bottom - rect.top + 52 },
    };
  });
});`;

/**
 * The Doc as HTML, one sheet per page. `opts.wordCopy` ({ chineseFont,
 * lineHeight }) draws the Word copy printed on a Mac instead of the Doc.
 */
function documentHtml(body, title, opts = {}) {
  const page = body.page;
  const contentWidth = page.width - page.left - page.right;
  const available = page.height - page.top - page.bottom;
  const pagesHtml = splitPages(body).map((children, index) => `
<div class="sheet" data-available="${available}" style="width:${page.width}pt;height:${page.height}pt;padding:${page.top}pt ${page.right}pt ${page.bottom}pt ${page.left}pt">
  <div class="label">${esc(title)} · page ${index + 1}</div>
  <div class="meas"></div>
  <div class="limit" style="top:${page.height - page.bottom}pt"></div>
  <div class="content">${containerHtml({ children }, contentWidth, opts)}</div>
</div>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
body { margin: 0; padding: 1px 0; background: #ddd; font-family: 'Liberation Serif', serif; }
.sheet { position: relative; box-sizing: border-box; background: #fff; margin: 40pt 20pt 220pt; overflow: visible; outline: 1px solid #999; }
.label { position: absolute; top: -26pt; left: 0; font: 12pt 'Liberation Sans', Arial, sans-serif; color: #333; }
.meas { position: absolute; top: -26pt; right: 0; font: bold 12pt 'Liberation Sans', Arial, sans-serif; }
.limit { position: absolute; left: 0; right: 0; border-top: 1.5px dashed #e00; }
.content { position: relative; }
table { border-collapse: collapse; table-layout: fixed; }
td { overflow-wrap: break-word; }
.p { white-space: pre-wrap; line-break: strict; }
.p span { line-height: inherit; }
.img { display: inline-block; background: #bbb; vertical-align: baseline; }
.hr { display: block; border-top: 0.75pt solid #000; margin-top: -0.5em; }
</style></head><body>${pagesHtml}
<script>${MEASURE_SCRIPT}</script></body></html>`;
}

module.exports = {
  FONT_TABLE,
  MIN_FONT_SIZE,
  readAppsScript,
  buildVariant,
  checkStructure,
  splitPages,
  documentHtml,
};
