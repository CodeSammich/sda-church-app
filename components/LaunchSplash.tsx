import { LinearGradient } from 'expo-linear-gradient';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Image,
  StatusBar,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

/**
 * The launch animation (#538): the church symbol rises into view from the
 * bottom up, the open Bible first, then the cross, then the flame, as the
 * symbol's meaning reads. It covers the app's first screen while the app loads
 * underneath, then fades away once both have finished.
 *
 * The phone's own launch screen is plain blue (app.json's expo-splash-screen
 * has no image), so the symbol appears only here. Brand rules
 * (docs/LEGAL_BRANDING.md): the whole symbol is uncovered at once, never in
 * pieces; it grows evenly, with no distortion, rotation, or change of colour;
 * the ® stays with it; and it ends on the exact symbol.
 */

/** The launch screen's blue: app.json's expo-splash-screen backgroundColor. */
export const LAUNCH_BACKGROUND = '#00405C';
const LAUNCH_BACKGROUND_CLEAR = 'rgba(0, 64, 92, 0)';

// The symbol and its ®, cut from the app icon by scripts/make-launch-symbol.cjs.
const SYMBOL = require('../assets/images/church-symbol.png');
export const LAUNCH_SYMBOL_ASPECT = 960 / 855;

// The soft edge that rises over the symbol, as a fraction of its height.
const EDGE = 0.3;
// How much smaller the symbol starts, and how far below its place, as a
// fraction of its height.
const START_SCALE = 0.86;
const START_DROP = 0.08;

export const LAUNCH_REVEAL_MS = 800;
const GROW_MS = 950;
// The finished symbol stays a moment before fading.
const HOLD_MS = 120;
export const LAUNCH_FADE_MS = 250;
// How long to wait for the symbol's image and the Reduce Motion setting
// before starting anyway.
const START_TIMEOUT_MS = 500;

/** The symbol's width: half the screen's narrower side, at most 300 points. */
export const getLaunchSymbolWidth = (width: number, height: number) =>
  Math.round(Math.min(300, Math.min(width, height) / 2));

interface LaunchSplashProps {
  /** Whether the app underneath has loaded, so the splash can fade. */
  appReady: boolean;
  /** Called once the splash has faded away. */
  onDone: () => void;
}

export function LaunchSplash({ appReady, onDone }: LaunchSplashProps) {
  const { width, height } = useWindowDimensions();
  const symbolWidth = getLaunchSymbolWidth(width, height);
  const symbolHeight = symbolWidth / LAUNCH_SYMBOL_ASPECT;
  const edgeHeight = symbolHeight * EDGE;

  const reveal = useRef(new Animated.Value(0)).current;
  const grow = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [imageLoaded, setImageLoaded] = useState(false);
  const [reduceMotion, setReduceMotion] = useState<boolean | null>(null);
  const [waited, setWaited] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [fading, setFading] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    let cancelled = false;
    // iOS Reduce Motion, or Android's Remove animations.
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => !cancelled && setReduceMotion(enabled))
      .catch(() => !cancelled && setReduceMotion(false));
    const timer = setTimeout(() => setWaited(true), START_TIMEOUT_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const canStart = waited || (imageLoaded && reduceMotion !== null);
  useEffect(() => {
    if (!canStart || started.current) return;
    started.current = true;
    if (reduceMotion) {
      // The finished symbol, still.
      reveal.setValue(1);
      grow.setValue(1);
      setRevealed(true);
      return;
    }
    Animated.parallel([
      // Slows as it reaches the top lines of the flame.
      Animated.timing(reveal, {
        toValue: 1,
        duration: LAUNCH_REVEAL_MS,
        easing: Easing.bezier(0.3, 0, 0.25, 1),
        useNativeDriver: true,
      }),
      Animated.timing(grow, {
        toValue: 1,
        duration: GROW_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => setRevealed(true));
  }, [canStart, grow, reduceMotion, reveal]);

  useEffect(() => {
    if (!revealed || !appReady || fading) return;
    setFading(true);
    Animated.sequence([
      Animated.delay(HOLD_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: LAUNCH_FADE_MS,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start(() => onDone());
  }, [appReady, fading, onDone, opacity, revealed]);

  return (
    <Animated.View
      style={[styles.container, { opacity }]}
      // The phone's launch screen goes once this blue is drawn in its place.
      onLayout={() => {
        SplashScreen.setOptions({ duration: 0, fade: false });
        SplashScreen.hideAsync().catch(() => {});
      }}
      // Taps wait until the app shows; the symbol is decoration.
      pointerEvents={fading ? 'none' : 'auto'}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="launch-splash"
    >
      <StatusBar barStyle="light-content" />
      <Animated.View
        style={{
          width: symbolWidth,
          height: symbolHeight,
          transform: [
            {
              translateY: grow.interpolate({
                inputRange: [0, 1],
                outputRange: [symbolHeight * START_DROP, 0],
              }),
            },
            {
              scale: grow.interpolate({
                inputRange: [0, 1],
                outputRange: [START_SCALE, 1],
              }),
            },
          ],
        }}
      >
        <Image
          source={SYMBOL}
          style={{ width: symbolWidth, height: symbolHeight }}
          onLoad={() => setImageLoaded(true)}
          onError={() => setImageLoaded(true)}
          fadeDuration={0}
          testID="launch-symbol"
        />
        {/* The blue cover over the symbol, with a soft lower edge. It starts
            over the whole symbol and rises past its top, uncovering it from
            the bottom up. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.cover,
            {
              height: symbolHeight + edgeHeight,
              transform: [
                {
                  translateY: reveal.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -(symbolHeight + edgeHeight)],
                  }),
                },
              ],
            },
          ]}
          testID="launch-cover"
        >
          <View style={styles.coverSolid} />
          <LinearGradient
            colors={[LAUNCH_BACKGROUND, LAUNCH_BACKGROUND_CLEAR]}
            style={{ height: edgeHeight }}
          />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    backgroundColor: LAUNCH_BACKGROUND,
    justifyContent: 'center',
    zIndex: 1000,
  },
  cover: {
    left: -2,
    position: 'absolute',
    right: -2,
    top: 0,
  },
  coverSolid: {
    backgroundColor: LAUNCH_BACKGROUND,
    flex: 1,
  },
});
