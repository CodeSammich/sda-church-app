import { getTimes } from 'suncalc';

export type SunTimes = {
  sunrise: Date;
  sunset: Date;
};

/**
 * Calculates sunrise and sunset on the device, so the app needs no network
 * request, cache, or provider attribution for them. SunCalc 2 matches the U.S.
 * Naval Observatory's published times to the minute.
 *
 * The calendar date is read in the device's time zone, then anchored to solar
 * noon at the location, so a phone in another time zone still gets that date's
 * times for the location. Returns null in polar day or night.
 */
export const getSunTimes = (
  lat: number,
  lng: number,
  date: Date,
): SunTimes | null => {
  const solarNoon = new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12) -
      (lng / 15) * 60 * 60 * 1000,
  );
  const { sunrise, sunset } = getTimes(solarNoon, lat, lng);
  return sunrise && sunset ? { sunrise, sunset } : null;
};
