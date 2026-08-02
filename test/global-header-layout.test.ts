import { getGlobalHeaderHeightForScale } from '@/hooks/useGlobalHeaderHeight';

describe('global header measured-content sizing', () => {
  it('preserves the standard one-line header at 100%', () => {
    expect(getGlobalHeaderHeightForScale(1, false, 40)).toBe(64);
  });

  it('expands to contain a measured title that wraps to three or more lines', () => {
    expect(getGlobalHeaderHeightForScale(4, false, 320)).toBe(336);
    expect(getGlobalHeaderHeightForScale(4, false, 400)).toBe(416);
  });

  it('ignores invalid measured heights', () => {
    expect(getGlobalHeaderHeightForScale(1, false, Number.NaN)).toBe(64);
    expect(getGlobalHeaderHeightForScale(1, false, -100)).toBe(64);
  });
});
