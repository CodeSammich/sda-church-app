import { useCallback, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';

/** Keeps the compact navigation title hidden until the hero heading scrolls away. */
export function useHeroHeaderTitle(threshold = 120) {
  const [showHeaderTitle, setShowHeaderTitle] = useState(false);
  const showHeaderTitleRef = useRef(false);

  const handleHeroScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const shouldShow = event.nativeEvent.contentOffset.y > threshold;
      if (shouldShow !== showHeaderTitleRef.current) {
        showHeaderTitleRef.current = shouldShow;
        setShowHeaderTitle(shouldShow);
      }
    },
    [threshold],
  );

  return { showHeaderTitle, handleHeroScroll };
}
