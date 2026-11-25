// The version string below is written by `npm run sync-version` (public/sync-version.js),
// which sets it together with package.json and app.json. CI checks that they match.
// It controls the web app's pop-up telling users a new version is available.
// Don't edit it by hand.
const VERSION = '1.9.1';
const CACHE_NAME = `sda-church-v${VERSION}`;

self.addEventListener('install', (event) => {});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      // Force clear any browser-level caches that might be holding onto old versions of index.html or JS bundles.
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        );
      }),
    ]),
  );
});

// Keeps a copy of this site's own files, so the web app still opens without a
// connection. Requests to other sites (Bible audio, photos, the bulletin) go straight
// to the network and aren't kept here: the app stores what it needs from them itself,
// and copies of other sites' answers fill the browser's storage quickly.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only a complete, successful answer is worth keeping. An error page kept here
        // would be shown again offline, and a partial answer (206) can't be stored.
        if (response.status === 200) {
          const resClone = response.clone();
          caches
            .open(CACHE_NAME)
            .then((cache) => cache.put(event.request, resClone))
            .catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
