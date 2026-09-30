# Admin runbook

Step-by-step instructions for the tasks a maintainer does by hand, mostly in the
GitHub and Google web interfaces. Each section says where to click, who can do it,
and what to check afterwards. Deeper background lives in the linked operations docs;
this page is the checklist.

Add a section here whenever a new manual workflow or admin-only web task appears.
If a task is later automated, keep its section and describe what the automation now
does and what still needs a person.

## Contents

- [Who can do what](#who-can-do-what)
- [Branch rules](#branch-rules)
- [Approving a production deployment](#approving-a-production-deployment)
- [Shipping a release to `main`](#shipping-a-release-to-main)
- [Bulletin QR codes](#bulletin-qr-codes)
- [Deploying the bulletin Apps Script](#deploying-the-bulletin-apps-script)
- [The app website (`app.nyccsda.org`)](#the-app-website-appnyccsdaorg)
- [The Cloudflare account and domain](#the-cloudflare-account-and-domain)
- [Yearly checkup](#yearly-checkup)
- [Native app binaries](#native-app-binaries)
- [Android PR preview APKs](#android-pr-preview-apks)
- [iOS PR preview builds](#ios-pr-preview-builds)
- [Dependabot pull requests](#dependabot-pull-requests)
- [External dependency monitor alerts](#external-dependency-monitor-alerts)
- [Store toolchain monitor alerts](#store-toolchain-monitor-alerts)
- [Apple signing reminders](#apple-signing-reminders)
- [Bible audio emulator test](#bible-audio-emulator-test)
- [Credentials that need attention](#credentials-that-need-attention)
- [Actions event policy for `pull_request_target`](#actions-event-policy-for-pull_request_target)

## Who can do what

| Role | Who | Can |
| --- | --- | --- |
| Repository admin | Organization and repository admins | Run manual workflows, create `release/*` branches, merge to `main` (the ruleset lets admins merge without a second approval) |
| `release-approvers` team | Members of the GitHub team | Approve jobs that use the `production` Environment |
| Contributor | Anyone with a fork | Open pull requests into a `release/*` branch |

The `production` Environment holds every credential: Google (`CLASPRC_JSON`), Apple
signing, and Android signing. It only accepts runs from `main` and `release/**`, and
each run waits for a `release-approvers` member to approve it. Admins can also bypass
that approval. To require approval even from admins, turn off **Allow administrators
to bypass configured protection rules** under **Settings → Environments →
production**.

### Getting notified only when action is needed

Each kind of item that needs a person reaches a maintainer as follows:

| Needs action | How it reaches you |
| --- | --- |
| A pull request to review | Watch the repository with **Watch → Custom → Pull requests** (and **Issues** for new issues). With **No additional events**, that emails each new PR or issue but not its comments or pushes. |
| A production deploy to approve | The `production` Environment waits for a `release-approvers` member. |
| An Apple renewal reminder | The **Apple Signing Monitor** issue is assigned to the usernames in `APPLE_SIGNING_ALERT_ASSIGNEES`, falling back to `MONITOR_ALERT_ASSIGNEES`. |
| A monitor alert (external dependencies, store toolchain) | The alert issue is assigned to the usernames in the `MONITOR_ALERT_ASSIGNEES` Actions variable (comma-separated) under **Settings → Secrets and variables → Actions → Variables**. If it is empty, the alert @mentions whoever triggered the run. Both monitors share this handling in `scripts/monitor-alert-issue.cjs`, covered by `test/monitor-alert-issue.test.ts`. |

The monitors can't read `release-approvers` membership or reliably @mention the
team: they run with the built-in Actions token, which has no organization
permissions. That's why alerts use `MONITOR_ALERT_ASSIGNEES` instead. When the team's
members change, update the variable to match. An assignee must have access to the
repository, directly or through a team.

To also send these emails to `technology@nyccsda.org`, one admin adds that address
to their GitHub account (**Settings → Emails**; the group forwards the verification
email) and, under **Settings → Notifications → Custom routing**, sends this
organization's notifications to it. An address can belong to only one GitHub account.

With that in place, a maintainer can keep email for **Watching** and **Participating,
@mentions and custom**, and choose **No additional events** under **Customize email
updates**. Email then arrives for new PRs and issues in watched repositories, deploy
approvals, assignments, and @mentions, but not for comments, pushes, or reviews.

## Branch rules

The rules are rulesets under **Settings → Rules → Rulesets**. Update this section
whenever you change them.

| Ruleset | Applies to | Enforces | Can bypass |
| --- | --- | --- | --- |
| **Deletion Protection** | `main`, `gh-pages` | No deleting the branch and no force-pushes | Nobody |
| **Main protection** | `main` | No deleting or force-pushing, linear history, and changes only through a pull request that meets the review rules below; the checks marked for `main` must pass | Organization admins, through a pull request |
| **PR approval** | `main` and `release/*` | Changes only through a pull request that meets the review rules below, with every review thread resolved; the checks marked for both must pass | Organization and repository admins, through a pull request |

Review rules for both pull-request rulesets:
- One approval is required.
- A new push dismisses earlier approvals, and the last push must be approved by someone
  other than the person who pushed it.
- Only squash merges are allowed.
- Required checks must pass on a branch that is up to date with its target.

### Required checks

| Check | Comes from | Required on |
| --- | --- | --- |
| `Jest unit tests` | `pr-tests.yml` | `main` and `release/*` |
| `verify-bulletin-api` | `bulletin-integration.yml` | `main` |
| `validate-pr` | `release-validation.yml` | `main` and `release/*` |
| `require-linked-issue` | `pr-linked-issue.yml` | `main` and `release/*` |
| `enforce-version` | `pr-check.yml` | `main` |
| `sync` | `release-validation.yml` | `main` |
| `ensure_pr_to_main_from_release_branch` | `main-release-source-gate.yml` | `main` |
| `CodeQL`, `Analyze (actions)`, `Analyze (javascript-typescript)` | GitHub code scanning default setup (no workflow file) | `main` |
| `Build Android debug APK (ARM)` | `android-pr-preview.yml` | `main` |
| `Bible audio on an Android emulator` | `android-audio-e2e.yml` | `main` |
| `Build iOS Simulator app (Apple Silicon Mac)`, `Build iOS Simulator app (Intel Mac)` | `ios-pr-preview.yml` | `main` |
| `Screenshots reviewed` | `screenshot-review.yml`: passes once someone checks the screenshots the iOS preview posts in a comment, then adds the **screenshots reviewed** label or replies 👍 or **screenshots LGTM** (`screenshot-approval.yml`); see [iOS PR preview](native-builds.md#ios-pr-preview-unsigned-simulator-builds) | `main` (add it to **Main protection** once the workflow is on `main`) |

A skipped check counts as passed; for example, `sync` usually shows as skipped.

The slow checks (`verify-bulletin-api`, the Android and iOS builds, and the Bible audio
test) run once per release, on the release pull request into `main`. Feature pull
requests into a release branch run only the quick checks. Any other pull request into
`main`, such as Dependabot's, skips the slow checks, because the source gate stops it
from merging there anyway.

### Changing a required check

- **Add a check only after its workflow is on the branch it guards.** Otherwise pull
  requests wait for a check that never runs. For a check required on `main`, the
  workflow must first be in the open `release/*` branch, because that branch is the head
  of the release PR.
- **A check's name is its job's `name`,** or the job ID when there is no name. A matrix
  job's name includes the matrix values, such as `Build iOS Simulator app (Intel Mac)`.
- **Renaming or removing a job needs a matching ruleset change** in the same release;
  otherwise merges block on the old name.
- **`android-pr-preview.yml` runs from `main`'s copy of the workflow**, because it uses
  `pull_request_target`. A release PR reports the job name `main` has, so after
  renaming that job, keep the old name required until the release with the rename
  reaches `main`, then swap it. Workflows triggered by `pull_request`, such as
  `ios-pr-preview.yml`, report the release branch's names right away.

## Approving a production deployment

Any job that needs credentials pauses with the status **Waiting**.

1. Open the run from **Actions**, or from the notification email.
2. Select **Review deployments**, tick **production**, and select **Approve and
   deploy**.
3. Check what triggered the run and from which branch before approving. Reject a run
   you didn't expect.

The jobs that upload to TestFlight and Google Play internal testing use the separate
`store-upload` environment, which needs no approval, so they run as soon as the builds
you approved finish. Why it's separate is in
[How the credentials are kept apart](native-builds.md#how-the-credentials-are-kept-apart).

## Shipping a release to `main`

The full process is in [Contributing](../CONTRIBUTING.md#two-stage-release-process).
The admin-only steps are:

1. **Create the release branch** from `main`: **Code → branch menu → View all
   branches → New branch**, named `release/x.y.z` (for example `release/0.39.0`).
2. **Merge feature pull requests** into that branch. Their titles must start with
   `Release/x.y.z:` or `Release/x.y.x:`.
3. **Open the release pull request** from `release/x.y.z` into `main`, titled
   `Release/x.y.z: …`. Write the part after the colon for testers: it becomes the
   "What's new" text in Google Play internal testing. Copy the `Closes #…` lines from the included feature pull
   requests into its description. Use `Part of #…` or `Related to #…` for issues
   that should stay open. The **PR Linked Issue** check fails if the description has neither.
4. **Merge it.** The version files must already say `x.y.z`
   (`npm run sync-version -- --version x.y.z` in the release branch), and it must be
   higher than `main`'s version. The store build numbers are computed from it; see
   [Version numbers](version-numbers.md).

What runs after the merge to `main`:

| Workflow | Automatic? | What you do |
| --- | --- | --- |
| Deploy Website and Tag | Yes | Nothing. It tags `vx.y.z` and publishes [the app website](#the-app-website-appnyccsdaorg). |
| Native Android build | Waits for `production` approval | Approve it to build the signed AAB and APK, upload the AAB to Google Play internal testing, and publish a GitHub Release. See [Native app binaries](#native-app-binaries). |
| Native iOS build | Waits for `production` approval | Approve it to build the signed IPA and upload it to TestFlight. |

Workflows that run from `main`'s copy (Android PR preview, and the upload step of the
QR workflow) keep their old behavior until the release that changes them is merged.
A failure on a release pull request caused by a bug the release itself fixes is
expected.

## Bulletin QR codes

**Workflow:** Actions → **Generate physical bulletin QR codes**
(`.github/workflows/generate-physical-bulletin-qr.yml`).

The QR codes and where they point are listed in
[`scripts/bulletin-qr-codes.json`](../../scripts/bulletin-qr-codes.json):

| File | Destination |
| --- | --- |
| `queens_adventist_giving_qr_code_368x368.jpg` | Queens AdventistGiving page |
| `brooklyn_adventist_giving_qr_code_368x368.jpg` | Brooklyn AdventistGiving page |
| `mobile_app_qr_code_368x368.jpg` | `https://app.nyccsda.org/download`, which sends phones to their app store |

The app code uses the church's own `app.nyccsda.org` address, never the GitHub Pages
address it redirects to, so printed codes keep working if the website moves.

**To change a destination,** edit that file in a pull request. The workflow runs by
itself when a change to the file, to `scripts/generate-qr.mjs`, or to the workflow
reaches `main`, so a changed URL can't be forgotten. It also runs from **Run
workflow** at any time. Either way it overwrites the QR images the printed bulletin
uses, and nothing reaches Drive until someone approves:

1. For a manual run, select **Run workflow** and choose **`main`** under *Use
   workflow from*. The upload step always runs the upload script from `main`, so
   running from a release branch only tests image generation.
2. Approve the `production` deployment when the upload job starts. Leaving it
   unapproved is safe: the run expires without changing Drive.
3. Open the **Upload QR codes to Google Drive** log and check:
   - `Google Drive scopes: …`. The login currently has `drive.file` (change only
     files it created) and `drive.metadata.readonly` (see all files). If the upload
     fails with `403 … has not granted the app … write access to the file`, the file
     was uploaded by hand. Rename that file in Drive (for example, add
     `_manual_backup` before `.jpg`) and run the workflow again. The workflow then
     creates the file and can replace it on later runs. Rename rather than trash:
     the bulletin script picks the first file with a matching name anywhere in Drive
     and doesn't skip trashed files. See
     [Credentials](#credentials-that-need-attention).
   - `Replaced …` or `Uploaded …` for each file in the table. **Replaced** keeps the
     existing Drive file, its ID, and its sharing link.
4. The next printed bulletin you generate picks the images up from Drive by name.

The images are also saved as the run's **bulletin-qr-codes** artifact for 90 days.

**What the upload script may write.** `scripts/upload-google-drive.mjs` only uploads
`.apk`, `.aab`, and `.ipa` files and these QR codes:

- `brooklyn_adventist_giving_qr_code_368x368.jpg`
- `queens_adventist_giving_qr_code_368x368.jpg`
- `brooklyn_zelle_qr_code_368x368.jpg`
- `queens_zelle_qr_code_368x368.jpg`
- `mobile_app_qr_code_368x368.jpg`

It refuses every other name, so bulletin files such as the logo, artwork, and the
Sabbath Encouragement PDF can't be overwritten. To upload a new file, add its exact
name to the allowlist in a reviewed pull request.

Which QR slots print is controlled in the bulletin script; see
[Giving QR slots](bulletin-automation.md#giving-qr-slots). The mobile app code is
generated, but its slot stays reserved until the app is public in both stores (#323).
The Zelle codes are still made by hand. Both are tracked in #237.

## Deploying the bulletin Apps Script

**Workflow:** Actions → **Deploy Bulletin Apps Script**
(`.github/workflows/apps-script-deploy.yml`). Manual only.

1. Merge the Apps Script change first. Run from `main` for production, or from a
   `release/*` branch to try it out before the release.
2. Select **Run workflow**, pick the branch, and optionally enter a description
   (shown in the Apps Script version history).
3. Approve the `production` deployment.
4. Follow the checks in
   [Deployment and verification](bulletin-automation.md#deployment-and-verification):
   reload the spreadsheet, generate a test bulletin for each changed layout, and check
   the Doc, the PDF, and the public `/exec` response.

The workflow updates the existing web app deployment, so the URL the mobile app uses
doesn't change. Never create a new deployment just to publish code.

## The app website (`app.nyccsda.org`)

**Treat the website as production.** The App Store and Google Play listings link to its
privacy policy and support pages, and printed QR codes point at its download page. If
one of them breaks, a store can reject an update or delist the app, and printed QR codes
stop working.

| Address | File in the repository | Used by |
| --- | --- | --- |
| `https://app.nyccsda.org/privacy-policy.html` | `public/privacy-policy.html` | Both store listings |
| `https://app.nyccsda.org/support.html` | `public/support.html` | The App Store's Support URL |
| `https://app.nyccsda.org/download` | `public/download.html` | QR codes and download links (#237) |
| `https://app.nyccsda.org/library/sabbath_encouragement.pdf` | `public/library/sabbath_encouragement.pdf` | The app's Library |
| `https://app.nyccsda.org/` | The browser build of the app | Testing and demos; not an officially supported product |

**How it's published:** every merge to `main` runs **Deploy Website and Tag**, which
builds the website and pushes it to the `gh-pages` branch. GitHub Pages serves it at
`https://new-york-chinese-seventh-day-adventist.github.io/sda-church-app/`. The
**Deletion Protection** ruleset keeps `gh-pages` from being deleted. Files in `public/`
are copied as they are.

**How the address works:** a Cloudflare redirect rule sends `app.nyccsda.org` to that
GitHub Pages address with a permanent (301) redirect, keeping the path and any query.
So `app.nyccsda.org/download?stay` becomes `…/sda-church-app/download?stay`. Both stores
accept a redirect. Two similar addresses are not the app website:

- `nyccsda.org` is the church's main website, which forwards to adventistchurch.org, so
  `nyccsda.org/sda-church-app/…` and `nyccsda.org/privacy-policy.html` don't work.
- `www.nyccsda.org` currently returns 403. It should forward like `nyccsda.org` does.

**Rules:**

- **Keep these pages as static HTML in `public/`,** not as app screens. App screens, such
  as `/you/privacy`, are blank until JavaScript runs, and the stores' checkers may not
  run it.
- **Never rename or remove them.** The store listings and printed QR codes point at
  them. Add new pages beside them instead.
- **Keep them independent of the browser build of the app,** so changing or retiring it
  can't break them.
- **Watch the daily External Dependency Monitor.** It checks the privacy, support, and
  download pages through `app.nyccsda.org` and opens an alert issue if one fails; see
  [External dependency monitor alerts](#external-dependency-monitor-alerts).

**Later:** opening the app straight from a link, with Android App Links and iOS Universal
Links, needs `app.nyccsda.org` to serve the site itself instead of redirecting, because
Apple doesn't follow redirects for the file that enables it. That means setting
`app.nyccsda.org` as the GitHub Pages custom domain, pointing a Cloudflare CNAME at
`new-york-chinese-seventh-day-adventist.github.io` in place of the redirect rule, and
changing the web build's base path from `/sda-church-app` to `/`.

## The Cloudflare account and domain

`nyccsda.org` is registered through Cloudflare Registrar, and Cloudflare also runs its
DNS and the `app.nyccsda.org` redirect. The renewal, about $10 a year, is the app's only
recurring cost, so the account keeps a card on file. If a renewal fails and the domain
lapses, the privacy policy, support, and download pages above go down with it.

**Make the card safe to leave on file:**

- **Use a credit card, not a debit card,** so a wrong or unauthorized charge can be
  disputed with the bank before any church money leaves the account.
- **Better still, use a virtual card number** locked to Cloudflare with a yearly limit a
  little above the renewal, such as $15. Anything larger is declined.
- **Turn on the bank's alert for every charge,** so anything other than the yearly
  renewal is noticed right away.
- **Keep the card current and auto-renew on.** Don't remove the card: the domain
  depends on it.
- **Add nothing else that can cost money:** no Workers Paid, R2, or other paid or
  pay-as-you-go product
  ([#261](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/261)).
  Free plans have no overage charges: going over a limit makes requests fail. Nothing
  but the domain and its DNS runs in this account today. A Cloudflare Worker to hold an
  API key was designed and put on hold
  ([#241](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/241));
  if one is ever added, it must stay on Workers Free.

**Keep the account recoverable:**

- **Every administrator is a super administrator,** as on every system, so losing one
  login doesn't lock the church out. The card limit above keeps that safe: even a
  stolen login can't run up charges.
- **Every administrator uses two-factor login** with an authenticator app, passkey, or
  security key, not text messages, and keeps their own backup codes somewhere they'd
  still have if their phone died.
- **Use a church address for the account's email,** not a personal one, so renewal
  notices and Cloudflare's policy emails reach whoever runs technology next.

**Once a year**, with the [yearly checkup](#yearly-checkup) issue:

- Each administrator logs in, which proves the backups work. Remove anyone who has left.
- The account's billing page lists only the domain registration.
- The card on file hasn't expired, and auto-renew is on.
- The Free plan still covers everything in the next section.

### Why only the domain costs money

The card pays for one thing: registering `nyccsda.org`. Cloudflare Registrar charges
only what the registry and ICANN charge it, with no markup
([Cloudflare Registrar](https://www.cloudflare.com/products/registrar/)). That's about
$10 a year for a `.org`, or about $100 paid once for ten years. Everything else the church
uses runs on Cloudflare's Free plan, which has no usage charges:

- **DNS** for `nyccsda.org`, including the records for the church's Google Workspace
  email and for Google Search Console;
- **the `app.nyccsda.org` redirect** to the app website on GitHub Pages;
- **the HTTPS certificate** for that address, which Cloudflare issues and renews for
  free ([Universal SSL](https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/));
- **protection from denial-of-service attacks,** unmetered on every plan
  ([DDoS protection](https://developers.cloudflare.com/ddos-protection/)).

**Why Cloudflare gives this away:** free users are worth more to Cloudflare than they
cost. Cloudflare says they:
- expose its network to attacks it learns from;
- try new features first;
- make internet providers more willing to exchange traffic with it for free;
- use capacity that would otherwise sit idle between business peaks.

In 2024 it restated that "our free plan is here to stay"
([Reaffirming our commitment to free](https://blog.cloudflare.com/cloudflares-commitment-to-free/)).

That's a company's promise, not a contract, so the yearly checkup re-reads these pages.
If the Free plan ever stops covering something the church uses, decide before the
change takes effect whether to pay for it or move it elsewhere.

## Yearly checkup

On the first Monday of each January, **Yearly Checkup** (`yearly-checkup.yml`) opens an
issue titled **Yearly checkup, *year***, assigned to the usernames in
`MONITOR_ALERT_ASSIGNEES`. It holds one checklist of everything these docs say to
check once a year, each item linked to the doc that explains it:

- the Cloudflare card, domain renewal, and billing;
- the Google Cloud project's lack of a billing account;
- administrator access and two-factor login on every system;
- the Faith Comes By Hearing key, kept in the IT Admin shared drive;
- the Apple dates and Google Play's contact details and declarations;
- the Workspace nonprofit terms;
- the scheduled workflows.

Work through it, note anything that changed in a comment, and close it. It runs every
Monday in January, but only the first opens an issue; the others find it and stop.
Start it by hand from the Actions tab to open one early.

The Apple renewals have their own reminder, 60 days before each date; see
[Apple signing reminders](#apple-signing-reminders). To add a yearly task, add it to
`scripts/yearly-checkup.cjs` and to the
[upkeep calendar](../architecture.md#upkeep-calendar);
`test/yearly-checkup.test.ts` checks that every link in the checklist still works.

## Native app binaries

Background, signing setup, and recovery are in [Build Instructions](native-builds.md).

### Building

- **Automatic:** every merge to `main` starts **Native Android build** and **Native
  iOS build**. Approve both `production` deployments.
- **Manual:** Actions → **Native Android build** → **Run workflow** on `main`, then
  tick **AAB** (Google Play) and/or **APK** (direct install). Actions → **Native iOS
  build** → **Run workflow** on `main`. Both refuse to sign from any other branch.

There are no build numbers to raise. Both stores' build numbers are computed from the
version (`0.40.0` becomes `40000`); see [Version numbers](version-numbers.md).

### Downloading

| Binary | Where to find it | Kept for |
| --- | --- | --- |
| Android AAB and APK, and iOS IPA, from a merge to `main` | **Releases → vx.y.z**, attached to the GitHub Release | Permanently |
| Android AAB or APK from a manual run | The run's **Artifacts** (`native-android-…`) | 14 days |
| iOS IPA from a manual run | The **Native iOS build** run's **Artifacts** (`native-ios-…`) | 90 days |

Either native workflow can finish first; whichever does creates the release, and the
other adds its files. Neither replaces a file the release already has. The IPA installs
only through TestFlight or the App Store; it's kept there as an archive, for example to
upload by hand with Transporter if **Upload to TestFlight** fails.

### Uploading to the stores

After you approve the signed builds, they upload for testing on their own: the IPA to
TestFlight and the AAB to Google Play internal testing. Nothing reaches the public
until you release it:

1. **Test** the build on real devices, from TestFlight and from the Play Store's
   internal testing link.
2. **Check the store pages still fit the release:**
   - If it changes what the app does, such as analytics, notifications, a form, or
     location, update the declarations first. Each store's answers doc has a **When to
     revisit** table: [App Store](app-store-connect-answers.md#when-to-revisit) and
     [Google Play](play-console-answers.md#when-to-revisit).
   - If it changes how the app looks, retake the screenshots, and replace the copies in
     [`docs/store-assets/`](../store-assets/README.md).
   - If it adds or removes a feature, update the descriptions in
     [Store listings](store-listing.md) first, then paste them into each store.
3. **Apple:** in App Store Connect, select **+** next to **iOS App** and add the new
   version, such as `0.43.0`. It must match the build's version. The previous version's
   description, keywords, screenshots, URLs, and reviewer notes carry over. Write
   **What's New in This Version** for each language, select the build, and **Add for
   Review**. After approval, release it: the version is set to release manually.
4. **Google Play:** Play Console → **Test and release → Internal testing** → promote
   the release to production. Promoting copies the testers' "What's new" text, so
   rewrite it for the public first, in each language.
5. **Each January:** update the App Store **Copyright** year on the new version.

The upload jobs, their `store-upload` secrets, what each result means, and how to
upload by hand are in
[Automatic store uploads](native-builds.md#automatic-store-uploads).

### Store listings and declarations

What each store shows, and every answer given in its consoles, is kept in the
repository. Change the doc first, then the store, so the two never drift apart.

| What | Where |
| --- | --- |
| Name, subtitle, descriptions, keywords, and reviewer notes, in English, Chinese, and Spanish | [Store listings](store-listing.md) |
| Screenshots and the feature graphic | [`docs/store-assets/`](../store-assets/README.md) |
| App Store answers: age rating, privacy, availability, and version page | [App Store Connect answers](app-store-connect-answers.md) |
| Google Play answers: content rating, audience, Data safety, and foreground service | [Google Play Console answers](play-console-answers.md) |
| Why the answers are what they are, and the release blockers | [Store policy audit](store-policy-audit.md) |
| One-time account and app setup | [App Store and Google Play setup](app-store-setup.md) |

### Store toolchain requirements

Google and Apple raise their minimum SDK requirements over time, and a build that
falls behind is rejected at upload. Before each store upload, and whenever either
store announces a change, check that:

- Android's target API level meets the current [Google Play target API
  requirement](https://developer.android.com/google/play/requirements/target-sdk),
  and the compile SDK, build tools, AGP, Gradle, JDK, and NDK still work with the
  pinned Expo/React Native versions. See the [Android platform
  releases](https://developer.android.com/tools/releases/platforms).
- The iOS build uses an Xcode and iOS SDK that App Store Connect currently accepts. See
  the [App Store submission requirements](https://developer.apple.com/app-store/submitting/)
  and [Xcode system requirements](https://developer.apple.com/xcode/system-requirements/).
- Any intentional lag behind the newest versions is written down in
  [native-builds.md](native-builds.md).

## Android PR preview APKs

**Workflow:** **Android PR preview**, which runs automatically on release pull requests
into `main` (from a `release/*` branch in this repository).

It builds an unsigned debug APK. After you approve `production`, it uploads the APK
to Google Drive as `sda-church-app-pr-<number>-<run>-arm-debug.apk`, and the run
summary links to it. Fork pull requests are skipped. See
[Android PR preview and Drive upload](native-builds.md#android-pr-preview-and-drive-upload).

## iOS PR preview builds

**Workflow:** **iOS PR preview**, which runs automatically on release pull requests
into `main`, and can be run manually on any branch.

It builds the app without signing for an Apple Silicon Mac and an Intel Mac, launches it
on a simulated iPhone, and uploads the app and a screenshot of its first screen. It
needs no approval, because it reads no secrets. Download the build for your Mac from the
run's Artifacts section to test the release on a Mac before merging; you don't need an
iPhone. See [iOS PR preview](native-builds.md#ios-pr-preview-unsigned-simulator-builds).

## Dependabot pull requests

Dependabot opens one pull request a week for all minor and patch updates, and a
separate one for each major update (`.github/dependabot.yml`). It opens them against
`main`, and they fail the `main` checks by design: **Main Release Source Gate**, **PR
Version Check**, and **Release - PR Version Sync**. Don't merge them into `main`. For
each one:

1. Select **Edit** next to the title and change the base branch to the current
   `release/x.y.z`.
2. Add `Release/x.y.z: ` to the start of the title.
3. Comment `@dependabot rebase` so the branch is rebuilt on the release branch and the
   checks run again.

Or copy the `package.json` and `package-lock.json` changes from several of them into
one pull request into the release branch, and close the Dependabot pull requests with a
link to it.

While a Dependabot pull request still targets `main`, it runs only the quick checks.
The slow builds and tests run on the release pull request that includes the update.

When Dependabot reports `security_update_not_possible`, there's no fix Dependabot can
apply yet, usually because another package pins the old version. Recheck after that
package updates.

### Bundled copy of decode-uri-component

Expo Router's `query-string` 7 uses `decode-uri-component` 0.2.2, which slows to a
crawl on malformed percent-encoding in a URL
([GHSA-vcc3-ghjq-m6fr](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr)). The fix,
0.5.0, ships only as an ES module, which `query-string` 7 can't load. So
[`vendor/decode-uri-component`](../../vendor/decode-uri-component) holds 0.5.0
converted to CommonJS, unchanged otherwise and under its MIT license. `package.json`
installs it as a dependency, and its `overrides` entry
(`"decode-uri-component": "$decode-uri-component"`) makes every package use it.
`test/decode-uri-component.test.ts` checks that `query-string` loads it and that the
lockfile holds no other copy.

Remove the folder, the dependency, and the override once Expo Router depends on a
`query-string` that uses `decode-uri-component` 0.5.0 or later (`query-string` 8 and
up). Check with `npm view expo-router@next dependencies.query-string`.

## External dependency monitor alerts

**Workflow:** **External Dependency Monitor**, which runs daily and can be run
manually.

It opens or updates an issue when an outside service the app depends on fails, and
closes the issue when the service recovers. A new alert is assigned to the users in
`MONITOR_ALERT_ASSIGNEES`; see
[Getting notified only when action is needed](#getting-notified-only-when-action-is-needed). See
[External dependency monitor](external-dependency-monitor.md).

## Store toolchain monitor alerts

**Workflow:** **Store Toolchain Monitor**, which runs every Monday and can be run
manually.

It reads Google Play's [target API
requirement](https://developer.android.com/google/play/requirements/target-sdk) and
Apple's [upcoming requirements](https://developer.apple.com/news/upcoming-requirements/)
and compares them with the app:

- `targetSdkVersion` in `app.json` (the `expo-build-properties` plugin), and
- the Xcode version selected in `.github/workflows/native-ios-build.yml`.

It opens or updates the issue **[monitor] Store toolchain requirements need
attention** in three cases:

- the app is below a requirement already in force;
- a new requirement starts within 120 days; or
- it can no longer read either page, which usually means the wording changed. Then
  check the page by hand and update the patterns in
  `scripts/check-store-toolchain.cjs`.

When the app is below a requirement or one starts within 120 days, the issue is
labeled **critical / launch blocking**. An unreadable page alone does not add the
label, because it usually means the page wording changed, not that uploads will be
rejected.

A new alert is assigned to the users in `MONITOR_ALERT_ASSIGNEES`; see
[Getting notified only when action is needed](#getting-notified-only-when-action-is-needed).
The issue closes itself on the next passing run. The job summary also notes when
Apple recommends a newer Xcode than the build uses; that note alone does not open an
issue. What to update and test is under
[Store toolchain requirements](#store-toolchain-requirements).

## Apple signing reminders

**Workflow:** **Apple Signing Monitor**, which runs every Monday and can be run
manually.

It reads the expiry dates of the Apple Distribution certificate, the App Store
provisioning profile, and the Apple Developer membership from
`.github/apple-signing-expiry.json`. It opens or updates the issue **[monitor] Apple
signing needs renewal** when:

- a date is 60 days away or less;
- a date has passed; or
- a date isn't recorded.

The issue includes the renewal steps. It's assigned to the usernames in the
`APPLE_SIGNING_ALERT_ASSIGNEES` Actions variable (comma-separated), or to
`MONITOR_ALERT_ASSIGNEES` if that variable is empty. When the maintainers who handle
Apple renewals change, update the variable under **Settings → Secrets and variables →
Actions → Variables**. The issue
comments weekly until the dates are updated and closes itself on the first run after
every date is more than 60 days away. It reads no Apple credentials, and it shows only
dates, which are safe in a public issue.

The issue shows GitHub usernames, not people's names. GitHub can only notify GitHub
accounts, not an email address such as `technology@nyccsda.org`, and the monitor's
built-in Actions token can't mention the `release-approvers` team. A shared GitHub
account for the group isn't an option either: GitHub's terms allow each login to be
used by one person only. So:

- **When a maintainer joins or leaves,** update `APPLE_SIGNING_ALERT_ASSIGNEES` and
  `MONITOR_ALERT_ASSIGNEES` right away. If any listed user has lost access to the
  repository, GitHub rejects the whole assignment: the issue is still opened, but
  unassigned, and it @mentions the run's actor instead, which for a scheduled run is
  whoever last changed the workflow's schedule.
- **Apple also emails renewal notices** to the Account Holder, the
  `technology@nyccsda.org` group, so the group hears about renewals even if the
  variables are out of date.
- To also send the GitHub emails to the group, see
  [Getting notified only when action is needed](#getting-notified-only-when-action-is-needed).

Each signed iOS build also runs **Check the recorded Apple signing dates**, which
compares the file with the provisioning profile inside the IPA it just built and warns
when they differ, for example after a renewal that didn't update the file.

To renew, follow the
[renewal checklist](app-store-setup.md#renewal-checklist).

## Bible audio emulator test

**Workflow:** **Android audio e2e**. It runs on every release pull request into
`main`, and it can be run manually. **It's a required check on `main`**,
so a release can't merge until it passes. Feature pull requests into a release branch
don't run it; to test an audio change before the release, run it manually on your
branch.

It takes about 20 minutes, and runs alongside the iOS Simulator builds, which
take longer.

It builds the debug APK, boots an Android emulator on the runner, and plays real
Bible chapters to check what only a real player shows:

- **Primary host down:** a local DNS server on the runner makes
  `assets.adventistconnect.org` unreachable, and Genesis 1 must play from the
  Internet Archive.
- **Next chapter with the screen off:** Psalm 117 moves on to Psalm 118 by itself,
  the screen stays off, and the media foreground service stays up.
- **Dead zone with the screen off:** Play offline, wait 90 seconds, then reconnect.
  Audio must start without an unlock.
- **Mid-chapter loss:** go offline and seek past what has loaded. The same host
  reloads where it stopped, and playback resumes there.
- **Pause and resume** from the same place.

The failover logic itself is tested on every pull request by
`test/bible-audio-source-controller.test.ts`.

It has no nightly run. The app code it tests only changes through a release pull
request, and the [external dependency monitor](#external-dependency-monitor-alerts)
already checks every audio host daily, which is what could break between releases.

When it fails on a release pull request:

1. Open the run. The log shows which scenario failed and why.
2. Download the `android-audio-e2e-*` artifact. For each failed scenario it has a
   screenshot, the app's log, and the media session, whose title names the host
   that was playing, plus the emulator and DNS logs.
3. The test plays real recordings, so check the
   [external dependency monitor](#external-dependency-monitor-alerts) first. A host
   outage fails it too, and isn't an app bug. A one-off emulator hiccup clears on a
   rerun.
4. If it blocks a release PR because of a host outage, rerun it once the host is
   back. If the release can't wait, an admin can bypass this one check when merging,
   after confirming that the failure is the outage and not the app.

**To run it on your own emulator**, install a debug APK
(`npm run build:android:apk:debug:intel`) and run
`scripts/e2e/android-bible-audio.sh`. Set `ADB` if `adb` isn't on your path, and
`ADB_ARGS=-e` if a phone is also connected. `E2E_ONLY` runs chosen scenarios, for
example `E2E_ONLY=dead-zone-screen-off`. The primary-host scenario runs only with
`E2E_PRIMARY_BLOCKED=1`, which needs the DNS block the workflow sets up. The script
clears the app's first-launch Welcome dialog, and turns off the device's animations
while it runs (restoring them when it exits), because the screen must be still to be
read.

## Credentials that need attention

| Credential | Where | When to act |
| --- | --- | --- |
| `CLASPRC_JSON` (Google login for Apps Script and Drive uploads) | `production` Environment secret | When clasp authorization fails; see the Workspace session note in [Deployment and verification](bulletin-automation.md#deployment-and-verification). The login has `drive.file` and `drive.metadata.readonly`: it can see every file but can change only files it created. Replacing a hand-made file fails with `403 appNotAuthorizedToFile`; rename the hand-made copy and let the workflow create it. Keep this narrow access rather than granting full `drive` access, because this account can reach every shared drive. |
| Apple distribution certificate and provisioning profile | `production` Environment secrets | Both expire every year, and the Apple fee waiver is reconfirmed at each membership renewal. See [Yearly Apple renewals](app-store-setup.md#yearly-apple-renewals). |
| Android upload keystore | `production` Environment secrets | Only when Google Play requires a rotation. See [Android rotation and recovery policy](native-builds.md#android-rotation-and-recovery-policy). |
| App Store Connect API key (`APP_STORE_CONNECT_API_*`) | `store-upload` Environment secrets | It doesn't expire. If it leaks, revoke it under **Users and Access → Integrations** in App Store Connect, create a new one with the **Developer** role, and replace the three secrets. |
| Card on the Cloudflare account | Cloudflare account billing | Before it expires, since the domain renews automatically. See [The Cloudflare account and domain](#the-cloudflare-account-and-domain). |
| Faith Comes By Hearing Bible Brain API key | The church's IT Admin shared drive, which only certain administrators can open | Not used yet ([#241](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/241)). Never put it in the app, the repository, an issue, a pull request, or a chat. If it may have leaked, ask FCBH for a new one and replace the stored copy. |
| Google Play sign-in (`GOOGLE_PLAY_*`) | `store-upload` Environment secrets | Never: it has no key to renew. Keep the Google Cloud project free of billing, with every administrator as an Owner. See [Google Cloud: free only](../architecture.md#google-cloud-free-only). |

Never paste credentials into issues, pull requests, or workflow logs.

## Actions event policy for `pull_request_target`

From **November 2, 2026**, GitHub blocks the `pull_request_target` trigger in public
repositories unless an Actions event policy allows it
([announcement](https://github.blog/changelog/2026-09-17-workflow-execution-protections-in-github-actions-generally-available/)).
Three workflows use it, and two of them are required checks on `main`, so **without
the policy, no release can merge into `main`**:

| Workflow | Why it uses `pull_request_target` | Required on `main` |
| --- | --- | --- |
| `.github/workflows/main-release-source-gate.yml` | Runs from `main`'s copy, so a pull request can't edit the gate to pass. It checks out no code. | Yes: `ensure_pr_to_main_from_release_branch` |
| `.github/workflows/android-pr-preview.yml` | The Drive upload needs the `production` environment, which only `main` may use. It builds only this repository's `release/*` branches, never fork code. | Yes: `Build Android debug APK (ARM)` |
| `.github/workflows/pending-release-label.yml` | Most pull requests come from forks, whose `pull_request` token can't label issues. It checks out no pull request code. | No |

None of them runs code from a fork with secrets or a write token, which is what makes
`pull_request_target` dangerous (a "pwn request").

**The church's choice: one policy that allows every event for every workflow.** It
works the way GitHub did before November 2, and nobody has to update it when a
workflow changes. The policy only decides which triggers may start a workflow; what
keeps pull request code away from secrets and write access is the workflows
themselves, and tests enforce that:

- `pull_request_target` always runs the workflow as it is on `main`, never the pull
  request's copy, so an outsider can't add or change one. Only a reviewed release PR
  can.
- The gate and the label workflow never check out code. The Android preview builds
  only this repository's `release/*` branches, which only people with write access
  can push, and never a fork's code. Its build job has no secrets, no saved
  credentials, and a read-only token; the upload job, which has the Drive secret,
  runs only `main`'s upload script on the finished APK.
- Pull request text, such as a title, body, or branch name, reaches a script only
  through an environment variable, never pasted into the script, so it can't inject
  commands.
- Only the label workflow can write, and only to issues.
- `test/native-build-safety.test.ts` fails if any of the above changes, if a workflow
  turns off `actions/checkout`'s protection against fork code
  (`allow-unsafe-pr-checkout`), or if any other workflow starts using
  `pull_request_target`, so a new one gets reviewed before it can merge. Before adding
  one to that list, check that it never runs pull request code while it can read
  secrets or write to the repository.
- CodeQL scans the workflows for these mistakes too (**Security → Code scanning**).

GitHub adds its own limits: a `pull_request_target` run can read `main`'s cache but
not write to it, so it can't poison the cache the signing builds use. Elsewhere:

- `pull_request` workflows for a fork's pull request get no secrets and a read-only
  token, and none runs until a maintainer approves it (**Settings → Actions → General
  → Require approval for all external contributors**). That approval doesn't cover
  `pull_request_target`, which is why these three never run fork code.
- The default workflow token is read-only, and workflows can't approve pull requests.
- The store upload secrets are in the `store-upload` environment, which only `main`
  can use.

Keep those settings and the tests.

To set up the policy:

1. **Settings → Actions → Policies → New policy.**
2. **Name** it `Allow all workflow events`.
3. **Enforcement status:** **Active**. (**Evaluate**, a dry run, is only available on
   GitHub Enterprise Cloud.)
4. **Target** all workflows in the repository.
5. **Event rules:** tick every event in the list. There's no "all events" option, and
   an event rule is an allowlist: an unticked event stops every workflow that uses it.
6. On the next release PR, check that every expected check reports. A blocked event
   shows up as a check that never starts. (**Policy insights**, which lists blocked
   runs, needs a paid GitHub plan.) The 0.42.0 release PR (#329) reported all of
   them.

New workflows need no change to the policy. Only if GitHub adds a new kind of event,
and a workflow uses it, does that event need ticking here.

If `ensure_pr_to_main_from_release_branch` or `Build Android debug APK (ARM)` ever stops
reporting on a release PR, check this policy first.

