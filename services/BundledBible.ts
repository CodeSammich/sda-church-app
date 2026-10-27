import { Asset } from 'expo-asset';
import { File } from 'expo-file-system';
import { Platform } from 'react-native';

import { BUNDLED_BIBLE_ASSETS, type BundledBibleCollection } from '@/assets/bible';

export type { BundledBibleCollection };

/**
 * Reads a Bible text that ships with the app (assets/bible), so it opens with no
 * network: one book per file, plus books.biblejson with each book's name and
 * size. Metro bundles the files as assets (metro.config.js). On a phone the
 * asset is a local file; on the web it is a file on the website.
 *
 * Each file is parsed once and kept in memory, like a book fetched from the
 * network.
 *
 * Nothing is written where iCloud or Android backs it up. On iOS expo-asset
 * reads the file from the app bundle as it is. On Android, where it's inside the
 * APK, expo-asset copies it once into the cache directory, which the system may
 * clear and doesn't back up; the next read copies it again.
 */
const cache = new Map<string, Promise<unknown>>();

export const hasBundledBibleFile = (collection: BundledBibleCollection, name: string) =>
  name in BUNDLED_BIBLE_ASSETS[collection];

export const readBundledBibleFile = <T>(collection: BundledBibleCollection, name: string): Promise<T> => {
  const key = `${collection}/${name}`;
  let request = cache.get(key) as Promise<T> | undefined;
  if (!request) {
    const files = BUNDLED_BIBLE_ASSETS[collection] as Record<string, number>;
    const moduleId = files[name];
    if (moduleId === undefined) {
      return Promise.reject(new Error(`No bundled Bible file ${key}`));
    }
    request = (async () => {
      const asset = Asset.fromModule(moduleId);
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error(`Bundled Bible file ${key}: ${response.status}`);
        return (await response.json()) as T;
      }
      await asset.downloadAsync();
      return JSON.parse(await new File(asset.localUri ?? asset.uri).text()) as T;
    })();
    cache.set(key, request);
    request.catch(() => cache.delete(key));
  }
  return request;
};
