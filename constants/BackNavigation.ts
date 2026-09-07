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

export const getHeaderBackTarget = (
  segments: readonly string[],
  backTo?: string | string[],
) => {
  const explicitTarget = Array.isArray(backTo) ? backTo[0] : backTo;

  if (explicitTarget) return explicitTarget;
  if (segments.includes('you')) return '/you';
  if (segments.includes('explore')) return '/explore';
  if (segments.includes('bible')) return '/bible';

  return '/';
};

const normalizeBackPath = (pathname: string) =>
  pathname.replace(/^\/\(tabs\)/, '').replace(/\/index\/?$/, '/') || '/';

/**
 * Returns the previous in-app destination for Android's system back gesture.
 *
 * Native back is intentionally route-driven instead of stack-driven. Most
 * screens have one canonical parent; screens with multiple entry points carry
 * an explicit `backTo` value (for example Bible opened from Discover or the
 * Bulletin). This keeps a stale native stack from sending the user somewhere
 * unrelated while preserving those intentional exceptions.
 */
export const getAndroidBackTarget = (
  pathname: string,
  backTo?: string | string[],
) => {
  const explicitTarget = Array.isArray(backTo) ? backTo[0] : backTo;
  if (explicitTarget) return explicitTarget;

  const route = normalizeBackPath(pathname);

  if (route === '/explore/library' || route.startsWith('/explore/library/')) {
    return route === '/explore/library' ? '/explore' : '/explore/library';
  }
  if (route === '/explore/sabbath-school') return '/explore';
  if (route === '/sabbath-school') return '/';

  if (route === '/you/privacy' || route === '/you/legal') return '/you';

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
