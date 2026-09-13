# Web and native builds

Website deployment remains automatic on pushes to `main` through the canonical GitHub
workflow. Local `npm run deploy` builds the web output without publishing it. Native
builds run on trusted `main`/`release/**` pushes or manual dispatches, have no pull
request trigger, and do not publish to either store. The same Expo source is used
for all platforms.

## Current migration status

Android is being moved to a zero-Expo-authentication build path. The repository
now contains a config plugin that teaches the generated Gradle project to use a
keystore supplied through environment variables, and `npm run build:android` /
`npm run build:android:apk` use `expo prebuild` followed by Gradle directly.
The GitHub workflow restores the Android upload keystore only inside the
protected `production` Environment. Android builds do not need an Expo account,
an Expo token, or EAS credential storage.

This is intentionally staged. iOS still uses the existing EAS CLI `--local`
path while its temporary keychain, certificate, provisioning-profile, and
export-options workflow is implemented and tested. Do not delete the church's
Expo project or account until both platforms have been migrated, store updates
have been verified, and any EAS-held credentials and version counters have been
exported or replaced. Deleting the account is not part of the Android setup.

The Play Console currently shows no uploaded app bundle, so `app.json` uses the
initial Android `versionCode` of `1`. The Android native build script refuses
to create a store binary unless this field remains explicit. Increase it to `2`,
`3`, and so on for later uploads; never reuse or lower a value already uploaded
to Google Play.

## Decision rationale and risk register

| Decision | Reason | Remaining risk / control |
| --- | --- | --- |
| Build Android with prebuild + Gradle | Removes Expo authentication and EAS credential custody from Android while using the public repository's free standard Linux runner | Expo template, Gradle, Java, SDK, and NDK updates still need periodic validation |
| Keep native directories ignored | Expo Continuous Native Generation makes `app.json` and config plugins the source of truth and avoids hand-edited generated files | A clean prebuild can overwrite manual native edits; keep native behavior in config/plugins |
| Store only the Android upload key in GitHub | Google retains the final Play app-signing key; CI needs only the upload key certificate/private key pair | A malicious trusted workflow could read secrets; protected Environment approval, branch restrictions, least privilege, and reviewed Actions are required |
| Do not rotate the Android key annually | Upload keys do not expire annually; keeping the same key preserves the Play update path | Maintain encrypted backups; use Play's upload-key reset process after loss or compromise |
| Keep EAS during this stage | iOS still uses EAS CLI `--local`, and EAS may contain the current Android upload key or remote version counters | Export/replace credentials and verify direct iOS TestFlight updates before deleting the account |
| Build artifacts but submit manually first | Compilation and signing can be automated without granting store-publishing access to every build | Upload the AAB to Play internal testing and verify an update before adding submission automation |
| Do not build signed binaries for fork PRs | GitHub does not pass secrets to fork pull requests, and trusted release credentials must not be exposed | Use unsigned/Linux checks for PRs; run signed builds only on protected branches or approved dispatches |

This is why the migration is not just “put the JKS in a GitHub secret.” The
keystore must be the key Google expects, the version code must be monotonic, the
workflow must restore and delete the secret safely, and the resulting AAB must
be tested as an update. These controls matter more than the build command itself.

## Credential-custody decision

The staged release pipeline compiles Android directly on a GitHub-hosted Linux
runner with Gradle. No EAS CLI, Expo authentication, or EAS Cloud build job is
involved in Android compilation. iOS still uses EAS CLI's **local-build mode** on
a GitHub-hosted macOS runner, so an Expo account and `EXPO_TOKEN` remain part of
the iOS control-plane footprint until the iOS direct-native path is complete.
Neither platform uses an EAS Cloud builder in the recommended workflow. See
Expo's [local-build documentation](https://docs.expo.dev/build-reference/local-builds/).

The intended credential boundary for the church-owned project is GitHub Actions, not
EAS credential storage:

