import ExpoModulesCore
import UIKit

/// The notice of a week's announcements: what it says, the link a tap opens,
/// when to post it, and when it's too late, in milliseconds since 1970. iOS
/// posts it on time, so `until` is for Android's alarms, which can come late.
struct AnnouncementNotice: Record {
  @Field var id: String = ""
  @Field var title: String = ""
  @Field var body: String = ""
  @Field var url: String = ""
  @Field var at: Double = 0
  @Field var until: Double = 0
}

/// The notice of a week's announcements (#709), made on the iPhone. See
/// AnnouncementNotifications, and modules/announcement-notifications/index.ts
/// for the app's side.
public class AnnouncementNotificationsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AnnouncementNotifications")

    Constant("available") { true }

    // Android's channel; iOS has none.
    AsyncFunction("setChannel") { (_: String, _: String) in }

    AsyncFunction("getPermission") { (promise: Promise) in
      AnnouncementNotifications.permission { promise.resolve($0) }
    }

    AsyncFunction("requestPermission") { (promise: Promise) in
      AnnouncementNotifications.request { promise.resolve($0) }
    }

    // iOS has no switch for one kind of the app's notifications.
    AsyncFunction("isChannelOn") { true }

    AsyncFunction("schedule") { (notice: AnnouncementNotice, promise: Promise) in
      AnnouncementNotifications.schedule(notice) { promise.resolve($0) }
    }

    AsyncFunction("cancel") { (promise: Promise) in
      AnnouncementNotifications.cancel { promise.resolve(nil) }
    }

    AsyncFunction("getPosted") { (promise: Promise) in
      AnnouncementNotifications.posted { promise.resolve($0) }
    }

    // The app's notification settings in iOS's Settings.
    AsyncFunction("openSettings") { () in
      if let url = URL(string: UIApplication.openNotificationSettingsURLString) {
        UIApplication.shared.open(url)
      }
    }.runOnQueue(.main)
  }
}
