import {
  getAndroidBackTarget,
  getHeaderBackButtonColors,
  getHeaderBackTarget,
  hasHeaderBackButton,
  SABBATH_SCHOOL_BACK_TARGET,
} from '@/constants/BackNavigation';
import { customDarkTheme, customLightTheme } from '@/constants/Themes';

describe('global header back navigation', () => {
  it.each([customLightTheme, customDarkTheme])(
    'uses an opaque $dark back-button surface',
    (theme) => {
      expect(getHeaderBackButtonColors(theme)).toEqual({
        backgroundColor: theme.colors.surface,
        borderColor: theme.colors.outline,
      });
      expect(getHeaderBackButtonColors(theme).backgroundColor).toMatch(/^#[\dA-F]{6}$/i);
    },
  );

  it('keeps pillar roots free of a back button by default', () => {
    expect(hasHeaderBackButton(['(tabs)', 'bible'])).toBe(false);
  });

  it('shows a back button on a pillar root when it has an explicit return route', () => {
    expect(
      hasHeaderBackButton(['(tabs)', 'bible'], '/home/bulletin'),
    ).toBe(true);
    expect(
      hasHeaderBackButton(['(tabs)', 'bible'], '/home/english-hymnal'),
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

  it('returns the legal page to an explicit library parent', () => {
    expect(
      getHeaderBackTarget(
        ['(tabs)', 'you', 'legal'],
        '/explore/library',
      ),
    ).toBe('/explore/library');
  });

  it('returns the home-only Sabbath School entry point to Home', () => {
    expect(SABBATH_SCHOOL_BACK_TARGET).toBe('/');
    expect(
      getHeaderBackTarget(
        ['(tabs)', 'explore', 'sabbath-school'],
        SABBATH_SCHOOL_BACK_TARGET,
      ),
    ).toBe('/');
  });

  it('uses the canonical parent for nested library collections', () => {
    expect(getAndroidBackTarget('/explore')).toBe('/');
    expect(getAndroidBackTarget('/explore/library')).toBe('/explore');
    expect(getAndroidBackTarget('/explore/library/egw')).toBe('/explore/library');
  });

  it('keeps Bible back navigation tied to its explicit entry point', () => {
    expect(getAndroidBackTarget('/bible', '/home/discover')).toBe('/home/discover');
    expect(getAndroidBackTarget('/bible', '/home/bulletin')).toBe('/home/bulletin');
    expect(getAndroidBackTarget('/bible')).toBe('/');
  });

  it('uses canonical parents for fixed home and You sub-pages', () => {
    expect(getAndroidBackTarget('/home/hymn-lookup')).toBe('/home/hymnal-selection');
    expect(getAndroidBackTarget('/home/english-hymnal')).toBe('/home/hymnal-selection');
    expect(getAndroidBackTarget('/you/legal')).toBe('/you');
    expect(getAndroidBackTarget('/home/about-sda')).toBe('/home/discover');
  });
});
