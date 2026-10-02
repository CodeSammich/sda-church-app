# Native store publishing investigation — issue #139

> **Status, October 2026.** This is a record of the September 2026 investigation, kept
> for its reasoning. Its main recommendation, to keep Expo and compile iOS and Android
> directly, is what the app does. Much of the rest has been overtaken:
>
> - **Uploads to testers are automatic.** The record says store submission is a
>   separate manual step. Now, after the signed builds are approved, **Upload to
>   TestFlight** (the `testflight_upload` job in `native-ios-build.yml`) and **Upload to
>   Google Play internal testing** (the `play_upload` job in `native-android-build.yml`,
>   using `scripts/upload-google-play.cjs`) send them to testers. Releasing to the
>   public is still a manual step in each console. See
>   [Automatic store uploads](native-builds.md#automatic-store-uploads).
> - **Native builds and store submissions have happened.** Signed builds start after
>   every merge into `main` and run once approved. The first submissions to both
>   stores, version 0.42.0, were set up on September 29, 2026; see
>   [App Store Connect answers](app-store-connect-answers.md)
>   and [Google Play Console answers](play-console-answers.md).
> - **Android has a native queue.** Android plays Bible chapters from an expo-audio
>   `AudioPlaylist` (`services/BibleAudioPlayer.android.ts` and
>   `services/BibleAudioNativeQueue.ts`), so the native player moves to the next chapter
>   itself; see [Android chapter continuation](../testing/bible-audio-225.md). iOS still
>   uses a single player that the Bible screen advances from its `didJustFinish`
>   effect, and the sleep timer still uses a JavaScript `setTimeout`.
> - **The Apple fee waiver (#168) is in place.** Apple waives the yearly fee for the
>   church as a nonprofit; [App Store and Google Play setup](app-store-setup.md#yearly-apple-renewals)
>   records this and the yearly reconfirmation, and `.github/apple-signing-expiry.json`
>   holds the membership renewal date that the Apple signing monitor watches.
> - **Expo SDK 58 is stable** (`expo ~58.0.0`). React Native 0.88 is still a release
>   candidate (#211).
> - **The acceptance gate's device checks moved to the admin runbook,** as
>   [Device checks before release](admin-runbook.md#device-checks-before-release). Its
>   OTA item was dropped: OTA updates are still intentionally not configured (the app
>   doesn't use `expo-updates`). On Android, the
>   [Android audio test](native-builds.md#android-audio-test-on-release-prs) now covers
>   failover, screen-off chapter changes, and connection loss on an emulator for every
>   release PR.
>
> Statements below that were true only at the time are marked as such.

Investigated September 5, 2026; updated September 13, 2026. Recommendation:
retain Expo as the source framework, use direct native iOS and Android compilation,
and validate native development and preview builds before committing to store
distribution. Keep the web/PWA target available for browser regression testing and
stakeholder previews; it is not the primary distribution path.
This document records research and source inspection; at the time, no native build,
device test, account enrollment, or store submission had been performed.

Owner update: audio playback and chapter transitions now work, potentially due
to stronger retries. iOS publishing will use an Apple Developer account associated
with a business/organization. Use TestFlight as the planned iOS tester distribution
path. Confirm the working playback behavior in that standalone native build; the
reported result does not specify which runtime/device was tested.

## Repository findings

This is already an Expo/React Native application, not a browser-only React app. At
the time of the investigation:

- `package.json` used the Expo 58 preview SDK, React Native 0.88 RC, Expo Router, and expo-audio.
- `app.json` already identifies both native apps as `org.nyccsda.app` and enables
  expo-audio background playback, with recording permissions disabled.
- `services/BibleAudioService.ts` configures background playback and publishes
  lock-screen controls and metadata.
- `services/BibleAudioPlayer.ts` used native expo-audio, while the `.web.ts`
  implementation provided the browser player and rolling queue. (Android has since
  moved to `BibleAudioPlayer.android.ts`; see the status note above.)
- Native directories remain generated/ignored. Android direct builds use the
  committed local-signing config plugin and Gradle; iOS distribution uses the
  direct-native GitHub workflow with Xcode. OTA delivery is not configured.

An implementation detail to monitor was queue ownership: at the time, the native adapter
only cast the player to a type with optional queue methods, which did not implement a
native queue. The Bible screen advanced chapters through a React effect on
`didJustFinish` and implemented timed sleep with JavaScript `setTimeout`. These were
specific risks to verify under suspension, not evidence of a demonstrated native
failure. The preview dependency versions and generated native project should be checked
before attempting a native build. (Android now has a native queue; iOS still advances
through the effect, and the timer is unchanged. See the status note above.)

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
runtime calls; at the time, real-device verification was still required.
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

The direct-native setup at the time of the investigation:

1. Run `npx expo install --check` and `npx expo-doctor`; resolve native compatibility
   findings, including the custom Android signing plugin.
2. Use `npm run build:android:apk` for a directly installable Android preview and
   `npm run build:android` for the Play AAB.
3. Use the **Native iOS build** GitHub workflow for a signed IPA, or local Xcode
   commands for simulator/device development.
4. Test standalone binaries independently of Metro, then verify background audio,
   offline behavior, and update behavior on physical devices.

These direct workflows do not require an Expo account, an Expo token, or a cloud build
service. They still use Expo's source framework and prebuild tooling; Gradle and Xcode
perform the actual native compilation. Store submission was then a separate manual
step; uploads to testers have since become automatic (see the status note above).

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
   (The waiver is now in place; see the status note above.)
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

The physical-phone checks this gate listed are kept current in the admin runbook's
[Device checks before release](admin-runbook.md#device-checks-before-release). If
native chapter transitions failed, the gate said to evaluate native-owned queue and
timer support behind the existing adapter before considering a framework migration.

Decision: retain Expo and proceed with a TestFlight build using the owner's
business/organization Apple Developer account. Store launch remains contingent
on device evidence, account readiness, and the ongoing release-maintenance cost.
