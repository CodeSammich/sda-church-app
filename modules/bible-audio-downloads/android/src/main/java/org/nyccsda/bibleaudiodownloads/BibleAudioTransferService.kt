package org.nyccsda.bibleaudiodownloads

import android.app.job.JobParameters
import android.app.job.JobService
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import androidx.annotation.RequiresApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.joinAll
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Semaphore
import kotlinx.coroutines.sync.withPermit
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.ConcurrentHashMap
import kotlin.coroutines.coroutineContext

/**
 * The user-initiated data transfer job that downloads Bible audio on Android
 * 14 and later (#611): see BibleAudioTransfers. One runs for chapters on Wi-Fi
 * only, and one for chapters allowed on mobile data, three chapters at a time
 * between them. Each chapter is tried from each of its sources in turn, and
 * carries on from where it stopped when its source allows it.
 *
 * Android requires its notification, which shows the chapters' progress, with
 * Stop (BibleAudioNotifications). When the network a job needs is gone,
 * Android stops it, and starts it again once it's back; the notification
 * says what it's waiting for.
 *
 * Custom code, to remove once Expo can do it (#612).
 */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
class BibleAudioTransferService : JobService() {
  private val runs = ConcurrentHashMap<Int, Run>()

  override fun onStartJob(params: JobParameters): Boolean {
    val mobileData = params.jobId == BibleAudioTransfers.ANY_NETWORK_JOB
    val transfers = BibleAudioTransfers(applicationContext)
    BibleAudioTransfers.RUNNING.add(params.jobId)
    // Android wants the notification at once.
    setNotification(
      params,
      notificationId(params.jobId),
      progressNotification(transfers, mobileData, waiting = null),
      if (BibleAudioNotifications.enabled(this)) JOB_END_NOTIFICATION_POLICY_DETACH else JOB_END_NOTIFICATION_POLICY_REMOVE,
    )
    val run = Run(params, mobileData, transfers)
    runs[params.jobId] = run
    run.start()
    return true
  }

  override fun onStopJob(params: JobParameters): Boolean {
    val mobileData = params.jobId == BibleAudioTransfers.ANY_NETWORK_JOB
    runs.remove(params.jobId)?.stop()
    BibleAudioTransfers.RUNNING.remove(params.jobId)
    val transfers = BibleAudioTransfers(applicationContext)
    if (params.stopReason == JobParameters.STOP_REASON_CANCELLED_BY_APP) return false
    val more = transfers.hasWaiting(mobileData)
    if (more && params.stopReason == JobParameters.STOP_REASON_CONSTRAINT_CONNECTIVITY) {
      val text = BibleAudioNotifications.options(this).text
      BibleAudioNotifications.post(
        this,
        notificationId(params.jobId),
        progressNotification(transfers, mobileData, if (mobileData) text.waitingForConnection else text.waitingForWifi),
      )
    }
    // Android starts it again when it can.
    return more
  }

  private fun progressNotification(transfers: BibleAudioTransfers, mobileData: Boolean, waiting: String?) =
    transfers.counts(mobileData).let { counts ->
      BibleAudioNotifications.progress(this, counts?.first ?: "", counts?.second ?: 0, counts?.third ?: 0, waiting)
    }

  // One job's work: its workers take chapters in turn, and the notification
  // follows them.
  private inner class Run(
    private val params: JobParameters,
    private val mobileData: Boolean,
    private val transfers: BibleAudioTransfers,
  ) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val connections: MutableSet<HttpURLConnection> = ConcurrentHashMap.newKeySet()
    @Volatile private var stopped = false
    // The job's network went, as when Wi-Fi drops: the chapters under way wait
    // for it, and aren't failures. Android stops the job, and starts it again
    // when the network is back.
    @Volatile private var networkLost = false

    fun start() {
      scope.launch {
        var estimate = -1L
        val ticker = launch {
          var tick = 0
          while (isActive) {
            delay(NOTIFICATION_EVERY_MS)
            if (!stopped) BibleAudioNotifications.update(this@BibleAudioTransferService, notificationId(params.jobId), progressNotification(transfers, mobileData, waiting = null))
            // Android uses the estimate to judge how long the job should take.
            if (tick++ % ESTIMATE_EVERY_TICKS == 0) {
              val remaining = transfers.remainingBytes(mobileData)
              if (remaining != estimate) {
                estimate = remaining
                updateEstimatedNetworkBytes(params, remaining, 0)
              }
            }
          }
        }
        while (true) {
          (1..BibleAudioTransfers.AT_ONCE).map { launch { work() } }.joinAll()
          if (stopped) break
          if (networkLost) {
            // Until Android stops the job, or the network turns out to be there.
            delay(NETWORK_CHECK_MS)
            if (networkUp()) networkLost = false
            continue
          }
          if (transfers.endIfIdle(params.jobId, mobileData)) break
        }
        ticker.cancel()
        if (stopped) return@launch
        finish()
      }
    }

    fun stop() {
      stopped = true
      // Off the main thread, as closing a connection may wait on the network.
      val open = connections.toList()
      Thread { open.forEach { it.disconnect() } }.start()
      scope.cancel()
    }

    private suspend fun work() {
      while (!stopped && !networkLost && coroutineContext.isActive) {
        val more = SHARED.withPermit {
          val transfer = if (stopped) null else transfers.take(mobileData)
          transfer?.let { download(it) }
          transfer != null
        }
        if (!more) return
      }
    }

