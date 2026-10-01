import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The screen to open at the next launch, saved by the key-screen capture
 * (scripts/capture-ios-screens.cjs, #331). The iOS Simulator asks "Open in …?"
 * before following a deep link, and nothing on a build runner can tap that, so
 * the capture saves the screen here and launches the app instead. The app opens
 * it once and forgets it.
 */
export const SCREENSHOT_ROUTE_KEY = 'screenshot-route';

/**
 * Whether this is the iOS PR preview's Simulator build, the only one the
 * capture runs on. That build sets EXPO_PUBLIC_KEY_SCREENS=1, which Expo writes
 * into the app when it's built; the store builds don't, so on a real phone the
 * app never even looks for a saved screen.
 */
export const isKeyScreensBuild = () => process.env.EXPO_PUBLIC_KEY_SCREENS === '1';

/**
 * Turns a saved path such as `bible?bookId=PSA&chapter=23` into an app route,
 * or null if it isn't a plain in-app path.
 */
export const parseScreenshotRoute = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (trimmed.includes('//') || trimmed.includes('..')) return null;
  const path = trimmed.replace(/^\//, '');
  if (!path) return null;
  if (!/^[A-Za-z0-9/_\-?=&%.]+$/.test(path)) return null;
  return `/${path}`;
};

/**
 * Reads and removes the saved screen, returning its route if there was one.
 * Outside the Simulator preview build, it returns null without reading storage.
 */
export const takeScreenshotRoute = async (): Promise<string | null> => {
  if (!isKeyScreensBuild()) return null;
  const value = await AsyncStorage.getItem(SCREENSHOT_ROUTE_KEY);
  if (value === null) return null;
  await AsyncStorage.removeItem(SCREENSHOT_ROUTE_KEY);
  return parseScreenshotRoute(value);
};
