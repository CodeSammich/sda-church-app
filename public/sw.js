// This version string is automatically synced from the PR title during a release PR
// via GitHub Actions and public/sync-version.js when creating or updating the PR.
// This controls a pop-up notification to users when a new version of the app is available for install
// DO NOT EDIT THIS MANUALLY, as it will be overwritten by the next PR update.
const VERSION = '0.30.0';
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

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const resClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
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
