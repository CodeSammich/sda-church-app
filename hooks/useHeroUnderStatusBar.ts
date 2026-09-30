import { useCallback, useRef, useState } from 'react';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Whether the page's hero is still under the status bar as the page scrolls.
 * Pass `onHeroLayout` to the hero and `onScroll` to the scroll view. The
 * result is GlobalHeader's `heroUnderStatusBar` option, which hides its status
 * bar backdrop while the hero is there.
 */
export function useHeroUnderStatusBar() {
  const insets = useSafeAreaInsets();
  const heroHeight = useRef(0);
  const offset = useRef(0);
  const [heroUnderStatusBar, setHeroUnderStatusBar] = useState(true);

  const update = useCallback(() => {
    setHeroUnderStatusBar(
      !heroHeight.current || offset.current < heroHeight.current - insets.top,
    );
  }, [insets.top]);

  const onHeroLayout = useCallback(
    (event: LayoutChangeEvent) => {
      heroHeight.current = event.nativeEvent.layout.height;
      update();
    },
    [update],
  );

  const onScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      offset.current = event.nativeEvent.contentOffset.y;
      update();
    },
    [update],
  );

  return { heroUnderStatusBar, onHeroLayout, onScroll };
}
