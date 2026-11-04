const { describeLiveEdits, findLiveEdits } = require('../scripts/apps-script-live-check.cjs');

// The deploy compares the live, sheet-bound Apps Script project with main
// before replacing it, so a change made in the Apps Script editor is reported.
describe('Apps Script live check', () => {
  const previous = { 'BulletinApi.gs': 'function doGet() {}\n', 'appsscript.json': '{"a":1,"b":[1,2]}\n' };
  const next = { 'BulletinApi.gs': 'function doGet() { return 1; }\n', 'appsscript.json': previous['appsscript.json'] };

  it('accepts files that match the last release or this one', () => {
    expect(findLiveEdits({ live: previous, previous, next })).toEqual([]);
    expect(findLiveEdits({ live: next, previous, next })).toEqual([]);
  });

  it('ignores line endings, trailing space, and the manifest\'s formatting', () => {
    const live = {
      'BulletinApi.gs': 'function doGet() {}\r\n\r\n',
      'appsscript.json': '{\n  "b": [1, 2],\n  "a": 1\n}',
    };
    expect(findLiveEdits({ live, previous, next })).toEqual([]);
  });

  it('reports a changed file and a file main does not have', () => {
    const live = {
      'BulletinApi.gs': 'function doGet() { UrlFetchApp.fetch("x"); }',
      'Extra.gs': 'function onEdit() {}',
      'appsscript.json': '{"a":1,"b":[1,2],"oauthScopes":["x"]}',
    };
    const edits = findLiveEdits({ live, previous, next });
    expect(edits).toEqual([
      { name: 'BulletinApi.gs', reason: 'changed' },
      { name: 'Extra.gs', reason: 'added' },
      { name: 'appsscript.json', reason: 'changed' },
    ]);
    expect(describeLiveEdits(edits)).toEqual([
      'BulletinApi.gs in the live Apps Script project matches neither the last release nor this one.',
      'Extra.gs is in the live Apps Script project but not in main.',
      'appsscript.json in the live Apps Script project matches neither the last release nor this one.',
    ]);
  });

  it('checks generated files, which git does not keep, against this release only', () => {
    const live = { 'HymnalData.gs': 'var HYMNS = [];' };
    expect(findLiveEdits({ live, previous: {}, next: { 'HymnalData.gs': 'var HYMNS = [];\n' } })).toEqual([]);
    expect(findLiveEdits({ live, previous: {}, next: { 'HymnalData.gs': 'var HYMNS = [1];' } })).toEqual([
      { name: 'HymnalData.gs', reason: 'changed' },
    ]);
  });
});
