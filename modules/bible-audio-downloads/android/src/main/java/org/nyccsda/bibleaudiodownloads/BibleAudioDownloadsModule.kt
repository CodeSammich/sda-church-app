package org.nyccsda.bibleaudiodownloads

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** One chapter to download: the app's name for it, where from, and the file it becomes. */
class ChapterDownload : Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var path: String = ""
}

/**
 * Bible audio downloads that go on while the phone is locked or the app is
 * closed (#611), through Android's DownloadManager. See
 * BibleAudioDownloadStore, and modules/bible-audio-downloads/index.ts for the app's side.
 *
 * Custom code, to remove once Expo can do it (#612): Expo SDK 58's
 * DownloadTask has no background session on Android.
 */
class BibleAudioDownloadsModule : Module() {
  private fun store() = BibleAudioDownloadStore(requireNotNull(appContext.reactContext))

  override fun definition() = ModuleDefinition {
    Name("BibleAudioDownloads")

    AsyncFunction("enqueue") { downloads: List<ChapterDownload>, allowMobileData: Boolean ->
      store().enqueue(downloads, allowMobileData)
    }

    AsyncFunction("list") { store().list() }

    AsyncFunction("cancel") { ids: List<String> -> store().cancel(ids.toSet()) }
  }
}
