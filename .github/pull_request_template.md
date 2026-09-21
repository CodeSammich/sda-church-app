<!--
Required PR title format: Release/<major.minor>.<patch-or-x>: Describe the changes
Examples: Release/1.2.3: Improve Sabbath School navigation
          Release/1.2.x: Prepare the 1.2 release line

Release CI accepts either a concrete patch or the `x` patch wildcard. If the title
uses `Release/x.y.x`, CI takes the concrete patch from the checked-in `package.json`.
The title and any applicable `release/x.y.(patch|x)` branch must use the same major
and minor release line; their patch values may differ. Release CI synchronizes all
version files to the concrete version it validates.
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
- [ ] `npm run build:web` — only when web/PWA behavior is intentionally changed; native-only changes do not require this check
- [ ] `npm run deploy` — confirms a local build only; use `npm run deploy:dev -- --repo <fork> --site-url <fork-pages-url>` only for an intentional fork preview
- [ ] `npm run build:android:apk:debug` — when Android/native code changes; this is the local installable APK path and does not use production signing secrets
- [ ] Signed Android AAB/APK — maintainer-only protected GitHub workflow; never commit or upload the JKS
- [ ] Native iOS build workflow — when iOS/native code changes; requires the protected Apple signing Environment and runs on trusted `main`/`release/**` pushes, upstream `release/**` → `main` pull requests, or manual dispatch

Target toolchains must satisfy the current store requirements and remain compatible
with the pinned Expo/React Native toolchain. The versions below are a human-maintained
checklist snapshot, not an automated version source:

- [ ] Android is tested/buildable with target API 36 and the current required compile SDK (this app currently needs compile API 37 for its Expo 58 preview); verify the available platform against the [official Android platform releases](https://developer.android.com/tools/releases/platforms) and verify the [current Google Play target API requirement](https://developer.android.com/google/play/requirements/target-sdk). Confirm compile SDK, build tools, AGP, Gradle, JDK, and NDK compatibility.
- [ ] iOS is tested/buildable with Xcode 26.3 / iOS 26.3 SDK; verify the supported pairing against Apple's [Xcode system requirements](https://developer.apple.com/xcode/system-requirements/) and the [current App Store Connect submission requirements](https://developer.apple.com/app-store/submitting/). Confirm compatibility with Expo/React Native/CocoaPods.
- [ ] A maintainer manually reviews and updates the Android API and Xcode/iOS SDK snapshots above when Google or Apple changes its requirements; do not automate this checklist update.
- [ ] Any intentional version lag is documented

## Security and release checklist

- [ ] No secrets, private keys, certificates, passwords, `.env` files, or generated native/signing artifacts are included
- [ ] Workflow changes do not print secrets, dump environments, or upload secret-bearing files
- [ ] Android `versionCode` is unchanged for ordinary PRs; only a maintainer bumps it immediately before a Google Play upload
- [ ] If this is a release PR, the user-facing version files remain synchronized by the release validation workflow
