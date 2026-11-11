import { useEffect, useSyncExternalStore } from 'react';
import { StatusBar, type StatusBarStyle } from 'react-native';

/**
 * The status bar's style on iOS comes from the screens, not the app (#733).
 * Expo's template sets `UIViewControllerBasedStatusBarAppearance` from 58.0.32,
 * as apps built with the iOS 27 SDK must, and with it react-native-screens'
 * screens decide the status bar: React Native's `StatusBar` alone no longer
 * reaches it. So the root layout gives its Stack the style as
 * `statusBarStyle`, and every screen below falls back to it. React Native's
 * `StatusBar` still sets Android's, and the style a full-screen `Modal` keeps.
 */

let requests = 0;
const listeners = new Set<() => void>();

const notify = () => {
  for (const listener of listeners) listener();
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const getLightRequested = () => requests > 0;

/**
 * Light status bar icons while this is shown, over a dark picture: the launch
 * splash, or a hero under the status bar. Show it only while its page is
 * focused.
 */
export function LightStatusBar() {
  useEffect(() => {
    requests++;
    notify();
    return () => {
      requests--;
      notify();
    };
  }, []);
  return <StatusBar barStyle="light-content" />;
}

/** Whether a `LightStatusBar` is shown. */
export function useLightStatusBarRequested() {
  return useSyncExternalStore(subscribe, getLightRequested, getLightRequested);
}

/**
 * The root Stack's `statusBarStyle` on iOS: light while a `LightStatusBar` is
 * shown, otherwise the app's own style (the theme's, or the launch splash's).
 */
export function getScreenStatusBarStyle(
  style: StatusBarStyle,
  lightRequested: boolean,
): 'light' | 'dark' | 'auto' {
  if (lightRequested || style === 'light-content') return 'light';
  return style === 'dark-content' ? 'dark' : 'auto';
}
