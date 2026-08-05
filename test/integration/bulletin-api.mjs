const API_BASE_URL =
  process.env.BULLETIN_API_URL ||
  'https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec';
const TEST_DATE = process.env.BULLETIN_TEST_DATE || '2026-08-08';

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

const assertString = (value, path) => {
  assert(typeof value === 'string', `${path} must be a string`);
};

const assertBilingual = (value, path) => {
  assert(value && typeof value === 'object', `${path} must be an object`);
  assertString(value.english, `${path}.english`);
  assertString(value.chinese, `${path}.chinese`);
};

const forbiddenKeyPattern = /(email|timestamp)/i;
const assertNoPrivateKeys = (value, path = 'response') => {
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    assert(!forbiddenKeyPattern.test(key), `${path}.${key} must not be public`);
    assertNoPrivateKeys(child, `${path}.${key}`);
  }
};

const safeRosterValues = new Set([
  '',
  '-',
  'choir',
  'name withheld',
  'n/a',
  'na',
  'none',
  'open',
  'tbd',
  'vacant',
]);
const latinNamePattern = /^[A-Za-z\u00C0-\u024F.'’-]+(?: [A-Za-z\u00C0-\u024F]\.)?$/;

const assertPrivateRosterValue = (value, path) => {
  assertString(value, path);
  if (safeRosterValues.has(value.toLowerCase())) return;

  const people = value.split(/\s*(?:\/|&|\+|\band\b)\s*/i);
  assert(
    people.every(
      (person) =>
        safeRosterValues.has(person.toLowerCase()) || latinNamePattern.test(person),
    ),
    `${path} must contain only a Latin first name, First L., or a privacy placeholder`,
  );
};

const assertLocation = (location, path, rosterFields) => {
  assert(location && typeof location === 'object', `${path} must be an object`);
  assertBilingual(location.hymnOfPraise, `${path}.hymnOfPraise`);
  assertBilingual(location.sermonTitle, `${path}.sermonTitle`);
  assertBilingual(location.hymnOfResponse, `${path}.hymnOfResponse`);
  assertString(location.bibleVerses, `${path}.bibleVerses`);

  for (const field of rosterFields) {
    assertPrivateRosterValue(location[field], `${path}.${field}`);
  }
};

const response = await fetch(`${API_BASE_URL}?date=${encodeURIComponent(TEST_DATE)}`, {
  headers: { Accept: 'application/json' },
  signal: AbortSignal.timeout(45_000),
});

assert(response.ok, `Bulletin API returned HTTP ${response.status}`);
const contentType = response.headers.get('content-type') || '';
assert(contentType.includes('application/json'), 'Bulletin API must return JSON');

const payload = await response.json();
assert(payload?.ok === true, `Bulletin API error: ${payload?.error || 'unknown error'}`);
assert(payload.bulletin?.date === TEST_DATE, 'Bulletin date does not match the request');

for (const field of ['quarter', 'specialRemark', 'tithePurpose', 'pastorTravel']) {
  assertString(payload.bulletin[field], `bulletin.${field}`);
}

assertLocation(payload.bulletin.queens, 'bulletin.queens', [
  'sermon',
  'translation',
  'chineseTeacher',
  'englishTeacher',
  'childrenTeacher',
  'chairPastoralPrayer',
  'specialMusic',
  'offeringPrayer',
  'pianist',
  'ssChair',
  'openingPrayer',
  'closingPrayer',
]);
assertLocation(payload.bulletin.brooklyn, 'bulletin.brooklyn', [
  'sermon',
  'chairPastoralPrayer',
  'offeringPrayer',
  'sabbathSchool',
]);
assertNoPrivateKeys(payload);

console.log(`Bulletin integration passed for ${TEST_DATE} with one read-only request.`);
