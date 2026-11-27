import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The printed bulletin preview (#844): tools/printed-bulletin-preview/.
// Drawing the pages needs Chrome, so it runs in its own workflow; these tests
// cover the fake Google Docs, the made-up layouts, and the pass/fail rules.
const tool = (file: string) => require(`../tools/printed-bulletin-preview/${file}`);
const { createDocumentModel } = tool('fake-document-app.cjs');
const { VARIANTS } = tool('made-up-data.cjs');
const { readAppsScript, buildVariant, checkStructure, splitPages, documentHtml } = tool('build.cjs');
const { evaluate, summaryMarkdown } = tool('fit-check.cjs');
const { parseArgs } = tool('preview.cjs');

const repoFile = (path: string) => readFileSync(join(__dirname, '..', path), 'utf8');

function letterBody() {
  const model = createDocumentModel();
  const body = model.createBody();
  body.clear();
  body.setPageWidth(792).setPageHeight(612).setMarginTop(28).setMarginBottom(28).setMarginLeft(14).setMarginRight(14);
  return { model, body };
}

describe('the fake Google Docs', () => {
  it('records tables, widths, padding and each character’s type', () => {
    const { body } = letterBody();
    const table = body.appendTable([['', '', '']]);
    table.setColumnWidth(0, 368).setColumnWidth(1, 28).setColumnWidth(2, 368).setBorderWidth(0);
    const cell = table.getCell(0, 2);
    cell.setPaddingLeft(0);
    const paragraph = cell.appendParagraph('主席 Chairman');
    paragraph.editAsText().setFontSize(10).setFontFamily('Times New Roman').setFontFamily(0, 1, 'UoqMunThenKhung');
    expect(table.widths).toEqual({ 0: 368, 1: 28, 2: 368 });
    expect(cell.padding).toEqual({ top: 5, bottom: 5, left: 0, right: 5 });
    expect(paragraph.chars.map((c: { font: string }) => c.font).slice(0, 4)).toEqual(['UoqMunThenKhung', 'UoqMunThenKhung', 'Times New Roman', 'Times New Roman']);
    expect(paragraph.chars.every((c: { size: number }) => c.size === 10)).toBe(true);
  });

  it('throws on, and lists, anything it doesn’t have', () => {
    const { model, body } = letterBody();
    expect(() => body.appendListItem('x')).toThrow(/no Body\.appendListItem/);
    expect(() => model.DocumentApp.HorizontalAlignment.START).toThrow(/no HorizontalAlignment\.START/);
    expect(() => body.appendParagraph('x').setAttributes({ BOLD: true })).toThrow(/BOLD/);
    expect([...model.unknown].sort()).toEqual(['Attribute.BOLD', 'Body.appendListItem', 'HorizontalAlignment.START']);
  });

  it('rejects a text range outside the paragraph, as Docs does', () => {
    const { body } = letterBody();
    expect(() => body.appendParagraph('abc').editAsText().setBold(1, 3, true)).toThrow(/outside "abc"/);
  });
});

describe('the made-up layouts', () => {
  const source = readAppsScript(join(__dirname, '..', 'google-apps-script'));
  const built = Object.fromEntries(VARIANTS.map((variant: { name: string }) => [variant.name, buildVariant(source, variant)]));

  it('covers Queens Regular, Queens Communion and Brooklyn, each in a long week too', () => {
    expect(Object.keys(built).sort()).toEqual([
      'brooklyn-regular',
      'brooklyn-regular-long-week',
      'queens-communion',
      'queens-communion-long-week',
      'queens-regular',
      'queens-regular-long-week',
    ]);
  });

  const names: string[] = VARIANTS.map((variant: { name: string }) => variant.name);
  it.each(names)('builds %s with the repository’s Apps Script and nothing the fake lacks', (name: string) => {
    const result = built[name];
    expect(result.unknownCalls).toEqual([]);
    expect(result.missingUrls).toEqual([]);
    expect(result.unknownImages).toEqual([]);
    expect(splitPages(result.body).length).toBeGreaterThan(1);
    // Today's layouts keep every run at 10 pt or more and within its width.
    expect(checkStructure(result.body)).toEqual({ smallText: [], tooWide: [], unknownFonts: [] });
  });

  it('prints the made-up announcements, Bible text and names', () => {
    const html = documentHtml(built['queens-regular-long-week'].body, 'q');
    expect(html).toContain('Samuel Wang');
    expect(html).toContain('Surely He took up our infirmities');
    expect(html).toContain('溫保羅');
  });
});

describe('the checks on the Doc’s structure', () => {
  it('flags type under 10 pt and anything wider than where it sits', () => {
    const { body } = letterBody();
    body.appendParagraph('small print').editAsText().setFontSize(9);
    body.appendParagraph('   ').editAsText().setFontSize(1);
    body.appendTable([['too wide']]).setColumnWidth(0, 800);
    const spread = body.appendTable([['', '', '']]);
    spread.setColumnWidth(0, 368).setColumnWidth(1, 28).setColumnWidth(2, 368);
    // Into the half's padding is fine; past the half is not.
    spread.getCell(0, 0).appendTable([['fits']]).setColumnWidth(0, 360);
    spread.getCell(0, 2).appendTable([['over']]).setColumnWidth(0, 370);
    spread.getCell(0, 2).appendImage({ w: 500, h: 100 });
    body.appendParagraph('').appendPageBreak();
    body.appendParagraph('page two').editAsText().setFontSize(10).setFontFamily('Comic Sans MS');

    const findings = checkStructure(body);
    expect(findings.smallText).toEqual([{ page: 1, size: 9, text: 'small print' }]);
    expect(findings.tooWide.map((f: { page: number; what: string; widthPt: number; availablePt: number }) => [f.page, f.what, f.widthPt, f.availablePt])).toEqual([
      [1, 'table', 800, 764],
      [1, 'table', 370, 368],
      [1, 'image', 375, 368],
    ]);
    expect(findings.unknownFonts).toEqual(['Comic Sans MS']);
  });

  it('draws one sheet per page, with the text escaped', () => {
    const { body } = letterBody();
    body.appendParagraph('<b>one</b>').appendPageBreak();
    body.appendParagraph('two');
    const html = documentHtml(body, 'test');
    expect(html.match(/class="sheet"/g)).toHaveLength(2);
    expect(html).toContain('&lt;b&gt;one&lt;/b&gt;');
    expect(html).toContain('window.__fit');
  });
});

describe('the pass/fail rules', () => {
  const clean = { smallText: [], tooWide: [], unknownCalls: [], missingUrls: [], unknownImages: [], unknownFonts: [] };
  const result = (halves: Array<[number, number]>, extra = {}) => ({
    ...clean,
    pages: halves.map(([left, right], index) => ({ page: index + 1, slackPt: Math.min(left, right), panels: { left, right } })),
    ...extra,
  });

  it('fails any overflow when there is no base', () => {
    const outcome = evaluate({ q: result([[10, -2]]) }, null);
    expect(outcome.failures).toEqual(['q, page 1, right half: overflows by 2 pt']);
  });

  it('fails a half that fit on the base, or one that was over and grew', () => {
    const outcome = evaluate(
      { q: result([[-3, -20], [5, -12]]) },
      { q: result([[4, -20], [5, -10]]) },
    );
    expect(outcome.failures).toEqual([
      'q, page 1, left half: overflows by 3 pt; it fit on the base, with 4 pt to spare',
      'q, page 2, right half: overflows by 12 pt, 2 pt more than on the base',
    ]);
    // Over by the same as on the base: the model's heights run long there.
    expect(outcome.notes).toEqual([expect.stringContaining('q, page 1, right half: overflows by 20 pt in the preview, as on the base')]);
  });

  it('fails an overflowing page the base doesn’t have, and notes a new page count', () => {
    const outcome = evaluate({ q: result([[1, 1], [1, -1]]) }, { q: result([[1, 1]]) });
    expect(outcome.failures).toEqual(['q, page 2, right half: overflows by 1 pt, a page the base doesn\'t have']);
    expect(outcome.notes).toEqual(['q: 2 pages, 1 on the base']);
  });

  it('fails small type, widths and gaps in the fake whatever the base', () => {
    const head = result([[1, 1]], {
      smallText: [{ page: 1, size: 9, text: 'x' }],
      tooWide: [{ page: 1, what: 'table', widthPt: 370, availablePt: 368, text: 'y' }],
      unknownCalls: ['Body.appendListItem'],
      missingUrls: ['https://example.org'],
      unknownImages: ['abc'],
      unknownFonts: ['Georgia'],
    });
    const outcome = evaluate({ q: head }, { q: head });
    expect(outcome.failures).toHaveLength(5);
    expect(outcome.notes).toEqual([expect.stringContaining('font Georgia')]);
  });

  it('writes a summary with every half and its base', () => {
    const outcome = evaluate({ q: result([[12, -2]]) }, { q: result([[12, -2]]) });
    const summary = summaryMarkdown(outcome, { baseLabel: 'release-candidate (1234abcd)' });
    expect(summary).toContain('**Every page fits.**');
    expect(summary).toContain('| q | page 1, left half | +12 | +12 |  |');
    expect(summary).toContain('| q | page 1, right half | −2 | −2 | over on the base too |');
    expect(summaryMarkdown(evaluate({ q: result([[-1, 1]]) }, null))).toContain('**1 problem:**');
  });

  it('reads its options', () => {
    expect(parseArgs(['--out', '/tmp/x', '--base=none', '--only', 'a,b'])).toMatchObject({ out: '/tmp/x', base: 'none', only: ['a', 'b'] });
    expect(() => parseArgs(['--bogus'])).toThrow(/Unknown option/);
  });
});

describe('the Printed Bulletin Preview workflow', () => {
  const workflow = repoFile('.github/workflows/printed-bulletin-preview.yml');

  it('runs on pull requests into release-candidate and main that touch the Apps Script or the tool, and by hand', () => {
    expect(workflow).toMatch(/pull_request:\n {4}branches:\n {6}- release-candidate\n {6}- main\n {4}paths:\n {6}- 'google-apps-script\/\*\*'\n {6}- 'tools\/printed-bulletin-preview\/\*\*'/);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).not.toContain('pull_request_target');
  });

  it('reads only, uses no secrets, runs on Linux, and pins its actions', () => {
    expect(workflow).toMatch(/^permissions:\n {2}contents: read\n/m);
    expect(workflow).not.toMatch(/:\s*write\b/);
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\.|^\s+environment:/m);
    expect(workflow.match(/runs-on: .*/g)).toEqual(['runs-on: ubuntu-latest']);
    expect(workflow).toContain('persist-credentials: false');
    for (const [, ref] of workflow.matchAll(/uses: [\w./-]+@(\S+)/g)) expect(ref).toMatch(/^[0-9a-f]{40}$/);
  });

  it('passes pull request values to scripts only through environment variables', () => {
    const lines = workflow.split('\n');
    lines.forEach((line, index) => {
      const key = /^(\s*(?:-\s+)?)run:(.*)$/.exec(line);
      if (!key) return;
      const script = [key[2]];
      for (const next of lines.slice(index + 1)) {
        if (next.trim() && next.search(/\S/) <= key[1].length) break;
        script.push(next);
      }
      expect(script.join('\n')).not.toContain('${{');
    });
  });

  it('compares with the base branch and uploads the pages even when a check fails', () => {
    expect(workflow).toContain('node tools/printed-bulletin-preview/preview.cjs --out "$RUNNER_TEMP/printed-bulletin-preview" --base "$PREVIEW_BASE"');
    expect(workflow).toMatch(/- name: Upload the pages\n\s+if: \$\{\{ !cancelled\(\) \}\}/);
    expect(workflow).toContain('name: printed-bulletin-preview');
  });

  it('is in the bulletin docs and the list of checks', () => {
    expect(repoFile('docs/operations/bulletin-automation.md')).toContain('## Printed bulletin preview');
    expect(repoFile('docs/CONTRIBUTING.md')).toContain('### `Printed Bulletin Preview` (`.github/workflows/printed-bulletin-preview.yml`)');
  });
});
