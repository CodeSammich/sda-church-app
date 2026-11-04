package org.nyccsda.bibleaudiodownloads

import android.app.DownloadManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Moves a Bible audio chapter into the app's own files as soon as Android's
 * DownloadManager finishes it (#611), even when the app isn't running. Custom
 * code, to remove once Expo can do it (#612).
 */
class BibleAudioDownloadReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    val downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1)
    if (downloadId < 0) return
    val pending = goAsync()
    Thread {
      try {
        BibleAudioDownloadStore(context.applicationContext).complete(downloadId)
      } finally {
        pending.finish()
      }
    }.start()
  }
}
