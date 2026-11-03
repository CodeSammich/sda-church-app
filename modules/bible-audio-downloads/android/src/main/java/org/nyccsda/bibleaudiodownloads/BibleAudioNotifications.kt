package org.nyccsda.bibleaudiodownloads

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.annotation.RequiresApi
import org.json.JSONObject

/**
 * The app's notifications for Bible audio downloads (#610), its first: a
 * download's progress while it runs out of sight, with Stop, and a word when
 * it's done or waits for Wi-Fi. Only for a download the member started, and
 * only with the member's leave: the app asks the first time a long download
 * starts, never at launch, and You → Download notifications turns them off.
 *
 * Android 14 and later require a notification while a user-initiated job runs
 * (BibleAudioTransferService). With notifications off, it's the quiet kind,
 * minimized with no icon in the status bar, and gone when the job ends. Without
 * the permission, Android shows the job only in its Task Manager.
 *
 * The words are the app's, in its language, which needn't be the phone's: the
 * app hands them over (setOptions). Custom code, to remove once Expo can do it
 * (#612).
 */
internal object BibleAudioNotifications {
  private const val CHANNEL = "bible-audio-downloads"
  private const val QUIET_CHANNEL = "bible-audio-downloads-quiet"
  private const val PREFERENCES = "bible-audio-downloads"
  private const val OPTIONS = "notification-options"
  const val ACTION_STOP = "org.nyccsda.bibleaudiodownloads.STOP"

  // The words, in English until the app says otherwise.
  data class Text(
    val channel: String = "Bible audio downloads",
    val quietChannel: String = "Bible audio downloads, quiet",
    val progress: String = "{done} of {total} chapters",
    val waitingForWifi: String = "Waiting for Wi-Fi",
    val waitingForConnection: String = "Waiting for a connection",
    val done: String = "Downloaded",
    val stopped: String = "Couldn’t download. Open the app to try again.",
    val stop: String = "Stop",
  )

  data class Options(val enabled: Boolean = true, val text: Text = Text())

  fun options(context: Context): Options {
    val json = prefs(context).getString(OPTIONS, null) ?: return Options()
    return try {
      val value = JSONObject(json)
      val text = value.optJSONObject("text")
      val defaults = Text()
      Options(
        enabled = value.optBoolean("enabled", true),
        text = Text(
          channel = text?.optString("channel", defaults.channel) ?: defaults.channel,
          quietChannel = text?.optString("quietChannel", defaults.quietChannel) ?: defaults.quietChannel,
          progress = text?.optString("progress", defaults.progress) ?: defaults.progress,
          waitingForWifi = text?.optString("waitingForWifi", defaults.waitingForWifi) ?: defaults.waitingForWifi,
          waitingForConnection = text?.optString("waitingForConnection", defaults.waitingForConnection) ?: defaults.waitingForConnection,
          done = text?.optString("done", defaults.done) ?: defaults.done,
          stopped = text?.optString("stopped", defaults.stopped) ?: defaults.stopped,
          stop = text?.optString("stop", defaults.stop) ?: defaults.stop,
        ),
      )
    } catch (error: Exception) {
      Options()
    }
  }

  fun setOptions(context: Context, enabled: Boolean, text: Map<String, String>) {
    val value = JSONObject().put("enabled", enabled).put("text", JSONObject(text as Map<*, *>))
    prefs(context).edit().putString(OPTIONS, value.toString()).commit()
    channels(context)
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

  /** While chapters download: what, how far, and Stop. */
  @RequiresApi(Build.VERSION_CODES.O)
  fun progress(context: Context, title: String, done: Int, total: Int, waiting: String? = null): Notification {
    val options = options(context)
    val text = options.text
    val counts = text.progress.replace("{done}", "%,d".format(done)).replace("{total}", "%,d".format(total))
    return builder(context, options)
      .setContentTitle(title)
      .setContentText(if (waiting != null) "$waiting · $counts" else counts)
      .setProgress(total.coerceAtLeast(1), done.coerceIn(0, total.coerceAtLeast(1)), false)
      .setOngoing(waiting == null)
      .setOnlyAlertOnce(true)
      .addAction(Notification.Action.Builder(null, text.stop, stopIntent(context)).build())
      .build()
  }

  /** When the last chapter is in, or when it gave up. */
  @RequiresApi(Build.VERSION_CODES.O)
  fun finished(context: Context, title: String, done: Boolean): Notification {
    val options = options(context)
    return builder(context, options)
      .setContentTitle(title)
      .setContentText(if (done) options.text.done else options.text.stopped)
      .setAutoCancel(true)
      .build()
  }

  /** A running job's notification, which Android requires: kept up to date even when they're off, in the quiet kind. */
  fun update(context: Context, id: Int, notification: Notification) {
    if (allowed(context)) manager(context).notify(id, notification)
  }

  /** Posts it, if the member wants them and Android allows it. */
  fun post(context: Context, id: Int, notification: Notification) {
    if (options(context).enabled && allowed(context)) manager(context).notify(id, notification)
  }

  fun cancel(context: Context, id: Int) = manager(context).cancel(id)

  fun enabled(context: Context) = options(context).enabled

  @RequiresApi(Build.VERSION_CODES.O)
  private fun builder(context: Context, options: Options): Notification.Builder {
    channels(context)
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)?.let {
      PendingIntent.getActivity(context, 0, it, PendingIntent.FLAG_IMMUTABLE)
    }
    return Notification.Builder(context, if (options.enabled) CHANNEL else QUIET_CHANNEL)
      .setSmallIcon(R.drawable.bible_audio_download)
      .setCategory(Notification.CATEGORY_PROGRESS)
      .setShowWhen(false)
      .setContentIntent(launch)
  }

  private fun stopIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, BibleAudioDownloadActionReceiver::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE,
    )

  // Two, as the app can't quieten a channel once it's made: the member's, and
  // the quiet one for when they're turned off.
  private fun channels(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val text = options(context).text
    manager(context).createNotificationChannels(
      listOf(
        NotificationChannel(CHANNEL, text.channel, NotificationManager.IMPORTANCE_LOW).apply { setShowBadge(false) },
        NotificationChannel(QUIET_CHANNEL, text.quietChannel, NotificationManager.IMPORTANCE_MIN).apply { setShowBadge(false) },
      ),
    )
  }

  private fun manager(context: Context) = context.getSystemService(NotificationManager::class.java)

  private fun prefs(context: Context) = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
}
