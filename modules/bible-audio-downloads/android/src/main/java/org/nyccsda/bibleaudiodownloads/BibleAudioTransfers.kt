package org.nyccsda.bibleaudiodownloads

import android.app.job.JobInfo
import android.app.job.JobScheduler
import android.content.ComponentName
import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.net.Uri
import android.os.Build
import androidx.annotation.RequiresApi
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.concurrent.ConcurrentHashMap

/**
 * Bible audio chapters downloaded by the app's own user-initiated data
 * transfer jobs (#611), on Android 14 and later: BibleAudioTransferService.
 *
 * Android's DownloadManager runs each download as one of the app's background
 * jobs, and with the app out of sight on battery Android runs only about 75 of
 * those an hour, so a locked phone took most of a day over a whole Bible. A
 * user-initiated job isn't held to that, and runs while the phone is locked,
 * with the app closed, for as long as it takes. Android 13 and lower keep
 * DownloadManager (BibleAudioDownloadStore).
 *
 * The chapters wait here, in order, in the module's preferences file, each with
 * all its sources, so the job can try the next with the app closed. Two jobs,
 * one for chapters on Wi-Fi only (Wi-Fi that isn't metered, so not a phone's
 * hotspot) and one for chapters allowed on mobile data, download three at a
 * time between them, as the in-app downloader does. Android stops a job whose
 * network is gone, and starts it again when it's back.
 *
 * Custom code, to remove once Expo can do it (#612).
 */
@RequiresApi(Build.VERSION_CODES.UPSIDE_DOWN_CAKE)
internal class BibleAudioTransfers(private val context: Context) {
  private val tracked = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
  private val scheduler = context.getSystemService(JobScheduler::class.java)

  /** A chapter waiting, downloading, failed every source, or stopped from its notification. */
  data class Transfer(
    val key: String,
    val id: String,
    val urls: List<String>,
    val path: String,
    val mobileData: Boolean,
    val group: String,
    val state: String,
    // Its size as the app estimates it, for Android's estimate of the job.
    val bytes: Long,
  )

  /** Queues the chapters, in place of any under the same names, and starts their job. */
  fun enqueue(downloads: List<ChapterDownload>, allowMobileData: Boolean) = synchronized(LOCK) {
    val ids = downloads.map { it.id }.toSet()
    // One tried again, from its next source, goes first, so a section isn't
    // left waiting on one chapter until the rest of the Bible is done.
    val again = transfers().filter { it.id in ids }.map { it.id }.toSet()
    removeLocked(ids)
    var sequence = tracked.getLong(SEQUENCE, 0)
    val editor = tracked.edit()
    val added = mutableMapOf<String, Int>()
    for (download in downloads) {
      val target = targetFile(download.path) ?: continue
      sequence += 1
      val place = sequence.toString().padStart(12, '0')
      val key = PREFIX + if (download.id in again) "$AGAIN$place" else place
      val urls = listOf(download.url) + download.fallbacks.filter { it != download.url }
      editor.putString(key, encode(Transfer(key, download.id, urls, target.path, allowMobileData, download.group, WAITING, download.bytes.toLong())))
      if (download.id !in again) added[download.group] = (added[download.group] ?: 0) + 1
    }
    // For the notification's "312 of 1,189 chapters".
    added.forEach { (group, count) -> editor.putInt(TOTAL + group, tracked.getInt(TOTAL + group, 0) + count) }
    // The member asked again, as after failures: start again.
    editor.putLong(SEQUENCE, sequence).putInt(FAILURES, 0).commit()
    schedule(allowMobileData)
  }