    // Each source in turn. Stopping, or a chapter no longer wanted, isn't a failure.
    private fun download(transfer: BibleAudioTransfers.Transfer) {
      val target = transfers.targetFile(transfer.path) ?: return transfers.failed(transfer)
      for (url in transfer.urls) {
        if (stopped || networkLost) return transfers.release(transfer)
        if (!transfers.wanted(transfer)) return transfers.dropped(transfer)
        try {
          if (fetch(transfer, url, target)) {
            if (transfers.wanted(transfer)) transfers.finished(transfer) else {
              // Deleted just as it finished: it goes too.
              target.delete()
              transfers.dropped(transfer)
            }
            return
          }
        } catch (error: IOException) {
          // Not the source's fault if the network went: the chapter waits for it.
          if (!networkUp()) {
            networkLost = true
            return transfers.release(transfer)
          }
          // Otherwise the next source, unless it stopped.
        }
      }
      if (stopped || networkLost) transfers.release(transfer)
      else if (!transfers.wanted(transfer)) transfers.dropped(transfer)
      else transfers.failed(transfer)
    }

    // Whether the job's network is still there, and still one the job may use.
    private fun networkUp(): Boolean {
      val network = params.network ?: return false
      val capabilities = getSystemService(ConnectivityManager::class.java).getNetworkCapabilities(network) ?: return false
      return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
        (mobileData || capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED))
    }

    // Downloads one chapter into its partial file, carrying on from what's
    // there when it came from the same source and the server allows it, then
    // moves it into place. False for an answer that isn't the file: a web
    // page, or a size that isn't the recording's (BibleAudioFileChecks), whose
    // partial file goes.
    private fun fetch(transfer: BibleAudioTransfers.Transfer, url: String, target: File): Boolean {
      val partial = transfers.partialFile(transfer)
      val source = File(partial.path + ".source")
      if (!partial.exists() || !source.exists() || source.readText() != url) {
        partial.delete()
        source.writeText(url)
      }
      var offset = partial.length()
      // On the network Android started the job for, never the phone's default:
      // with weak Wi-Fi, Android may make mobile data the default while Wi-Fi
      // stays connected, and when Wi-Fi goes, the default becomes mobile data
      // before the job is stopped. Bound to the job's Wi-Fi, a download fails
      // when Wi-Fi goes, and waits for it, instead of carrying on over mobile
      // data the member didn't allow.
      val network = params.network ?: throw IOException("no network for the job")
      val connection = network.openConnection(URL(url)) as HttpURLConnection
      connections.add(connection)
      try {
        connection.connectTimeout = TIMEOUT_MS
        connection.readTimeout = TIMEOUT_MS
        connection.instanceFollowRedirects = true
        if (offset > 0) connection.setRequestProperty("Range", "bytes=$offset-")
        val code = connection.responseCode
        val sizes = transfer.sizes
        if (!sizes.allows(connection.contentType)) {
          // A web page, as a Wi-Fi's sign-in page, isn't the recording.
          partial.delete()
          return false
        } else if (code == HttpURLConnection.HTTP_PARTIAL && offset > 0) {
          // Carries on.
        } else if (code in 200..299) {
          // A whole file.
          offset = 0
        } else {
          // 416: what's there doesn't fit; start again next time.
          if (code == 416) partial.delete()
          return false
        }
        val length = connection.contentLengthLong
        val total = if (length >= 0) offset + length else -1L
        // Bigger than the recording: not it, and it mustn't fill the phone.
        if (total > sizes.max) {
          partial.delete()
          return false
        }
        var bytes = offset
        var tooBig = false
        transfers.progress(transfer, bytes, total)
        connection.inputStream.use { input ->
          FileOutputStream(partial, offset > 0).use { output ->
            val buffer = ByteArray(BUFFER)
            var sinceReport = 0L
            while (true) {
              if (stopped) throw IOException("stopped")
              val read = input.read(buffer)
              if (read < 0) break
              if (bytes + read > sizes.max) {
                tooBig = true
                break
              }
              output.write(buffer, 0, read)
              bytes += read
              sinceReport += read
              if (sinceReport >= REPORT_EVERY) {
                transfers.progress(transfer, bytes, total)
                sinceReport = 0
              }
            }
          }
        }
        // Cut off, or not the recording: tried again from the start.
        if (tooBig || (total >= 0 && bytes != total) || !sizes.fits(bytes)) {
          partial.delete()
          return false
        }
        target.parentFile?.mkdirs()
        if (target.exists()) target.delete()
        // The same storage, so it moves whole: the app never sees half a chapter.
        if (!partial.renameTo(target)) return false
        source.delete()
        return true
      } finally {
        connections.remove(connection)
        connection.disconnect()
      }
    }

    // All done, or paused after failures.
    private fun finish() {
      val id = notificationId(params.jobId)
      if (transfers.pausedForFailures()) {
        BibleAudioTransfers.RUNNING.remove(params.jobId)
        BibleAudioNotifications.post(this@BibleAudioTransferService, id, BibleAudioNotifications.finished(this@BibleAudioTransferService, transfers.counts(mobileData)?.first ?: "", done = false))
      } else {
        val groups = transfers.finishedGroups()
        if (groups.isNotEmpty()) {
          BibleAudioNotifications.post(this@BibleAudioTransferService, id, BibleAudioNotifications.finished(this@BibleAudioTransferService, groups.joinToString(" · "), done = true))
        }
        if (!transfers.hasWaiting(!mobileData)) transfers.clearCounts()
      }
      jobFinished(params, false)
    }
  }

  private fun notificationId(jobId: Int) = jobId

  companion object {
    // Three chapters at a time between both jobs.
    private val SHARED = Semaphore(BibleAudioTransfers.AT_ONCE)
    private const val TIMEOUT_MS = 30_000
    private const val BUFFER = 64 * 1024
    private const val REPORT_EVERY = 256L * 1024
    private const val NOTIFICATION_EVERY_MS = 1_000L
    private const val ESTIMATE_EVERY_TICKS = 30
    private const val NETWORK_CHECK_MS = 5_000L
  }
}
