# Web and native builds

Website deployment remains automatic on pushes to `main`, or through `npm run deploy`.
Native builds are opt-in and do not publish to either store. The same Expo source
is used for all platforms.

## One-time account setup

1. Install dependencies with `npm ci`. Use Node 22 for parity with native CI.
2. Install the pinned EAS CLI globally if you want the shorter `eas` command:
   `npm install --global eas-cli@23.2.0`. Verify with `eas --version`.
3. Run `eas login`, then `eas init` and select/create
   the church-owned Expo project. Commit the resulting `extra.eas.projectId` and
   any owner configuration in `app.json`. Do not substitute a made-up project ID.
4. Confirm `org.nyccsda.app` is the intended identifier in both stores. Configure
   the organization's Apple Developer/App Store Connect and Google Play accounts.
5. Run the desired build command interactively once to configure signing. EAS can
   manage the Apple certificate/provisioning profile and Android keystore. Keep
   account access and credential recovery under church ownership.
6. For GitHub builds, save an Expo access token as the repository secret
   `EXPO_TOKEN`. Complete an interactive build for each target before using CI.

The global CLI is optional; the repository scripts and workflow remain pinned to
`eas-cli@23.2.0` for repeatable builds.

## GitHub Actions token

Create a token from the Expo dashboard at **Account settings → Access tokens**.
Copy it immediately; it is a secret and should not be committed or pasted into
workflow files. In GitHub, open the repository’s **Settings → Secrets and
variables → Actions → New repository secret**, enter `EXPO_TOKEN` as the name,
paste the token as the value, and save it. The workflow checks for this secret
before starting a build. A token from an account with access to the church-owned
Expo project is required.

For a local shell, set the token only for the current terminal session:

```sh
export EXPO_TOKEN='paste-token-here'
eas build --platform android --profile preview --local
```

Unset it when finished with `unset EXPO_TOKEN`. Never put the token in `.env`,
`app.json`, `eas.json`, or source control. If a token is exposed, revoke it in
the Expo dashboard and create a replacement.

## Optional GitHub-hosted signing credentials

You can keep signing material in GitHub instead of storing it on EAS. This is
supported, but it adds credential rotation and recovery work. EAS calls this
the `local` credentials source. Create a `credentials.json` file at build time
and set `credentialsSource: "local"` on a separate build profile. Do not commit
that file or the credential files themselves.

The file contains paths and secrets similar to:

```json
{
  "android": {
    "keystore": {
      "keystorePath": "android-release.keystore",
      "keystorePassword": "ANDROID_KEYSTORE_PASSWORD",
      "keyAlias": "ANDROID_KEY_ALIAS",
      "keyPassword": "ANDROID_KEY_PASSWORD"
    }
  },
  "ios": {
    "distributionCertificate": {
      "path": "ios-distribution.p12",
      "password": "IOS_CERTIFICATE_PASSWORD"
    },
    "provisioningProfile": {
      "path": "ios-profile.mobileprovision"
    }
  }
}
```

The GitHub workflow would store the keystore, `.p12`, and provisioning profile
as encrypted repository secrets (usually base64-encoded), recreate them in the
runner’s temporary directory, write `credentials.json` with values from secret
environment variables, run the build with the local-credentials profile, and
delete the files afterward. The secrets must never be echoed in logs. This
repository’s current workflow uses EAS-managed remote credentials; it does not
yet recreate or consume GitHub-hosted signing files.

Keeping credentials on GitHub can avoid EAS-hosted signing storage and EAS cloud
builds, but it does not eliminate Expo project authentication for the current
`eas build --local` path. A completely independent build would use generated
native projects, Gradle/Xcode, and GitHub secrets directly, with more native
configuration to maintain. Protect the Android keystore permanently, and plan
for Apple certificates and provisioning profiles to expire and be renewed.

## Build commands

### Confirmed local APK build

The Android preview profile has been successfully compiled locally and produced
an APK with:

```sh
eas build --platform android --profile preview --local
```

The command may also be given an explicit destination, for example
`--output /absolute/path/app.apk`. This confirms the local Android toolchain and
EAS project setup are sufficient to produce an installable preview APK. Some
remaining build-time errors are tracked separately and do not prevent this APK
workflow from completing.

