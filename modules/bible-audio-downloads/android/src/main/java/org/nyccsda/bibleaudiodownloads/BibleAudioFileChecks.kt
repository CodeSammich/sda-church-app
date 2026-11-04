package org.nyccsda.bibleaudiodownloads

/**
 * Whether a downloaded chapter is the recording, for both of Android's
 * downloaders: the sizes it's kept at come from the app
 * (services/BibleAudioDownloadSizes.ts), as ChapterDownload's minBytes and
 * maxBytes. A Wi-Fi's sign-in page, answered as if it were the file, or a file
 * cut off part way, is deleted and fails, so the app tries it again, rather
 * than kept to fail when played offline. One that grows past maxBytes is
 * stopped then, so a host that sends something endless can't fill the phone.
 *
 * Custom code, to remove once Expo can do it (#612).
 */
internal data class ChapterSizes(val min: Long, val max: Long, val known: Boolean) {
  fun fits(bytes: Long) = bytes in min..max

  /**
   * Whether the server's Content-Type may be the recording: a web page never
   * is, and for a chapter whose size isn't known, only audio passes. A
   * server that doesn't say is left to the size.
   */
  fun allows(contentType: String?): Boolean {
    val type = contentType?.substringBefore(';')?.trim()?.lowercase()
    if (type.isNullOrEmpty()) return true
    if (type.startsWith("text/")) return false
    return known || type.startsWith("audio/") || type == "application/octet-stream"
  }

  companion object {
    // As the app's MIN_UNKNOWN_CHAPTER_BYTES and MAX_UNKNOWN_CHAPTER_BYTES.
    private const val MIN_UNKNOWN_BYTES = 20_000L
    private const val MAX_UNKNOWN_BYTES = 60_000_000L

    /** Zero, from the app or from a chapter queued before it said, for a size not known. */
    fun of(minBytes: Long, maxBytes: Long) =
      if (maxBytes > 0) ChapterSizes(minBytes.coerceIn(0, maxBytes), maxBytes, true)
      else ChapterSizes(MIN_UNKNOWN_BYTES, MAX_UNKNOWN_BYTES, false)
  }
}
