# Native store publishing investigation — issue #139

Investigated September 5, 2026; updated September 13, 2026. Recommendation:
retain Expo as the source framework, use direct native iOS and Android compilation,
and validate native development and preview builds before committing to store
distribution. Keep the web/PWA target available for browser regression testing and
stakeholder previews; it is not the primary distribution path.
This document records research and source inspection; no native build, device
test, account enrollment, or store submission was performed.

Owner update: audio playback and chapter transitions now work, potentially due
to stronger retries. iOS publishing will use an Apple Developer account associated
with a business/organization. Use TestFlight as the planned iOS tester distribution
path. Confirm the working playback behavior in that standalone native build; the
reported result does not specify which runtime/device was tested.

## Repository findings

This is already an Expo/React Native application, not a browser-only React app:

- `package.json` uses an Expo 58 canary, React Native 0.87, Expo Router, and expo-audio.
- `app.json` already identifies both native apps as `org.nyccsda.app` and enables
  expo-audio background playback, with recording permissions disabled.
- `services/BibleAudioService.ts` configures background playback and publishes
  lock-screen controls and metadata.
- `services/BibleAudioPlayer.ts` uses native expo-audio, while the `.web.ts`
  implementation provides the browser player and rolling queue.
- Native directories remain generated/ignored. Android direct builds use the
  committed local-signing config plugin and Gradle; iOS distribution uses the
  direct-native GitHub workflow with Xcode. OTA delivery is not configured.

An implementation detail to monitor is queue ownership: the native adapter only casts the player
to a type with optional queue methods; that does not implement a native queue.
The Bible screen advances chapters through a React effect on `didJustFinish`
and implements timed sleep with JavaScript `setTimeout`. These are specific
risks to verify under suspension, not evidence of a demonstrated native failure.
The canary dependency versions and generated native project should be checked
before attempting a native build.

## Expo versus Capacitor

| Consideration | Retain Expo | Add Capacitor |
| --- | --- | --- |
| Existing code | Uses the existing React Native application | Packages its web export in a WebView |
| Native UI | Existing React Native components | Web UI inside a native shell |
| Background audio | Existing expo-audio integration to validate | Requires a verified native audio plugin and a new adapter |
| Native projects | Can generate projects from Expo configuration | Generate and maintain iOS/Android projects and synchronize web assets |
| Native update strategy | No OTA provider is configured; native changes require a new binary | Select and validate a separate updater, such as Capgo |
| Main project cost | Native readiness, testing, signing, and release setup | Those tasks plus another runtime and plugin integration |

