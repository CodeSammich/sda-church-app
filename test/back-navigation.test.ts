import { readFileSync } from 'node:fs';
import {
  getBackAction,
  getBackTarget,
  getHeaderBackButtonColors,
  hasHeaderBackButton,
  isSwipeBackToParent,
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

  it('follows only return routes inside the app', () => {
    expect(getBackTarget('/bible', 'https://example.com/')).toBe('/');
    expect(getBackTarget('/home/hymn-lookup', '//example.com')).toBe('/home/hymnal-selection');
    expect(getBackTarget('/home/hymn-lookup', '/\\example.com')).toBe('/home/hymnal-selection');
    expect(getBackTarget('/you/legal', 'javascript:alert(1)')).toBe('/you');
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
    // Each hymnal's own route is the hymnal page with that hymnal picked.
    ['/home/english-hymnal', '/'],
    ['/home/chinese-505-hymnal', '/'],
    ['/home/chinese-506-hymnal', '/'],
    ['/home/chinese-707-new-simplified-hymnal', '/'],
    ['/home/chinese-707-four-part-hymnal', '/'],
    ['/home/chinese-707-standard-hymnal', '/'],
    ['/explore', '/'],
    ['/explore/library', '/explore'],
    ['/explore/library/egw', '/explore/library'],
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
    expect(handler).toContain('getBackTarget(pathname, globalParams.backTo)');
    expect(handler).toContain('router[getBackAction(pathname, target)](target');
    expect(handler).not.toMatch(/router\.back\(|canGoBack/);
    expect(layout).toContain('const backTarget = getBackTarget(pathname, globalParams.backTo);');
    expect(layout).toContain('router[getBackAction(pathname, gestureBackTarget, true)](gestureBackTarget');
    expect(layout).toContain('router[getBackAction(pathname, androidBackTarget)](androidBackTarget');
  });

  it('pops back within a stack and replaces across stacks', () => {
    // Within the Home stack: pop to the parent instead of adding a copy.
    expect(getBackAction('/home/about-sda', '/home/discover')).toBe('dismissTo');
    expect(getBackAction('/home/hymn-lookup', '/home/hymnal-selection')).toBe('dismissTo');
    expect(getBackAction('/explore/library', '/explore')).toBe('dismissTo');
    // Home itself is a tab of its own, so a Home page goes back to it by replacing.
    expect(getBackAction('/home/give', '/')).toBe('replace');
    expect(getBackAction('/(tabs)/home/bulletin', '/')).toBe('replace');
    // The Bible opened from another tab goes back to its caller by replacing.
    expect(getBackAction('/bible', '/home/english-hymnal?hymnNum=12')).toBe('replace');
    expect(getBackAction('/you/legal', '/explore/library')).toBe('replace');
  });

  it("replaces under the Android web app's back guard, which history.go() would trip", () => {
    expect(getBackAction('/home/about-sda', '/home/discover', true)).toBe('replace');
    expect(getBackAction('/home/about-sda', '/home/discover', false)).toBe('dismissTo');
    const layout = readFileSync('app/_layout.tsx', 'utf8');
    expect(layout).toContain('router[getBackAction(pathname, gestureBackTarget, true)](gestureBackTarget');
  });

  it("gives every page in the Home, Explore, and You stacks its own options", () => {
    // The swipe rule reads the stack when options are computed, which lags one
    // render behind a push; a page setting its options re-renders the stack
    // with the new page included.
    const { readdirSync } = require('node:fs') as typeof import('node:fs');
    const pages = ['home', 'explore', 'explore/library', 'you'].flatMap((dir) =>
      readdirSync(`app/(tabs)/${dir}`)
        .filter((file: string) => file.endsWith('.tsx') && file !== '_layout.tsx')
        .map((file: string) => `app/(tabs)/${dir}/${file}`),
    );
    expect(pages.length).toBeGreaterThan(20);
    for (const page of pages) {
      expect([page, readFileSync(page, 'utf8')]).toEqual([
        page,
        expect.stringMatching(/<Stack\.Screen|<HymnalScreen/),
      ]);
    }
  });

  it("allows iOS's swipe-back only when the page beneath is the back target", () => {
    const route = (name: string, params?: object) => ({ key: `${name}-key`, name, params });
    // About Denomination opened from New Member & Visitor.
    expect(
      isSwipeBackToParent('home', [route('discover'), route('about-sda')], 'about-sda-key'),
    ).toBe(true);
    // Give left behind from an earlier visit, then Bulletin opened from Home.
    expect(isSwipeBackToParent('home', [route('give'), route('bulletin')], 'bulletin-key')).toBe(false);
    // A hymnal opened from the Bulletin goes back to the Bulletin.
    expect(
      isSwipeBackToParent(
        'home',
        [route('bulletin'), route('english-hymnal', { backTo: '/home/bulletin', hymnNum: '12' })],
        'english-hymnal-key',
      ),
    ).toBe(true);
    // A hymnal opened from the hymn lookup goes back to the lookup, not the
    // hymnal page beneath it.
    expect(
      isSwipeBackToParent(
        'home',
        [route('hymnal-selection'), route('english-hymnal', { backTo: '/home/hymn-lookup' })],
        'english-hymnal-key',
      ),
    ).toBe(false);
    // Explore's own pages, including a shelf.
    expect(
      isSwipeBackToParent(
        'explore',
        [route('index'), route('library'), route('library/[collection]', { collection: 'egw' })],
        'library/[collection]-key',
      ),
    ).toBe(true);
    expect(
      isSwipeBackToParent(
        'explore',
        [route('index'), route('library/[collection]', { collection: 'egw' })],
        'library/[collection]-key',
      ),
    ).toBe(false);
    // The first page in a stack has nothing beneath it to swipe to.
    expect(isSwipeBackToParent('you', [route('index')], 'index-key')).toBe(true);
  });
});
