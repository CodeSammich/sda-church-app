package org.nyccsda.bibleaudiodownloads

import android.app.DownloadManager
import android.content.Context
import android.database.Cursor
import android.net.Uri
import java.io.File

/**
 * Bible audio chapters handed to Android's DownloadManager (#611), which goes
 * on downloading in the system while the phone is locked or the app is closed.
 *
 * Custom code, to remove once Expo can do it (#612): Expo SDK 58's
 * DownloadTask has no background session on Android.
 *
 * DownloadManager can only write to the app's external files, so each chapter
 * lands in bible-audio-partial there and is moved into the app's own files,
 * at the path the app asked for, when it's done: by BibleAudioDownloadReceiver,
 * or by list() if the app missed that. The app's backup rules leave both
 * folders out (plugins/withAndroidBackupRules.js).
 *
 * Wi-Fi only means Wi-Fi that isn't metered, so a phone's hotspot, someone's
 * data plan, waits too. Only a download the member allowed on mobile data
 * may use either.
 *
 * Each download shows the system's own notification while it runs, which it
 * groups into one for the app, with no permission from the app. It has to: a
 * hidden download runs as the app's background work, which Android puts off
 * while the phone is locked.
 *
 * DownloadManager gets three chapters at a time, as the in-app downloader
 * downloads them, since one mirror is a small ministry's own server; left to
 * itself it ran 11 at once. The rest wait here, in order, and each chapter
 * that ends starts the next, through the receiver, with the app closed too.
 * Handing DownloadManager a whole Bible at once also took long enough that
 * Android stopped the receiver, and said the app wasn't responding. Chapters
 * allowed on mobile data get their own three, so they aren't held up behind
 * ones waiting for Wi-Fi. After six fail in a row, as when the host is down,
 * no more start until the app opens and tries the next source.
 */
internal class BibleAudioDownloadStore(private val context: Context) {
  private val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private val tracked = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  // A chapter handed over: the app's name for it, the file it becomes, whether
  // it may use mobile data, and where DownloadManager writes it meanwhile.
  private data class Entry(val id: String, val path: String, val mobileData: Boolean, val partial: String)

  // A chapter waiting its turn, not yet handed to DownloadManager.
  private data class Waiting(val key: String, val id: String, val url: String, val path: String, val mobileData: Boolean)

  // One handed over, as DownloadManager reports it.
  private data class Handed(val entry: Entry, val status: Int, val reason: Int)

  /** Queues the chapters, in place of any already downloading under the same names, and starts the first. */
  fun enqueue(downloads: List<ChapterDownload>, allowMobileData: Boolean) = synchronized(LOCK) {
    // Ones DownloadManager had, as one the app tries from its next source
    // after a failure, go first, so a section isn't left waiting on one
    // chapter until the rest of the Bible is done.
    val handedBefore = entries().values.map { it.id }.toSet()
    cancelLocked(downloads.map { it.id }.toSet())
    var sequence = tracked.getLong(SEQUENCE, 0)
    val editor = tracked.edit()
    for (download in downloads) {
      val target = targetFile(download.path) ?: continue
      sequence += 1
      val place = sequence.toString().padStart(12, '0')
      val key = WAITING_PREFIX + if (download.id in handedBefore) "$AGAIN$place" else place
      editor.putString(key, encodeWaiting(Waiting(key, download.id, download.url, target.path, allowMobileData)))
    }
    // The app asked again, as with the next source after failures: start again.
    editor.putLong(SEQUENCE, sequence).putInt(FAILURES, 0).commit()
    startNextLocked()
  }

  /** The chapters still downloading or waiting. Finished ones are moved into place first, and left out. */
  fun list(): List<Map<String, Any?>> = synchronized(LOCK) {
    // First, in case the receiver missed one ending: a chapter started after
    // the list is read would be missing from it, which the app takes for a
    // failure.
    startNextLocked()
    val entries = entries()
    val seen = mutableSetOf<Long>()
    val result = mutableListOf<Map<String, Any?>>()
    for (batch in entries.keys.chunked(BATCH)) {
      manager.query(DownloadManager.Query().setFilterById(*batch.toLongArray()))?.use { cursor ->
        while (cursor.moveToNext()) {
          val downloadId = cursor.long(DownloadManager.COLUMN_ID)
          val entry = entries[downloadId] ?: continue
          seen.add(downloadId)
          when (val status = cursor.int(DownloadManager.COLUMN_STATUS)) {
            DownloadManager.STATUS_SUCCESSFUL -> finishLocked(downloadId, entry, cursor)
            else -> result.add(
              mapOf(
                "id" to entry.id,
                "state" to stateOf(status),
                "reason" to if (status == DownloadManager.STATUS_PAUSED) pauseReason(cursor.int(DownloadManager.COLUMN_REASON)) else null,
                "bytesWritten" to cursor.long(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR),
                "totalBytes" to cursor.long(DownloadManager.COLUMN_TOTAL_SIZE_BYTES),
                "mobileData" to entry.mobileData,
              ),
            )
          }
        }
      }
    }
    // Ones the system no longer has, as after a member cleared its downloads.
    val gone = entries.keys - seen
    if (gone.isNotEmpty()) tracked.edit().apply { gone.forEach { remove(it.toString()) } }.commit()
    sweepLocked()
    for (waiting in waiting()) {
      result.add(
        mapOf(
          "id" to waiting.id,
          "state" to "waiting",
          "reason" to null,
          "bytesWritten" to 0L,
          "totalBytes" to -1L,
          "mobileData" to waiting.mobileData,
        ),
      )
    }
    result
  }

