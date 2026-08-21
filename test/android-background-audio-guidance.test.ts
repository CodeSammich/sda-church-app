import {
  ANDROID_AUDIO_GUIDANCE_INTERRUPTION_THRESHOLD,
  getAndroidAudioBrowserName,
  getAndroidAppsSettingsIntent,
} from '@/services/AndroidBackgroundAudioGuidance';

describe('Android background-audio guidance', () => {
  it('waits for four unexpected pauses before suggesting Android settings', () => {
    expect(ANDROID_AUDIO_GUIDANCE_INTERRUPTION_THRESHOLD).toBe(4);
  });

  it('identifies the browser app that owns an installed Android PWA', () => {
    expect(
      getAndroidAudioBrowserName(
        'Mozilla/5.0 (Linux; Android 16; Pixel 9a) Chrome/140.0 Mobile',
      ),
    ).toBe('Google Chrome');
    expect(
      getAndroidAudioBrowserName(
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/138.0 SamsungBrowser/28.0 Mobile',
      ),
    ).toBe('Samsung Internet');
    expect(
      getAndroidAudioBrowserName(
        'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/138.0 EdgA/138.0 Mobile',
      ),
    ).toBe('Microsoft Edge');
  });

  it('does not show Android guidance on desktop or iOS', () => {
    expect(getAndroidAudioBrowserName('Mozilla/5.0 (iPhone) CriOS/140.0')).toBeNull();
    expect(getAndroidAudioBrowserName('Mozilla/5.0 Chrome/140.0')).toBeNull();
  });

  it('builds a user-gesture intent for the reliable Android Apps settings', () => {
    expect(getAndroidAppsSettingsIntent()).toBe(
      'intent:#Intent;action=android.settings.APPLICATION_SETTINGS;end',
    );
  });
});
