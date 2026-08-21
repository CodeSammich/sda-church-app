export interface AndroidAudioBrowser {
  name: string;
  packageName: string;
}

export const ANDROID_AUDIO_GUIDANCE_INTERRUPTION_THRESHOLD = 4;

/** The browser app whose Android battery setting governs an installed PWA. */
export const getAndroidAudioBrowser = (
  userAgent: string,
): AndroidAudioBrowser | null => {
  if (!/Android/i.test(userAgent)) return null;
  if (/SamsungBrowser/i.test(userAgent)) {
    return {
      name: 'Samsung Internet',
      packageName: 'com.sec.android.app.sbrowser',
    };
  }
  if (/EdgA/i.test(userAgent)) {
    return { name: 'Microsoft Edge', packageName: 'com.microsoft.emmx' };
  }
  if (/OPR\//i.test(userAgent)) {
    return { name: 'Opera', packageName: 'com.opera.browser' };
  }
  if (/(?:Chrome|CriOS)\//i.test(userAgent)) {
    return { name: 'Google Chrome', packageName: 'com.android.chrome' };
  }
  return null;
};

export const getAndroidAudioBrowserName = (userAgent: string) =>
  getAndroidAudioBrowser(userAgent)?.name || null;

export const getCurrentAndroidAudioBrowser = () =>
  typeof navigator === 'undefined'
    ? null
    : getAndroidAudioBrowser(navigator.userAgent || '');

/**
 * The per-app background-restrictions action is not consistently launchable
 * from an installed browser PWA, even when an Android Settings implementation
 * marks it BROWSABLE. The Apps list is the deepest reliable browser target;
 * guidance names the browser the user should select from there.
 */
export const getAndroidAppsSettingsIntent = () =>
  'intent:#Intent;action=android.settings.APPLICATION_SETTINGS;end';
