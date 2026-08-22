<!--
PR title: Release/x.y.z: Brief description

If the destination branch is named release/x.y.z, replace x.y.z with that exact
version. Otherwise, replace x.y.z with the intended release version. Release CI
uses the title as the source of truth and synchronizes all version files.
-->

## Description

_What does your change do?_

## Related issues

_List each related issue with a closing keyword, for example `Closes #XX`. For contributor
pull requests targeting a release branch, a code maintainer will repeat these references
in the eventual release pull request to the default branch so GitHub closes the issues
when that release is merged._

## Testing

- [ ] Verified on Android SDK 36 (Target version must always be latest Android SDK) Target
      version should always be
      [latest stable Android SDK](https://developer.android.com/tools/releases/platforms)

- [ ] Verified on XCode/iOS 26.3 or higher

Target version should always be
[latest stable XCode](https://developer.apple.com/support/xcode/)
