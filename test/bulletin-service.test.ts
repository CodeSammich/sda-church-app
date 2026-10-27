import AsyncStorage from '@react-native-async-storage/async-storage';

import { mockFiles } from './helpers/file-system-mock';

import {
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
} from '@/services/BulletinService';

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

  it('expires a future bulletin when its Sabbath begins', () => {
    const friday = new Date(2026, 7, 7, 20).getTime();
    const sabbathMorning = new Date(2026, 7, 8, 8).getTime();

    expect(isBulletinCacheFresh('2026-08-08', friday, friday)).toBe(true);
    expect(isBulletinCacheFresh('2026-08-08', friday, sabbathMorning)).toBe(false);
    expect(isBulletinCacheFresh('2026-08-08', sabbathMorning, sabbathMorning)).toBe(true);
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

  it('treats only blank and TBD values as absent optional bulletin data', () => {
    expect(hasBulletinValue('')).toBe(false);
    expect(hasBulletinValue('  TBD  ')).toBe(false);
    expect(hasBulletinValue('N/A')).toBe(true);
    expect(hasBulletinValue('Communion Sabbath')).toBe(true);
  });
});
