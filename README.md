# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features. Native iOS and Android are the primary release targets; the web/PWA
build remains a useful preview and fallback surface.

## Table of Contents

### Project overview

- [Project Tenets](docs/project-tenets.md)

### Legal, licensing, and privacy

- [Legal, Licensing & Privacy](docs/LEGAL.md)

User-facing legal text is centralized in the app under **You → Legal Disclaimer**.
Library reading-source notices are also collected there: Ellen G. White editions are
hosted externally on EGW Writings; Adventist pioneer and Christian classic works are
public domain in the U.S. and hosted externally on Project Gutenberg. The repository's
licensing decisions and third-party source review live in [docs/LEGAL.md](docs/LEGAL.md).

### Project documentation

- [Architecture & External Dependencies](docs/architecture.md): service diagram,
  account ownership, and yearly upkeep
- [Technical Setup & Testing](docs/README.md)
- [Admin Runbook](docs/operations/admin-runbook.md): step-by-step manual workflows and
  admin web tasks
- [Build Instructions](docs/operations/native-builds.md)
- [Bulletin Automation Operations](docs/operations/bulletin-automation.md)
- [Adventist Connect Media Hosting](docs/operations/adventist-connect-media.md): Bible audio
  and image hosting, with a scaling analysis
- [Service Limits and Costs](docs/operations/service-limits-and-costs.md): cost, published
  limits, and load for every external service
  - [Sabbath Encouragement attribution and copyright](docs/operations/sabbath-encouragement-copyright.md)
- [Accessibility Guidelines](docs/accessibility/README.md)
- [UI/UX Design](docs/UI_UX.md)
- [Feature Designs](docs/feature_designs/)
  - [Bulletin Hymn Resolution & Extension Guide](docs/feature_designs/bulletin_hymn_resolution.md)
  - [Offline Bulletin Translation: Bergamot Feasibility](docs/feature_designs/offline_bulletin_translation.md)
- [Contributing Code](docs/CONTRIBUTING.md)

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
  GitHub opens a reminder issue two months before any Apple renewal is due.
- [Store listings and declarations](docs/operations/admin-runbook.md#store-listings-and-declarations):
  where the listing text, screenshots, and every store answer are kept, and what to
  update with each release.
- [Credentials that need attention](docs/operations/admin-runbook.md#credentials-that-need-attention)

## Project status

The app uses one Expo source for native apps and the web/PWA preview. The current Expo 58
upgrade notes and follow-up checklist are tracked in [issue #211](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/211),
not in this overview. See [Build Instructions](docs/operations/native-builds.md) for the
trusted-branch workflow, local commands, debug APK previews, signing boundaries, and
release recovery procedures.
