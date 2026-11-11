import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createContext, runInContext } from 'node:vm';

import { mockFiles } from './helpers/file-system-mock';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.8.0' } },
}));

type BulletinServiceModule = typeof import('@/services/BulletinService');

const repoFile = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

// BulletinService.ts decides at load whether it's a key-screens build, as the
// app does when Metro bundles it, so each test loads its own copy.
const loadBulletinService = (keyScreens: boolean): BulletinServiceModule => {
  if (keyScreens) process.env.EXPO_PUBLIC_KEY_SCREENS = '1';
  else delete process.env.EXPO_PUBLIC_KEY_SCREENS;
  let service: BulletinServiceModule | undefined;
  jest.isolateModules(() => {
    service = require('@/services/BulletinService');
  });
  delete process.env.EXPO_PUBLIC_KEY_SCREENS;
  return service!;
};

// The live Bulletin API (google-apps-script/BulletinApi.gs), run as it is.
const bulletinApi = () => {
  const context = createContext({});
  runInContext(repoFile('google-apps-script/BulletinApi.gs'), context);
  return (expression: string) => JSON.parse(runInContext(`JSON.stringify(${expression})`, context) as string);
};

// Set after loading the service: loading it in a fresh module registry
// replaces global.fetch, which would leave an earlier spy uncalled.
const fetchSpy = () =>
  jest.spyOn(global, 'fetch').mockRejectedValue(new Error('The key screens must never reach the network'));

afterEach(() => jest.restoreAllMocks());

