import AsyncStorage from '@react-native-async-storage/async-storage';

import { mockFiles } from './helpers/file-system-mock';

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.6.0' } },
}));

import {
  BULLETIN_MAX_AGE_MS,
  Bulletin,
  BulletinLocation,
  cacheBulletin,
  fetchBulletin,
  getCachedBulletin,
  getRefreshAvailableAt,
  setRefreshAvailableAt,
  getNextBulletinRolloverAt,
  getUpcomingSabbathDates,
  hasBulletinValue,
  isBulletinCacheFresh,
  isBulletinLocationEmpty,
  readCachedBulletin,
} from '@/services/BulletinService';
import { writeCachedText } from '@/services/CacheStore';

beforeEach(async () => {
  await AsyncStorage.clear();
});

const emptyLocation = (): BulletinLocation => ({
  hymnOfPraise: { english: '', chinese: '' },
  sermonTitle: { english: '', chinese: '' },
  hymnOfResponse: { english: '', chinese: '' },
  bibleVerses: '',
  sermon: '',
  chairPastoralPrayer: 'TBD',
  offeringPrayer: '',
});

describe('bulletin service', () => {
  it('selects the upcoming and following Sabbath', () => {
    expect(getUpcomingSabbathDates(new Date(2026, 7, 3, 12))).toEqual([
      '2026-08-08',
      '2026-08-15',
    ]);
  });

  it('uses the current day when it is already Sabbath', () => {
    expect(getUpcomingSabbathDates(new Date(2026, 7, 8, 12))).toEqual([
      '2026-08-08',
      '2026-08-15',
    ]);
  });

  it('rolls the displayed weeks forward at the first midnight after Sabbath', () => {
    const rollover = getNextBulletinRolloverAt(new Date(2026, 7, 8, 12));
    expect(rollover).toBe(new Date(2026, 7, 9, 0).getTime());
    expect(getUpcomingSabbathDates(new Date(rollover))).toEqual([
      '2026-08-15',
      '2026-08-22',
    ]);
  });

  it('surfaces an API error message', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: false, error: 'No schedule found' }),
    } as Response);

    await expect(fetchBulletin('2026-08-08')).rejects.toThrow('No schedule found');
  });

  // A copy of the 2026-08-08 bulletin, as this app version (1.6.0) saves it.
  const copy = (fetchedAt: number, appVersion = '1.6.0') => ({
    bulletin: { date: '2026-08-08', queens: emptyLocation(), brooklyn: emptyLocation() } as Bulletin,
    fetchedAt,
    appVersion,
  });

  it('expires a future bulletin when its Sabbath begins', () => {
    const fridayNight = new Date(2026, 7, 7, 23, 50).getTime();
    const sabbathStart = new Date(2026, 7, 8, 0, 0).getTime();
    const sabbathMorning = new Date(2026, 7, 8, 8).getTime();

    expect(isBulletinCacheFresh(copy(fridayNight), fridayNight)).toBe(true);
    // Ten minutes old, but downloaded before the Sabbath began.
    expect(isBulletinCacheFresh(copy(fridayNight), sabbathStart + 1)).toBe(false);
    expect(isBulletinCacheFresh(copy(sabbathMorning), sabbathMorning)).toBe(true);
  });

  it('expires a copy once it is 30 minutes old (#702)', () => {
    const tuesday = new Date(2026, 7, 4, 10).getTime();

    expect(BULLETIN_MAX_AGE_MS).toBe(30 * 60 * 1000);
    expect(isBulletinCacheFresh(copy(tuesday), tuesday + 29 * 60 * 1000)).toBe(true);
    expect(isBulletinCacheFresh(copy(tuesday), tuesday + 30 * 60 * 1000)).toBe(false);
    // A copy from the phone's future, after its clock moved back, is out of date too.
    expect(isBulletinCacheFresh(copy(tuesday + 60 * 1000), tuesday)).toBe(false);
  });

  it('expires a copy that another app version saved, or one saved before versions were kept (#702)', async () => {
    const tuesday = new Date(2026, 7, 4, 10).getTime();

    expect(isBulletinCacheFresh(copy(tuesday, '1.5.0'), tuesday)).toBe(false);
    expect(isBulletinCacheFresh({ ...copy(tuesday), appVersion: undefined }, tuesday)).toBe(false);

    // Every copy stored before #702 looks like this.
    const { appVersion: _, ...old } = copy(tuesday);
    await writeCachedText(
      { folder: 'bulletins', name: '2026-08-08.json', key: 'bulletin-cache-v2:2026-08-08' },
      JSON.stringify(old),
    );
    expect(await readCachedBulletin('2026-08-08', tuesday)).toEqual({ bulletin: old.bulletin, fresh: false });
    expect(await getCachedBulletin('2026-08-08', tuesday)).toBeUndefined();
    expect(await getCachedBulletin('2026-08-08', tuesday, { allowStale: true })).toEqual(old.bulletin);
  });

  it('stores the app version with each copy, so that version finds it current', async () => {
    const tuesday = new Date(2026, 7, 4, 10).getTime();
    await cacheBulletin(copy(tuesday).bulletin, tuesday);

    expect(JSON.parse(mockFiles.get('cache/bulletins/2026-08-08.json')!)).toEqual(copy(tuesday));
    expect(await readCachedBulletin('2026-08-08', tuesday + 60 * 1000)).toEqual({
      bulletin: copy(tuesday).bulletin,
      fresh: true,
    });
    expect(await getCachedBulletin('2026-08-08', tuesday + 60 * 1000)).toEqual(copy(tuesday).bulletin);
  });

  it('returns an outdated cached bulletin only when asked for a fallback', async () => {
    const bulletin = {
      date: '2026-08-08',
      queens: emptyLocation(),
      brooklyn: emptyLocation(),
    } as Bulletin;
    const friday = new Date(2026, 7, 7, 20).getTime();
    const sabbathMorning = new Date(2026, 7, 8, 8).getTime();
    await cacheBulletin(bulletin, friday);

    expect(await getCachedBulletin('2026-08-08', sabbathMorning)).toBeUndefined();
    expect(
      await getCachedBulletin('2026-08-08', sabbathMorning, { allowStale: true }),
    ).toEqual(bulletin);
  });

  const bulletinFor = (date: string) =>
    ({ date, queens: emptyLocation(), brooklyn: emptyLocation() }) as Bulletin;

  const respondWith = (bulletin: Bulletin) =>
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, bulletin }),
    } as Response);

  it("asks for the bulletin with the app's version, so the API knows what it can show", async () => {
    const fetchSpy = respondWith(bulletinFor('2026-08-08'));

    await fetchBulletin('2026-08-08');

    expect(String(fetchSpy.mock.calls[0][0])).toMatch(/\?date=2026-08-08&appVersion=1\.6\.0$/);
  });

  it("doesn't store a bulletin without its schedule over a copy that has one", async () => {
    const stored = { ...bulletinFor('2026-08-08'), quarter: 'Q3' };
    await cacheBulletin(stored, new Date(2026, 7, 7, 20).getTime());
    respondWith({ ...bulletinFor('2026-08-08'), scheduleNotSet: true });

    expect((await fetchBulletin('2026-08-08')).scheduleNotSet).toBe(true);
    expect(await getCachedBulletin('2026-08-08', 0, { allowStale: true })).toEqual(stored);
  });

  it("doesn't store a bulletin without its schedule when there's no copy", async () => {
    respondWith({ ...bulletinFor('2026-08-08'), scheduleNotSet: true });

    await fetchBulletin('2026-08-08');

    expect(await getCachedBulletin('2026-08-08', 0, { allowStale: true })).toBeUndefined();
  });

  it('keeps the copies in the cache directory on a phone, out of AsyncStorage and its backups', async () => {
    await cacheBulletin(bulletinFor('2026-08-08'), new Date(2026, 7, 7, 20).getTime());
    await setRefreshAvailableAt('2026-08-08', 1234);

    expect([...mockFiles.keys()].sort()).toEqual(['cache/bulletins/2026-08-08.json', 'cache/bulletins/2026-08-08.refresh']);
    expect(await AsyncStorage.getAllKeys()).toEqual([]);
    expect(await getCachedBulletin('2026-08-08', 0, { allowStale: true })).toEqual(bulletinFor('2026-08-08'));
    expect(await getRefreshAvailableAt('2026-08-08')).toBe(1234);
  });

  it('drops the copies AsyncStorage kept before #524, once a new one is saved', async () => {
    const old = JSON.stringify({ bulletin: bulletinFor('2026-08-08'), fetchedAt: 1 });
    await AsyncStorage.multiSet([
      ['bulletin-cache-v2:2026-08-08', old],
      ['bulletin-refresh-v1:2026-08-08', '5'],
      ['user-language', 'en'],
    ]);
    // Until then, it still shows the old copy.
    expect(await getCachedBulletin('2026-08-08', 0, { allowStale: true })).toEqual(bulletinFor('2026-08-08'));

    await cacheBulletin(bulletinFor('2026-08-15'));
    expect(await AsyncStorage.getAllKeys()).toEqual(['user-language']);
  });

  it('keeps only the copies from the last two weeks', async () => {
    for (const date of ['2026-07-18', '2026-07-25', '2026-08-01', '2026-08-08']) {
      await setRefreshAvailableAt(date, 1);
      await cacheBulletin(bulletinFor(date));
    }
    const kept = async (date: string) =>
      (await getCachedBulletin(date, 0, { allowStale: true })) !== undefined && (await getRefreshAvailableAt(date)) === 1;

    // Two weeks before the newest, 2026-08-08, is 2026-07-25.
    expect(await kept('2026-07-18')).toBe(false);
    expect(await kept('2026-07-25')).toBe(true);
    expect(await kept('2026-08-01')).toBe(true);
    expect(await kept('2026-08-08')).toBe(true);
  });

  it('recognizes a location where every field is blank or TBD', () => {
    expect(isBulletinLocationEmpty(emptyLocation())).toBe(true);
  });

  it('does not suggest a joint service when any location field has data', () => {
    const location = emptyLocation();
    location.sabbathSchool = 'Jordan F.';
    expect(isBulletinLocationEmpty(location)).toBe(false);
  });

  it('counts the Sabbath School hymns and special music piece as location data', () => {
    expect(isBulletinLocationEmpty({ ...emptyLocation(), sabbathSchoolHymns: ['', 'TBD'] })).toBe(true);
    expect(isBulletinLocationEmpty({ ...emptyLocation(), sabbathSchoolHymns: ['', '12'] })).toBe(false);
    expect(isBulletinLocationEmpty({ ...emptyLocation(), specialMusicTitle: 'It Is Well' })).toBe(false);
  });

  it('treats only blank and TBD values as absent optional bulletin data', () => {
    expect(hasBulletinValue('')).toBe(false);
    expect(hasBulletinValue('  TBD  ')).toBe(false);
    expect(hasBulletinValue('N/A')).toBe(true);
    expect(hasBulletinValue('Communion Sabbath')).toBe(true);
  });
});
