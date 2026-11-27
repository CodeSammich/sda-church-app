#!/usr/bin/env node
// Printed bulletin preview (#844): makes each printed layout from the Apps
// Script in google-apps-script/ with made-up data and a fake Google Docs,
// draws every page as a PNG, and fails if something doesn't fit.
//
//   node tools/printed-bulletin-preview/preview.cjs [options]
//
//   --out DIR      where the pages go (default build/printed-bulletin-preview)
//   --base REF     the commit to compare heights with; "none" for none
//                  (default: where this branch left release-candidate)
//   --only A,B     only these layouts (see made-up-data.cjs)
//   --fonts DIR    extra fonts, such as a Chinese font this machine lacks
//                  (also PRINTED_PREVIEW_FONTS)
//   --word-copy    draw the Word copy printed on a Mac (#627, #852): Chinese
//                  in Songti TC, at the copy's exact line heights. Songti TC
//                  comes only with macOS; elsewhere a stand-in draws it.
//   --word-font F  with --word-copy, draw the Chinese in F instead of the
//                  Word copy's own font
//
// Exits 1 if a check fails, 2 if it couldn't run. See
// docs/operations/bulletin-automation.md#printed-bulletin-preview.
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { execFileSync } = require('node:child_process');
const { VARIANTS } = require('./made-up-data.cjs');
const { readAppsScript, buildVariant, checkStructure, documentHtml } = require('./build.cjs');
const { fontEnvironment, chineseFonts, launchChrome } = require('./chrome.cjs');
const { evaluate, summaryMarkdown } = require('./fit-check.cjs');

const REPO = path.resolve(__dirname, '..', '..');
const BASE_BRANCHES = ['upstream/release-candidate', 'origin/release-candidate'];

function parseArgs(argv) {
  const args = { out: path.join(REPO, 'build', 'printed-bulletin-preview'), base: 'auto', only: null, fonts: process.env.PRINTED_PREVIEW_FONTS || null };
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inline] = argv[i].split('=');
    const value = () => (inline !== undefined ? inline : argv[++i]);
    if (flag === '--out') args.out = path.resolve(value());
    else if (flag === '--base') args.base = value();
    else if (flag === '--only') args.only = value().split(',');
    else if (flag === '--fonts') args.fonts = value();
    else if (flag === '--word-copy') args.wordCopy = true;
    else if (flag === '--word-font') args.wordFont = value();
    else throw new Error(`Unknown option ${argv[i]}`);
  }
  return args;
}

