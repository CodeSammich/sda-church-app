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
- [ ] Native iOS workflow — when iOS/native code changes; requires the protected Apple signing Environment and manual dispatch

Target Android and Xcode versions must remain current:

- [ ] Android target checked against the [latest stable Android SDK](https://developer.android.com/tools/releases/platforms)
- [ ] Xcode checked against the [latest supported Xcode release](https://developer.apple.com/support/xcode/)

## Security and release checklist

- [ ] No secrets, private keys, certificates, passwords, `.env` files, or generated native/signing artifacts are included
- [ ] Workflow changes do not print secrets, dump environments, or upload secret-bearing files
- [ ] Android `versionCode` is unchanged for ordinary PRs; only a maintainer bumps it immediately before a Google Play upload
- [ ] If this is a release PR, the user-facing version files remain synchronized by the release validation workflow
