package org.nyccsda.bibleaudiodownloads

import android.Manifest
import android.os.Build
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/**
 * One chapter to download: the app's name for it, where from (and from where
 * else, if that fails), the file it becomes, what it's part of, as "English –
 * Souer (BSB)", for its notification, and about how big it is.
 */
class ChapterDownload : Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var fallbacks: List<String> = emptyList()
  @Field var path: String = ""
  @Field var group: String = ""
  @Field var bytes: Double = 0.0
}

/**
 * Bible audio downloads that go on while the phone is locked or the app is
 * closed (#611), and their notifications (#610):
 *
 * - Android 14 and later: the app's own user-initiated data transfer jobs
 *   (BibleAudioTransfers), which Android doesn't hold to an hour's quota.
 * - Android 13 and lower: DownloadManager (BibleAudioDownloadStore).
 *
 * See modules/bible-audio-downloads/index.ts for the app's side.
 *
 * Custom code, to remove once Expo can do it (#612): Expo SDK 58's
 * DownloadTask has no background session on Android.
 */
class BibleAudioDownloadsModule : Module() {
  private val context get() = requireNotNull(appContext.reactContext)
  private val ownJobs = Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE

  override fun definition() = ModuleDefinition {
    Name("BibleAudioDownloads")

    AsyncFunction("enqueue") { downloads: List<ChapterDownload>, allowMobileData: Boolean ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        BibleAudioTransfers(context).enqueue(downloads, allowMobileData)
      } else {
        BibleAudioDownloadStore(context).enqueue(downloads, allowMobileData)
      }
    }

    AsyncFunction("list") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        BibleAudioTransfers(context).list()
      } else {
        BibleAudioDownloadStore(context).list()
      }
    }

    AsyncFunction("cancel") { ids: List<String> ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
        BibleAudioTransfers(context).cancel(ids.toSet())
      } else {
        BibleAudioDownloadStore(context).cancel(ids.toSet())
      }
    }

    // Whether the app's own notifications show a download (#610). Below
    // Android 14, the system's DownloadManager shows its own, whatever this says.
    Constant("ownNotifications") { ownJobs }

    // The app's own jobs try each of a chapter's sources before saying it failed.
    Constant("triesEverySource") { ownJobs }

    AsyncFunction("setNotificationOptions") { enabled: Boolean, text: Map<String, String> ->
      BibleAudioNotifications.setOptions(context, enabled, text)
    }

    // Android 13 and later ask; before, notifications are allowed unless the
    // member turned them off in Settings.
    AsyncFunction("getNotificationPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.POST_NOTIFICATIONS)
      } else {
        promise.resolve(notificationStatus())
      }
    }

    AsyncFunction("requestNotificationPermission") { promise: Promise ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.POST_NOTIFICATIONS)
      } else {
        promise.resolve(notificationStatus())
      }
    }
  }

  private fun notificationStatus(): Map<String, Any> {
    val granted = BibleAudioNotifications.allowed(context)
    return mapOf("status" to if (granted) "granted" else "denied", "granted" to granted, "canAskAgain" to false, "expires" to "never")
  }
}