const git = (...args) => execFileSync('git', args, { cwd: REPO, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

function resolveBase(base) {
  if (base === 'none') return null;
  if (base !== 'auto') {
    return { sha: git('rev-parse', '--verify', `${base}^{commit}`), label: /^[0-9a-f]{40}$/.test(base) ? 'the base branch' : base };
  }
  for (const branch of BASE_BRANCHES) {
    try {
      return { sha: git('merge-base', 'HEAD', branch), label: `where this branch left ${branch}` };
    } catch {
      // Try the next.
    }
  }
  return null;
}

// The base's Apps Script, in a folder of its own.
function checkoutAppsScript(sha, dir) {
  fs.mkdirSync(dir, { recursive: true });
  git('ls-tree', '--name-only', sha, 'google-apps-script/')
    .split('\n')
    .filter((file) => file.endsWith('.gs'))
    .forEach((file) => fs.writeFileSync(path.join(dir, path.basename(file)), git('show', `${sha}:${file}`)));
  return dir;
}

// The Word copy's settings if the Apps Script has none (#627).
const WORD_COPY_DEFAULTS = { chineseFont: 'Songti TC', lineHeight: 1.15 };

async function measureVariants(chrome, source, variants, outDir, { screenshots, wordCopy, wordFont }) {
  const results = {};
  for (const variant of variants) {
    const built = buildVariant(source, variant);
    const dir = path.join(outDir, variant.name);
    fs.mkdirSync(dir, { recursive: true });
    const htmlFile = path.join(dir, 'doc.html');
    const word = wordCopy && { ...(built.wordCopy || WORD_COPY_DEFAULTS), ...(wordFont ? { chineseFont: wordFont } : {}) };
    const opts = word ? { wordCopy: word } : {};
    fs.writeFileSync(htmlFile, documentHtml(built.body, variant.name, opts));
    const page = await chrome.open(pathToFileURL(htmlFile).href);
    const pages = await page.evaluate('window.__fit');
    if (screenshots) {
      for (const p of pages) fs.writeFileSync(path.join(dir, `page-${p.page}.png`), await page.screenshot(p.clip));
    }
    await page.close();
    results[variant.name] = {
      pages: pages.map(({ page: number, heightPt, availablePt, slackPt, panels }) => ({ page: number, heightPt, availablePt, slackPt, panels })),
      ...checkStructure(built.body),
      unknownCalls: built.unknownCalls,
      missingUrls: built.missingUrls,
      unknownImages: built.unknownImages,
    };
  }
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const variants = args.only ? VARIANTS.filter((v) => args.only.includes(v.name)) : VARIANTS;
  if (!variants.length) throw new Error(`No layout called ${args.only.join(', ')}`);
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'printed-preview-'));
  const env = fontEnvironment(args.fonts, work);
  const chinese = chineseFonts(env);
  if (chinese && !chinese.length) {
    throw new Error('No Chinese font found, so Chinese would show as boxes. Install one (sudo apt-get install fonts-noto-cjk) or pass --fonts with a folder holding one.');
  }

  const base = resolveBase(args.base);
  fs.rmSync(args.out, { recursive: true, force: true });
  fs.mkdirSync(args.out, { recursive: true });
  const chrome = await launchChrome({ env });
  let head;
  let before = null;
  try {
    head = await measureVariants(chrome, readAppsScript(path.join(REPO, 'google-apps-script')), variants, args.out, { screenshots: true, wordCopy: args.wordCopy, wordFont: args.wordFont });
    if (base) {
      const baseSource = readAppsScript(checkoutAppsScript(base.sha, path.join(work, 'base-apps-script')));
      before = await measureVariants(chrome, baseSource, variants, path.join(work, 'base'), { screenshots: false, wordCopy: args.wordCopy, wordFont: args.wordFont });
    }
  } finally {
    await chrome.close();
    fs.rmSync(work, { recursive: true, force: true });
  }

  const outcome = evaluate(head, before, { realCheck: args.wordCopy ? 'a real print' : 'a real Doc' });
  const pageCounts = Object.fromEntries(Object.keys(head).map((name) => [name, head[name].pages.length]));
  const summary = summaryMarkdown(outcome, { baseLabel: base && `${base.label} (${base.sha.slice(0, 8)})`, pageCounts, wordCopy: args.wordCopy && (args.wordFont || WORD_COPY_DEFAULTS.chineseFont) });
  fs.writeFileSync(path.join(args.out, 'summary.md'), summary);
  fs.writeFileSync(path.join(args.out, 'summary.json'), JSON.stringify({ base: base && base.sha, head, before, ...outcome }, null, 1));
  process.stdout.write(summary);
  const own = chinese && chinese.find((family) => family.startsWith('UoqMunThenKhung'));
  const drawnWith = args.wordCopy
    ? `${args.wordFont || WORD_COPY_DEFAULTS.chineseFont} where the system has it`
    : own ? 'UoqMunThenKhung, the bulletin\'s font' : chinese && `stand-ins (${chinese.slice(0, 2).join('; ')})`;
  process.stdout.write(`\nPages: ${args.out}${drawnWith ? `\nChinese drawn in ${drawnWith}` : ''}\n`);
  return outcome.failures.length ? 1 : 0;
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }, (error) => {
    console.error(error.stack || String(error));
    process.exitCode = 2;
  });
}

module.exports = { parseArgs };
