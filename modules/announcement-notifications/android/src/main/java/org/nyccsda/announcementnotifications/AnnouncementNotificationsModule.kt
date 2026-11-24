package org.nyccsda.announcementnotifications

import android.Manifest
import android.os.Build
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * The notice of a week's announcements: what it says, the link a tap opens,
 * when to post it, and when it's too late, in milliseconds since 1970.
 */
class AnnouncementNotice : Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var body: String = ""
  @Field var url: String = ""
  @Field var at: Double = 0.0
  @Field var until: Double = 0.0
}

/**
 * The notice of a week's announcements (#709), made on the phone. See
 * AnnouncementNotifications, and modules/announcement-notifications/index.ts
 * for the app's side.
 */
class AnnouncementNotificationsModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("AnnouncementNotifications")

    // Android 8 and later: before, the app posts no notifications.
    Constant("available") { Build.VERSION.SDK_INT >= Build.VERSION_CODES.O }

    AsyncFunction("setChannel") { name: String, description: String ->
      AnnouncementNotifications.setChannel(context, name, description)
    }

    // Android 13 and later ask; before, notifications are allowed unless the
    // member turned them off in Settings.
    AsyncFunction("getPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.POST_NOTIFICATIONS)
      } else {
        promise.resolve(notificationStatus())
      }
    }

    AsyncFunction("requestPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.POST_NOTIFICATIONS)
      } else {
        promise.resolve(notificationStatus())
      }
    }

    AsyncFunction("isChannelOn") {
      AnnouncementNotifications.channelOn(context)
    }

    AsyncFunction("schedule") { notice: AnnouncementNotice ->
      AnnouncementNotifications.schedule(
        context,
        AnnouncementNotifications.Notice(
          id = notice.id,
          title = notice.title,
          body = notice.body,
          url = notice.url,
          at = notice.at.toLong(),
          until = notice.until.toLong(),
        ),
      )
    }

    AsyncFunction("cancel") {
      AnnouncementNotifications.cancel(context)
    }

    AsyncFunction("getPosted") {
      AnnouncementNotifications.posted(context)
    }

    AsyncFunction("openSettings") {
      context.startActivity(AnnouncementNotifications.settingsIntent(context))
    }
  }

  private fun notificationStatus(): Map<String, Any> {
    val granted = AnnouncementNotifications.allowed(context)
    return mapOf("status" to if (granted) "granted" else "denied", "granted" to granted, "canAskAgain" to false, "expires" to "never")
  }
}
