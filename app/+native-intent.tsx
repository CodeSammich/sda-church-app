import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

/**
 * Hands Expo Router the link that opened the app, such as a tap on the verse
 * of the day widget (#742).
 *
 * On Android, Expo Router starts at React Native's initial URL, which is the
 * link the app's task was first opened with. After Android has stopped the
 * app in the background, a tap on the widget brings that old task back: the
 * app started at the old link, such as yesterday's verse, and the widget's
 * new link arrived before Expo Router listened for links, so it was lost and
 * the app stayed there, or on Home. expo-linking keeps the newest link,
 * whichever way it came, so the app starts there instead. iOS already does.
 *
 * Each link is used once: expo-linking keeps it for as long as the app runs,
 * and it would otherwise come back the next time the app's screens start.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  if (Platform.OS !== 'android') return path;
  const newest = initial ? Linking.getLinkingURL() : null;
  Linking.clearInitialURL();
  return newest ?? path;
}