| Target | EAS cloud | Compile on your computer |
| --- | --- | --- |
| iOS IPA (TestFlight/App Store) | `npm run build:ios:eas` | `npm run build:ios` |
| Android AAB (Google Play) | `npm run build:android:eas` | `npm run build:android` |
| Android APK (direct installation) | `npm run build:android:apk` | `npm run build:android:apk` |

Cloud commands print the build/download link. Local commands output a binary on
this computer; optionally append `--output /absolute/path/app.ipa` (or `.aab` /
`.apk`). The preview APK is standalone and does not require Metro. Use the
production iOS profile for TestFlight; internal iOS distribution is not TestFlight.

Local iOS builds require macOS, Xcode with command-line tools, CocoaPods and
fastlane. Local Android builds require macOS or Linux, Java 17, Android SDK/NDK
and accepted SDK licenses; install Android Studio and the SDK tooling required by
Expo SDK 55. Configure `ANDROID_HOME` and the Android command-line tools on PATH.
Windows local EAS builds are not officially supported; WSL is an untested option.
Local EAS compilation still requires Expo authentication/network access for project
verification, remote version numbers, managed credentials, and dependencies. It
is not an offline build path. Build one platform at a time with `--local`.

In GitHub Actions, select **Native binaries → Run workflow**, choose the source
branch/tag, and check any combination of iOS, Android AAB, and Android APK. The
workflow becomes available in the Actions UI after it reaches the default branch.
Choose `github` (the default) to compile with EAS local builds on GitHub runners:
Android uses Ubuntu 24.04 / Java 17 and iOS uses macOS 15 / Xcode 26.2.
Download the signed binaries from the run’s Artifacts section (14-day retention).
Choose `eas` to compile on Expo cloud builders instead; the workflow waits for
completion and prints EAS artifact links. GitHub compilation uses GitHub runner
minutes/storage; it does not use EAS cloud build capacity. Expo authentication
and previously configured signing credentials are still required.
No selection performs no builds. Native failures do not block website deployment.

## Upload separately

For a downloaded or locally compiled store binary:

```sh
npm run submit:ios -- --path /absolute/path/app.ipa
npm run submit:android -- --path /absolute/path/app.aab
```

These are interactive uploads, not automatic public releases. Configure submission
credentials when prompted. Make the first Google Play upload manually in Play
Console before using its submission API. Apple builds are processed in App Store
Connect for TestFlight; choose testers and complete required beta review there.
Complete store listings and production review/release separately in each console.
An APK is for direct Android testing; upload an AAB for this app's Play listing.

## Versions and maintenance

`package.json` / `app.json` retain the existing shared release version managed by
`npm run sync-version`. EAS remotely manages and auto-increments production iOS
build numbers and Android version codes, including builds started locally, so
rebuilding the same release creates a fresh store build number. If the identifiers
already have published builds, initialize EAS counters above the existing store
values with `npx eas-cli@23.2.0 build:version:set` before the first build.

The CLI is pinned in package scripts, `eas.json`, and the workflow; update these
together. Keep generated `ios/` and `android/` projects out of Git and express
native configuration through Expo config/plugins. SDK upgrades require checking
Node/Java/Xcode/Android tooling and revalidating physical-device behavior. The old
custom Android Gradle override is no longer enabled; SDK defaults govern Kotlin,
minimum SDK, compile SDK and target SDK.

Before release, run `npx expo install --check`, `npx expo-doctor`, and `npm run check`.
Then build and test signed binaries on physical iPhone and Android devices,
including the background-audio acceptance checks in
[native-store-investigation.md](native-store-investigation.md). Successful JavaScript
exports alone do not prove native compilation, signing, playback or store acceptance.
OTA updates are not configured by this setup; website deployments do not update
installed native apps.

Local builds are manageable for a maintainer comfortable installing SDK tools.
Cloud builds avoid most host-tool maintenance and are the easier fallback,
especially without a Mac. GitHub’s macOS runner also lets you build iOS without
owning a Mac; update the runner/Xcode selection when GitHub retires that version. Both paths still need signing/account maintenance and
periodic store-required SDK updates.

References: [local EAS builds](https://docs.expo.dev/build-reference/local-builds/),
[CI setup](https://docs.expo.dev/build/building-on-ci/),
[version management](https://docs.expo.dev/build-reference/app-versions/),
[store submission](https://docs.expo.dev/deploy/submit-to-app-stores/).