  /** What's left: waiting, downloading, failed, or stopped. Finished chapters aren't listed. */
  fun list(): List<Map<String, Any?>> = synchronized(LOCK) {
    markStoppedByAndroidLocked()
    val onWifi = onUnmeteredWifi()
    transfers().map { transfer ->
      val progress = PROGRESS[transfer.id]
      val running = transfer.state == WAITING && progress != null
      val wifiLane = !transfer.mobileData
      mapOf(
        "id" to transfer.id,
        "state" to when {
          running -> "running"
          transfer.state == WAITING -> "waiting"
          else -> transfer.state
        },
        "reason" to if (!running && transfer.state == WAITING && wifiLane && !onWifi) "wifi" else null,
        "bytesWritten" to (progress?.first ?: 0L),
        "totalBytes" to (progress?.second ?: -1L),
        "mobileData" to transfer.mobileData,
      )
    }
  }

  /** Stops chapters, and forgets them; a job left with nothing ends. */
  fun cancel(ids: Set<String>) = synchronized(LOCK) {
    removeLocked(ids)
    endIdleJobsLocked()
  }

  /** Stop, from the notification: every chapter, and the app hears of it as the member's stop. */
  fun stopAll() = synchronized(LOCK) {
    val editor = tracked.edit()
    for (transfer in transfers()) editor.putString(transfer.key, encode(transfer.copy(state = STOPPED)))
    editor.commit()
    scheduler.cancel(WIFI_JOB)
    scheduler.cancel(ANY_NETWORK_JOB)
    clearCountsLocked()
  }

  // For the job.

  /** The next chapter for a job, in order, or null; it's marked as taken. */
  fun take(mobileData: Boolean): Transfer? = synchronized(LOCK) {
    if (tracked.getInt(FAILURES, 0) >= FAILURES_TO_PAUSE) return@synchronized null
    transfers().firstOrNull { it.state == WAITING && it.mobileData == mobileData && TAKEN.add(it.id) }
  }

  /**
   * Whether a chapter a job took is still asked for: not stopped, deleted, or
   * handed over again, as for mobile data, which puts a new one in line.
   */
  fun wanted(transfer: Transfer) = synchronized(LOCK) {
    tracked.getString(transfer.key, null)?.let { decode(transfer.key, it) }?.state == WAITING
  }

  /** For a chapter no longer wanted: its partial file goes, unless it's in line again, to carry on from. */
  fun dropped(transfer: Transfer) = synchronized(LOCK) {
    release(transfer)
    if (transfers().none { it.id == transfer.id && it.state == WAITING }) deletePartial(transfer)
  }

  /** What's left for a job, as the app estimates it. */
  fun remainingBytes(mobileData: Boolean) = synchronized(LOCK) {
    transfers().filter { it.state == WAITING && it.mobileData == mobileData }.sumOf { it.bytes }.coerceAtLeast(0)
  }

  fun progress(transfer: Transfer, bytes: Long, total: Long) {
    PROGRESS[transfer.id] = bytes to total
  }

  /** Done: the file's in place. */
  fun finished(transfer: Transfer) = synchronized(LOCK) {
    release(transfer)
    if (tracked.getString(transfer.key, null) == null) return@synchronized
    tracked.edit()
      .remove(transfer.key)
      .putInt(DONE + transfer.group, tracked.getInt(DONE + transfer.group, 0) + 1)
      .putInt(FAILURES, 0)
      .commit()
  }

  /** Every source failed: left for the app, which may try again. */
  fun failed(transfer: Transfer) = synchronized(LOCK) {
    release(transfer)
    if (tracked.getString(transfer.key, null) == null) return@synchronized
    tracked.edit()
      .putString(transfer.key, encode(transfer.copy(state = FAILED)))
      .putInt(FAILURES, tracked.getInt(FAILURES, 0) + 1)
      .commit()
  }

  /** Stopped part way, as when Wi-Fi went: it waits its turn again, with what it has. */
  fun release(transfer: Transfer) {
    TAKEN.remove(transfer.id)
    PROGRESS.remove(transfer.id)
  }

  fun pausedForFailures() = tracked.getInt(FAILURES, 0) >= FAILURES_TO_PAUSE

  /**
   * For a job whose chapters are done: whether it may end, with none waiting
   * and none started meanwhile. Together, so a chapter queued just then isn't
   * left with no job.
   */
  fun endIfIdle(jobId: Int, mobileData: Boolean): Boolean = synchronized(LOCK) {
    val more = !pausedForFailures() && transfers().any { it.state == WAITING && it.mobileData == mobileData && it.id !in TAKEN }
    if (!more) RUNNING.remove(jobId)
    !more
  }

