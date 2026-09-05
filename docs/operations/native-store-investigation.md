# Native store publishing investigation — issue #139

Investigated September 5, 2026. Recommendation: retain Expo and validate native
development and preview builds before committing to store distribution.
This document records research and source inspection; no native build, device
test, account enrollment, or store submission was performed.

Owner update: audio playback and chapter transitions now work, potentially due
to stronger retries. iOS publishing will use an Apple Developer account associated
with a business/organization. Use TestFlight as the planned iOS tester distribution
path. Confirm the working playback behavior in that standalone native build; the
reported result does not specify which runtime/device was tested.

## Repository findings

This is already an Expo/React Native application, not a browser-only React app:

- `package.json` uses Expo SDK 55, React Native 0.83, Expo Router, and expo-audio.
- `app.json` already identifies both native apps as `org.nyccsda.app` and enables
  expo-audio background playback, with recording permissions disabled.
- `services/BibleAudioService.ts` configures background playback and publishes
  lock-screen controls and metadata.
- `services/BibleAudioPlayer.ts` uses native expo-audio, while the `.web.ts`
  implementation provides the browser player and rolling queue.
- No `eas.json`, expo-dev-client dependency, or expo-updates dependency was found.
  Native build distribution and OTA delivery still need configuration.

An implementation detail to monitor is queue ownership: the native adapter only casts the player
to a type with optional queue methods; that does not implement a native queue.
The Bible screen advances chapters through a React effect on `didJustFinish`
and implements timed sleep with JavaScript `setTimeout`. These are specific
risks to verify under suspension, not evidence of a demonstrated native failure.
The custom `withAndroidSDKOverride.js` and dependency versions also need checking
against SDK 55 before attempting a native build.

## Expo versus Capacitor

| Consideration | Retain Expo | Add Capacitor |
| --- | --- | --- |
| Existing code | Uses the existing React Native application | Packages its web export in a WebView |
| Native UI | Existing React Native components | Web UI inside a native shell |
| Background audio | Existing expo-audio integration to validate | Requires a verified native audio plugin and a new adapter |
| Native projects | Can generate projects from Expo configuration | Generate and maintain iOS/Android projects and synchronize web assets |
| OTA | Add expo-updates/EAS Update | Select and validate a separate updater, such as Capgo |
| Main project cost | Native readiness, testing, signing, and release setup | Those tasks plus another runtime and plugin integration |

Capacitor supports native plugins: WebView rendering does not prevent native
background audio. But wrapping web audio alone does not solve suspension.
Its normal workflow builds web assets, synchronizes them into native projects,
and builds those projects. For this repository, Expo is the smaller architectural
change. Both can share one repository with platform-specific adapters.
[Capacitor workflow](https://capacitorjs.com/docs/basics/workflow).

SDK 55 expo-audio documents the background mode on iOS and a media-playback
foreground service on Android. Android sustained playback also requires active
lock-screen controls. The repository already contains these configuration and
runtime calls; real-device verification is still required.
[SDK 55 audio documentation](https://docs.expo.dev/versions/v55.0.0/sdk/audio/).

## Can development builds be tested easily?

Yes, after initial native tooling/signing setup. Use a custom development build
for native dependencies and configuration; Expo Go is not the acceptance target.
Development builds use Metro for rapid JavaScript iteration; rebuild when native
dependencies or configuration change. Also make a standalone preview build to
test without Metro or a development computer.
[Expo development builds](https://docs.expo.dev/develop/development-builds/introduction/).

| Target | Practical testing path | Constraint |
| --- | --- | --- |
| Android emulator/device | Local `npx expo run:android`, or EAS development APK | Local builds need Android SDK/JDK; direct APK testing needs no Play listing |
| iOS simulator | Local `npx expo run:ios`, or EAS simulator build | Running the simulator requires macOS/Xcode; no physical lock-screen proof |
| iPhone developer device | Local Xcode signing, or EAS ad hoc development build | EAS ad hoc requires developer membership and registered device UDIDs |
| Nondeveloper testers | Android preview APK; iOS TestFlight | TestFlight requires App Store Connect setup; external testing can require beta review |

Android APKs can be installed directly; AABs are for store distribution. Adding
iPhones to an ad hoc provisioning profile requires rebuilding or re-signing.
[Expo internal distribution](https://docs.expo.dev/build/internal-distribution/).
Apple also supports limited personal on-device testing with a free Apple Account
through Xcode; that is not TestFlight or general distribution.
[Apple membership comparison](https://developer.apple.com/support/compare-memberships/).

Proposed setup, to execute in a separate implementation change:

1. Run `npx expo install --check` and `npx expo-doctor`; resolve native compatibility
   findings, including the custom Android build override.
2. Add `expo-dev-client` using `npx expo install expo-dev-client`.
3. Link the church-owned Expo project and run `eas build:configure`.
4. Configure `development` with `developmentClient: true` and internal distribution;
   configure standalone `preview` with internal distribution; configure store
   `production`. Add a separate iOS simulator profile when needed.
5. Build using `eas build --profile development --platform android` or `ios`;
   install, then run `npx expo start --dev-client`. Use a tunnel if local network
   reachability fails. Test preview builds independently of Metro.

EAS cloud builds/submission avoid needing a local Mac for iOS build/upload, but
do not replace physical iPhone testing. EAS usage may have separate costs; choose
a service plan after estimating build frequency and update traffic.
[Expo submission workflow](https://docs.expo.dev/deploy/submit-to-app-stores/).

## OTA boundaries and issue corrections

Add expo-updates and configure EAS Update only after the first native playback
spike passes. Use separate preview/production channels and a runtime compatibility
policy, preferably fingerprint-based. JavaScript and assets must match the
installed native runtime; native modules, permissions, entitlements, and SDK
changes require a new binary.
[Runtime versions](https://docs.expo.dev/eas-update/runtime-versions/).

An update normally downloads and takes effect on a subsequent launch. It is not
Fast Refresh for an already-running production app. Avoid restarting during audio
playback. Test offline launch, failed downloads, incompatible runtimes, and recovery
to a known-good update before enabling production OTA.
[Update lifecycle](https://docs.expo.dev/eas-update/how-it-works/),
[deployment guidance](https://docs.expo.dev/eas-update/deployment/).

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
4. Build signed production binaries with EAS Build. Upload Android to an internal
   track and iOS to TestFlight. EAS Submit supports uploads; finish metadata and
   release review in the consoles. Establish the first Android upload manually
   where required before automating subsequent submissions. Fastlane is optional.
   [Store submission](https://docs.expo.dev/deploy/submit-to-app-stores/).
5. Promote only after device acceptance. Keep PWA distribution available while
   native behavior is being validated.

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
