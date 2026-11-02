import { ReaderStyles } from '@/styles/ReaderStyles';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, AppState, StyleSheet, View } from 'react-native';

// The border pulses this many times, each this long out and back.
export const BIBLE_AUDIO_TIP_PULSES = 3;
const PULSE_MS = 450;

/**
 * Marks the Bible audio settings button when playback keeps stopping to load
 * (#595): its border pulses in `color`, then a dot stays until the popup
 * opens. With Reduce Motion (iOS) or Remove animations (Android) on, only the dot. A
 * pulse due while the app is in the background, as when listening with the
 * screen off, waits until it's back. Goes inside the button, which must be
 * `position: 'relative'`.
 */
export function BibleAudioDownloadTipMarks({ color, visible }: Readonly<{ color: string; visible: boolean }>) {
  const pulse = useRef(new Animated.Value(0)).current;
  const [dotShown, setDotShown] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setDotShown(false);
    let cancelled = false;
    let animation: Animated.CompositeAnimation | null = null;
    let subscription: { remove: () => void } | null = null;
    const run = () => {
      subscription?.remove();
      subscription = null;
      animation = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1, duration: PULSE_MS, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 0, duration: PULSE_MS, useNativeDriver: true }),
        ]),
        { iterations: BIBLE_AUDIO_TIP_PULSES },
      );
      animation.start(() => !cancelled && setDotShown(true));
    };
    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduceMotion) => {
        if (cancelled) return;
        if (reduceMotion) setDotShown(true);
        else if (AppState.currentState === 'active') run();
        else subscription = AppState.addEventListener('change', (state) => state === 'active' && run());
      });
    return () => {
      cancelled = true;
      animation?.stop();
      subscription?.remove();
      pulse.setValue(0);
    };
  }, [pulse, visible]);

  if (!visible) return null;
  return (
    <>
      <Animated.View
        testID="bible-audio-tip-pulse"
        pointerEvents="none"
        style={[styles.pulse, { borderColor: color, opacity: pulse }]}
      />
      {dotShown && (
        <View
          testID="bible-audio-tip-dot"
          pointerEvents="none"
          style={[ReaderStyles.timerBadge, { backgroundColor: color }]}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  // Covers the button's own 1-point border, and 2 points outside it.
  pulse: {
    position: 'absolute',
    top: -2,
    right: -2,
    bottom: -2,
    left: -2,
    borderRadius: ReaderStyles.audioSideControl.borderRadius + 2,
    borderWidth: 3,
  },
});
