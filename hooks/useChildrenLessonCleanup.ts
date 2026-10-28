import { pruneChildrenLessons } from '@/features/sabbath-school/LessonDownloads';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

// Long enough for the app to finish opening first.
const DELAY_MS = 5_000;

/**
 * Deletes the children's lesson copies whose week is over, a few seconds after
 * the app opens or comes back (#529), so they go even if the person doesn't
 * open another lesson. It uses no network. Not on the web,
 * where the browser opens the PDFs.
 */
export function useChildrenLessonCleanup() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        pruneChildrenLessons().catch(() => {
          // The next time the app opens tries again.
        });
      }, DELAY_MS);
    };
    schedule();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') schedule();
      else clearTimeout(timer);
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []);
}
