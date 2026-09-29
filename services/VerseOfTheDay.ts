/**
 * The verse of the day: one verse from a curated list, the same for every
 * language and every reader on a given day. A new verse starts at 6 AM local
 * time, so someone reading before dawn still sees the previous day's verse.
 *
 * A verse drawn at random from the whole Bible often makes little sense on
 * its own, such as a genealogy or half a sentence, so the list holds verses
 * that read well alone in every translation the home page uses. Keep it in
 * Bible order; the day steps through it with a stride, so consecutive days
 * come from different books, and every verse appears once before any repeats.
 * test/verse-of-the-day.test.ts checks the list.
 */
export interface VerseReference {
  bookId: string;
  chapter: number;
  verse: number;
}

export const VERSES_OF_THE_DAY: readonly string[] = [
  // Law and history
  'GEN 1:1', 'GEN 1:27', 'GEN 2:3', 'GEN 28:15', 'GEN 50:20', 'EXO 14:14', 'EXO 15:2',
  'EXO 20:8', 'EXO 20:11', 'NUM 23:19', 'DEU 6:5', 'DEU 7:9', 'DEU 31:6', 'DEU 31:8',
  'DEU 33:27', 'JOS 1:9', 'JOS 24:15', '1SA 16:7', '2SA 22:31', '1CH 16:11', '1CH 16:34',
  '2CH 16:9', 'JOB 19:25', 'JOB 23:10', 'JOB 42:2',
  // Psalms
  'PSA 3:3', 'PSA 4:8', 'PSA 5:3', 'PSA 9:10', 'PSA 16:8', 'PSA 16:11', 'PSA 18:1',
  'PSA 18:2', 'PSA 18:30', 'PSA 19:1', 'PSA 19:14', 'PSA 20:7', 'PSA 23:1', 'PSA 23:4',
  'PSA 23:6', 'PSA 25:4', 'PSA 27:1', 'PSA 27:14', 'PSA 28:7', 'PSA 29:11', 'PSA 30:5',
  'PSA 31:24', 'PSA 32:8', 'PSA 33:4', 'PSA 34:1', 'PSA 34:4', 'PSA 34:8', 'PSA 34:18',
  'PSA 36:5', 'PSA 37:4', 'PSA 37:5', 'PSA 37:7', 'PSA 40:1', 'PSA 42:11', 'PSA 46:1',
  'PSA 46:10', 'PSA 48:14', 'PSA 51:10', 'PSA 55:22', 'PSA 56:3', 'PSA 57:10', 'PSA 59:16',
  'PSA 62:1', 'PSA 62:8', 'PSA 63:1', 'PSA 68:19', 'PSA 71:5', 'PSA 73:26', 'PSA 84:10',
  'PSA 84:11', 'PSA 86:5', 'PSA 86:11', 'PSA 86:15', 'PSA 89:1', 'PSA 90:12', 'PSA 91:1',
  'PSA 91:2', 'PSA 91:11', 'PSA 94:19', 'PSA 95:6', 'PSA 96:1', 'PSA 100:4', 'PSA 100:5',
  'PSA 103:1', 'PSA 103:12', 'PSA 107:1', 'PSA 111:10', 'PSA 113:3', 'PSA 116:1',
  'PSA 118:6', 'PSA 118:24', 'PSA 119:11', 'PSA 119:18', 'PSA 119:50', 'PSA 119:105',
  'PSA 119:114', 'PSA 119:165', 'PSA 121:1', 'PSA 121:2', 'PSA 121:8', 'PSA 124:8',
  'PSA 126:5', 'PSA 130:5', 'PSA 133:1', 'PSA 136:1', 'PSA 138:8', 'PSA 139:14',
  'PSA 143:8', 'PSA 145:3', 'PSA 145:8', 'PSA 145:9', 'PSA 145:18', 'PSA 147:3',
  'PSA 150:6',
  // Wisdom
  'PRO 3:9', 'PRO 4:23', 'PRO 11:25', 'PRO 12:25', 'PRO 14:26', 'PRO 15:1',
  'PRO 16:3', 'PRO 16:9', 'PRO 16:24', 'PRO 17:17', 'PRO 17:22', 'PRO 18:10', 'PRO 19:21',
  'PRO 22:6', 'PRO 27:17', 'PRO 30:5', 'PRO 31:30', 'ECC 3:1', 'ECC 3:11', 'ECC 4:9',
  'ECC 12:13',
  // Prophets
  'ISA 1:18', 'ISA 9:6', 'ISA 12:2', 'ISA 26:3', 'ISA 35:4', 'ISA 40:8', 'ISA 40:11',
  'ISA 40:29', 'ISA 40:31', 'ISA 41:10', 'ISA 41:13', 'ISA 43:2', 'ISA 43:19', 'ISA 46:4',
  'ISA 49:16', 'ISA 53:5', 'ISA 53:6', 'ISA 54:10', 'ISA 55:6', 'ISA 55:8', 'ISA 60:1',
  'ISA 64:8', 'ISA 65:24', 'ISA 66:13', 'JER 17:7', 'JER 29:11', 'JER 29:13', 'JER 31:3',
  'JER 32:17', 'JER 32:27', 'JER 33:3', 'LAM 3:22', 'LAM 3:23', 'LAM 3:25', 'EZK 36:26',
  'MIC 6:8', 'NAM 1:7', 'HAB 3:19', 'ZEP 3:17', 'MAL 3:6', 'MAL 3:10',
  // Gospels
  'MAT 5:3', 'MAT 5:4', 'MAT 5:5', 'MAT 5:6', 'MAT 5:7', 'MAT 5:8', 'MAT 5:9', 'MAT 5:14',
  'MAT 5:16', 'MAT 6:21', 'MAT 6:26', 'MAT 6:33', 'MAT 6:34', 'MAT 7:7', 'MAT 7:12',
  'MAT 11:28', 'MAT 11:29', 'MAT 16:26', 'MAT 18:20', 'MAT 19:26',
  'MAT 24:44', 'MRK 2:27', 'MRK 9:23', 'MRK 10:27', 'MRK 10:45', 'MRK 11:24', 'MRK 12:30',
  'LUK 1:37', 'LUK 2:11', 'LUK 6:31', 'LUK 6:38', 'LUK 11:9', 'LUK 12:32', 'LUK 15:7',
  'LUK 19:10', 'JHN 1:1', 'JHN 1:14', 'JHN 3:16', 'JHN 3:17', 'JHN 4:24', 'JHN 6:35',
  'JHN 8:12', 'JHN 8:32', 'JHN 10:10', 'JHN 10:11', 'JHN 10:27', 'JHN 11:25', 'JHN 13:34',
  'JHN 13:35', 'JHN 14:1', 'JHN 14:2', 'JHN 14:3', 'JHN 14:6', 'JHN 14:15', 'JHN 14:27',
  'JHN 15:5', 'JHN 15:12', 'JHN 15:13', 'JHN 16:33', 'JHN 17:17', 'JHN 20:29',
  // Acts and letters
  'ACT 1:8', 'ACT 2:38', 'ACT 4:12', 'ACT 16:31', 'ACT 17:28', 'ROM 1:16', 'ROM 5:8',
  'ROM 6:23', 'ROM 8:1', 'ROM 8:18', 'ROM 8:28', 'ROM 8:31', 'ROM 10:17', 'ROM 12:1',
  'ROM 12:2', 'ROM 12:10', 'ROM 12:12', 'ROM 12:21', 'ROM 13:8', 'ROM 15:13', '1CO 2:9',
  '1CO 10:13', '1CO 10:31', '1CO 13:7', '1CO 13:8', '1CO 13:13', '1CO 15:57', '1CO 15:58',
  '1CO 16:13', '1CO 16:14', '2CO 4:16', '2CO 5:7', '2CO 5:17', '2CO 9:7', '2CO 12:9',
  'GAL 2:20', 'GAL 5:1', 'GAL 6:2', 'GAL 6:9', 'EPH 2:10', 'EPH 4:32', 'EPH 6:10',
  'PHP 1:21', 'PHP 2:3', 'PHP 3:14', 'PHP 4:4', 'PHP 4:6', 'PHP 4:7', 'PHP 4:8',
  'PHP 4:13', 'PHP 4:19', 'COL 3:2', 'COL 3:12', 'COL 3:13', 'COL 3:15', '1TH 4:16',
  '1TH 5:11', '1TH 5:18', '1TH 5:24', '2TH 3:3', '2TH 3:16', '1TI 4:12', '1TI 6:6',
  '2TI 1:7', '2TI 4:7', 'TIT 3:5', 'HEB 4:9', 'HEB 4:12', 'HEB 4:16',   'HEB 10:23', 'HEB 10:24', 'HEB 11:1', 'HEB 11:6', 'HEB 12:2', 'HEB 13:5', 'HEB 13:8',
  'JAS 1:5', 'JAS 1:12', 'JAS 1:17', 'JAS 1:22', 'JAS 4:7', 'JAS 4:8', 'JAS 5:16',
  '1PE 2:9', '1PE 4:8', '1PE 5:6', '1PE 5:7', '2PE 3:9', '2PE 3:18', '1JN 1:9', '1JN 3:1',
  '1JN 3:18', '1JN 4:7', '1JN 4:8', '1JN 4:18', '1JN 4:19', '1JN 5:14', '3JN 1:2',
  'REV 1:8', 'REV 3:11', 'REV 3:20', 'REV 4:11', 'REV 14:7', 'REV 14:12', 'REV 21:4',
  'REV 21:5', 'REV 22:12', 'REV 22:20',
];

