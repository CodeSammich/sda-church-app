package org.nyccsda.announcementnotifications

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** The waiting announcements notice's alarm (#709): posts it, even when the app isn't running. */
class AnnouncementNotificationReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent?) {
    if (AnnouncementNotifications.isPostAction(intent)) AnnouncementNotifications.fire(context)
  }
}
