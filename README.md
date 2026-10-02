# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features. Native iOS and Android are the primary release targets; the web/PWA
build remains a useful preview and fallback surface.

## Quick start

You need Node.js 22 (22.13 or later) or 24 (24.3 or later), and npm. To build for a
phone, you also need the Android or iOS tools listed in
[Development setup and testing](docs/README.md#prerequisites).

```bash
npm install --force   # --force is needed while React Native is a release candidate
npm run web           # start the app in a browser
npm test              # run the Jest unit tests
npm run check         # typecheck, tests, text-size check, and web build
```

[Development setup and testing](docs/README.md) explains each command, how to run the
app on an Android emulator or the iOS Simulator, and which checks CI runs.

## Table of Contents

### Project overview

- [Project Tenets](docs/project-tenets.md)
- [Architecture and external dependencies](docs/architecture.md): service diagram,
  account ownership, and yearly upkeep

### Development

- [Development setup and testing](docs/README.md): install, run, and test the app
- [Contributing and release workflow](docs/CONTRIBUTING.md): branches, pull request
  rules, and the automated checks
- [UI/UX design](docs/UI_UX.md): the four-tab app structure
- [Accessibility guidelines](docs/accessibility/README.md)
- [Feature designs](docs/feature_designs/)
  - [Bible integration](docs/feature_designs/bible_integration_design.md)
  - [Bulletin hymn resolution and extension guide](docs/feature_designs/bulletin_hymn_resolution.md)
  - [Christian Library](docs/feature_designs/christian_library.md)
  - [English hymnal integration](docs/feature_designs/hymnal_integration_design.md)
  - [Offline bulletin translation: Bergamot feasibility](docs/feature_designs/offline_bulletin_translation.md)
  - [Children's Sabbath School lessons](docs/feature_designs/sabbath_school_lessons.md)
- [Android chapter continuation test record (#225)](docs/testing/bible-audio-225.md)
- [Bundled font sources and licenses](assets/fonts/README.md)
- [Bundled image assets](assets/images/README.md) and
  [external brand assets](assets/images/brand/README.md)

### Builds and operations

- [Native mobile binary builds](docs/operations/native-builds.md): signing, credentials,
  PR preview builds, key screens, and automatic store uploads
- [Version numbers](docs/operations/version-numbers.md): how the version sets the
  store build numbers
- [Admin runbook](docs/operations/admin-runbook.md): step-by-step manual workflows and
  admin web tasks
- [Bulletin automation operations](docs/operations/bulletin-automation.md)
  - [Bulletin Apps Script source](google-apps-script/README.md)
- [External dependency monitor](docs/operations/external-dependency-monitor.md): the
  daily check of every outside service the app uses
- [Adventist Connect media hosting](docs/operations/adventist-connect-media.md): Bible audio
  and image hosting, with a scaling analysis
- [Service limits and costs](docs/operations/service-limits-and-costs.md): cost, published
  limits, and load for every external service
- [Native store publishing investigation (#139)](docs/operations/native-store-investigation.md):
  the September 2026 decision to build native apps directly

### App stores

- [App Store and Google Play setup](docs/operations/app-store-setup.md): store accounts,
  signing files, and the yearly Apple renewals
- [Store listings](docs/operations/store-listing.md): the listing text in all four app
  languages
- [Store assets](docs/store-assets/README.md): copies of the screenshots and images
  uploaded to each store
- [App Store Connect answers](docs/operations/app-store-connect-answers.md) and
  [Google Play Console answers](docs/operations/play-console-answers.md): every store
  declaration and why it's right
- [Google Play and App Store policy audit](docs/operations/store-policy-audit.md): the
  release-readiness review of September 12, 2026

### Legal, licensing, and privacy

- [Legal, Licensing, and Privacy](docs/LEGAL.md)
- [Branding and trademark policy](docs/LEGAL_BRANDING.md)
- [Sabbath Encouragement attribution and copyright](docs/operations/sabbath-encouragement-copyright.md)

User-facing legal text is centralized in the app under **You → Legal Disclaimer**.
Library reading-source notices are also collected there: which books are hosted
externally (on EGW Writings, Project Gutenberg, the Internet Archive, or HathiTrust), which are
public domain in the U.S., and the church's own copy of Sabbath Encouragement. The
repository's licensing decisions and third-party source review live in
[docs/LEGAL.md](docs/LEGAL.md).

### Maintenance

- [Upkeep calendar](docs/architecture.md#upkeep-calendar): what to renew or check each
  year, and what breaks if it's missed
- [Google Cloud: free only](docs/architecture.md#google-cloud-free-only): the church's
  Google Cloud project, used only for automatic Google Play uploads, has no billing
  account. Never add a credit card to Google Cloud. Every IT administrator is an
  Owner of the project.
  [Setup steps](docs/operations/native-builds.md#setting-up-the-google-play-service-account).
- [App Store and Google Play setup](docs/operations/app-store-setup.md): store accounts,
  signing files, and the yearly Apple renewals (membership, fee waiver, certificate).
  GitHub opens a reminder issue two months before any Apple renewal is due, and a
  [yearly checkup](docs/operations/admin-runbook.md#yearly-checkup) issue each January
  for everything else that's checked once a year.
- [Store listings and declarations](docs/operations/admin-runbook.md#store-listings-and-declarations):
  where the listing text, screenshots, and every store answer are kept, and what to
  update with each release.
- [Credentials that need attention](docs/operations/admin-runbook.md#credentials-that-need-attention)

## Project status

On 2026-10-02, version 1.0.0 merged into `main` as the first public release, for
submission to the App Store and Google Play. Every merge into `main` starts the signed
Android and iOS builds, which wait for a maintainer's approval and then upload to
Google Play internal testing and TestFlight. Nothing reaches the public until a
maintainer submits it in each store.

The app uses one Expo source for the native apps and the web/PWA build. It has used the
stable Expo SDK 58 (`expo ~58.0.0`) since 0.42.0. React Native is still a release
candidate (`0.88.0-rc.3`); moving to a stable React Native release is tracked in
[issue #211](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/211),
which doesn't block the launch. See
[Native mobile binary builds](docs/operations/native-builds.md) for the trusted-branch
workflow, local commands, debug APK previews, signing boundaries, and release recovery
procedures.
