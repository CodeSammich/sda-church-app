# Web and native builds

Web/PWA preview deployment remains automatic on pushes to `main` through the canonical
GitHub workflow. Local `npm run deploy` builds the web output without publishing it.
Signed native builds run only after a change reaches `main`; `release/**` branches are
source/release-management branches, not signed-build targets. The Android PR preview is a
separate credential-free path for unsigned debug APKs in ARM and Intel variants. Fork PRs do
not receive Linux checks from this native-build documentation path; they are limited to the
unsigned debug APK preview policy. Native iOS does not run on pull requests at all. It runs
only from `main` after merge (or an explicitly approved manual run on `main`). Native builds
do not publish to either store. Native iOS and Android are the primary release targets; the
web/PWA build is retained for browser testing and previews. The same Expo source is
used for all platforms.

## Current migration status

Android uses the zero-Expo-authentication build path. The repository contains a
config plugin that teaches the generated Gradle project to use a keystore supplied
through environment variables, and `npm run build:android` /
`npm run build:android:apk` use `expo prebuild` followed by Gradle directly.
The intended GitHub configuration keeps the four Android signing values in the
protected `production` Environment. The workflow decodes only the base64 keystore
into `$RUNNER_TEMP`, derives `ANDROID_KEYSTORE_PATH` from that temporary location,
and exposes the signing values only to the Gradle invocation that signs the binary.
The path is not itself a secret, and no keystore or password is passed to Expo
prebuild. Android builds do not need an Expo account, an Expo token, or EAS
credential storage. Its job-level guard permits signed runs only from
trusted `main`; the manual dispatch cannot attach the
production Environment to an arbitrary ref. If the values were initially entered
as ordinary repository secrets, move them to the protected Environment and remove
the repository-level copies before the first signed release run.

The direct-native iOS workflow is now checked in separately as
`.github/workflows/native-ios-build.yml`. It runs only on trusted pushes to `main` and
manual dispatch from `main`; it has no pull-request signing path. All signing paths require
the protected `production` Environment. It uses a
GitHub-hosted macOS runner with Expo prebuild and Xcode, and remains unable to complete
until the church adds its Apple signing secrets. It does not use EAS or an Expo token.
The repository no longer depends on an Expo account; keep any external account only if
the church wants to preserve unrelated project history.

### Local Expo template lookup

`scripts/build-android-native.mjs` reuses an existing generated `android/` project
for repeat local builds. This avoids an unnecessary npm registry metadata lookup for
`expo-template-bare-minimum@58.0.3`, including when `--no-install` is used. A clean
GitHub Actions checkout still runs Expo prebuild. When `app.json`, a native config
plugin, or another native setting changes, force regeneration with either:

```bash
npm run build:android:apk:debug -- --prebuild
EXPO_PREBUILD=true npm run build:android:apk:debug
```

The execution environment may still require network approval for a clean prebuild;
that permission is controlled by the runner or sandbox, not by repository settings.

The Play Console currently shows no uploaded app bundle, so `app.json` uses the
initial Android `versionCode` of `1`. The Android native build script refuses
to create a store binary unless this field remains explicit. `versionCode` is
separate from the user-facing `package.json`/`app.json` version such as `0.37.0`.
Only a code maintainer changes it, as part of final release preparation immediately
before a Google Play upload. Do not bump it for ordinary feature PRs, local builds,
or browser previews. Increase it to `2`, `3`, and so on for later uploads; never
reuse or lower a value already uploaded to Google Play. Do not build a signed AAB
on a release branch before the final merge; build the signed artifact only after
the release commit reaches `main`.

## Decision rationale and risk register

| Decision | Reason | Remaining risk / control |
| --- | --- | --- |
| Build Android with prebuild + Gradle | Removes Expo authentication and EAS credential custody from Android while using the public repository's free standard Linux runner | Expo template, Gradle, Java, SDK, and NDK updates still need periodic validation |
| Keep native directories ignored | Expo Continuous Native Generation makes `app.json` and config plugins the source of truth and avoids hand-edited generated files | A clean prebuild can overwrite manual native edits; keep native behavior in config/plugins |
| Store Android signing values in the protected GitHub Environment | Google retains the final Play app-signing key; CI needs only the upload key and four narrowly scoped values, while GitHub provides reviewer approval and branch controls | Repository-level copies weaken environment scoping; keep the four values only in `production`, require approval, restrict trusted refs, use least privilege, and review Actions |
| Do not rotate the Android key annually | Upload keys do not expire annually; keeping the same key preserves the Play update path | Maintain encrypted backups; use Play's upload-key reset process after loss or compromise |
| Build iOS with prebuild + Xcode | Removes Expo authentication and EAS credential custody from iOS while using trusted-branch or manual macOS workflows | Apple certificate/profile renewal and Xcode/runner updates still need periodic validation |
| Build artifacts but submit manually first | Compilation and signing can be automated without granting store-publishing access to every build | Upload the AAB to Play internal testing and verify an update before adding submission automation |
| Do not build signed binaries before `main` | Production signing material is reserved for the post-merge `main` build. | Pull-request previews remain unsigned debug APKs for ARM and Intel; fork PRs do not receive signed builds or Linux native checks |

This is why the migration is not just “put the JKS in a GitHub secret.” The
keystore must be the key Google expects, the version code must be monotonic, the
workflow must restore and delete the secret safely, and the resulting AAB must
be tested as an update. These controls matter more than the build command itself.

