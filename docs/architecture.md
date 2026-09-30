# Architecture and external dependencies

This page maps the services the mobile app and the weekly printed bulletin depend on,
who owns each one, and what has to be renewed to keep them running. It covers the
technical stack only, not the church's wider IT system.

Account owners, recovery contacts, and sign-in details are deliberately left out of
this public repository. They live in the church's internal IT document, which the
Super Administrators can share.

## Contents

- [Diagrams](#diagrams)
- [Foundational systems](#foundational-systems)
- [Source code and CI/CD](#source-code-and-cicd)
- [Printed and digital bulletin](#printed-and-digital-bulletin)
- [Files not in this repository](#files-not-in-this-repository)
- [Church media](#church-media)
- [App stores](#app-stores)
- [Google Cloud: free only](#google-cloud-free-only)
- [Website: app.nyccsda.org](#website-appnyccsdaorg)
- [Third-party APIs and websites](#third-party-apis-and-websites)
- [Payment methods](#payment-methods)
- [Upkeep calendar](#upkeep-calendar)
- [Governance principles](#governance-principles)

## Diagrams

Solid arrows are data flow; dotted arrows are deployment, publishing, or account
links.

### Overview

Who does what: the congregation gets and uses the app, staff produce the digital and
printed bulletins, and IT administrators develop, release, and maintain it.

![Overview diagram: the congregation scans a QR code to reach the download page and installs the app from Google Play or the Apple App Store; staff edit the scheduling roster, which feeds the digital bulletin in the apps and the printed Queens, Queens Communion, and Brooklyn bulletins; IT administrators own the GitHub organization, develop on forks, merge feature PRs into a release branch and release PRs into main; GitHub Actions uploads the signed AAB to Google Play internal testing through a keyless sign-in in the church's Google Cloud project, which the administrators own and which has no billing account and must never get one, and uploads the IPA to TestFlight; an administrator releases each one after testing; administrators rerun the QR code workflow when needed; the apps rely on media and third-party services shown in the app dependencies diagram](diagrams/architecture.svg)

### Build, deploy, and accounts

How code reaches the stores, the bulletin backend, and the website, which secrets
each step uses, and how the domain ties the accounts together.

![Build and deploy diagram: GitHub Actions uses the Android, Apple, and Apps Script secrets from the production environment and the store upload settings from the store-upload environment to upload builds to Google Play internal testing and TestFlight, signing in to Google Play without a key through a Google Cloud project that has no billing account, deploy the bulletin Apps Script, upload QR codes and preview APKs to Google Drive, and build the GitHub Pages site; Cloudflare DNS for nyccsda.org points at GitHub Pages and Google Workspace and holds the TXT record that verifies the domain in Google Search Console, which Google Play uses to verify the organization's website](diagrams/operations.svg)

### App dependencies

Every outside service the apps talk to: what they load inside the app, and what they
only open in the browser. It also shows how church media is kept available: the
Adventist Connect library is served from Wasabi and backed up to Google Drive, and
if it fails, Bible audio falls back to the Internet Archive and then Audio Power.
See [Third-party APIs and websites](#third-party-apis-and-websites) for the full
table.

![App dependencies diagram: inside the app, church photos, hymnal charts, and Bible audio from the Adventist Connect media library, which is stored on Wasabi and can be restored from a Google Drive backup, with Bible audio falling back to the Internet Archive and then Audio Power; Bible text from HelloAO and fetch(bible); the church's bulletin API and the Adventech, Chinese Union Mission, and EGW Writings APIs; opened in the browser, YouTube, Spotify, Zoom, hymns on zgaxr and Hymns for Worship, Sabbath School readers, library reading, giving, and other links](diagrams/app-dependencies.svg)

### Google Play upload sign-in

Each service the automatic Google Play upload passes through, in order. It signs in
without a key: GitHub vouches for the job, Google's Security Token Service checks that
against the church's workload identity pool, and the IAM Service Account Credentials
API returns a short-lived token for the `play-upload` service account. Setup is in
[Setting up the Google Play service account](operations/native-builds.md#setting-up-the-google-play-service-account).

![Google Play upload sign-in diagram: 1, the upload job, which runs only in the store-upload environment on main, asks GitHub for an identity token; 2, GitHub returns a signed token naming the repository ID, environment, and branch; 3, the job sends it to Google's Security Token Service API for the provider named in GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER; 4, the Security Token Service checks it against the provider sda-church-app in the workload identity pool github, which accepts only this repository's ID, the store-upload environment, and main; 5, the pool accepts it; 6, the Security Token Service returns a federated token; 7, the job asks the IAM Service Account Credentials API to act as the play-upload service account, which is allowed because the pool is a Workload Identity User on it; 8, it returns a play-upload token limited to Google Play that expires within an hour; 9, the job uploads the AAB to the Google Play Android Developer API, sets the release name and What's new, and commits, which Play Console allows because play-upload may release to testing tracks; 10, Play rolls the release out to the internal testing track. The Google Cloud services are in the project sda-church-app-play, which is free and has no billing account. No key is stored anywhere, and an admin promotes the release to production after testing](diagrams/play-upload.svg)

### Editing the diagrams

The sources are the `.mmd` files in [`diagrams/`](diagrams/). GitHub's built-in
Mermaid can't load logo images from outside links, so the page shows pre-rendered
SVGs instead. To change a diagram, edit its `.mmd` file, run `npm run docs:diagram`,
and commit both files. The script renders every source with Mermaid CLI and embeds
the logos from pinned jsDelivr URLs for the CC0-licensed
[SVG Logos](https://github.com/gilbarbara/logos) and
[Simple Icons](https://simpleicons.org/) sets, so the SVGs need nothing external.
Each SVG records a fingerprint of its source, and a unit test fails in CI if a
`.mmd` file changes without its SVG being re-rendered.

## Foundational systems

Every other system signs in through these two. If either is lost, recovery is slow
and may not be possible, so protect them above everything else.

### Cloudflare

- **Registrar and DNS** for `nyccsda.org`. The domain costs about $10 per year and
  can be registered up to 10 years at a time. Keep an active payment method on
  file for renewal. Renewal notices go to the Super Administrators.
- **DNS** points `app.nyccsda.org` at GitHub Pages and the domain's email at
  Google Workspace. It also holds the DNS TXT record that proves the church owns
  `nyccsda.org` in **Google Search Console**, where the domain is registered as a
  Domain property; Google only verifies those with a DNS record. Search Console is
  a Google tool, not an app store; the administrators have access to it through
  their church accounts.
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
- Where a service still signs in with an account outside the Workspace, move access
  to a `nyccsda.org` account or the `technology@nyccsda.org` group wherever the
  service allows it.

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

## Source code and CI/CD

- **GitHub organization** `New-York-Chinese-Seventh-day-Adventist` hosts this
  repository.
- **GitHub Actions** runs everything automated:
  - unit and integration tests on pull requests;
  - native iOS and Android builds after each merge to `main`, uploaded automatically
    to TestFlight and Google Play internal testing for testers (Google Play through a
    keyless sign-in in the church's [Google Cloud project](#google-cloud-free-only));
  - Android preview APKs for pull requests into `main`;
  - the [website](#website-appnyccsdaorg) deploy to GitHub Pages;
  - bulletin Apps Script deploys, using [`clasp`](https://github.com/google/clasp),
    Google's command-line tool for uploading Apps Script code;
  - bulletin QR code generation into Google Drive;
  - a daily [external dependency monitor](operations/admin-runbook.md#external-dependency-monitor-alerts);
  - a weekly [store toolchain monitor](operations/admin-runbook.md#store-toolchain-monitor-alerts)
    that warns before Google Play or App Store Connect requirements pass the app by.
- Releasing to the public stays manual: after testing, an administrator submits
  the iOS build for review in App Store Connect and promotes the Android release in
  Play Console. See
  [Automatic store uploads](operations/native-builds.md#automatic-store-uploads).
- **Credentials live in GitHub Secrets**, in two environments of this repository.
  The `production` environment holds the signing and Google account credentials.
  Each job that uses them waits for a `release-approvers` member to approve it.
  There are three separate groups:
  - **Android signing:** the upload keystore and its passwords
    (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`,
    `ANDROID_KEY_PASSWORD`). With Play App Signing, Google keeps the real
    app-signing key, which can't be downloaded. The church generates its own
    upload keystore and registers its certificate in Play Console. It doesn't
    expire yearly. If it's lost or leaked, request an upload key reset in Play
    Console instead of creating a new one.
  - **Apple signing:** the distribution certificate, provisioning profile, and team
    ID (`IOS_DISTRIBUTION_CERTIFICATE_BASE64`,
    `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`, `IOS_PROVISIONING_PROFILE_BASE64`,
    `IOS_TEAM_ID`). The certificate and profile **expire every 12 months**; renew
    them in the Apple Developer account and update these secrets, or iOS builds
    fail.
  - **Google account login:** a saved login for a church Google account
    (`CLASPRC_JSON`), created by signing in with `clasp`. It uploads the bulletin
    Apps Script code and also the QR codes and preview APKs to Google Drive. The
    Apps Script project and deployment IDs (`APPS_SCRIPT_PROJECT_ID`,
    `APPS_SCRIPT_DEPLOYMENT_ID`) say which script to update.
- The **`store-upload`** environment holds the **store upload settings**, used only
  by the jobs that upload approved builds to testers: an App Store Connect API key
  (`APP_STORE_CONNECT_API_KEY_ID`, `APP_STORE_CONNECT_API_ISSUER_ID`,
  `APP_STORE_CONNECT_API_PRIVATE_KEY`), and which Google Play service account in the
  [Google Cloud project](#google-cloud-free-only) to sign in as without a key
  (`GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER`, `GOOGLE_PLAY_SERVICE_ACCOUNT`). Those jobs never see the signing keys and
  run no npm packages, and they start without a second approval once the builds
  are approved.

The [Admin Runbook](operations/admin-runbook.md) covers approving production runs
and rotating the credentials these workflows use.

## Printed and digital bulletin

The bulletin has one source and two separate outputs. Staff maintain the
**scheduling roster**, a Google Sheet in a Shared Drive open to key church staff.
Nothing else is an intake point.

### Digital bulletin (in the app)

- Members open the **Bulletin** tab in the app.
- The app loads it from **`BulletinApi.gs`**, a public Apps Script endpoint that
  returns privacy-filtered JSON with names anonymized.
- Roster edits reach the app within a few minutes (the API caches for two minutes);
  nothing is generated by hand.

### Printed bulletin (on paper)

- Staff open the roster spreadsheet and choose **Printed Bulletin → Create Google
  Doc + PDF…**. This is the only regular manual step.
- They pick the Sabbath, the congregation, and the layout. **Three layouts are
  supported today:**
  - **Queens**, regular worship;
  - **Queens**, Holy Communion;
  - **Brooklyn**, regular worship, including a weekly Sabbath Encouragement page.
    Brooklyn Communion is intentionally disabled.
- **`Printed*.gs`** renders a Google Doc and a PDF with full names, cover art, and
  QR codes, and saves them to that congregation's Drive folder. The PDF is then
  printed and handed out at church.
- The printed layouts are separate from the app, so a layout can change, or a new
  congregation can be added, without an app release. Each layout lives in its own
  `Printed*.gs` file.

The Apps Script source lives in [`google-apps-script/`](../google-apps-script/) and
is deployed by GitHub Actions, or locally by developers with access to the
scheduling Shared Drive. Details: [Bulletin Automation Operations](operations/bulletin-automation.md).

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
| `queens_adventist_giving_qr_code_368x368.jpg`, `brooklyn_adventist_giving_qr_code_368x368.jpg`, `mobile_app_qr_code_368x368.jpg` | Giving and mobile app QR codes | Exact file name anywhere in Drive, then the `ADVENTIST_GIVING_QR_IMAGE_FILE_ID` / `MOBILE_APP_QR_IMAGE_FILE_ID` properties. Generated by the QR workflow from `scripts/bulletin-qr-codes.json` ([Admin Runbook](operations/admin-runbook.md#bulletin-qr-codes)) |
| `queens_zelle_qr_code_368x368.jpg`, `brooklyn_zelle_qr_code_368x368.jpg` | Zelle QR codes | Exact file name anywhere in Drive, then the `ZELLE_QR_IMAGE_FILE_ID` property. Made by hand for now (#237) |
| `sabbath_encouragement.pdf` | Source of the weekly Sabbath Encouragement page in the Brooklyn bulletin | Drive file ID in `SABBATH_ENCOURAGEMENT_SOURCE_FILE_ID`. A backup copy is in [`public/library/`](../public/library/sabbath_encouragement.pdf), which the app's library also opens. Text is also snapshotted in `SabbathEncouragement.gs`; see [attribution and copyright](operations/sabbath-encouragement-copyright.md) and #248 |
| Output folders (all, Queens, Brooklyn) | Where generated bulletin Docs and PDFs are saved | Folder IDs in `PRINTED_BULLETIN_CONFIG`, or the `PHYSICAL_BULLETIN_*_FOLDER_ID` properties |

The IDs and property names are in
[`PrintedBulletin.gs`](../google-apps-script/PrintedBulletin.gs). A new
installation should upload its own files and set the script properties rather than
edit the IDs in code. The QR codes are matched by name across all of Drive, so keep
exactly one file with each name. When replacing one by hand, rename the old copy
rather than trashing it; the Admin Runbook explains why.

### Credentials in GitHub secrets

These are generated per organization and can't be copied from anyone else.

- **Android upload keystore** (`nyccsda-upload.jks`), which signs builds for Google
  Play. The church generates it; Play Console only holds its certificate. Keep an
  encrypted backup, because it can't be downloaded again.
- **Apple distribution certificate** (`.p12`) and **App Store provisioning
  profile** (`.mobileprovision`), renewed every 12 months.
- **Google account login** (`CLASPRC_JSON`, created with Google's `clasp` tool),
  which uploads the bulletin Apps Script code and Drive files, plus the Apps Script
  project and deployment IDs.
- **Store upload settings**, in the separate `store-upload` environment: the App
  Store Connect API key (`.p8`), and which
  [Google Play service account](#google-cloud-free-only) to sign in as, without a
  key. They upload approved builds to TestFlight and Google Play internal testing.

Where each secret goes and how to rotate it is covered in
[Native Builds](operations/native-builds.md) and the
[Admin Runbook](operations/admin-runbook.md#credentials-that-need-attention).

## Church media

- The church's pictures and its copy of the Chinese Union Version Bible audio are
  hosted in the church's media library on the North American Division's Adventist
  Connect platform (`newyorkchineseny.adventistchurch.org`, served from
  `assets.adventistconnect.org`). The files are stored on Wasabi (`us-east-2`,
  Northern Virginia), an S3-compatible object store that is separate from AWS,
  behind NAD's Cloudflare CDN. NAD or its WordPress host runs this, not the church.
- Most of the traffic is Bible audio. Hosting details and a scaling analysis are in
  [Adventist Connect media hosting](operations/adventist-connect-media.md).

Where the license allows it, the church aims to keep at least two copies of media it
depends on, on services it controls. This is best effort rather than a complete
backup of every file. Many sources don't permit separate copies, so the app relies
on them directly; see [Third-party APIs and websites](#third-party-apis-and-websites).

| Media | Primary | Other copies |
| --- | --- | --- |
| CUV Bible audio (1,189 MP3s) | Adventist Connect | Google Drive backup; the app falls back to the Internet Archive, then Audio Power |
| Church photos and hymnal lookup charts | Adventist Connect | Google Drive backup |
| Bulletin cover art, logo, QR codes | Google Drive | See [Files not in this repository](#files-not-in-this-repository) |

## App stores

Members install the app from **Google Play** and the **Apple App Store**. The
church manages its listings through each store's publisher portal: **Google Play
Console** and Apple's **App Store Connect**. App Store Connect isn't a separate
store. It is where builds are uploaded, the listing is edited, and releases are
submitted for review before they appear on the App Store.

> [!IMPORTANT]
> **The app must stay free, and must never take money through the stores.** Both
> store accounts are registered to the church as a nonprofit on the `nyccsda.org`
> domain, and the Apple fee waiver depends on that status. Don't make the app paid,
> and don't add in-app purchases, subscriptions, ads, or anything else that earns
> money through Apple or Google. Giving stays outside the stores: the app only opens
> external donation links (AdventistGiving) in the browser, and shows the Zelle
> address, which is fine.

### Apple App Store

- The church has an **Apple Business Manager** organization with nonprofit status,
  registered with the church's own D-U-N-S number (not the conference's). That
  waives the $99 annual developer fee.
- The **Apple Developer** account that publishes the app is registered to
  **`technology@nyccsda.org`**, the shared Google Group address, not to a person.
  The other active administrators are added to the team with their own individual
  `nyccsda.org` church accounts. Builds are uploaded to TestFlight automatically,
  and releases are submitted in App Store Connect.
- Nonprofit status must be **resubmitted every year**. Apple sends a reminder about
  30 days ahead; the earlier answers are remembered, so it is mostly a matter of
  confirming and resubmitting. No payment method is on file, so a lapse means the
  app is removed, not that the church is charged.
- The signing certificates also expire every year. When they are renewed, update
  the matching GitHub secrets or the iOS build workflow will fail. The steps are in
  [Yearly Apple renewals](operations/app-store-setup.md#yearly-apple-renewals).

### Google Play

- The church has **one organization developer account**, created under the
  `nyccsda.org` domain. It paid the one-time $25 fee, so there is no recurring
  cost.
- Each IT administrator signs in to Play Console with their **own individual
  `nyccsda.org` church account**, added as a user of that organization account.
- Google Play requires organization accounts to verify their website. The website
  must first be registered in Google Search Console, where `nyccsda.org` is verified
  by a DNS TXT record (see [Cloudflare](#cloudflare)); verification is then
  requested from Play Console.
- Nothing needs renewing beyond keeping the app updated to meet Play's target API
  level requirements.

## Google Cloud: free only

- To upload each release's AAB to Google Play automatically, the church created a
  Google Cloud project, `sda-church-app-play`, with a church `nyccsda.org` account.
  It exists only to hold the **Google Play service account** that GitHub Actions
  signs in as to upload to internal testing. It signs in **without a key**: GitHub
  vouches for the upload job, and Google returns a token that expires within an hour
  (Workload Identity Federation). The organization blocks key files, and there are
  none to store or leak.
- **Every setup step** (the project, APIs, service account, workload identity pool,
  OIDC provider and condition, IAM grant, Play Console access, GitHub secrets, and a
  final checklist) is in
  [Setting up the Google Play service account](operations/native-builds.md#setting-up-the-google-play-service-account).
- It was created for free and uses only free services. It also has **no billing
  account**, so there is no way for Google to charge the church.
  [Service limits and costs](operations/service-limits-and-costs.md#google-cloud-play-upload-service-account)
  records why, with Google's own statements.
- **Every IT administrator is an Owner** of the project, under **IAM & Admin → IAM**,
  so it doesn't depend on one account. When an administrator joins or leaves, update
  that list too.

| What | Name | Notes |
| --- | --- | --- |
| Project | `sda-church-app-play` | No billing account |
| Service account | `play-upload` | In Play Console with only **Release apps to testing tracks**; it has no keys |
| Workload identity pool and provider | `github`, `sda-church-app` | Accept only this repository, by its numeric ID, in the `store-upload` environment on `main` |
| GitHub secrets | `GOOGLE_PLAY_WORKLOAD_IDENTITY_PROVIDER`, `GOOGLE_PLAY_SERVICE_ACCOUNT` | In the `store-upload` environment; neither is a key |

There's nothing to renew. The [Google Play upload sign-in](#google-play-upload-sign-in)
diagram shows each service an upload passes through. If an upload fails, the job
names the step, and
[Reading the result](operations/native-builds.md#reading-the-result) says what to check.

> [!CAUTION]
> **Never add a credit card or billing account to Google Cloud**, and never start its
> free trial, which asks for a card. The church will never need Google Cloud's paid
> services and shouldn't use them: the risk of a surprise bill is too high. If a
> screen asks for billing to continue, stop and ask the other administrators.

## Website: app.nyccsda.org

`app.nyccsda.org` is served by GitHub Pages from this repository. Cloudflare DNS
points the subdomain there. It has two real jobs:

- **Privacy policy** at `app.nyccsda.org/privacy-policy.html`, which both app stores
  require for the listings.
- **App download page** at `app.nyccsda.org/download`. The printed bulletin's app QR
  code will point here, and the page sends each phone to the right store link.
  Planned in [#237](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/237).

The same Expo source can also be built as a Progressive Web App (PWA), and that
build is what GitHub Pages serves. It is a **developer preview only**. It isn't
supported or tested as a way to use the app, because some mobile features conflict
with running as a PWA, so it doesn't appear as a client in the diagrams. Members use
the native iOS and Android apps.

## Third-party APIs and websites

The apps use these outside services without an account. "In app" means the app
downloads data from the service; "Link" means the app only opens the site in the
browser. The [external dependency monitor](operations/external-dependency-monitor.md)
checks nearly all of them daily.

| Area | Provider | Host | Used for | How |
| --- | --- | --- | --- | --- |
| Bible | HelloAO | `bible.helloao.org` | Bible text and translation list | In app |
| Bible | fetch(bible) | `v1.fetch.bible` | Original-language critical texts | In app |
| Bible audio | Adventist Connect | `assets.adventistconnect.org` | The church's copy of the CUV audio, tried first | In app |
| Bible audio | Internet Archive | `archive.org` | CUV audio, second source | In app |
| Bible audio | Audio Power | `theaudiopower.com` | CUV audio, third source | In app |
| Bulletin | Church Apps Script | `script.google.com` | Digital bulletin JSON | In app |
| Sabbath School | Adventech | `sabbath-school.adventech.io` | Children's lesson catalogs and PDFs (API); adult lessons (reader) | In app and link |
| Sabbath School | Alive in Jesus | `aliveinjesus.info` | Children's age-group websites, opened when this week's lesson isn't found; Babies resources | Link |
| Library | Chinese Union Mission | `api.sdabible.org`, `cms.sdabible.site` | Cover thumbnails for the Chinese Ellen G. White editions (the books open on EGW Writings) | In app |
| Library | EGW Writings | `a.egwwritings.org`, `text.egwwritings.org` | Book covers (in app); reading (link) | In app and link |
| Library | Project Gutenberg | `gutenberg.org` | Public-domain Christian classics | Link |
| Hymns | zgaxr | `m.zgaxr.com` | Chinese 505, 506, and 707 hymnal sheet music | Link |
| Hymns | Hymns for Worship | `hymnsforworship.org` | English SDA Hymnal (1985) sheet music | Link |
| Hymns | Chinese Union Mission | App Store, Google Play | 506 hymnal app store pages | Link |
| Hymns | YouTube | `youtube.com` | 506 hymnal recordings from Chinese Hope TV's playlist | Link |
| Printed bulletin | Sunrise-Sunset API | `api.sunrise-sunset.org` | Sunset times on the printed Queens bulletin (Apps Script only; the app calculates its own) | Apps Script |
| Media | YouTube | `youtube.com` | Livestream and sermon archive | Link |
| Media | Spotify | `open.spotify.com` | Sermon and class audio archive | Link |
| Media | Zoom | `zoom.us` | Online class | Link |
| Giving | AdventistGiving | `adventistgiving.org` | Online giving | Link |
| Church | GNYC, Atlantic Union, adventist.org | `gnyc.org`, `atlantic-union.org`, `adventist.org` | Conference, union, and beliefs pages | Link |

Only the CUV Bible audio has copies the church controls, because its owner allowed
self-hosting. For everything else, the feature stops working if the provider goes
away. Licensing for these sources is recorded in [Legal, Licensing & Privacy](LEGAL.md).
Costs, published limits, and load for each one are in
[Service Limits and Costs](operations/service-limits-and-costs.md).

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

## Payment methods

**Cloudflare is the only service with a card on file**, and only to renew the domain.
Nothing else in this architecture has a payment method, so nothing else can charge
the church. Keep it that way: when a new service asks for a card, choose another
service. Anything else in the Cloudflare account, such as the Cantonese audio Worker
(#241), must stay on a free plan that fails at its limits instead of billing.

| Service | Payment method | Why |
| --- | --- | --- |
| Cloudflare | **A card** | Renews `nyccsda.org`, about $10 a year. The Cantonese audio Worker runs in the same account on Workers Free, which can't bill. See [keeping the card safe](operations/admin-runbook.md#the-cloudflare-account-and-domain). |
| Apple Developer | None | The $99 yearly fee is waived for nonprofits. |
| Google Play | None | The one-time $25 registration is paid; nothing recurs. |
| Google Cloud | None, and no billing account | See [Google Cloud: free only](#google-cloud-free-only). |
| Google Workspace | None | Workspace for Nonprofits: email, Drive, and Apps Script. |
| GitHub | None | Free for public repositories, Actions included. |
| Every API and website in [Third-party APIs and websites](#third-party-apis-and-websites) | None | Free, with no account or with a free key. |

## Upkeep calendar

| When | What | If missed |
| --- | --- | --- |
| Yearly (GitHub opens an issue 60 days ahead) | Renew the Apple Developer membership and resubmit nonprofit status | App removed from the App Store |
| Yearly (GitHub opens an issue 60 days ahead) | Renew the Apple Distribution certificate and provisioning profile, update GitHub secrets, and record the new dates; see the [renewal checklist](operations/app-store-setup.md#renewal-checklist) | iOS builds fail; app can't be updated |
| Yearly | Check the Cloudflare payment method hasn't expired and the domain's paid-through date | Domain renewal fails |
| Yearly | Confirm the Google Cloud project for Play uploads (`sda-church-app-play`) still has no billing account | A billing account added by mistake would let Google charge the church |
| Yearly, and whenever an administrator joins or leaves | Review administrator access and recovery details on every system, including the GitHub alert assignees (`APPLE_SIGNING_ALERT_ASSIGNEES`, `MONITOR_ALERT_ASSIGNEES`) | An account can't be recovered, or reminders go to someone who left |
| Daily (automated) | External dependency monitor | Opens an issue; see the runbook |

## Governance principles

- **Apply for nonprofit status** wherever a provider offers it, using the church's
  own EIN and D-U-N-S number rather than the conference's.
- **Free services only**, apart from small necessities such as the domain. **Never
  add a payment method to a service that bills by usage**, such as
  [Google Cloud](#google-cloud-free-only): a surprise bill is too great a risk.
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
