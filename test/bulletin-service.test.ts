import {
  BulletinLocation,
  fetchBulletin,
  getUpcomingSabbathDates,
  isBulletinCacheFresh,
  isBulletinLocationEmpty,
} from '@/services/BulletinService';

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

  it('recognizes a location where every field is blank or TBD', () => {
    expect(isBulletinLocationEmpty(emptyLocation())).toBe(true);
  });

  it('does not suggest a joint service when any location field has data', () => {
    const location = emptyLocation();
    location.sabbathSchool = 'Jordan F.';
    expect(isBulletinLocationEmpty(location)).toBe(false);
  });
});
