import ExpoModulesCore

/// Hands BibleAudioDownloadSessions the events iOS wakes the app with, when
/// Bible audio finishes downloading while the app is suspended or closed
/// (#611). Custom code, to remove once Expo can do it (#612).
public final class BibleAudioDownloadsAppDelegate: ExpoAppDelegateSubscriber {
  #if os(iOS)
  public func application(
    _ application: UIApplication,
    handleEventsForBackgroundURLSession identifier: String,
    completionHandler: @escaping () -> Void
  ) {
    BibleAudioDownloadSessions.shared.handleEvents(forSession: identifier, completionHandler: completionHandler)
  }
  #endif
}
