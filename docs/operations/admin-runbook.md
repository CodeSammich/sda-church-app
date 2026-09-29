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
| Deploy Web Preview and Tag | Yes | Nothing. It tags `vx.y.z` and publishes the web app. |
| Native Android build | Waits for `production` approval | Approve it to build the signed AAB and APK, upload the AAB to Google Play internal testing, and publish a GitHub Release. See [Native app binaries](#native-app-binaries). |
| Native iOS build | Waits for `production` approval | Approve it to build the signed IPA and upload it to TestFlight. |

Workflows that run from `main`'s copy (Android PR preview, and the upload step of the
QR workflow) keep their old behavior until the release that changes them is merged.
A failure on a release pull request caused by a bug the release itself fixes is
expected.

## Bulletin QR codes

**Workflow:** Actions → **Generate physical bulletin QR codes**
(`.github/workflows/generate-physical-bulletin-qr.yml`). Manual only.

Run it only when a giving URL changes. It overwrites the QR images the printed
bulletin uses.

1. Select **Run workflow** and choose **`main`** under *Use workflow from*. The upload
   step always runs the upload script from `main`, so running from a release branch
   only tests image generation.
2. Enter the Queens and Brooklyn AdventistGiving URLs. They must be `https://`.
3. Approve the `production` deployment when the upload job starts.
4. Open the **Upload QR codes to Google Drive** log and check:
   - `Google Drive scopes: …`. The login currently has `drive.file` (change only
     files it created) and `drive.metadata.readonly` (see all files). If the upload
     fails with `403 … has not granted the app … write access to the file`, the file
     was uploaded by hand. Rename that file in Drive (for example, add
     `_manual_backup` before `.jpg`) and run the workflow again. The workflow then
     creates the file and can replace it on later runs. Rename rather than trash:
     the bulletin script picks the first file with a matching name anywhere in Drive
     and doesn't skip trashed files. See
     [Credentials](#credentials-that-need-attention).
   - `Replaced …` or `Uploaded …` for `queens_adventist_giving_qr_code_368x368.jpg`
     and `brooklyn_adventist_giving_qr_code_368x368.jpg`. **Replaced** keeps the
     existing Drive file, its ID, and its sharing link.
5. The next printed bulletin you generate picks the images up from Drive by name.

The images are also saved as the run's **adventistgiving-qr-codes** artifact for 90
days.

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
[Giving QR slots](bulletin-automation.md#giving-qr-slots). The Zelle and mobile app
codes are tracked in #237.

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
2. **Apple:** on the app's **Distribution** page in App Store Connect, set the version
   to the release's version, select the build, and **Add for Review**.
3. **Google Play:** Play Console → **Test and release → Internal testing** → promote
   the release to production. Promoting copies the testers' "What's new" text, so
   rewrite it for the public first.

The upload jobs, their `store-upload` secrets, what each result means, and how to
upload by hand are in
[Automatic store uploads](native-builds.md#automatic-store-uploads).

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
workflow changes. That's safe here because other protections, not this policy, keep
outside code away from secrets and write access:

- `pull_request_target` always runs the workflow as it is on `main`, never the pull
  request's copy, so an outsider can't add or change one. Only a reviewed release PR
  can.
- `test/native-build-safety.test.ts` fails if any workflow other than these three
  starts using `pull_request_target`, so a new one can't merge unnoticed. Before adding
  one to that list, check that it never runs pull request code while it can read
  secrets or write to the repository.
- Workflows that run for a fork's pull request get no secrets and a read-only token,
  and none runs until a maintainer approves it (**Settings → Actions → General →
  Require approval for all external contributors**).
- The default workflow token is read-only, and workflows can't approve pull requests.
- The store upload secrets are in the `store-upload` environment, which only `main`
  can use.

Keep those settings and the test.

To set up the policy:

1. **Settings → Actions → Policies → New policy.**
2. **Name** it `Allow all workflow events`.
3. **Enforcement status:** **Active**. (**Evaluate**, a dry run, is only available on
   GitHub Enterprise Cloud.)
4. **Target** all workflows in the repository.
5. **Event rules:** tick every event in the list. There's no "all events" option, and
   an event rule is an allowlist: an unticked event stops every workflow that uses it.
6. After the next release PR, open **Policy insights**, under the policies page, and
   check that nothing was blocked.

New workflows need no change to the policy. Only if GitHub adds a new kind of event,
and a workflow uses it, does that event need ticking here.

If `ensure_pr_to_main_from_release_branch` or `Build Android debug APK (ARM)` ever stops
reporting on a release PR, check this policy first.