  fun hasWaiting(mobileData: Boolean) = synchronized(LOCK) {
    transfers().any { it.state == WAITING && it.mobileData == mobileData }
  }

  /** For the notification: the group under way, and how far it is. */
  fun counts(mobileData: Boolean): Triple<String, Int, Int>? = synchronized(LOCK) {
    val all = transfers()
    val group = all.firstOrNull { it.mobileData == mobileData && it.id in TAKEN }?.group
      ?: all.firstOrNull { it.mobileData == mobileData && it.state == WAITING }?.group
      ?: return@synchronized null
    Triple(group, tracked.getInt(DONE + group, 0), tracked.getInt(TOTAL + group, 0))
  }

  /** The groups that finished, with nothing of theirs left, for the "done" notification. */
  fun finishedGroups(): List<String> = synchronized(LOCK) {
    val left = transfers().map { it.group }.toSet()
    tracked.all.keys.filter { it.startsWith(TOTAL) }.map { it.removePrefix(TOTAL) }.filter { it !in left }
  }

  /** After the job's done notification: the counts start again next time. */
  fun clearCounts() = synchronized(LOCK) { clearCountsLocked() }

  fun partialFile(transfer: Transfer): File {
    val folder = File(context.noBackupFilesDir, PARTIAL_FOLDER)
    folder.mkdirs()
    // As cuv-mandarin_PHM_1.part: one per chapter, whatever its source, to carry on from.
    return File(folder, transfer.id.replace(Regex("[^A-Za-z0-9-]"), "_") + ".part")
  }

  // The partial file, and the note of which source it came from.
  private fun deletePartial(transfer: Transfer) {
    val partial = partialFile(transfer)
    partial.delete()
    File(partial.path + ".source").delete()
  }

  fun targetFile(path: String): File? {
    val file = File(Uri.parse(path).path ?: path).canonicalFile
    val root = File(context.filesDir, AUDIO_FOLDER).canonicalPath
    return if (file.path.startsWith("$root/")) file else null
  }

  // Starts a lane's job, unless it's running or waiting for its network.
  private fun schedule(mobileData: Boolean) {
    val id = if (mobileData) ANY_NETWORK_JOB else WIFI_JOB
    if (id in RUNNING || scheduler.getPendingJob(id) != null) return
    val network = NetworkRequest.Builder()
      .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
      .apply {
        if (!mobileData) {
          addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
          addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
        }
      }
      .build()
    val estimate = transfers().filter { it.state == WAITING && it.mobileData == mobileData }.sumOf { it.bytes }
    val job = JobInfo.Builder(id, ComponentName(context, BibleAudioTransferService::class.java))
      .setUserInitiated(true)
      .setRequiredNetwork(network)
      .setEstimatedNetworkBytes(estimate.coerceAtLeast(MIN_ESTIMATED_BYTES), 0)
      .setPersisted(true)
      .build()
    scheduler.schedule(job)
  }

  // Android's Task Manager stops the app and its jobs, and won't start them
  // again: chapters left with no job, the member stopped.
  private fun markStoppedByAndroidLocked() {
    val all = transfers()
    // Paused after failures, they wait for the app, which tries the next source.
    if (all.none { it.state == WAITING } || pausedForFailures()) return
    val editor = tracked.edit()
    var changed = false
    for (mobileData in listOf(false, true)) {
      val id = if (mobileData) ANY_NETWORK_JOB else WIFI_JOB
      if (id in RUNNING || scheduler.getPendingJob(id) != null) continue
      for (transfer in all.filter { it.state == WAITING && it.mobileData == mobileData && it.id !in TAKEN }) {
        editor.putString(transfer.key, encode(transfer.copy(state = STOPPED)))
        changed = true
      }
    }
    if (changed) editor.commit()
  }

