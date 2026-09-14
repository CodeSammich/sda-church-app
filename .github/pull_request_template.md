<!--
Required PR title format: Release/<major.minor.patch>: Describe the changes
Example: Release/1.2.3: Improve Sabbath School navigation

Release CI rejects titles that do not begin with `Release/<major.minor.patch>`.
If the destination branch is named release/x.y.z, the title must use that exact
version. Otherwise, use the intended release version. Release CI uses the title
as the source of truth and synchronizes all version files.
-->

## Description

_What does your change do?_

## Related issues

_List each related issue with a closing keyword, for example `Closes #XX`. For contributor
pull requests targeting a release branch, a code maintainer will repeat these references
in the eventual release pull request to the default branch so GitHub closes the issues
when that release is merged._

## Testing

- [ ] `npm test` — include the suite/test count or explain any failure
- [ ] `npm run build:web` — when web/PWA or shared app code changes
- [ ] `npm run deploy` — confirms a local build only; use `npm run deploy:dev -- --repo <fork> --site-url <fork-pages-url>` only for an intentional fork preview
- [ ] `npm run build:android:apk:debug` — when Android/native code changes; this is the local installable APK path and does not use production signing secrets
- [ ] Signed Android AAB/APK — maintainer-only protected GitHub workflow; never commit or upload the JKS
- [ ] Native iOS build workflow — when iOS/native code changes; requires the protected Apple signing Environment and runs only on trusted `main`/`release/**` pushes or manual dispatch

Target toolchains must satisfy the current store requirements and remain compatible
with the pinned Expo/React Native toolchain. The versions below are a human-maintained
checklist snapshot, not an automated version source:

- [ ] Android is tested/buildable with Android API 36; verify the available platform against the [official Android platform releases](https://developer.android.com/tools/releases/platforms) and verify the [current Google Play target API requirement](https://developer.android.com/google/play/requirements/target-sdk). Confirm compile SDK, build tools, AGP, Gradle, JDK, and NDK compatibility.
- [ ] iOS is tested/buildable with Xcode 26.3 / iOS 26.3 SDK; verify the supported pairing against Apple's [Xcode system requirements](https://developer.apple.com/xcode/system-requirements/) and the [current App Store Connect submission requirements](https://developer.apple.com/app-store/submitting/). Confirm compatibility with Expo/React Native/CocoaPods.
- [ ] A maintainer manually reviews and updates the Android API and Xcode/iOS SDK snapshots above when Google or Apple changes its requirements; do not automate this checklist update.
- [ ] Any intentional version lag is documented

## Security and release checklist

- [ ] No secrets, private keys, certificates, passwords, `.env` files, or generated native/signing artifacts are included
- [ ] Workflow changes do not print secrets, dump environments, or upload secret-bearing files
- [ ] Android `versionCode` is unchanged for ordinary PRs; only a maintainer bumps it immediately before a Google Play upload
- [ ] If this is a release PR, the user-facing version files remain synchronized by the release validation workflow
