# Google Play and App Store policy audit

Audited September 12, 2026 against the repository at version `0.36.0` and the
current official store guidance. This is a release-readiness review, not legal
advice or a guarantee of approval. Store reviewers evaluate the submitted binary,
metadata, declared data practices, and the legal entity behind the submission.

## Result

The app has no obvious prohibited religious content, malware behavior, advertising,
user accounts, chat, or user-generated posting. Its native Bible reader, local
preferences, bulletin, sharing, audio playback, and church features provide a
substantial app experience rather than a simple web wrapper.

It should not be submitted until the release owner completes the confirmation items
below, especially the donation recipient, public privacy URL, and content-rights
records.

## Google Play create-app declarations

The Play Console create-app flow asks the organization to acknowledge the [Developer
Program Policies](https://play.google.com/about/developer-content-policy.html), accept
the [Play App Signing Terms of Service](https://support.google.com/googleplay/android-developer/answer/9842756),
and acknowledge [US export-law compliance](https://support.google.com/googleplay/android-developer/answer/113770?hl=en).
These are account-owner acknowledgements and legal/contractual certifications; this
technical audit cannot accept them on the church's behalf.

### Developer Program Policies

The code review found no obvious policy violation: the app is a free church/community
utility with substantial native functionality, no ads, no accounts, no public user
posting, no deceptive device features, and no in-app digital purchases. The final
account owner may acknowledge this declaration after confirming that the submitted
binary, store listing, privacy disclosures, external links, permissions, and rights
records remain accurate. Google requires the listing and declarations to describe the
actual submitted app, not merely the source repository.

### Play App Signing

For this new Android App Bundle, accept the terms and use Google-managed Play App
Signing unless the church has a documented reason to manage or reuse an existing app
signing key. Google then signs the APKs delivered to users; the church/EAS build keeps
an upload key used to submit bundles. Store the upload keystore and credentials in the
church's secret-management system and never commit them to the repository. The Play
Console administrator must accept the terms and confirm the selected key arrangement.

### US export laws

The app source contains no custom cryptography, VPN, proxy, security, or encryption
feature. It makes ordinary HTTPS requests; the only direct `node:crypto` use is a
build-time SHA-256 helper in `scripts/download-cuv-audio.mjs`, not an app feature. The
iOS configuration also declares `usesNonExemptEncryption: false`. This evidence is
consistent with a normal mass-market app using platform/network encryption, but it is
not a legal export classification. The authorized organization representative should
confirm that the final binary is authorized for export and that no additional
restricted encryption or destinations have been introduced. Recheck this declaration
if the app later adds custom cryptography, VPN/security functionality, or another
encryption-dependent SDK.

The optional advance-notice contact is not indicated for this ordinary church app; it
is not a substitute for completing the required declarations. Google states that its
export page is general information rather than legal advice.

## Changes made in this audit

- Added a public privacy policy at `https://app.nyccsda.org/privacy-policy.html` for
  the Apple App Store metadata field and Google Play listing.
- Expanded the in-app and repository privacy disclosures to cover local storage,
  network metadata, external services, donation processing, device sensors,
  retention, and the absence of accounts.
- Marked the donation link as an external donation portal and removed the unconditional
  “all donations are tax-deductible” claim. Restore a more specific statement only
  after the church verifies the legal recipient and tax language.
- Blocked legacy Android storage and overlay permissions that are not needed by the
  app. Verify the merged permissions in the final release AAB after prebuild.

## Required confirmations before submission

### 1. Nonprofit identity and donation flow — release blocker

The organization must confirm all of the following:

- The developer account and the organization receiving donations are the same legal
  entity, or the relationship is clearly disclosed.
- The recipient is actually tax-exempt and authorized to issue any receipt promised
  to donors. The app must not claim that every contribution is deductible unless the
  church’s tax adviser confirms that wording.
- The AdventistGiving destination is current, secure, and controlled or authorized by
  the receiving organization.

Current code opens `https://adventistgiving.org/donate/AN48CO` using the operating
system link handler. It does not collect card or bank information and does not unlock
content or features in exchange for a contribution.

Google’s [Payments policy](https://support.google.com/googleplay/android-developer/answer/9858738)
says Google Play Billing must not be used for tax-exempt donations. Apple permits
fundraising by an approved nonprofit directly in an app only when the campaign meets
the guidelines, explains how funds are used, provides appropriate tax receipts, and
offers Apple Pay. Apple’s [Apple Pay for Donations guidance](https://developer.apple.com/apple-pay/nonprofits/)
also requires nonprofit approval before enabling a “Donate with Apple Pay” button.

Therefore, keep the current flow external unless Apple approves the nonprofit and the
team intentionally implements Apple Pay. Do not add a native payment form, Stripe
checkout, PayPal checkout, or donation-linked digital benefit without a fresh payments
review. The app must remain free if it is asking users to donate outside the app.

### 2. Privacy URL and declarations — release blocker

Set the following in both consoles:

- Privacy policy URL: `https://app.nyccsda.org/privacy-policy.html`
- Ads: No, while the binary contains no ad SDK or ad network.
- Account creation/sign-in: No.
- App review access: No credentials required; all ordinary features are available
  without login.

Google requires an active privacy policy in the listing and in the app when sensitive
data or permissions are involved, and requires accurate [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469)
answers. Apple requires the privacy URL in App Store Connect and an easily accessible
privacy link in the app; its [App Privacy guidance](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy)
also requires disclosure of third-party partners’ practices.

Before publishing Data safety/App Privacy answers, confirm the actual retention and
logging practices of the bulletin endpoint, hosting/CDN, Bible services, cover
services, audio hosts, sunset service, and donation provider. The app sends no GPS
coordinates from the device, but external services can still receive ordinary request
metadata such as IP address, user agent, request path, and time.

The app currently stores preferences, saved verse references, Bible selections, and
privacy-filtered bulletin data locally. It does not create an account or sync a
personal profile. If a future release adds analytics, crash reporting, push
notifications, login, personalized recommendations, or payment history, update the
policy and both stores’ declarations before release.

### 3. Content, image, audio, and trademark rights — release blocker

Keep a private rights file outside the repository or in the church’s document system
covering:

- authorization to use the Seventh-day Adventist name, logo, colors, and any official
  church marks in the app icon, screenshots, and listing;
- permission or a defensible license for the church building, staff, ministry, and
  event photos, including consent for identifiable people where appropriate;
- permission for the Chinese Union Version audio and the exact right to stream it
  from each current host; the repository records an Audio Power approval in issue
  #134, but that approval should be retained with the release records;
- licenses and attribution for every Bible edition, font, cover image, hymn metadata,
  and source-site link; and
- any permission required from HymnsForWorship.org, zgaxr.com, EGW Writings, or the
  relevant publishers for the app’s current metadata, thumbnails, and navigation.

Apple’s [Intellectual Property guideline](https://developer.apple.com/app-store/review/guidelines/)
requires that app content be created by the developer or licensed for use. Google’s
content policies similarly apply to content displayed by the app and content reached
through app links. Public availability of an image, audio file, score, or webpage is
not itself a redistribution license.

The app’s external-service controls use unmodified official YouTube and Spotify icon
assets for clickable controls that open fixed HTTPS destinations. Zoom remains a generic
video icon because the current Zoom terms grant logo rights in narrower partner and SDK
contexts. The service names and fixed HTTPS links identify the destinations truthfully,
while the app does not embed, proxy, download, or reproduce those services’ content.
Provider assets are not used in the app icon or as the app’s own branding. Re-review any
future logo, screenshot, metadata, or embedded service surface under the provider’s
current brand terms.

### 4. Children and age declarations

The app includes children’s ministry and child-friendly religious library content,
but the code does not show a child account or child-directed data collection. Unless
the church intends the primary audience to be children, describe the app as a general
church/community app and do not use “For Kids” or “For Children” in the store name,
subtitle, screenshots, or description.

Complete Google’s [target-audience and content-rating](https://support.google.com/googleplay/android-developer/answer/9859655)
questionnaire and Apple’s age-rating questionnaire from the actual final content.
If the product is submitted as a children’s/Kids Category app, the external links,
giving flow, third-party services, and parental-gate requirements need a separate
review. Apple’s Kids Category rules restrict links and purchases unless placed behind
a parental gate.

### 5. Permissions and native behavior

The intended release permissions are audio playback and the Android media foreground
service needed for background playback. The app does not request camera, microphone,
location, contacts, photos, or notifications. The Android generated project previously
contained legacy storage and `SYSTEM_ALERT_WINDOW` entries inherited from dependencies;
`app.json` now blocks them. After generating the release project, inspect the merged
manifest and Play Console permission report to confirm they are gone.

Background audio is tied to the app’s Bible-audio feature and is an appropriate use of
background execution. Test a signed iOS build and Android AAB on physical devices,
including lock-screen controls, interruptions, battery saver, offline startup,
chapter transitions, and returning from an external link.

## Store account setup for a nonprofit

### Apple

Enroll the church as an Apple Developer Program organization, not as an individual.
Apple’s [organization enrollment guidance](https://developer.apple.com/help/account/membership/program-enrollment/)
requires a legal entity, D-U-N-S number, legal authority to bind the organization,
organization-domain work email, and a public functional organization website. The
legal entity name becomes the seller name shown in the App Store.

Apple’s [fee-waiver guidance](https://developer.apple.com/help/account/membership/fee-waivers/)
allows an eligible nonprofit to request an annual membership waiver. The organization
must not have signed the Paid Applications Agreement to offer paid apps or IAP, and
must not otherwise sell digital goods or services through its apps. The current app’s
free, donation-only external flow is consistent with those eligibility conditions,
subject to Apple’s review and the church’s continuing eligibility.

If the church later wants Apple Pay donations inside the app, complete Apple’s nonprofit
approval before enabling the button; do not treat the membership fee waiver as Apple
Pay donation approval.

### Google Play

Create a Google Play **Organization** account and select **Non-profit** as the
organization type in the verified Google Payments profile. Google’s [account-type
guidance](https://support.google.com/googleplay/android-developer/answer/13634885)
requires a D-U-N-S number for organization accounts. Keep the legal name, address,
D-U-N-S record, nonprofit documentation, organization website, and account-owner
identity consistent across Google Payments, Play Console, D&B, Expo/EAS, and the
store listing. Google’s current published enrollment terms include a one-time USD
$25 registration fee; nonprofit status is not a substitute for identity verification.

## Submission metadata and reviewer notes

Use a unique, accurate title and describe the app as a church community utility with:

- native Bible reading, translation, pinyin, verse saving, sharing, and audio;
- weekly bulletin and church-location information;
- hymn/library navigation that opens third-party source pages externally;
- no account, no ads, no subscriptions, and no in-app digital purchases; and
- an external AdventistGiving donation portal that does not provide digital benefits.

In Apple Review Notes and Google Play App access notes, explain that no login is
required, the donation button opens an external site, and background audio is the
reason for the media service. Keep all remote endpoints live and provide the privacy
URL.

## Final gate

Before uploading either store binary:

1. Verify the legal recipient and all tax/donation copy.
2. Publish and test the public privacy URL over HTTPS.
3. Complete Google Data safety, target audience, content ratings, and ads declarations.
4. Complete Apple App Privacy, age rating, category, copyright, and export-compliance
   declarations.
5. Verify content/brand/photo/audio permissions and remove anything not cleared.
6. Generate the native projects and inspect the release manifest/entitlements.
7. Run `npm run typecheck`, `npm test`, `npm run check:text-scale`, and the web build.
8. Test signed iOS and Android builds on physical devices before submission.
