import { checkAnnouncementNotice } from '@/services/AnnouncementNotifications';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

/**
 * The announcements' background check (#709): while the member has
 * Announcement notifications on, the phone looks at the coming Sabbath's
 * bulletin every few hours, even with the app closed, and sets the notice once
 * staff have published it (services/AnnouncementNotifications.ts).
 *
 * Android runs it some time after the interval, through WorkManager. iOS
 * decides when, from battery, network and how the member uses the app, and
 * runs nothing for an app swiped away until it's opened again
 * (https://docs.expo.dev/versions/latest/sdk/background-task/). The app also
 * checks whenever it opens.
 *
 * Defined at the top level of the app's entry (index.ts), as Android runs it
 * with no screens, where app/_layout.tsx never loads.
 */

export const ANNOUNCEMENT_CHECK_TASK = 'announcement-notice-check';
// In minutes: Android's shortest is 15. A few hours keeps the bulletin API's
// calls few, and is the "within a few hours" staff are told.
export const ANNOUNCEMENT_CHECK_MINUTES = 3 * 60;

if (Platform.OS !== 'web') {
  TaskManager.defineTask(ANNOUNCEMENT_CHECK_TASK, async () => {
    try {
      await checkAnnouncementNotice();
      return BackgroundTask.BackgroundTaskResult.Success;
    } catch {
      return BackgroundTask.BackgroundTaskResult.Failed;
    }
  });
}

/** Turned on: the check starts, if the phone allows background work. */
export const startAnnouncementCheck = async () => {
  if ((await BackgroundTask.getStatusAsync()) !== BackgroundTask.BackgroundTaskStatus.Available) return;
  if (await TaskManager.isTaskRegisteredAsync(ANNOUNCEMENT_CHECK_TASK)) return;
  await BackgroundTask.registerTaskAsync(ANNOUNCEMENT_CHECK_TASK, { minimumInterval: ANNOUNCEMENT_CHECK_MINUTES });
};

/** Turned off: the check stops. */
export const stopAnnouncementCheck = async () => {
  if (await TaskManager.isTaskRegisteredAsync(ANNOUNCEMENT_CHECK_TASK)) {
    await BackgroundTask.unregisterTaskAsync(ANNOUNCEMENT_CHECK_TASK);
  }
};
