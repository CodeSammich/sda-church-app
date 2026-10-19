import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  SCREENSHOT_ROUTE_KEY,
  getScreenshotPopup,
  parseScreenshotRoute,
  takeScreenshotRoute,
} from '@/services/ScreenshotRoute';

const { readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const withKeyScreensBuild = (value: string | undefined) => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_KEY_SCREENS;
  else process.env.EXPO_PUBLIC_KEY_SCREENS = value;
};

describe('saved screen for the key-screen capture', () => {
  beforeEach(() => withKeyScreensBuild('1'));
  afterAll(() => withKeyScreensBuild(undefined));

  it('turns a deep-link path into an app route', () => {
    expect(parseScreenshotRoute('bible?bookId=PSA&chapter=23&translationId=BSB')).toBe(
      '/bible?bookId=PSA&chapter=23&translationId=BSB',
    );
    expect(parseScreenshotRoute('explore/library/egw')).toBe('/explore/library/egw');
    expect(parseScreenshotRoute('/you')).toBe('/you');
    expect(parseScreenshotRoute('bible?backTo=%2F')).toBe('/bible?backTo=%2F');
  });

  it('ignores anything that isn’t a plain in-app path', () => {
    for (const value of [null, '', '   ', 'https://example.com', '//example.com', '../etc', 'you<script>', 'a b']) {
      expect(parseScreenshotRoute(value)).toBeNull();
    }
  });

  it('opens the saved screen once, then forgets it', async () => {
    await AsyncStorage.setItem(SCREENSHOT_ROUTE_KEY, 'explore');
    expect(await takeScreenshotRoute()).toBe('/explore');
    expect(await AsyncStorage.getItem(SCREENSHOT_ROUTE_KEY)).toBeNull();
    expect(await takeScreenshotRoute()).toBeNull();
  });

  it('does nothing on a normal launch', async () => {
    await AsyncStorage.removeItem(SCREENSHOT_ROUTE_KEY);
    expect(await takeScreenshotRoute()).toBeNull();
  });

  it('never reads a saved screen outside the Simulator preview build', async () => {
    for (const value of [undefined, '', '0', 'true']) {
      withKeyScreensBuild(value);
      await AsyncStorage.setItem(SCREENSHOT_ROUTE_KEY, 'explore');
      expect(await takeScreenshotRoute()).toBeNull();
      // Left untouched: the store builds don't even look.
      expect(await AsyncStorage.getItem(SCREENSHOT_ROUTE_KEY)).toBe('explore');
    }
    await AsyncStorage.removeItem(SCREENSHOT_ROUTE_KEY);
  });

  it('opens a popup the screen knows, from the path (#372)', () => {
    expect(getScreenshotPopup('text-size', ['language', 'text-size'])).toBe('text-size');
    for (const value of [undefined, '', 'settings', ['text-size']]) {
      expect(getScreenshotPopup(value, ['language', 'text-size'])).toBeNull();
    }
  });

  it('never opens a popup from a link outside the Simulator preview build', () => {
    for (const value of [undefined, '', '0', 'true']) {
      withKeyScreensBuild(value);
      expect(getScreenshotPopup('verse', ['verse'])).toBeNull();
    }
  });
});

describe('which builds can open a saved screen', () => {
  const workflows = join(__dirname, '..', '.github', 'workflows');
  const setters = readdirSync(workflows)
    .filter((name: string) => readFileSync(join(workflows, name), 'utf8').includes('EXPO_PUBLIC_KEY_SCREENS'));

  it('is only the key-screen builds: the iOS Simulator app and the Android emulator APK', () => {
    expect(setters).toEqual(['android-key-screens.yml', 'ios-pr-preview.yml']);
    for (const [file, name] of [
      ['ios-pr-preview.yml', 'Build for the Simulator without signing'],
      ['android-key-screens.yml', 'Build the emulator APK'],
    ]) {
      const workflow = readFileSync(join(workflows, file), 'utf8');
      const step = workflow.slice(workflow.indexOf(`- name: ${name}`));
      expect({ file, sets: step.slice(0, step.indexOf('run: |')).includes("EXPO_PUBLIC_KEY_SCREENS: '1'") }).toEqual({
        file,
        sets: true,
      });
      expect(workflow.match(/EXPO_PUBLIC_KEY_SCREENS: '1'/g)).toHaveLength(1);
    }
    // The APK the Android preview publishes is a different build, without it.
    expect(readFileSync(join(workflows, 'android-pr-preview.yml'), 'utf8')).not.toContain('KEY_SCREENS');
  });

  it('isn’t set anywhere a store build could pick it up', () => {
    const root = join(__dirname, '..');
    for (const file of ['app.json', 'package.json', 'eas.json', '.env', '.env.production']) {
      let text = '';
      try {
        text = readFileSync(join(root, file), 'utf8');
      } catch {
        continue;
      }
      expect(text).not.toContain('EXPO_PUBLIC_KEY_SCREENS');
    }
  });
});
