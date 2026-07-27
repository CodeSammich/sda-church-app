import { InitialSetup } from '@/components/InitialSetup';
import { InstallPrompt } from '@/components/InstallPrompt';
import { getHeaderBackTarget, hasHeaderBackButton } from '@/constants/BackNavigation';
import { openIosPwaInstallGuide } from '@/constants/ExternalLinks';
import {
  DEFAULT_LANG,
  LanguageContext,
  SupportedLanguage,
} from '@/constants/LanguageContext';
import {
  AppTheme,
  getAppTheme,
  SCRIPTURE_FONT_FAMILIES,
  THEME_DARK,
  THEME_LIGHT,
  THEME_STORAGE_KEY,
  ThemeContext,
} from '@/constants/Themes';
import {
  BIBLE_TRANSLATION_STORAGE_KEY,
  DEFAULT_TRANSLATION_MAP,
} from '@/services/BibleService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import * as Localization from 'expo-localization';
import {
  router,
  Stack,
  useGlobalSearchParams,
  usePathname,
  useSegments,
} from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
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

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
};

const isInstalledPwa = () => {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof navigator === 'undefined'
  ) {
    return false;
  }

  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    navigatorWithStandalone.standalone === true
  );
};

const isBibleReaderPath = (pathname: string) =>
  /\/(?:\(tabs\)\/)?bible(?:\/index)?\/?$/.test(pathname);

const DEFERRED_REFRESH_FLAG = '__sdaChurchDeferredRefresh';

const isAndroidChromeBrowser = () => {
  if (
    Platform.OS !== 'web' ||
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    isInstalledPwa()
  ) {
    return false;
  }

  const userAgent = navigator.userAgent;
  const navigatorWithUserAgentData = navigator as Navigator & {
    userAgentData?: { brands?: { brand: string }[] };
  };
  const brands = navigatorWithUserAgentData.userAgentData?.brands;
  const isGoogleChrome = brands?.length
    ? brands.some(({ brand }) => brand === 'Google Chrome')
    : /Chrome\//i.test(userAgent) &&
      !/(?:EdgA|OPR|SamsungBrowser|YaBrowser|DuckDuckGo)\//i.test(userAgent);

  return /Android/i.test(userAgent) && isGoogleChrome;
};

const isIosSafariBrowser = () => {
  if (
    Platform.OS !== 'web' ||
    typeof navigator === 'undefined' ||
    isInstalledPwa()
  ) {
    return false;
  }

  const userAgent = navigator.userAgent;
  const isIosDevice =
    /iPad|iPhone|iPod/i.test(userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isSafari =
    /Safari\//i.test(userAgent) &&
    !/(?:CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo)\//i.test(userAgent);

  return isIosDevice && isSafari;
};

const matchSupportedLanguage = (
  languageTag?: string | null,
  languageCode?: string | null,
  scriptCode?: string | null,
): SupportedLanguage | null => {
  const normalizedTag = languageTag?.toLowerCase().replaceAll('_', '-') ?? '';
  const normalizedCode = languageCode?.toLowerCase() || normalizedTag.split('-')[0];

  if (normalizedCode === 'zh') {
    const isSimplified =
      scriptCode?.toLowerCase() === 'hans' ||
      /(?:^|-)hans(?:-|$)|(?:^|-)(?:cn|sg|my)(?:-|$)/.test(normalizedTag);
    return isSimplified ? 'zh-cn' : 'zh';
  }

  if (normalizedCode === 'en' || normalizedCode === 'es') {
    return normalizedCode;
  }

  return null;
};

const getSystemLanguage = (): SupportedLanguage => {
  // Browsers expose an ordered preference list. Use the first language the app
  // supports rather than assuming the browser's primary language is supported.
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const browserLanguages = navigator.languages?.length
      ? Array.from(navigator.languages)
      : [navigator.language];

    for (const languageTag of browserLanguages) {
      const supportedLanguage = matchSupportedLanguage(languageTag);
      if (supportedLanguage) return supportedLanguage;
    }
  } else {
    // On native platforms Expo reads the operating system's ordered locales.
    for (const locale of Localization.getLocales()) {
      const supportedLanguage = matchSupportedLanguage(
        locale.languageTag,
        locale.languageCode,
        (locale as any).scriptCode,
      );
      if (supportedLanguage) return supportedLanguage;
    }
  }

  return DEFAULT_LANG;
};

