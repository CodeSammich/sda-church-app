import * as Linking from 'expo-linking';
import { Platform } from 'react-native';

import { redirectSystemPath } from '@/app/+native-intent';

jest.mock('expo-linking', () => ({
  getLinkingURL: jest.fn(),
  clearInitialURL: jest.fn(),
}));

const getLinkingURL = Linking.getLinkingURL as jest.Mock;
const clearInitialURL = Linking.clearInitialURL as jest.Mock;

// The task's first link, which React Native reports as the initial URL, and
// the widget's link, which brought the task back after Android stopped the app.
const OLD_LINK = 'sdachurchapp://bible?translationId=BSB&bookId=JHN&chapter=3&verseStart=16&verseEnd=16&referenceRequest=widget-1';
const WIDGET_LINK = 'sdachurchapp://bible?translationId=BSB&bookId=JER&chapter=29&verseStart=13&verseEnd=13&referenceRequest=widget-2';
const ROOT = 'sdachurchapp:///';

beforeEach(() => {
  getLinkingURL.mockReset();
  clearInitialURL.mockReset();
});

describe('the link the app starts at on Android (#742)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'android');
  });

  it("is the widget's link, not the link the app's task was first opened with", () => {
    getLinkingURL.mockReturnValue(WIDGET_LINK);
    expect(redirectSystemPath({ path: OLD_LINK, initial: true })).toBe(WIDGET_LINK);
  });

  it("is the widget's link when it came before Expo Router listened, not Home", () => {
    getLinkingURL.mockReturnValue(WIDGET_LINK);
    expect(redirectSystemPath({ path: ROOT, initial: true })).toBe(WIDGET_LINK);
  });

  it('is Home when the app was opened from its icon', () => {
    getLinkingURL.mockReturnValue(null);
    expect(redirectSystemPath({ path: ROOT, initial: true })).toBe(ROOT);
  });

  it('is used once, so it never comes back when the screens start again', () => {
    getLinkingURL.mockReturnValue(WIDGET_LINK);
    redirectSystemPath({ path: ROOT, initial: true });
    expect(clearInitialURL).toHaveBeenCalledTimes(1);
  });

  it('leaves a link that comes while the app runs as it is, and forgets it once used', () => {
    getLinkingURL.mockReturnValue(OLD_LINK);
    expect(redirectSystemPath({ path: WIDGET_LINK, initial: false })).toBe(WIDGET_LINK);
    expect(getLinkingURL).not.toHaveBeenCalled();
    expect(clearInitialURL).toHaveBeenCalledTimes(1);
  });
});

describe('the link the app starts at elsewhere', () => {
  it.each(['ios', 'web'] as const)('is left to Expo Router on %s', (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    getLinkingURL.mockReturnValue(WIDGET_LINK);
    expect(redirectSystemPath({ path: OLD_LINK, initial: true })).toBe(OLD_LINK);
    expect(clearInitialURL).not.toHaveBeenCalled();
  });
});
