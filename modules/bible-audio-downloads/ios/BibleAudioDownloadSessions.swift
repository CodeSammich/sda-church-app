import ExpoModulesCore
import Foundation

/// Bible audio chapters handed to two background URLSessions (#611), which
/// iOS keeps downloading while the iPhone is locked or the app is suspended.
///
/// Custom code, to remove once Expo can do it (#612): Expo SDK 58's
/// DownloadTask has a background session, but no Wi-Fi-only setting, so
/// with the phone locked it would carry on over mobile data when Wi-Fi drops.
///
/// One session is Wi-Fi only: no cellular, no expensive networks, so a
/// phone's hotspot, someone's data plan, waits too, and no Wi-Fi the member
/// set to Low Data Mode. The other may use any network, for downloads the
/// member allowed on mobile data. Both are set on the session, which a request
/// can't loosen.
///
/// Each finished chapter is moved straight into the app's Documents folder,
/// at the path the app asked for, and kept out of the iPhone's backups, with
/// or without the app's JavaScript running. The app finds it there. A task
/// keeps its path relative to the Bible audio folder, as an app update may
/// move the app's folders while a download goes on.
final class BibleAudioDownloadSessions: NSObject, URLSessionDownloadDelegate {
  static let shared = BibleAudioDownloadSessions()

  private static let prefix = Bundle.main.bundleIdentifier ?? "org.nyccsda.app"
  static let wifiIdentifier = "\(prefix).bible-audio.wifi"
  static let anyNetworkIdentifier = "\(prefix).bible-audio.any-network"

  // Delegate callbacks, and `stopped`, run on this one queue in turn.
  private let queue: OperationQueue = {
    let queue = OperationQueue()
    queue.maxConcurrentOperationCount = 1
    return queue
  }()
  // Chapters stopped or deleted: a download finishing just then is dropped.
  private var stopped = Set<String>()
  // iOS's handlers for waking the app with a session's events; main thread only.
  private var completionHandlers: [String: () -> Void] = [:]

  // Made once, when the app first needs them, as iOS wants one session for
  // each identifier.
  private var wifi: URLSession!
  private var anyNetwork: URLSession!

  override private init() {
    super.init()
    wifi = makeSession(identifier: Self.wifiIdentifier, anyNetwork: false)
    anyNetwork = makeSession(identifier: Self.anyNetworkIdentifier, anyNetwork: true)
  }

  private func makeSession(identifier: String, anyNetwork: Bool) -> URLSession {
    let configuration = URLSessionConfiguration.background(withIdentifier: identifier)
    configuration.allowsCellularAccess = anyNetwork
    configuration.allowsExpensiveNetworkAccess = anyNetwork
    configuration.allowsConstrainedNetworkAccess = anyNetwork
    configuration.isDiscretionary = false
    // Three chapters at a time from each host, as the in-app downloader
    // (CONCURRENT_DOWNLOADS): one mirror is a small ministry's own server.
    configuration.httpMaximumConnectionsPerHost = 3
    configuration.sessionSendsLaunchEvents = true
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.urlCache = nil
    return URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
  }

  private var audioRoot: URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("bible-audio", isDirectory: true)
  }

  // A path to compare with another: /var is /private/var on iOS, and the app
  // and FileManager may name the same folder either way.
  private static func comparable(_ url: URL) -> String {
    let path = url.standardizedFileURL.path
    return path.hasPrefix("/private/") ? String(path.dropFirst("/private".count)) : path
  }

  /// Starts the chapters, in place of any already downloading under the same
  /// names, as when the member allows mobile data for ones waiting for Wi-Fi.
  func enqueue(_ downloads: [ChapterDownload], allowMobileData: Bool, done: @escaping () -> Void) {
    let session: URLSession = allowMobileData ? anyNetwork! : wifi!
    let root = Self.comparable(audioRoot) + "/"
    let ids = Set(downloads.map(\.id))
    cancelTasks(ids) {
      self.queue.addOperation { self.stopped.subtract(ids) }
      for download in downloads {
        guard let source = URL(string: download.url), let target = URL(string: download.path), target.isFileURL else {
          continue
        }
        // Only into the app's own Bible audio folder.
        let path = Self.comparable(target)
        guard path.hasPrefix(root) else { continue }
        let task = session.downloadTask(with: URLRequest(url: source))
        task.taskDescription = [download.id, String(path.dropFirst(root.count))].joined(separator: "\n")
        task.resume()
      }
      done()
    }
  }

  /// The chapters still downloading or waiting, from both sessions.
  func list(_ done: @escaping ([[String: Any]]) -> Void) {
    let sessions: [(URLSession, Bool)] = [(wifi!, false), (anyNetwork!, true)]
    Task {
      var result: [[String: Any]] = []
      for (session, mobileData) in sessions {
        for task in await session.allTasks {
          guard task.state == .running || task.state == .suspended, case let (id, _)? = Self.decode(task) else {
            continue
          }
          // iOS doesn't say why one waits, so there's no "reason": the app knows the network.
          result.append([
            "id": id,
            "state": task.countOfBytesReceived > 0 ? "running" : "waiting",
            "bytesWritten": task.countOfBytesReceived,
            "totalBytes": task.countOfBytesExpectedToReceive,
            "mobileData": mobileData,
          ])
        }
      }
      done(result)
    }
  }

  /// Stops chapters downloading, so none is moved into place afterwards.
  func cancel(_ ids: Set<String>, done: @escaping () -> Void) {
    queue.addOperation { self.stopped.formUnion(ids) }
    cancelTasks(ids, done: done)
  }

  private func cancelTasks(_ ids: Set<String>, done: @escaping () -> Void) {
    let sessions: [URLSession] = [wifi!, anyNetwork!]
    Task {
      for session in sessions {
        for task in await session.allTasks {
          if case let (id, _)? = Self.decode(task), ids.contains(id) {
            task.cancel()
          }
        }
      }
      done()
    }
  }

  /// From the app delegate, when iOS wakes the app to finish a session's work.
  func handleEvents(forSession identifier: String, completionHandler: @escaping () -> Void) {
    guard identifier == Self.wifiIdentifier || identifier == Self.anyNetworkIdentifier else { return }
    // Reaching `shared` made the sessions, which lets iOS hand them their events.
    DispatchQueue.main.async {
      self.completionHandlers[identifier] = completionHandler
    }
  }

  // MARK: - URLSessionDownloadDelegate

  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    guard case let (id, relative)? = Self.decode(downloadTask), !stopped.contains(id) else { return }
    if let response = downloadTask.response as? HTTPURLResponse, !(200...299).contains(response.statusCode) {
      return
    }
    // Only into the app's own Bible audio folder.
    guard !relative.isEmpty, !relative.split(separator: "/").contains("..") else { return }
    let target = audioRoot.appendingPathComponent(relative)
    let manager = FileManager.default
    do {
      try manager.createDirectory(at: target.deletingLastPathComponent(), withIntermediateDirectories: true)
      if manager.fileExists(atPath: target.path) {
        try manager.removeItem(at: target)
      }
      try manager.moveItem(at: location, to: target)
      var url = target
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
    } catch {
      // The app sees the chapter missing, and downloads it again.
      try? manager.removeItem(at: target)
    }
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {}

  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    guard let identifier = session.configuration.identifier else { return }
    DispatchQueue.main.async {
      self.completionHandlers.removeValue(forKey: identifier)?()
    }
  }

  private static func decode(_ task: URLSessionTask) -> (String, String)? {
    let parts = task.taskDescription?.components(separatedBy: "\n") ?? []
    return parts.count == 2 ? (parts[0], parts[1]) : nil
  }
}
