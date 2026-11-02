import {
  getDrawingWindows,
  getFillAmount,
  getPenAmount,
} from '@/components/LaunchDrawing';
import {
  getLaunchSymbolWidth,
  LAUNCH_BACKGROUND,
  LaunchSplash,
} from '@/components/LaunchSplash';
import { CHURCH_SYMBOL_SHAPES, CHURCH_SYMBOL_VIEW_BOX } from '@/constants/ChurchSymbol';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { StyleSheet } from 'react-native';

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  setOptions: jest.fn(),
}));
// Frames run only when a test calls runFrames.
const mockFrameCallbacks = new Set<(frame: { timeSincePreviousFrame: number }) => void>();

// Timed animations finish at once, and a shared value that changes runs the
// reactions watching it, as on the UI thread. Reanimated's own mock can't start
// in Jest (its CSS animations need the native module), so this covers what
// LaunchSplash uses.
jest.mock('react-native-reanimated', () => {
  const { useEffect, useRef } = require('react') as typeof import('react');
  const { View } = require('react-native');
  const reactions = new Set<() => void>();
  const run = (worklet: () => unknown) => worklet();
  return {
    __esModule: true,
    default: { View, createAnimatedComponent: (component: unknown) => component },
    Easing: { linear: (t: number) => t },
    useAnimatedProps: run,
    useAnimatedReaction: (
      prepare: () => unknown,
      react: (now: unknown, before: unknown) => void,
    ) => {
      const previous = useRef<unknown>(null);
      useEffect(() => {
        const reaction = () => {
          const before = previous.current;
          previous.current = prepare();
          react(previous.current, before);
        };
        reactions.add(reaction);
        reaction();
        return () => {
          reactions.delete(reaction);
        };
      });
    },
    useAnimatedStyle: run,
    useFrameCallback: (callback: (frame: { timeSincePreviousFrame: number }) => void) => {
      useEffect(() => {
        mockFrameCallbacks.add(callback);
        return () => {
          mockFrameCallbacks.delete(callback);
        };
      });
    },
    useReducedMotion: () => false,
    useSharedValue: (initial: unknown) => {
      const shared = useRef<{ value: unknown } | null>(null);
      if (!shared.current) {
        let current = initial;
        shared.current = {
          get value() {
            return current;
          },
          set value(next: unknown) {
            current = next;
            reactions.forEach((reaction) => reaction());
          },
        };
      }
      return shared.current;
    },
    withTiming: (value: number, _config: unknown, done?: (finished: boolean) => void) => {
      done?.(true);
      return value;
    },
  };
});
jest.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: (...args: unknown[]) => void, ...args: unknown[]) => fn(...args),
}));

// The splash is decoration, hidden from screen readers.
const HIDDEN = { includeHiddenElements: true };
const LAYOUT = { nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 852 } } };
type Screen = Awaited<ReturnType<typeof render>>;
const getSplash = (screen: Screen) => screen.getByTestId('launch-splash', HIDDEN);
const getPointerEvents = (screen: Screen) =>
  StyleSheet.flatten(getSplash(screen).props.style).pointerEvents;
// Runs `count` frames, `ms` apart. A 60 Hz screen draws a frame every 16 ms.
const runFrames = (count: number, ms = 16) => {
  for (let i = 0; i < count; i++) {
    mockFrameCallbacks.forEach((callback) => callback({ timeSincePreviousFrame: ms }));
  }
};

const windows = getDrawingWindows(CHURCH_SYMBOL_SHAPES);
const shapesWith = (role: string) =>
  CHURCH_SYMBOL_SHAPES.map((shape, index) => ({ ...shape, window: windows[index] }))
    .filter((shape) => shape.role === role);

