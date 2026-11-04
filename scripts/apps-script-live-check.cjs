// Before a deploy replaces the live Apps Script project, compare what is live
// with main. The project is bound to the bulletin spreadsheet, so anyone who
// can edit the sheet can also edit its code in the Apps Script editor. The
// deploy puts main's code back either way; this makes a hand edit visible to
// the person approving the deploy instead of erasing it silently.
//
// A live file is expected when it matches the previous release (what the last
// deploy pushed) or this release (what is about to be pushed). Anything else,
// including a file that exists only in the live project, was changed outside
// git, or an earlier deploy was skipped.

const sortKeys = (value) =>
  Array.isArray(value)
    ? value.map(sortKeys)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortKeys(value[key])]))
      : value;

// Google may store the manifest with its own spacing and key order, so it is
// compared as JSON. Scripts are compared as text, ignoring line endings and
// trailing white space.
const normalize = (name, source) => {
  if (name.endsWith('.json')) {
    try {
      return JSON.stringify(sortKeys(JSON.parse(source)));
    } catch {
      // Compared as text below.
    }
  }
  return String(source).replace(/\r\n/g, '\n').replace(/\s+$/, '');
};

/**
 * @param {{ live: Record<string, string>, previous: Record<string, string>, next: Record<string, string> }} files
 *   Each maps a file name such as `BulletinApi.gs` to its source.
 * @returns {{ name: string, reason: 'changed' | 'added' }[]}
 */
const findLiveEdits = ({ live, previous, next }) =>
  Object.keys(live)
    .sort()
    .flatMap((name) => {
      const source = normalize(name, live[name]);
      const known = [previous[name], next[name]].filter((value) => value !== undefined);
      if (!known.length) {
        return [{ name, reason: 'added' }];
      }
      return known.some((value) => normalize(name, value) === source) ? [] : [{ name, reason: 'changed' }];
    });

const describeLiveEdits = (edits) =>
  edits.map(({ name, reason }) =>
    reason === 'added'
      ? `${name} is in the live Apps Script project but not in main.`
      : `${name} in the live Apps Script project matches neither the last release nor this one.`,
  );

module.exports = { describeLiveEdits, findLiveEdits };
