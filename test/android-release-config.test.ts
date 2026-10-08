import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const {
  addPhonePortraitLock,
  removeManifestOrientation,
} = require('../plugins/withAndroidPhonePortrait');

const appJson = JSON.parse(readFileSync(resolve(process.cwd(), 'app.json'), 'utf8')).expo;

// The parts of Expo's template MainActivity.kt the plugin edits.
const templateMainActivity = `package org.example.app
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle

import com.facebook.react.ReactActivity

class MainActivity : ReactActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    SplashScreenManager.registerOnActivity(this)
    super.onCreate(null)
  }

  override fun getMainComponentName(): String = "main"
}
`;

const manifestWithPortrait = () => ({
  manifest: {
    application: [
      {
        $: { 'android:name': '.MainApplication' },
        activity: [
          {
            $: {
              'android:name': '.MainActivity',
              'android:screenOrientation': 'portrait',
              'android:exported': 'true',
            },
            'intent-filter': [
              {
                action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
              },
            ],
          },
        ],
      },
    ],
  },
});

describe('Android phone-only portrait (#426)', () => {
  it('removes the manifest orientation lock that Play flags', () => {
    const activity = removeManifestOrientation(manifestWithPortrait()).manifest.application[0].activity[0];
    expect(activity.$).not.toHaveProperty('android:screenOrientation');
    expect(activity.$['android:exported']).toBe('true');
  });

  it('locks portrait at run time on phones, before the first layout', () => {
    const contents = addPhonePortraitLock(templateMainActivity);
    expect(contents).toContain('import android.content.pm.ActivityInfo\n');
    expect(contents).toContain('import android.content.res.Configuration\n');
    expect(contents.match(/import android\.os\.Build\n/g)).toHaveLength(1);
    // Set every time rather than compared with requestedOrientation first, so
    // the result never depends on what Android reports back.
    expect(contents).toContain('requestedOrientation = if (smallestWidthDp < 600) {');
    expect(contents).toContain('ActivityInfo.SCREEN_ORIENTATION_PORTRAIT');
    expect(contents).toContain('ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED');
    // Rechecked when a foldable folds or unfolds.
    expect(contents).toMatch(/override fun onConfigurationChanged\(newConfig: Configuration\) \{\n\s+super\.onConfigurationChanged\(newConfig\)\n\s+lockPortraitOnPhones\(\)/);
    expect(contents).toMatch(/lockPortraitOnPhones\(\)\n\s+super\.onCreate\(null\)/);
  });

  it('edits MainActivity only once', () => {
    const once = addPhonePortraitLock(templateMainActivity);
    expect(addPhonePortraitLock(once)).toBe(once);
  });

  it("fails the build when Expo's template no longer matches", () => {
    expect(() => addPhonePortraitLock('package org.example.app\nclass MainActivity : AppCompatActivity() {\n}\n'))
      .toThrow('Could not find the MainActivity class and onCreate');
  });

  it('keeps the iPhone in portrait', () => {
    // app.json's orientation is what sets the iPhone's orientations, so the
    // Android change is a plugin, not an app.json change.
    expect(appJson.orientation).toBe('portrait');
    expect(appJson.plugins).toContain('./plugins/withAndroidPhonePortrait');
  });
});

describe('Android release shrinking (#428)', () => {
  it('shrinks code and unused resources in release builds', () => {
    const buildProperties = appJson.plugins.find(
      (plugin: unknown) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
    );
    expect(buildProperties?.[1].android).toMatchObject({
      enableMinifyInReleaseBuilds: true,
      enableShrinkResourcesInReleaseBuilds: true,
    });
  });
});
