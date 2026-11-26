import type { SupportedLanguage } from '@/constants/LanguageContext';
import {
  type BibleAudioOfflineLineState,
  getBibleAudioOfflineLine,
  isOfflineNetworkState,
  showsBibleAudioOfflineLine,
} from '@/services/BibleAudioOfflineLine';
import { addNetworkStateListener, getNetworkStateAsync, type NetworkState } from 'expo-network';
import { useEffect, useState } from 'react';

/**
 * The line the Bible audio player shows while the phone has no connection and
 * the chapter isn't downloaded (#801), or null. See
 * services/BibleAudioOfflineLine.ts for when. It watches the connection only
 * while the listener listens.
 *
 * @param enabled Whether the player shows the line at all: not on the web,
 *   whose player is a testing preview with its own failover.
 */
export function useBibleAudioOfflineLine({
  enabled,
  language,
  ...playback
}: Omit<BibleAudioOfflineLineState, 'offline'> & {
  enabled: boolean;
  language: SupportedLanguage;
}) {
  const watching = enabled && playback.listening;
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    if (!watching) {
      setOffline(false);
      return;
    }
    let active = true;
    // A change can arrive before the first reading, which is then older.
    let changed = false;
    const update = (state: NetworkState) => {
      if (active) setOffline(isOfflineNetworkState(state));
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
