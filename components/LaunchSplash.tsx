import {
  type DrawingWindow,
  getDrawingWindows,
  getFillAmount,
  getPenAmount,
} from '@/components/LaunchDrawing';
import {
  CHURCH_SYMBOL_SHAPES,
  CHURCH_SYMBOL_VIEW_BOX,
  type ChurchSymbolShape,
} from '@/constants/ChurchSymbol';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useRef, useState } from 'react';
import { StatusBar, StyleSheet, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  type SharedValue,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

/**
 * The launch animation (#538): the church symbol is drawn as if with a pen
 * while the app loads underneath, then fades away once both have finished.
 * components/LaunchDrawing.ts says what is drawn when. It runs on the UI
 * thread, so the app loading doesn't make it stutter.
 *
 * The phone's own launch screen is plain blue (app.json's expo-splash-screen
 * has no image), so the symbol appears only here. It ends on the NAD's
 * official symbol, unchanged, ® included; see docs/LEGAL_BRANDING.md.
 */

/** The launch screen's blue: app.json's expo-splash-screen backgroundColor. */
export const LAUNCH_BACKGROUND = '#00405C';
const WHITE = '#FFFFFF';

const [, , VIEW_WIDTH, VIEW_HEIGHT] = CHURCH_SYMBOL_VIEW_BOX.split(' ').map(Number);
export const LAUNCH_SYMBOL_ASPECT = VIEW_WIDTH / VIEW_HEIGHT;
const WINDOWS = getDrawingWindows(CHURCH_SYMBOL_SHAPES);

export const LAUNCH_DRAW_MS = 1300;
// The finished symbol stays a moment before fading.
const HOLD_MS = 150;
export const LAUNCH_FADE_MS = 250;
// The pen's width, in the symbol's units: about a point on a phone.
const PEN_WIDTH = 1.8;

/** The symbol's width: half the screen's narrower side, at most 300 points. */
export const getLaunchSymbolWidth = (width: number, height: number) =>
  Math.round(Math.min(300, Math.min(width, height) / 2));

const AnimatedPath = Animated.createAnimatedComponent(Path);

interface DrawnProps {
  progress: SharedValue<number>;
  window: DrawingWindow;
}

/** One half of a shape's outline, drawn by the pen and gone once it fills. */
function PenLine({ half, progress, window }: DrawnProps & { half: ChurchSymbolShape['pen'][number] }) {
  const animatedProps = useAnimatedProps(() => {
    const drawn = getPenAmount(progress.value, window);
    return {
      strokeDashoffset: half.length * (1 - drawn),
      // Hidden before it starts, since a round cap would show as a dot.
      strokeOpacity: drawn > 0 ? 1 - getFillAmount(progress.value, window) : 0,
    };
  });
  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d={half.d}
      fill="none"
      stroke={WHITE}
      strokeDasharray={[half.length, half.length]}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={PEN_WIDTH}
    />
  );
}

function SymbolShape({ shape, progress, window }: DrawnProps & { shape: ChurchSymbolShape }) {
  const animatedProps = useAnimatedProps(() => ({
    fillOpacity: getFillAmount(progress.value, window),
  }));
  return (
    <>
      <AnimatedPath animatedProps={animatedProps} d={shape.d} fill={WHITE} />
      {shape.pen.map((half) => (
        <PenLine half={half} key={half.d} progress={progress} window={window} />
      ))}
    </>
  );
}

interface LaunchSplashProps {
  /** Whether the app underneath has loaded, so the splash can fade. */
  appReady: boolean;
  /** Called once the splash has faded away. */
  onDone: () => void;
}

export function LaunchSplash({ appReady, onDone }: LaunchSplashProps) {
  const { width, height } = useWindowDimensions();
  const symbolWidth = getLaunchSymbolWidth(width, height);
  // iOS Reduce Motion, or Android's Remove animations: the finished symbol,
  // still. Reanimated reads it without waiting.
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const opacity = useSharedValue(1);
  const [drawn, setDrawn] = useState(reduceMotion);
  const [fading, setFading] = useState(false);
  const started = useRef(false);

  // The phone's launch screen goes once this blue is drawn in its place, and
  // the pen starts.
  const start = () => {
    if (started.current) return;
    started.current = true;
    SplashScreen.setOptions({ duration: 0, fade: false });
    SplashScreen.hideAsync().catch(() => {});
    if (reduceMotion) return;
    progress.value = withTiming(
      1,
      { duration: LAUNCH_DRAW_MS, easing: Easing.linear },
      (finished) => {
        if (finished) scheduleOnRN(setDrawn, true);
      },
    );
  };

  useEffect(() => {
    if (!drawn || !appReady || fading) return;
    setFading(true);
    opacity.value = withDelay(
      HOLD_MS,
      withTiming(
        0,
        { duration: LAUNCH_FADE_MS, easing: Easing.out(Easing.quad) },
        (finished) => {
          if (finished) scheduleOnRN(onDone);
        },
      ),
    );
  }, [appReady, drawn, fading, onDone, opacity]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[styles.container, fadeStyle]}
      onLayout={start}
      // Taps wait until the app shows; the symbol is decoration.
      pointerEvents={fading ? 'none' : 'auto'}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="launch-splash"
    >
      <StatusBar barStyle="light-content" />
      <Svg
        height={symbolWidth / LAUNCH_SYMBOL_ASPECT}
        testID="launch-symbol"
        viewBox={CHURCH_SYMBOL_VIEW_BOX}
        width={symbolWidth}
      >
        {CHURCH_SYMBOL_SHAPES.map((shape, index) => (
          <SymbolShape
            key={shape.d}
            progress={progress}
            shape={shape}
            window={WINDOWS[index]}
          />
        ))}
      </Svg>
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
});
