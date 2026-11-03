import Foundation

/// Bible audio chapters handed to two background URLSessions (#611), which
/// iOS keeps downloading while the iPhone is locked or the app is suspended.
///
/// Custom code, to remove once Expo can do it (#612): Expo SDK 58's
/// DownloadTask has a background session, but no Wi-Fi-only setting, so
/// with the phone locked it would carry on over mobile data when Wi-Fi drops.
///
/// One session is Wi-Fi only: no cellular and no expensive networks, so a
/// phone's hotspot, someone's data plan, waits too. The other may use any
/// network, for downloads the member allowed on mobile data. Both are set on
/// the session, which a request can't loosen.
///
/// Each finished chapter is moved straight into the app's Documents folder,
/// at the path the app asked for, and kept out of the iPhone's backups, with
/// or without the app's JavaScript running. The app finds it there.
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
    configuration.isDiscretionary = false
    configuration.sessionSendsLaunchEvents = true
    configuration.requestCachePolicy = .reloadIgnoringLocalCacheData
    configuration.urlCache = nil
    return URLSession(configuration: configuration, delegate: self, delegateQueue: queue)
  }

  private var audioRoot: URL {
    FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("bible-audio", isDirectory: true)
      .resolvingSymlinksInPath()
  }

  func enqueue(_ downloads: [ChapterDownload], allowMobileData: Bool) {
    let session: URLSession = allowMobileData ? anyNetwork! : wifi!
    let ids = Set(downloads.map(\.id))
    queue.addOperation { self.stopped.subtract(ids) }
    for download in downloads {
      guard let source = URL(string: download.url), let target = URL(string: download.path), target.isFileURL else {
        continue
      }
      let task = session.downloadTask(with: URLRequest(url: source))
      task.taskDescription = [download.id, target.path].joined(separator: "\n")
      task.resume()
    }
  }

  /// The chapters still downloading or waiting, from both sessions.
  func list(_ done: @escaping ([[String: Any]]) -> Void) {
    let group = DispatchGroup()
    let lock = NSLock()
    var result: [[String: Any]] = []
    for (session, mobileData) in [(wifi!, false), (anyNetwork!, true)] {
      group.enter()
      session.getAllTasks { tasks in
        let entries: [[String: Any]] = tasks.compactMap { task in
          guard task.state == .running || task.state == .suspended, case let (id, _)? = Self.decode(task) else {
            return nil
          }
          return [
            "id": id,
            // iOS doesn't say why one waits; the app knows the network.
            "state": task.countOfBytesReceived > 0 ? "running" : "waiting",
            "reason": NSNull(),
            "bytesWritten": task.countOfBytesReceived,
            "totalBytes": task.countOfBytesExpectedToReceive,
            "mobileData": mobileData,
          ]
        }
        lock.lock()
        result += entries
        lock.unlock()
        group.leave()
      }
    }
    group.notify(queue: .main) { done(result) }
  }

  /// Stops chapters downloading, so none is moved into place afterwards.
  func cancel(_ ids: Set<String>, done: @escaping () -> Void) {
    queue.addOperation { self.stopped.formUnion(ids) }
    let group = DispatchGroup()
    for session in [wifi!, anyNetwork!] {
      group.enter()
      session.getAllTasks { tasks in
        for task in tasks {
          if case let (id, _)? = Self.decode(task), ids.contains(id) {
            task.cancel()
          }
        }
        group.leave()
      }
    }
    group.notify(queue: .main, execute: done)
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
    guard case let (id, path)? = Self.decode(downloadTask), !stopped.contains(id) else { return }
    if let response = downloadTask.response as? HTTPURLResponse, !(200...299).contains(response.statusCode) {
      return
    }
    let target = URL(fileURLWithPath: path).resolvingSymlinksInPath()
    // Only into the app's own Bible audio folder.
    guard target.path.hasPrefix(audioRoot.path + "/") else { return }
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
