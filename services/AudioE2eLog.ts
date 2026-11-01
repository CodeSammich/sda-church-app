/**
 * Whether this is the build the Android audio e2e runs on
 * (.github/workflows/android-audio-e2e.yml, scripts/e2e/android-bible-audio.sh).
 * It sets EXPO_PUBLIC_AUDIO_E2E=1, which Expo writes into the app when it's
 * built; the store builds and the APK the Android preview publishes don't.
 */
export const isAudioE2eBuild = () => process.env.EXPO_PUBLIC_AUDIO_E2E === '1';

/**
 * Logs what the Bible reader decided, such as which verse it followed, for the
 * e2e's checks (`app_log_has`): the screen keeps moving while audio plays, so
 * uiautomator can't read it. Only the e2e build logs these.
 */
export const logForAudioE2e = (message: string) => {
  if (isAudioE2eBuild()) console.log(`Bible reader: ${message}`);
};