| Credential | Custodian | CI location |
| --- | --- | --- |
| Expo project access (temporary iOS path) | Church Expo organization | Protected `EXPO_TOKEN` Environment secret |
| Android upload keystore | Church / Google Play account | Protected GitHub secret |
| Google Play service-account key | Church / Google Play account | Protected GitHub secret |
| Apple distribution certificate (`.p12`) | Church Apple Developer account | Protected GitHub secret |
| Apple App Store provisioning profile | Church Apple Developer account | Protected GitHub secret |
| App Store Connect API key (`.p8`) | Church App Store Connect account | Protected GitHub secret |

The Android keystore above is the **upload key**, not Google's Play app-signing key.
With Play App Signing, Google protects the final signing key and the CI pipeline only
needs the upload key. The App Store Connect `.p8` key is for submission automation;
it is separate from the Apple distribution certificate and provisioning profile.

EAS-hosted credentials are a valid convenience option: they centralize sharing and
make EAS Cloud builds easier. They are not required for this plan, and keeping them
out of EAS reduces the number of vendors that hold private signing or submission
material. Expo officially supports local credentials restored from CI secrets. See
[local credentials](https://docs.expo.dev/app-signing/local-credentials/) and
[EAS credential security](https://docs.expo.dev/app-signing/security/).

### Current versus target configuration

The Android direct-native path is now active in the repository. Its committed
config plugin changes only the generated `android/app/build.gradle`; it reads
`ANDROID_KEYSTORE_PATH`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, and
`ANDROID_KEY_PASSWORD` at Gradle runtime. The workflow decodes
`ANDROID_KEYSTORE_BASE64` into the runner's temporary directory, builds an AAB or
APK, uploads the artifact, and removes the keystore in an `always()` cleanup step.
The private key is never committed and never sent to EAS.

The iOS job still uses `eas build --local`, and `eas.json` still defaults to
EAS-hosted credentials and remote app-version state for that fallback. Before
removing EAS from the project, the iOS implementation must:

1. Restore an Apple distribution `.p12` and App Store provisioning profile only
   inside a protected GitHub job, using a temporary keychain.
2. Create an explicit `xcodebuild archive` and `xcodebuild -exportArchive` path,
   with an export-options plist generated from configuration rather than secrets
   committed to source.
3. Use a protected production Environment, required approval, and trusted branch
   or manual-dispatch guards for jobs that can read Apple signing secrets.
4. Commit an explicit iOS `buildNumber` policy after recording the current store
   counter. Until then, changing `appVersionSource` from `remote` would risk a
   duplicate or invalid store build number.
5. Keep the EAS fallback available until a TestFlight upload and update install
   have succeeded from the direct-native artifact.

The EAS scripts remain clearly labeled as fallback commands. They do not run in
the Android workflow, and the workflow does not expose an EAS Cloud-builder option.

The workflow's fork check is an important part of this boundary and must remain.
Secrets must be configured in the church's upstream repository/Environment; they are
not shared automatically with the CodeSammich fork.

### If zero Expo authentication is a hard requirement

The EAS CLI cannot satisfy a zero-token requirement: even `eas build --local`
requires Expo authentication. In that case, bypass EAS entirely on the runner:

1. Run `npx expo prebuild` to generate temporary `android/` and `ios/` projects.
2. Restore signing material from GitHub Environment secrets.
3. Build Android with Gradle (`bundleRelease`/`assembleRelease`).
4. Build and export iOS with Xcode (`xcodebuild archive` and
   `xcodebuild -exportArchive`).
5. Delete native projects and signing files after the job.

This removes the Expo account and token, but it is not a package-only change. The
workflow must own Android signing configuration, an iOS temporary keychain and
export options, version-code/build-number injection, and store upload commands.
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
also require dependency changes and a new prebuild validation. Use this route if
removing Expo authentication is worth owning those tasks; it is not required to
avoid EAS Cloud build capacity.

## GitHub Actions minutes and maintenance

For a public repository, standard GitHub-hosted runners—including standard macOS
runners—are currently free. For a private repository, GitHub Free and GitHub Free
for organizations currently include 2,000 standard-runner minutes per month. macOS
has a substantially higher private-repository billing rate than Linux, so budget an
iOS minute as roughly ten Linux-equivalent minutes. The exact allowance and rates
belong to the repository owner's GitHub plan; check [GitHub Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
before relying on a quota.

The present native workflow can run three jobs on a `main` push: iOS, Android AAB,
and Android APK. A rough private-repository estimate is:

```text
Linux-equivalent minutes per run ≈ (iOS minutes × 10) + Android AAB minutes + Android APK minutes
```

For example, a 20-minute iOS build plus 15-minute AAB and 10-minute APK builds is
about 225 Linux-equivalent minutes. Four such release runs would be approximately
900 minutes. This is an estimate, not a measured guarantee; use completed workflow
durations from GitHub's Actions usage view. Keep signed production builds manual or
restricted to release branches, add concurrency cancellation, retain artifacts only
as long as needed, and configure GitHub to stop usage at the account budget rather
than silently incur charges.

The current `Native binaries` workflow has no `pull_request` trigger, so it does not
start a macOS build for every PR or every new commit pushed to a PR. If a future
workflow adds PR iOS builds, plan approximately as follows for a private GitHub Free
organization, assuming the rough 10× macOS billing weight:

| iOS runner time | Approximate iOS builds from 2,000 Linux-equivalent minutes |
| ---: | ---: |
| 10 minutes | 20 |
| 20 minutes | 10 |
| 30 minutes | 6 |
| 45 minutes | 4 |

These counts exclude Android jobs and other workflows, and every pushed revision or
manual rerun counts as another job. For that reason, PR validation should normally
use the existing Linux checks; reserve signed iOS builds for manual dispatch or a
release branch, and optionally add a narrow path filter for changes to app config,
native dependencies, or config plugins. If the upstream repository is public, the
standard macOS runner is currently free and unlimited, though concurrency and fair-use
limits still apply. See [GitHub's runner reference](https://docs.github.com/en/actions/reference/runners/github-hosted-runners).

The EAS-local and zero-token approaches have similar platform-tool maintenance:

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
deliberate update when GitHub retires that image. EAS local remains the lower-
maintenance choice because it supplies the build orchestration while the runner
still owns the compiler and all GitHub Actions usage.

## Expo 58 canary Android prebuild

This branch uses the Expo 58 canary. Until the SDK 58 template is published under
the `sdk-58` npm tag, automatic prebuild can fail while resolving
`expo-template-bare-minimum@sdk-58`. Generate the Android project with the exact
canary template instead:

```sh
source ~/.nvm/nvm.sh
nvm use 24
npm install
npx expo prebuild \
  --template expo-template-bare-minimum@58.0.0-canary-20260902-26df09e \
  --platform android
```

The direct-native script intentionally regenerates the ignored Android project
from this template. Do not hand-edit `android/`; put durable changes in
`app.json` or a config plugin. A manual prebuild can use:

```sh
npx expo prebuild \
  --template expo-template-bare-minimum@58.0.0-canary-20260902-26df09e \
  --platform android \
  --no-install
```

Then use `npm run build:android` or `npm run build:android:apk`; those scripts
run the prebuild automatically. The EAS command remains an explicit fallback
and still requires Expo authentication.

If the canary version changes, update the template version in this section to the
matching `expo` canary before regenerating native files.

## Building an independent fork

The checked-in configuration points to the church-owned Expo project and its
package identifiers. A third party must not use that project or its signing
credentials. Create an Expo account and a separate Expo project, then run
`eas login` and `eas init` in the fork. Replace `expo.extra.eas.projectId` and
the Expo owner in `app.json` with the new project values. Choose package and
bundle identifiers that the third party owns, and create their own Apple
Developer and Google Play accounts if they intend to distribute the apps.

An EAS account is required for this repository's current `eas build` workflow,
including `--local`, because EAS CLI authenticates the project before building.
The church's `EXPO_TOKEN` cannot be reused by an independent fork. A fork should
create its own Expo access token and GitHub Actions secret, or authenticate
locally with `eas login`. The church project uses local compilation and plans to
keep signing and submission credentials outside EAS; an independent fork must
still provide its own credentials.

EAS is not strictly required to compile the generated native projects. An
experienced maintainer can generate them with `npx expo prebuild`, then build
Android with Gradle and iOS with Xcode on macOS. That route requires the
maintainer to own and manage the Android keystore, Apple certificates and
provisioning profiles, app identifiers, native configuration, and any future
native regeneration. It is therefore a separate fork workflow, not a drop-in
replacement for the repository's current EAS/local-build scripts. Do not copy
the church's signing files, Expo token, or store credentials.

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

The account steps below describe the temporary iOS/EAS fallback and the store
accounts themselves. Android direct compilation does not require an Expo
account; follow [Android setup](#android-setup-github-hosted-direct-builds) for
its build credentials.

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

1. Install dependencies with `npm ci`. Use Node 22 for parity with native CI.
2. Install the pinned EAS CLI globally if you want the shorter `eas` command:
   `npm install --global eas-cli@23.2.0`. Verify with `eas --version`.
3. Run `eas login`, then `eas init` and select/create
   the church-owned Expo project. Commit the resulting `extra.eas.projectId` and
   any owner configuration in `app.json`. Do not substitute a made-up project ID.
4. Confirm `org.nyccsda.app` is the intended identifier in both stores. Configure
   the organization's Apple Developer/App Store Connect and Google Play accounts.
5. Decide the credential source before the first store build. This project uses
   GitHub-hosted Android credentials for direct Gradle builds. The current iOS
   EAS-local fallback may still use its existing EAS credential setup; the future
   direct iOS path will restore credentials from GitHub. Keep an encrypted offline
   backup and credential recovery under church ownership.
6. Create a least-privileged Expo robot-user token for CI only if the temporary
   iOS EAS-local path is still enabled. Save it as the protected GitHub
   Environment secret `EXPO_TOKEN`. Complete an interactive local build for each
   target before enabling the production workflow.

The global CLI is optional; the repository scripts and workflow remain pinned to
`eas-cli@23.2.0` for repeatable builds.

## GitHub Actions token

Create a least-privileged **robot user** and access token in the church-owned Expo
organization/project only for the temporary iOS EAS-local path. Robot users are
intended for programmatic CI access and do not depend on a particular employee's
personal Expo login. Store the token as the protected production Environment
secret `EXPO_TOKEN`, not as a value in a workflow file. See Expo's [programmatic
access documentation](https://docs.expo.dev/accounts/programmatic-access/).

The token authenticates EAS CLI and permits project verification. It does not
contain the Android keystore, Apple signing certificate, provisioning profile,
Google Play service-account key, or App Store Connect API key. It also does not
turn `eas build --local` into an EAS Cloud build.

The current workflow checks for `EXPO_TOKEN` only before an iOS EAS-local build.
The Android direct-native job does not use it. The workflow references the
protected Environment and restricts secret-reading jobs to trusted
`main`/`release/**` pushes or manually approved dispatches. Never expose this
token to a pull request from a fork. GitHub does not automatically share secrets
between the church's upstream repository and the CodeSammich fork.

For a local shell, set the token only for the current terminal session:

```sh
export EXPO_TOKEN='paste-token-here'
eas build --platform ios --profile production --local
```

Unset it when finished with `unset EXPO_TOKEN`. Never put the token in `.env`,
`app.json`, `eas.json`, or source control. If a token is exposed, revoke it in
the Expo dashboard and create a replacement.

## GitHub-hosted signing and submission credentials

GitHub-hosted credentials remain the planned configuration for the future direct
iOS path, and are also a valid EAS-local fallback. EAS calls this the `local`
credentials source. Create a `credentials.json` file at build time and set
`credentialsSource: "local"` on the relevant EAS profile. Do not commit that file
or the credential files themselves. Expo documents this CI pattern, including
restoring base64-encoded files from CI secrets, in its [local credentials
guide](https://docs.expo.dev/app-signing/local-credentials/). Android direct
builds do not create `credentials.json`; they use the environment variables in
the Android config plugin.

The file contains paths and secrets similar to:

```json
{
  "android": {
    "keystore": {
      "keystorePath": "android-release.keystore",
      "keystorePassword": "ANDROID_KEYSTORE_PASSWORD",
      "keyAlias": "ANDROID_KEY_ALIAS",
      "keyPassword": "ANDROID_KEY_PASSWORD"
    }
  },
  "ios": {
    "distributionCertificate": {
      "path": "ios-distribution.p12",
      "password": "IOS_CERTIFICATE_PASSWORD"
    },
    "provisioningProfile": {
      "path": "ios-profile.mobileprovision"
    }
  }
}
```

The GitHub workflow will store the keystore, `.p12`, and provisioning profile as
encrypted Environment secrets (usually base64-encoded), recreate them in the
runner's temporary directory, write `credentials.json` with values from secret
environment variables, run the build with the local-credentials profile, and
delete the files afterward. Base64 is only an encoding for binary files; the
GitHub secret is the protection. Never echo either the encoded or decoded value.

Use separate secrets rather than one large structured secret where practical:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
IOS_DISTRIBUTION_P12_BASE64
IOS_DISTRIBUTION_P12_PASSWORD
IOS_PROVISIONING_PROFILE_BASE64
EXPO_TOKEN
```

For automated submission from a GitHub Actions job, restore the Google Play
service-account JSON and App Store Connect `.p8` key in the same temporary-file
pattern. EAS Submit supports local paths such as `serviceAccountKeyPath` and
`ascApiKeyPath` in `eas.json`; those paths may be committed, but the files must
not be. Do not use EAS-hosted Workflows for this path, because those workflows
run on EAS infrastructure and are designed around credentials available to EAS.
For a manual release, omit these submission secrets and upload the finished
`.aab`/`.ipa` through the store consoles instead. See the [EAS configuration
reference](https://docs.expo.dev/eas/json/) and [submission guide](https://docs.expo.dev/deploy/submit-to-app-stores/).

The production secret Environment should require reviewer approval, be
available only to protected branches or deliberate manual dispatches, and use
read-only repository permissions for the build job. Keep third-party Actions
pinned and review workflow changes before approving a signing run. The current
fork check is necessary but is not a substitute for these controls.

EAS-hosted credentials remain a valid fallback if GitHub secret restoration
becomes operationally burdensome. Their advantages are centralized team sharing
and EAS-managed credential workflows; their cost is an additional vendor trust
boundary. They are not necessary for this project's local-build design.

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
- If EAS generated or stores the current upload key, export it before removing
  EAS. Use the EAS credentials screen/CLI to download the Android keystore and
  record its alias and passwords in the church password manager. The Play
  Console's app-signing private key is held by Google and is not something to
  download; CI needs only the upload key.
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
increment it deliberately with each release. Do not use EAS's remote
auto-increment and a checked-in local number at the same time.

### 4. Configure the protected GitHub Environment

In the church's **upstream** GitHub repository, open **Settings → Environments**
and create or select `production`. Require at least one reviewer, restrict the
deployment branch to the church's trusted `main`/`release/**` branches, and add
these Environment secrets:

```text
ANDROID_KEYSTORE_BASE64       # base64 of the JKS file
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS              # e.g. nyccsda-upload
ANDROID_KEY_PASSWORD
```

Create the base64 value locally and paste it into the secret without printing
the keystore or password. On macOS, for example:

```sh
base64 -i /path/outside/repo/nyccsda-upload.jks | tr -d '\n' | pbcopy
```

On Linux, use `base64 -w 0 /path/outside/repo/nyccsda-upload.jks` and paste the
output directly into GitHub. The workflow's `environment: production` setting
and fork guard ensure that a normal fork pull request cannot read these values.
Review the workflow file before approving a protected run; anyone who can
change a trusted workflow and access its approval can potentially use its
secrets.

### 5. Build and verify before uploading

For a local smoke test, set the four signing variables only in the current
terminal session. `ANDROID_KEYSTORE_PATH` points to the real JKS file; the
other values are the values recorded in the password manager:

```sh
export ANDROID_KEYSTORE_PATH=/path/outside/repo/nyccsda-upload.jks
export ANDROID_KEYSTORE_PASSWORD='paste-only-in-your-terminal'
export ANDROID_KEY_ALIAS='nyccsda-upload'
export ANDROID_KEY_PASSWORD='paste-only-in-your-terminal'

npm ci
npm run build:android:apk -- --output /tmp/nyccsda-preview.apk
npm run build:android -- --output /tmp/nyccsda-release.aab

unset ANDROID_KEYSTORE_PATH ANDROID_KEYSTORE_PASSWORD ANDROID_KEY_ALIAS ANDROID_KEY_PASSWORD
```

The script regenerates the ignored Android project with Expo prebuild, applies
the committed signing plugin, invokes `bundleRelease` for the AAB or
`assembleRelease` for the APK, and copies the result to the requested path. It
refuses to build without an explicit `versionCode` or complete signing values.
The APK is useful for physical-device testing; upload the AAB to Play Console.

Verify the artifact locally before uploading:

```sh
jarsigner -verify -verbose -certs /tmp/nyccsda-release.aab
```

Then run the same build through **Actions → Native binaries → Run workflow**
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
organization policy requires. The Expo token is also unnecessary for Android
after this migration.

## EAS retirement checklist

Do not delete the Expo account as the next Android step. Retire it only after
all of the following are true:

1. The Android upload keystore, alias, passwords, and encrypted backups are
   confirmed. If EAS held the only copy, export it before account deletion.
2. The current Google Play version code and any EAS remote counters are recorded.
3. A direct-native Android AAB has passed Play internal testing and installed as
   an update over the previous Android build.
4. The direct-native iOS workflow has replaced EAS local builds, including a
   temporary keychain, Apple distribution certificate, provisioning profile,
   export-options plist, build-number policy, and a successful TestFlight
   upload/update test.
5. No GitHub workflow, release script, or maintainer procedure still requires
   `EXPO_TOKEN`, `eas.json`, `extra.eas.projectId`, or the Expo owner. Remove
   those references in a separate reviewed change and run the repository checks.
6. The church has decided that losing Expo project history, remote counters,
   fallback build capability, and any EAS metadata is acceptable. Preserve an
   export of the relevant project/configuration records first.

Until this checklist is complete, deleting EAS would turn a recoverable migration
into a preventable release or update outage. The Android path itself is already
independent, so keeping EAS temporarily costs only the small iOS control-plane
footprint and preserves a fallback while iOS is migrated.

This credential plan does not eliminate maintenance: protect the Android upload
keystore and keep an encrypted organizational backup; renew Apple distribution
certificates and provisioning profiles; revoke and replace compromised tokens;
and rotate the Google/Apple submission credentials when staff or access changes.
Apple provisioning profiles expire after 12 months, while Google Play can reset a
lost or compromised upload key. See [Expo app credentials](https://docs.expo.dev/app-signing/app-credentials/)
and [Google Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756?hl=en).

## Build commands

### Android direct-native commands

The Android scripts now bypass EAS entirely. They generate the ignored native
project, apply `plugins/withAndroidLocalSigning.js`, and invoke Gradle directly:

```sh
npm run build:android:apk -- --output /absolute/path/app.apk
npm run build:android -- --output /absolute/path/app.aab
```

Both commands require the four `ANDROID_*` signing environment variables and an
explicit `expo.android.versionCode`; see [Android setup](#android-setup-github-hosted-direct-builds).
The APK is for direct installation/testing. The AAB is the Google Play artifact.

| Target | EAS cloud fallback | Compile on your computer |
| --- | --- | --- |
| iOS IPA (TestFlight/App Store) | `npm run build:ios:eas` | `npm run build:ios` |
| Android AAB (Google Play) | `npm run build:android:eas` | `npm run build:android` |
| Android APK (direct installation) | `npm run build:android:eas` with a preview profile | `npm run build:android:apk` |

The `:eas` Android command remains an explicit cloud fallback and requires Expo
authentication. Direct commands output a binary on this computer; append
`--output /absolute/path/app.aab` or `.apk` to choose its destination. The
preview APK is standalone and does not require Metro. Use the production iOS
profile for TestFlight; internal iOS distribution is not TestFlight.

Local iOS builds require macOS, Xcode with command-line tools, CocoaPods and
fastlane. Local Android builds require macOS or Linux, Java 17, Android SDK/NDK
and accepted SDK licenses; install Android Studio and the SDK tooling required by
Expo SDK 55. Configure `ANDROID_HOME` and the Android command-line tools on PATH.
Windows local EAS builds are not officially supported; WSL is an untested option.
Direct Android compilation requires network access for npm dependencies and the
Expo template, but not Expo authentication. It is not an offline build path.
The iOS EAS-local fallback still requires Expo authentication/network access for
project verification and may use remote version state and managed credentials.
Build one platform at a time.

In GitHub Actions, select **Native binaries → Run workflow**, choose the source
branch/tag, and check any combination of iOS, Android AAB, and Android APK. The
workflow becomes available in the Actions UI after it reaches the default branch.
The workflow compiles Android directly with Gradle on Ubuntu 24.04 / Java 17 and
still compiles iOS with EAS local on macOS 15 / Xcode 26.2.
Download the signed binaries from the run’s Artifacts section (14-day retention).
The workflow does not expose an EAS cloud-builder option. Android jobs require
only the protected GitHub Android secrets; the iOS job still requires
`EXPO_TOKEN` and its current EAS-local credential setup. The explicit `:eas`
commands remain available as fallbacks, but are not recommended for the release
path because they use Expo cloud build capacity.
GitHub compilation uses GitHub runner minutes/storage.
No selection performs no builds. Native failures do not block website deployment.

## Upload separately

For a downloaded or locally compiled store binary:

```sh
npm run submit:ios -- --path /absolute/path/app.ipa
npm run submit:android -- --path /absolute/path/app.aab
```

These are interactive uploads, not automatic public releases. Configure submission
credentials when prompted. Make the first Google Play upload manually in Play
Console before using its submission API. Apple builds are processed in App Store
Connect for TestFlight; choose testers and complete required beta review there.
Complete store listings and production review/release separately in each console.
An APK is for direct Android testing; upload an AAB for this app's Play listing.

## Versions and maintenance

`package.json` / `app.json` retain the existing shared release version managed by
`npm run sync-version`. Android direct builds use the explicit checked-in
`expo.android.versionCode`; the script refuses to build until it exists. Before
adding it, record the latest Play value and choose a higher number. Do not use
EAS remote auto-increment and a checked-in local number for the same platform.
The iOS EAS fallback still uses its existing remote version behavior until the
direct iOS path is complete. Record both store counters before changing either
platform's version source; a duplicate or lower store build number will be
rejected.

The CLI is pinned in package scripts, `eas.json`, and the workflow; update these
together. Keep generated `ios/` and `android/` projects out of Git and express
native configuration through Expo config/plugins. SDK upgrades require checking
Node/Java/Xcode/Android tooling and revalidating physical-device behavior. The old
custom Android Gradle override is no longer enabled; SDK defaults govern Kotlin,
minimum SDK, compile SDK and target SDK.

Before release, run `npx expo install --check`, `npx expo-doctor`, and `npm run check`.
Then build and test signed binaries on physical iPhone and Android devices,
including the background-audio acceptance checks in
[native-store-investigation.md](native-store-investigation.md). Successful JavaScript
exports alone do not prove native compilation, signing, playback or store acceptance.
OTA updates are not configured by this setup; website deployments do not update
installed native apps.

Local builds are manageable for a maintainer comfortable installing SDK tools.
Cloud builds avoid most host-tool maintenance and are the easier fallback,
especially without a Mac. GitHub’s macOS runner also lets you build iOS without
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
Gradle commands. The operational controls and the staged EAS retirement are what
make that choice defensible.

References: [local EAS builds](https://docs.expo.dev/build-reference/local-builds/),
[CI setup](https://docs.expo.dev/build/building-on-ci/),
[version management](https://docs.expo.dev/build-reference/app-versions/),
[store submission](https://docs.expo.dev/deploy/submit-to-app-stores/).