  /** Stops chapters downloading, and forgets them, so none is moved into place afterwards. */
  fun cancel(ids: Set<String>) = synchronized(LOCK) {
    cancelLocked(ids)
    startNextLocked()
  }

  /** For BibleAudioDownloadReceiver: moves a finished chapter into place, and starts the next. */
  fun complete(downloadId: Long) = synchronized(LOCK) {
    val entry = entries()[downloadId]
    if (entry != null) {
      manager.query(DownloadManager.Query().setFilterById(downloadId))?.use { cursor ->
        if (!cursor.moveToFirst()) return@use
        when (cursor.int(DownloadManager.COLUMN_STATUS)) {
          DownloadManager.STATUS_SUCCESSFUL -> finishLocked(downloadId, entry, cursor)
          // Left for the app, which tries the next source.
          DownloadManager.STATUS_FAILED -> tracked.edit().putInt(FAILURES, tracked.getInt(FAILURES, 0) + 1).commit()
        }
      }
    }
    startNextLocked()
  }

  // Hands DownloadManager the next chapters, up to three under way. One held
  // for Wi-Fi doesn't hold up a chapter allowed on mobile data.
  private fun startNextLocked() {
    val waiting = waiting()
    if (waiting.isEmpty() || tracked.getInt(FAILURES, 0) >= FAILURES_TO_PAUSE) return
    val underWay = handed().filter {
      it.status == DownloadManager.STATUS_PENDING ||
        it.status == DownloadManager.STATUS_RUNNING ||
        it.status == DownloadManager.STATUS_PAUSED
    }
    var busy = underWay.size
    var busyForMobileData = underWay.count { !heldForWifi(it) }
    if (busy >= AT_ONCE && busyForMobileData >= AT_ONCE) return
    val partial = File(context.getExternalFilesDir(null) ?: return, PARTIAL_FOLDER)
    partial.mkdirs()
    val title = context.applicationInfo.loadLabel(context.packageManager)
    for (next in waiting) {
      if (if (next.mobileData) busyForMobileData >= AT_ONCE else busy >= AT_ONCE) continue
      val name = "${System.nanoTime()}.part"
      val request = DownloadManager.Request(Uri.parse(next.url))
        .setDestinationInExternalFilesDir(context, null, "$PARTIAL_FOLDER/$name")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setTitle(title)
        .setAllowedOverMetered(next.mobileData)
        .setAllowedOverRoaming(next.mobileData)
      if (!next.mobileData) request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
      val downloadId = manager.enqueue(request)
      tracked.edit()
        .remove(next.key)
        .putString(downloadId.toString(), encode(Entry(next.id, next.path, next.mobileData, File(partial, name).path)))
        .commit()
      busy += 1
      busyForMobileData += 1
      if (busy >= AT_ONCE && busyForMobileData >= AT_ONCE) return
    }
  }

  private fun heldForWifi(handed: Handed) =
    !handed.entry.mobileData &&
      handed.status == DownloadManager.STATUS_PAUSED &&
      (handed.reason == DownloadManager.PAUSED_QUEUED_FOR_WIFI || handed.reason == DownloadManager.PAUSED_WAITING_FOR_NETWORK)

  private fun handed(): List<Handed> {
    val entries = entries()
    val result = mutableListOf<Handed>()
    for (batch in entries.keys.chunked(BATCH)) {
      manager.query(DownloadManager.Query().setFilterById(*batch.toLongArray()))?.use { cursor ->
        while (cursor.moveToNext()) {
          val entry = entries[cursor.long(DownloadManager.COLUMN_ID)] ?: continue
          result.add(Handed(entry, cursor.int(DownloadManager.COLUMN_STATUS), cursor.int(DownloadManager.COLUMN_REASON)))
        }
      }
    }
    return result
  }

  private fun cancelLocked(ids: Set<String>) {
    if (ids.isEmpty()) return
    val notStarted = waiting().filter { it.id in ids }
    if (notStarted.isNotEmpty()) tracked.edit().apply { notStarted.forEach { remove(it.key) } }.commit()
    val stopped = entries().filterValues { it.id in ids }.keys
    if (stopped.isEmpty()) return
    val partials = entries().filterKeys { it in stopped }.values.map { File(it.partial) }
    // Forgotten first, so a chapter finishing meanwhile isn't moved into place.
    tracked.edit().apply { stopped.forEach { remove(it.toString()) } }.commit()
    stopped.chunked(BATCH).forEach { manager.remove(*it.toLongArray()) }
    // DownloadManager may leave a stopped download's file behind.
    partials.forEach { it.delete() }
  }

