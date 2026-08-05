import { useHeroHeaderTitle } from '@/hooks/useHeroHeaderTitle';
import { act, renderHook } from '@testing-library/react-native';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const scrollEvent = (y: number) =>
  ({
    nativeEvent: { contentOffset: { x: 0, y } },
  }) as NativeSyntheticEvent<NativeScrollEvent>;

describe('hero header title visibility', () => {
  it('uses separate show and hide thresholds to prevent boundary flicker', () => {
    const { result } = renderHook(() => useHeroHeaderTitle());

    act(() => result.current.handleHeroScroll(scrollEvent(149)));
    expect(result.current.showHeaderTitle).toBe(false);

    act(() => result.current.handleHeroScroll(scrollEvent(150)));
    expect(result.current.showHeaderTitle).toBe(true);

    act(() => result.current.handleHeroScroll(scrollEvent(121)));
    expect(result.current.showHeaderTitle).toBe(true);

    act(() => result.current.handleHeroScroll(scrollEvent(120)));
    expect(result.current.showHeaderTitle).toBe(false);
  });
});
