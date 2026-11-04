import ExpoModulesCore

/// One chapter to download: the app's name for it, where from, and the file it
/// becomes; what it's part of, as "English – Souer (BSB)", for its notification.
/// The other sources and the size are for Android's own jobs: an iOS task has
/// one URL, and the app tries the next itself.
struct ChapterDownload: Record {
  @Field var id: String = ""
  @Field var url: String = ""
  @Field var path: String = ""
  @Field var fallbacks: [String] = []
  @Field var group: String = ""
  @Field var bytes: Double = 0
}

/// Bible audio downloads that go on while the iPhone is locked or the app is
/// suspended (#611), on Wi-Fi only unless the member allowed mobile data, and
/// their notifications (#610). See BibleAudioDownloadSessions and
/// BibleAudioNotifications, and modules/bible-audio-downloads/index.ts for the
/// app's side.
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

    // A word when a download is done (#610); the app's page shows its progress.
    Constant("ownNotifications") { true }

    // A task has one source; the app tries the next.
    Constant("triesEverySource") { false }

    AsyncFunction("setNotificationOptions") { (enabled: Bool, text: [String: String]) in
      BibleAudioNotifications.setOptions(enabled: enabled, text: text)
    }

    AsyncFunction("getNotificationPermission") { (promise: Promise) in
      BibleAudioNotifications.permission { promise.resolve($0) }
    }

    AsyncFunction("requestNotificationPermission") { (promise: Promise) in
      BibleAudioNotifications.request { promise.resolve($0) }
    }
  }
}
