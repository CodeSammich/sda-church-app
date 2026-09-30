import { Platform } from 'react-native';

/** Whether the web app is installed, running from the home screen. */
export const isInstalledPwa = () => {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof navigator === 'undefined'
  ) {
    return false;
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigatorWithStandalone.standalone === true
  );
};

/**
 * Whether browser history holds the Android back guard: in the installed web
 * app on Android, app/_layout.tsx keeps an extra history entry so the system
 * back gesture stays in the app, and handles the gesture itself.
 */
export const hasAndroidWebBackGuard = () =>
  isInstalledPwa() && /Android/i.test(navigator.userAgent);