### Why the final credential boundary is a GitHub Environment

The final design is a protected GitHub `production` Environment, not a general
repository-secret bucket. Environment secrets are limited to jobs that name that
Environment and are made available only after its protection rules—especially
required-reviewer approval—have passed. Repository secrets are available to all
workflows in the repository and are read earlier in the workflow lifecycle. See
GitHub's [secrets reference](https://docs.github.com/en/actions/reference/security/secrets)
and [deployment-environment guidance](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments).

The Android workflow still references the normal `${{ secrets.NAME }}` context;
the job's `environment: production` determines which Environment-level values are
available. If the same name exists at repository and Environment scope, the
Environment value takes precedence, but keeping duplicates is confusing and
weakens the intended boundary. Therefore the four Android values must be added to
`production`, verified with a protected run, and then removed from Repository
secrets. `ANDROID_KEYSTORE_PATH` remains a derived runner-temporary path rather
than a stored credential, and `EXPO_TOKEN` has no role in this architecture.

### Android PR preview and Drive upload

The signed **Native Android build** workflow intentionally runs only after a commit reaches
`main`; it does not sign release-branch or pull-request commits. The separate **Android PR
preview** workflow is credential-free and is reserved for unsigned debug APK previews in
ARM and Intel variants. Fork PRs do not receive Linux native checks or production signing;
the only native artifact permitted by this policy is an unsigned debug APK preview. The
workflow runs automatically for eligible same-repository pull requests targeting `main`.
It does not accept manual commit or pull-request SHA inputs and does not use dependency
caching while executing PR code in the `pull_request_target` context.

For an automatic PR run, a separate protected `production` Environment job downloads only
the APK artifact and checks out the upload helper from the trusted base commit. It does not
check out or execute PR code while the Google credential is available. The helper refreshes
the existing `CLASPRC_JSON` OAuth token and
uploads a private APK file to the connected user's My Drive root. The OAuth account must
retain the `drive.file` scope. If a dedicated folder is later preferred, set
`GOOGLE_DRIVE_FOLDER_ID` in the protected upload job and pass it to the helper.

Automatic PR runs require the credential-free preview guard; configure `production` with
required reviewers and a `main` deployment-branch policy if Drive uploads should require a
human approval. The build job receives no signing credentials, and fork PRs are skipped.
The Drive upload job must remain separate from the build job, and the upload helper must be
checked out from the trusted base commit rather than the PR head.

## Credential-custody decision

The release pipeline compiles Android directly on a GitHub-hosted Linux runner
with Gradle and iOS directly on a GitHub-hosted macOS runner with Xcode. Neither
workflow uses EAS CLI, Expo authentication, or an EAS Cloud builder.

The intended credential boundary for the church-owned project is GitHub Actions:

| Credential | Custodian | CI location |
| --- | --- | --- |
| Android upload keystore | Church / Google Play account | Protected `production` Environment secret |
| Google Play service-account key | Church / Google Play account | Separate protected `production` Environment secret, not currently configured |
| Apple distribution certificate (`.p12`) | Church Apple Developer account | Protected `production` Environment secret, pending Apple enrollment |
| Apple App Store provisioning profile | Church Apple Developer account | Protected `production` Environment secret, pending Apple enrollment |
| App Store Connect API key (`.p8`) | Church App Store Connect account | Separate protected `production` Environment secret, not currently configured |

The Android keystore above is the **upload key**, not Google's Play app-signing key.
With Play App Signing, Google protects the final signing key and the CI pipeline only
needs the upload key. The App Store Connect `.p8` key is for submission automation;
it is separate from the Apple distribution certificate and provisioning profile.

No signing or submission credentials are stored with a build vendor. The native
workflows restore only the files needed for that run from GitHub Environment
secrets and remove them afterward.

### Current versus target configuration

