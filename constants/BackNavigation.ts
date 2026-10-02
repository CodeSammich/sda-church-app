import { hasAndroidWebBackGuard } from './InstalledWebApp';
import type { AppTheme } from './Themes';

export const SABBATH_SCHOOL_BACK_TARGET = '/';

export const getHeaderBackButtonColors = (theme: AppTheme) => ({
  backgroundColor: theme.colors.surface,
  borderColor: theme.colors.outline,
});

export const hasHeaderBackButton = (
  segments: readonly string[],
  backTo?: string | string[],
) => {
  const explicitTarget = Array.isArray(backTo) ? backTo[0] : backTo;
  return Boolean(explicitTarget) || segments.length > 2;
};

const normalizeBackPath = (pathname: string) =>
  pathname.replace(/^\/\(tabs\)/, '').replace(/\/index\/?$/, '/') || '/';

// A return route is a path inside the app, such as `/home/bulletin`. Anything
// else, such as a full web address, is ignored in favor of the page's parent.
const isAppPath = (value: string | undefined): value is string =>
  typeof value === 'string' && /^\/(?![/\\])/.test(value);

/**
 * Where every back action goes: the header's back arrow, Android's back
 * gesture, and the browser's back button in the web app. Navigate there with
 * the router method getBackAction names.
 *
 * Back is route-driven, not stack-driven. Most screens have one parent;
 * screens with several entry points carry an explicit `backTo` value (for
 * example the Bible opened from Discover or the Bulletin). Popping the native
 * stack instead could land on a page the reader left earlier, because leaving
 * a stack for another tab keeps its pages.
 */
export const getBackTarget = (
  pathname: string,
  backTo?: string | string[],
) => {
  const explicitTarget = Array.isArray(backTo) ? backTo[0] : backTo;
  if (isAppPath(explicitTarget)) return explicitTarget;

  const route = normalizeBackPath(pathname);

  if (route === '/explore/library' || route.startsWith('/explore/library/')) {
    return route === '/explore/library' ? '/explore' : '/explore/library';
  }
  if (route === '/explore/sabbath-school') return '/explore';
  if (route === '/sabbath-school') return '/';

  if (route === '/you/legal') return '/you';

  if (route === '/home/hymn-lookup') return '/home/hymnal-selection';
  if (
    route === '/home/english-hymnal' ||
    route === '/home/chinese-505-hymnal' ||
    route === '/home/chinese-506-hymnal' ||
    route === '/home/chinese-707-new-simplified-hymnal' ||
    route === '/home/chinese-707-four-part-hymnal' ||
    route === '/home/chinese-707-standard-hymnal'
  ) {
    return '/home/hymnal-selection';
  }
  if (route === '/home/worship') return '/home/fellowship';
  if (
    route === '/home/about-sda' ||
    route === '/home/about-my-church' ||
    route === '/home/team' ||
    route === '/home/baptism' ||
    route === '/home/fellowship'
  ) {
    return '/home/discover';
  }
  if (
    route === '/home/bulletin' ||
    route === '/home/give' ||
    route === '/home/discover' ||
    route === '/home/hymnal-selection'
  ) {
    return '/';
  }

  // `/bible` is also a tab root. It only gets an Android back handler when an
  // explicit origin was supplied, so this fallback is for direct deep links.
  if (route === '/bible') return '/';

  return '/';
};

const stackOf = (path: string) =>
  normalizeBackPath(path.split('?')[0]).split('/').filter(Boolean)[0] ?? '';

/**
 * How to go back to `target` from `pathname`. Within one stack, such as two
 * Home pages, `dismissTo` pops back to the target when it's beneath this page,
 * rather than adding a second copy of it the way `replace` would. Across
 * stacks, such as a Home page back to Home itself or the Bible back to the
 * Bulletin, `dismissTo` has nothing to pop to and does nothing, so `replace`.
 *
 * In the installed web app on Android, `dismissTo` moves through browser
 * history with `history.go()`, which the back guard in app/_layout.tsx would
 * take for a second back press, so it replaces there. Elsewhere on the web,
 * `dismissTo` keeps the browser's own Back button in step.
 */
export const getBackAction = (
  pathname: string,
  target: string,
  historyGuarded: boolean = hasAndroidWebBackGuard(),
) => {
  if (historyGuarded) return 'replace';
  const stack = stackOf(pathname);
  return stack !== '' && stack === stackOf(target) ? 'dismissTo' : 'replace';
};

type StackRoute = { key: string; name: string; params?: object };

/**
 * Whether iOS's swipe-back reaches the same page as the back arrow. The swipe
 * pops to the page beneath, which can be one the reader left earlier: going
 * back to another stack, or leaving for another tab, keeps a stack's pages.
 * Stack layouts allow the swipe only when the page beneath is this page's
 * back target; otherwise the arrow is the way back.
 */
export const isSwipeBackToParent = (
  stack: string,
  routes: readonly StackRoute[],
  routeKey: string | undefined,
) => {
  const index = routeKey ? routes.findIndex((route) => route.key === routeKey) : -1;
  if (index < 1) return true;

  const pathOf = (route: StackRoute) => {
    const params = (route.params ?? {}) as Record<string, unknown>;
    const name = route.name.replace(/\[(\w+)\]/g, (_, key: string) => String(params[key] ?? ''));
    return name === 'index' ? `/${stack}` : `/${stack}/${name}`;
  };
  const route = routes[index];
  const backTo = (route.params as { backTo?: string | string[] } | undefined)?.backTo;
  return getBackTarget(pathOf(route), backTo).split('?')[0] === pathOf(routes[index - 1]);
};
