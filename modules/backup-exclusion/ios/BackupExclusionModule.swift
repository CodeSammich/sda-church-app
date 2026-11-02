import ExpoModulesCore

/// Keeps a file or folder out of the iPhone's iCloud and computer backups
/// (#556). Apple's File System Programming Guide: "If your application
/// downloads video or audio files, make sure they are not included in the
/// backup." expo-file-system can't set this, so the app's downloaded Bible
/// audio, in the Documents folder where the phone doesn't clear it, needs it.
public class BackupExclusionModule: Module {
  public func definition() -> ModuleDefinition {
    Name("BackupExclusion")

    // Sets the flag, then reads it back, so the app knows it held.
    Function("excludeFromBackup") { (uri: String) -> Bool in
      guard var url = URL(string: uri), url.isFileURL else {
        return false
      }
      var values = URLResourceValues()
      values.isExcludedFromBackup = true
      try url.setResourceValues(values)
      url.removeAllCachedResourceValues()
      return try url.resourceValues(forKeys: [.isExcludedFromBackupKey]).isExcludedFromBackup == true
    }
  }
}