const REFERENCE = /^([1-3]?[A-Z]{2,3}) (\d+):(\d+)$/;

// Double quotation marks only: a single closing mark is also an apostrophe.
const QUOTE_PAIRS: ReadonlyArray<readonly [string, string]> = [
  ['“', '”'],
  ['「', '」'],
  ['『', '』'],
];

/**
 * A quotation can span several verses, so a verse shown alone can close a
 * quote it never opened, or open one it never closes. A quote that began in
 * an earlier verse loses its closing mark when the verse ends on it, or else
 * gets an opening mark at the start; a quote that continues into a later
 * verse loses its opening mark when the verse starts with it, or else gets a
 * closing mark at the end. The words are unchanged.
 */
export function balanceQuotationMarks(text: string): string {
  let result = text.trim();
  for (const [open, close] of QUOTE_PAIRS) {
    const count = (mark: string) => result.split(mark).length - 1;
    if (count(close) > count(open)) {
      result = result.endsWith(close) ? result.slice(0, -close.length).trimEnd() : open + result;
    }
    if (count(open) > count(close)) {
      result = result.startsWith(open) ? result.slice(open.length).trimStart() : result + close;
    }
  }
  return result;
}

export function parseVerseReference(reference: string): VerseReference {
  const match = REFERENCE.exec(reference);
  if (!match) throw new Error(`Not a verse reference: ${reference}`);
  return { bookId: match[1], chapter: Number(match[2]), verse: Number(match[3]) };
}