Capacitor supports native plugins: WebView rendering does not prevent native
background audio. But wrapping web audio alone does not solve suspension.
Its normal workflow builds web assets, synchronizes them into native projects,
and builds those projects. For this repository, Expo is the smaller architectural
change. Both can share one repository with platform-specific adapters.
[Capacitor workflow](https://capacitorjs.com/docs/basics/workflow).

Expo's expo-audio documentation covers the background mode on iOS and a media-playback
foreground service on Android. Android sustained playback also requires active
lock-screen controls. The repository already contains these configuration and
runtime calls; real-device verification is still required.
[expo-audio documentation](https://docs.expo.dev/versions/latest/sdk/audio/).

## Can development builds be tested easily?

Yes, after initial native tooling/signing setup. Use a custom development build
for native dependencies and configuration; Expo Go is not the acceptance target.
Development builds use Metro for rapid JavaScript iteration; rebuild when native
dependencies or configuration change. Also make a standalone preview build to
test without Metro or a development computer.
[Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

| Target | Practical testing path | Constraint |
| --- | --- | --- |
| Android emulator/device | Local `npx expo run:android` or the direct preview APK | Local builds need Android SDK/JDK; direct APK testing needs no Play listing |
| iOS simulator | Local `npx expo run:ios` | Running the simulator requires macOS/Xcode; no physical lock-screen proof |
| iPhone developer device | Local Xcode signing or the direct iOS workflow | Physical-device signing requires Apple Developer setup |
| Nondeveloper testers | Android preview APK; iOS TestFlight | TestFlight requires App Store Connect setup; external testing can require beta review |

Android APKs can be installed directly; AABs are for store distribution. Adding
iPhones to an ad hoc provisioning profile requires rebuilding or re-signing.
[Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).
Apple also supports limited personal on-device testing with a free Apple Account
through Xcode; that is not TestFlight or general distribution.
[Apple membership comparison](https://developer.apple.com/support/compare-memberships/).

Current direct-native setup:

1. Run `npx expo install --check` and `npx expo-doctor`; resolve native compatibility
   findings, including the custom Android signing plugin.
2. Use `npm run build:android:apk` for a directly installable Android preview and
   `npm run build:android` for the Play AAB.
3. Use the **iOS Build IPA** GitHub workflow for a signed IPA, or local Xcode
   commands for simulator/device development.
4. Test standalone binaries independently of Metro, then verify background audio,
   offline behavior, and update behavior on physical devices.

These direct workflows do not require an Expo account, an Expo token, or a cloud build
service. They still use Expo's source framework and prebuild tooling; Gradle and Xcode
perform the actual native compilation. Store submission remains a separate manual step.

## OTA boundaries and issue corrections

Native OTA updates are intentionally not configured. Website/PWA deployments do not
update installed native apps, and native modules, permissions, entitlements, and SDK
changes require a new binary. If native OTA is reconsidered later, choose and review a
provider separately, with preview/production channels and a runtime compatibility policy.
Any future native update system must take effect on a subsequent launch rather than
interrupting active audio, and must be tested for offline launch, failed downloads,
incompatible runtimes, and recovery to a known-good update.

The issue's “one-time App Store review” premise is incorrect. Apple's guideline
2.4.5 concerns Mac App Store apps; 2.5.2 is relevant to downloaded code and feature
changes. OTA is not permission to bypass review. Guideline 4.2 evaluates actual
app functionality; reviewer notes about audio do not guarantee approval, and no
single toolbar back button guarantees acceptance.
[Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/).
Google also restricts self-updating executable code; its interpreted-code treatment
does not exempt delivered JavaScript from Play policies.
[Google device and network abuse policy](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en).

## Publishing sequence

1. Establish church-owned organization accounts and custody of signing credentials.
   Apple membership is USD 99/year unless a waiver is approved. Issue #168 should
   handle eligible nonprofit enrollment and the waiver; continued eligibility
   requires annual confirmation. This can proceed alongside development testing.
   [Apple fee waiver](https://developer.apple.com/help/account/membership/fee-waivers/).
2. Register Google Play Console (USD 25 one-time registration fee), complete
   verification, and confirm the appropriate organization account requirements.
   New personal accounts have an additional closed-testing gate: at least 12
   continuously opted-in testers for 14 days before applying for production access.
   [Play registration](https://support.google.com/googleplay/android-developer/answer/6112435?hl=en),
   [personal-account testing](https://support.google.com/googleplay/android-developer/answer/14151465?hl=en-GB).
3. Confirm identifiers, icons, launch screens, native navigation, deep links,
   accessibility, content rights, privacy disclosures, support URLs, screenshots,
   age ratings, and current store SDK requirements. Verify the generated native
   permissions, rather than relying only on configuration intent.
4. Build Android directly with Gradle and the protected GitHub upload key; build
   iOS with the protected direct-native Xcode workflow.
   Upload Android to an internal track and iOS to TestFlight. Finish metadata
   and release review in the consoles. Establish the first Android upload
   manually where required before automating subsequent submissions. Fastlane is
   optional.
   [Store submission](https://docs.expo.dev/deploy/submit-to-app-stores/).
5. Promote only after device acceptance. Keep the web/PWA preview available for
   browser regression checks and stakeholder demos; do not treat it as a substitute
   for native release validation.

## Acceptance gate before a launch decision

- Test standalone builds on physical iPhone and Android hardware for at least
  15 minutes locked and minimized, with multiple automatic chapter boundaries.
- Verify title, artist, artwork, play/pause, seek, and metadata changes at transitions.
- Check sleep timers, end-of-chapter stop, navigation away from the reader, and
  returning to the correct playing chapter.
- Test silent mode, battery saver, interruptions, Bluetooth/headphone disconnection,
  and temporary network loss. Record OS/device/build versions and observed results.
- Deliver a preview OTA string/style fix to an installed compatible build; verify
  safe next-launch activation, offline startup, and recovery. Confirm an incompatible
  runtime receives no update. Do not interrupt active playback to apply it.
- If native chapter transitions fail, evaluate native-owned queue/timer support
  behind the existing adapter before considering a framework migration.

Decision: retain Expo and proceed with a TestFlight build using the owner's
business/organization Apple Developer account. Store launch remains contingent
on device evidence, account readiness, and the ongoing release-maintenance cost.