The Android direct-native path is now active in the repository. Its committed
config plugin changes only the generated `android/app/build.gradle`; it reads
`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
`ANDROID_KEY_PASSWORD` at Gradle runtime. The workflow decodes
`ANDROID_KEYSTORE_BASE64` into the runner's temporary directory, builds an AAB or
APK, uploads the artifact, and removes the keystore in an `always()` cleanup step.
The private key is never committed or included in a build artifact.

The iOS GitHub job now uses direct Xcode archive/export. Before the first direct
iOS release, the implementation must:

1. Restore an Apple distribution `.p12` and App Store provisioning profile only
   inside a protected GitHub job, using a temporary keychain.
2. Create an explicit `xcodebuild archive` and `xcodebuild -exportArchive` path,
   with an export-options plist generated from configuration rather than secrets
   committed to source.
3. Use a protected production Environment, required approval, and a `main`-only
   push or manual-dispatch guard for jobs that can read Apple signing secrets.
4. Commit an explicit iOS `buildNumber` policy after recording the current store
   counter. Until then, changing `appVersionSource` from `remote` would risk a
   duplicate or invalid store build number.
5. Upload the artifact to TestFlight and verify an update install on a physical
   iPhone.

The workflow's `main`-only guard is an important part of this boundary and must remain.
Secrets must be configured in the church's upstream repository/Environment; they are
not shared automatically with the CodeSammich fork.

### Native build workflow

1. Run `npx expo prebuild` to generate temporary `android/` and `ios/` projects.
2. Restore signing material from GitHub Environment secrets.
3. Build Android with Gradle (`bundleRelease`/`assembleRelease`).
4. Build and export iOS with Xcode (`xcodebuild archive` and
   `xcodebuild -exportArchive`).
5. Delete native projects and signing files after the job.

This removes the Expo account and token dependency, but it is not a package-only
change. The workflows own Android signing configuration, an iOS temporary keychain
and export options, and version-code/build-number injection. Store upload remains a
separate manual step.
Keep native customization in `app.json` and config plugins; Expo warns that manual
changes to generated projects can be overwritten by a later clean prebuild. See
[Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
and [config plugins](https://docs.expo.dev/config-plugins/introduction/).

The one-time portion is the workflow setup, signing configuration, and initial
upload of the GitHub secrets. Ongoing maintenance is bounded but not zero: Apple
distribution profiles expire after 12 months, certificates may need replacement,
and GitHub eventually retires runner images. Xcode updates are normally handled by
changing the runner/Xcode selection in workflow YAML and running a validation build;
they are not generally `package.json` updates. Expo/React Native SDK upgrades may
also require dependency changes and a new prebuild validation.

## GitHub Actions minutes and maintenance

For a public repository, standard GitHub-hosted runners—including standard macOS
runners—are currently free. For a private repository, GitHub Free and GitHub Free
for organizations currently include 2,000 standard-runner minutes per month. macOS
has a substantially higher private-repository billing rate than Linux, so budget an
iOS minute as roughly ten Linux-equivalent minutes. The exact allowance and rates
belong to the repository owner's GitHub plan; check [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
before relying on a quota.

The automatic native workflow can run two signed Android jobs on a `main` push: Android
AAB and Android APK. The iOS workflow is separate and runs only on a trusted `main`
push or a manual dispatch from `main`; it never runs as a pull-request build. PR native
previews are unsigned Android debug APKs for ARM and Intel, not signed release builds. A rough
private-repository estimate for the automatic Android workflow is:

```text
Linux-equivalent minutes per run ≈ Android AAB minutes + Android APK minutes
```

For example, a 15-minute AAB plus 10-minute APK run is about 25 Linux-equivalent
minutes. An iOS run is counted separately for each `main` push or manual dispatch.
This is an estimate, not a measured guarantee; use completed workflow durations from
GitHub's Actions usage view. Keep signed builds restricted to `main` pushes or
manual dispatch from `main`, add concurrency cancellation,
retain artifacts only as long as needed,
and configure GitHub to stop usage at the account budget rather than silently incur
charges.

The current `Native Android build` workflow has no `pull_request` trigger, so it does not
start a signed build for every PR or every new commit pushed to a PR. The iOS workflow also
has no pull-request signing path; it runs from the `main` push after merge or from a manual
`main` dispatch. Plan approximately as follows
for a private GitHub Free organization, assuming the rough 10× macOS billing weight:

| iOS runner time | Approximate iOS builds from 2,000 Linux-equivalent minutes |
| ---: | ---: |
| 10 minutes | 20 |
| 20 minutes | 10 |
| 30 minutes | 6 |
| 45 minutes | 4 |

These counts exclude Android jobs and other workflows, and every pushed revision or
manual rerun counts as another job. PR native previews are limited to unsigned ARM and
Intel debug APKs; signed iOS builds remain reserved for the post-merge `main` path or
manual dispatch from `main`. If the upstream repository is public, the
standard macOS runner is currently free and unlimited, though concurrency and fair-use
limits still apply. See [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

The direct native approaches have similar platform-tool maintenance:

| Area | Maintenance required |
| --- | --- |
| Expo/React Native | Update dependencies and rerun prebuild checks when SDK/native dependencies change |
| GitHub runner | Review `runs-on`, Xcode, Node, Java, Android SDK, and NDK versions when images retire |
| iOS | Renew distribution certificates/profiles and retest after Xcode updates |
| Android | Keep the upload keystore backed up; reset it through Play if compromised |
| Workflow | Keep signing/upload steps, cleanup traps, permissions, and action versions current |

Updating Xcode is usually a workflow YAML/runner-image change plus a validation
build, not a `package.json` edit. Pinning the runner (the current workflow uses
`macos-15` and explicitly selects Xcode) avoids surprise upgrades, but requires a
deliberate update when GitHub retires that image. The direct workflows keep build
orchestration visible in this repository and avoid another credential boundary.

## Expo 58 Android prebuild

This branch uses the Expo 58 preview SDK and its matching stable template package.
Generate the Android project with the exact template version used by the build
script:

```sh
source ~/.nvm/nvm.sh
nvm use 24
npm install --force
npx expo prebuild \
  --template expo-template-bare-minimum@58.0.3 \
  --platform android
```

The direct-native script intentionally regenerates the ignored Android project
from this template. Do not hand-edit `android/`; put durable changes in
`app.json` or a config plugin. A manual prebuild can use:

```sh
npx expo prebuild \
  --template expo-template-bare-minimum@58.0.3 \
  --platform android \
  --no-install
