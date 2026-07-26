import { InitialSetup } from '@/components/InitialSetup';
import {
  DEFAULT_LANG,
  LanguageContext,
  SupportedLanguage,
} from '@/constants/LanguageContext';
import {
  AppTheme,
  getAppTheme,
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  ThemeContext,
} from '@/constants/Themes';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Localization from 'expo-localization';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  AppState,
  LogBox,
  Platform,
  StatusBar,
  StyleSheet,
  useColorScheme
} from 'react-native';
import { PaperProvider, Snackbar } from 'react-native-paper';
import 'react-native-reanimated';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary
} from 'expo-router';

// Suppress all warning logs in the UI
LogBox.ignoreAllLogs();

export const unstable_settings = {
  // Ensure that reloading on `/language` keeps a back button present.
  initialRouteName: '(tabs)',
};

const getSystemLanguage = (): SupportedLanguage => {
  const [primaryLocale] = Localization.getLocales();

  if (!primaryLocale?.languageCode) {
    return DEFAULT_LANG;
  }

  const { languageCode, languageTag } = primaryLocale;
  const scriptCode = (primaryLocale as any).scriptCode;

  // Handle Chinese variants (Simplified vs Traditional mapping)
  if (languageCode === 'zh') {
    // Prioritize scriptCode (standard for modern OS), fall back to region tags
    const isSimplified = scriptCode === 'Hans' || /hans|cn|sg|my/i.test(languageTag);
    return isSimplified ? 'zh-cn' : 'zh';
  }

  const SUPPORTED_MAP: Partial<Record<string, SupportedLanguage>> = {
    es: 'es',
    en: 'en',
  };
  return SUPPORTED_MAP[languageCode] ?? 'en';
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

/**
 * Context to manage PWA updates across the application.
 */
export const UpdateContext = createContext<{
  updateAvailable: boolean;
  onUpdate: () => void;
  onManualCheck: (options?: { isAuto?: boolean }) => Promise<void>;
  updateStatus: 'idle' | 'checking' | 'up-to-date';
}>({
  updateAvailable: false,
  onUpdate: () => {},
  onManualCheck: async () => {},
  updateStatus: 'idle',
});

export default function RootLayout() {
  const [language, setLanguage] = useState<SupportedLanguage>(DEFAULT_LANG);
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState(() => getAppTheme(colorScheme === THEME_DARK));
  const [isReady, setIsReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date'>(
    'idle',
  );
  const updateCheckInProgress = useRef(false);

  const canUseServiceWorker = () =>
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator;

  const getSwUrl = () => {
    // If your app is at the root, use /sw.js. If hosted on GitHub Pages subpath, use /sda-church-app/sw.js
    return window.location.pathname.includes('sda-church-app')
      ? '/sda-church-app/sw.js'
      : '/sw.js';
  };

  const handleUpdate = async (workerOverride?: any) => {
    if (!canUseServiceWorker()) return;

    const worker = workerOverride || waitingWorker;
    if (worker) {
      worker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      // Fallback: manually reload if no worker is found but update was requested
      window.location.reload();
    }
    setUpdateAvailable(false);
  };

  const handleManualCheck = async (options?: { isAuto?: boolean }) => {
    if (!canUseServiceWorker() || !navigator.onLine || updateCheckInProgress.current) {
      return;
    }

    updateCheckInProgress.current = true;

    // Only show the "Checking..." snackbar for manual clicks to avoid UI noise on launch
    if (!options?.isAuto) {
      setUpdateStatus('checking');
    }

    try {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        // updateViaCache: 'none' on registration makes this a network check. Cache
        // deletion is unnecessary and can remove files the currently running app
        // still needs while the replacement worker is installing.
        await registration.update();

        if (registration.waiting) {
          const worker = registration.waiting;
          setWaitingWorker(worker);
          setUpdateAvailable(true);
          setUpdateStatus('idle');
          await handleUpdate(worker);
        } else if (registration.installing) {
          const installingWorker = registration.installing;
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              setWaitingWorker(installingWorker);
              setUpdateAvailable(true);
              handleUpdate(installingWorker);
            } else if (installingWorker.state === 'redundant') {
              setUpdateStatus('idle');
            }
          });
        } else {
          setUpdateAvailable(false);
          setUpdateStatus(options?.isAuto ? 'idle' : 'up-to-date');
        }
      } else {
        setUpdateStatus('idle');
      }
    } catch (e) {
      console.error('Manual update check failed:', e);
      setUpdateStatus('idle');
    } finally {
      updateCheckInProgress.current = false;
    }
  };

  useEffect(() => {
    // Register service worker for PWA support on web
    let subscription: { remove: () => void } | undefined;
    let removeControllerChangeListener: (() => void) | undefined;
    let removeLoadListener: (() => void) | undefined;

    if (canUseServiceWorker()) {
      let refreshing = false;
      const registerSW = async () => {
        const swUrl = getSwUrl();

        try {
          const registration = await navigator.serviceWorker.register(swUrl, {
            // Always check the network for sw.js, without destroying the active
            // worker's caches while the current page is still using them.
            updateViaCache: 'none',
          });
          console.log('SW registered with scope:', registration.scope);

          let watchedWorker: ServiceWorker | null = null;
          const activateWhenInstalled = (worker: ServiceWorker | null) => {
            if (!worker || worker === watchedWorker) return;
            watchedWorker = worker;

            const onStateChange = () => {
              if (worker.state === 'installed') {
                worker.removeEventListener('statechange', onStateChange);
                if (navigator.serviceWorker.controller) {
                  console.log('New SW content ready. Auto-updating...');
                  worker.postMessage({ type: 'SKIP_WAITING' });
                } else {
                  console.log('SW installed for the first time.');
                }
              } else if (worker.state === 'redundant') {
                worker.removeEventListener('statechange', onStateChange);
              }
            };

            worker.addEventListener('statechange', onStateChange);
            onStateChange();
          };

          // Registering may start an update before register() resolves, so attach
          // the listener and inspect any existing installing worker before the
          // explicit freshness check.
          registration.onupdatefound = () => {
            activateWhenInstalled(registration.installing);
          };
          activateWhenInstalled(registration.installing);
          await registration.update();

          // 1. Check if there is already an updated worker waiting
          if (registration.waiting) {
            console.log('New SW already waiting. Auto-updating...');
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          activateWhenInstalled(registration.installing);
        } catch (error) {
          console.error('SW registration failed:', error);
        }
      };

      // Refresh the page automatically when the new service worker takes over
      const onControllerChange = () => {
        if (!refreshing) {
          refreshing = true;
          console.log('New SW activated, reloading...');
          window.location.reload();
        }
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      removeControllerChangeListener = () =>
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);

      // Use AppState to detect when the PWA is resumed from suspension (common on iOS)
      subscription = AppState.addEventListener('change', (nextAppState) => {
        if (nextAppState === 'active') {
          console.log('App resumed - performing freshness check');
          handleManualCheck({ isAuto: true });
        }
      });

      // Check both 'complete' and 'interactive' to ensure we start the SW
      // as soon as the browser allows, minimizing the "reversion" window.
      if (document.readyState === 'complete' || document.readyState === 'interactive') {
        registerSW();
      } else {
        window.addEventListener('load', registerSW);
        removeLoadListener = () => window.removeEventListener('load', registerSW);
      }
    }

    async function prepare() {
      try {
        const [savedLang, savedTheme, setupDone] = await Promise.all([
          AsyncStorage.getItem('user-language'),
          AsyncStorage.getItem(THEME_STORAGE_KEY),
          AsyncStorage.getItem('has-completed-setup'),
        ]);

        // Always determine fallbacks first
        const systemLang = getSystemLanguage();

        // Use saved settings if they exist, otherwise fallback to system defaults
        setLanguage((savedLang as SupportedLanguage) || systemLang);
        setTheme(
          getAppTheme(
            savedTheme ? savedTheme === THEME_DARK : colorScheme === THEME_DARK,
          ),
        );

        if (setupDone !== 'true') {
          setShowSetup(true);
        }
      } catch (e) {
        console.warn('Failed to load settings', e);
      } finally {
        setIsReady(true);
      }
    }
    prepare();

    return () => {
      if (subscription) subscription.remove();
      removeControllerChangeListener?.();
      removeLoadListener?.();
    };
  }, []);

  const handleSetLanguage = async (lang: SupportedLanguage) => {
    setLanguage(lang);
    await AsyncStorage.setItem('user-language', lang);
  };

  const handleToggleTheme = async (val?: any) => {
    let next: boolean;
    if (typeof val === 'boolean') {
      next = val;
    } else if (typeof val === 'string') {
      next = val === THEME_DARK;
    } else {
      next = !theme.dark;
    }
    setTheme(getAppTheme(next));
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next ? THEME_DARK : THEME_LIGHT);
  };

  const onCompleteSetup = async () => {
    // Persist current settings when completing setup to ensure they stick on reload
    // even if the user didn't explicitly change them from system defaults.
    await Promise.all([
      AsyncStorage.setItem('has-completed-setup', 'true'),
      AsyncStorage.setItem('user-language', language),
      AsyncStorage.setItem(THEME_STORAGE_KEY, theme.dark ? THEME_DARK : THEME_LIGHT),
    ]);
    setShowSetup(false);
  };

  const [loaded, error] = useFonts({
    'NotoSans-Regular': require('./../assets/fonts/NotoSans-Regular.ttf'),
    'NotoSans-Medium': require('./../assets/fonts/NotoSans-Medium.ttf'),
    'NotoSans-Bold': require('./../assets/fonts/NotoSans-Bold.ttf'),
    'material-community': require('../assets/fonts/MaterialCommunityIcons.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) {
      console.error('Font loading error:', error);
      // Even if fonts fail, we should eventually hide the splash screen
      SplashScreen.hideAsync();
    }
  }, [error]);

  useEffect(() => {
    if (loaded && isReady) {
      // Instant hide for a performance-first experience once assets are ready.
      SplashScreen.hideAsync();
    }
  }, [loaded, isReady]);

  if (!loaded || !isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <LanguageContext.Provider value={{ language, setLanguage: handleSetLanguage }}>
        <ThemeContext.Provider value={{ toggleTheme: handleToggleTheme }}>
          <UpdateContext.Provider
            value={{
              updateAvailable,
              onUpdate: handleUpdate,
              onManualCheck: handleManualCheck,
              updateStatus,
            }}
          >
            <RootLayoutNav
              theme={theme}
              showSetup={showSetup}
              onCompleteSetup={onCompleteSetup}
              updateAvailable={updateAvailable}
              onUpdate={handleUpdate}
              updateStatus={updateStatus}
              onDismissStatus={() => setUpdateStatus('idle')}
            />
          </UpdateContext.Provider>
        </ThemeContext.Provider>
      </LanguageContext.Provider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav({
  theme,
  showSetup,
  onCompleteSetup,
  updateAvailable,
  onUpdate,
  updateStatus,
  onDismissStatus,
}: {
  theme: AppTheme;
  showSetup: boolean;
  onCompleteSetup: () => void;
  updateAvailable: boolean;
  onUpdate: () => void;
  updateStatus: 'idle' | 'checking' | 'up-to-date';
  onDismissStatus: () => void;
}) {
  const { language } = useContext(LanguageContext);
  const insets = useSafeAreaInsets();

  // Sync system bars and PWA theme-color meta tag
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const bodyBg = theme.colors.background;

      // 1. Sync all theme-color meta tags (Primary driver for Android/iOS bar colors)
      // Using querySelectorAll to update both light and dark preference tags
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      metas.forEach((meta) => {
        meta.setAttribute('content', bodyBg);
        // Removing 'media' ensures the browser respects this color immediately,
        // overriding the static system-preference tags in +html.tsx.
        // meta.removeAttribute("media");
      });

      // 2. Sync backgrounds to eliminate logic overlap and satisfy Android PWA requirements
      document.documentElement.style.setProperty('--app-bg', bodyBg);
      document.body.style.backgroundColor = bodyBg;
      document.documentElement.style.backgroundColor = bodyBg;
    }
  }, [theme]);

  const snackbarLabels = {
    en: {
      checking: 'Checking for updates...',
      upToDate: 'App is up to date',
      available: 'Update available',
      refresh: 'RESTART',
    },
    zh: {
      checking: '正在檢查更新...',
      upToDate: '應用程式已是最新版本',
      available: '發現新版本',
      refresh: '重啟',
    },
    'zh-cn': {
      checking: '正在检查更新...',
      upToDate: '应用已是最新版本',
      available: '发现新版本',
      refresh: '重启',
    },
    es: {
      checking: 'Buscando actualizaciones...',
      upToDate: 'La aplicación está actualizada',
      available: 'Actualización disponible',
      refresh: 'REINICIAR',
    },
  };

  const labels =
    snackbarLabels[language as keyof typeof snackbarLabels] || snackbarLabels.en;

  // Positioning the snackbar at the top avoids conflicts with bottom navigation,
  // gesture indicators, and the software keyboard.
  const topOffset = insets.top + 8;

  return (
    <PaperProvider theme={theme as any}>
      <ThemeProvider value={theme as any}>
        <StatusBar
          barStyle={theme.statusBarScheme}
          backgroundColor={undefined}
          translucent
        />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        {showSetup && <InitialSetup onComplete={onCompleteSetup} />}

        <Snackbar
          visible={updateStatus !== 'idle' || updateAvailable}
          onDismiss={onDismissStatus}
          duration={updateStatus === 'checking' || updateAvailable ? Infinity : 3000}
          wrapperStyle={[styles.snackbarWrapper, { top: topOffset, bottom: 'auto' }]}
          action={
            updateAvailable
              ? {
                  label: labels.refresh,
                  onPress: onUpdate,
                }
              : undefined
          }
        >
          {updateAvailable
            ? labels.available
            : updateStatus === 'checking'
              ? labels.checking
              : labels.upToDate}
        </Snackbar>
      </ThemeProvider>
    </PaperProvider>
  );
}

const styles = StyleSheet.create({
  snackbarWrapper: {
    // Positioned at the top to clear navigation and keyboard
  },
});
