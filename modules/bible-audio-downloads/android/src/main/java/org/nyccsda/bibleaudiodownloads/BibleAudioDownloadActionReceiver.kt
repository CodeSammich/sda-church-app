package org.nyccsda.bibleaudiodownloads

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Stop, from a Bible audio download's notification (#610): stops every
 * chapter, as the page's X does, even with the app closed. The app hears of it
 * when it next looks, and treats it as the member's stop. Only the app's own
 * notification can send it. Custom code, to remove once Expo can do it (#612).
 */
class BibleAudioDownloadActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != BibleAudioNotifications.ACTION_STOP) return
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return
    val pending = goAsync()
    Thread {
      try {
        BibleAudioTransfers(context.applicationContext).stopAll()
        BibleAudioNotifications.cancel(context, BibleAudioTransfers.WIFI_JOB)
        BibleAudioNotifications.cancel(context, BibleAudioTransfers.ANY_NETWORK_JOB)
      } finally {
        pending.finish()
      }
    }.start()
  }
}
