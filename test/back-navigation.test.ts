import {
  getHeaderBackTarget,
  hasHeaderBackButton,
} from '@/constants/BackNavigation';

describe('global header back navigation', () => {
  it('keeps pillar roots free of a back button by default', () => {
    expect(hasHeaderBackButton(['(tabs)', 'bible'])).toBe(false);
  });

  it('shows a back button on a pillar root when it has an explicit return route', () => {
    expect(
      hasHeaderBackButton(['(tabs)', 'bible'], '/home/bulletin'),
    ).toBe(true);
    expect(
      hasHeaderBackButton(['(tabs)', 'bible'], '/resources/english-hymnal'),
    ).toBe(true);
  });

  it('continues to show a back button on nested routes', () => {
    expect(hasHeaderBackButton(['(tabs)', 'home', 'bulletin'])).toBe(true);
  });

  it('uses the explicit return route as the back target', () => {
    expect(
      getHeaderBackTarget(['(tabs)', 'bible'], '/home/bulletin'),
    ).toBe('/home/bulletin');
  });
});
