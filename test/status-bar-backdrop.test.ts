import { readFileSync } from 'node:fs';
import { act, renderHook } from '@testing-library/react-native';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { isHeroUnderStatusBar } from '@/hooks/useGlobalHeaderHeight';
import { useHeroUnderStatusBar } from '@/hooks/useHeroUnderStatusBar';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 40, bottom: 0, left: 0, right: 0 }),
}));

const layout = (height: number) =>
  ({ nativeEvent: { layout: { x: 0, y: 0, width: 400, height } } }) as LayoutChangeEvent;
const scroll = (y: number) =>
  ({ nativeEvent: { contentOffset: { x: 0, y } } }) as NativeSyntheticEvent<NativeScrollEvent>;

describe('status bar backdrop', () => {
  const page = { isHymnalPage: false, hymnalSearchCollapsed: false, hasHero: false };

  it('covers the status bar on pages without a hero there', () => {
    expect(isHeroUnderStatusBar(page)).toBe(false);
  });

  it("leaves a hero page's hero uncovered before its options arrive", () => {
    // The first draw has no page options yet; the route decides.
    expect(isHeroUnderStatusBar({ ...page, hasHero: true })).toBe(true);
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain(
      '!isBiblePage &&\n      (isHeroHeaderRoute || HERO_UNDER_STATUS_BAR_ROUTES.has(props.route?.name))',
    );
  });

  it('leaves a hero uncovered until it scrolls away', () => {
    // Pages that show their title chip once the hero has scrolled away.
    expect(isHeroUnderStatusBar({ ...page, showTitleChip: false })).toBe(true);
    expect(isHeroUnderStatusBar({ ...page, showTitleChip: true })).toBe(false);
    // Hymnals, which collapse their search then.
    expect(isHeroUnderStatusBar({ ...page, isHymnalPage: true, hymnalSearchCollapsed: false })).toBe(true);
    expect(isHeroUnderStatusBar({ ...page, isHymnalPage: true, hymnalSearchCollapsed: true })).toBe(false);
    // A page that says so itself.
    expect(isHeroUnderStatusBar({ ...page, heroUnderStatusBar: true, showTitleChip: true })).toBe(true);
    expect(isHeroUnderStatusBar({ ...page, heroUnderStatusBar: false })).toBe(false);
  });

  it('tracks whether a measured hero is still under the status bar', () => {
    const { result } = renderHook(() => useHeroUnderStatusBar());
    expect(result.current.heroUnderStatusBar).toBe(true);

    act(() => result.current.onHeroLayout(layout(300)));
    act(() => result.current.onScroll(scroll(259)));
    expect(result.current.heroUnderStatusBar).toBe(true);

    // The hero's bottom edge reaches the 40pt status bar at 260.
    act(() => result.current.onScroll(scroll(260)));
    expect(result.current.heroUnderStatusBar).toBe(false);

    act(() => result.current.onScroll(scroll(0)));
    expect(result.current.heroUnderStatusBar).toBe(true);
  });

  it('is drawn by the header and fed by the pages with their own heroes', () => {
    const header = readFileSync('components/GlobalHeader.tsx', 'utf8');
    expect(header).toContain('styles.statusBarBackdrop');
    expect(header).toContain('opacity: statusBarBackdropAnim');
    for (const screen of [
      'app/(tabs)/index.tsx',
      'app/(tabs)/explore/index.tsx',
      'app/(tabs)/explore/library.tsx',
      'app/(tabs)/explore/library/[collection].tsx',
      'app/(tabs)/home/hymn-lookup.tsx',
      'app/(tabs)/you/index.tsx',
    ]) {
      const source = readFileSync(screen, 'utf8');
      expect(source).toContain('useHeroUnderStatusBar()');
      expect(source).toMatch(/heroUnderStatusBar(: isCarouselBehindStatusBar)?[,\s}]/);
      expect(source).toContain('onScroll={onScroll}');
    }
  });

  it("keeps Home's options stable between its countdown's re-renders", () => {
    // A new object every second would update the tab navigator every second.
    const home = readFileSync('app/(tabs)/index.tsx', 'utf8');
    expect(home).toContain('useMemo(() => ({ heroUnderStatusBar }), [heroUnderStatusBar])');
    expect(home).toContain('<Stack.Screen options={screenOptions as any} />');
  });
});
