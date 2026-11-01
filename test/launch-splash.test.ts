import {
  getLaunchSymbolWidth,
  LAUNCH_BACKGROUND,
  LAUNCH_SYMBOL_ASPECT,
  LaunchSplash,
} from '@/components/LaunchSplash';
import { act, fireEvent, render } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { AccessibilityInfo } from 'react-native';

jest.mock('expo-splash-screen', () => ({
  hideAsync: jest.fn(() => Promise.resolve()),
  preventAutoHideAsync: jest.fn(() => Promise.resolve(true)),
  setOptions: jest.fn(),
}));

// The splash is decoration, hidden from screen readers.
const HIDDEN = { includeHiddenElements: true };

// Lets the Reduce Motion lookup's promise settle.
const settle = () => act(async () => {});

const renderSplash = async (appReady: boolean, reduceMotion = false) => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(reduceMotion);
  const onDone = jest.fn();
  const screen = await render(createElement(LaunchSplash, { appReady, onDone }));
  await settle();
  const ready = () => screen.rerender(createElement(LaunchSplash, { appReady: true, onDone }));
  return { screen, onDone, ready };
};

const wait = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
  });

describe('the launch animation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('draws the symbol at half the screen\'s narrower side, at most 300 points', () => {
    expect(getLaunchSymbolWidth(393, 852)).toBe(197);
    expect(getLaunchSymbolWidth(852, 393)).toBe(197);
    expect(getLaunchSymbolWidth(320, 568)).toBe(160);
    expect(getLaunchSymbolWidth(1024, 1366)).toBe(300);
  });

  it('hides the phone\'s launch screen at once when its blue is drawn', async () => {
    const { screen } = await renderSplash(false);
    await fireEvent(screen.getByTestId('launch-splash', HIDDEN), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 393, height: 852 } },
    });
    expect(SplashScreen.setOptions).toHaveBeenCalledWith({ duration: 0, fade: false });
    expect(SplashScreen.hideAsync).toHaveBeenCalled();
  });

  it('plays once the symbol has loaded, and waits for the app before fading', async () => {
    const { screen, onDone, ready } = await renderSplash(false);
    await fireEvent(screen.getByTestId('launch-symbol', HIDDEN), 'load');
    await wait(3000);
    // Finished, but the app underneath hasn't loaded.
    expect(onDone).not.toHaveBeenCalled();
    expect(screen.getByTestId('launch-splash', HIDDEN).props.pointerEvents).toBe('auto');

    await ready();
    await wait(100);
    // Taps reach the app as soon as it starts to show.
    expect(screen.getByTestId('launch-splash', HIDDEN).props.pointerEvents).toBe('none');
    await wait(400);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('takes about a second when the app is already loaded', async () => {
    const { screen, onDone } = await renderSplash(true);
    await fireEvent(screen.getByTestId('launch-symbol', HIDDEN), 'load');
    await wait(1000);
    expect(onDone).not.toHaveBeenCalled();
    await wait(400);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('shows the finished symbol still with Reduce Motion, then fades', async () => {
    const { screen, onDone } = await renderSplash(true, true);
    await fireEvent(screen.getByTestId('launch-symbol', HIDDEN), 'load');
    // Only the short hold and fade, no rise.
    await wait(400);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('starts anyway if the symbol never reports loading', async () => {
    const { onDone } = await renderSplash(true);
    // It gives up waiting after half a second, then rises and fades.
    await wait(500);
    await wait(1000);
    expect(onDone).not.toHaveBeenCalled();
    await wait(400);
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('the launch screen and symbol', () => {
  it('leaves the phone\'s launch screen plain blue, in the animation\'s blue', () => {
    const plugins = JSON.parse(readFileSync('app.json', 'utf8')).expo.plugins;
    const [, splash] = plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen',
    );
    // An image there would show before the animation, then vanish for it to rise.
    expect(splash).toEqual({ backgroundColor: LAUNCH_BACKGROUND });
  });

  it('is the icon\'s white symbol unchanged: white everywhere, only its coverage varies', async () => {
    const sharp = require('sharp');
    const { data, info } = await sharp('assets/images/church-symbol.png')
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect(info.channels).toBe(4);
    expect(info.width / info.height).toBeCloseTo(LAUNCH_SYMBOL_ASPECT, 6);
    let coloured = 0;
    let covered = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] !== 255 || data[i + 1] !== 255 || data[i + 2] !== 255) coloured++;
      if (data[i + 3]) covered++;
    }
    expect(coloured).toBe(0);
    expect(covered).toBeGreaterThan(0);
  });

  it('is skipped by the key-screen builds and the web', () => {
    const root = readFileSync('app/_layout.tsx', 'utf8');
    expect(root).toContain("const playsLaunchAnimation = Platform.OS !== 'web' && !isKeyScreensBuild();");
    expect(root).toContain('useState(playsLaunchAnimation)');
  });
});
