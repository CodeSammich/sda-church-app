import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  type BibleAudioOfflineLineState,
  getBibleAudioOfflineLine,
  isOfflineNetworkState,
  showsBibleAudioOfflineLine,
} from '@/services/BibleAudioOfflineLine';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useEffect, useRef, useState } from 'react';

/**
 * The line the Bible audio player shows while the phone has no connection and
 * the chapter isn't downloaded (#801), or null. See
 * services/BibleAudioOfflineLine.ts for when. It watches the connection only
 * while the listener listens.
 *
 * @param enabled Whether the player shows the line at all: not on the web,
 *   whose player is a testing preview with its own failover.
 * @param onDrop Called when the connection drops while the listener listens:
 *   it was there, and now it isn't. Starting to listen offline isn't a drop.
 */
export function useBibleAudioOfflineLine({
  enabled,
  language,
  onDrop,
  ...playback
}: Omit<BibleAudioOfflineLineState, 'offline'> & {
  enabled: boolean;
  language: SupportedLanguage;
  onDrop?: () => void;
}) {
  const watching = enabled && playback.listening;
  const [offline, setOffline] = useState(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  useEffect(() => {
    if (!watching) {
      setOffline(false);
      return;
    }
    let active = true;
    // A change can arrive before the first reading, which is then older.
    let changed = false;
    // Whether the phone was offline, once known.
    let wasOffline: boolean | undefined;
    const update = (state: NetworkState) => {
      if (!active) return;
      const isOffline = isOfflineNetworkState(state);
      if (isOffline && wasOffline === false) onDropRef.current?.();
      wasOffline = isOffline;
      setOffline(isOffline);
    };
    const subscription = addNetworkStateListener((state) => {
      changed = true;
      update(state);
    });
    getNetworkStateAsync().then(
      (state) => {
        if (!changed) update(state);
      },
      () => undefined,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, [watching]);
  return watching && showsBibleAudioOfflineLine({ ...playback, offline })
    ? getBibleAudioOfflineLine(language)
    : null;
}
