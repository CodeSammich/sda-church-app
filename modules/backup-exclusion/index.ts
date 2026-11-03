import { requireOptionalNativeModule } from 'expo';

/**
 * Keeps a downloaded file or folder out of the iPhone's iCloud and computer
 * backups (#556), with ios/BackupExclusionModule.swift. Returns whether the
 * flag is set: false on Android and the web, which don't have the module
 * (Android leaves the files out with backup rules; see
 * plugins/withAndroidBackupRules.js), and false if it couldn't be set.
 */
type BackupExclusionModule = { excludeFromBackup(uri: string): boolean };

const native = requireOptionalNativeModule<BackupExclusionModule>('BackupExclusion');

export const excludeFromBackup = (uri: string): boolean => {
  try {
    return native?.excludeFromBackup(uri) === true;
  } catch {
    return false;
  }
};
