import {
  AMBIENT_DARK_LUX,
  AMBIENT_LIGHT_LUX,
  resolveAmbientIsDark,
} from '@/constants/AmbientTheme';

describe('ambient theme thresholds', () => {
  it('switches a dark state to light at ordinary indoor illumination', () => {
    expect(resolveAmbientIsDark(AMBIENT_LIGHT_LUX, true)).toBe(false);
  });

  it('keeps a light state through the hysteresis band', () => {
    expect(resolveAmbientIsDark(AMBIENT_DARK_LUX + 1, false)).toBe(false);
  });

  it('switches a light state to dark only in a genuinely dark room', () => {
    expect(resolveAmbientIsDark(AMBIENT_DARK_LUX, false)).toBe(true);
  });

  it('ignores invalid sensor readings', () => {
    expect(resolveAmbientIsDark(Number.NaN, true)).toBe(true);
    expect(resolveAmbientIsDark(Number.POSITIVE_INFINITY, false)).toBe(false);
  });
});