const needsCjkSystemFont = (language: SupportedLanguage) =>
  language === 'zh' || language === 'zh-cn';

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
  const [languageSelectionRevision, setLanguageSelectionRevision] = useState(0);
  const colorScheme = useColorScheme();
  const [theme, setTheme] = useState(() => getAppTheme(colorScheme === THEME_DARK));
  const [isReady, setIsReady] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [waitingWorker, setWaitingWorker] = useState<any>(null);
  const [updateStatus, setUpdateStatus] = useState<'idle' | 'checking' | 'up-to-date'>(
    'idle',
  );
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installPromptDismissed, setInstallPromptDismissed] = useState(false);
  const updateCheckInProgress = useRef(false);
  const updateStatusTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearUpdateStatusTimeout = () => {
    if (updateStatusTimeout.current) {
      clearTimeout(updateStatusTimeout.current);
      updateStatusTimeout.current = null;
    }
  };

  const dismissUpdateStatus = () => {
    clearUpdateStatusTimeout();
    setUpdateStatus('idle');
  };

  const showUpToDateStatus = () => {
    clearUpdateStatusTimeout();
    setUpdateStatus('up-to-date');
    updateStatusTimeout.current = setTimeout(() => {
      updateStatusTimeout.current = null;
      setUpdateStatus('idle');
    }, 3000);
  };

  useEffect(
    () => () => {
      clearUpdateStatusTimeout();
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;

    const onBeforeInstallPrompt = (event: Event) => {
      if (!isAndroidChromeBrowser()) return;

      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstallPrompt(null);
      setInstallPromptDismissed(true);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !/Android/i.test(navigator.userAgent) ||
      !isInstalledPwa()
    ) {
      return;
    }

    const requestImmersiveFullscreen = () => {
      if (
        typeof document === 'undefined' ||
        document.fullscreenElement ||
        !document.documentElement.requestFullscreen
      ) {
        return;
      }

      document.documentElement
        .requestFullscreen({ navigationUI: 'hide' })
        .catch(() => undefined);
    };

    // The Fullscreen API needs a real user activation. The window bubble phase
    // runs after the route's click handler, so this does not reload navigation.
    const onUserClick = (event: MouseEvent) => {
      if (event.isTrusted) requestImmersiveFullscreen();
    };

    window.addEventListener('click', onUserClick);

    return () => {
      window.removeEventListener('click', onUserClick);
    };
  }, []);

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
    clearUpdateStatusTimeout();

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
          const onStateChange = () => {
            if (installingWorker.state === 'installed') {
              installingWorker.removeEventListener('statechange', onStateChange);
              setWaitingWorker(installingWorker);
              setUpdateAvailable(true);
              setUpdateStatus('idle');
              handleUpdate(installingWorker);
            } else if (installingWorker.state === 'redundant') {
              installingWorker.removeEventListener('statechange', onStateChange);
              setUpdateStatus('idle');
            }
          };
          installingWorker.addEventListener('statechange', onStateChange);
          // The worker can finish between registration.update() resolving and
          // this listener being attached, so inspect its current state too.
          onStateChange();
        } else {
          setUpdateAvailable(false);
          if (options?.isAuto) {
            setUpdateStatus('idle');
          } else {
            showUpToDateStatus();
          }
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
        if (refreshing) return;

        if (isBibleReaderPath(window.location.pathname)) {
          // Keep the active Sound instance, playback position, and sleep timer intact.
          // The new worker can control subsequent requests without replacing this page.
          (window as any)[DEFERRED_REFRESH_FLAG] = true;
          console.log('New SW activated; deferring reload until leaving Bible reader.');
          return;
        }

        refreshing = true;
        console.log('New SW activated, reloading...');
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
      removeControllerChangeListener = () =>
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);

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
        const preferredLanguage = (savedLang as SupportedLanguage) || systemLang;
        const useDarkTheme = savedTheme
          ? savedTheme === THEME_DARK
          : colorScheme === THEME_DARK;
        setLanguage(preferredLanguage);
        setTheme(
          getAppTheme(useDarkTheme, needsCjkSystemFont(preferredLanguage)),
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
      removeControllerChangeListener?.();
      removeLoadListener?.();
    };
  }, []);

  const handleSetLanguage = async (lang: SupportedLanguage) => {
    setLanguage(lang);
    setLanguageSelectionRevision((revision) => revision + 1);
    setTheme(getAppTheme(theme.dark, needsCjkSystemFont(lang)));
    await AsyncStorage.multiSet([
      ['user-language', lang],
      [BIBLE_TRANSLATION_STORAGE_KEY, DEFAULT_TRANSLATION_MAP[lang] || 'BSB'],
    ]);
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
    setTheme(getAppTheme(next, needsCjkSystemFont(language)));
    await AsyncStorage.setItem(THEME_STORAGE_KEY, next ? THEME_DARK : THEME_LIGHT);
  };

  const onCompleteSetup = async () => {
    // Persist current settings when completing setup to ensure they stick on reload
    // even if the user didn't explicitly change them from system defaults.
    setLanguageSelectionRevision((revision) => revision + 1);
    await Promise.all([
      AsyncStorage.setItem('has-completed-setup', 'true'),
      AsyncStorage.setItem('user-language', language),
      AsyncStorage.setItem(
        BIBLE_TRANSLATION_STORAGE_KEY,
        DEFAULT_TRANSLATION_MAP[language] || 'BSB',
      ),
      AsyncStorage.setItem(THEME_STORAGE_KEY, theme.dark ? THEME_DARK : THEME_LIGHT),
    ]);
    setShowSetup(false);
  };

  const handleInstall = async () => {
    setInstallPromptDismissed(true);

    if (isIosSafariBrowser()) {
      await openIosPwaInstallGuide();
      return;
    }

    if (!installPrompt || !isAndroidChromeBrowser()) return;

    const prompt = installPrompt;
    setInstallPrompt(null);

    try {
      await prompt.prompt();
      await prompt.userChoice;
    } catch (error) {
      console.warn('Unable to show the PWA install prompt', error);
    }
  };

  const [loaded, error] = useFonts({
    'PlusJakartaSans-Regular': require('../assets/fonts/PlusJakartaSans-Regular.ttf'),
    'PlusJakartaSans-Medium': require('../assets/fonts/PlusJakartaSans-Medium.ttf'),
    'PlusJakartaSans-Bold': require('../assets/fonts/PlusJakartaSans-Bold.ttf'),
    [SCRIPTURE_FONT_FAMILIES.greek]: require('../assets/fonts/Gentium-Regular.ttf'),
    [SCRIPTURE_FONT_FAMILIES.hebrew]: require('../assets/fonts/EzraSIL-Regular.ttf'),
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
      <LanguageContext.Provider
        value={{
          language,
          languageSelectionRevision,
          setLanguage: handleSetLanguage,
        }}
      >
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
              installAvailable={
                !installPromptDismissed &&
                (installPrompt !== null || isIosSafariBrowser())
              }
              onInstall={handleInstall}
              onDismissInstall={() => setInstallPromptDismissed(true)}
              updateAvailable={updateAvailable}
              onUpdate={handleUpdate}
              updateStatus={updateStatus}
              onDismissStatus={dismissUpdateStatus}
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
  installAvailable,
  onInstall,
  onDismissInstall,
  updateAvailable,
  onUpdate,
  updateStatus,
  onDismissStatus,
}: {
  theme: AppTheme;
  showSetup: boolean;
  onCompleteSetup: () => void;
  installAvailable: boolean;
  onInstall: () => Promise<void>;
  onDismissInstall: () => void;
  updateAvailable: boolean;
  onUpdate: () => void;
  updateStatus: 'idle' | 'checking' | 'up-to-date';
  onDismissStatus: () => void;
}) {
  const { language } = useContext(LanguageContext);
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const segments = useSegments();
  const globalParams = useGlobalSearchParams<{ backTo?: string | string[] }>();
  const gestureBackTarget = hasHeaderBackButton(segments)
    ? getHeaderBackTarget(segments, globalParams.backTo)
    : '/';
  const routeKey = `${pathname}:${JSON.stringify(globalParams)}`;

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      isBibleReaderPath(pathname) ||
      !(window as any)[DEFERRED_REFRESH_FLAG]
    ) {
      return;
    }

    // An update activated while Bible audio was open. Apply its one deferred
    // page refresh now that leaving the reader cannot discard active playback.
    delete (window as any)[DEFERRED_REFRESH_FLAG];
    window.location.reload();
  }, [pathname]);

  useEffect(() => {
    if (
      Platform.OS !== 'web' ||
      typeof window === 'undefined' ||
      typeof navigator === 'undefined' ||
      !/Android/i.test(navigator.userAgent) ||
      !isInstalledPwa()
    ) {
      return;
    }

    const guardKey = '__androidPwaBackGuard';

    const armBackGuard = () => {
      if (window.history.state?.[guardKey]) return;

      window.history.pushState(
        { ...(window.history.state ?? {}), [guardKey]: true },
        '',
        window.location.href,
      );
    };

    const handleBrowserBack = (event: PopStateEvent) => {
      // Moving forward into our guard should remain a browser-history operation.
      if (event.state?.[guardKey]) return;

      // The guard keeps the browser on the same URL. Stop Expo Router from also
      // processing this pop and perform the same app navigation as the header arrow.
      event.stopImmediatePropagation();
      router.replace(gestureBackTarget as any);

      // Navigating to Home while already there does not cause a route render, so
      // ensure the guard is restored even when the target route stays unchanged.
      window.setTimeout(armBackGuard, 100);
    };

    armBackGuard();
    window.addEventListener('popstate', handleBrowserBack, true);

    return () => {
      window.removeEventListener('popstate', handleBrowserBack, true);
    };
  }, [gestureBackTarget, routeKey]);

  // Sync system bars and PWA theme-color meta tag
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const bodyBg = theme.colors.background;
      const systemBarColor = '#000000';

      // 1. Sync all theme-color meta tags (Primary driver for Android/iOS bar colors)
      // Using querySelectorAll to update both light and dark preference tags
      const metas = document.querySelectorAll('meta[name="theme-color"]');
      metas.forEach((meta) => {
        meta.setAttribute('content', systemBarColor);
        meta.removeAttribute('media');
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
          barStyle="light-content"
          backgroundColor="#000000"
          translucent={false}
        />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        </Stack>
        {installAvailable && (
          <InstallPrompt onInstall={onInstall} onDismiss={onDismissInstall} />
        )}
        {showSetup && !installAvailable && (
          <InitialSetup onComplete={onCompleteSetup} />
        )}

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
