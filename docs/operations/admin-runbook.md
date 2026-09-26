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
- [Approving a production deployment](#approving-a-production-deployment)
- [Shipping a release to `main`](#shipping-a-release-to-main)
- [Bulletin QR codes](#bulletin-qr-codes)
- [Deploying the bulletin Apps Script](#deploying-the-bulletin-apps-script)
- [Native app binaries](#native-app-binaries)
- [Android PR preview APKs](#android-pr-preview-apks)
- [Dependabot pull requests](#dependabot-pull-requests)
- [External dependency monitor alerts](#external-dependency-monitor-alerts)
- [Credentials that need attention](#credentials-that-need-attention)

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

## Approving a production deployment

Any job that needs credentials pauses with the status **Waiting**.

1. Open the run from **Actions**, or from the notification email.
2. Select **Review deployments**, tick **production**, and select **Approve and
   deploy**.
3. Check what triggered the run and from which branch before approving. Reject a run
   you didn't expect.

## Shipping a release to `main`

The full process is in [Contributing](../CONTRIBUTING.md#two-stage-release-process).
The admin-only steps are:

1. **Create the release branch** from `main`: **Code → branch menu → View all
   branches → New branch**, named `release/x.y.z` (for example `release/0.39.0`).
2. **Merge feature pull requests** into that branch. Their titles must start with
   `Release/x.y.z:` or `Release/x.y.x:`.
3. **Open the release pull request** from `release/x.y.z` into `main`, titled
   `Release/x.y.z: …`. Copy the `Closes #…` lines from the included feature pull
   requests into its **Related issues** section. Use `Part of #…` for issues that
   should stay open.
4. **Merge it.** The version files must already say `x.y.z`
   (`npm run sync-version -- --version x.y.z` in the release branch).

What runs after the merge to `main`:

| Workflow | Automatic? | What you do |
| --- | --- | --- |
| Deploy Web Preview and Tag | Yes | Nothing. It tags `vx.y.z` and publishes the web app. |
| Native Android build | Waits for `production` approval | Approve it to build the signed AAB and APK and publish a GitHub Release. See [Native app binaries](#native-app-binaries). |
| Native iOS build | Waits for `production` approval | Approve it to build the signed IPA. |

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
     was uploaded by hand. Move that file to the Drive trash and run the workflow
     again. The workflow then creates the file and can replace it on later runs. See
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

Before a store upload, raise the build numbers in a release pull request:

- Android: the Play version code. See
  [Set the Play version code explicitly](native-builds.md#3-set-the-play-version-code-explicitly).
- iOS: `expo.ios.buildNumber` in `app.json`.

### Downloading

| Binary | Where to find it | Kept for |
| --- | --- | --- |
| Android AAB and APK from a merge to `main` | **Releases → vx.y.z**, attached to the GitHub Release | Permanently |
| Android AAB or APK from a manual run | The run's **Artifacts** (`native-android-…`) | 14 days |
| iOS IPA | The **Native iOS build** run's **Artifacts** (`native-ios-…`) | 14 days |

Download the IPA within 14 days. It isn't attached to the GitHub Release.

### Uploading to the stores

Uploads are manual; nothing publishes to a store automatically.

- **Google Play:** Play Console → the app → **Test and release** → choose a track →
  **Create new release** → upload the `.aab`. Use the AAB, not the APK.
- **Apple:** upload the `.ipa` to App Store Connect (for example with Apple's
  Transporter app). It appears under **TestFlight** after processing. Add testers
  there, and submit for review from the app's **Distribution** page.

Store listings, review, and the production release are finished in each console. See
[Upload separately](native-builds.md#upload-separately).

## Android PR preview APKs

**Workflow:** **Android PR preview**, which runs automatically on same-repository pull
requests into `main`.

It builds an unsigned debug APK. After you approve `production`, it uploads the APK
to Google Drive as `sda-church-app-pr-<number>-<run>-arm-debug.apk`, and the run
summary links to it. Fork pull requests are skipped. See
[Android PR preview and Drive upload](native-builds.md#android-pr-preview-and-drive-upload).

## Dependabot pull requests

Dependabot opens pull requests against `main`, and they fail the `main` checks by
design: **Main Release Source Gate**, **PR Version Check**, and **Release - PR Version
Sync**. Don't merge them into `main`. For each one:

1. Select **Edit** next to the title and change the base branch to the current
   `release/x.y.z`.
2. Add `Release/x.y.z: ` to the start of the title.
3. Comment `@dependabot rebase` so the branch is rebuilt on the release branch and the
   checks run again.

When Dependabot reports `security_update_not_possible`, there's no fix Dependabot can
apply yet, usually because another package pins the old version. Recheck after that
package updates.

## External dependency monitor alerts

**Workflow:** **External Dependency Monitor**, which runs daily and can be run
manually.

It opens or updates an issue when an outside service the app depends on fails, and
closes the issue when the service recovers. See
[External dependency monitor](external-dependency-monitor.md).

## Credentials that need attention

| Credential | Where | When to act |
| --- | --- | --- |
| `CLASPRC_JSON` (Google login for Apps Script and Drive uploads) | `production` Environment secret | When clasp authorization fails; see the Workspace session note in [Deployment and verification](bulletin-automation.md#deployment-and-verification). The login has `drive.file` and `drive.metadata.readonly`: it can see every file but can change only files it created. Replacing a hand-made file fails with `403 appNotAuthorizedToFile`; trash the hand-made copy and let the workflow create it. Keep this narrow access rather than granting full `drive` access, because this account can reach every shared drive. |
| Apple distribution certificate and provisioning profile | `production` Environment secrets | Profiles expire after 12 months. See [iOS setup](native-builds.md#ios-setup-github-hosted-direct-builds). |
| Android upload keystore | `production` Environment secrets | Only when Google Play requires a rotation. See [Android rotation and recovery policy](native-builds.md#android-rotation-and-recovery-policy). |

Never paste credentials into issues, pull requests, or workflow logs.
