import Foundation
import UIKit
import UserNotifications

/// The notice of a week's announcements on the iPhone (#709): one a Sabbath at
/// most, for the member's location, in the app's language, and only after the
/// member turned it on. The app works out what it says and when
/// (services/AnnouncementNotifications.ts), and hands it over here. It's made on
/// the phone; nothing is sent anywhere.
///
/// iOS posts it at its time, even with the app closed, and keeps it through a
/// restart. It makes no sound: the app asks only to show notifications. iOS has
/// no switch for one kind of the app's notifications, so the app's own switch
/// is that. One waits at a time, under one identifier, so a new week's takes
/// the place of the last, and the ids posted are kept, so a Sabbath's notice is
/// never posted twice. iOS runs no code when it posts one, so a waiting notice
/// whose time has passed, and that iOS no longer holds, counts as posted.
enum AnnouncementNotifications {
  static let requestIdentifier = "org.nyccsda.announcements.notice"
  private static let pendingKey = "org.nyccsda.announcements.pending"
  private static let postedKey = "org.nyccsda.announcements.posted"
  private static let keepPosted = 8
  private static let lock = NSLock()

  static func permission(_ done: @escaping ([String: Any]) -> Void) {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      done(status(settings.authorizationStatus))
    }
  }

  /// Asks, if iOS still lets the app ask: only once, ever. Only to show them,
  /// as for a download's word (BibleAudioNotifications): no sound, no badge.
  static func request(_ done: @escaping ([String: Any]) -> Void) {
    UNUserNotificationCenter.current().requestAuthorization(options: [.alert]) { _, _ in
      permission(done)
    }
  }

  /// Sets the notice to post at its time, in place of any waiting, or posts it
  /// now if its time has come. Nothing, if it was posted already.
  static func schedule(_ notice: AnnouncementNotice, _ done: @escaping (String) -> Void) {
    settle { posted in
      if posted.contains(notice.id) { return done("posted") }
      let center = UNUserNotificationCenter.current()
      center.getNotificationSettings { settings in
        guard settings.authorizationStatus == .authorized || settings.authorizationStatus == .provisional else {
          return done("not-allowed")
        }
        let content = UNMutableNotificationContent()
        content.title = notice.title
        content.body = notice.body
        content.userInfo = ["url": notice.url, "id": notice.id]
        let wait = notice.at / 1000 - Date().timeIntervalSince1970
        let trigger = wait > 1 ? UNTimeIntervalNotificationTrigger(timeInterval: wait, repeats: false) : nil
        center.add(UNNotificationRequest(identifier: requestIdentifier, content: content, trigger: trigger)) { error in
          if error != nil { return done("not-allowed") }
          if trigger == nil {
            clearPending()
            record(notice.id)
            return done("posted")
          }
          lock.lock()
          UserDefaults.standard.set(["id": notice.id, "at": notice.at], forKey: pendingKey)
          lock.unlock()
          done("scheduled")
        }
      }
    }
  }

  /// The waiting notice goes, as when the announcement was taken out. One already posted stays.
  static func cancel(_ done: @escaping () -> Void) {
    settle { _ in
      UNUserNotificationCenter.current().removePendingNotificationRequests(withIdentifiers: [requestIdentifier])
      clearPending()
      done()
    }
  }

  /// The ids of the last few notices posted, newest last.
  static func posted(_ done: @escaping ([String]) -> Void) {
    settle(done)
  }

  /// A tap on it, or iOS showing it with the app open: it was posted.
  static func shown(_ id: String) {
    lock.lock()
    let pending = UserDefaults.standard.dictionary(forKey: pendingKey)
    lock.unlock()
    if pending?["id"] as? String == id { clearPending() }
    record(id)
  }

  /// A waiting notice whose time has passed, and that iOS no longer holds, was posted.
  private static func settle(_ done: @escaping ([String]) -> Void) {
    lock.lock()
    let pending = UserDefaults.standard.dictionary(forKey: pendingKey)
    lock.unlock()
    guard let id = pending?["id"] as? String, let at = pending?["at"] as? Double,
      at / 1000 <= Date().timeIntervalSince1970
    else {
      return done(postedIds())
    }
    UNUserNotificationCenter.current().getPendingNotificationRequests { requests in
      if !requests.contains(where: { $0.identifier == requestIdentifier }) {
        clearPending()
        record(id)
      }
      done(postedIds())
    }
  }

  private static func clearPending() {
    lock.lock()
    UserDefaults.standard.removeObject(forKey: pendingKey)
    lock.unlock()
  }

  private static func record(_ id: String) {
    lock.lock()
    defer { lock.unlock() }
    var ids = (UserDefaults.standard.stringArray(forKey: postedKey) ?? []).filter { $0 != id }
    ids.append(id)
    UserDefaults.standard.set(Array(ids.suffix(keepPosted)), forKey: postedKey)
  }

  private static func postedIds() -> [String] {
    lock.lock()
    defer { lock.unlock() }
    return UserDefaults.standard.stringArray(forKey: postedKey) ?? []
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
