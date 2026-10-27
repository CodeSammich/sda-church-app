import AsyncStorage from '@react-native-async-storage/async-storage';

import { pruneCachedTexts, readCachedText, writeCachedText } from '@/services/CacheStore';
import { mockFiles } from './helpers/file-system-mock';

// On a phone, copies the app can download again are files in the cache
// directory, out of the backup that includes AsyncStorage (#524).
// test/cache-store.web.test.ts tests the web.
const verse = { folder: 'verse-of-the-day', name: 'en.json', key: 'votd_cache_en' };

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('cached copies on a phone', () => {
  it('are files in the cache directory, not AsyncStorage', async () => {
    await writeCachedText(verse, '{"text":"In the beginning"}');

    expect([...mockFiles.entries()]).toEqual([['cache/verse-of-the-day/en.json', '{"text":"In the beginning"}']]);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await readCachedText(verse)).toBe('{"text":"In the beginning"}');
  });

  it('read the copy AsyncStorage kept before #524 until a new one is saved, then delete it', async () => {
    await AsyncStorage.setItem('votd_cache_en', 'old');
    expect(await readCachedText(verse)).toBe('old');

    await writeCachedText(verse, 'new');
    expect(await readCachedText(verse)).toBe('new');
    expect(await AsyncStorage.getItem('votd_cache_en')).toBeNull();
  });

  it('have nothing to read before the first is saved', async () => {
    expect(await readCachedText(verse)).toBeNull();
  });

  it('prune the files picked out, and every old AsyncStorage copy', async () => {
    for (const name of ['2026-07-18.json', '2026-08-08.json']) {
      await writeCachedText({ folder: 'bulletins', name, key: `bulletin-cache-v2:${name}` }, name);
    }
    await AsyncStorage.multiSet([
      ['bulletin-cache-v2:2026-08-08', 'from before #524'],
      ['user-language', 'en'],
    ]);

    await pruneCachedTexts('bulletins', ['bulletin-cache-v2:'], (name) => name < '2026-08-01');

    expect([...mockFiles.keys()]).toEqual(['cache/bulletins/2026-08-08.json']);
    expect(await AsyncStorage.getAllKeys()).toEqual(['user-language']);
  });
});
