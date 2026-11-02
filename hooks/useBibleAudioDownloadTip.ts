import { useDownloadedBibleAudioBytes } from '@/hooks/useBibleAudioDownloads';
import {
  BibleAudioStallWatcher,
  type BibleAudioPlaybackState,
  canShowBibleAudioTip,
  loadBibleAudioTip,
  noteBibleAudioDownloaded,
  noteBibleAudioTipShown,
  restBibleAudioTip,
} from '@/services/BibleAudioDownloadTip';
import { useEffect, useRef, useState } from 'react';

// new: the button is marked. seen: the popup is open, showing the line.
type Tip = 'off' | 'new' | 'seen';

/**
 * The tip that points a listener whose Bible audio keeps stopping to load to
 * Listen offline (#595). See services/BibleAudioDownloadTip.ts for when.
 *
 * @param narrator The narrator the listener can download, or null when Listen
 *   offline isn't offered: on the web, or for a narrator the app can't download.
 * @param popupVisible Whether the audio settings popup is open.
 * @param getPlaybackState Reads the player as it is now. Call the returned
 *   `watcher.update()` whenever its status changes, and `watcher.noteSeek()`
 *   when the listener skips or drags the bar.
 */
export function useBibleAudioDownloadTip(
  narrator: string | null,
  popupVisible: boolean,
  getPlaybackState: () => BibleAudioPlaybackState,
) {
  const hasDownloads = useDownloadedBibleAudioBytes() > 0;
  const getPlaybackStateRef = useRef(getPlaybackState);
  getPlaybackStateRef.current = getPlaybackState;
  const [tip, setTip] = useState<Tip>('off');
  const canShowRef = useRef(false);
  canShowRef.current = !!narrator && !hasDownloads;

  const [watcher] = useState(
    () =>
      new BibleAudioStallWatcher(
        () => getPlaybackStateRef.current(),
        () => {
          if (!canShowRef.current || !canShowBibleAudioTip()) return;
          noteBibleAudioTipShown();
          setTip('new');
        },
      ),
  );

  useEffect(() => {
    void loadBibleAudioTip();
    return () => watcher.endSession();
  }, [watcher]);

  useEffect(() => {
    if (!hasDownloads) return;
    noteBibleAudioDownloaded();
    setTip('off');
  }, [hasDownloads]);

  // Opening the popup, or the tip arriving while it's open, shows the line.
  useEffect(() => {
    if (popupVisible && tip === 'new') setTip('seen');
    if (!popupVisible && tip === 'seen') {
      // A download that finishes later ends the tip for good instead.
      if (!hasDownloads) restBibleAudioTip();
      setTip('off');
    }
  }, [hasDownloads, popupVisible, tip]);

  return {
    watcher,
    /** The button pulses, then keeps a dot until the popup opens. */
    marksButton: tip === 'new' && !!narrator,
    /** The popup shows the tip's line above the download rows. */
    showsLine: tip !== 'off' && !!narrator,
    /** Marks the button without stalls, for the key-screen build's popup. */
    showForKeyScreens: () => setTip('new'),
  };
}
