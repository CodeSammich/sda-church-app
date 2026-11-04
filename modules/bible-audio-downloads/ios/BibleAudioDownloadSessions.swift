import ExpoModulesCore
import Foundation
import UIKit

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
///
/// A chapter is kept only at the sizes the app gives
/// (services/BibleAudioDownloadSizes.ts), and never when the server says it's
/// a web page: a Wi-Fi's sign-in page, or a file cut off part way, is deleted,
/// so the app sees the chapter missing and tries it again, rather than kept to
/// fail when played offline. One that grows past its size is stopped while the
/// app is running; iOS downloads in the background without telling the app
/// how far it's got, so one that's too big then is deleted when it ends.
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

  // For a chapter whose size isn't known: the app's MIN_UNKNOWN_CHAPTER_BYTES
  // and MAX_UNKNOWN_CHAPTER_BYTES.
  private static let minUnknownBytes: Int64 = 20_000
  private static let maxUnknownBytes: Int64 = 60_000_000

  /// The sizes a chapter is kept at, and whether they're its recording's.
  struct Sizes {
    let min: Int64
    let max: Int64
    let known: Bool

    init(minBytes: Int64, maxBytes: Int64) {
      known = maxBytes > 0
      min = known ? Swift.max(0, Swift.min(minBytes, maxBytes)) : BibleAudioDownloadSessions.minUnknownBytes
      max = known ? maxBytes : BibleAudioDownloadSessions.maxUnknownBytes
    }

    func fits(_ bytes: Int64) -> Bool { bytes >= min && bytes <= max }

    /// A web page never is the recording, and for a chapter whose size isn't
    /// known, only audio passes. A server that doesn't say is left to the size.
    func allows(_ mimeType: String?) -> Bool {
      guard let type = mimeType?.lowercased(), !type.isEmpty else { return true }
      if type.hasPrefix("text/") { return false }
      return known || type.hasPrefix("audio/") || type == "application/octet-stream"
    }
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
    BibleAudioNotifications.handedOver(groups: Set(downloads.map(\.group).filter { !$0.isEmpty }))
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
        task.taskDescription = [
          download.id,
          String(path.dropFirst(root.count)),
          String(Int64(download.minBytes)),
          String(Int64(download.maxBytes)),
        ].joined(separator: "\n")
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
          guard task.state == .running || task.state == .suspended, case let (id, _, _)? = Self.decode(task) else {
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
      // Nothing left, with the app on screen, whose page said so: no word
      // later. Not when iOS woke the app in the background for the sessions'
      // events, which say so themselves.
      if result.isEmpty, await MainActor.run(body: { UIApplication.shared.applicationState == .active }) {
        BibleAudioNotifications.forget()
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
          if case let (id, _, _)? = Self.decode(task), ids.contains(id) {
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

  // While the app runs: one growing past its size is stopped, so it can't fill
  // the phone. The app sees it missing, and tries it again.
  func urlSession(
    _ session: URLSession,
    downloadTask: URLSessionDownloadTask,
    didWriteData bytesWritten: Int64,
    totalBytesWritten: Int64,
    totalBytesExpectedToWrite: Int64
  ) {
    guard case let (_, _, sizes)? = Self.decode(downloadTask) else { return }
    if Swift.max(totalBytesWritten, totalBytesExpectedToWrite) > sizes.max {
      downloadTask.cancel()
      BibleAudioNotifications.failed()
    }
  }

  func urlSession(_ session: URLSession, downloadTask: URLSessionDownloadTask, didFinishDownloadingTo location: URL) {
    guard case let (id, relative, sizes)? = Self.decode(downloadTask), !stopped.contains(id) else { return }
    if let response = downloadTask.response as? HTTPURLResponse, !(200...299).contains(response.statusCode) {
      BibleAudioNotifications.failed()
      return
    }
    // A Wi-Fi's sign-in page, or a file cut off part way, isn't the recording.
    // iOS deletes the file at `location` once this returns.
    let bytes = (try? FileManager.default.attributesOfItem(atPath: location.path)[.size] as? NSNumber)?.int64Value ?? -1
    guard sizes.allows(downloadTask.response?.mimeType), sizes.fits(bytes) else {
      BibleAudioNotifications.failed()
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

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    // Stopped by the member isn't a failure.
    if let error = error as? URLError, error.code != .cancelled { BibleAudioNotifications.failed() }
  }

  // iOS woke the app for a session's events: once nothing's left, a word that
  // it's done (#610), then iOS may put the app back to sleep.
  func urlSessionDidFinishEvents(forBackgroundURLSession session: URLSession) {
    guard let identifier = session.configuration.identifier else { return }
    let sessions: [URLSession] = [wifi!, anyNetwork!]
    Task {
      var left = 0
      for each in sessions {
        left += await each.allTasks.filter { $0.state == .running || $0.state == .suspended }.count
      }
      if left == 0 { BibleAudioNotifications.finished() }
      DispatchQueue.main.async {
        self.completionHandlers.removeValue(forKey: identifier)?()
      }
    }
  }

  // A task's chapter, its path, and its sizes; a task from before the sizes has none.
  private static func decode(_ task: URLSessionTask) -> (String, String, Sizes)? {
    let parts = task.taskDescription?.components(separatedBy: "\n") ?? []
    guard parts.count == 2 || parts.count == 4 else { return nil }
    let sizes = Sizes(
      minBytes: parts.count == 4 ? Int64(parts[2]) ?? 0 : 0,
      maxBytes: parts.count == 4 ? Int64(parts[3]) ?? 0 : 0
    )
    return (parts[0], parts[1], sizes)
  }
}
