import { CHURCH_LATITUDE, CHURCH_LONGITUDE } from '@/constants/ExternalLinks';
import { getSunTimes } from '@/services/SunTimesService';

// U.S. Naval Observatory sunsets for the church, in UTC, to the minute.
const USNO_SUNSETS: [Date, string][] = [
  [new Date(2026, 0, 2), '2026-01-02T21:40:00Z'],
  [new Date(2026, 5, 19), '2026-06-20T00:30:00Z'],
  [new Date(2026, 9, 2), '2026-10-02T22:36:00Z'],
];

describe('sun times service', () => {
  it.each(USNO_SUNSETS)('matches the USNO sunset for %s within a minute', (date, usno) => {
    const times = getSunTimes(CHURCH_LATITUDE, CHURCH_LONGITUDE, date);

    expect(times).not.toBeNull();
    expect(Math.abs(times!.sunset.getTime() - Date.parse(usno))).toBeLessThanOrEqual(60_000);
  });

  it('uses the calendar date, not the time of day', () => {
    const morning = getSunTimes(CHURCH_LATITUDE, CHURCH_LONGITUDE, new Date(2026, 9, 2, 0, 5));
    const night = getSunTimes(CHURCH_LATITUDE, CHURCH_LONGITUDE, new Date(2026, 9, 2, 23, 55));

    expect(night?.sunset.getTime()).toBe(morning?.sunset.getTime());
    expect(morning!.sunrise.getTime()).toBeLessThan(morning!.sunset.getTime());
  });

  it('returns null when the sun does not set', () => {
    expect(getSunTimes(80, 0, new Date(2026, 5, 21))).toBeNull();
  });
});
