# Development setup and testing

How to install the app, run it in a browser, on an Android emulator, or on the iOS
Simulator, and test it. Signing, credentials, the PR preview builds, and store uploads
are in [Native mobile binary builds](operations/native-builds.md).

## Prerequisites

- Node.js 22 (22.13 or later) or 24 (24.3 or later), with npm. Expo SDK 58 and React
  Native 0.88 require one of these (or Node 26 or later). The repository has no
  `.nvmrc` or `engines` field; the workflows use Node 22, except the website deploy and
  release check, which use the current LTS.
- For Android: macOS or Linux, the Java Development Kit (JDK) 17, and Android Studio
  with the Android SDK. `app.json` sets compile SDK and build tools 37 and target API
  36. Set `ANDROID_HOME` and put the Android command-line tools on your `PATH`.
- For iOS: a Mac with Xcode 26.6 or later and CocoaPods. Expo SDK 58 doesn't compile
  with older Xcode versions; both iOS workflows select Xcode 26.6.

Install the dependencies:

```bash
npm install --force
```

`--force` is needed because React Native is a release candidate (`0.88.0-rc.3`), which
some packages' peer-dependency ranges don't include, so a plain `npm install` stops
with an `ERESOLVE` error. CI installs the same way, with `npm ci --force`.

A fork for another church changes the church-specific details in
[`constants/`](../constants/), such as `ChurchData.ts`, `TeamData.ts`, and
`ExternalLinks.ts`.

## Running the app

### In a browser

```bash
npm run web
```

