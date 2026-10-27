import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import { Platform } from 'react-native';

/**
 * Copies of things the app can download again, such as the bulletin and today's
 * verse (#524). Apple's file system guide says "Any file that can be re-created
 * or downloaded must be excluded from the backup", and AsyncStorage, which holds
 * the settings and saved verses, is in the phone's backup. So on a phone these
 * copies are files in the cache directory, which neither iCloud nor Android's
 * Auto Backup includes, and which the system may clear. The web has no backups,
 * so there they stay in AsyncStorage (the browser's localStorage).
 *
 * See docs/feature_designs/on_device_storage.md.
 */

export type CachedText = Readonly<{
  /** The folder in the cache directory, such as 'bulletins'. */
  folder: string;
  /** The file's name in that folder, such as '2026-08-08.json'. */
  name: string;
  /** The AsyncStorage key on the web, and the one phones used before #524. */
  key: string;
}>;

const onPhone = () => Platform.OS !== 'web';
const folderOf = (folder: string) => new Directory(Paths.cache, folder);

export const readCachedText = async ({ folder, name, key }: CachedText): Promise<string | null> => {
  if (onPhone()) {
    const file = new File(folderOf(folder), name);
    if (file.exists) return file.text();
  }
  // On a phone, the copy AsyncStorage kept before #524, until it's replaced.
  return AsyncStorage.getItem(key);
};

export const writeCachedText = async ({ folder, name, key }: CachedText, text: string) => {
  if (!onPhone()) return AsyncStorage.setItem(key, text);
  folderOf(folder).create({ intermediates: true, idempotent: true });
  await new File(folderOf(folder), name).write(text);
  // So the copy from before #524 doesn't stay in the backup.
  await AsyncStorage.removeItem(key);
};

/**
 * Deletes the copies `isOld` picks out: in `folder` on a phone, by file name,
 * and on the web, among the keys starting with one of `keyPrefixes`, by the rest
 * of the key. On a phone it also deletes every such key left from before #524.
 */
export const pruneCachedTexts = async (
  folder: string,
  keyPrefixes: readonly string[],
  isOld: (nameOrKeySuffix: string) => boolean,
) => {
  const prefixOf = (key: string) => keyPrefixes.find((prefix) => key.startsWith(prefix));
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => prefixOf(key) !== undefined);
  const remove = onPhone() ? keys : keys.filter((key) => isOld(key.slice(prefixOf(key)!.length)));
  if (remove.length) await AsyncStorage.multiRemove(remove);
  if (onPhone() && folderOf(folder).exists) {
    for (const entry of folderOf(folder).list()) {
      if (entry instanceof File && isOld(entry.name)) entry.delete();
    }
  }
};
