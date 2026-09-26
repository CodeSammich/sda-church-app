# Architecture and external dependencies

This page maps the services the mobile app and the weekly printed bulletin depend on,
who owns each one, and what has to be renewed to keep them running. It covers the
technical stack only, not the church's wider IT system.

Account owners, recovery contacts, and sign-in details are deliberately left out of
this public repository. They live in the church's internal IT document, which the
Super Administrators can share.

## Contents

- [Diagram](#diagram)
- [Foundational systems](#foundational-systems)
- [Source code and CI/CD](#source-code-and-cicd)
- [Printed and digital bulletin](#printed-and-digital-bulletin)
- [Files not in this repository](#files-not-in-this-repository)
- [Static media assets](#static-media-assets)
- [App stores](#app-stores)
- [Public content providers](#public-content-providers)
- [Upkeep calendar](#upkeep-calendar)
- [Governance principles](#governance-principles)

## Diagram

Solid arrows are runtime data flow; dotted arrows are deployment, publishing, or
account dependencies.

![Architecture diagram: people, clients, Cloudflare, Google Workspace, GitHub, the app stores, the Adventist Connect media library, and public content providers, with arrows showing data flow and deployments](diagrams/architecture.svg)

The diagram's source is [`diagrams/architecture.mmd`](diagrams/architecture.mmd).
GitHub's built-in Mermaid can't load logo images from outside links, so the page
shows a pre-rendered SVG instead. To change the diagram, edit the `.mmd` file, run
`npm run docs:diagram`, and commit both files. The script renders the source with
Mermaid CLI and embeds the logos from pinned jsDelivr URLs for the CC0-licensed
[SVG Logos](https://github.com/gilbarbara/logos) and
[Simple Icons](https://simpleicons.org/) sets, so the SVG needs nothing external.
The daily dependency checks and the account links between the stores and the domain
are described below rather than drawn, to keep the diagram readable.

## Foundational systems

Every other system signs in through these two. If either is lost, recovery is slow
and may not be possible, so protect them above everything else.

### Cloudflare

- **Registrar and DNS** for `nyccsda.org`. The domain costs about $10 per year and
  can be registered up to 10 years at a time. Keep an active payment method on
  file for renewal. Renewal notices go to the Super Administrators.
- **Workers** act as middleware for API keys used by programmatic clients such as
  the mobile app. This is still under development.
- Administrators sign in to Cloudflare with Google.

### Google Workspace for Nonprofits

- Granted on the `nyccsda.org` domain. It hosts the administrators' church accounts,
  the shared drives, and the internal IT document.
- `technology@nyccsda.org` is a Google Group containing the administrators. Use it
  for logins that accept an email and password (for example the Apple Developer
  account). Services that only offer **Sign in with Google** need an individual
  `nyccsda.org` user instead, because a group can't sign in.
- The group is set up as a **collaborative inbox** that also **forwards each email
  to every member**. Members get account notices in their own inboxes, and the
  group keeps its own copy of every message. If every member deletes an email, it
  is still in the group, so the group is the source of truth for account mail such
  as Apple, Google Play, and domain renewal notices. We recommend this setup for
  any shared role address: it needs no licensed mailbox, and new administrators
  get the full history as soon as they are added. The free nonprofit edition
  includes 100 TB of storage pooled across the organization, so there is plenty
  of room to keep this history.

> [!IMPORTANT]
> **Get Workspace permissions right, with least-privilege access.** Each church
> sets up its own groups and roles, and ours change over time, so this page
> doesn't record them. As a general rule, **grant access to groups, not to
> individuals**, on important Google Drive resources, especially the ones this
> app depends on: the scheduling roster Shared Drive, the Apps Script project, and
> the printed bulletin and QR code folders. When someone joins or leaves a role,
> update the group's membership rather than every file's sharing settings. That
> keeps access auditable and makes it easy to remove.

> [!IMPORTANT]
> **Require 2-Step Verification for every user and turn off SMS and phone codes.**
> In the Google Admin console, go to **Security → Authentication → 2-step
> verification**. Turn on **Enforcement** and set **Methods** to **Any except
> verification codes via text, phone call**. Text and phone codes can be
> intercepted through SIM swapping, so passkeys, security keys, authenticator
> apps, and Google prompts are the accepted methods.
- Where a service still signs in with an account outside the Workspace, move access
  to a `nyccsda.org` account or the `technology@nyccsda.org` group wherever the
  service allows it.

## Source code and CI/CD

- **GitHub organization** `New-York-Chinese-Seventh-day-Adventist` hosts this
  repository.
- **GitHub Actions** runs everything automated:
  - unit and integration tests on pull requests;
  - native iOS and Android builds, signed with credentials from the `production`
    Environment;
  - Android preview APKs for pull requests;
  - web/PWA preview deploys to GitHub Pages;
  - Apps Script deploys through `clasp`;
  - bulletin QR code generation into Google Drive;
  - a daily [external dependency monitor](operations/admin-runbook.md#external-dependency-monitor-alerts).
- Publishing to the stores through [fastlane](https://fastlane.tools/) is planned
  but not yet in place.

The [Admin Runbook](operations/admin-runbook.md) covers approving production runs
and rotating the credentials these workflows use.

## Printed and digital bulletin

- The **scheduling roster** is a Google Sheet in a Shared Drive open to key church
  staff. Staff edit it; nothing else is an intake point.
- **`BulletinApi.gs`** publishes a privacy-filtered JSON feed (names anonymized) that
  the apps read.
- **`Printed*.gs`** renders the full-name printed bulletin to a Google Doc and PDF in
  Drive.
- The Apps Script source lives in [`google-apps-script/`](../google-apps-script/)
  and is deployed by GitHub Actions, or locally by developers with access to the
  scheduling Shared Drive.

Details: [Bulletin Automation Operations](operations/bulletin-automation.md).

## Files not in this repository

The code in this repository isn't enough to run the system on its own. The files
below live in the church's Google Drive, or in GitHub secrets, and are deliberately
not committed: they are private, copyrighted, restricted branding, or credentials.
Anyone setting up a new copy of this system, or recovering from lost Drive files,
has to supply their own.

### Bulletin inputs in Google Drive

| File | Used for | How the script finds it |
| --- | --- | --- |
| Master scheduling spreadsheet (`Sabbath Calendar`, `Sabbath Sermon Data`, and `Name Dictionary` tabs) | Roster, sermon data, and full names for print | Bound Apps Script project; layout in [Bulletin Automation Operations](operations/bulletin-automation.md) |
| Church sketch image | Cover of the regular Queens and Brooklyn bulletins | Drive file ID in `PRINTED_BULLETIN_CONFIG.churchSketchImageFileId`, or the `CHURCH_SKETCH_IMAGE_FILE_ID` script property |
| Last Supper image | Communion bulletin cover | `lastSupperImageFileId`, or `LAST_SUPPER_IMAGE_FILE_ID` |
| SDA logo | Printed bulletin logo | `sdaLogoImageFileId`, or `SDA_LOGO_IMAGE_FILE_ID`. Restricted branding: see [Branding & Trademark Policy](LEGAL_BRANDING.md) |
| QR placeholder image | Shown in a QR slot when neither the file name nor the property finds a code | `qrPlaceholderImageFileId` |
| `queens_adventist_giving_qr_code_368x368.jpg`, `brooklyn_adventist_giving_qr_code_368x368.jpg` | Giving QR codes | Exact file name anywhere in Drive, then the `ADVENTIST_GIVING_QR_IMAGE_FILE_ID` property. Generated by the QR workflow ([Admin Runbook](operations/admin-runbook.md#bulletin-qr-codes)) |
| `queens_zelle_qr_code_368x368.jpg`, `brooklyn_zelle_qr_code_368x368.jpg`, `mobile_app_qr_code_368x368.jpg` | Zelle and mobile app QR codes | Exact file name anywhere in Drive, then the `ZELLE_QR_IMAGE_FILE_ID` / `MOBILE_APP_QR_IMAGE_FILE_ID` properties. Made by hand for now (#237) |
| `sabbath_encouragement.pdf` | Source of the weekly Sabbath Encouragement page in the Brooklyn bulletin | Drive file ID in `SABBATH_ENCOURAGEMENT_SOURCE_FILE_ID`. Text is also snapshotted in `SabbathEncouragement.gs`; see [attribution and copyright](operations/sabbath-encouragement-copyright.md) and #248 |
| Output folders (all, Queens, Brooklyn) | Where generated bulletin Docs and PDFs are saved | Folder IDs in `PRINTED_BULLETIN_CONFIG`, or the `PHYSICAL_BULLETIN_*_FOLDER_ID` properties |

The IDs and property names are in
[`PrintedQueensBulletin.gs`](../google-apps-script/PrintedQueensBulletin.gs). A new
installation should upload its own files and set the script properties rather than
edit the IDs in code. The QR codes are matched by name across all of Drive, so keep
exactly one file with each name. When replacing one by hand, rename the old copy
rather than trashing it; the Admin Runbook explains why.

### Credentials in GitHub secrets

These are generated per organization and can't be copied from anyone else.

- **Android upload keystore** (`nyccsda-upload.jks`), which signs builds for Google
  Play.
- **Apple distribution certificate** (`.p12`) and **App Store provisioning
  profile** (`.mobileprovision`), renewed yearly.
- **Google `clasp` credentials** (`CLASPRC_JSON`) and the Apps Script project and
  deployment IDs.

Where each secret goes and how to rotate it is covered in
[Native Builds](operations/native-builds.md) and the
[Admin Runbook](operations/admin-runbook.md#credentials-that-need-attention).

## Static media assets

- Pictures and Bible audio are hosted in the church's media library on the North
  American Division's Adventist Connect platform
  (`newyorkchineseny.adventistchurch.org`, served from
  `assets.adventistconnect.org`). The files are stored on Wasabi (`us-east-2`,
  Northern Virginia), an S3-compatible object store that is separate from AWS,
  behind Adventist Connect's Cloudflare CDN. The conference or its WordPress host
  runs this, not the church.
- Most of the traffic is Bible audio. Hosting details and a scaling analysis are in
  [Adventist Connect media hosting](operations/adventist-connect-media.md).
- The church also keeps copies in Google Drive in case this hosting goes away.

Where the license allows it, the church aims to keep at least two copies of
media it depends on, on services it controls: the Adventist Connect media library
and Google Drive. This is best effort rather than a complete backup of every file.
Many sources don't permit separate copies, so the app relies on them directly;
see [Public content providers](#public-content-providers).

## App stores

### Apple App Store

- The church has an **Apple Business Manager** organization with nonprofit status,
  registered with the church's own D-U-N-S number (not the conference's). That
  waives the $99 annual developer fee.
- The **Apple Developer** account that publishes the app belongs to
  `technology@nyccsda.org`.
- Nonprofit status must be **resubmitted every year**. Apple sends a reminder about
  30 days ahead; the earlier answers are remembered, so it is mostly a matter of
  confirming and resubmitting. No payment method is on file, so a lapse means the
  app is removed, not that the church is charged.
- The signing certificates also expire every year. When they are renewed, update
  the matching GitHub secrets or the iOS build workflow will fail.

### Google Play Console

- The church's organization developer account paid the one-time $25 fee, so there
  is no recurring cost.
- Every IT administrator is a developer on the account.
- Verifying the organization required adding `nyccsda.org` to **Google Search
  Console**, where the administrators also have access.
- Nothing needs renewing beyond keeping the app updated to meet Play's target API
  level requirements.

## Public content providers

The app reads public content over HTTPS without an account. The dependency monitor
checks each of these daily. Most of these sources don't allow the church to keep its
own copy, so for them the app depends entirely on the provider staying online. The
CUV audio is the exception: its owner allowed self-hosting, so Adventist Connect
holds the primary copy and the provider is a fallback.

| Provider | Used for |
| --- | --- |
| HelloAO, fetch(bible) | Bible text |
| Audio Power, Archive.org, Adventist Connect | Chinese Union Version Bible audio |
| Hymnal sources (Chinese 505/506/707, Hymns for Worship) | Bulletin hymn lookup |
| Adventech Sabbath School | Lesson quarterlies |
| EGW Writings, Project Gutenberg, Chinese Union Mission library | Library reading |
| Sunrise-Sunset API | Sabbath sunset times |

Licensing for these sources is recorded in [Legal, Licensing & Privacy](LEGAL.md).

> [!WARNING]
> **The Chinese hymnals depend on a single site in mainland China, with no copy the
> church controls.** The Chinese 505, 506, and 707 hymn links open sheet-music pages
> on `m.zgaxr.com`, a Chinese Adventist website hosted in Zhejiang Province. Online
> religious content in China is tightly regulated, so the site could be taken down
> or changed without notice. The app stores only hymn numbers, titles, and page IDs,
> not the sheet music, so if the site goes away the Chinese hymnals stop working
> until the church has its own copy. The dependency monitor would show the failure,
> but there is no fallback. Keeping a copy, subject to a copyright review, is
> tracked in [#260](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/260).

## Upkeep calendar

| When | What | If missed |
| --- | --- | --- |
| Yearly | Resubmit Apple nonprofit status | App removed from the App Store |
| Yearly | Renew Apple signing certificates and update GitHub secrets | iOS builds fail; app can't be updated |
| Yearly | Check the Cloudflare payment method hasn't expired and the domain's paid-through date | Domain renewal fails |
| Yearly | Review administrator access and recovery details on every system | An account can't be recovered |
| Daily (automated) | External dependency monitor | Opens an issue; see the runbook |

## Governance principles

- **Apply for nonprofit status** wherever a provider offers it, using the church's
  own EIN and D-U-N-S number rather than the conference's.
- **Free services only**, apart from small necessities such as the domain.
- **Two-factor authentication for every user, everywhere**, including on the
  personal accounts that sit at the root of account recovery. Don't allow SMS or
  phone-call codes, which SIM swapping and number porting can intercept. Use an
  authenticator app, passkeys, or security keys.
- **Every administrator is a super administrator on every system**, so no single
  person is a point of failure.
- **Hand over access by granting it**, never by sharing passwords.
- **Register accounts to a shared group address** such as `technology@nyccsda.org`,
  not to one person, so the mail history outlasts any one administrator.

Review this page when a service is added or removed, and at least once a year.
