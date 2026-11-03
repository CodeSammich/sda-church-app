import ExpoModulesCore

/// One chapter to download: the app's name for it, where from, and the file it becomes.
struct ChapterDownload: Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var path: String = ""
}

/// Bible audio downloads that go on while the iPhone is locked or the app is
/// suspended (#611), on Wi-Fi only unless the member allowed mobile data. See
/// BibleAudioDownloadSessions, and modules/bible-audio-downloads/index.ts for
/// the app's side.
///
/// Custom code, to remove once Expo can do it (#612): Expo SDK 58's
/// DownloadTask has no Wi-Fi-only setting for its background session.
public class BibleAudioDownloadsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BibleAudioDownloads")

    AsyncFunction("enqueue") { (downloads: [ChapterDownload], allowMobileData: Bool, promise: Promise) in
      BibleAudioDownloadSessions.shared.enqueue(downloads, allowMobileData: allowMobileData) { promise.resolve(nil) }
    }

    AsyncFunction("list") { (promise: Promise) in
      BibleAudioDownloadSessions.shared.list { promise.resolve($0) }
    }

    AsyncFunction("cancel") { (ids: [String], promise: Promise) in
      BibleAudioDownloadSessions.shared.cancel(Set(ids)) { promise.resolve(nil) }
    }
  }
}