/** The local day a verse belongs to: before 6 AM, it's still the previous day. */
export function getVerseOfTheDayDate(now: Date): Date {
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (now.getHours() < 6) day.setDate(day.getDate() - 1);
  return day;
}

/** Identifies the verse's day, such as `2026-9-29`, for caching its text. */
export function getVerseOfTheDayDateKey(now: Date): string {
  const day = getVerseOfTheDayDate(now);
  return `${day.getFullYear()}-${day.getMonth() + 1}-${day.getDate()}`;
}

const greatestCommonDivisor = (a: number, b: number): number =>
  b === 0 ? a : greatestCommonDivisor(b, a % b);

/**
 * How far the day moves through the list. It shares no factor with the
 * list's length, so a full cycle visits every verse once.
 */
export function getVerseOfTheDayStride(length: number): number {
  let stride = 97;
  while (greatestCommonDivisor(stride, length) !== 1) stride += 1;
  return stride;
}

export function getVerseOfTheDay(
  now: Date = new Date(),
  references: readonly string[] = VERSES_OF_THE_DAY,
): VerseReference {
  const day = getVerseOfTheDayDate(now);
  // Whole days since 1970-01-01 for the local date, unaffected by time zones
  // and daylight saving time.
  const dayNumber = Math.round(
    Date.UTC(day.getFullYear(), day.getMonth(), day.getDate()) / 86_400_000,
  );
  const index = (dayNumber * getVerseOfTheDayStride(references.length)) % references.length;
  return parseVerseReference(references[index]);
}