```

Then use `npm run build:android`, `npm run build:android:apk`, or
`npm run build:android:apk:debug`; those scripts run the prebuild automatically.

If the Expo 58 preview version changes, update the template version in this section
to the matching template before regenerating native files.

## Building an independent fork

The checked-in configuration points to the church's package and bundle identifiers
and its public app assets. A third party must not use the church's signing or store
credentials. Choose identifiers owned by the fork, create its own Apple Developer
and Google Play accounts if it intends to distribute the apps, and create its own
GitHub Environment secrets. The direct-native workflow architecture can be reused,
but signing material and account access must remain separate.

## If the organization loses access to Apple, Google, or D&B

Treat these accounts as organizational assets, not as one employee's personal
accounts. Keep at least two authorized administrators, use organization-owned
email addresses, store recovery methods securely, and record the legal entity
name, address, EIN, D-U-N-S number, account IDs, and renewal dates.

### Apple Developer

The critical Apple role is called **Account Holder**. For an organization
membership, the Account Holder must have legal authority to bind the
organization. If the current Account Holder is still reachable, they can add
the successor to the team and transfer the role from Apple Developer's
[Transfer the Account Holder role](https://developer.apple.com/help/account/access/transfer-the-account-holder-role/)
page. The successor needs an Apple Account with two-factor authentication and
may need identity verification and to accept the transferee agreement.

If the Account Holder is deceased, unreachable, or the organization cannot
sign in, contact [Apple Developer Support](https://developer.apple.com/contact/)
and explain that the organization has lost its Account Holder. Be prepared to
show the successor's government ID and evidence that they are authorized to
bind the legal entity, such as board authorization, corporate or nonprofit
registration, an officer/director listing, and the organization's official
contact information. Apple determines the exact documents and may request
additional business records; do not assume an Admin can replace the Account
Holder without Apple's help.

Apple's organization enrollment and identity record must match the legal
entity. A nonprofit should be enrolled as the nonprofit's organization, with
the nonprofit's legal name, address, and D-U-N-S record—not as a sole
proprietor or individual. See Apple's guidance on
[updating organization information](https://developer.apple.com/help/account/membership/updating-your-account-information).

### Google Play Console

For Google Play, use an **Organization** developer account and an
organization-type Google Payments profile. Google requires a D-U-N-S number
for organization accounts and offers **Non-profit** as an organization type;
do not leave the account as Personal/Individual or Sole Proprietor merely
because that was the default selected during setup. The legal name and address
in Google Payments must match the D&B profile.

If the existing owner is available, add the successor under **Users and
permissions** and use Google's [Transfer ownership of a Play Console
developer account](https://support.google.com/googleplay/android-developer/answer/16909862)
process. The current Google guidance includes a seven-day security cooling-off
period. If the owner is no longer reachable, Google says to contact Play
Console support through the Help section or its online form; the self-service
transfer cannot be completed without the current owner. Be ready with the
successor's government ID, organization relationship/authority, verified
contact information, Google Payments access, and nonprofit/legal-entity
documents requested by Google. See Google's [required account
information](https://support.google.com/googleplay/android-developer/answer/13628312)
and [identity/profile update guidance](https://support.google.com/googleplay/android-developer/answer/13634888).

If recovery is impossible, create a new organization Play Console account and
ask Google to transfer the apps. This is a recovery path, not a shortcut: the
new account must be active and verified, and app signing, Firebase, API,
analytics, payments, testing, and reports may need follow-up work.

### D-U-N-S and Dun & Bradstreet recovery

The relevant D&B product name is **D-U-N-S Profile Manager** (often shortened
to D-U-N-S Manager), not “DNB business profile manager.” Use the official
[D-U-N-S Profile Manager](https://www.dnb.com/en-us/smb/duns/duns-manager.html),
[D&B company-profile manager](https://smallbusiness.dnb.com/duns-manager/company-profile),
or [D&B sign-in](https://my.dnb.com/) entry points. D&B describes verified
owners, directors, or officers as the people who can manage the profile.

If the organization has no D-U-N-S number, request one through D&B's
[D-U-N-S request service](https://www.dnb.com/duns-number/get-a-duns.html)
and keep the confirmation. The practical wait we experienced was roughly
**5–10 business days** for a new number; this is an operational estimate, not
a guaranteed SLA. Apple and Google may also need additional time after D&B
updates before their verification systems see the change.

If the existing D&B profile is controlled by a departed contact, use Profile
Manager's verification/recovery flow and request access as an authorized
owner, director, or officer. Prepare the organization's exact legal name and
address, D-U-N-S number, government-issued ID, work email/phone, and documents
showing authority—typically formation/registration records, IRS EIN or
tax-exempt determination documentation, nonprofit registration, and a board
resolution or letter of authorization. D&B may request different or additional
documents, so submit only what its support team asks for.

In our experience, becoming the verified D-U-N-S profile manager took another
roughly **5–10 business days**. The role we were looking for is best described
as a verified owner/director/officer in D-U-N-S Profile Manager; D&B's exact
label may vary by region and workflow.

Most importantly, check the D&B legal-entity classification after recovery.
For a nonprofit, the profile must identify the actual nonprofit legal entity,
not Sole Proprietorship. A D-U-N-S request can default to an individual/sole-
proprietor-style record even when the applicant selected nonprofit. Correct the
D&B record first, using the nonprofit's legal documents, then wait for the
change to propagate before submitting Apple or Google verification. Google
explicitly says organization name, address, and D-U-N-S updates originate in
D&B rather than being edited directly in Play Console.

## One-time account setup

The account steps below describe the store accounts and the direct-native workflows.
Neither recommended workflow requires an Expo account; follow [Android setup](#android-setup-github-hosted-direct-builds) and
[iOS setup](#ios-setup-github-hosted-direct-builds) for their build credentials.

### Apple Developer versus Apple Business Manager

Apple Business Manager is **not required** to enroll in or use the Apple
Developer Program for App Store distribution. They are separate Apple
services. The required service for this project is an Apple Developer Program
organization membership; Apple requires the legal entity, D-U-N-S number,
legal binding authority, a work email, and a public organization website
([Apple's enrollment requirements](https://developer.apple.com/help/account/membership/program-enrollment/)).

Do not assume that an Apple Business Manager login is the Apple Developer
login. If the organization already uses Apple Business Manager, it can be
useful for device management, Managed Apple Accounts, and distributing custom
apps, but it does not replace Apple Developer enrollment. Apple describes the
relationship in its [membership comparison](https://developer.apple.com/support/compare-memberships/):
apps distributed through the App Store, Apple Business Manager, or Apple School
Manager use the Apple Developer Program.

For a small organization, the practical setup is an organization-controlled
Apple Account with two-factor authentication used to enroll the Apple Developer
Program organization membership. Then add at least one additional trusted
Admin and keep recovery methods under organizational control. The enrolling
person becomes the Apple Developer **Account Holder**, which is the role that
renews membership and accepts legal agreements. If the organization uses
Managed Apple Accounts through Apple Business Manager, Apple says Account
Holder-role changes may require contacting Apple, so document the relationship
and do not make the account dependent on one employee's personal Apple Account.

1. Install dependencies with `npm ci --force`. Expo 58 preview currently pairs a
   React Native release candidate with peer ranges that exclude prereleases; remove
   `--force` when the SDK publishes a stable React Native dependency graph. Use Node
   22 for parity with native CI.
2. Confirm `org.nyccsda.app` is the intended identifier in both stores. Configure
   the organization's Apple Developer/App Store Connect and Google Play accounts.
3. Decide the credential source before the first store build. This project uses
   GitHub-hosted Android credentials for direct Gradle builds and GitHub-hosted
   Apple credentials for direct Xcode builds. Keep an encrypted offline backup and
   credential recovery under church ownership.

## GitHub-hosted signing and submission credentials

GitHub-hosted credentials are the configuration for the direct-native Android and
iOS paths. Android uses environment variables in its config plugin. The direct iOS
workflow restores an Apple `.p12` and provisioning profile into temporary files,
imports the certificate into an ephemeral keychain, and uses Xcode's manual signing
settings. It does not create a credentials file or send signing material to another
build service.

The direct-native GitHub workflows store the keystore, `.p12`, and provisioning
profile as encrypted Environment secrets (usually base64-encoded), recreate them
in the runner's temporary directory, and delete them afterward. The iOS workflow
also deletes its temporary keychain and installed provisioning profile. Base64 is
only an encoding for binary files; the GitHub secret is the protection. Never echo
either the encoded or decoded value.

The current Android workflow needs only these four production Environment secrets:
`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
`ANDROID_KEY_PASSWORD`. `ANDROID_KEYSTORE_PATH` is deliberately not a stored
secret: the workflow creates the keystore at a fresh runner-temporary path and
passes that derived path to the build script. `EXPO_TOKEN` is not read by any
recommended workflow and should be removed after the PR that removes EAS support
has merged.

