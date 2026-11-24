import ExpoModulesCore
import UserNotifications

/// Takes the app's notifications as iOS hands them over (#709): the
/// announcements notice shows even with the app open, and a tap on it opens the
/// bulletin. iOS wants this set before the app finishes launching, so a tap
/// that opened the app arrives.
public final class AnnouncementNotificationsAppDelegate: ExpoAppDelegateSubscriber {
  #if os(iOS)
  public func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let center = UNUserNotificationCenter.current()
    if center.delegate == nil { center.delegate = AnnouncementNotificationCenterDelegate.shared }
    return true
  }
  #endif
}

final class AnnouncementNotificationCenterDelegate: NSObject, UNUserNotificationCenterDelegate {
  static let shared = AnnouncementNotificationCenterDelegate()

  // The notice shows even with the app open, when its time comes. A download's
  // word is posted only with the app out of sight, as its page shows the rest.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) {
    guard notification.request.identifier == AnnouncementNotifications.requestIdentifier else {
      return completionHandler([])
    }
    if let id = notification.request.content.userInfo["id"] as? String { AnnouncementNotifications.shown(id) }
    completionHandler([.banner, .list])
  }

  // A tap opens the bulletin through the app's own link, as the verse widget's
  // does: the app handles it as any link that opens it, and Expo Router reads
  // it, even when the tap started the app. A tap on a download's word just
  // opens the app.
  func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    let content = response.notification.request.content
    guard response.notification.request.identifier == AnnouncementNotifications.requestIdentifier,
      response.actionIdentifier == UNNotificationDefaultActionIdentifier,
      let link = content.userInfo["url"] as? String, let url = URL(string: link)
    else {
      return completionHandler()
    }
    if let id = content.userInfo["id"] as? String { AnnouncementNotifications.shown(id) }
    DispatchQueue.main.async {
      let app = UIApplication.shared
      _ = app.delegate?.application?(app, open: url, options: [:])
      completionHandler()
    }
  }
}
