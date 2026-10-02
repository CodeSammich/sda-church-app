# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features. Native iOS and Android are the primary release targets; the web/PWA
build remains a useful preview and fallback surface.

## Quick start

You need Node.js 22 (22.13 or later) or 24 (24.3 or later), and npm.

```bash
npm install --force   # --force is needed while React Native is a release candidate
npm run web           # start the app in a browser
npm test              # run the Jest unit tests
npm run check         # typecheck, tests, text-size check, and web build
```

To run the app on a phone, an Android emulator, or the iOS Simulator, first install the
tools listed in [Development setup and testing](docs/README.md#prerequisites).

## Table of Contents

The docs are listed in the order a newcomer needs them, and each topic is explained in
one place. Church admins can start at [Operate](#operate).

### Overview

- [Project tenets](docs/project-tenets.md): the seven principles, in priority order,
  behind every design decision
- [Architecture and external dependencies](docs/architecture.md): diagrams of every
  service the app and the printed bulletin use, account ownership, and yearly upkeep

### Set up and contribute

- [Development setup and testing](docs/README.md): install the app, run it in a
  browser, on an Android emulator, or on the iOS Simulator, and run the tests
- [Contributing and release workflow](docs/CONTRIBUTING.md): branches, pull request
  rules, the automated checks, and how a release reaches `main`
- [Version numbers](docs/operations/version-numbers.md): the one number maintainers
  change, and how it sets the store build numbers

### Design

- [UI/UX design](docs/UI_UX.md): the four-tab app structure and its design language
- [Accessibility guidelines](docs/accessibility/README.md): the WCAG 2.1 AA baseline,
  text size, and screen readers
- Feature designs:
  - [Bible integration](docs/feature_designs/bible_integration_design.md): Bible text
    sources, translation choices, and the alternatives considered
  - [Bulletin hymn resolution and extension guide](docs/feature_designs/bulletin_hymn_resolution.md):
    how bulletin hymn entries are matched to the hymnals, and how to extend it
  - [Christian Library](docs/feature_designs/christian_library.md): the content policy
    and the curated catalog
  - [English hymnal integration](docs/feature_designs/hymnal_integration_design.md): the
    hymnal index and why it links to externally hosted sheet music
  - [Offline bulletin translation: Bergamot feasibility](docs/feature_designs/offline_bulletin_translation.md):
    why on-device translation is deferred, and what the app does instead
  - [Children's Sabbath School lessons](docs/feature_designs/sabbath_school_lessons.md):
    where each age group's weekly lesson comes from
- [Bundled font sources and licenses](assets/fonts/README.md): each font, its source,
  and what its license allows
- [Bundled image assets](assets/images/README.md) and
  [external brand assets](assets/images/brand/README.md): where the app's images live,
  and the rules for the YouTube and Spotify icons

### Build and release

- [Native mobile binary builds](docs/operations/native-builds.md): signing and
  credentials, PR preview builds and key screens, local builds, and the automatic
  uploads to TestFlight and Google Play

### Operate

- [Admin runbook](docs/operations/admin-runbook.md): step-by-step checklists for the
  tasks a maintainer does by hand, from approving a deployment to uploading to the
  stores and answering alerts
- [Bulletin automation operations](docs/operations/bulletin-automation.md): the bulletin
  spreadsheet, the app's bulletin API, the printed bulletin, deployment, and
  troubleshooting
  - [Bulletin Apps Script source](google-apps-script/README.md): setup and commands for
    the script's source directory
- [External dependency monitor](docs/operations/external-dependency-monitor.md): the
  daily check of every outside service the app uses, and what to do when it fails

### Maintenance

- [Upkeep calendar](docs/architecture.md#upkeep-calendar): what to renew or check each
  year, and what breaks if it's missed
- [Payment methods](docs/architecture.md#payment-methods): which service has a card
  on file (only Cloudflare, for the domain), and why no other may
- [Credentials that need attention](docs/operations/admin-runbook.md#credentials-that-need-attention):
  each secret and key, where it's kept, and when to act

### Services and costs

- [Service limits and costs](docs/operations/service-limits-and-costs.md): the cost,
  published limits, and load of every external service
- [Adventist Connect media hosting](docs/operations/adventist-connect-media.md): the
  church's Bible audio and pictures, how the app fetches them, and how far the hosting
  scales

### App stores

- [App Store and Google Play setup](docs/operations/app-store-setup.md): store accounts,
  signing files, yearly renewals, and account ownership and recovery
- [Store listings](docs/operations/store-listing.md): the listing text in all four app
  languages, reviewer notes, and the screenshot rules
- [Store assets](docs/store-assets/README.md): copies of the screenshots and images
  uploaded to each store
- [App Store Connect answers](docs/operations/app-store-connect-answers.md) and
  [Google Play Console answers](docs/operations/play-console-answers.md): every store
  declaration and why it's right

### Legal, licensing, and privacy

- [Legal, Licensing, and Privacy](docs/LEGAL.md): licensing records, third-party source
  reviews, the privacy policy, and the disclaimer the app shows under
  **You → Legal Disclaimer**, which also says where each Library book is hosted
- [Branding and trademark policy](docs/LEGAL_BRANDING.md): the logos, trademarks, and
  branding that the open-source license doesn't cover
- [Sabbath Encouragement attribution and copyright](docs/operations/sabbath-encouragement-copyright.md):
  attribution rules, the source review, and the fair-use analysis

### Records

Dated records, kept for their reasoning. The docs above describe the app as it is now.

- [Native store publishing investigation (#139)](docs/operations/native-store-investigation.md):
  the September 2026 decision to keep Expo and build the native apps directly
- [Android chapter continuation test record (#225)](docs/testing/bible-audio-225.md):
  Bible audio moving on to the next chapter on Android, tested in 0.38.x
- [Google Play and App Store policy audit](docs/operations/store-policy-audit.md): the
  release-readiness review of September 12, 2026

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
which doesn't block the launch.