describe('the launch drawing', () => {
  it('draws the open Bible and the cross first', () => {
    for (const bible of shapesWith('bible')) {
      expect(bible.window.penStart).toBe(0);
      for (const flame of shapesWith('flame')) {
        expect(flame.window.penStart).toBeGreaterThan(bible.window.penStart);
      }
    }
  });

  it('draws the flame\'s lines one after another, each reaching higher, ending at its tip', () => {
    const flames = shapesWith('flame').sort((a, b) => a.window.penStart - b.window.penStart);
    expect(flames).toHaveLength(6);
    for (let i = 1; i < flames.length; i++) {
      expect(flames[i].top).toBeLessThan(flames[i - 1].top);
    }
    expect(flames.at(-1)!.top).toBe(Math.min(...CHURCH_SYMBOL_SHAPES.map((shape) => shape.top)));
  });

  it('starts with nothing, and ends with every shape filled and no pen line left', () => {
    for (const window of windows) {
      expect(getFillAmount(0, window)).toBe(0);
      expect(getPenAmount(0, window)).toBe(0);
      expect(getFillAmount(1, window)).toBe(1);
      expect(getPenAmount(1, window)).toBe(1);
    }
  });

  it('draws each outline from its lowest point up to its highest', () => {
    const first = (d: string) => Number(d.match(/^M[\d.-]+,([\d.-]+)/)![1]);
    const last = (d: string) => Number(d.match(/,([\d.-]+)$/)![1]);
    for (const shape of CHURCH_SYMBOL_SHAPES) {
      for (const half of shape.pen) {
        expect(first(half.d)).toBeCloseTo(shape.bottom, 1);
        expect(last(half.d)).toBeCloseTo(shape.top, 1);
      }
    }
  });

  it('shows the repeated edge only once the page it repeats has filled', () => {
    const edge = shapesWith('bible').find((shape) => shape.repeatsEdge)!;
    const page = shapesWith('bible').find((shape) => shape.pen.length && shape.bottom > 285)!;
    expect(edge.window.fillEnd).toBe(page.window.fillEnd);
    expect(getFillAmount(page.window.fillEnd - 0.01, edge.window)).toBe(0);
  });

  it('finishes on the NAD\'s official symbol, pixel for pixel', async () => {
    const sharp = require('sharp');
    const [, , width, height] = CHURCH_SYMBOL_VIEW_BOX.split(' ').map(Number);
    const size = `width="1080" height="${Math.round((1080 * height) / width)}"`;
    const official = readFileSync('assets/images/brand/nad-symbol.svg', 'utf8')
      .replace(/viewBox="[^"]*"/, `viewBox="${CHURCH_SYMBOL_VIEW_BOX}" ${size}`);
    const drawn = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${CHURCH_SYMBOL_VIEW_BOX}" ${size}>
      <rect width="360" height="360" fill="${LAUNCH_BACKGROUND}"/>
      ${CHURCH_SYMBOL_SHAPES.map((shape) => `<path d="${shape.d}" fill="#FFFFFF"/>`).join('')}
    </svg>`;
    const [a, b] = await Promise.all(
      [official, drawn].map((svg) => sharp(Buffer.from(svg)).removeAlpha().raw().toBuffer()),
    );
    expect(a.equals(b)).toBe(true);
  });
});

describe('the launch animation', () => {
  it('draws the symbol at half the screen\'s narrower side, at most 300 points', () => {
    expect(getLaunchSymbolWidth(393, 852)).toBe(197);
    expect(getLaunchSymbolWidth(852, 393)).toBe(197);
    expect(getLaunchSymbolWidth(320, 568)).toBe(160);
    expect(getLaunchSymbolWidth(1024, 1366)).toBe(300);
  });

  it('hides the phone\'s launch screen at once when its blue is drawn', async () => {
    const screen = await render(createElement(LaunchSplash, { appReady: false, onDone: jest.fn() }));
    await fireEvent(getSplash(screen), 'layout', LAYOUT);
    expect(SplashScreen.setOptions).toHaveBeenCalledWith({ duration: 0, fade: false });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  });

  it('waits for the app to load before fading, then lets taps through', async () => {
    const onDone = jest.fn();
    const screen = await render(createElement(LaunchSplash, { appReady: false, onDone }));
    await fireEvent(getSplash(screen), 'layout', LAYOUT);
    // Drawn, but the app underneath hasn't loaded.
    runFrames(30);
    expect(onDone).not.toHaveBeenCalled();
    expect(getPointerEvents(screen)).toBe('auto');

    await act(async () => {
      await screen.rerender(createElement(LaunchSplash, { appReady: true, onDone }));
    });
    runFrames(1);
    // Rendered again to read the fading style, which the phone sets by itself.
    await screen.rerender(createElement(LaunchSplash, { appReady: true, onDone }));
    expect(getPointerEvents(screen)).toBe('none');
    runFrames(11);
    expect(onDone).not.toHaveBeenCalled();
    runFrames(1);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('fades on after a frame the phone takes long to draw, rather than skip to the end', async () => {
    const onDone = jest.fn();
    const screen = await render(createElement(LaunchSplash, { appReady: true, onDone }));
    await fireEvent(getSplash(screen), 'layout', LAYOUT);
    // The first frame that shows the app, held up for half a second.
    runFrames(1, 500);
    expect(onDone).not.toHaveBeenCalled();
    runFrames(6);
    expect(onDone).not.toHaveBeenCalled();
    runFrames(5);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('skips the drawing on a tap, and shows the app once it has loaded', async () => {
    const Reanimated = require('react-native-reanimated');
    // The drawing never finishes by itself.
    jest.spyOn(Reanimated, 'withTiming').mockReturnValue(0);
    const onDone = jest.fn();
    const screen = await render(createElement(LaunchSplash, { appReady: true, onDone }));
    await fireEvent(getSplash(screen), 'layout', LAYOUT);
    runFrames(30);
    expect(onDone).not.toHaveBeenCalled();

    await fireEvent(getSplash(screen), 'touchEnd');
    runFrames(13);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the finished symbol still with Reduce Motion', async () => {
    const Reanimated = require('react-native-reanimated');
    jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
    const timing = jest.spyOn(Reanimated, 'withTiming');
    const onDone = jest.fn();
    await render(createElement(LaunchSplash, { appReady: true, onDone }));
    runFrames(13);
    // It faded without drawing, or waiting for the drawing to start.
    expect(timing).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('the launch screen', () => {
  it('leaves the phone\'s launch screen plain blue, in the animation\'s blue', () => {
    const plugins = JSON.parse(readFileSync('app.json', 'utf8')).expo.plugins;
    const [, splash] = plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );
    // An image there would show before the drawing, then vanish for it.
    expect(splash).toEqual({ backgroundColor: LAUNCH_BACKGROUND });
  });

  it('is skipped by the key-screen builds and the web', () => {
    const root = readFileSync('app/_layout.tsx', 'utf8');
    expect(root).toContain("const playsLaunchAnimation = Platform.OS !== 'web' && !isKeyScreensBuild();");
    expect(root).toContain('useState(playsLaunchAnimation)');
  });
});
