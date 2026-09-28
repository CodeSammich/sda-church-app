# App Store and Google Play setup

How the church's store accounts, app records, and signing files are set up, and
what has to be renewed each year to keep the app published and updatable. For how
the build workflows use these files, see [Build Instructions](native-builds.md).
For who owns each account, see
[App stores in the architecture doc](../architecture.md#app-stores).

> [!WARNING]
> **Keep account-specific values out of this repository.** That means the Apple
> Team ID, personal or church email addresses, certificate (`.p12`) and
> provisioning profile (`.mobileprovision`) files, keystores, and every password.
> Use placeholders in documentation, and never commit signing files or secrets.
> Signing values live only in the protected `production` GitHub Environment.

## Contents

- [Apple App Store](#apple-app-store)
  - [App identifiers and App Store Connect](#app-identifiers-and-app-store-connect)
  - [Create an Apple Distribution certificate](#create-an-apple-distribution-certificate)
  - [Create the App Store provisioning profile](#create-the-app-store-provisioning-profile)
  - [Add the signing values to GitHub Actions](#add-the-signing-values-to-github-actions)
  - [Yearly Apple renewals](#yearly-apple-renewals)
- [Google Play](#google-play)
  - [Create the nonprofit organization account](#create-the-nonprofit-organization-account)
  - [Add the other administrators](#add-the-other-administrators)
  - [Create the app and complete its declarations](#create-the-app-and-complete-its-declarations)
  - [Signing and the first upload](#signing-and-the-first-upload)
  - [Testing and release tracks](#testing-and-release-tracks)
  - [Yearly Google Play upkeep](#yearly-google-play-upkeep)

## Apple App Store

### App identifiers and App Store Connect

- Register the iOS app with the explicit Bundle ID `org.nyccsda.app`.
- The App ID description is an internal label in the Apple Developer portal. The
  App Store listing's name and description are set separately in App Store
  Connect.
- When creating the App Store Connect app record, use a unique internal **SKU**.
  Users never see it.
- Select **iOS/iPadOS**, unless the church also plans a separate Mac app.
- Enable capabilities and services on the App ID only when the app actually uses
  them. Turning on an option in the portal adds nothing by itself: Siri support,
  for example, also needs the app features that use it.
- App Store Connect **user access** controls what each team member can manage.
  Give **Full Access** only to someone who needs to manage everything; choose
  **Limited Access** otherwise.

### Create an Apple Distribution certificate

App Store and TestFlight uploads are signed with an **Apple Distribution**
certificate.

On the Mac that will hold the signing key:

1. Open **Keychain Access → Certificate Assistant → Request a Certificate from a
   Certificate Authority**.
2. Enter a church-managed email address that will stay available.
3. Enter a descriptive **Common Name**, such as `NYCCSDA App Store Distribution`.
   It only labels the key; it doesn't set the app's name.
4. Leave **CA Email Address** blank, choose **Saved to disk**, and keep the default
   key-pair settings.
5. Save the `.certSigningRequest` file.

The request contains the public key. The matching private key stays in that
Mac's Keychain, so keep access to that Mac until the issued certificate is
installed and exported.

In the Apple Developer portal, open **Certificates, Identifiers & Profiles →
Certificates → +**, choose **Apple Distribution**, and upload the request.
Download the resulting `.cer` file and open it **on the same Mac** that created
the request. In Keychain Access, under **My Certificates**, check that the
certificate appears with its private key beneath it.

Export that identity as a password-protected `.p12` file. The `.p12` contains the
private key that signs builds, so anyone with both the file and its password can
sign builds as the church. Keep the file in a restricted location, use a strong
export password, and store the password separately from the file, for example in
the church's password manager.

Apple references:

- [Create a certificate signing request](https://developer.apple.com/help/account/certificates/create-a-certificate-signing-request)
- [Export and protect signing identities](https://developer.apple.com/documentation/Xcode/sharing-your-teams-signing-certificates)

### Create the App Store provisioning profile

In **Certificates, Identifiers & Profiles → Profiles → +**:

1. Under **Distribution**, choose **App Store Connect**.
2. Select the App ID for `org.nyccsda.app`.
3. Select the Apple Distribution certificate created above.
4. Give the profile a recognizable internal name, such as
   `NYCCSDA App Store Distribution`.
5. Generate and download the `.mobileprovision` file.

The provisioning profile is a separate file from the `.p12`. It ties the app's
App ID to the distribution certificate, so it must be regenerated whenever the
certificate is replaced.

Apple reference:
[Create an App Store Connect provisioning profile](https://developer.apple.com/help/account/provisioning-profiles/create-an-app-store-provisioning-profile)

### Add the signing values to GitHub Actions

The iOS build workflow (`.github/workflows/native-ios-build.yml`) reads four
secrets from the GitHub Environment named `production`. Add them under
**Repository → Settings → Environments → production → Environment secrets**, not
as repository secrets:

| Secret | Value |
| --- | --- |
| `IOS_DISTRIBUTION_CERTIFICATE_BASE64` | Base64 text of the `.p12` file |
| `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD` | The password used when exporting the `.p12` |
| `IOS_PROVISIONING_PROFILE_BASE64` | Base64 text of the `.mobileprovision` file |
| `IOS_TEAM_ID` | The church's Apple Developer Team ID, from **Membership details** in the Apple Developer account. Don't write the real value in this repository. |

Encode each file without printing it. On Windows, in PowerShell, this copies the
Base64 text straight to the clipboard:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\certificate.p12")) | Set-Clipboard
# Paste into IOS_DISTRIBUTION_CERTIFICATE_BASE64

[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\path\to\profile.mobileprovision")) | Set-Clipboard
# Paste into IOS_PROVISIONING_PROFILE_BASE64
```

Afterwards, copy something else so the certificate text doesn't stay on the
clipboard. If Windows clipboard history (**Win + V**) is on, clear it too. For
macOS, see the commands in
[iOS setup](native-builds.md#ios-setup-github-hosted-direct-builds).

The workflow checks that the profile belongs to `IOS_TEAM_ID` and to
`org.nyccsda.app` before importing anything, and deletes every signing file when
it finishes. It runs only for commits on `main`, or a manual run from `main`, so
the first signed build happens when a release reaches `main`. It produces an IPA
artifact; uploading it to App Store Connect is a separate manual step (see
[Uploading to the stores](admin-runbook.md#uploading-to-the-stores)). Each upload
needs a higher `expo.ios.buildNumber` in `app.json`.

### Yearly Apple renewals

Three things expire every year. Put each date in the church calendar with a
reminder about a month ahead.

1. **Developer Program membership and the fee waiver.** Because the church is a
   recognized nonprofit, Apple waives the $99 annual fee. The waiver isn't
   permanent: when the membership comes up for renewal, the **Account Holder**
   must confirm that the church is still eligible. Renewal opens 30 days before
   the expiration date. To stay eligible, the church must remain a recognized
   nonprofit (in the U.S., by the IRS), and the app must stay free, with no paid apps, in-app
   purchases, or sales of digital goods. If the membership lapses, the app is
   removed from the App Store (copies already installed keep working) and no
   updates can be uploaded until it's renewed. See Apple's
   [fee waiver requirements](https://developer.apple.com/help/account/membership/fee-waivers/)
   and [program renewal](https://developer.apple.com/help/account/membership/renewal/).
2. **The Apple Distribution certificate** is valid for one year. When it expires,
   the app already on the App Store keeps working, but new builds can't be
   uploaded. Before it expires, create a replacement: a new certificate request,
   certificate, and `.p12`, as above.
3. **The provisioning profile** depends on the certificate. Generate a new
   App Store profile with the new certificate.

After replacing the certificate and profile, update
`IOS_DISTRIBUTION_CERTIFICATE_BASE64`, `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`
and `IOS_PROVISIONING_PROFILE_BASE64` in the `production` Environment.
`IOS_TEAM_ID` doesn't change. Then run **Actions → Native iOS build → Run
workflow** from `main` to confirm that signing still works. Once the new
certificate works, revoke the old one in the Apple Developer portal. A revoked
certificate doesn't affect the app already on the App Store, but builds signed
with it that are uploaded and not yet submitted may be marked invalid.

## Google Play

### Create the nonprofit organization account

The church publishes from one Google Play **organization** account, registered as
a **Non-profit** on the `nyccsda.org` Google Workspace domain. Don't create a
personal account: a personal account shows a person's name and address in the
store, can't be registered as the church, and new personal accounts must run a
closed test with 12 testers for 14 days before they can publish.

**Have these ready before you start:**

- **A church administrator's own `nyccsda.org` Workspace account** to sign up
  with. Play Console only offers **Sign in with Google**, so it needs a real
  user; the `technology@nyccsda.org` group can't sign in (see
  [Google Workspace for Nonprofits](../architecture.md#google-workspace-for-nonprofits)).
  This account becomes the developer account's **owner**. Ownership can be
  transferred later; see
  [Google Play Console recovery](native-builds.md#google-play-console).
- **The church's D-U-N-S number**, with the church's legal name and address
  exactly as Dun & Bradstreet has them. Use the church's own number, not the
  conference's.
- **The church website**, `https://nyccsda.org`, verified in
  [Google Search Console](https://search.google.com/search-console) by a DNS TXT
  record in Cloudflare (see [Cloudflare](../architecture.md#cloudflare)). Verify it
  with the same account that will own the Play developer account.
- **A church credit or debit card** for the one-time US$25 registration fee.
  Prepaid cards aren't accepted. There's no nonprofit waiver for this fee, and no
  yearly fee.
- **A church phone number** that stays in service.

**Sign up:**

1. Sign in to [Play Console sign-up](https://play.google.com/console/signup) with
   the administrator's `nyccsda.org` account.
2. Choose **Organization** as the account type, then **Non-profit** as the
   organization type, and the organization size.
3. Create the **Google payments profile** as an organization, with the church's
   legal name, address and D-U-N-S number exactly as in D&B. Google checks them
   against each other, and a mismatch stalls verification.
4. Enter the **contact details** Google uses to reach the church. Use
   `technology@nyccsda.org` as the contact email, so every administrator gets
   account notices, plus the church phone. Both are confirmed with a one-time code.
5. Enter the **developer details shown publicly on Google Play:** the developer
   name (the church's name as members know it), a developer email
   (`technology@nyccsda.org` works), the church phone, and
   `https://nyccsda.org` as the website. Google displays the legal name, legal
   address, developer email and developer phone on the store listing, so use
   church contact details, not anyone's personal ones.
6. Accept the **Google Play Developer Distribution Agreement** and pay the US$25
   fee.
7. Complete the **identity verification** Google asks for. It may ask for the
   owner's government ID, or documents showing the church's nonprofit status and
   the owner's authority to act for it. Verification can take several days.
8. After the account is active, finish **website verification** in Play Console.
   It works only once `nyccsda.org` is verified in Search Console under the same
   account.

Google's references:
[choose a developer account type](https://support.google.com/googleplay/android-developer/answer/13634885),
[required account information](https://support.google.com/googleplay/android-developer/answer/13628312),
[get started with Play Console](https://support.google.com/googleplay/android-developer/answer/6112435),
and the [testing requirement for new personal accounts](https://support.google.com/googleplay/android-developer/answer/14151465)
that organization accounts are exempt from.

### Add the other administrators

In Play Console, open **Users and permissions → Invite new users** and add each
administrator's own `nyccsda.org` account. Give **Admin** access only to people
who manage the whole account, and narrower permissions, such as releasing to
testing tracks, to everyone else. Keep at least two people with Admin access so
the account can't be stranded. Remove access when someone leaves the role.

### Create the app and complete its declarations

1. In Play Console, choose **Create app**. Give the app's name and default
   language, and choose **App** (not Game) and **Free**. Free apps can't later
   be changed to paid.
2. Acknowledge the Developer Program Policies, the Play App Signing terms and US
   export laws. What each of these means for this app is in
   [Google Play create-app declarations](store-policy-audit.md#google-play-create-app-declarations).
3. Under **App content**, complete the privacy policy
   (`https://app.nyccsda.org/privacy-policy.html`), app access (no login is
   needed), ads (none), content rating, target audience, and Data safety. Use the
   answers in [store-policy-audit.md](store-policy-audit.md) so they match the
   app as submitted.
4. Under **Store listing**, add the short and full descriptions, the 512 × 512
   icon, the 1024 × 500 feature graphic, and phone screenshots. Describe the app
   as the store policy audit's
   [submission notes](store-policy-audit.md#submission-metadata-and-reviewer-notes)
   do.

The package name, `org.nyccsda.app`, is fixed by the first upload and can't be
changed afterwards.

### Signing and the first upload

- Use **Google-managed Play App Signing**: Google keeps the key that signs what
  users install, and the church's CI signs uploads with an **upload key**. The
  upload key, the four `production` Environment secrets, and the `versionCode`
  rules are in
  [Android setup](native-builds.md#android-setup-github-hosted-direct-builds).
- Back up the upload keystore and its passwords in the church's password
  manager, with a separate encrypted offline copy. Never commit them or record
  them here.
- After a release reaches `main`, approve the **Native Android build** in the
  `production` environment, download its AAB, and upload it to the **Internal
  testing** track first.

### Testing and release tracks

- **Internal testing:** add testers by email, or by a Google Group of church
  testers, and share the opt-in link. Install the build from Google Play on a
  real phone, and confirm that a later build installs over it as an update.
- **Production:** promote a tested release from its track, or create a
  production release with the same AAB. New releases go through Google's
  review before they reach users. As an organization account, the church
  doesn't need the 12-tester closed test that new personal accounts require.

### Yearly Google Play upkeep

- There is no yearly fee or certificate to renew. The upload key is long-lived;
  it's replaced through Play Console only if it's lost or leaked. See
  [Android rotation and recovery policy](native-builds.md#android-rotation-and-recovery-policy).
- Google Play raises its target API level requirement every year. The
  [store toolchain monitor](admin-runbook.md#store-toolchain-monitor-alerts)
  watches for this.
- Keep the contact and developer email and phone working. Google requires them
  to stay operational for as long as the account exists.
- Keep the D-U-N-S record, the payments profile and the website consistent. If
  the church's legal name or address changes, update D&B first, then the payments
  profile.
- Answer Play Console's periodic policy and declaration prompts, such as Data
  safety updates, by their deadlines, or releases can be blocked.
