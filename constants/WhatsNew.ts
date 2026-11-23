/**
 * "What's new", shown once on the first launch after an update to members who
 * set up an earlier version (#669). New installs answer the same in setup,
 * which marks it seen. It's part of the app, tied to its version; the
 * church's announcements, which come with the bulletin without an App Store
 * update (#562), are separate.
 *
 * The saved value is the newest version whose "What's new" the member has
 * seen. A release with nothing to tell leaves WHATS_NEW_VERSION as it is, so
 * nobody sees it again.
 */
export const WHATS_NEW_SEEN_KEY = 'whats-new-seen';
export const WHATS_NEW_VERSION = '1.7.0';

/** -1, 0 or 1 as version a is older than, the same as, or newer than b. */
export const compareVersions = (a: string, b: string) => {
  const parts = (version: string) => version.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const [left, right] = [parts(a), parts(b)];
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference) return Math.sign(difference);
  }
  return 0;
};

/** Whether a member who has set up the app hasn't yet seen this "What's new". */
export const shouldShowWhatsNew = (setupDone: boolean, seen: string | null) =>
  setupDone && (!seen || compareVersions(seen, WHATS_NEW_VERSION) < 0);
