import AsyncStorage from '@react-native-async-storage/async-storage';

// The web has no backups, so its copies stay in AsyncStorage, the browser's
// localStorage (#524). It must never reach for the phone's file system.
jest.mock('expo-file-system', () => {
  const unused = () => {
    throw new Error('The web build used expo-file-system');
  };
  return { Directory: jest.fn(unused), File: jest.fn(unused), Paths: {} };
});

import { pruneCachedTexts, readCachedText, writeCachedText } from '@/services/CacheStore';

const bulletin = (date: string) => ({ folder: 'bulletins', name: `${date}.json`, key: `bulletin-cache-v2:${date}` });

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('cached copies on the web', () => {
  it('are AsyncStorage keys', async () => {
    await writeCachedText(bulletin('2026-08-08'), 'copy');

    expect(await AsyncStorage.getItem('bulletin-cache-v2:2026-08-08')).toBe('copy');
    expect(await readCachedText(bulletin('2026-08-08'))).toBe('copy');
  });

  it('prune by the rest of the key, and leave other keys alone', async () => {
    await writeCachedText(bulletin('2026-07-18'), 'old');
    await writeCachedText(bulletin('2026-08-08'), 'new');
    await AsyncStorage.setItem('user-language', 'en');

    await pruneCachedTexts('bulletins', ['bulletin-cache-v2:'], (date) => date < '2026-08-01');

    expect([...(await AsyncStorage.getAllKeys())].sort()).toEqual(['bulletin-cache-v2:2026-08-08', 'user-language']);
  });
});
