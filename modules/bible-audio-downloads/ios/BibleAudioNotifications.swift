import Foundation
import UIKit
import UserNotifications

/// The app's notifications for Bible audio downloads on the iPhone (#610), its
/// first: a word when a download finishes while the app is out of sight, or
/// that it couldn't. Only for a download the member started, and only with the
/// member's leave: the app asks the first time a long download starts, never at
/// launch, and You → Download notifications turns them off.
///
/// iOS shows no progress for a background download, and wakes the app only
/// when a session's tasks are done (BibleAudioDownloadSessions), so there's no
/// progress or "waiting for Wi-Fi" here: the app's page shows those. The words
/// are the app's, in its language, handed over by the app. They're made on the
/// phone; nothing is sent anywhere.
///
/// Custom code, to remove once Expo can do it (#612).
enum BibleAudioNotifications {
  private static let optionsKey = "org.nyccsda.bible-audio.notification-options"
  private static let groupsKey = "org.nyccsda.bible-audio.notification-groups"
  private static let failedKey = "org.nyccsda.bible-audio.notification-failed"
  private static let lock = NSLock()

  static func setOptions(enabled: Bool, text: [String: String]) {
    UserDefaults.standard.set(["enabled": enabled, "text": text], forKey: optionsKey)
  }

  static func permission(_ done: @escaping ([String: Any]) -> Void) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      done(status(settings.authorizationStatus))
    }
  }

  /// Asks, if iOS still lets the app ask: only once, ever.
  static func request(_ done: @escaping ([String: Any]) -> Void) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert]) { _, _ in
      permission(done)
    }
  }

  /// What a download is part of, as "English – Souer (BSB)", for its word when it's done.
  static func handedOver(groups: Set<String>) {
    guard !groups.isEmpty else { return }
    lock.lock()
    defer { lock.unlock() }
    let known = Set(UserDefaults.standard.stringArray(forKey: groupsKey) ?? [])
    UserDefaults.standard.set(Array(known.union(groups)), forKey: groupsKey)
  }

  /// A chapter that couldn't download: the word says so.
  static func failed() {
    UserDefaults.standard.set(true, forKey: failedKey)
  }

  /// Nothing left, with the app on screen: its page said so.
  static func forget() {
    lock.lock()
    defer { lock.unlock() }
    UserDefaults.standard.removeObject(forKey: groupsKey)
    UserDefaults.standard.removeObject(forKey: failedKey)
  }

  /// When iOS woke the app for the sessions' events, and nothing's left:
  /// done, or couldn't, if the member wants them and the app's out of sight.
  static func finished() {
    lock.lock()
    let groups = (UserDefaults.standard.stringArray(forKey: groupsKey) ?? []).sorted()
    let failed = UserDefaults.standard.bool(forKey: failedKey)
    lock.unlock()
    forget()
    let options = UserDefaults.standard.dictionary(forKey: optionsKey) ?? [:]
    guard !groups.isEmpty, (options["enabled"] as? Bool) ?? true else { return }
    let text = options["text"] as? [String: String] ?? [:]
    DispatchQueue.main.async {
      guard UIApplication.shared.applicationState != .active else { return }
      let content = UNMutableNotificationContent()
      content.title = groups.joined(separator: " · ")
      content.body = failed
        ? text["stopped"] ?? "Couldn’t download. Open the app to try again."
        : text["done"] ?? "Downloaded"
      UNUserNotificationCenter.current().add(
        UNNotificationRequest(identifier: "org.nyccsda.bible-audio.download", content: content, trigger: nil)
      )
    }
  }

  private static func status(_ status: UNAuthorizationStatus) -> [String: Any] {
    switch status {
    case .notDetermined:
      return ["status": "undetermined", "granted": false, "canAskAgain": true, "expires": "never"]
    case .denied:
      return ["status": "denied", "granted": false, "canAskAgain": false, "expires": "never"]
    default:
      return ["status": "granted", "granted": true, "canAskAgain": false, "expires": "never"]
    }
  }
}