describe('the key screens’ made-up bulletin (#456)', () => {
  it('stands in for the Bulletin API in a key-screens build, through the same checks', async () => {
    const { fetchBulletin } = loadBulletinService(true);
    const fetch = fetchSpy();
    const bulletin = await fetchBulletin('2026-11-14');
    expect(fetch).not.toHaveBeenCalled();
    expect(bulletin.date).toBe('2026-11-14');
    expect(bulletin.quarter).toBe('Q4');
    expect(bulletin.queens.ssChair).toBe('Anna-Katharina R.');
    expect(bulletin.queens.ssOpeningPrayer).toBe('Grace L. / Peter W. / Mary C.');
    expect(bulletin.brooklyn.sermon).toBe('Thomas B.');
  });

  it('fails as the API out of service would, for state=load-failed', async () => {
    const { fetchBulletin } = loadBulletinService(true);
    const fetch = fetchSpy();
    await expect(fetchBulletin('2026-11-14', undefined, 'load-failed')).rejects.toThrow(
      'Bulletin request failed (503)',
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it('keeps no stored copy in a key-screens build, so each shot shows the same bulletin', async () => {
    const made = await loadBulletinService(true).fetchBulletin('2026-11-14');
    const store = loadBulletinService(false);
    await store.cacheBulletin({ ...made, quarter: 'Stored' });
    expect((await store.readCachedBulletin('2026-11-14'))?.bulletin.quarter).toBe('Stored');

    const keyScreens = loadBulletinService(true);
    const fetch = fetchSpy();
    // A copy left from before isn't shown, so the load-failed shot fails even
    // after another shot loaded the bulletin.
    expect(await keyScreens.readCachedBulletin('2026-11-14')).toBeUndefined();
    expect(await keyScreens.getCachedBulletin('2026-11-14', Date.now(), { allowStale: true })).toBeUndefined();
    mockFiles.clear();
    await keyScreens.fetchBulletin('2026-11-14');
    expect([...mockFiles.keys()]).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('has only fields the API sends, with every name as the public API shortens it', async () => {
    const bulletin = (await loadBulletinService(true).fetchBulletin('2026-11-14')) as unknown as Record<
      string,
      unknown
    > & { queens: Record<string, unknown>; brooklyn: Record<string, unknown> };
    const api = bulletinApi();
    const columns: { path: string[]; person?: boolean }[] = api('COLUMN_SCHEMA');
    const topFields = columns.filter(({ path }) => path.length === 1).map(({ path }) => path[0]);
    expect(topFields).toEqual(expect.arrayContaining(['date', 'quarter', 'specialRemark', 'announcements']));
    for (const field of Object.keys(bulletin)) {
      expect({ field, sent: [...topFields, 'queens', 'brooklyn', 'metadataTranslations'].includes(field) }).toEqual({
        field,
        sent: true,
      });
    }
    const locationFields = [...Object.keys(api('createLocation_()')), ...api('BULLETIN_LOCATION_CONTENT_FIELDS')];
    const personFields = new Set(
      columns.filter(({ person }) => person).map(({ path }) => path[path.length - 1]),
    );
    for (const field of ['chair', 'songLeader', 'sabbathMessage', 'technician', 'encouragement']) personFields.add(field);
    let names = 0;
    for (const location of [bulletin.queens, bulletin.brooklyn]) {
      for (const [field, value] of Object.entries(location)) {
        expect({ field, sent: locationFields.includes(field) }).toEqual({ field, sent: true });
        if (!personFields.has(field) || !value) continue;
        names += 1;
        // The API sends "Name withheld" for a name it can't shorten; any other
        // name is already as short as the API makes it.
        const shortened =
          value === 'Name withheld' ? value : api(`redactNameValue_(${JSON.stringify(value)})`);
        expect({ field, value: shortened }).toEqual({ field, value });
      }
    }
    expect(names).toBeGreaterThan(10);
  });
});

describe('the key screens’ made-up Team (#456)', () => {
  it('names no one on the real team and shows no one’s photo', () => {
    const { TEAM_MEMBERS } = require('@/constants/TeamData');
    const { KEY_SCREENS_TEAM_MEMBERS } = require('@/services/KeyScreensFixtures');
    const { CHURCH_BUILDING_IMAGE_URL } = require('@/constants/ExternalLinks');
    const realNames = TEAM_MEMBERS.flatMap((member: { name: Record<string, string> }) => Object.values(member.name));
    expect(KEY_SCREENS_TEAM_MEMBERS.map((member: { roleKey: string }) => member.roleKey)).toEqual(
      TEAM_MEMBERS.map((member: { roleKey: string }) => member.roleKey),
    );
    for (const member of KEY_SCREENS_TEAM_MEMBERS) {
      for (const name of Object.values(member.name)) expect(realNames).not.toContain(name);
      expect(member.imageUrl).toBe(CHURCH_BUILDING_IMAGE_URL);
    }
  });
});

describe('store builds (#456)', () => {
  it('ask the Bulletin API, and never load the made-up data', async () => {
    jest.doMock('@/services/KeyScreensFixtures', () => {
      throw new Error('A store build loaded the key screens’ made-up data');
    });
    const { fetchBulletin } = loadBulletinService(false);
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, bulletin: { date: '2026-11-14', queens: {}, brooklyn: {} } }),
    } as Response);
    expect((await fetchBulletin('2026-11-14')).date).toBe('2026-11-14');
    expect(fetch).toHaveBeenCalledTimes(1);
    jest.dontMock('@/services/KeyScreensFixtures');
  });

  it('leave the made-up data out of the bundle', () => {
    // Expo writes EXPO_PUBLIC_KEY_SCREENS into the app when it's built, and
    // Metro drops a require() behind a condition that's then false, but only
    // when the condition is written out where the require is, not behind a
    // function such as isKeyScreensBuild().
    const guarded =
      /process\.env\.EXPO_PUBLIC_KEY_SCREENS === '1'\s*\?\s*require\('(?:\.\/|@\/services\/)KeyScreensFixtures'\)/;
    const users = ['services/BulletinService.ts', 'app/(tabs)/home/team.tsx'];
    for (const file of users) expect({ file, guarded: guarded.test(repoFile(file)) }).toEqual({ file, guarded: true });
    const appFiles = ['app', 'components', 'constants', 'features', 'hooks', 'services'].flatMap((folder) =>
      (readdirSync(folder, { recursive: true }) as string[])
        .filter((file) => /\.tsx?$/.test(file))
        .map((file) => join(folder, file)),
    );
    const importers = appFiles.filter(
      (file) => file !== join('services', 'KeyScreensFixtures.ts') && repoFile(file).includes('KeyScreensFixtures'),
    );
    expect(importers.sort()).toEqual([...users].sort());
  });
});