  // Partial files no download still owns, as one a stopped download left, or
  // one left when the app stopped mid-move. Not new ones, which DownloadManager
  // may be starting.
  private fun sweepLocked() {
    val folder = File(context.getExternalFilesDir(null) ?: return, PARTIAL_FOLDER)
    val owned = entries().values.map { File(it.partial).name }.toSet()
    val old = System.currentTimeMillis() - ORPHAN_AGE_MS
    folder.listFiles()?.forEach { file ->
      if (file.name !in owned && file.lastModified() < old) file.delete()
    }
  }

  private fun finishLocked(downloadId: Long, entry: Entry, cursor: Cursor) {
    tracked.edit().remove(downloadId.toString()).putInt(FAILURES, 0).commit()
    val source = cursor.string(DownloadManager.COLUMN_LOCAL_URI)?.let { Uri.parse(it).path }?.let(::File)
    val target = targetFile(entry.path)
    try {
      if (source != null && source.exists() && target != null) {
        target.parentFile?.mkdirs()
        // A copy, as the two folders may be on different storage; renamed once
        // it's whole, as the app's own downloads are.
        val moving = File(target.parentFile, "${target.name}.${System.nanoTime()}.part")
        try {
          source.inputStream().use { input -> moving.outputStream().use { input.copyTo(it) } }
          if (!moving.renameTo(target)) moving.delete()
        } catch (error: Exception) {
          // The app sees the chapter missing, and downloads it again.
          moving.delete()
        }
      }
    } finally {
      source?.delete()
      manager.remove(downloadId)
    }
  }

  // Only into the app's own Bible audio folder.
  private fun targetFile(path: String): File? {
    val file = File(Uri.parse(path).path ?: path).canonicalFile
    val root = File(context.filesDir, AUDIO_FOLDER).canonicalPath
    return if (file.path.startsWith("$root/")) file else null
  }

  private fun entries(): Map<Long, Entry> =
    tracked.all.mapNotNull { (key, value) ->
      val downloadId = key.toLongOrNull() ?: return@mapNotNull null
      decode(value as? String ?: return@mapNotNull null)?.let { downloadId to it }
    }.toMap()

  // In the order asked for.
  private fun waiting(): List<Waiting> =
    tracked.all.entries
      .filter { it.key.startsWith(WAITING_PREFIX) }
      .sortedBy { it.key }
      .mapNotNull { (key, value) -> decodeWaiting(key, value as? String ?: return@mapNotNull null) }

  private fun encodeWaiting(waiting: Waiting) =
    listOf(waiting.id, waiting.url, waiting.path, if (waiting.mobileData) "1" else "0").joinToString("\n")

  private fun decodeWaiting(key: String, value: String): Waiting? {
    val parts = value.split("\n")
    return if (parts.size == 4) Waiting(key, parts[0], parts[1], parts[2], parts[3] == "1") else null
  }

  private fun encode(entry: Entry) =
    listOf(entry.id, entry.path, if (entry.mobileData) "1" else "0", entry.partial).joinToString("\n")

  private fun decode(value: String): Entry? {
    val parts = value.split("\n")
    return if (parts.size == 4) Entry(parts[0], parts[1], parts[2] == "1", parts[3]) else null
  }

  private fun stateOf(status: Int) = when (status) {
    DownloadManager.STATUS_RUNNING -> "running"
    DownloadManager.STATUS_PAUSED -> "paused"
    DownloadManager.STATUS_FAILED -> "failed"
    else -> "waiting"
  }

  private fun pauseReason(reason: Int) = when (reason) {
    DownloadManager.PAUSED_QUEUED_FOR_WIFI -> "wifi"
    DownloadManager.PAUSED_WAITING_FOR_NETWORK -> "network"
    DownloadManager.PAUSED_WAITING_TO_RETRY -> "retry"
    else -> "paused"
  }

  private fun Cursor.long(column: String) = getLong(getColumnIndexOrThrow(column))
  private fun Cursor.int(column: String) = getInt(getColumnIndexOrThrow(column))
  private fun Cursor.string(column: String): String? = getString(getColumnIndexOrThrow(column))

  companion object {
    private const val PREFERENCES = "bible-audio-downloads"
    private const val AUDIO_FOLDER = "bible-audio"
    private const val PARTIAL_FOLDER = "bible-audio-partial"
    // SQLite's limit on a query's arguments is 999 on older Androids.
    private const val BATCH = 500
    private const val ORPHAN_AGE_MS = 2 * 60 * 1000L
    // Chapters under way at once: the in-app downloader's CONCURRENT_DOWNLOADS.
    private const val AT_ONCE = 3
    // As the app's FAILURES_TO_STOP.
    private const val FAILURES_TO_PAUSE = 6
    // Waiting chapters' keys, after which comes their place in line. AGAIN
    // sorts before any digit, for one handed over again.
    private const val WAITING_PREFIX = "waiting:"
    private const val AGAIN = "!"
    private const val SEQUENCE = "sequence"
    private const val FAILURES = "failures-in-a-row"
    private val LOCK = Any()
  }
}
