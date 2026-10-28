import { fetchChildrenLessonsAhead, pruneChildrenLessons } from '@/features/sabbath-school/LessonDownloads';
import { getNetworkStateAsync, NetworkStateType } from 'expo-network';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

// Long enough for the app to finish opening first.
const DELAY_MS = 5_000;

/**
 * On Wi-Fi, fetches the coming Sabbath's lesson for the children's age groups
 * opened most recently, when the app opens or comes back (#529). Never on a
 * phone connection, where it only deletes old copies, and not on the web, where
 * the browser opens the PDFs.
 */
export function useChildrenLessonsAhead() {
  useEffect(() => {
    if (Platform.OS === 'web') return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      clearTimeout(timer);
      timer = setTimeout(async () => {
        try {
          const network = await getNetworkStateAsync();
          if (network.type === NetworkStateType.WIFI && network.isInternetReachable !== false) {
            await fetchChildrenLessonsAhead();
          } else {
            await pruneChildrenLessons();
          }
        } catch {
          // The next time the app opens tries again.
        }
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
