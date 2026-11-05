import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * The screen to open at the next launch, saved by the key-screen capture
 * (scripts/capture-ios-screens.cjs, #331, and capture-android-screens.cjs,
 * #372). The iOS Simulator asks "Open in …?" before following a deep link, and
 * nothing on a build runner can tap that, so the capture saves the screen here
 * with the other settings and launches the app instead. Android uses the same
 * way in. The app opens it once and forgets it.
 */
export const SCREENSHOT_ROUTE_KEY = 'screenshot-route';

/**
 * Where a key-screens build opens first-launch setup: the step the capture
 * saved, by name, such as `contrast`, since it can't tap Next (#669).
 */
export const SCREENSHOT_SETUP_STEP_KEY = 'screenshot-setup-step';

/**
 * Whether this is a key-screens build: the iOS Simulator build or the Android
 * emulator build the capture runs on. Those set EXPO_PUBLIC_KEY_SCREENS=1,
 * which Expo writes into the app when it's built; the store builds and the
 * APK the Android preview publishes don't, so on a real phone the app never
 * even looks for a saved screen.
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
 * Outside a key-screens build, it returns null without reading storage.
 */
export const takeScreenshotRoute = async (): Promise<string | null> => {
  if (!isKeyScreensBuild()) return null;
  const value = await AsyncStorage.getItem(SCREENSHOT_ROUTE_KEY);
  if (value === null) return null;
  await AsyncStorage.removeItem(SCREENSHOT_ROUTE_KEY);
  return parseScreenshotRoute(value);
};

/**
 * A key-screen path can also open the Bible's search with `search=`, which
 * components/GlobalHeader.tsx reads in a key-screens build only (#516).
 *
 * The popup a key-screen path asks for with `popup=`, such as
 * `bible?…&verseStart=16&popup=verse`, if it's one the screen can open. The
 * capture can't tap, so this is how it shows a popup or dialog (#372).
 * Outside a key-screens build it's always null, so a real link can't open
 * one.
 */
export const getScreenshotPopup = <T extends string>(
  value: string | string[] | undefined,
  popups: readonly T[],
): T | null =>
  isKeyScreensBuild() && typeof value === 'string' && (popups as readonly string[]).includes(value)
    ? (value as T)
    : null;

/**
 * Whether a key-screen path asks the Bible to play its chapter's audio, with
 * `play=1`, as a tap on Play would (#551). The iPhone key screens check that
 * its elapsed time moves. Outside a key-screens build it's always false, so a
 * real link can't start audio.
 */
export const isScreenshotPlay = (value: string | string[] | undefined) =>
  isKeyScreensBuild() && value === '1';

/**
 * Where a key-screens build records how a checked action went, for the capture
 * to read from the app's storage (scripts/key-screen-records.cjs, #551): the
 * Bible player's status after play=1, and how a children's lesson opened. The
 * capture explains a failure with it, such as hosts the network couldn't reach.
 */
export const SCREENSHOT_RECORD_KEYS = {
  audio: 'screenshot-audio',
  lesson: 'screenshot-lesson',
} as const;

/** Saves a record for the capture, in a key-screens build only. */
export const recordForScreenshot = (
  kind: keyof typeof SCREENSHOT_RECORD_KEYS,
  record: Readonly<Record<string, unknown>>,
) => {
  if (!isKeyScreensBuild()) return;
  AsyncStorage.setItem(SCREENSHOT_RECORD_KEYS[kind], JSON.stringify(record)).catch(() => {});
};
