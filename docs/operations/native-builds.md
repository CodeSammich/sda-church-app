# Native mobile binary builds

This page is for developers and maintainers. Church admins who approve, download, or
ship a build start at the [admin runbook](admin-runbook.md#native-app-binaries).

How the iPhone and Android apps are built, signed, checked, and sent to testers: the
signed builds that run after a release merges into `main`, and where their credentials
are kept; the unsigned builds and checks on each release pull request into `main`;
building on your own computer, including on Windows through WSL; and the automatic
uploads to TestFlight and Google Play internal testing. Who owns the store accounts, and
how to recover them, is in [App Store and Google Play setup](app-store-setup.md).

Signed builds run only after a change reaches `main`, or from a manual run on `main`;
`release-candidate` and pull requests are never signed. Each signing job has a guard
that allows only `main` in the church's repository, so a manual run from another branch
can't reach the `production` Environment and its signing secrets. That guard is part of
the credential boundary and must stay. Every merge into `main` starts **Native Android
build** and **Native iOS build**, which wait for `production` approval. Pull requests
get only unsigned builds that read no signing secrets: on the release pull request into
`main`, **Android PR preview** builds a debug APK for ARM phones and **iOS PR preview**
builds the app for the iOS Simulator on Apple Silicon Macs. Fork pull requests
get no native builds. Signed builds upload to TestFlight and Google Play internal testing
only; nothing is released to the public automatically (see
[Automatic store uploads](#automatic-store-uploads)).

The same Expo source is used for all platforms. The native apps are the primary release
targets. The web build, which **Deploy Website and Tag** publishes to `app.nyccsda.org`
on every push to `main`, is kept for browser testing and previews; see
[The app website](admin-runbook.md#the-app-website-appnyccsdaorg). A local
`npm run deploy` builds the web output without publishing it.

## Contents

- [Current setup](#current-setup), including
  [how the signed builds work](#how-the-signed-builds-work)
- [GitHub Actions minutes and maintenance](#github-actions-minutes-and-maintenance)
- [Expo 58 Android prebuild](#expo-58-android-prebuild)
- [Building an independent fork](#building-an-independent-fork)
- [Store accounts and recovery](#store-accounts-and-recovery)
- [GitHub-hosted signing and submission credentials](#github-hosted-signing-and-submission-credentials):
  every signing and store-upload secret
- [iOS setup](#ios-setup-github-hosted-direct-builds) and
  [Android setup](#android-setup-github-hosted-direct-builds)
- [External account cleanup](#external-account-cleanup)
- [Build commands](#build-commands)
  - [Android PR preview and Drive upload](#android-pr-preview-and-drive-upload)
  - [iOS PR preview](#ios-pr-preview-unsigned-simulator-builds), including the
    [key screens](#key-screens)
  - [Android audio test on release PRs](#android-audio-test-on-release-prs)
- [Automatic store uploads](#automatic-store-uploads)
- [Versions and maintenance](#versions-and-maintenance), including
  [Play Console recommendations](#play-console-recommendations)
- [Decision record](#decision-record): why the builds and credentials are set up this way
- [Research basis](#research-basis)

## Current setup

Neither platform needs an Expo account, an Expo token, or EAS credential storage.
Android runs `expo prebuild` and then Gradle on a GitHub-hosted Linux runner
(`npm run build:android` and `npm run build:android:apk`); a committed config plugin,
`plugins/withAndroidLocalSigning.js`, teaches the generated Gradle project to use a
keystore supplied through environment variables, and
`plugins/withAndroidPhonePortrait.js` keeps phones in portrait (see
[Versions and maintenance](#versions-and-maintenance)). iOS runs Expo prebuild and Xcode on a
GitHub-hosted macOS runner, in its own workflow, `.github/workflows/native-ios-build.yml`.
The church added its Apple signing secrets to the `production` Environment in September
2026; how they were created is in [App Store and Google Play setup](app-store-setup.md).
Which secrets each job reads is under
[GitHub-hosted signing and submission credentials](#github-hosted-signing-and-submission-credentials).

### How the signed builds work

1. Generate temporary `android/` and `ios/` projects with `npx expo prebuild`. No
   keystore or password is passed to Expo prebuild.
2. Restore signing material from `production` Environment secrets into the runner's
   temporary directory. Android decodes `ANDROID_KEYSTORE_BASE64` into a keystore file
   and derives `ANDROID_KEYSTORE_PATH` from its location; the path isn't a secret. iOS
   restores the Apple distribution `.p12` and App Store provisioning profile, checks
   that the profile matches the team and app ID, and imports the certificate into a
   temporary keychain.
3. Build Android with Gradle (`bundleRelease` or `assembleRelease`). The signing config
   plugin changes only the generated `android/app/build.gradle`, which reads
   `ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
   `ANDROID_KEY_PASSWORD` at Gradle runtime; only the Gradle step gets them.
4. Archive and export iOS with Xcode's manual signing (`xcodebuild archive` and
   `xcodebuild -exportArchive`), with an export-options plist generated on the runner
   rather than committed. Both stores' build numbers are computed from the version; see
   [Version numbers](version-numbers.md).
5. Delete the signing files, and on iOS the temporary keychain, installed profile,
   archive, and export files, in an `always()` step, whether the build passed or failed.
   No private key is committed or included in a build artifact.
6. In separate jobs that never see the signing files, upload the AAB to Google Play
   internal testing and the IPA to TestFlight; see
   [Automatic store uploads](#automatic-store-uploads). Releasing to the public stays a
   manual step in each store's console. Before each public release, install the builds
   on a physical iPhone and Android phone, and check that each updates over the previous
   one.

So the workflows own the Android signing configuration, the iOS keychain and export
options, and the build numbers; this isn't a package-only setup. Keep native
customization in `app.json` and config plugins; Expo warns that manual changes to
generated projects can be overwritten by a later clean prebuild. See
[Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
and [config plugins](https://docs.expo.dev/config-plugins/introduction/). What needs
upkeep, such as yearly Apple renewals and runner image retirements, is under
[GitHub Actions minutes and maintenance](#github-actions-minutes-and-maintenance).

### Local Expo template lookup

`scripts/build-android-native.mjs` reuses an existing generated `android/` project
for repeat local builds. This avoids an unnecessary npm registry metadata lookup for
`expo-template-bare-minimum@58.0.9`, including when `--no-install` is used. A clean
GitHub Actions checkout still runs Expo prebuild. When `app.json`, a native config
plugin, or another native setting changes, force regeneration with either:

```bash
npm run build:android:apk:debug -- --prebuild
EXPO_PREBUILD=true npm run build:android:apk:debug
```

The execution environment may still require network approval for a clean prebuild;
that permission is controlled by the runner or sandbox, not by repository settings.

## GitHub Actions minutes and maintenance

Standard GitHub-hosted runners, including standard macOS runners, are currently free for
public repositories such as this one; concurrency and fair-use limits still apply. See
[GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
and [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).
If the repository ever became private, its builds would draw on the plan's monthly
minutes, with macOS minutes counted at a much higher rate than Linux ones (roughly ten
times), so check the billing page before relying on a quota.

The direct native approaches have similar platform-tool maintenance:

| Area | Maintenance required |
| --- | --- |
| Expo/React Native | Update dependencies and rerun prebuild checks when SDK/native dependencies change |
| GitHub runner | Review `runs-on`, Xcode, Node, Java, Android SDK, and NDK versions when images retire |
| iOS | Renew distribution certificates/profiles, retest after Xcode updates, and replace the App Store Connect API key if it's compromised or someone who had it leaves |
| Android | Keep the upload keystore backed up; reset it through Play if compromised |
| Workflow | Keep signing/upload steps, cleanup traps, permissions, and action versions current |

Updating Xcode is usually a workflow YAML/runner-image change plus a validation
build, not a `package.json` edit. Pinning the runner (the current workflows use
`macos-26` and explicitly select Xcode 26.6) avoids surprise upgrades, but requires a
deliberate update when GitHub retires that image. Expo SDK 58 needs Xcode 26.6 or
later: with Xcode 26.2, its `ExpoModulesJSI` framework fails to compile. The iOS PR
preview uses the same Xcode as the signed build, so a toolchain problem shows up on a
release PR before a signed build. The direct workflows keep build
orchestration visible in this repository and avoid another credential boundary.

## Expo 58 Android prebuild

The app uses Expo SDK 58 (`expo ~58.0.0`) with a React Native 0.88 release
candidate, and the matching template package. Use Node 22, the version the native
workflows use. The install commands keep `--force` until the app moves to a stable
React Native release (#211); [Development setup](../README.md#prerequisites) explains
why. Generate the Android project with the exact template version used by the build
script:

```sh
npm install --force
npx expo prebuild \
  --template expo-template-bare-minimum@58.0.9 \
  --platform android
```

The direct-native script generates the ignored Android project from this template
when `android/` doesn't exist yet, was generated for the other app ID (preview or
store), or when you pass `--prebuild`; otherwise it reuses the existing project (see
[Local Expo template lookup](#local-expo-template-lookup)).
Do not hand-edit `android/`; put durable changes in
`app.json` or a config plugin. A manual prebuild can use:

```sh
npx expo prebuild \
  --template expo-template-bare-minimum@58.0.9 \
  --platform android \
  --no-install
```

Then use `npm run build:android`, `npm run build:android:apk`, or
`npm run build:android:apk:debug`; those scripts prebuild on their own when there is no
`android/` project yet.

When the Expo SDK version changes, update the template version in this section, in
the build scripts, and in the iOS workflows to the matching template before
regenerating native files. A test fails if they differ.

## Building an independent fork

The checked-in configuration points to the church's package and bundle identifiers
and its public app assets. A third party must not use the church's signing or store
credentials. Choose identifiers owned by the fork, create its own Apple Developer
and Google Play accounts if it intends to distribute the apps, and create its own
GitHub Environment secrets; GitHub doesn't share the church's with forks, such as
`<your-fork>/sda-church-app`. The direct-native workflow architecture can be reused,
but signing material and account access must remain separate.

## Store accounts and recovery

Who should own the Apple Developer, Google Play, and D&B accounts, how to recover each
one if the organization loses access, and how Apple Developer differs from Apple
Business Manager are in
[Account ownership and recovery](app-store-setup.md#account-ownership-and-recovery).

## GitHub-hosted signing and submission credentials

These are the secrets the signed builds and store uploads read. Who holds each
credential, and why, is in the [credential-custody decision](#credential-custody-decision).

The signing values are Environment secrets in the protected `production` Environment of
the church's upstream repository, not Repository secrets:

```text
ANDROID_KEYSTORE_BASE64       # base64 of the upload keystore (.jks)
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS              # e.g. nyccsda-upload
ANDROID_KEY_PASSWORD
IOS_DISTRIBUTION_CERTIFICATE_BASE64
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD
IOS_PROVISIONING_PROFILE_BASE64
IOS_TEAM_ID
```

The store-upload credentials are kept apart from these, in a separate `store-upload`
Environment used only by the upload jobs:

```text
APP_STORE_CONNECT_API_KEY_ID
APP_STORE_CONNECT_API_ISSUER_ID
APP_STORE_CONNECT_API_PRIVATE_KEY
GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER
GOOGLE_PLAY_SERVICE_ACCOUNT
```

The two Google Play values aren't keys: the upload signs in without one. Setting up
`store-upload` is under [Automatic store uploads](#automatic-store-uploads).
`production` also holds the other workflows' secrets: `CLASPRC_JSON` (the Apps Script
deploy, the QR code upload, and the Android PR preview's Drive upload),
`APPS_SCRIPT_PROJECT_ID` and `APPS_SCRIPT_DEPLOYMENT_ID` (the Apps Script deploy), and the
optional `GOOGLE_DRIVE_FOLDER_ID` (the Drive upload). A third environment,
`screenshot-review`, holds no secrets; it only holds the
[Screenshots reviewed](#key-screens) check for approval.

To set up `production`, open **Settings → Environments** in the upstream repository and
create or select `production`. Require at least one reviewer, and restrict deployment
branches to `main` and `release-candidate`, so a manual QR code run from
`release-candidate` can reach its approval step (the Apps Script deploy skips on any
branch but `main`). The Android PR preview runs in `main`'s
context, and the signing jobs themselves run only on `main`. Then:

- **Store binary files base64-encoded.** The keystore, `.p12`, and provisioning profile
  are binary, so their secrets hold base64 text. Base64 is only an encoding; the GitHub
  secret is the protection. Never echo the encoded or the decoded value.
- **Don't store `ANDROID_KEYSTORE_PATH`.** The workflow writes the keystore to a fresh
  runner-temporary path and passes that path to the build script.
- **Delete duplicates and leftovers.** If a name exists at both scopes, the Environment
  value wins, but a Repository-secret copy is readable by every workflow and weakens the
  boundary. To move one, add the value to `production`, check that the protected
  workflow uses it, then delete the repository copy. No workflow reads `EXPO_TOKEN`; if
  one is still set anywhere, delete it.
- **Review before approving.** The build jobs have read-only repository permissions and
  pin their third-party Actions, but anyone who can change a trusted workflow and get it
  approved can use its secrets. Review workflow changes before approving a signing run.

## iOS setup: GitHub-hosted direct builds

**Native iOS build** (`.github/workflows/native-ios-build.yml`) needs the four `IOS_*`
secrets above in `production`. What each one holds, how to create the certificate and
profile and encode them on Windows or macOS, and the yearly renewal are in
[App Store and Google Play setup](app-store-setup.md#apple-app-store).

On the runner, the workflow installs dependencies and CocoaPods and generates the
ignored iOS project. It checks that the profile belongs to `IOS_TEAM_ID` and to
`org.nyccsda.app` before importing anything, refuses to run if `app.json` sets
`expo.ios.buildNumber`, and then signs, archives, and exports an App Store IPA as in
[How the signed builds work](#how-the-signed-builds-work). Only the IPA is uploaded as an
artifact. The build job has no App Store Connect API key; the separate **Upload to
TestFlight** job, in `store-upload`, uploads the IPA.

## Android setup: GitHub-hosted direct builds

The church has completed these steps; its first Play upload, 0.39.0, was made by hand
(see [Signing and the first upload](app-store-setup.md#signing-and-the-first-upload)).
They're kept here, in order, for replacing a lost or compromised upload key and for
anyone setting up a fork.

### 1. Identify the key Google Play expects

Open Play Console → **Test and release → Setup → App integrity** and inspect
**App signing** and **Upload key certificate**.

- If this app has already had an AAB uploaded, keep using the matching upload
  private key. A newly generated key will not sign updates unless Google resets
  the upload key for the app.
- The Play Console's app-signing private key is held by Google and is not
  something to download; CI needs only the upload key. If an existing upload key
  was generated elsewhere, recover it from the church's encrypted backup rather
  than creating a replacement.
- If no release has ever been uploaded and there is no existing upload key,
  generate a new one as described below.
- If the current upload key is lost or compromised, use Play Console's upload
  key reset process. Do not silently create a second keystore and hope that
  Play accepts it.

### 2. Generate an upload key only when needed

Run this outside the repository, on an organization-controlled computer. Replace
the placeholder path with a protected location. Do not commit the `.jks` file.

```sh
umask 077
keytool -genkeypair -v \
  -storetype JKS \
  -keystore /path/outside/repo/nyccsda-upload.jks \
  -alias nyccsda-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

keytool -list -v \
  -keystore /path/outside/repo/nyccsda-upload.jks \
  -alias nyccsda-upload
```

Use a unique, long password for both the keystore and private key unless the
church's existing key uses different values. Save the file, alias, and
passwords in an encrypted organization password manager and in a separate
encrypted offline backup. The `.jks` is an upload key, not the Play app-signing
key. The `10000`-day validity is deliberate: Android upload keys do not need
annual rotation and should normally remain stable for the life of the app.

### 3. The Play version code

`app.config.js` computes the `versionCode` from the version (`1.0.1` becomes
`1000001`); see [Version numbers](version-numbers.md).

### 4. Configure the protected GitHub Environment

Add the four `ANDROID_*` values to `production`, set up as described under
[GitHub-hosted signing and submission credentials](#github-hosted-signing-and-submission-credentials).
Create the base64 value locally and paste it into the secret without printing the
keystore or password. On macOS, for example:

```sh
base64 -i /path/outside/repo/nyccsda-upload.jks | tr -d '\n' | pbcopy
```

On Linux, use `base64 -w 0 /path/outside/repo/nyccsda-upload.jks` and paste the output
directly into GitHub.

### 5. Build and verify before uploading

For ordinary local smoke testing, use the debug-signed APK. It does not need
the production upload keystore or any signing secrets:

```sh
npm ci --force
npm run build:android:apk:debug -- --output /tmp/nyccsda-local-preview.apk
```

The debug APK is suitable for installing on a test device, but it must never
be uploaded to Google Play. A truly unsigned APK is generally not installable.

**The debug APK is a separate app, "NYCCSDA Preview".** It's built with the app ID
`org.nyccsda.app.preview` instead of `org.nyccsda.app`, so it installs beside the
Play or internal-testing version rather than conflicting with its signature, and
keeps its own settings and saved verses (#378). `app.config.js` sets the ID and name
when `scripts/build-android-native.mjs` builds with `--debug`; store builds never get
them. With both installed, an `sdachurchapp://` link asks which app to open. Commands
that name the app, such as `adb shell am start … org.nyccsda.app.preview` and the
Android audio test (`E2E_PACKAGE`), use the preview ID. A reused `android/` project
is regenerated whenever the ID it was generated with doesn't match.

Only a maintainer on a trusted machine should create a locally signed release
artifact. If that is necessary, set the four signing variables only in the
current terminal session. `ANDROID_KEYSTORE_PATH` points to the real JKS file;
the other values are the values recorded in the password manager:

```sh
export ANDROID_KEYSTORE_PATH=/path/outside/repo/nyccsda-upload.jks
export ANDROID_KEYSTORE_PASSWORD='paste-only-in-your-terminal'
export ANDROID_KEY_ALIAS='nyccsda-upload'
export ANDROID_KEY_PASSWORD='paste-only-in-your-terminal'

npm ci --force
npm run build:android:apk -- --output /tmp/nyccsda-preview.apk
npm run build:android -- --output /tmp/nyccsda-release.aab

unset ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD
```

Both paths generate the ignored Android project with Expo prebuild (or reuse an
existing one; see [Local Expo template lookup](#local-expo-template-lookup)), apply
the committed signing plugin, invoke Gradle, and copy the result to the requested
path. The signed path refuses to build without complete signing values, and every
build refuses a hand-set `versionCode` in `app.json`. The signed APK is useful for
physical-device testing; the AAB is what goes to Google Play.

Verify the artifact locally before uploading:

```sh
jarsigner -verify -verbose -certs /tmp/nyccsda-release.aab
```

Every release uploads its AAB to internal testing automatically; see
[Automatic store uploads](#automatic-store-uploads).

### Android rotation and recovery policy

There is no annual Android upload-certificate expiration requirement. Keep the
same upload keystore indefinitely, rotate it only for a compromise, loss of
organizational control, or a deliberate security policy, and retain two
independent encrypted backups. If it must change, initiate the Google Play
upload-key reset and wait for Play to confirm the new certificate before using
the replacement in GitHub.

The automatic Google Play upload doesn't use the upload keystore to sign in. It signs
in as the `play-upload` service account **without a key**, so there's no second
credential to back up or rotate; see
[Setting up the Google Play service account](#setting-up-the-google-play-service-account).
When an administrator leaves, remove them as an Owner of the Google Cloud project and
from Play Console.

## External account cleanup

The repository no longer uses EAS. Before deleting any external Expo account, a separate
manual step, confirm that the church doesn't need its project history, exported
credentials, or records.

## Build commands

### Android direct-native commands

The Android scripts generate the ignored native project with Expo prebuild when needed
(see [Local Expo template lookup](#local-expo-template-lookup)), apply the config
plugins in `plugins/`, and invoke Gradle directly. Signed release
commands require the four `ANDROID_*` variables (see
[Android setup](#android-setup-github-hosted-direct-builds)); the debug commands do not:

```sh
npm run build:android:apk -- --output /absolute/path/app.apk
npm run build:android -- --output /absolute/path/app.aab
npm run build:android:apk:debug -- --output /absolute/path/local-preview.apk
npm run build:android:apk:debug:arm -- --output /absolute/path/preview-arm.apk
npm run build:android:apk:debug:intel -- --output /absolute/path/preview-intel.apk
```

The debug commands use Gradle's automatically generated debug key and do not require
or touch the production upload keystore. They create a standalone APK for local device
testing that must never be uploaded to Google Play. A truly unsigned APK is generally
not installable.

`build:android:apk:debug` builds for all four Android processor types, the generated
project's default. The `:arm` and `:intel` versions pass `--architectures arm`
(`armeabi-v7a` and `arm64-v8a`, for phones and other ARM devices) or
`--architectures intel` (`x86` and `x86_64`, for emulators on Intel and AMD computers)
to `scripts/build-android-native.mjs`, which builds only those, so the build is faster
and the APK smaller. **Android PR preview** uses `:arm`; **Android audio e2e** uses
`:intel` for its emulator. Without `--output`, the file name ends in `-arm` or
`-intel`.

The signed APK is for direct installation/testing, and the AAB is the Google Play artifact.

| Target | Recommended build path |
| --- | --- |
| iOS IPA (TestFlight/App Store) | **Native iOS build** workflow |
| Android AAB (Google Play) | `npm run build:android` |
| Android APK (direct installation) | `npm run build:android:apk` |
| Android APK (local debug key) | `npm run build:android:apk:debug` |
| Android APK (local debug key, ARM devices such as phones) | `npm run build:android:apk:debug:arm` |
| Android APK (local debug key, emulators on Intel or AMD) | `npm run build:android:apk:debug:intel` |

The direct Android commands output a binary on this computer; append
`--output /absolute/path/app.aab` or `.apk` to choose its destination. Without it,
the file goes in `build/`. The
preview APK is standalone and does not require Metro. The direct iOS workflow
uses the App Store distribution profile and a build number computed from the version;
internal iOS distribution is not TestFlight.

Local iOS builds require macOS, Xcode with command-line tools, and CocoaPods. Local
Android builds require macOS or Linux, Node 22 or 24, Java 17, the Android SDK and NDK, and
accepted SDK licenses. The workflows install `platforms;android-37.0`,
`build-tools;37.0.0`, and `ndk;27.1.12297006`; install the same with Android Studio or
`sdkmanager`. Configure `ANDROID_HOME` and the Android
command-line tools on PATH.
Direct Android and iOS compilation require network access for npm dependencies,
the Expo template, and CocoaPods, but not Expo authentication. They are not
offline build paths. Build one platform at a time.

**On Windows, use WSL.** The Android build script runs Gradle as `./gradlew`, which
works on macOS and Linux but not in a Windows command prompt or PowerShell. Inside WSL
it's a Linux build: install Node 22, Java 17, and the Linux Android SDK in WSL, as
above, and run the commands there. iOS builds, including
`npm run build:ios:simulator`, need a Mac. To run the
[Android audio test](#android-audio-test-on-release-prs) script from WSL against an
emulator or phone that Windows manages, set `ADB` to Windows's `adb.exe`.

In GitHub Actions, select **Native Android build → Run workflow** for an Android AAB
or APK. Select **Native iOS build → Run workflow** for an iOS IPA; its build number
is computed from the version. Both must run on `main`. Android compiles
directly with Gradle on Ubuntu 24.04 / Java 17; iOS compiles directly with Xcode
on macOS 26 / Xcode 26.6. Download the signed binaries from the run's Artifacts
section: Android's are kept 14 days and the iOS IPA 90 days. A merge into `main`
also attaches the AAB, APK, and IPA to that version's GitHub Release, where they stay.
Neither workflow requires Expo authentication.
GitHub compilation uses GitHub runner minutes/storage.
On `main`, a manual Android run builds both the AAB and the APK whichever boxes are
ticked; the AAB box only decides whether the AAB is also uploaded to Google Play
internal testing. Native failures do not block the website deployment.

### Android PR preview and Drive upload

**Android PR preview** builds with no signing credentials: it makes a debug APK, signed
only with Gradle's local debug key, for ARM phones and tablets
(`npm run build:android:apk:debug:arm`). It runs automatically for release pull requests
into `main`, from `release-candidate` in this repository, and skips fork PRs. It does
not accept manual commit or pull-request SHA inputs and does not use dependency caching
while executing PR code in the `pull_request_target` context.

For an automatic PR run, a separate protected `production` Environment job downloads only
the APK artifact and checks out the upload helper from the trusted base commit. It does not
check out or execute PR code while the Google credential is available. The helper refreshes
the existing `CLASPRC_JSON` OAuth token and
uploads a private APK file to the connected user's My Drive root. The OAuth account must
retain the `drive.file` scope. To upload into a folder instead, add a
`GOOGLE_DRIVE_FOLDER_ID` secret to `production`; the upload job already passes it to the
helper.

`production` requires a reviewer, so the Drive upload waits for someone to approve it.
The Drive upload job must remain separate from the build job, and the upload helper must
be checked out from the trusted base commit rather than the PR head.

### iOS PR preview (unsigned Simulator builds)

The iOS counterpart of the Android PR preview. A Simulator build runs the app on a
simulated iPhone on a Mac. It needs no Apple
signing, certificate, developer account, or iPhone, but it can't be installed on a
real iPhone; use the signed **Native iOS build** and TestFlight for that. Only GitHub
Actions and a local Mac are used; no other build service.

**On a Mac.** Install Xcode 26.6 or later and CocoaPods, then:

```sh
npm install --force
npm run build:ios:simulator                          # Release build, JavaScript bundled in
npm run build:ios:simulator -- --debug               # Debug build that loads JavaScript from Metro
npm run build:ios:simulator -- --device "iPhone 17"  # Choose the simulated iPhone
npm run build:ios:simulator -- --prebuild            # Regenerate ios/ after native config changes
```

`scripts/build-ios-simulator.mjs` generates the ignored `ios/` project with the same
Expo template as the other native builds (a test keeps the versions in step). It then
runs `expo run:ios`, which installs CocoaPods, builds, installs the app on the
Simulator, and opens it. Xcode builds for the Mac's own processor, so the same command
works on Intel and Apple Silicon Macs. On Windows or Linux, the command explains that it
needs a Mac.

**In GitHub Actions.** The **iOS PR preview** workflow (`ios-pr-preview.yml`) builds
each release PR into `main` without signing. It runs on an Apple
Silicon runner (`macos-26`, arm64), with the same Xcode as the signed iOS build. The job
installs the app on the simulated iPhone that `test/screens/screens.json` names (an
iPhone 17 Pro Max, on the newest iOS runtime) and fails if it isn't still running 45
seconds after launch. It also uploads the app and a screenshot of its first screen
(14-day retention), named like the Android preview's
`sda-church-app-pr-<number>-<run>-arm-debug.apk`:

- `sda-church-app-pr-<number>-<run>-arm64-simulator.zip`: the app;
- `sda-church-app-pr-<number>-<run>-arm64-first-screen.png`: the screenshot;
- `screens/ios/<screen>-<variant>.png`: the key screens, described below.

Pull requests into `release-candidate` don't run it, and neither do other pull
requests into `main`, such as Dependabot's. To test a change to the workflow,
`scripts/build-ios-simulator.mjs`, or the key screens before the release PR, start it by
hand on your branch from the Actions tab. The workflow reads no secrets, so it is safe on pull requests.

**Install a downloaded build on a Mac.** From the run's Artifacts section, download the
artifact ending in `-arm64`, and unzip the download and then the `.zip` inside it to get
the `.app`. It runs on an Apple Silicon Mac; for an Intel Mac, see below. Open the Simulator
(Xcode > Open Developer Tool > Simulator) and drag the `.app` onto the simulated
iPhone, or run:

```sh
xcrun simctl install booted /path/to/the.app
xcrun simctl launch booted org.nyccsda.app
```

**On an Intel Mac.** The workflow builds only for Apple Silicon, which nearly every Mac
in use has; Apple sold its last Intel Mac in 2023. The Intel build was dropped in 1.2.1,
because it took about 37 minutes and held up every release PR. On an Intel Mac, build
the app yourself with `npm run build:ios:simulator` (**On a Mac**, above), which builds
for the Mac's own processor. To build it in the workflow again:

1. Add the Intel runner back to the `simulator` job's matrix in
   `.github/workflows/ios-pr-preview.yml`:

   ```yaml
             - mac: Intel
               runner: macos-26-intel
               arch: x86_64
   ```

   The key-screen steps already run only on the Apple Silicon build, and its
   artifact ends in `-x86_64`.
2. Update the test in `test/native-build-safety.test.ts` that checks the job builds for
   Apple Silicon only.
3. Once that's in `release-candidate`, add `Build iOS Simulator app (Intel Mac)` to the
   **Main protection** ruleset's required checks; see
   [Changing a required check](admin-runbook.md#changing-a-required-check).

#### Key screens

The Apple Silicon job also screenshots the 30 screens listed in
`test/screens/screens.json`, 81 shots in all, so a layout problem on iPhone shows up
before release rather than in TestFlight (#331). `scripts/capture-ios-screens.cjs`
takes each one:

1. It saves the settings the app reads at startup into the app's storage: setup
   finished, the language, theme, and text size for that shot, and the screen to
   open. Nothing on a build runner can tap the Simulator's screen, which rules out
   both the first-launch setup dialog and the "Open in …?" prompt iOS shows before
   following a deep link. So the app reads the screen from its storage once at launch
   (`services/ScreenshotRoute.ts`) and forgets it. Only this Simulator build does
   that: its build step sets `EXPO_PUBLIC_KEY_SCREENS=1`, which Expo writes into the
   app, and the store builds never set it, so on a real phone the app never looks for
   a saved screen. A test checks that no other workflow sets it.
2. It launches the app, waits for the screen to load, and saves
   `screens/ios/<screen>-<variant>.png`. Each shot gets a fresh launch, so the 81 shots
   take about 24 of the run's 50 minutes.
3. The status bar is fixed (9:41, full battery and signal), so images differ only when
   the app does. The iOS 26 Simulator draws the Dynamic Island into its screenshots,
   although a real iPhone's screenshots leave it out.

Variants cover dark mode, 150% and 200% app text, the iPhone's own largest text sizes,
and the Chinese and Spanish interfaces. Some screens reproduce bugs fixed before:
Psalm 119's three-digit verse numbers at 200%, a chapter opened at verse 14 so text sits
under the status bar, and the Bible header with two translations and a back arrow.

**Automatic checks.** The run fails, and the step summary says why, if the app isn't
running after launch, if it didn't open the saved screen, if a screenshot is blank or
still shows the launch splash, or if a screen marked `statusBarClear` shows anything
behind the status bar. A blank or splash screenshot is retaken every 2 seconds, up to 10
times, before it counts.

**Text checks.** `scripts/check-screens.cjs` then reads each screenshot's text with
Apple's Vision framework (`scripts/ocr-screens.swift`, built into macOS) and checks what
every screen must show:

- the tab labels, in the shot's language, in the tab bar;
- on Bible screens, the verse button's whole label in the chapter controls, so a
  cut-off "V" fails;
- a screen's `mustShowLines`, regular expressions some line must start with, so a verse
  number split across two lines fails, and its `mustNotShowLines`, which no line may
  match. A `mustShowLines` rule can also be `{ "line": …, "minLeft": 0.5 }`, for a
  line that must start at least that far across, such as Psalm 9's right-aligned
  "Selah". `variantRules` adds either for one variant. The Bible header uses them: the
  translation button shows its 文A icon (which Vision reads as "XA"), the EN badge, and
  both full names, and at 150% and 200% with a back arrow it shows them without the icon;
- no system prompt ("Open in"), setup dialog ("Get Started"), or unfilled value
  ("undefined", "NaN").

Each label counts only where it belongs, so "Read Verse" on Home isn't the verse button.
A missing label gets a second read of its strip, enlarged and with its contrast
stretched. One-character labels, such as 您 and 節, aren't required: Vision often misses
a lone Chinese character, and it can't be cut short anyway. A screen without the tab bar,
such as the Bible while reading, sets `"tabs": false`. What Vision read is saved as
`ocr.json` beside the screenshots, and the results as `checks.json`.

The first real runs showed what this catches. Every screen covered by iOS's "Open in"
prompt failed, and so did one screenshot the app hadn't drawn yet, which the blank check
then missed. To try a rule change without waiting for a 50-minute run, start the
workflow by hand with **screens_from_run** set to an earlier run's ID: it downloads that
run's screenshots and only checks them. The tests use text Vision read from real screenshots
(`test/screens/ocr-samples.json`), unedited. It includes Vision's mistakes on text
that's fine on screen, such as "ANDKPW MUKKA" for the "ANDREW MURRAY" printed small on
the *Humility* cover image, and "eternal life4." for a verse with footnote 4. The
checks look only for particular labels in particular places, so text like that can't
pass or fail them, and a test makes sure of it.

**Human review.** Other layout problems, such as a cut-off label, need a person. On the
release pull request into `main`, the iOS preview posts a notice when the pull request
opens or gets a push (the run takes about 50 minutes) and removes the comment with the
earlier, now out-of-date screenshots. When the run finishes, it replaces the notice with a
comment linking that commit's screenshots. Its last job, **Screenshots reviewed**, waits
in the `screenshot-review` environment until a **release-approvers** member approves.
Each push needs a new approval, and the job fails if the environment doesn't require
one. [Approving the screenshots](admin-runbook.md#approving-the-screenshots) has the
steps and the setup.

**App Store screenshots.** The images are 1320 × 2868, the App Store's 6.9-inch iPhone
size. The shots listed under `appStore` in the screen list are also copied, numbered in
upload order, to `screens/app-store/<language>/`, without the transparency the
Simulator's PNGs have, which App Store Connect rejects. They're ready to upload; see
[Store assets](../store-assets/README.md). When to refresh the stores' screenshots is in
step 2 of the runbook's [Uploading to the stores](admin-runbook.md#uploading-to-the-stores).

To add a screen, add an entry to `test/screens/screens.json`: a `name`, the deep link
`path` without the scheme, any Bible `settings`, the `variants` to take, and any
`checks`. Leave out screens that show members' names or photos, such as the bulletin,
the team page, and the fellowship page; `test/screens.test.ts` checks this. A new
setting also needs its storage key in the script's `SETTING_KEYS`, and the test checks
the app still reads that key. A screen whose content changes every day, such as Home
with its verse of the day and countdown, is marked `changesDaily`, for when these images
are compared with known-good copies.

### Android audio test on release PRs

**Android audio e2e** (`android-audio-e2e.yml`) checks Bible audio on a real Android
player, which Jest can't reach. It runs on each release PR into `main`, where its job,
**Bible audio on an Android emulator**, is a required check, and it can be started by
hand on any branch. It skips other PRs and forks, and reads no secrets. On an Ubuntu
runner it builds the debug APK with `npm run build:android:apk:debug:intel`, boots an
Android 16 (API 36) emulator, and runs `scripts/e2e/android-bible-audio.sh`. The
[admin runbook](admin-runbook.md#bible-audio-emulator-test) describes each scenario, what
to do when it fails, and how to run the script on your own emulator.

## Automatic store uploads

After you approve a release's signed builds, two more jobs upload them to testers
automatically, with no further clicks:

- **Upload to TestFlight**, in **Native iOS build**, uploads the IPA to App Store
  Connect. It appears in TestFlight once Apple finishes processing it, usually within
  half an hour, and an internal group with automatic distribution gets it.
- **Upload to Google Play internal testing**, in **Native Android build**, signs in
  through the church's [Google Cloud project](../architecture.md#google-cloud-free-only)
  without a key, uploads the AAB, and rolls it out to the internal testing track. Its
  "What's new" text is the
  release PR's title without the `Release/x.y.z:` prefix: `Release/0.40.0: Faster
  bulletin (#300)` becomes "Faster bulletin". A title with nothing after the version
  gives no notes.

Nothing reaches the public automatically. After testing on real devices, a maintainer
submits the iOS build for review from App Store Connect's **Distribution** page, and
promotes the Android release to production in Play Console. **Promoting copies the
testers' "What's new" text,** so rewrite it for the public before rolling out.
TestFlight builds have no "What to Test" text; add one in App Store Connect if
testers need it.

### How the credentials are kept apart

- The store credentials live in their own `store-upload` Environment. The build jobs,
  which hold the signing keys, never see them. Google Play needs no stored key at all:
  GitHub vouches for the upload job, and Google returns a token that expires within an
  hour (see [Setting up the Google Play service account](#setting-up-the-google-play-service-account)).
- The upload jobs never see the signing keys. They download the finished file and
  upload it without running any npm packages: iOS uses Apple's `altool`, and Android
  uses `scripts/upload-google-play.cjs`, which needs only Node's built-ins. So a
  compromised dependency in a build job can't reach the store credentials.
- Both run only for `main` in the church's repository, and skip with a notice until
  their secrets are set.

Why a separate environment instead of `production`:

- **`production` is shared.** The signed builds, the Apps Script deploy, the QR code
  upload, and the Android PR preview's Drive upload all use it, and the preview runs
  for pull requests. Any job that names an environment can read every secret in it.
  In `store-upload`, only the two upload jobs can reach the store credentials.
- **One approval instead of two.** `production` requires a reviewer for every job.
  The upload jobs start after the builds finish, so in `production` each release would
  ask for a second approval. `store-upload` has no reviewer, so approving the builds
  is the only click, and the uploads reach only testers.
- **Separate control.** Uploads can be paused, for example by adding a reviewer or
  removing a secret, without touching signing or the other deploys.

### One-time setup

1. **The environment:** Settings → Environments → **New environment** → `store-upload`.
   Under **Deployment branches and tags**, allow only `main`. It doesn't need required
   reviewers: approving the signed builds already gates the uploads, which reach only
   testers.
2. **App Store Connect:**
   1. The Account Holder requests API access under **Users and Access → Integrations
      → App Store Connect API**. Its terms limit the API to a team's own internal
      development and testing, which uploading the church's builds to TestFlight is.
   2. Generate a **Team key** with the **Developer** role, the smallest role that can
      upload builds. Download its `.p8` file right away (Apple allows it only once),
      and keep it with the other signing files.
   3. Add these secrets to `store-upload`:
      - `APP_STORE_CONNECT_API_KEY_ID`: the key's ID.
      - `APP_STORE_CONNECT_API_ISSUER_ID`: the issuer ID shown above the list of keys.
      - `APP_STORE_CONNECT_API_PRIVATE_KEY`: the whole `.p8` file, including its
        `BEGIN` and `END` lines.
   4. Create an internal testing group, so each new build reaches its testers: App
      Store Connect → **Apps** → the app → **TestFlight** → **Internal Testing** in
      the sidebar → **+**. Name it, such as `Church testers`, tick **Enable automatic
      distribution**, and click **Create**. Then add testers under **Testers → +**. Only
      users on the App Store Connect team can be internal testers (up to 100); invite
      anyone else under **Users and Access** first. Each tester gets an email and
      installs the build with Apple's **TestFlight** app on their iPhone.
3. **Google Play:** Play accepts uploads through its API only after the app's first
   upload is made by hand in Play Console. After that, follow
   [Setting up the Google Play service account](#setting-up-the-google-play-service-account).

### Setting up the Google Play service account

Google's upload API accepts only a *service account*: a robot Google account kept in a
Google Cloud project. GitHub signs in as it **without any key**: it vouches that the
job runs in the church's repository, in the `store-upload` environment on `main`, and
Google returns a token that expires within an hour. This is called *Workload Identity
Federation*. There's nothing to store, leak, or renew, and it's a one-time setup;
every release after that signs in on its own. **It costs nothing and needs no billing
account.**

Why not a key file: the church's Google organization blocks service account keys with
Google's *Secure by Default* policy, `iam.managed.disableServiceAccountKeyCreation`. A
super admin could turn it off for this project, but a key file never expires and can
leak, so the church kept the policy on and uses keyless sign-in instead. The
[Google Play upload sign-in diagram](../architecture.md#google-play-upload-sign-in)
shows each step.
[Service limits and costs](service-limits-and-costs.md#google-cloud-play-upload-service-account)
records why, and the rules that keep it free.

**Create the project**

1. Open [console.cloud.google.com](https://console.cloud.google.com) and sign in with
   a church (`nyccsda.org`) admin account. On a first visit, choose the country, accept
   the terms, and continue.
   - If Google offers a **free trial**, or asks you to **activate** an account with a
     card, dismiss it. That creates a billing account, which this project must never
     have.
   - If the console says your account can't use Google Cloud, a Workspace admin turns
     it on under **Admin console → Apps → Additional Google services → Google Cloud**.
2. Click the project picker at the top of the page (it says **Select a project**),
   then **New project**.
3. Name it `sda-church-app-play`. If that ID is taken, Google suggests one with
   numbers added, which is fine. If **Location** offers `nyccsda.org`, choose it; if it
   offers only **No organization**, leave that, since the project works the same
   either way. It shouldn't ask for a billing account. Click **Create**.
4. When it's ready, choose it in the project picker. Every step below happens inside
   it.
5. So the project doesn't depend on one person, open **IAM & Admin → IAM → Grant
   access** and add the other administrators' church accounts with the **Owner**
   role.

**Turn on the APIs**

6. Menu (☰) → **APIs & Services → Library**. Search for each of these, open it, and
   click **Enable**. None of them asks for billing; if one does, stop.
   - **Google Play Android Developer API**
   - **IAM Service Account Credentials API**
   - **Security Token Service API**
   - **Identity and Access Management (IAM) API**
   - **Cloud Resource Manager API**

**Create the service account**

7. Menu → **IAM & Admin → Service Accounts → Create service account**. Name it
   `play-upload` and click **Create and continue**. Skip the two optional steps
   (**Continue**, then **Done**); it needs no Google Cloud roles. Don't create a key
   for it: the upload doesn't need one, and the organization blocks it. Trying shows
   *"An Organization Policy that blocks service accounts key creation has been
   enforced on your organization"*, which is expected.
8. Copy the account's email address, which looks like
   `play-upload@sda-church-app-play.iam.gserviceaccount.com`.

**Let GitHub sign in as it, without a key**

9. Find the repository's numeric ID: open
   `https://api.github.com/repos/New-York-Chinese-Seventh-day-Adventist/sda-church-app`
   in a browser and note the `"id"` near the top. Google recommends the number
   because, unlike a name, no other repository can ever take it over. It only goes
   into Google Cloud; don't commit it.
10. Menu → **IAM & Admin → Workload Identity Federation → Create pool** (or **Get
    started**).
    - **Name:** `GitHub`. **Pool ID:** `github`. Continue.
    - **Add a provider to pool:** choose **OpenID Connect (OIDC)**. **Provider name**
      and **Provider ID:** `sda-church-app`. **Issuer (URL):**
      `https://token.actions.githubusercontent.com`. **Audiences:** leave **Default
      audience**. Continue.
    - **Configure provider attributes:** set `google.subject` to `assertion.sub`, then
      **Add mapping** for `attribute.repository_id` = `assertion.repository_id`. The
      mapping copies the repository ID out of GitHub's token so that step 11 can match
      on it.
    - **Attribute conditions → Add condition**, with the repository ID from step 9 in
      place of `REPO_ID`:

      ```text
      assertion.repository_id == 'REPO_ID' && assertion.environment == 'store-upload' && assertion.ref == 'refs/heads/main'
      ```

      This is the lock: Google accepts only jobs in this repository's `store-upload`
      environment, on `main`.
    - Click **Save**.
11. On the pool's page, click **Grant access → Grant access using service account
    impersonation**. Choose `play-upload`. Under **Select principals**, choose **Only
    identities matching the filter**, attribute `repository_id`, and the repository ID
    as the value. Click **Save**, and close the **Configure your application** window
    that follows; you don't need its file. This gives identities from this repository
    the **Workload Identity User** role (`roles/iam.workloadIdentityUser`) on
    `play-upload`: permission to get tokens as it, and nothing else.
    - To check, open the pool's **Connected service accounts** tab. It should list
      `play-upload`; expand it to see `attribute.repository_id="<the ID>"`. Ignore
      the **Download** buttons there; nothing needs those files.
    - If Google refuses because an organization policy limits who can be granted
      access, a super admin allows this project's workload identity pool in that
      policy.
12. Copy the provider's name. Open the `sda-church-app` provider: its **Default
    audience** looks like
    `https://iam.googleapis.com/projects/123456789/locations/global/workloadIdentityPools/github/providers/sda-church-app`.
    Copy it as it is; the upload drops the `https://iam.googleapis.com/` part.

**Let it upload in Play Console**

13. In Play Console, **Users and permissions** is on the developer account's page,
    not in the app's menu: click **← All apps** at the top left, then **Users and
    permissions → Invite new users**. Paste the email address from step 8. On the
    **App permissions** tab, **Add app**, choose the church app, and tick only
    **Release apps to testing tracks**. That's the permission's name; the app doesn't
    need any testing tracks yet. Click **Invite user**; a service account doesn't
    need to accept.
14. New permissions can take up to a day to reach the API. If the first automatic
    upload fails with a permission error, rerun it later.

**Give GitHub the two settings**

15. Settings → Environments → `store-upload` → **Add environment secret**, twice:
    - `GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER`: the provider name from step 12.
    - `GOOGLE_PLAY_SERVICE_ACCOUNT`: the email address from step 8.

    Neither is a key. They're secrets only so that the logs of this public repository
    don't show the project number.

**Check the setup**

Everything below should be true before the first automatic upload:

- [ ] Google Cloud → **Billing**: the project has no billing account, and no free trial
      was started.
- [ ] **APIs & Services → Enabled APIs & services** lists the five APIs from step 6.
      Google also turns on others, such as BigQuery and Cloud Storage, for every new
      project. Without a billing account they can't cost anything, so leave them.
- [ ] **IAM & Admin → IAM** lists every IT administrator as **Owner**.
- [ ] **Workload Identity Federation → github**: the `sda-church-app` provider shows a
      green status, and **Connected service accounts** lists `play-upload`.
- [ ] Play Console → **Users and permissions** lists `play-upload@…` as **Active**,
      with **Release apps to testing tracks** on the app.
- [ ] GitHub → Settings → Environments → `store-upload`: deployment branches allow only
      `main`, and the secrets are the three `APP_STORE_CONNECT_API_*` values plus
      `GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER` and `GOOGLE_PLAY_SERVICE_ACCOUNT`.
- [ ] The app's first release has been published by hand to internal testing; see
      [Signing and the first upload](app-store-setup.md#signing-and-the-first-upload).

### Reading the result

| The job reports | What it means | What to do |
| --- | --- | --- |
| Uploaded | The build is on its way to testers | Test it |
| A notice that the upload was skipped | The secrets aren't set | Add them to `store-upload` |
| Already on TestFlight, or Google Play already has it | A rerun of the same release; the store has this build number | Nothing |
| Uploaded as a draft | Play accepts only drafts until the app's first release is rolled out | Roll it out in Play Console → **Test and release → Internal testing** |
| Changes need to be sent for review by hand | Play requires that for this app right now | Play Console → **Publishing overview** → send the changes for review |
| Keyless sign-in failed at Google's token exchange | Google refused GitHub's identity token: the provider's condition, the repository ID, or the provider name in `GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER` doesn't match | Check steps 9, 10, 12, and 15 of [the service account setup](#setting-up-the-google-play-service-account) |
| Keyless sign-in failed at the service account token | Google accepted GitHub but won't let it act as `play-upload`: the pool isn't connected to the service account, or the IAM Service Account Credentials API is off | Check steps 6 and 11; the pool's **Connected service accounts** tab should list `play-upload` |
| "The caller does not have permission" from Google Play | The service account isn't in Play Console yet, or the permission hasn't reached the API | Check step 13, and rerun after a day |
| Failed | The log has the store's message, often a revoked key or a missing permission | Fix the cause and rerun the job, or upload by hand |

### When Apple rejects a build after uploading

A successful **Upload to TestFlight** job means Apple received the build, not that it
passed. Apple then processes it, usually within 30 minutes. If processing finds a
problem, the build never appears in TestFlight, and Apple emails the Account Holder,
`technology@nyccsda.org`, with the subject "The uploaded build … has one or more
issues" and an `ITMS-` code for each problem.

- **ITMS-90683, missing purpose string:** some code in the app references a protected
  API, such as the photo library, even if the app never calls it. Usually it's a
  library. Find it by searching the dependencies' native code, for example
  `grep -rlE "PHPhotoLibrary|UIImagePickerController" node_modules/<package>/ios`.
  If the app doesn't use the library, remove it. If it does, add the key the email
  names to `expo.ios.infoPlist` in `app.json`, with a sentence that honestly says why.
  (0.40.0 hit this with `react-native-share`, which the app didn't use.)

A rejected build still uses up its build number, so the fix ships as a new version, such
as a patch release; see [Version numbers](version-numbers.md).

### Uploading by hand

If an upload job can't run, download the `.ipa` from the release's GitHub Release (or
the run's artifacts, kept 90 days) and upload it with Apple's Transporter app, or
download the `.aab` from the GitHub Release and upload it in Play Console → **Test and
release → Internal testing → Create new release**. Upload the AAB, not the APK.

## Versions and maintenance

`package.json` / `app.json` retain the shared user-facing release version managed by
`npm run sync-version`. Change it explicitly for each release, with
`npm run sync-version -- --version x.y.z` in a pull request into `release-candidate`
once the release's contents are settled. CI doesn't change it:
**Release - PR Version Sync** only checks that the version files match the release
PR's title, and fails if they don't. Both stores'
build numbers are computed from it; see [Version numbers](version-numbers.md).

Keep generated `ios/` and `android/` projects out of Git and express native
configuration through Expo config/plugins. SDK upgrades require checking
Node/Java/Xcode/Android tooling and revalidating physical-device behavior. The app
explicitly pins Android compile API 37, target API 36, and build tools 37.0.0 through
`expo-build-properties`. This split is intentional: Expo SDK 58 and React Native 0.88
compile against API 37 by default, while
Google Play has required new apps and updates to target API 36 since August 31, 2026.
Android's compile SDK and target SDK are separate;
compiling against API 37 does not opt the app into API 37 runtime behavior. The
workflows install the versioned `platforms;android-37.0` package, matching the current
runner image, plus build tools and NDK. Revisit these pins with each Expo SDK upgrade
and when Google Play's target API requirement changes.

Android release builds run R8, which Expo's template turns on to shrink and obfuscate
the code. Since #428 it also removes unused resources
(`enableShrinkResourcesInReleaseBuilds` in `expo-build-properties`, which needs
`enableMinifyInReleaseBuilds` set too). The shrinker can't see images and fonts the
JavaScript loads by name, so Expo's bundler lists them in a `keep.xml` file and the
shrinker keeps everything on that list. If an image is missing only from a release
build, check that it's listed in `android/app/build/generated/res/react/release/raw/keep.xml`.

Phones stay in portrait on both platforms. On iOS, `"orientation": "portrait"` in
`app.json` does it. On Android, `plugins/withAndroidPhonePortrait.js` removes the
manifest's orientation lock and asks for portrait at run time only when the screen's
smallest width is under 600dp, so tablets and unfolded foldables turn freely. Android 16
ignores orientation locks on screens 600dp or wider for apps that target API 36, and Play
Console flags apps that set one (#426). Whether to support iPad is a separate decision
(#324).

Before release, run `npx expo install --check`, `npx expo-doctor`, and `npm run check`.
Then build and test signed binaries on physical iPhone and Android devices, with the
[device checks before release](admin-runbook.md#device-checks-before-release) in the
admin runbook. On Android, the [Android audio test](#android-audio-test-on-release-prs)
covers failover, screen-off chapter changes, and connection loss on an emulator, but not
a physical phone. Successful JavaScript exports alone do not prove native compilation,
signing, playback or store acceptance. OTA updates are not configured by this setup;
website deployments do not update installed native apps.

Local builds are manageable for a maintainer comfortable installing SDK tools.
GitHub’s macOS runner lets you build iOS without
owning a Mac; update the runner/Xcode selection when GitHub retires that version. Both paths still need signing/account maintenance and
periodic store-required SDK updates.

### Play Console recommendations

Play Console's recommendations for a release name code by its R8-obfuscated names, such
as `d61.j`. Each app bundle carries its own R8 map, and the names change with every
build, so use the bundle of the release Play is reporting on. Download its `app.aab`
from that version's GitHub release, then:

```sh
unzip -p app.aab BUNDLE-METADATA/com.android.tools.build.obfuscation/proguard.map > proguard.map
grep -n ' -> d61:$' proguard.map
```

R8 merges classes, so the class on that line may not be the code Play means. Read the
indented lines under it that end in `-> j`: each names the original method.

The recommendations for 1.0.0 traced to:

| Recommendation | What it was | Outcome |
| --- | --- | --- |
| Deprecated edge-to-edge APIs | React Native and Google's Material Components, not the app's code | Waits for those libraries to drop the calls (#425) |
| Orientation restrictions on large screens | `"orientation": "portrait"` in `app.json` | Portrait lock moved to run time, phones only (#426) |
| Bitmap image optimization | Fresco (React Native's image loader), Media3 audio streaming, Kotlin, and expo-audio's lock-screen artwork, which the app doesn't use | Nothing to change (#427). Lock-screen artwork, if added, should be a small image: expo-audio decodes it at full size |
| R8 resource shrinking | Not turned on | Turned on (#428) |

## Decision record

Why the builds and their credentials are set up this way.

### Decision rationale and risk register

| Decision | Reason | Remaining risk / control |
| --- | --- | --- |
| Build Android with prebuild + Gradle | Removes Expo authentication and EAS credential custody from Android while using the public repository's free standard Linux runner | Expo template, Gradle, Java, SDK, and NDK updates still need periodic validation |
| Keep native directories ignored | Expo Continuous Native Generation makes `app.json` and config plugins the source of truth and avoids hand-edited generated files | A clean prebuild can overwrite manual native edits; keep native behavior in config/plugins |
| Store Android signing values in the protected GitHub Environment | Google retains the final Play app-signing key; CI needs only the upload key and four narrowly scoped values, while GitHub provides reviewer approval and branch controls | Repository-level copies weaken environment scoping; keep the four values only in `production`, require approval, restrict trusted refs, use least privilege, and review Actions |
| Do not rotate the Android key annually | Upload keys do not expire annually; keeping the same key preserves the Play update path | Maintain encrypted backups; use Play's upload-key reset process after loss or compromise |
| Build iOS with prebuild + Xcode | Removes Expo authentication and EAS credential custody from iOS while using trusted-branch or manual macOS workflows | Apple certificate/profile renewal and Xcode/runner updates still need periodic validation |
| Upload automatically to testing only | Testers get every release without anyone moving files by hand, while the public release stays a manual step in each console | Store credentials are in a separate `store-upload` environment and job that runs no npm packages; the first Play upload was made by hand, as Play requires |
| Do not build signed binaries before `main` | Production signing material is reserved for the post-merge `main` build. | Pull-request previews stay unsigned: an ARM debug APK and iOS Simulator builds. Fork PRs get no native builds |

This is why the migration is not just “put the JKS in a GitHub secret.” The
keystore must be the key Google expects, the version code must be monotonic, the
workflow must restore and delete the secret safely, and the resulting AAB must
be tested as an update. These controls matter more than the build command itself.

#### Why the final credential boundary is a GitHub Environment

The final design is a protected GitHub `production` Environment, not a general
repository-secret bucket. Environment secrets are limited to jobs that name that
Environment and are made available only after its protection rules—especially
required-reviewer approval—have passed. Repository secrets are available to all
workflows in the repository and are read earlier in the workflow lifecycle. See
GitHub's [secrets reference](https://docs.github.com/en/actions/reference/security/secrets)
and [deployment-environment guidance](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).

### Credential-custody decision

The credential boundary for the church-owned project is GitHub Actions. No signing or
submission credential is stored with a build vendor, and neither workflow uses EAS CLI,
Expo authentication, or an EAS Cloud builder:

| Credential | Custodian | CI location |
| --- | --- | --- |
| Android upload keystore | Church / Google Play account | Protected `production` Environment secret |
| Google Play upload sign-in (service account, no key) | Church Google Cloud project / Google Play account | `store-upload` Environment: only the provider and service account names, no key |
| Apple distribution certificate (`.p12`) | Church Apple Developer account | Protected `production` Environment secret |
| Apple App Store provisioning profile | Church Apple Developer account | Protected `production` Environment secret |
| App Store Connect API key (`.p8`) | Church App Store Connect account | `store-upload` Environment secret |

The Android keystore above is the **upload key**, not Google's Play app-signing key.
With Play App Signing, Google protects the final signing key and the CI pipeline only
needs the upload key. The App Store Connect `.p8` key is for uploading builds to
TestFlight; it is separate from the Apple distribution certificate and provisioning
profile. Google Play needs no stored key: the upload job signs in without one (see
[Setting up the Google Play service account](#setting-up-the-google-play-service-account)).
The secret names for each credential are under
[GitHub-hosted signing and submission credentials](#github-hosted-signing-and-submission-credentials).

## Research basis

This plan is based on the following primary documentation and the constraints of
this repository:

- [Expo local builds](https://docs.expo.dev/build-reference/local-builds/):
  `eas build --local` runs the compiler on the invoking machine, but still
  authenticates with Expo and can retrieve EAS-managed credentials. This is why
  it avoids EAS Cloud build capacity but does not meet a zero-token requirement.
- [Expo local credentials](https://docs.expo.dev/app-signing/local-credentials/):
  local credentials can be restored from CI secrets and kept out of source
  control. Android direct-native builds go one step further and let Gradle read
  temporary environment-provided signing values without creating
  `credentials.json` at all.
- [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
  and [config plugins](https://docs.expo.dev/config-plugins/introduction/):
  generated native directories can be recreated, so the signing behavior is
  implemented in `plugins/withAndroidLocalSigning.js` rather than an ignored
  hand edit to `android/app/build.gradle`.
- [Expo app credentials](https://docs.expo.dev/app-signing/app-credentials/)
  and [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en):
  Google protects the Play app-signing key while the developer controls an
  upload key. The upload key must remain stable for updates, can be reset by
  Google after compromise, and does not have an annual expiration requirement.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
  and [standard runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners):
  standard GitHub-hosted runners are currently free for public repositories,
  including standard macOS runners. This supports using GitHub-hosted native
  compilation for this public open-source project, but is a current policy, not
  a guaranteed five-year promise; runner availability, concurrency, and fair-use
  limits still apply.
- [GitHub secret security](https://docs.github.com/en/actions/reference/security/secrets)
  and [secure use](https://docs.github.com/en/actions/reference/security/secure-use):
  secrets are encrypted and are not passed to fork pull requests, but workflow
  code that is allowed to read them can exfiltrate them. This justifies the
  protected Environment, reviewer approval, trusted-branch restrictions, fork
  guard, and reviewed third-party Actions in the workflow.
- [GitHub Actions general availability](https://github.blog/changelog/2019-11-11-github-actions-is-generally-available/):
  the public-repository free standard-runner policy has been part of the Actions
  product since its 2019 general availability. Its history supports treating
  the choice as established infrastructure, while the workflow's direct Gradle
  and Xcode commands keep the project portable if pricing or policy changes.
- [Expo SDK upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/):
  SDK upgrades remain incremental maintenance. CNG reduces native-file drift,
  but every Expo/React Native, Java, Android SDK/NDK, Xcode, or runner-image
  change still requires a validation build and physical-device checks.

The conclusion is deliberately narrower than “GitHub is safe forever”: GitHub
is currently the lowest-footprint place for this church to hold the Android
upload key, and the direct build is easy to move because it uses standard
Gradle commands. The operational controls and the direct-native design are what
make that choice defensible.

References: [local EAS builds](https://docs.expo.dev/build-reference/local-builds/),
[CI setup](https://docs.expo.dev/build/building-on-ci/),
[version management](https://docs.expo.dev/build-reference/app-versions/),
[store submission](https://docs.expo.dev/deploy/submit-to-app-stores/).
