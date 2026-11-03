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
 */
internal class BibleAudioDownloadStore(private val context: Context) {
  private val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
  private val tracked = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

  // A chapter handed over: the app's name for it, the file it becomes, whether
  // it may use mobile data, and where DownloadManager writes it meanwhile.
  private data class Entry(val id: String, val path: String, val mobileData: Boolean, val partial: String)

  fun enqueue(downloads: List<ChapterDownload>, allowMobileData: Boolean) = synchronized(LOCK) {
    val partial = File(context.getExternalFilesDir(null) ?: return@synchronized, PARTIAL_FOLDER)
    partial.mkdirs()
    cancelLocked(downloads.map { it.id }.toSet())
    val editor = tracked.edit()
    val title = context.applicationInfo.loadLabel(context.packageManager)
    for (download in downloads) {
      val target = targetFile(download.path) ?: continue
      val name = "${System.nanoTime()}.part"
      val request = DownloadManager.Request(Uri.parse(download.url))
        .setDestinationInExternalFilesDir(context, null, "$PARTIAL_FOLDER/$name")
        .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE)
        .setTitle(title)
        .setAllowedOverMetered(allowMobileData)
        .setAllowedOverRoaming(allowMobileData)
      if (!allowMobileData) request.setAllowedNetworkTypes(DownloadManager.Request.NETWORK_WIFI)
      val downloadId = manager.enqueue(request)
      editor.putString(downloadId.toString(), encode(Entry(download.id, target.path, allowMobileData, File(partial, name).path)))
    }
    editor.commit()
  }

  /** The chapters still downloading or waiting. Finished ones are moved into place first, and left out. */
  fun list(): List<Map<String, Any?>> = synchronized(LOCK) {
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
    result
  }

  /** Stops chapters downloading, and forgets them, so none is moved into place afterwards. */
  fun cancel(ids: Set<String>) = synchronized(LOCK) { cancelLocked(ids) }

  /** For BibleAudioDownloadReceiver: moves a finished chapter into place. */
  fun complete(downloadId: Long) = synchronized(LOCK) {
    val entry = entries()[downloadId] ?: return@synchronized
    manager.query(DownloadManager.Query().setFilterById(downloadId))?.use { cursor ->
      if (cursor.moveToFirst() && cursor.int(DownloadManager.COLUMN_STATUS) == DownloadManager.STATUS_SUCCESSFUL) {
        finishLocked(downloadId, entry, cursor)
      }
    }
  }

  private fun cancelLocked(ids: Set<String>) {
    if (ids.isEmpty()) return
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
    tracked.edit().remove(downloadId.toString()).commit()
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
    private val LOCK = Any()
  }
}
