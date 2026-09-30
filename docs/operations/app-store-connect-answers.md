# App Store Connect answers

The answers for the App Store's first submission, version 0.42.0, set up on September 29,
2026. Each says why it's right for the app and what would change it. The listing text is
in [Store listings](store-listing.md), and Google Play's answers are in
[Google Play Console answers](play-console-answers.md). The steps for each later release
are in the runbook's [Uploading to the stores](admin-runbook.md#uploading-to-the-stores).

## Contents

- [App Information](#app-information)
- [App Privacy](#app-privacy)
- [Pricing and Availability](#pricing-and-availability)
- [Version page](#version-page)
- [When to revisit](#when-to-revisit)

## App Information

- **Languages:** English (U.S.) is primary, with Chinese (Traditional), Chinese
  (Simplified), and Spanish (Mexico), the Spanish the U.S. App Store shows. The names and
  subtitles for each are in [Store listings](store-listing.md). Every subtitle leaves out
  the bulletin on purpose.
- **Category:** Lifestyle, then Reference, matching Google Play.
- **Content Rights:** Yes, the app shows third-party content (Bible text and audio,
  hymn information, library links, and YouTube), and the church has the rights it
  needs. That's a legal statement; the rights records behind it are the audit's
  [item 3](store-policy-audit.md#3-content-image-audio-and-trademark-rights--release-blocker).
- **License Agreement:** Apple's standard one.
- **Age Rating:** 4+, with every answer None or No. Unrestricted web access is No: the
  app opens specific pages and has no general browser. Violence is None for the same
  reason as on Google Play: scripture is plain text, not graphic content. The regional
  labels, such as Brazil's "All" and Vietnam's "00+", are those countries' versions of
  4+.
- **App Encryption Documentation:** none needed. `app.json` sets
  `usesNonExemptEncryption: false`, because the app uses only the system's standard
  encryption.
- **Digital Services Act:** non-trader. The EU asks whether the account acts as a
  business. A church giving away a free app with no sales isn't one, so no contact
  details appear on EU App Store pages; a trader's address, phone, and email would.
  This is an account-wide answer, not per app.
- **Not used:** Vietnam Game License, Regulated Medical Devices, App Store Server
  Notifications, and the app-specific shared secret. They're for games, medical apps,
  and in-app purchases.

## App Privacy

- **Privacy Policy URL:** `https://app.nyccsda.org/privacy-policy.html`, entered for
  every language. The policy is English only on purpose, like the app's privacy screen:
  one authoritative text can't be mistranslated into a different promise. Neither store
  requires a translation.
- **Data collection:** No, so the listing shows **Data Not Collected**. The reasoning is
  the same as Google Play's [Data safety](play-console-answers.md#data-safety): content
  hosts see a phone's IP address only to answer each request.
- **User Privacy Choices URL:** blank. It's for apps that offer opt-outs from data
  collection.

## Pricing and Availability

- **Price:** Free, with the United States as the base country. **Tax category:** App
  Store software.
- **Availability:** every country or region except **China mainland** (174 of 175).
  - Apple requires a Chinese government registration (an ICP filing) for apps there,
    which needs a mainland Chinese entity.
  - China bars foreign organizations from providing religious information online.
  - The bulletin (Google Apps Script) and sermons (YouTube) are blocked there anyway.

  Availability follows the country of a person's Apple account, not where they are, so
  someone in China with a U.S., Taiwan, or Hong Kong account can still download it.
- **Apple silicon Macs** and **Apple Vision Pro:** off. The app hasn't been tested on
  either, and Apple already marks 0.42.0 as incompatible with Vision Pro.
- **Distribution:** Public. It can't be changed after approval.

## Version page

- **Version:** the release's version, such as `0.42.0`. It must match the build; see
  [Version numbers](version-numbers.md).
- **Screenshots:** iPhone 6.9-inch only; the app is iPhone-only (`supportsTablet: false`).
  A 6.7-inch iPhone's screenshots (1290 × 2796) fit without resizing. The status bar's
  battery can be redrawn full, as the listing's screenshot rules allow. Keep copies in
  [`docs/store-assets/`](../store-assets/README.md) under `app-store/`.
- **Promotional Text, Description, Keywords:** per language, from
  [Store listings](store-listing.md).
- **Support URL:** `https://app.nyccsda.org/support.html`. **Marketing URL:** blank.
- **Copyright:** `2026 New York Chinese Seventh-day Adventist Church`, the legal name as
  the developer account shows it. Change the year when it changes.
- **Sign-in required:** off. **Notes:** the
  [reviewer notes](store-listing.md#reviewer-notes). The contact person's details are
  entered in App Store Connect only, not recorded here.
- **Version release:** Manually release this version, so the church chooses the launch
  moment, for example to match Google Play's production release.

## When to revisit

| If a release adds | Revisit |
| --- | --- |
| Analytics, crash reporting, ads, accounts, forms, or push notifications | App Privacy, and Google Play's matching answers |
| Ads, chat, user posts, a web browser, or medical or health content | Age Rating |
| iPad support | iPad screenshots. Test first: Apple doesn't let an update remove iPad support. |
| A new language, such as Japanese | A new localization, published with that release |
| In-app purchases, subscriptions, or a paid app | Pricing, the Digital Services Act answer (selling may make the church a trader), and the audit's [item 1](store-policy-audit.md#1-nonprofit-identity-and-donation-flow--release-blocker) |
| A mainland China release | An ICP filing and a religious-information license, through a Chinese partner |
