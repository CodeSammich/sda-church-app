# Technical Setup & Testing

## Prerequisites

- Node.js (LTS)
- npm
- Java Development Kit (JDK) 17
- For iOS: Xcode (macOS only) supporting iOS 15.0 - 26.3
- For Android: Android Studio, Android SDK 36 (latest), and ANDROID_HOME environment
  variable

```bash
npm install
```

Make sure to fill out information specific to your church in
[the Constants folder](/constants/).

## Web & PWA Deployment (Primary Workflow)

This application is primarily distributed as a Progressive Web App (PWA) to ensure maximum
accessibility, instant updates, and zero distribution fees.

Originally, this app was conceptualized on native but that idea quickly proved difficult
due to heavy App Store fees and compliance overhead, as well as technical development
challenges. A copy of the original documentation is preserved
[for reference](./legacy_README.md)

### Local Development

To start the app in a web browser for local testing (primarily to check for Network tab
404s that prevent PWA from loading on mobile):

```bash
npx expo start --web
```

### Production Deployment (GitHub Pages)

The project uses GitHub Pages for hosting. Running the deploy command builds the web
assets and pushes them to the gh-pages branch.

```bash
npm run deploy
```

Each fork is deployed under the GitHub Pages domain belonging to that fork's owner. For a
fork that keeps the repository name `sda-church-app`, the URL is:

```text
https://<github-owner>.github.io/sda-church-app/
```

For example, the `CodeSammich` fork is hosted at
`https://codesammich.github.io/sda-church-app/`. A fork owned by another user or
organization must use that owner's `github.io` hostname; it should not assume that the
CodeSammich URL or the NYCCSDA custom domain belongs to it.

Before deploying a fork, update the `homepage` field in `package.json` to its GitHub Pages
URL. When the fork retains the `sda-church-app` repository name, the existing
`/sda-church-app` values in `app.json`, `public/manifest.json`, and the service-worker
registration remain correct. If the repository is renamed, update those base-path,
start-URL, scope, and service-worker-path values to the new repository path as well. A
custom domain is optional and requires its own GitHub Pages and DNS configuration.

For development accounts, you may use the increment flag to automatically update the patch
version in `package.json` to quickly update the version number to trigger a new deploy on
mobile. Please remember to reset the version number when raising the final pull request.

```bash
npm run deploy -- --increment
```

### PWA Update Prompt

`public/sw.js` is the versioned service worker used to detect application releases. Keep
its `VERSION` synchronized with `package.json` through `public/sync-version.js`; deploying
changed bundles without changing the service worker would not create a new waiting worker
for existing installations to detect.

The update flow is intentionally user-controlled:

1. Service-worker registration and the initial update check run after the application has
   started; they do not block the first render.
2. The app performs the browser equivalent of a no-cache `curl` against the small `sw.js`
   file and compares its deployed `VERSION` with the version embedded in the running app
   bundle. The last automatic check time is persisted in browser local storage, limiting
   automatic checks to once every hour across launches and foreground resumes. This follows
   [web.dev's service-worker lifecycle guidance](https://web.dev/articles/service-worker-lifecycle#manual_updates),
   which recommends an interval such as hourly when an application may remain open for a
   long time; this app applies that interval to launch and foreground-resume events rather
   than running a continuous background polling timer.
3. Pressing the version number in the You screen remains the explicit manual check. It
   checks the service-worker registration and reports “checking,” “up to date,” or an
   available update through the shared localized banner.
4. Pressing the Home tab performs an additional silent, no-cache fetch of only `sw.js`.
   This user-initiated check is not subject to the hourly launch/resume limit. It does not
   show an “up to date” message or download the full application bundle. If the deployed
   version differs, the normal update banner appears and lets the user choose whether to
   install it. Repeated Home presses are ignored while one of these checks is in progress.
5. When a changed worker finishes installing, it remains in the browser's `waiting` state.
   One localized, app-themed banner appears at the top of the app instead of interrupting
   the user or adding update controls to individual pages.
6. Pressing the banner action asks the browser to update its registration, resolves the
   current waiting worker, and sends it `SKIP_WAITING`. Once the worker takes control, the
   app performs a cache-busting navigation so the page shell is retrieved from the CDN.
   The newly loaded bundle repeats the deployed-version comparison and hides the banner
   when both versions match. If Bible audio is active, navigation is deferred until the
   user leaves the Bible reader.

This uses the standard service-worker lifecycle and does not poll application pages or
download the full JavaScript bundle merely to discover whether an update exists.

### Mobile Installation

- iOS (Safari): Open the URL -> Tap the Share button -> Add to Home Screen.
- Android (Chrome): Open the URL -> Tap the Three Dots -> Install App or Add to Home
  Screen.

Note: If you encounter a black screen on launch, check the browser's Network tab for 404s
or 400s. Any failed asset load will prevent the Expo bundle from initializing.

---

## Why PWA instead of Native Store Apps?

We have prioritized the PWA workflow over native distribution for several key reasons:

1. Zero Fees: Avoids the $99/year Apple Developer Program fee and the one-time Google Play
   fee.
2. Instant Delivery: npm run deploy pushes updates instantly to all users without waiting
   for multi-day store reviews.
3. Development Simplicity: Native development, particularly on WSL, introduces significant
   networking complexity that can slow down project progress.
