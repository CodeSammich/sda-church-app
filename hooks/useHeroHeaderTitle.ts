import { useCallback, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

const SHOW_TITLE_OFFSET = 150;
const HIDE_TITLE_OFFSET = 120;

/**
 * Shows the compact header title once the page hero has scrolled out of view.
 * Separate show/hide thresholds avoid rapid toggling near the boundary.
 */
export function useHeroHeaderTitle() {
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const isShowingRef = useRef(false);

  const handleHeroScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const offset = event.nativeEvent.contentOffset.y;
      const shouldShow = isShowingRef.current
        ? offset > HIDE_TITLE_OFFSET
        : offset >= SHOW_TITLE_OFFSET;

      if (shouldShow !== isShowingRef.current) {
        isShowingRef.current = shouldShow;
        setShowHeaderTitle(shouldShow);
      }
    },
    [],
  );

  return { handleHeroScroll, showHeaderTitle };
}
