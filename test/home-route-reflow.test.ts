import {
  shouldUseStackedHomeLayout,
  shouldUseStackedPillarLayout,
  shouldUseStackedTimelineLayout,
} from '@/constants/Layout';

describe('Home route responsive card layout', () => {
  it('preserves the original two-column phone grid at 100%', () => {
    expect(shouldUseStackedHomeLayout(390, 1)).toBe(false);
    expect(shouldUseStackedHomeLayout(320, 1)).toBe(false);
  });

  it('stacks phone cards before 200% text can crowd them', () => {
    expect(shouldUseStackedHomeLayout(390, 1.25)).toBe(true);
  });

  it.each([
    { scale: 1, stacked: false },
    { scale: 2, stacked: true },
    { scale: 3, stacked: true },
    { scale: 4, stacked: true },
  ])(
    'uses stacked=$stacked for every 320px content layout at effective scale $scale',
    ({ scale, stacked }) => {
      expect(shouldUseStackedHomeLayout(320, scale)).toBe(stacked);
      expect(shouldUseStackedPillarLayout(320, scale)).toBe(stacked);
      expect(shouldUseStackedTimelineLayout(320, scale)).toBe(stacked);
    },
  );

  it('keeps two columns when a large viewport still gives each card room', () => {
    expect(shouldUseStackedHomeLayout(768, 2)).toBe(false);
  });

  it('stacks fixed timeline and pillar columns at enlarged phone scales', () => {
    expect(shouldUseStackedTimelineLayout(320, 2)).toBe(true);
    expect(shouldUseStackedPillarLayout(320, 2)).toBe(true);
    expect(shouldUseStackedTimelineLayout(390, 3)).toBe(true);
    expect(shouldUseStackedPillarLayout(390, 3)).toBe(true);
  });
});
