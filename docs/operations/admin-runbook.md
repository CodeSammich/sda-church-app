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
- [Google Workspace backups](#google-workspace-backups)
- [Native app binaries](#native-app-binaries)
- [Android preview APKs](#android-preview-apks)
- [iOS key screens builds](#ios-key-screens-builds)
- [Dependabot pull requests](#dependabot-pull-requests)
- [External dependency monitor alerts](#external-dependency-monitor-alerts)
- [Store toolchain monitor alerts](#store-toolchain-monitor-alerts)
- [Expo doctor monitor alerts](#expo-doctor-monitor-alerts)
- [Apple signing reminders](#apple-signing-reminders)
- [Due-date reminders](#due-date-reminders)
- [Updating pastors and elders](#updating-pastors-and-elders)
- [Bible audio emulator test](#bible-audio-emulator-test)
- [Credentials that need attention](#credentials-that-need-attention)
- [Actions event policy for `pull_request_target`](#actions-event-policy-for-pull_request_target)

## Who can do what

| Role | Who | Can |
| --- | --- | --- |
| Repository admin | Organization and repository admins | Run manual workflows, create the `release-candidate` branch, merge to `main` (the ruleset lets admins merge without a second approval) |
| `release-approvers` team | Members of the GitHub team | Approve jobs that use the `production` Environment |
| Contributor | Anyone with a fork | Open pull requests into `release-candidate` |

The `production` Environment holds the Google login (`CLASPRC_JSON`) and the Apple and
Android signing credentials; the store upload settings are in the separate `store-upload`
environment (see [Approving a production deployment](#approving-a-production-deployment)).
It only accepts runs from `main` and `release-candidate` (and the retired
`release/**`), and each run waits for a `release-approvers` member to approve it.
Admins can also bypass that approval. To require approval even from admins, turn off
**Allow administrators to bypass configured protection rules** under **Settings →
Environments → production**.

### Getting notified only when action is needed

Each kind of item that needs a person reaches a maintainer as follows:

| Needs action | How it reaches you |
| --- | --- |
| A pull request to review | Watch the repository with **Watch → Custom → Pull requests** (and **Issues** for new issues). With **No additional events**, that emails each new PR or issue but not its comments or pushes. |
| A production deploy to approve | The `production` Environment waits for a `release-approvers` member. |
| An Apple renewal reminder | The **Apple Signing Monitor** issue is assigned to the usernames in `APPLE_SIGNING_ALERT_ASSIGNEES`, falling back to `MONITOR_ALERT_ASSIGNEES`. |
| A monitor alert (external dependencies, store toolchain, Expo doctor) | The alert issue is assigned to the usernames in the `MONITOR_ALERT_ASSIGNEES` Actions variable (comma-separated) under **Settings → Secrets and variables → Actions → Variables**. If it is empty, the alert @mentions whoever triggered the run. The three monitors share this handling in `scripts/monitor-alert-issue.cjs`, covered by `test/monitor-alert-issue.test.ts`. |
| A yearly checkup or Workspace backup issue | The issue is assigned to the `MONITOR_ALERT_ASSIGNEES` users (or, if that is empty, @mentions whoever triggered the run), and its `Due:` line brings the due-date reminders below. |
| An issue coming due | [Due-date reminders](#due-date-reminders) comment on an issue with a `Due:` line 30 and 7 days before the date and once it's overdue, @mentioning the same `MONITOR_ALERT_ASSIGNEES` users (or, if that is empty, whoever triggered the run). |

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
| **PR approval** | `main`, `release-candidate`, and the retired `release/*` | Changes only through a pull request that meets the review rules below, with every review thread resolved; the checks marked for both must pass | Organization and repository admins, through a pull request |

Review rules for both pull-request rulesets:
- One approval is required.
- A new push dismisses earlier approvals, and the last push must be approved by someone
  other than the person who pushed it.
- Only squash merges are allowed.
- Required checks must pass on a branch that is up to date with its target.

### Required checks

| Check | Comes from | Required on |
| --- | --- | --- |
| `Jest unit tests` | `pr-tests.yml` | `main` and `release-candidate` |
| `verify-bulletin-api` | `bulletin-integration.yml` | `main` |
| `validate-pr` | `release-validation.yml` | `main` and `release-candidate` |
| `require-linked-issue` | `pr-linked-issue.yml` | `main` and `release-candidate` |
| `enforce-version` | `pr-check.yml` | `main` |
| `sync` | `release-validation.yml` | `main` |
| `ensure_pr_to_main_from_release_branch` | `main-release-source-gate.yml` | `main` |
| `CodeQL`, `Analyze (actions)`, `Analyze (javascript-typescript)` | GitHub code scanning default setup (no workflow file) | `main` |
| `Build Android debug APK (ARM)` | `android-preview-apk.yml` | `main` |
| `Bible audio on an Android emulator` | `android-audio-e2e.yml` | `main` |
| `iOS key screens join`, which joins the `iOS key screens batch <n> (<group>)` jobs and fails if any of them failed, so they need no entries of their own and a new group needs no ruleset change. Before #372 it was named `Build iOS Simulator app (Apple Silicon Mac)` | `ios-key-screens.yml` | `main` |
| `Android key screens join`, which joins the `Android key screens batch <n> (<group>)` jobs and fails if the build or any of them failed | `android-key-screens.yml` | `main` |
| `Screenshots reviewed` | `ios-key-screens.yml`: waits until someone in **release-approvers** approves the screenshots in the `screenshot-review` environment; see [Approving the screenshots](#approving-the-screenshots) | `main` |

A skipped check counts as passed; for example, `sync` usually shows as skipped.

The slow checks (`verify-bulletin-api`, the Android and iOS builds, and the Bible audio
test) run once per release, on the release pull request into `main`. Feature pull
requests into `release-candidate` run only the quick checks. Any other pull request into
`main`, such as Dependabot's, skips the slow checks, because the source gate stops it
from merging there anyway.

### Changing a required check

- **Add a check only after its workflow is on the branch it guards.** Otherwise pull
  requests wait for a check that never runs. For a check required on `main`, the
  workflow must first be in `release-candidate`, because that branch is the head of the
  release PR.
- **A check's name is its job's `name`,** or the job ID when there is no name. A matrix
  job's name includes the matrix values, such as `iOS key screens batch 2 (bible-reading)`.
- **Renaming or removing a job needs a matching ruleset change** in the same release;
  otherwise merges block on the old name.
- **`android-preview-apk.yml` runs from `main`'s copy of the workflow**, because it uses
  `pull_request_target`. A release PR reports the job name `main` has, so after
  renaming that job, keep the old name required until the release with the rename
  reaches `main`, then swap it. Workflows triggered by `pull_request`, such as
  `ios-key-screens.yml`, report the names in `release-candidate` right away.

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

### Approving the screenshots

The release pull request's **Screenshots reviewed** check waits the same way, in the
`screenshot-review` environment. When the iOS preview's comment shows the screenshots:

1. Download them from the comment and look through `screens/ios/` for what the
   comment lists.
2. Open the run from the comment, select **Review deployments**, tick
   **screenshot-review**, and approve. Reject it if something looks wrong, and say what
   in a comment.

A new push needs a new approval.

**One-time setup** (done once by an admin, under **Settings → Environments → New
environment**):

- **Name:** `screenshot-review`.
- **Required reviewers:** the **release-approvers** team, the same as `production`.
- **Deployment branches and tags:** no restriction. GitHub checks a pull request's run
  against its merge ref (`refs/pull/…/merge`), not `release-candidate`, and the
  environment holds no secrets; the job itself runs only on release pull requests into
  `main`.

If the environment is missing or has no required reviewers, the check fails and says
so, rather than passing unreviewed.

## Shipping a release to `main`

The full process is in [Contributing](../CONTRIBUTING.md#releasing-code-maintainers-only).
The admin-only steps are:

1. **Check that `release-candidate` exists.** **Release - After Merge** creates it from
   `main` after each release merges. If it's missing, create it: **Code → branch menu →
   View all branches → New branch**, named `release-candidate`, from `main`. Then change
   the base of any open feature pull request into `main` back to it.
2. **Merge feature pull requests** into it.
3. **Set the version** once the contents are settled: pick a patch, minor, or major
   version for what the release contains, higher than `main`'s, and merge a pull request
   into `release-candidate` that runs `npm run sync-version -- --version x.y.z`. The store
   build numbers are computed from it; see [Version numbers](version-numbers.md).
4. **Open the release pull request** from `release-candidate` into `main`, titled
   `Release/x.y.z: …` with that version; CI checks the version files match the
   title. Write the part after the colon for testers: it becomes the "What's new" text in Google Play
   internal testing. Copy the `Closes #…` lines from the included feature pull requests
   into its description.
5. **Merge it** once its checks and review pass. **iOS key screens** takes 15 to 25
   minutes, and **Screenshots reviewed** waits until a
   `release-approvers` member [approves the screenshots](#approving-the-screenshots).
   GitHub then deletes `release-candidate` and moves any open feature pull requests
   into it to `main`. **Release - After Merge** creates it again from `main`, moves those
   pull requests back to it, and comments on the release pull request with links to the
   runs below that wait for approval. The comment names any pull request it couldn't
   move; change that one's base to `release-candidate` by hand.

What runs after the merge to `main`:

| Workflow | Automatic? | What you do |
| --- | --- | --- |
| Deploy Website and Tag | Yes | Nothing. It tags `vx.y.z` and publishes [the app website](#the-app-website-appnyccsdaorg). |
| Release - After Merge | Yes | Nothing, unless its comment on the release pull request says `release-candidate` couldn't be created or a pull request couldn't be moved back to it. Its links open the three runs below. |
| Native Android build | Waits for `production` approval | Approve it to build the signed AAB and APK, upload the AAB to Google Play internal testing, and publish a GitHub Release. See [Native app binaries](#native-app-binaries). |
| Native iOS build | Waits for `production` approval | Approve it to build the signed IPA and upload it to TestFlight. |
| Deploy Bulletin Apps Script | Waits for `production` approval | Approve it when nobody is making a bulletin, then check the live bulletin. Reject it to skip this deploy. See [Deploying the bulletin Apps Script](#deploying-the-bulletin-apps-script). |

Workflows that run from `main`'s copy (Android preview APK, and the upload step of the
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
   workflow from*. The upload step always runs the upload script from `main`, but
   it uploads the images the chosen branch generated from its own copy of the
   file. A run from `release-candidate` can test image generation; reject its upload.
2. Approve the `production` deployment when the upload job starts. Leaving it
   unapproved is safe: the run expires without changing Drive.
3. Open the **Upload QR codes to Google Drive** log and check:
   - `Google Drive scopes: …`. The login currently has `drive.file` (change only
     files it created) and `drive.metadata.readonly` (see all files). If the upload
     fails with `403 … has not granted the app … write access to the file`, the file
     was uploaded by hand. Rename that file in Drive (for example, add
     `_manual_backup` before `.jpg`) and run the workflow again. The workflow then
     creates the file and can replace it on later runs. Moving the old file to the
     trash works too: the upload workflow and the bulletin script both skip trashed
     files. Don't leave two untrashed files with the same name in the QR code
     folder, because the bulletin script uses the first one it finds. See
     [Credentials](#credentials-that-need-attention).
   - `Replaced …` or `Uploaded …` for each file in the table. **Replaced** keeps the
     existing Drive file, its ID, and its sharing link.
4. The next printed bulletin you generate picks the images up from the QR code
   folder by name.

**Where the QR codes live.** The workflow uploads to one folder in a restricted shared
drive (its ID is `GOOGLE_DRIVE_FOLDER_ID` in the workflow, and the bulletin script
searches the same folder). Admins manage that drive; everyone who only makes bulletins
is a viewer, which is enough to print the codes but not to change them. The Google
login in `CLASPRC_JSON` needs at least Contributor access to that drive to upload. A
Zelle code made by hand goes in the same folder.

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

Which slots print, and why the mobile app code waited for launch (#323), is in
[Giving QR slots](bulletin-automation.md#giving-qr-slots). The Zelle codes are made by hand.

## Deploying the bulletin Apps Script

**Workflow:** **Deploy Bulletin Apps Script**
(`.github/workflows/apps-script-deploy.yml`). Every merge into `main` starts it, and
it waits for `production` approval, like the native builds. It can also be run by
hand from `main`.

**Every approved run changes production.** There is one Apps Script project and one
web-app deployment, and there is no test copy. Approving pushes the merged commit's
code to the project and points the live deployment at it. The spreadsheet's **Printed Bulletin**
menu and the app's bulletin use the new code at once. The workflow runs only for
`main`: started from any other branch, it skips, so it is not a way to try a change
out.

After a release merges into `main`:

1. Approve the run's `production` deployment when nobody is making a bulletin, so
   the menu doesn't change under them, and after any sheet change the release
   needs, such as a new header. A release that didn't change the bulletin code
   starts a run too; approving it republishes the current code. Rejecting a run
   skips that deploy. Don't leave a run waiting: later deploys queue behind it
   until it's approved or rejected, and GitHub cancels it after 30 days.
2. Follow the checks in
   [Deployment and verification](bulletin-automation.md#deployment-and-verification):
   reload the spreadsheet, generate a test bulletin for each changed layout, and check
   the Doc, the PDF, and the public `/exec` response.

To redeploy between releases, select **Run workflow**, choose **`main`** under *Use
workflow from*, optionally enter a description, and approve it. The description is
shown in the Apps Script version history; a merge's deploy uses the release pull
request's title.

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
| `https://app.nyccsda.org/legal.html` | `public/legal.html` | The app's **Legal Disclaimer** row |
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
  as `/you/licenses`, are blank until JavaScript runs, and the stores' checkers may not
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

Work through it, note anything that changed in a comment, and close it. It's due
February 28: while it's still open, the [due-date reminders](#due-date-reminders)
comment on it around January 29, around February 21, and on March 1. It runs every
Monday in January, but only the first opens an issue; the others find it and stop.
Start it by hand from the Actions tab to open one early.

The Apple renewals have their own reminder, 60 days before each date; see
[Apple signing reminders](#apple-signing-reminders). The Workspace backup has its own
issue every three months; see [Google Workspace backups](#google-workspace-backups).
To add a yearly task, add it to
`scripts/yearly-checkup.cjs` and to the
[upkeep calendar](../architecture.md#upkeep-calendar);
`test/yearly-checkup.test.ts` checks that every link in the checklist still works.

## Google Workspace backups

Every three months, a super administrator exports all of the church's Google Workspace
data (every account's email, Drive files, calendars, and the rest) and keeps a copy off
Google. Google's own copies protect the data from failed hardware, but not from losing
the account itself: suspended by mistake, taken over, or emptied by someone with access.
This copy survives that.

On the first Monday of January, April, July, and October, **Workspace Backup Reminder**
(`workspace-backup-reminder.yml`) opens an issue titled **Google Workspace backup,
*month year***, assigned to the usernames in `MONITOR_ALERT_ASSIGNEES`, with the steps
below as a checklist. It's due at the end of the next month, so the
[due-date reminders](#due-date-reminders) follow it up. It runs every Monday in those
months, but only the first opens an issue. To open one for the current month, for
example after a missed quarter, run it by hand from the Actions tab; the next scheduled
one still opens.

**Why every three months:** Google allows a full export at most once every 30 days
([Choose the Workspace data you want to export](https://knowledge.workspace.google.com/admin/migrate/choose-the-workspace-data-you-want-to-export)).
Every three months, losing the account would cost about three months of email and files
(up to five when an export is done near its due date), for four exports a year.

### Starting the export

You need a super administrator account that is at least 30 days old and has 2-Step
Verification on.

1. In the [Google Admin console](https://admin.google.com), go to **Menu → Data → Data
   import & export → Data export**.
2. Click **Set up new export**, name it (the date works), and under **Scope** choose
   **Export all user data for the entire organization**.
3. Click **Start export**. It can't be canceled from the console.

The export is ready no sooner than 48 hours later. It usually takes about 72 hours,
and up to 14 days. Google emails the super administrator who started it when it's done
([Export all your organization's data](https://knowledge.workspace.google.com/admin/migrate/export-all-your-organizations-data)).

### Downloading it

Google deletes the export 60 days after it started, so download it soon after the email
arrives. Downloading it is free and needs no billing account
([why](service-limits-and-costs.md#google-workspace-and-drive)). If a Google Cloud
screen offers a free trial or asks for billing, close it: the download needs neither.

1. **Check that it finished cleanly.** In the **Data export** table, the export must not
   show **Errors**. An export with errors is missing some data. For 20 days after it
   finishes, Google can fetch what's missing into a second archive, which you download
   the same way
   ([Troubleshoot a data export](https://knowledge.workspace.google.com/admin/migrate/troubleshoot-a-data-export)).
2. **Install the [Google Cloud CLI](https://cloud.google.com/sdk/docs/install)**
   (`gcloud`). On Windows, untick **Run 'gcloud init'** on the installer's last screen;
   elsewhere, skip the install page's `gcloud init` step. `gcloud init` and
   `gcloud config set project` give `gcloud` a default project, and it bills downloads
   to that project, so don't run either, and don't add `--billing-project`.
   `gcloud config get project` should print `(unset)`.
3. **Sign in.** In a terminal (on Windows, **Google Cloud SDK Shell** from the Start
   menu), run `gcloud auth login`, and in the browser it opens, choose the super
   administrator's `nyccsda.org` account. Google Cloud must be turned on for that
   account, or the next step can't open the export.
4. **Find the export.** In the **Data export** table, click the export's name, then
   **Actions → View Archive**. Note the bucket's name (the part after `gs://`) and the
   export's folder, named for when it started, such as `20270104T153000Z`.
   `Status Report.html` sits next to the folder.
5. **Make a folder for it** on the backup drive, named for the export date, such as
   `Backups/Church Google Workspace for Nonprofits/Jan 4 2027 export backup`. Use a
   drive other than the computer's system drive, so the backup outlives it, and not a
   folder that syncs to a cloud account. The October 2026 export was about 19 GB;
   leave room for at least three. The export holds every account's email and files,
   so guard the drive as you would the accounts themselves.
6. **Download** the export's folder and its status report into it, with the command
   below on one line. Replace `BUCKET` and `EXPORT_FOLDER`, and replace
   `BACKUP_FOLDER` with the full path of the folder from step 5, written with forward
   slashes, such as `D:/Backups/…/Jan 4 2027 export backup` (from WSL,
   `/mnt/d/Backups/…`).

   ```
   gcloud storage cp --recursive --no-clobber "gs://BUCKET/EXPORT_FOLDER" "gs://BUCKET/Status Report.html" "BACKUP_FOLDER/"
   ```

   `gcloud` checks each file against Google's copy as it saves it. If the download
   stops, run the same command again: `--no-clobber` skips the files already saved.

### Checking the copy

- `gcloud storage du --summarize "gs://BUCKET/EXPORT_FOLDER"` prints the export's size
  in bytes. The `EXPORT_FOLDER` inside your backup folder (not the backup folder itself,
  which also holds `Status Report.html`) must be exactly that many bytes. In Windows,
  that's its **Properties → Size**, not **Size on disk**.
- No file in the folder ends in `_.gstmp`. Those are downloads that didn't finish; run
  the download again.

Then comment on the issue with the export's date and size, and close it. Keep the older
exports while the drive has room. When it runs low, delete the oldest, but keep the
two newest.

## Native app binaries

Background, signing setup, and recovery are in [Native mobile binary builds](native-builds.md).

### Building

- **Automatic:** every merge to `main` starts **Native Android build** and **Native
  iOS build**. Approve both `production` deployments.
- **Manual:** Actions → **Native Android build** → **Run workflow** on `main`. It
  builds both the AAB and the APK whichever boxes you tick; ticking **AAB** also
  uploads it to Google Play internal testing. Actions → **Native iOS build** → **Run
  workflow** on `main`. Both refuse to sign from any other branch.

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

1. **Test** the build on an iPhone and an Android phone, installed from TestFlight and
   from the Play Store's internal testing link; see
   [Device checks before release](#device-checks-before-release).
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

### Device checks before release

The automatic checks don't use a real phone. **Android audio e2e** runs on an emulator
(host failover, one chapter change with the screen off, recovery after the connection
drops), and **iOS key screens** checks the key screens on a simulated iPhone and an
Android emulator. So before
releasing a build to the public, check it by hand on one iPhone and one Android phone,
installed from TestFlight and from the Play Store's internal testing link. Copy this
list into a comment on the release pull request, tick it for each phone, and add the
phone's model, its OS version, the app version on the **You** tab, and anything odd.
The locked checks matter most on the iPhone: iOS moves to the next chapter from the
app's own code, while Android uses a native queue.

- [ ] **Locked listening.** Play a chapter in English (BSB), switch to another app,
  lock the phone near the chapter's end, and listen for at least 15 minutes while
  chapters change on their own, with no pauses. The lock screen's title changes with
  each chapter, and play/pause and skipping back and forward work there. Unlock: the reader shows the chapter that's playing. Then let a couple of
  chapters change in Chinese (CUV).
- [ ] **Next and Previous (Android).** In the notification, go back to the first
  chapter you played, and forward from one book into the next. Pressed while paused,
  they leave it paused.
- [ ] **Another audio app.** Start music or a video in another app while Bible audio
  plays, once mid-chapter and once while a chapter is still loading. Bible audio
  pauses and stays paused after you unlock; pressing Play in the Bible stops the other
  app.
- [ ] **Silent mode, battery saver, and headphones.** With silent mode on, and again
  with Low Power Mode (iPhone) or Battery Saver (Android) on, Bible audio still plays
  and changes chapters while locked. Disconnect wired or Bluetooth headphones while it
  plays, and note what happens.
- [ ] **Connection loss.** Turn on airplane mode just before a chapter ends, wait a
  minute, turn it off, and unlock. Audio resumes by itself, and the new chapter's text
  loads without pressing Next or Previous. Try both translations.
- [ ] **Sleep timer.** Try **End of chapter**, **5 minutes**, and **End of book**
  (start at Psalm 149 so it stops after Psalm 150). Each stops at the right point,
  also while locked.
- [ ] **Changes while playing.** Change the chapter, the translation, and
  **Preferred source** under **Audio settings**, and seek within a chapter. Leave the
  Bible tab and come back: it returns to the chapter that's playing.
- [ ] **Offline start.** After using the app online, close it fully, turn on airplane
  mode, and open it. It starts, and the **Home** tab and the bulletin show what they
  last loaded.
- [ ] **Outside links.** Open an outside page, such as a giving page under **Tithe &
  Offering** or a hymn's source page, then return. The app is where you left it.
- [ ] **This release's changes.** Try each change the release pull request lists.

If a check fails, don't release that build. Open an issue with the phone, OS version,
app version, and steps; the fix ships in a new version.

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

## Android preview APKs

**Workflow:** **Android preview APK**, which runs automatically on release pull requests
into `main` (from `release-candidate` in this repository).

It builds a debug APK, signed only with Gradle's local debug key, never the church's
release key. After you approve `production`, it uploads the APK
to Google Drive as `sda-church-app-pr-<number>-<run>-arm-debug.apk`, and the run
summary links to it. Fork pull requests are skipped. See
[Android preview APK and Drive upload](native-builds.md#android-preview-apk-and-drive-upload).

## iOS key screens builds

**Workflow:** **iOS key screens**, which runs automatically on release pull requests
into `main`, and can be run manually on any branch.

It builds the app once, without signing, for an Apple Silicon Mac, and shares it with
five runners, one per key-screen group, which run at once. Each launches the app on a
simulated iPhone, captures its group of the key screens in `test/screens/screens.json`
(87 screenshots of 33 screens in all), and checks their text with
`scripts/check-screens.cjs`. Another job then joins the groups. The **Android key
screens** workflow takes and checks the same screens on an Android emulator, on Linux
runners ([Android key screens](native-builds.md#android-key-screens)). The review
comment waits for it and links both platforms' screenshots, before
**Screenshots reviewed**, which covers both. Both take 30 to 40 minutes, most of it the
Android build. On a release pull request, the comment
links the screenshots, and the **Screenshots reviewed** check waits until an approver
has looked at them; see [Approving the screenshots](#approving-the-screenshots).
The build needs no `production` approval, because it reads no secrets. To test the
release on an Apple Silicon Mac before merging, download the app, the artifact ending in
`-arm64`, from the run's Artifacts section (kept 14 days); you don't need an iPhone.
The screenshots are a separate download, `ios-key-screens-<number>-<run>`. See
[iOS key screens](native-builds.md#ios-key-screens-unsigned-simulator-builds).

## Dependabot pull requests

Dependabot opens one pull request a week for all minor and patch updates, and a
separate one for each major update (`.github/dependabot.yml`). It opens them against
`main`, and they fail the `main` checks by design: **Main Release Source Gate**, **PR
Version Check**, and **Release - PR Version Sync**. Don't merge them into `main`. For
each one:

1. Select **Edit** next to the title and change the base branch to `release-candidate`.
2. Comment `@dependabot rebase` so the branch is rebuilt on `release-candidate` and the
   checks run again.

Or copy the `package.json` and `package-lock.json` changes from several of them into
one pull request into `release-candidate`, and close the Dependabot pull requests with a
link to it.

A release moves a Dependabot pull request that's still open on `release-candidate` back
to `main`. **Release - After Merge** leaves bots' pull requests there and names them in
its comment, so move it again.

While a Dependabot pull request still targets `main`, it runs only the quick checks.
The slow builds and tests run on the release pull request that includes the update.

When Dependabot reports `security_update_not_possible`, there's no fix Dependabot can
apply yet, usually because another package pins the old version. Recheck after that
package updates.

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
labeled **critical**. An unreadable page alone does not add the
label, because it usually means the page wording changed, not that uploads will be
rejected.

A new alert is assigned to the users in `MONITOR_ALERT_ASSIGNEES`; see
[Getting notified only when action is needed](#getting-notified-only-when-action-is-needed).
The issue closes itself on the next passing run. The job summary also notes when
Apple recommends a newer Xcode than the build uses; that note alone does not open an
issue. What to update and test is under
[Store toolchain requirements](#store-toolchain-requirements).

## Expo doctor monitor alerts

**Workflow:** **Expo Doctor Monitor**, which runs every Monday and can be run manually.

It runs every check of [`expo-doctor`](https://docs.expo.dev/develop/tools/#expo-doctor),
the same as `npm run doctor`, including the one that every package the installed SDK
pins (Expo's own, React Native, and some native libraries) is the version it expects.
Pull requests run the same tool without that check, as `Expo Doctor (config)`, which
isn't required; see [Automated checks](../CONTRIBUTING.md#automated-checks).

When any check fails, it opens or updates the issue **[monitor] Expo doctor found
problems**, with `expo-doctor`'s output. A new alert is assigned to the users in
`MONITOR_ALERT_ASSIGNEES`; see
[Getting notified only when action is needed](#getting-notified-only-when-action-is-needed).
The issue closes itself on the next passing run. Usually Expo has published SDK patch
releases. On a branch from `release-candidate`:

1. Run `npx expo install --fix`.
2. If `npm view expo-template-bare-minimum dist-tags.sdk-<SDK>` is newer than the pinned
   `expo-template-bare-minimum@…`, update every pin; `test/native-build-safety.test.ts`
   checks that they match.
3. Run `npm run doctor` and `npm run check`, build the Android APK on the emulator, and
   start **iOS key screens** by hand, since patch releases can change native code.

While Expo or React Native is a pre-release, as during the Expo 58 canary, it skips the
run and passes, because the versions can't match a released SDK.
`scripts/expo-doctor-monitor.cjs` runs it and writes the alert text. It runs
`expo-doctor` in a job with a read-only token, and only a second job, which installs
nothing, can write issues.

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

## Due-date reminders

**Workflow:** **Due-Date Reminders**, which runs daily and can be run manually.

To give an issue a deadline, start a line of its description with `Due:` and the date
as *YYYY-MM-DD*, for example `**Due: 2027-04-01**`. Only the first such line counts.
The workflow comments on the issue once the date is 30 days away or less, again at 7
days or less, and once the day after it passes. Each comment @mentions the users in
`MONITOR_ALERT_ASSIGNEES`, or, if that is empty, whoever triggered the run. Each
reminder is posted once. Editing the date starts them over, and removing the line or
closing the issue stops them.

Only issues opened by someone who can triage or manage the repository, or by its own
workflows such as the yearly checkup and the Workspace backup reminder, count, so someone else's issue can't make it
notify anyone. The rules are in
`scripts/due-date-reminders.cjs`. When an issue can't be commented on, the others
still get their reminders and the run fails, so check its log.

## Updating pastors and elders

The printed bulletin adds Pastor and Elder titles from the master spreadsheet's
`Leadership` tab, and the pastor on its `Head` row leads the Communion service.
Keeping the tab current is a maintainer's duty: check it after each church
officer election, and update it whenever a pastor or elder starts or leaves.

1. Open the `Leadership` tab.
2. Add or remove names under `Pastors` or `Elders`, one plain name per cell,
   spelled as in the `Name Dictionary`. Add anyone new to the `Name Dictionary`
   too, with their Chinese name, so both lines of the bulletin get the title.
3. Keep `Head` on the row of the pastor who leads Communion. It is never
   printed.
4. When you next make the coming Sabbath's bulletin (**Printed Bulletin → Create
   Google Doc + PDF…**), check the titles of the people scheduled that day. Only
   a Queens Holy Communion bulletin shows the `Head` pastor.

No code change or deploy is needed; the next print reads the tab. The layout
rules are in [The `Leadership` tab](bulletin-automation.md#the-leadership-tab).

## Bible audio emulator test

**Workflow:** **Android audio e2e**. It runs on every release pull request into
`main`, and it can be run manually. **It's a required check on `main`**,
so a release can't merge until it passes. Feature pull requests into `release-candidate`
don't run it; to test an audio change before the release, run it manually on your
branch.

It takes about 20 minutes, and runs alongside **iOS key screens**, which takes 15 to 25
minutes.

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

**To run it on your own emulator,** see
[Bible audio on an Android emulator](../README.md#bible-audio-on-an-android-emulator).
The script turns off the device's animations while it runs and restores them when it
exits.

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
| `.github/workflows/android-preview-apk.yml` | The Drive upload needs the `production` environment, which a pull request run can reach only in `main`'s context. It builds only this repository's `release-candidate` branch, never fork code. | Yes: `Build Android debug APK (ARM)` |
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
  only this repository's `release-candidate` branch, which changes only through approved
  pull requests, and never a fork's code. Its build job has no secrets, no saved
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
not write to it, so it can't poison the cache the signing builds use. The iOS compile
cache follows the same rule: only `ios-compile-cache.yml`, on `main`, saves it; the iOS
PR preview only reads it; and the signed builds never use it (see
[Compile cache](native-builds.md#ios-key-screens-unsigned-simulator-builds)).
Elsewhere:

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