This runs `expo start --web`, which starts the Metro development server and opens the
app in a browser. It is the quickest way to check layout and wording, but native-only
behavior, such as Bible audio on the lock screen, needs an Android or iOS build. If the
page stays blank, see the note under
[Optional PWA installation for testing](#optional-pwa-installation-for-testing).

### On an Android emulator or phone

Create an emulator in Android Studio's **Device Manager**, or connect a phone with USB
debugging on. Then build a standalone debug APK and install it:

```bash
npm run build:android:apk:debug:intel   # x86_64 emulator on an Intel or AMD computer
npm run build:android:apk:debug:arm     # phone, or an emulator on an ARM computer
adb install -r <the path the script printed>
```

The script prints where it wrote the APK, in `build/` unless you pass
`--output /absolute/path/app.apk`. The JavaScript is bundled in, so it runs without
Metro. It's signed with Gradle's debug key, and it installs as **NYCCSDA Preview**
(`org.nyccsda.app.preview`) beside the store version. After changing `app.json` or a
config plugin, add `-- --prebuild` to regenerate the `android/` project. More detail
is in [Android direct-native commands](operations/native-builds.md#android-direct-native-commands).

On WSL, run the emulator and `adb` from the Windows Android SDK: call `adb.exe`, and
give it a Windows path to the APK (`wslpath -w <file>`).

### On the iOS Simulator (Mac only)

```bash
npm run build:ios:simulator              # Release build, JavaScript bundled in
npm run build:ios:simulator -- --debug   # Debug build that loads JavaScript from Metro
```

The script builds without signing, installs the app on the Simulator, and opens it. You
can also download a release pull request's Simulator build from the **iOS PR preview**
run instead of building it. Both are in
[iOS PR preview](operations/native-builds.md#ios-pr-preview-unsigned-simulator-builds).

## Testing

| Command | What it checks | Where CI runs it |
| --- | --- | --- |
| `npm test` | The Jest unit tests, `test/**/*.test.ts` | **PR Unit Tests**, on every pull request |
| `npm run typecheck` | TypeScript types (`tsc --noEmit`) | Not in CI; run it yourself |
| `npm run check:text-scale` | That no text style bypasses the app's text-size setting (`scripts/check-text-scale-coverage.mjs`) | **PR Unit Tests**, after Jest |
| `npm run build:web` | That the web build exports, into `build/web` | Not on pull requests; the website deploy builds it again after a merge |
| `npm run check` | All four of the above: typecheck, then tests, text size, and web build | Not in CI; run it before opening a pull request |
| `npm run test:integration:bulletin` | The response shape of the production bulletin API | **Bulletin API Integration**, on the release pull request into `main` |
| `npm run test:integration:external` | Every outside service the app uses: APIs, media hosts, hymn sites, and the website's pages | **External Dependency Monitor**, daily |

CI doesn't typecheck or build the web app on pull requests, so `npm run check` is the
way to catch those before review.

The two integration tests call live services, so they can fail because a service is
down rather than because of your change.

- `test:integration:bulletin` calls the deployed Apps Script, not the code in your
  branch. `BULLETIN_API_URL` and `BULLETIN_TEST_DATE` override the address and the
  bulletin date it asks for.
- `test:integration:external` writes `external-dependency-report.json`. See
  [External dependency monitor](operations/external-dependency-monitor.md).

### Key screens on iPhone

The **iOS PR preview** workflow, on the release pull request into `main`, takes 83
screenshots of the 31 screens listed in `test/screens/screens.json`, in light and dark,
at larger text sizes, and in Chinese and Spanish. `scripts/capture-ios-screens.cjs`
takes them, and `scripts/check-screens.cjs` reads their text with Apple's Vision
framework and checks what each screen must show. The release then waits on the
**Screenshots reviewed** check until a release approver has looked at them.
`npm test` includes `test/screens.test.ts`, which checks the screen list itself.

Feature pull requests don't run it. To try a screen change earlier, start **iOS PR
preview** by hand on your branch from the Actions tab. When a change affects what a
screen shows, update its key screens and text checks; see
[Contributing](CONTRIBUTING.md#pull-request-format-and-issue-closing) and **Key screens**
in [iOS PR preview](operations/native-builds.md#ios-pr-preview-unsigned-simulator-builds).

### Bible audio on an Android emulator

The **Android audio e2e** workflow, on the release pull request into `main`, builds the
debug APK, boots an Android emulator, and plays real Bible chapters to check what only a
real player shows: switching hosts when the church's audio host is down, moving to the
next chapter with the screen off, and recovering after the network drops. The scenarios
are in `scripts/e2e/android-bible-audio.sh`. It's a required check on `main`; feature
pull requests don't run it, but you can start it by hand on your branch.

To run the scenarios yourself, boot an emulator, install the debug APK (see
[On an Android emulator or phone](#on-an-android-emulator-or-phone)), and run:

```bash
scripts/e2e/android-bible-audio.sh
E2E_ONLY="pause-and-resume" scripts/e2e/android-bible-audio.sh   # one scenario
```

The script's header lists its settings, such as `ADB` and `ADB_ARGS` (on WSL,
`ADB=adb.exe ADB_ARGS=-e`). The "primary host down" scenario runs only with
`E2E_PRIMARY_BLOCKED=1`, which needs the church's audio host blocked; the workflow
arranges both. What to do when it fails is
in [Bible audio emulator test](operations/admin-runbook.md#bible-audio-emulator-test).

## Web & PWA Testing and Preview

Native iOS and Android builds are the primary distribution path. The Progressive Web App
(PWA) remains a maintained browser testing and preview surface for UI regression checks,
accessibility testing, demos, and fast fork previews. It is not the canonical release
channel for the church's installed-app users.

The web and native targets continue to share one Expo source tree. A web preview is useful
for testing browser-specific behavior, but passing the web build is not evidence that a
signed iOS or Android binary is ready for store submission.

### Web builds and the website

Two commands build the web app locally without publishing anything:

- `npm run build:web` exports it into `build/web`. `npm run check` uses this.
- `npm run deploy` first syncs the version into the version files, then exports it into
  `dist/`, the folder the website is published from.

Every merge to `main` runs **Deploy Website and Tag**, which publishes
`https://app.nyccsda.org`. This is a production site: the store listings link to its
privacy policy and support pages, and printed QR codes point at its download page. The
browser build of the app is published with it, for testing and demos; it does not
publish or update the native store apps. The publishing command,
`npm run deploy:production`, refuses to run anywhere but GitHub Actions on `main` in the
church's repository. See
[The app website](operations/admin-runbook.md#the-app-website-appnyccsdaorg).

To publish a development preview to a fork, opt in explicitly and provide both the fork
repository and its GitHub Pages URL. The URL must use the configured `/sda-church-app`
base path; custom domains are rejected for preview publishing:

```bash
npm run deploy:dev -- \
  --repo git@github.com:<your-account>/sda-church-app.git \
  --site-url https://<your-account>.github.io/sda-church-app/
```

Each fork is deployed under the GitHub Pages domain belonging to that fork's owner. For a
fork that keeps the repository name `sda-church-app`, the URL is:

```text
https://<github-owner>.github.io/sda-church-app/
```

A fork must use its own owner's `github.io` hostname; the church's custom domain is
production-only.

When the fork keeps the `sda-church-app` repository name, the existing `/sda-church-app`
values in `app.json`, `app/+html.tsx`, `public/manifest.json`, and the service-worker
registration in `app/_layout.tsx` remain correct. If the repository is renamed, update
those base-path, start-URL, scope, and service-worker-path values to the new repository
path as well. A custom domain is optional and requires its own GitHub Pages and DNS
configuration.

For development builds, you may use the increment flag to raise the patch version in
`package.json`, `package-lock.json`, `app.json`, and `public/sw.js` and prepare a
versioned local web build. Please remember to reset the version number when raising the
final pull request.

```bash
npm run deploy -- --increment
```

### Web/PWA update prompt (preview only)

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

### Optional PWA installation for testing

- iOS (Safari): Open `https://app.nyccsda.org` or your fork's preview URL -> Tap the
  Share button -> Add to Home Screen.
- Android (Chrome): Open the same URL -> Tap the Three Dots -> Install App or Add to
  Home Screen.

This is a convenient way to test the browser-installed experience. It is not a substitute
for installing a signed native build from TestFlight or Google Play.

Note: If you encounter a black screen on launch, check the browser's Network tab for 404s
or 400s. Any failed asset load will prevent the Expo bundle from initializing.

---

## Why Keep a PWA Testing Surface?

The PWA is retained as a secondary engineering and preview surface:

1. Fast browser regression testing for layout, accessibility, links, caching, and web-only
   behavior.
2. Easy previews for contributors, maintainers, and church stakeholders before a native
   binary is built.
3. A low-friction demo and fallback surface that does not require store installation.

Native iOS and Android binaries remain the supported primary release targets. Native
signing, device testing, store review, and store submission are documented in
[Native mobile binary builds](operations/native-builds.md). How the version and the store
build numbers relate is explained in [Version numbers](operations/version-numbers.md).
