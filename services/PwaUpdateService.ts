export const APP_UPDATE_CACHE_BUSTER = '__appUpdate';
export const PWA_UPDATE_LAST_CHECK_KEY = 'pwa-update-last-check-v1';
const SERVICE_WORKER_VERSION_PATTERN = /const VERSION\s*=\s*['"]([^'"]+)['"]/;

/** Builds a same-page URL whose query forces the CDN to revalidate the app shell. */
export const getUpdateReloadUrl = (href: string, now = Date.now()) => {
  const url = new URL(href);
  url.searchParams.set(APP_UPDATE_CACHE_BUSTER, String(now));
  return url.toString();
};

export const parseServiceWorkerVersion = (source: string) =>
  source.match(SERVICE_WORKER_VERSION_PATTERN)?.[1] || null;

export const isPwaUpdateCheckDue = (
  lastCheckedAt: number,
  now: number,
  intervalMs: number,
) =>
  !Number.isFinite(lastCheckedAt) ||
  lastCheckedAt <= 0 ||
  now - lastCheckedAt >= intervalMs;

/** Performs the browser equivalent of a no-cache curl against deployed sw.js. */
export const fetchDeployedAppVersion = async (
  serviceWorkerUrl: string,
  fetcher: typeof fetch = fetch,
) => {
  const separator = serviceWorkerUrl.includes('?') ? '&' : '?';
  const checkUrl = `${serviceWorkerUrl}${separator}${APP_UPDATE_CACHE_BUSTER}=${Date.now()}`;
  const response = await fetcher(checkUrl, { cache: 'no-store' });
  if (!response.ok) return null;
  return parseServiceWorkerVersion(await response.text());
};

/** Waits until a newly discovered service worker is ready to be activated. */
export const waitForServiceWorkerInstallation = (
  worker: ServiceWorker,
): Promise<ServiceWorker> => {
  if (worker.state === 'installed' || worker.state === 'activated') {
    return Promise.resolve(worker);
  }
  if (worker.state === 'redundant') {
    return Promise.reject(new Error('The app update service worker became redundant.'));
  }

  return new Promise((resolve, reject) => {
    const onStateChange = () => {
      if (worker.state === 'installed' || worker.state === 'activated') {
        worker.removeEventListener('statechange', onStateChange);
        resolve(worker);
      } else if (worker.state === 'redundant') {
        worker.removeEventListener('statechange', onStateChange);
        reject(new Error('The app update service worker became redundant.'));
      }
    };

    worker.addEventListener('statechange', onStateChange);
    // Cover a state transition that occurred immediately before the listener.
    onStateChange();
  });
};
