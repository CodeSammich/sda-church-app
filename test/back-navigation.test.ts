import { readFileSync } from 'node:fs';
import {
  getBackTarget,
  getHeaderBackButtonColors,
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

  it('goes to the explicit return route first', () => {
    expect(getBackTarget('/bible', '/home/bulletin')).toBe('/home/bulletin');
    expect(getBackTarget('/you/legal', '/explore/library')).toBe('/explore/library');
    expect(getBackTarget('/bible', ['/home/discover', '/'])).toBe('/home/discover');
    // A nested return route keeps its own query, such as a hymnal's hymn.
    expect(
      getBackTarget('/bible', '/home/english-hymnal?backTo=%2Fhome%2Fbulletin&hymnNum=12'),
    ).toBe('/home/english-hymnal?backTo=%2Fhome%2Fbulletin&hymnNum=12');
  });

  it('returns the Home entry to Sabbath School to Home', () => {
    expect(SABBATH_SCHOOL_BACK_TARGET).toBe('/');
    expect(getBackTarget('/sabbath-school', SABBATH_SCHOOL_BACK_TARGET)).toBe('/');
    expect(getBackTarget('/sabbath-school')).toBe('/');
    expect(getBackTarget('/explore/sabbath-school')).toBe('/explore');
  });

  it.each([
    ['/home/bulletin', '/'],
    ['/home/give', '/'],
    ['/home/discover', '/'],
    ['/home/hymnal-selection', '/'],
    ['/home/about-sda', '/home/discover'],
    ['/home/about-my-church', '/home/discover'],
    ['/home/team', '/home/discover'],
    ['/home/baptism', '/home/discover'],
    ['/home/fellowship', '/home/discover'],
    ['/home/worship', '/home/fellowship'],
    ['/home/hymn-lookup', '/home/hymnal-selection'],
    ['/home/english-hymnal', '/home/hymnal-selection'],
    ['/home/chinese-505-hymnal', '/home/hymnal-selection'],
    ['/home/chinese-506-hymnal', '/home/hymnal-selection'],
    ['/home/chinese-707-new-simplified-hymnal', '/home/hymnal-selection'],
    ['/home/chinese-707-four-part-hymnal', '/home/hymnal-selection'],
    ['/home/chinese-707-standard-hymnal', '/home/hymnal-selection'],
    ['/explore', '/'],
    ['/explore/library', '/explore'],
    ['/explore/library/egw', '/explore/library'],
    ['/you/privacy', '/you'],
    ['/you/legal', '/you'],
    ['/bible', '/'],
  ])('sends %s back to %s when nothing else is given', (route, parent) => {
    expect(getBackTarget(route)).toBe(parent);
  });

  it('reads Expo Router group and index paths the same as plain ones', () => {
    expect(getBackTarget('/(tabs)/home/give')).toBe('/');
    expect(getBackTarget('/(tabs)/explore/library')).toBe('/explore');
    expect(getBackTarget('/explore/index')).toBe('/');
  });

  it('sends the header arrow, Android back, and browser back to the same place', () => {
    // Popping the native stack could land on a page the reader left earlier.
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    const layout = readFileSync('app/_layout.tsx', 'utf8');
    const handler = header.slice(header.indexOf('const handleBackPress'), header.indexOf('const expandBibleSearch'));
    expect(handler).toContain('router.dismissTo(getBackTarget(pathname, globalParams.backTo)');
    expect(handler).not.toMatch(/router\.back\(|canGoBack/);
    expect(layout).toContain('const backTarget = getBackTarget(pathname, globalParams.backTo);');
    expect(layout).toContain('router.dismissTo(gestureBackTarget');
    expect(layout).toContain('router.dismissTo(androidBackTarget');
  });
});
