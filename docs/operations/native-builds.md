# Web and native builds

Website deployment remains automatic on pushes to `main`, or through `npm run deploy`.
Native builds are opt-in and do not publish to either store. The same Expo source
is used for all platforms.

## Building an independent fork

The checked-in configuration points to the church-owned Expo project and its
package identifiers. A third party must not use that project or its signing
credentials. Create an Expo account and a separate Expo project, then run
`eas login` and `eas init` in the fork. Replace `expo.extra.eas.projectId` and
the Expo owner in `app.json` with the new project values. Choose package and
bundle identifiers that the third party owns, and create their own Apple
Developer and Google Play accounts if they intend to distribute the apps.

An EAS account is required for this repository's current `eas build` workflow,
including `--local`, because the build configuration uses EAS project
authentication, remote versioning, and EAS-managed signing credentials. The
church's `EXPO_TOKEN` cannot be reused by an independent fork. A fork should
create its own Expo access token and GitHub Actions secret, or authenticate
locally with `eas login`.

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
5. Run the desired build command interactively once to configure signing. EAS can
   manage the Apple certificate/provisioning profile and Android keystore. Keep
   account access and credential recovery under church ownership.
6. For GitHub builds, save an Expo access token as the repository secret
   `EXPO_TOKEN`. Complete an interactive build for each target before using CI.

The global CLI is optional; the repository scripts and workflow remain pinned to
`eas-cli@23.2.0` for repeatable builds.

## GitHub Actions token

Create a token from the Expo dashboard at **Account settings → Access tokens**.
Copy it immediately; it is a secret and should not be committed or pasted into
workflow files. In GitHub, open the repository’s **Settings → Secrets and
variables → Actions → New repository secret**, enter `EXPO_TOKEN` as the name,
paste the token as the value, and save it. The workflow checks for this secret
before starting a build. A token from an account with access to the church-owned
Expo project is required.

For a local shell, set the token only for the current terminal session:

```sh
export EXPO_TOKEN='paste-token-here'
eas build --platform android --profile preview --local
```

Unset it when finished with `unset EXPO_TOKEN`. Never put the token in `.env`,
`app.json`, `eas.json`, or source control. If a token is exposed, revoke it in
the Expo dashboard and create a replacement.

## Optional GitHub-hosted signing credentials

You can keep signing material in GitHub instead of storing it on EAS. This is
supported, but it adds credential rotation and recovery work. EAS calls this
the `local` credentials source. Create a `credentials.json` file at build time
and set `credentialsSource: "local"` on a separate build profile. Do not commit
that file or the credential files themselves.

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

The GitHub workflow would store the keystore, `.p12`, and provisioning profile
as encrypted repository secrets (usually base64-encoded), recreate them in the
runner’s temporary directory, write `credentials.json` with values from secret
environment variables, run the build with the local-credentials profile, and
delete the files afterward. The secrets must never be echoed in logs. This
repository’s current workflow uses EAS-managed remote credentials; it does not
yet recreate or consume GitHub-hosted signing files.

Keeping credentials on GitHub can avoid EAS-hosted signing storage and EAS cloud
builds, but it does not eliminate Expo project authentication for the current
`eas build --local` path. A completely independent build would use generated
native projects, Gradle/Xcode, and GitHub secrets directly, with more native
configuration to maintain. Protect the Android keystore permanently, and plan
for Apple certificates and provisioning profiles to expire and be renewed.

## Build commands

### Confirmed local APK build

The Android preview profile has been successfully compiled locally and produced
an APK with:

```sh
eas build --platform android --profile preview --local
```

The command may also be given an explicit destination, for example
`--output /absolute/path/app.apk`. This confirms the local Android toolchain and
EAS project setup are sufficient to produce an installable preview APK. Some
remaining build-time errors are tracked separately and do not prevent this APK
workflow from completing.

| Target | EAS cloud | Compile on your computer |
| --- | --- | --- |
| iOS IPA (TestFlight/App Store) | `npm run build:ios:eas` | `npm run build:ios` |
| Android AAB (Google Play) | `npm run build:android:eas` | `npm run build:android` |
| Android APK (direct installation) | `npm run build:android:apk` | `npm run build:android:apk` |

Cloud commands print the build/download link. Local commands output a binary on
this computer; optionally append `--output /absolute/path/app.ipa` (or `.aab` /
`.apk`). The preview APK is standalone and does not require Metro. Use the
production iOS profile for TestFlight; internal iOS distribution is not TestFlight.

Local iOS builds require macOS, Xcode with command-line tools, CocoaPods and
fastlane. Local Android builds require macOS or Linux, Java 17, Android SDK/NDK
and accepted SDK licenses; install Android Studio and the SDK tooling required by
Expo SDK 55. Configure `ANDROID_HOME` and the Android command-line tools on PATH.
Windows local EAS builds are not officially supported; WSL is an untested option.
Local EAS compilation still requires Expo authentication/network access for project
verification, remote version numbers, managed credentials, and dependencies. It
is not an offline build path. Build one platform at a time with `--local`.

In GitHub Actions, select **Native binaries → Run workflow**, choose the source
branch/tag, and check any combination of iOS, Android AAB, and Android APK. The
workflow becomes available in the Actions UI after it reaches the default branch.
The workflow compiles with EAS local builds on GitHub runners:
Android uses Ubuntu 24.04 / Java 17 and iOS uses macOS 15 / Xcode 26.2.
Download the signed binaries from the run’s Artifacts section (14-day retention).
The workflow does not expose an EAS cloud-builder option. Direct EAS cloud commands
remain available as `npm run build:ios:eas` and `npm run build:android:eas`, but are
not recommended for the release path because they use Expo cloud build capacity and
are less tied to the repository's checked-in runner/toolchain configuration.
GitHub compilation uses GitHub runner minutes/storage. Expo authentication and
previously configured signing credentials are still required.
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
`npm run sync-version`. EAS remotely manages and auto-increments production iOS
build numbers and Android version codes, including builds started locally, so
rebuilding the same release creates a fresh store build number. If the identifiers
already have published builds, initialize EAS counters above the existing store
values with `npx eas-cli@23.2.0 build:version:set` before the first build.

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

References: [local EAS builds](https://docs.expo.dev/build-reference/local-builds/),
[CI setup](https://docs.expo.dev/build/building-on-ci/),
[version management](https://docs.expo.dev/build-reference/app-versions/),
[store submission](https://docs.expo.dev/deploy/submit-to-app-stores/).
