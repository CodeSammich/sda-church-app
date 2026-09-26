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
- [Static media assets](#static-media-assets)
- [App stores](#app-stores)
- [Public content providers](#public-content-providers)
- [Upkeep calendar](#upkeep-calendar)
- [Governance principles](#governance-principles)

## Diagram

Solid arrows are runtime data flow; dotted arrows are deployment, publishing, or
account dependencies.

```mermaid
flowchart LR
  subgraph People
    members@{ img: "https://api.iconify.design/mdi/account-group.svg?color=%236b7280", label: "Congregation", pos: "b", w: 48, h: 48, constraint: "on" }
    staff@{ img: "https://api.iconify.design/mdi/account-edit.svg?color=%236b7280", label: "Church staff", pos: "b", w: 48, h: 48, constraint: "on" }
    admins@{ img: "https://api.iconify.design/mdi/shield-account.svg?color=%236b7280", label: "IT administrators", pos: "b", w: 48, h: 48, constraint: "on" }
  end

  subgraph Clients
    ios@{ img: "https://api.iconify.design/logos/apple.svg", label: "iOS app", pos: "b", w: 40, h: 48, constraint: "on" }
    android@{ img: "https://api.iconify.design/logos/android-icon.svg", label: "Android app", pos: "b", w: 48, h: 48, constraint: "on" }
    pwa@{ img: "https://api.iconify.design/logos/pwa.svg", label: "Web / PWA preview", pos: "b", w: 64, h: 24, constraint: "on" }
  end

  subgraph Cloudflare
    dns@{ img: "https://api.iconify.design/logos/cloudflare-icon.svg", label: "Registrar + DNS<br/>nyccsda.org", pos: "b", w: 64, h: 30, constraint: "on" }
    workers@{ img: "https://api.iconify.design/logos/cloudflare-workers-icon.svg", label: "Workers<br/>API keys · WIP", pos: "b", w: 48, h: 44, constraint: "on" }
  end

  subgraph Google["Google Workspace for Nonprofits"]
    group@{ img: "https://api.iconify.design/logos/google-gmail.svg", label: "Google Group<br/>technology@nyccsda.org", pos: "b", w: 48, h: 36, constraint: "on" }
    roster@{ img: "https://api.iconify.design/simple-icons/googlesheets.svg?color=%2334A853", label: "Scheduling roster<br/>Shared Drive", pos: "b", w: 40, h: 48, constraint: "on" }
    api@{ img: "https://api.iconify.design/simple-icons/googleappsscript.svg?color=%234285F4", label: "Apps Script<br/>BulletinApi.gs", pos: "b", w: 48, h: 48, constraint: "on" }
    printed@{ img: "https://api.iconify.design/simple-icons/googleappsscript.svg?color=%234285F4", label: "Apps Script<br/>Printed*.gs", pos: "b", w: 48, h: 48, constraint: "on" }
    drive@{ img: "https://api.iconify.design/logos/google-drive.svg", label: "Google Drive<br/>bulletin PDFs, QR codes,<br/>media backups", pos: "b", w: 48, h: 42, constraint: "on" }
  end

  subgraph GitHub
    repo@{ img: "https://api.iconify.design/logos/github-icon.svg", label: "sda-church-app repo", pos: "b", w: 48, h: 48, constraint: "on" }
    actions@{ img: "https://api.iconify.design/logos/github-actions.svg", label: "GitHub Actions<br/>tests · builds · deploys · monitor", pos: "b", w: 48, h: 48, constraint: "on" }
    secrets@{ img: "https://api.iconify.design/mdi/key-chain.svg?color=%236b7280", label: "production Environment<br/>signing + Google credentials", pos: "b", w: 44, h: 44, constraint: "on" }
    pages@{ img: "https://api.iconify.design/logos/github-icon.svg", label: "GitHub Pages", pos: "b", w: 40, h: 40, constraint: "on" }
  end

  subgraph Stores["App stores"]
    abm@{ img: "https://api.iconify.design/logos/apple.svg", label: "Apple Business Manager", pos: "b", w: 34, h: 40, constraint: "on" }
    appstore@{ img: "https://api.iconify.design/logos/apple-app-store.svg", label: "App Store Connect", pos: "b", w: 44, h: 44, constraint: "on" }
    play@{ img: "https://api.iconify.design/logos/google-play-icon.svg", label: "Google Play Console", pos: "b", w: 40, h: 44, constraint: "on" }
    gsc@{ img: "https://api.iconify.design/logos/google-search-console.svg", label: "Google Search Console", pos: "b", w: 44, h: 44, constraint: "on" }
  end

  subgraph Media["Adventist Connect media library"]
    wp@{ img: "https://api.iconify.design/logos/wordpress-icon.svg", label: "assets.adventistconnect.org<br/>Cloudflare CDN", pos: "b", w: 44, h: 44, constraint: "on" }
    wasabi@{ img: "https://api.iconify.design/simple-icons/wasabi.svg?color=%2301CD3E", label: "Wasabi storage<br/>us-east-2", pos: "b", w: 44, h: 44, constraint: "on" }
  end

  content@{ img: "https://api.iconify.design/mdi/web.svg?color=%236b7280", label: "Public content providers<br/>Bible text + audio, hymnals,<br/>Sabbath School, sunset times", pos: "b", w: 48, h: 48, constraint: "on" }

  members --> Clients
  staff --> roster
  roster --> api & printed
  api -- privacy-filtered JSON --> Clients
  printed --> drive
  Clients -- images + Bible audio --> wp
  wp -- cache miss --> wasabi
  Clients --> content

  repo --> actions
  secrets -.-> actions
  actions -. clasp deploy .-> api
  actions -. QR codes .-> drive
  actions -. web build .-> pages
  pages -.-> pwa
  actions -. signed builds .-> Stores

  admins -.-> group
  group -.-> repo
  dns -.-> Google
  abm -.-> appstore
  workers -.-> Clients
```

GitHub renders this diagram directly from the Mermaid source above. The logos are
linked from the public [Iconify](https://iconify.design/) icon service (the `logos`,
`simple-icons`, and `mdi` sets), not stored in this repository. To change the
diagram, edit the text; there is no image to regenerate. The daily dependency checks
and the account links between the stores and the domain are described below rather
than drawn, to keep the diagram readable.

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
