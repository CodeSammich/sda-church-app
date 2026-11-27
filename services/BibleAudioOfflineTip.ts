import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * A one-time tip (#801): the first time the connection drops while Bible audio
 * plays a chapter that isn't downloaded, with the app open, the popup that the
 * line's "not downloaded" link opens shows by itself, once. It's only for
 * someone who has never had Bible audio on the phone. Nothing else announces
 * it: no sound, no notification, nothing while the app is in the background.
 */
export const BIBLE_AUDIO_OFFLINE_TIP_STORAGE_KEY = 'bible-audio-offline-tip';

// undefined until AsyncStorage has been read.
let shown: boolean | undefined;
let loading: Promise<void> | null = null;

/** Reads whether the tip has been shown, once. Until it has, the tip doesn't show. */
export const loadBibleAudioOfflineTip = () => {
  loading ??= AsyncStorage.getItem(BIBLE_AUDIO_OFFLINE_TIP_STORAGE_KEY)
    .then((value) => {
      // Shown meanwhile is newer.
      shown ??= value === 'shown';
    })
    .catch((error) => {
      console.warn('Could not read the Bible audio offline tip:', error);
      // Unread is treated as shown, so it can never show twice.
      shown ??= true;
    });
  return loading;
};

/**
 * Whether the connection dropping now shows the tip: never shown, the app is
 * open, the chapter isn't downloaded, and no Bible audio has ever been on the
 * phone.
 */
export const shouldShowBibleAudioOfflineTip = ({
  appActive,
  chapterDownloaded,
  hasEverDownloaded,
}: Readonly<{ appActive: boolean; chapterDownloaded: boolean; hasEverDownloaded: boolean }>) =>
  shown === false && appActive && !chapterDownloaded && !hasEverDownloaded;

/** The tip showed, so it never shows again. */
export const noteBibleAudioOfflineTipShown = () => {
  shown = true;
  AsyncStorage.setItem(BIBLE_AUDIO_OFFLINE_TIP_STORAGE_KEY, 'shown').catch((error) =>
    console.warn('Could not save the Bible audio offline tip:', error),
  );
};

/** Forgets everything, for tests. */
export const resetBibleAudioOfflineTipForTests = () => {
  shown = undefined;
  loading = null;
};
