package org.nyccsda.announcementnotifications

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject

/**
 * The notice of a week's announcements (#709): one a Sabbath at most, for the
 * member's location, in the app's language, and only after the member turned
 * it on. The app works out what it says and when (services/AnnouncementNotifications.ts),
 * and hands it over here. It's made on the phone; nothing is sent anywhere.
 *
 * One notice waits at a time, under an alarm that posts it even when the app
 * isn't running (AnnouncementNotificationReceiver). Its own channel,
 * "Announcements", is one the member can turn off in Android's settings. It
 * makes no sound and doesn't vibrate. A tap opens the bulletin through the
 * app's own link.
 *
 * An alarm is lost when the phone restarts. The app's background check sets it
 * again, or posts the notice at once if its time has passed and it's still
 * daytime. The ids posted are kept, so a Sabbath's notice is never posted twice.
 */
internal object AnnouncementNotifications {
  private const val CHANNEL = "announcements"
  private const val PREFERENCES = "announcement-notifications"
  private const val PENDING = "pending"
  private const val POSTED = "posted"
  private const val CHANNEL_NAME = "channel-name"
  private const val CHANNEL_DESCRIPTION = "channel-description"
  private const val ACTION_POST = "org.nyccsda.announcementnotifications.POST"
  // One in the shade at a time: a new week's takes the place of the last.
  private const val NOTIFICATION_ID = 709
  private const val KEEP_POSTED = 8

  data class Notice(
    val id: String,
    val title: String,
    val body: String,
    val url: String,
    val at: Long,
    // Not posted after this, as when the alarm comes late: the Sabbath has begun.
    val until: Long,
  )

  /** The channel's name and description, in the app's language. */
  fun setChannel(context: Context, name: String, description: String) {
    prefs(context).edit().putString(CHANNEL_NAME, name).putString(CHANNEL_DESCRIPTION, description).commit()
    channel(context)
  }

  /** Whether Android lets the app post notifications at all. Before Android 8, the app posts none. */
  fun allowed(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) {
      return false
    }
    return manager(context).areNotificationsEnabled()
  }

  /** Whether the member left the Announcements channel on in Android's settings. */
  fun channelOn(context: Context): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return false
    val channel = manager(context).getNotificationChannel(CHANNEL) ?: return true
    return channel.importance != NotificationManager.IMPORTANCE_NONE
  }

  /**
   * Sets the notice to post at its time, in place of any waiting, or posts it
   * now if its time has come. Nothing, if it was posted already.
   */
  fun schedule(context: Context, notice: Notice): String {
    if (posted(context).contains(notice.id)) return "posted"
    cancel(context)
    if (notice.at <= System.currentTimeMillis()) {
      return if (post(context, notice)) "posted" else "not-allowed"
    }
    prefs(context).edit().putString(PENDING, toJson(notice).toString()).commit()
    val alarms = context.getSystemService(AlarmManager::class.java)
    // Inexact, so it needs no leave for exact alarms: Android may hold it a
    // few minutes while the phone sleeps.
    alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, notice.at, alarmIntent(context))
    return "scheduled"
  }

  /** The waiting notice goes, as when the announcement was taken out. One already posted stays. */
  fun cancel(context: Context) {
    context.getSystemService(AlarmManager::class.java).cancel(alarmIntent(context))
    prefs(context).edit().remove(PENDING).commit()
  }

  /** The alarm went off: posts the waiting notice, unless it's too late. */
  fun fire(context: Context) {
    val notice = pending(context) ?: return
    prefs(context).edit().remove(PENDING).commit()
    if (System.currentTimeMillis() < notice.until) post(context, notice)
  }

  /** The ids of the last few notices posted, newest last. */
  fun posted(context: Context): List<String> {
    val json = prefs(context).getString(POSTED, null) ?: return emptyList()
    return try {
      val array = JSONArray(json)
      List(array.length()) { array.getString(it) }
    } catch (error: Exception) {
      emptyList()
    }
  }

  /** Where the member can allow them: the channel's settings, or the app's if all its notifications are off. */
  fun settingsIntent(context: Context): Intent {
    val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && allowed(context)) {
      channel(context)
      Intent(android.provider.Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
        .putExtra(android.provider.Settings.EXTRA_CHANNEL_ID, CHANNEL)
    } else {
      Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS)
    }
    return intent
      .putExtra(android.provider.Settings.EXTRA_APP_PACKAGE, context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  }

  private fun post(context: Context, notice: Notice): Boolean {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O || !allowed(context)) return false
    channel(context)
    if (!channelOn(context)) return false
    val notification = build(context, notice)
    manager(context).notify(NOTIFICATION_ID, notification)
    val posted = (posted(context) + notice.id).distinct().takeLast(KEEP_POSTED)
    prefs(context).edit().putString(POSTED, JSONArray(posted).toString()).commit()
    return true
  }

  @RequiresApi(Build.VERSION_CODES.O)
  private fun build(context: Context, notice: Notice): Notification =
    Notification.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.announcement_notification)
      .setContentTitle(notice.title)
      .setContentText(notice.body)
      .setStyle(Notification.BigTextStyle().bigText(notice.body))
      .setContentIntent(openIntent(context, notice.url))
      .setAutoCancel(true)
      .build()

  // The app's own link, as the verse widget's: MainActivity takes it, and the
  // app's router opens the bulletin (app/+native-intent.tsx).
  private fun openIntent(context: Context, url: String): PendingIntent =
    PendingIntent.getActivity(
      context,
      NOTIFICATION_ID,
      Intent(Intent.ACTION_VIEW, Uri.parse(url))
        .setPackage(context.packageName)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  private fun alarmIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, AnnouncementNotificationReceiver::class.java).setAction(ACTION_POST),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

  // Quiet: no sound or vibration, and no badge. The member can change that,
  // or turn it off, in Android's settings; the app can't once it's made.
  private fun channel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val prefs = prefs(context)
    manager(context).createNotificationChannel(
      NotificationChannel(
        CHANNEL,
        prefs.getString(CHANNEL_NAME, null) ?: "Announcements",
        NotificationManager.IMPORTANCE_DEFAULT,
      ).apply {
        description = prefs.getString(CHANNEL_DESCRIPTION, null) ?: "The church’s announcements, once a week at most"
        setSound(null, null)
        enableVibration(false)
        setShowBadge(false)
      },
    )
  }

  internal fun isPostAction(intent: Intent?) = intent?.action == ACTION_POST

  private fun pending(context: Context): Notice? {
    val json = prefs(context).getString(PENDING, null) ?: return null
    return try {
      val value = JSONObject(json)
      Notice(
        id = value.getString("id"),
        title = value.getString("title"),
        body = value.getString("body"),
        url = value.getString("url"),
        at = value.getLong("at"),
        until = value.getLong("until"),
      )
    } catch (error: Exception) {
      null
    }
  }

  private fun toJson(notice: Notice) =
    JSONObject()
      .put("id", notice.id)
      .put("title", notice.title)
      .put("body", notice.body)
      .put("url", notice.url)
      .put("at", notice.at)
      .put("until", notice.until)

  private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)

  private fun prefs(context: Context) = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
}