Use separate secrets rather than one large structured secret where practical:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
IOS_DISTRIBUTION_CERTIFICATE_BASE64
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD
IOS_PROVISIONING_PROFILE_BASE64
IOS_TEAM_ID
```

For automated submission from a GitHub Actions job, restore the Google Play
service-account JSON and App Store Connect `.p8` key in the same temporary-file
pattern. Keep submission credentials in a separate approved job; the current
workflows intentionally omit them. For a manual release, upload the finished
`.aab`/`.ipa` through the store consoles instead.

The production secret Environment should require reviewer approval, be
available only to protected `main` builds or deliberate manual dispatches from
`main`, and use
read-only repository permissions for the build job. Keep third-party Actions
pinned and review workflow changes before approving a signing run. The current
main-only guard is necessary but is not a substitute for these controls.

## iOS setup: GitHub-hosted direct builds

The separate `.github/workflows/native-ios-build.yml` workflow runs only on trusted
pushes to `main` or a manual dispatch from `main`. It has no pull-request or
`release/**` signing path, does not receive `EXPO_TOKEN`, and does not upload to App
Store Connect. It creates an IPA artifact for manual upload or TestFlight processing.

Before running it, configure these secrets in the protected `production`
Environment in the upstream repository:

```text
IOS_DISTRIBUTION_CERTIFICATE_BASE64
IOS_DISTRIBUTION_CERTIFICATE_PASSWORD
IOS_PROVISIONING_PROFILE_BASE64
IOS_TEAM_ID
```

`IOS_DISTRIBUTION_CERTIFICATE_BASE64` is a base64 encoding of a `.p12` that
contains the Apple Distribution certificate and its private key. The password is
the export password for that `.p12`. `IOS_PROVISIONING_PROFILE_BASE64` is a
base64 encoding of an App Store distribution provisioning profile for exactly
`org.nyccsda.app`. `IOS_TEAM_ID` is the church's Apple Developer Team ID. The
workflow validates the profile's team and application identifier before importing
anything into the temporary keychain.

On macOS, encode binary files without printing their contents to the terminal:

```sh
base64 -i /secure/location/nyccsda-distribution.p12 | tr -d '\n' | pbcopy
# Paste into IOS_DISTRIBUTION_CERTIFICATE_BASE64 in GitHub

base64 -i /secure/location/nyccsda-app-store.mobileprovision | tr -d '\n' | pbcopy
# Paste into IOS_PROVISIONING_PROFILE_BASE64 in GitHub
```

The workflow performs all of the following on the runner: installs dependencies,
generates the ignored iOS project with Expo prebuild, installs CocoaPods,
creates an ephemeral keychain, imports the `.p12`, installs the provisioning
profile, archives with Xcode, exports an App Store IPA, uploads only the IPA, and
deletes the certificate, profile, keychain, archive, and export files in an
`always()` cleanup step.

The iOS build number is the checked-in `expo.ios.buildNumber` value in `app.json`.
Both trusted push runs and manual dispatch use this same source of truth; there is no
separate Actions input or GitHub run-number fallback. Start at `1` for an app with no
prior App Store build, then have a code maintainer increase it before each later IPA
uploaded to App Store Connect. The build number is independent of the marketing
version in `app.json`; App Store Connect rejects a reused or lower build number.

The action intentionally has no App Store Connect API key. Upload the resulting
IPA manually first. Submission automation, if added later, must be a separate
reviewed job with separate credentials and environment approval.

## Android setup: GitHub-hosted direct builds

Complete these steps in order. The repository changes are ready, but the first
Android store build should not be run until the exact Play version code and
upload-key situation are confirmed.

### 1. Identify the key Google Play expects

Open Play Console → **Test and release → Setup → App integrity** and inspect
**App signing** and **Upload key certificate**.

- If this app has already had an AAB uploaded, keep using the matching upload
  private key. A newly generated key will not sign updates unless Google resets
  the upload key for the app.
- The Play Console's app-signing private key is held by Google and is not
  something to download; CI needs only the upload key. If an existing upload key
  was generated elsewhere, recover it from the church's encrypted backup rather
  than creating a replacement.
- If no release has ever been uploaded and there is no existing upload key,
  generate a new one as described below.
- If the current upload key is lost or compromised, use Play Console's upload
  key reset process. Do not silently create a second keystore and hope that
  Play accepts it.

### 2. Generate an upload key only when needed

Run this outside the repository, on an organization-controlled computer. Replace
the placeholder path with a protected location. Do not commit the `.jks` file.

```sh
umask 077
keytool -genkeypair -v \
  -storetype JKS \
  -keystore /path/outside/repo/nyccsda-upload.jks \
  -alias nyccsda-upload \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000

keytool -list -v \
  -keystore /path/outside/repo/nyccsda-upload.jks \
  -alias nyccsda-upload
```

Use a unique, long password for both the keystore and private key unless the
church's existing key uses different values. Save the file, alias, and
passwords in an encrypted organization password manager and in a separate
encrypted offline backup. The `.jks` is an upload key, not the Play app-signing
key. The `10000`-day validity is deliberate: Android upload keys do not need
annual rotation and should normally remain stable for the life of the app.

### 3. Set the Play version code explicitly

The `versionCode` must increase for every Google Play upload. It is independent
of the user-facing `version` string. Because this app has no uploaded bundle,
the first value is `1`:

```json
"android": {
  "versionCode": 1,
  "package": "org.nyccsda.app"
}
```

For the next release, change it to `2`. Keep the value in source control and
increment it deliberately with each release. Do not use a remote auto-increment
system and a checked-in local number at the same time.

### 4. Configure the protected GitHub Environment

In the church's **upstream** GitHub repository, open **Settings → Environments**
and create or select `production`. Require at least one reviewer, restrict the
deployment branch to the church's trusted `main` branch, and add
these Environment secrets:

```text
ANDROID_KEYSTORE_BASE64       # base64 of the JKS file
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS              # e.g. nyccsda-upload
ANDROID_KEY_PASSWORD
```

Use the Environment secret form—not **Repository secrets**—for these values.
Environment approval is the release gate that keeps a maintainer in the loop
before a job can use production signing material. If duplicate values currently
exist under Repository secrets, add the values to `production`, verify the
protected workflow uses that Environment, then delete the repository-level copies.

Create the base64 value locally and paste it into the secret without printing
the keystore or password. On macOS, for example:

```sh
base64 -i /path/outside/repo/nyccsda-upload.jks | tr -d '\n' | pbcopy
```

On Linux, use `base64 -w 0 /path/outside/repo/nyccsda-upload.jks` and paste the
output directly into GitHub. The workflow's `environment: production` setting
and main-only guard ensure that a pull request cannot read these values.
Review the workflow file before approving a protected run; anyone who can
change a trusted workflow and access its approval can potentially use its
secrets.

### 5. Build and verify before uploading

For ordinary local smoke testing, use the debug-signed APK. It does not need
the production upload keystore or any signing secrets:

```sh
npm ci --force
npm run build:android:apk:debug -- --output /tmp/nyccsda-local-preview.apk
```

The debug APK is suitable for installing on a test device, but it must never
be uploaded to Google Play. A truly unsigned APK is generally not installable.

Only a maintainer on a trusted machine should create a locally signed release
artifact. If that is necessary, set the four signing variables only in the
current terminal session. `ANDROID_KEYSTORE_PATH` points to the real JKS file;
the other values are the values recorded in the password manager:

```sh
export ANDROID_KEYSTORE_PATH=/path/outside/repo/nyccsda-upload.jks
export ANDROID_KEYSTORE_PASSWORD='paste-only-in-your-terminal'
export ANDROID_KEY_ALIAS='nyccsda-upload'
export ANDROID_KEY_PASSWORD='paste-only-in-your-terminal'

npm ci --force
npm run build:android:apk -- --output /tmp/nyccsda-preview.apk
npm run build:android -- --output /tmp/nyccsda-release.aab

unset ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD
```

Both paths regenerate the ignored Android project with Expo prebuild, apply the
committed signing plugin, invoke Gradle, and copy the result to the requested
path. The signed path refuses to build without an explicit `versionCode` or
complete signing values. The signed APK is useful for physical-device testing;
upload the AAB to Play Console.

Verify the artifact locally before uploading:

```sh
jarsigner -verify -verbose -certs /tmp/nyccsda-release.aab
```

Then run the same build through **Actions → Native Android build → Run workflow**
with Android selected. Download the artifact, upload it to an internal-testing
track first, and verify installation and an update over the previous build.
Do not enable automatic store submission until this manual internal-track
check succeeds.

### Android rotation and recovery policy

There is no annual Android upload-certificate expiration requirement. Keep the
same upload keystore indefinitely, rotate it only for a compromise, loss of
organizational control, or a deliberate security policy, and retain two
independent encrypted backups. If it must change, initiate the Google Play
upload-key reset and wait for Play to confirm the new certificate before using
the replacement in GitHub.

The Google Play service-account JSON is separate from the upload keystore and
is not required for manual uploads or compilation. Add it later only if upload
automation is worth the extra credential. Service-account keys do not have the
same annual certificate rule; rotate/revoke them when access changes or as an
organization policy requires.

## External account cleanup

The repository no longer contains EAS commands, EAS project metadata, or EAS
workflow configuration. Before deleting any external Expo account, confirm that
the church does not need its project history, exported credentials, or records.
Account deletion is separate from this repository change and is not performed
automatically.

This credential plan does not eliminate maintenance: protect the Android upload
keystore and keep an encrypted organizational backup; renew Apple distribution
certificates and provisioning profiles; revoke and replace compromised tokens;
and rotate the Google/Apple submission credentials when staff or access changes.
Apple provisioning profiles expire after 12 months, while Google Play can reset a
lost or compromised upload key. See [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en).

## Build commands

### Android direct-native commands

The Android scripts regenerate the ignored native project with Expo prebuild, apply
`plugins/withAndroidLocalSigning.js`, and invoke Gradle directly. Signed release
commands require the four `ANDROID_*` variables; the local preview command does not:

```sh
npm run build:android:apk -- --output /absolute/path/app.apk
npm run build:android -- --output /absolute/path/app.aab
npm run build:android:apk:debug -- --output /absolute/path/local-preview.apk
```

The signed commands require the four `ANDROID_*` signing environment variables and an
explicit `expo.android.versionCode`; see [Android setup](#android-setup-github-hosted-direct-builds).
The debug command uses Gradle's automatically generated debug key and does not require
or touch the production upload keystore. It creates a standalone APK for local device
testing and must never be uploaded to Google Play. A truly unsigned APK is generally
not installable.

The signed APK is for direct installation/testing, and the AAB is the Google Play artifact.

| Target | Recommended build path |
| --- | --- |
| iOS IPA (TestFlight/App Store) | **Native iOS build** workflow |
| Android AAB (Google Play) | `npm run build:android` |
| Android APK (direct installation) | `npm run build:android:apk` |
| Android APK (local debug key) | `npm run build:android:apk:debug` |

The direct Android commands output a binary on this computer; append
`--output /absolute/path/app.aab` or `.apk` to choose its destination. The
preview APK is standalone and does not require Metro. The direct iOS workflow
uses the App Store distribution profile and an explicit build number; internal
iOS distribution is not TestFlight.

Local iOS builds require macOS, Xcode with command-line tools, and CocoaPods. Local Android builds require macOS or Linux, Java 17, Android SDK/NDK
and accepted SDK licenses; install Android Studio and the SDK tooling required by
the Expo 58 preview dependency set. Configure `ANDROID_HOME` and the Android
command-line tools on PATH.
Direct Android and iOS compilation require network access for npm dependencies,
the Expo template, and CocoaPods, but not Expo authentication. They are not
offline build paths. Build one platform at a time.

In GitHub Actions, select **Native Android build → Run workflow** for an Android AAB
or APK. Select **Native iOS build → Run workflow** for an iOS IPA; its build number
comes from `expo.ios.buildNumber` in the selected branch's `app.json`. These workflows
become available in the Actions UI after they reach the default branch. Android compiles
directly with Gradle on Ubuntu 24.04 / Java 17; iOS compiles directly with Xcode
on macOS 15 / Xcode 26.2. Download the signed binaries from the run's Artifacts
section (14-day retention). Neither recommended workflow requires Expo
authentication.
GitHub compilation uses GitHub runner minutes/storage.
No selection performs no builds. Native failures do not block the web/PWA preview
deployment.

## Upload separately

For a downloaded store binary, upload the `.aab` manually through Google Play
Console or the `.ipa` through App Store Connect. These are not automatic public
releases. Make the first Google Play upload manually in Play Console before adding
submission automation. Apple builds are processed in App Store
Connect for TestFlight; choose testers and complete required beta review there.
Complete store listings and production review/release separately in each console.
An APK is for direct Android testing; upload an AAB for this app's Play listing.

## Versions and maintenance

`package.json` / `app.json` retain the shared user-facing release version managed by
`npm run sync-version`. That version should be changed explicitly for each planned
release, and release CI can synchronize it from the release PR title. Android direct
builds use the explicit checked-in `expo.android.versionCode`; the script refuses to
build until it exists. Before a Play upload, a code maintainer records the latest Play
value and chooses a higher number. Do not use a remote auto-increment system alongside
a checked-in local number. iOS builds use the explicit checked-in
`expo.ios.buildNumber` in `app.json`; the workflow passes it to Xcode as
`CURRENT_PROJECT_VERSION` for every trigger. Keep both platform counters maintained
by a code maintainer, and do not reuse or lower either store's build number.

Keep generated `ios/` and `android/` projects out of Git and express native
configuration through Expo config/plugins. SDK upgrades require checking
Node/Java/Xcode/Android tooling and revalidating physical-device behavior. The app
explicitly pins Android compile API 37, target API 36, and build tools 37.0.0 through
`expo-build-properties`. This split is intentional: the Expo preview's native AARs
require compile API 37, while Google Play currently requires new apps and updates to
target API 36 from August 31, 2026. Android's compile SDK and target SDK are separate;
compiling against API 37 does not opt the app into API 37 runtime behavior. The
workflow installs the versioned `platforms;android-37.0` package, matching the current
runner image, plus build tools and NDK. Revisit this preview-SDK pin when Expo ships a
compatible stable SDK and when the Android platform requirement changes.

Before release, run `npx expo install --check`, `npx expo-doctor`, and `npm run check`.
Then build and test signed binaries on physical iPhone and Android devices,
including the background-audio acceptance checks in
[native-store-investigation.md](native-store-investigation.md). Successful JavaScript
exports alone do not prove native compilation, signing, playback or store acceptance.
OTA updates are not configured by this setup; web/PWA preview deployments do not
update installed native apps.

Local builds are manageable for a maintainer comfortable installing SDK tools.
GitHub’s macOS runner lets you build iOS without
owning a Mac; update the runner/Xcode selection when GitHub retires that version. Both paths still need signing/account maintenance and
periodic store-required SDK updates.

## Research basis

This plan is based on the following primary documentation and the constraints of
this repository:

- [Expo local builds](https://docs.expo.dev/build-reference/local-builds/):
  `eas build --local` runs the compiler on the invoking machine, but still
  authenticates with Expo and can retrieve EAS-managed credentials. This is why
  it avoids EAS Cloud build capacity but does not meet a zero-token requirement.
- [Expo local credentials](https://docs.expo.dev/app-signing/local-credentials/):
  local credentials can be restored from CI secrets and kept out of source
  control. Android direct-native builds go one step further and let Gradle read
  temporary environment-provided signing values without creating
  `credentials.json` at all.
- [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
  and [config plugins](https://docs.expo.dev/config-plugins/introduction/):
  generated native directories can be recreated, so the signing behavior is
  implemented in `plugins/withAndroidLocalSigning.js` rather than an ignored
  hand edit to `android/app/build.gradle`.
- [Expo app credentials](https://docs.expo.dev/app-signing/app-credentials/)
  and [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en):
  Google protects the Play app-signing key while the developer controls an
  upload key. The upload key must remain stable for updates, can be reset by
  Google after compromise, and does not have an annual expiration requirement.
- [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
  and [standard runners](https://docs.github.com/en/actions/reference/runners/github-hosted-runners):
  standard GitHub-hosted runners are currently free for public repositories,
  including standard macOS runners. This supports using GitHub-hosted native
  compilation for this public open-source project, but is a current policy, not
  a guaranteed five-year promise; runner availability, concurrency, and fair-use
  limits still apply.
- [GitHub secret security](https://docs.github.com/en/actions/reference/security/secrets)
  and [secure use](https://docs.github.com/en/actions/reference/security/secure-use):
  secrets are encrypted and are not passed to fork pull requests, but workflow
  code that is allowed to read them can exfiltrate them. This justifies the
  protected Environment, reviewer approval, trusted-branch restrictions, fork
  guard, and reviewed third-party Actions in the workflow.
- [GitHub Actions general availability](https://github.blog/changelog/2019-11-11-github-actions-is-generally-available/):
  the public-repository free standard-runner policy has been part of the Actions
  product since its 2019 general availability. Its history supports treating
  the choice as established infrastructure, while the workflow's direct Gradle
  and Xcode commands keep the project portable if pricing or policy changes.
- [Expo SDK upgrade guidance](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/):
  SDK upgrades remain incremental maintenance. CNG reduces native-file drift,
  but every Expo/React Native, Java, Android SDK/NDK, Xcode, or runner-image
  change still requires a validation build and physical-device checks.

The conclusion is deliberately narrower than “GitHub is safe forever”: GitHub
is currently the lowest-footprint place for this church to hold the Android
upload key, and the direct build is easy to move because it uses standard
Gradle commands. The operational controls and the direct-native design are what
make that choice defensible.

References: [local EAS builds](https://docs.expo.dev/build-reference/local-builds/),
[CI setup](https://docs.expo.dev/build/building-on-ci/),
[version management](https://docs.expo.dev/build-reference/app-versions/),
[store submission](https://docs.expo.dev/deploy/submit-to-app-stores/).
