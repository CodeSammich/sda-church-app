import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

// The app's notifications are only ones the member asked for (docs/UI_UX.md,
// "Notifications"): today, a Bible audio download's (#610). The permission
// can't be held only while a download runs (iOS can't take it back, and
// Android stops asking after two refusals), so what the app does with it is
// held to that instead: only modules/bible-audio-downloads posts one, from its
// notifications files and its download job. Anything new needs its own
// decision, and this test and the policy updated with it.
const OWN_CODE = ['app', 'components', 'constants', 'features', 'hooks', 'modules', 'plugins', 'services', 'styles'];
const DOWNLOADS = 'modules/bible-audio-downloads';
const POSTERS = [
  `${DOWNLOADS}/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioNotifications.kt`,
  // The download job's own, which Android requires.
  `${DOWNLOADS}/android/src/main/java/org/nyccsda/bibleaudiodownloads/BibleAudioTransferService.kt`,
  `${DOWNLOADS}/ios/BibleAudioNotifications.swift`,
];

const files = (folder: string): string[] =>
  readdirSync(folder).flatMap((name) => {
    const path = join(folder, name);
    if (statSync(path).isDirectory()) return name === 'build' || name === 'node_modules' ? [] : files(path);
    return /\.(ts|tsx|js|cjs|kt|java|swift|m|mm)$/.test(name) ? [path] : [];
  });

// Ways to post a notification, or to schedule or push one.
const POSTING = [
  /expo-notifications|@notifee|react-native-push-notification|@react-native-firebase\/messaging|PushNotificationIOS/,
  /scheduleNotificationAsync|presentNotificationAsync|getExpoPushTokenAsync|getDevicePushTokenAsync/,
  /NotificationManager(Compat)?\b[\s\S]{0,200}\.notify\(|\.notify\(\s*\w+\s*,\s*\w*[Nn]otification/,
  /UNUserNotificationCenter\.current\(\)\.add\(|UNNotificationRequest\(/,
  /registerForRemoteNotifications/,
  /\bsetNotification\(\s*params/,
];

describe('notifications', () => {
  it('are posted only by the Bible audio downloads module, from its notifications and download job', () => {
    const posting = OWN_CODE.flatMap(files).filter(
      (file) => !POSTERS.includes(file) && POSTING.some((pattern) => pattern.test(readFileSync(file, 'utf8'))),
    );
    expect(posting).toEqual([]);
    // And those do post: this test would pass on nothing otherwise.
    for (const file of POSTERS) {
      expect({ file, posts: POSTING.some((pattern) => pattern.test(readFileSync(file, 'utf8'))) }).toEqual({ file, posts: true });
    }
  });

  it('come from no notification or push library', () => {
    const { dependencies = {}, devDependencies = {} } = JSON.parse(readFileSync('package.json', 'utf8'));
    const names = Object.keys({ ...dependencies, ...devDependencies });
    expect(names.filter((name) => /notification|notifee|firebase|onesignal|push/i.test(name))).toEqual([]);
  });

  it('ask for the permission only in the download notifications service, never at launch', () => {
    const asking = OWN_CODE.flatMap(files).filter(
      (file) =>
        !file.startsWith(DOWNLOADS) &&
        file !== 'services/DownloadNotifications.ts' &&
        /requestNotificationPermission|requestPermissionsAsync|POST_NOTIFICATIONS|requestAuthorization/.test(readFileSync(file, 'utf8')),
    );
    expect(asking).toEqual([]);
  });
});