  private fun endIdleJobsLocked() {
    val all = transfers()
    if (all.none { it.state == WAITING && !it.mobileData }) scheduler.cancel(WIFI_JOB)
    if (all.none { it.state == WAITING && it.mobileData }) scheduler.cancel(ANY_NETWORK_JOB)
    if (all.isEmpty()) clearCountsLocked()
  }

  private fun removeLocked(ids: Set<String>) {
    if (ids.isEmpty()) return
    val gone = transfers().filter { it.id in ids }
    if (gone.isEmpty()) return
    // Forgotten first, so a chapter finishing meanwhile isn't kept.
    tracked.edit().apply { gone.forEach { remove(it.key) } }.commit()
    // A job downloading one drops it, and its partial file (dropped).
    for (transfer in gone) if (transfer.id !in TAKEN) deletePartial(transfer)
  }

  private fun clearCountsLocked() {
    val editor = tracked.edit()
    tracked.all.keys.filter { it.startsWith(TOTAL) || it.startsWith(DONE) }.forEach { editor.remove(it) }
    editor.commit()
  }

  private fun onUnmeteredWifi(): Boolean {
    val connectivity = context.getSystemService(ConnectivityManager::class.java)
    val capabilities = connectivity.getNetworkCapabilities(connectivity.activeNetwork) ?: return false
    return capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) &&
      capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED)
  }

  private fun transfers(): List<Transfer> =
    tracked.all.entries
      .filter { it.key.startsWith(PREFIX) }
      .sortedBy { it.key }
      .mapNotNull { (key, value) -> decode(key, value as? String ?: return@mapNotNull null) }

  private fun encode(transfer: Transfer) =
    JSONObject()
      .put("id", transfer.id)
      .put("urls", JSONArray(transfer.urls))
      .put("path", transfer.path)
      .put("mobileData", transfer.mobileData)
      .put("group", transfer.group)
      .put("state", transfer.state)
      .put("bytes", transfer.bytes)
      .toString()

  private fun decode(key: String, value: String): Transfer? = try {
    val json = JSONObject(value)
    val urls = json.getJSONArray("urls").let { array -> (0 until array.length()).map { array.getString(it) } }
    Transfer(key, json.getString("id"), urls, json.getString("path"), json.getBoolean("mobileData"), json.optString("group"), json.getString("state"), json.optLong("bytes"))
  } catch (error: Exception) {
    null
  }

  companion object {
    const val WIFI_JOB = 61101
    const val ANY_NETWORK_JOB = 61102
    // Chapters under way at once, between both jobs: the in-app downloader's CONCURRENT_DOWNLOADS.
    const val AT_ONCE = 3
    // As the app's FAILURES_TO_STOP: after six chapters in a row fail every
    // source, as when the hosts are down, none starts until the app opens.
    private const val FAILURES_TO_PAUSE = 6
    private const val PREFERENCES = "bible-audio-downloads"
    private const val AUDIO_FOLDER = "bible-audio"
    private const val PARTIAL_FOLDER = "bible-audio-partial"
    // Each chapter's key, after which comes its place in line; AGAIN sorts
    // before any digit, for one handed over again.
    private const val PREFIX = "transfer:"
    private const val AGAIN = "!"
    private const val SEQUENCE = "transfer-sequence"
    private const val FAILURES = "transfer-failures-in-a-row"
    private const val TOTAL = "transfer-total:"
    private const val DONE = "transfer-done:"
    private const val WAITING = "waiting"
    private const val FAILED = "failed"
    private const val STOPPED = "stopped"
    // When the app gives no sizes: a chapter or so.
    private const val MIN_ESTIMATED_BYTES = 1L * 1024 * 1024
    private val LOCK = Any()

    // In this process: chapters a job has taken, how far each is, and the jobs running.
    private val TAKEN: MutableSet<String> = ConcurrentHashMap.newKeySet()
    private val PROGRESS = ConcurrentHashMap<String, Pair<Long, Long>>()
    val RUNNING: MutableSet<Int> = ConcurrentHashMap.newKeySet()
  }
}
