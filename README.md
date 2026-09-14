# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features.

## Table of Contents

### Project overview

- [Project Tenets](#project-tenets)

### Legal, licensing, and privacy

- [Legal, Licensing & Privacy](docs/LEGAL.md)

User-facing legal text is centralized in the app under **You → Legal Disclaimer**.
Library reading-source notices are also collected there: Ellen G. White editions
are hosted externally on EGW Writings; Adventist pioneer and Christian classic
works are public domain in the U.S. and hosted externally on Project Gutenberg.
The repository's licensing decisions and third-party source review live in
[docs/LEGAL.md](docs/LEGAL.md).

### Project documentation

- [Technical Setup & Testing](docs/README.md)
  - [Web and Native Build Workflows](docs/operations/native-builds.md)
- [Bulletin API Architecture & Operations](apps-script/README.md)
- [Accessibility Guidelines](docs/accessibility/README.md)
- [UI/UX Design](docs/UI_UX.md)
- [Feature Designs](docs/feature_designs/)
  - [Bulletin Hymn Resolution & Extension Guide](docs/feature_designs/bulletin_hymn_resolution.md)
  - [Offline Bulletin Translation: Bergamot Feasibility](docs/feature_designs/offline_bulletin_translation.md)
- [Contributing Code](docs/CONTRIBUTING.md)

### Expo 58 canary rollback checklist

This branch intentionally uses an Expo 58 canary while `doNotMixPersistent` is tested
for audio issue #205. When Expo 58 becomes an official release, use this checklist
before merging the canary branch into a release branch:

1. Replace every `58.0.0-canary-*` dependency in `package.json` and
   `package-lock.json` with the official Expo 58 versions. Use `npx expo install --fix`
   and confirm the Expo Doctor-required React Native, Reanimated, and Screens versions.
2. Remove the explicit `expo-template-bare-minimum@...` prebuild command from the
   `build:android` and `build:android:apk` scripts. The official `sdk-58` template tag
   should allow the normal Expo prebuild flow again.
3. Re-evaluate `.npmrc`. Its `legacy-peer-deps=true` setting exists only because npm's
   peer resolver is unreliable with this canary dependency graph; remove it if a plain
   `npm install` succeeds on the official release.
4. Review `app.json` carefully. It currently has no canary-only `autolinking` block and
   no custom Android Gradle override. Do not restore either one unless Expo's official
   SDK 58 build specifically requires it. Keep the `expo-audio` plugin and
   `doNotMixPersistent` application code in `services/BibleAudioService.ts`. Keep
   `android.predictiveBackGestureEnabled` enabled for Android edge-back behavior.
5. Expo Router 58 redirects a focused `href: null` tab to the first visible tab.
   The hidden Home stack and Sabbath School route therefore use a null
   `tabBarButton` plus `display: 'none'` in `app/(tabs)/_layout.tsx`; preserve this
   until the tab architecture is deliberately migrated.
6. `services/animationFramePolyfill.ts` works around the canary static-renderer
   crash where Expo Router calls `requestAnimationFrame` in Node. Re-test and remove
   it if the official Expo 58 web export no longer needs it.
7. Run `npm install`, `npx expo-doctor`, `npm run typecheck`, `npm test`, and an Android
   APK build before removing the canary branch safeguards.

## Project Tenets

_Guiding our design philosophy in decreasing order of priority._

### 1. Sustainable

The app must be cost-effective, preferably free to maintain, and support both iOS and
Android. Native iOS and Android are the primary distribution targets; the **Progressive
Web App (PWA)** remains a low-cost testing, preview, demo, and fallback surface. The web
path should stay useful without becoming the canonical release channel.

> _"For which of you, wanting to build a tower, does not first sit down and calculate the
> cost to see if he has enough to complete it?"_ — **Luke 14:28**

### 2. Liability-Free

We proactively reduce privacy and legal risk through purpose limitation, data
minimization, restricted administrative access, and conservative public disclosure, even
when the tradeoff results in fewer features. Privacy frameworks such as the CCPA and GDPR
inform these design goals; mentioning them is not a certification or claim that this
project, every deployment, or every organization using a fork automatically complies with
those laws. Deploying organizations remain responsible for reviewing their own legal and
operational obligations.

> _"Behold, I am sending you out like sheep among wolves. Therefore be as shrewd as snakes
> and as innocent as doves."_ — **Matthew 10:16**

### 3. Sanctuary

We minimize the collection and public exposure of personal information, treating the
digital experience as a secure refuge. The public app and its web/PWA preview do not
require an account for ordinary use. Restricted church administrative systems may contain
personal information that is necessary for church operations, such as worship assignments,
but public features must disclose only what is needed for their stated purpose. A church
is a "third space" and a final refuge; our technology must be a shade from the heat, not a
source of surveillance.

> _"For You have been a refuge for the poor, a stronghold for the needy in distress, a
> refuge from the storm, a shade from the heat."_ — **Isaiah 25:4**

### 4. Community

Every feature must serve the goal of promoting **in-person fellowship**. Digital
tools—such as event sign-ups or notifications—are high-value only if they make it easier
for a member to show up to a physical gathering. We facilitate connection without
requiring public-app accounts or exposing more personal information than the feature
needs.

> _"And let us consider how to spur one another on to love and good deeds. Let us not
> neglect meeting together, as some have made a habit, but let us encourage one
> another..."_ — **Hebrews 10:24-25**

### 5. Simplicity

We use simple design philosophies to ensure elderly and non-technical stakeholders can
navigate with ease. If a feature is too complex for a casual user to understand in
seconds, it must be simplified or removed.

> _"...You have hidden these things from the wise and learned, and revealed them to little
> children."_ — **Matthew 11:25**

### 6. Devotional

Centralization lowers barriers for daily devotion. By unifying the Bible, hymnal, and
community updates into one frictionless interface, we support the spiritual growth of
seekers and long-time members alike.

> _"But his delight is in the law of the LORD, and on His law he meditates day and
> night."_ — **Psalm 1:2**

### 7. Focused

The app is a **Digital Home** that protects users from "doomscrolling" and external
algorithms. While we leverage infrastructure like YouTube or Spotify, the user experience
remains internal to maintain spiritual focus.

> _"Finally, brothers, whatever is true, whatever is honorable, whatever is right,
> whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or
> praiseworthy—think on these things."_ — **Philippians 4:8**

## Build workflows

The repository uses one Expo source for the native apps and the web/PWA preview. Web
preview deployment stays automatic: a push to `main` runs the existing GitHub Pages
workflow. Locally, `npm run deploy` builds the web output into `dist/` without publishing
it. Web preview publishing is restricted to the canonical GitHub workflow.

Android binaries do not run for pull requests. A trusted push to `main` or
`release/**` runs the Android targets; you can also open **Native Android build**
and choose **Run workflow** for an Android AAB or APK. Android compiles directly with
Expo prebuild and Gradle on GitHub's Linux runner; the Android upload keystore is
restored only from protected GitHub Environment secrets. The iOS workflow additionally
runs for an upstream `release/**` to `main` pull request after protected Environment
approval, so the release PR can validate its signed IPA.

The separate **Native iOS build** workflow runs on trusted pushes to `main` and
`release/**`, upstream `release/**` to `main` pull requests, and manual dispatch. It runs Expo prebuild and Xcode on a
macOS runner, restores Apple signing material from protected GitHub Environment
secrets, and produces an IPA artifact for App Store Connect or TestFlight. It does not
use EAS or an Expo token. Native builds never publish to a store automatically, so
review and submission remain separate steps.

For this church-owned release pipeline, the intended credential boundary is GitHub:
Android upload signing, Apple distribution signing, Google Play submission, and App
Store Connect submission credentials will be stored as protected GitHub Environment
secrets and recreated only during the approved workflow. We will not upload those
keys to a build vendor. This requires explicit workflow setup, careful secret access controls,
and ongoing Apple certificate/profile renewal. The [native build guide](docs/operations/native-builds.md)
documents the design, setup commands, research, and recovery procedures.

The same targets are available locally:

```sh
npm run build:android:apk             # direct native APK; needs ANDROID_* variables
npm run build:android                  # direct native AAB; needs ANDROID_* variables
npm run build:android:apk:debug       # standalone local APK; uses Gradle's debug key
```

The iOS store build is provided by the protected **Native iOS build** GitHub Actions
workflow on trusted `main`/`release/**` pushes, upstream `release/**` to `main` pull
requests, or manual dispatch because iOS signing requires a macOS/Xcode environment. The repository has no EAS build or submission
commands.
Android direct builds require an explicit `expo.android.versionCode` in `app.json`;
the script intentionally stops until that number is confirmed against Play Console.
This is a separate Play release counter, not the user-facing `0.37.0` version. Only a
code maintainer changes it, as part of final release preparation immediately before a
Play upload. It stays unchanged across ordinary feature PRs and local/test builds, and
must increase above the last version accepted by Play for every uploaded AAB.
The iOS build counter is likewise checked in as `expo.ios.buildNumber` in `app.json`;
both automatic trusted-branch archives and manual iOS runs use that same value. A
maintainer must increase it before uploading a later IPA to App Store Connect. Do not
enter an independent build number in the Actions UI.
The debug APK command is the safe local-testing path: it is signed with Gradle's
automatically generated debug key, does not require or touch the production upload JKS,
and must never be uploaded to Google Play. A truly unsigned APK is generally not
installable. The local Android scripts use the normal Gradle, CMake, and Ninja defaults.
For a memory-constrained WSL session, override them for a one-off build:

```sh
GRADLE_OPTS="-Dorg.gradle.workers.max=4 -Dorg.gradle.parallel=true -Dorg.gradle.jvmargs=-Xmx5g" npm run build:android:apk
```

For GitHub Actions, add the Android upload-key secrets to the protected `production`
Environment before running an Android target: `ANDROID_KEYSTORE_BASE64`,
`ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and `ANDROID_KEY_PASSWORD`.
The **Native Android build** workflow decodes the keystore only in the temporary runner,
then removes it. Before running **Native iOS build**, add
`IOS_DISTRIBUTION_CERTIFICATE_BASE64`, `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`,
`IOS_PROVISIONING_PROFILE_BASE64`, and `IOS_TEAM_ID` to that same protected
Environment. The iOS workflow creates a temporary keychain and removes all signing
material in cleanup. Keep all credentials out of source control. The complete setup
and the native-build checklist are in [the native build guide](docs/operations/native-builds.md#github-hosted-direct-ios-builds).

### Secret-handling rule

Treat the comments in `.github/workflows/native-android-build.yml` as a security contract:
never add `set -x`, environment dumps, secret-byte logging, or artifacts containing
the keystore, passwords, certificates, or tokens. The existing base64 decode is
allowed only because its output is redirected directly to the temporary keystore;
do not change it to write to the terminal. Secrets must remain limited to the
explicitly reviewed build steps, must not be passed to pull requests from forks,
and must be deleted from the runner in cleanup. Any automated or human workflow
change must preserve these rules.

Both recommended GitHub workflows follow the zero-token path: `npx expo prebuild`
followed by Gradle or Xcode. The native guide includes the comparison, security
rationale, rotation policy, and GitHub Actions estimate.

Local Android compilation needs Java 17 and the Android SDK/NDK. Direct local iOS
compilation needs macOS, Xcode, and CocoaPods. See the
[Web and Native Build Workflows](docs/operations/native-builds.md) guide for account
setup, signing, runner details, artifact handling, and store submission commands.
