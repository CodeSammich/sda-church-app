import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// What the phone's own backup keeps (#524; docs/feature_designs/on_device_storage.md):
// the settings and saved verses in AsyncStorage, which members can't get back
// otherwise, but not copies the app can download again, which go in the cache
// directory instead.
const app = JSON.parse(readFileSync(join(process.cwd(), 'app.json'), 'utf8')).expo;

describe('device backups', () => {
  it('include AsyncStorage on iPhone, which it otherwise leaves out', () => {
    expect(app.ios.infoPlist.RCTAsyncStorageExcludeFromBackup).toBe(false);
  });

  it("keep Android's Auto Backup on, set explicitly as Google recommends", () => {
    expect(app.android.allowBackup).toBe(true);
  });

  it('leave out the copies the app can download again, which go through services/CacheStore.ts', () => {
    const source = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');
    expect(source('services/CacheStore.ts')).toContain('new Directory(Paths.cache, folder)');
    for (const file of ['services/BulletinService.ts', 'app/(tabs)/index.tsx']) {
      expect([file, source(file).includes("from '@/services/CacheStore'"), /\bAsyncStorage\b/.test(source(file))]).toEqual([file, true, false]);
    }
  });
});
