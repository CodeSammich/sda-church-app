import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// scripts/build-cuv-1919.mjs is an ES module, so its functions run in a child
// Node process, like the other .mjs scripts' tests.
const run = (body: string) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        '--input-type=module',
        '-e',
        `import * as build from ${JSON.stringify(resolve('scripts/build-cuv-1919.mjs'))};\n${body}`,
      ],
      { encoding: 'utf8' },
    ),
  );

// A chapter page shaped like WordProject's: a heading, a Psalm title, verses with
// name spans (which carry a trailing space), and the 1919 space before 神.
const PAGE = `<html><div class="textBody" id="textBody">
<h3>第3章</h3>
<!--... the Word of God:-->
<span class="dimver">〔<span class="person">大衛 </span>的詩。〕</span><p><span class="verse" id="1">1 </span> 耶和華阿、<span class="person">大衛 </span>說．
<br /><span class="verse" id="2">2 </span>他得不著　神的幫助。〔細拉〕</p>
</div> <!-- /textBody --></html>`;

describe('scripts/build-cuv-1919.mjs', () => {
  it('reads a WordProject chapter, keeping the 1919 space before 神', () => {
    expect(run(`console.log(JSON.stringify(build.parseChapter(${JSON.stringify(PAGE)})))`)).toEqual({
      superscription: '〔大衛的詩。〕',
      verses: ['耶和華阿、大衛說．', '他得不著　神的幫助。〔細拉〕'],
    });
  });

  it('refuses a chapter whose verses are out of order', () => {
    const broken = PAGE.replace('id="2">2 ', 'id="3">3 ');
    expect(() => run(`build.parseChapter(${JSON.stringify(broken)}, 'psa 3')`)).toThrow(/verse 3 follows verse 1/);
  });

  it('applies corrections, splits, and titles, and refuses one that no longer matches', () => {
    const result = run(`
      const books = new Map([['psa', [undefined, { superscription: '', verses: ['一。', '二三。', '四。'] }]]]);
      build.applyCorrections(books, [
        { ref: 'psa 1:1', from: '一。', to: '壹。' },
        { ref: 'psa 1:2', from: '二三。', to: ['二。', '三。'] },
        { ref: 'psa 1:3', from: '四。', to: '肆。' },
        { ref: 'psa 1:1', part: 'superscription', from: '', to: '〔詩。〕' },
      ]);
      let refused = '';
      try { build.applyCorrections(books, [{ ref: 'psa 1:1', from: '一。', to: 'x' }]); } catch (error) { refused = error.message; }
      console.log(JSON.stringify({ chapter: books.get('psa')[1], refused }));
    `);
    // The split comes last, so "psa 1:3" still meant WordProject's verse 3.
    expect(result.chapter).toEqual({ superscription: '〔詩。〕', verses: ['壹。', '二。', '三。', '肆。'] });
    expect(result.refused).toMatch(/no longer matches/);
  });

  it('puts a Selah that ends a verse on its own line', () => {
    expect(run(`console.log(JSON.stringify([build.placeSelah('靜默。〔細拉〕'), build.placeSelah('〔細拉〕他的榮光')]))`)).toEqual([
      '靜默。\n〔細拉〕',
      '〔細拉〕他的榮光',
    ]);
  });

  it('makes the notes inside a verse footnotes, but keeps Selah and a verse all in 〔〕', () => {
    expect(
      run(`console.log(JSON.stringify([
        build.splitNotes('生了該隱、〔就是得的意思〕便說、'),
        build.splitNotes('都得永生。〔或作在他裡面得永生〕'),
        build.splitNotes('〔細拉〕他的榮光〔或作威榮〕遮蔽諸天'),
        build.splitNotes('〔人子來為要拯救失喪的人〕'),
        build.splitNotes('〔俄梅珥乃伊法十分之一〕。'),
      ]))`),
    ).toEqual([
      ['生了該隱、', { type: 'note', contents: '就是得的意思' }, '便說、'],
      ['都得永生。', { type: 'note', contents: '或作在他裡面得永生' }],
      ['〔細拉〕他的榮光', { type: 'note', contents: '或作威榮' }, '遮蔽諸天'],
      ['〔人子來為要拯救失喪的人〕'],
      ['〔俄梅珥乃伊法十分之一〕。'],
    ]);
  });

  it('keeps a reviewed reason and the original text in every correction', () => {
    const corrections = JSON.parse(readFileSync(join(process.cwd(), 'scripts/cuv-1919-corrections.json'), 'utf8'));
    const reasons = new Set(['wording', 'rare-character', 'punctuation', 'verse-division', 'title']);
    for (const correction of corrections) {
      expect(correction.ref).toMatch(/^[1-3]?[a-z]{2,3} \d+:\d+$/);
      expect(reasons.has(correction.why)).toBe(true);
      expect(typeof correction.from).toBe('string');
      // Only a change of verse division splits a verse, and it keeps every word.
      if (Array.isArray(correction.to)) {
        expect(correction.why).toBe('verse-division');
        expect(correction.to.join('')).toBe(correction.from.replace('(1:15)', ''));
      }
    }
  });
});
