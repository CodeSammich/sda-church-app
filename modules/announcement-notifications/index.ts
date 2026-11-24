import { requireOptionalNativeModule } from 'expo';

/**
 * The notice of a week's announcements (#709), made on the phone: the app
 * works out what it says and when (services/AnnouncementNotifications.ts) and
 * hands it over here, and the phone posts it at that time, even with the app
 * closed.
 *
 * - Android 8 and later: an alarm, and its own "Announcements" channel that
 *   the member can turn off in Android's settings
 *   (android/.../AnnouncementNotifications.kt).
 * - iPhone: a local notification iOS posts at its time
 *   (ios/AnnouncementNotifications.swift). iOS has no switch for one kind of
 *   an app's notifications, so the app's own switch is that.
 *
 * One waits at a time, and a new week's takes the place of the last. The ids
 * posted are kept, so a Sabbath's notice is never posted twice. A tap opens
 * the bulletin through the app's own link. Nothing is sent anywhere.
 */

/** The notice: what it says, the link a tap opens, when to post it, and when it's too late, in ms since 1970. */
export type AnnouncementNotice = Readonly<{
  id: string;
  title: string;
  body: string;
  url: string;
  at: number;
  until: number;
}>;

export type AnnouncementNotificationPermission = Readonly<{
  status: 'granted' | 'denied' | 'undetermined';
  granted: boolean;
  canAskAgain: boolean;
}>;

/** `posted`: now, or before; `scheduled`: for its time; `not-allowed`: the phone won't let the app post it now. */
export type AnnouncementScheduleResult = 'posted' | 'scheduled' | 'not-allowed';

export type AnnouncementNotifications = Readonly<{
  /** False before Android 8, where the app posts no notifications. */
  available: boolean;
  /** Android's channel name and description, in the app's language. */
  setChannel(name: string, description: string): Promise<void>;
  getPermission(): Promise<AnnouncementNotificationPermission>;
  /** Asks, if the phone still lets the app ask. */
  requestPermission(): Promise<AnnouncementNotificationPermission>;
  /** Whether the member left the Announcements channel on in Android's settings; always on the iPhone. */
  isChannelOn(): Promise<boolean>;
  /** Sets it, in place of any waiting, or posts it now if its time has come. Nothing, if it was posted already. */
  schedule(notice: AnnouncementNotice): Promise<AnnouncementScheduleResult>;
  /** The waiting one goes. One already posted stays. */
  cancel(): Promise<void>;
  /** The ids of the last few posted, newest last. */
  getPosted(): Promise<string[]>;
  /** Where the member can allow them: the channel's or the app's notification settings. */
  openSettings(): Promise<void>;
}>;

/** The phone's, or null where there's none: the web, and tests. */
export const getAnnouncementNotifications = () =>
  requireOptionalNativeModule<AnnouncementNotifications>('AnnouncementNotifications');
