# Google Play Console answers

The answers the church gave in Play Console's **App content** and **Store settings**
pages for the first submission, on September 29, 2026, with version 0.42.0. Each
answer says why it's right for the app and what would change it. The listing text
itself is in [Store listings](store-listing.md), and the policy reasoning behind
these answers is in the [store policy audit](store-policy-audit.md).

When a release changes what the app does, check [When to revisit](#when-to-revisit)
and update both Play Console and this page.

## Contents

- [Content rating](#content-rating)
- [Target audience](#target-audience)
- [Ads and app access](#ads-and-app-access)
- [Data safety](#data-safety)
- [Advertising ID](#advertising-id)
- [Foreground service](#foreground-service)
- [Category and tags](#category-and-tags)
- [Store listing assets](#store-listing-assets)
- [When to revisit](#when-to-revisit)

## Content rating

The IARC questionnaire, category **All Other App Types**. These answers should give
the lowest rating (ESRB Everyone, PEGI 3).

| Question | Answer | Why |
| --- | --- | --- |
| Downloaded App: ratings-relevant content in the app package | No | The package holds only the app's interface, images, and fonts. Bible text and audio, the bulletin, and library content all load over the network. |
| User Content Sharing | No | There's no chat, posting, or accounts. Sharing a verse uses the phone's share sheet and hands off to another app, so it isn't native interaction. |
| Online Content | Yes | The bulletin, Bible text and audio, Sabbath School lessons, and library covers load after install. |
| Violence | No | Scripture describes violent events, but only as plain religious text, with no graphic images or video. Bible apps answer this way. |
| Sexuality | No | Same reasoning as Violence. |
| Language | No | |
| Controlled Substance | No | |
| Promotion or Sale of Age-Restricted Products or Activities | No | |
| Shares the user's precise location with other users | No | The app has no location permission. |
| Purchase of digital goods | No | The giving button opens AdventistGiving in the browser and unlocks nothing. |
| Cash rewards, gift cards, crypto, or NFTs | No | |
| Web browser or search engine | No | External pages open in the phone's browser; the app has no WebView browser. |
| Primarily news or educational | No | It's a church community app. |

If the app ever downloads Bible text for offline reading, that's still online content,
and the answers don't change. Bundling the Bible inside the app package moves it under
**Downloaded App**; the same reasoning as Violence keeps that answer No.

## Target audience

- **Target age groups:** 13–15, 16–17, and 18 and over. Nothing under 13.
- **Could the store listing unintentionally appeal to children?** No.

The target age is who the app is designed for: the church's members. Choosing any
group under 13 puts the whole app under Google's
[Families policy](https://support.google.com/googleplay/android-developer/answer/9893335),
with its extra review of every SDK, service, and external link, including the giving
button. The audit's [item 4](store-policy-audit.md#4-children-and-age-declarations)
recommends the same.

The Sabbath School page's children's section doesn't change this. It lists lessons by
age with Students and Teachers tabs, for parents and teachers, and each lesson opens
on its publisher's website rather than in the app. If that section ever shows lesson
content inside the app, revisit this answer.

Play shows a notice that 13–15-year-olds count as children in some countries, and
offers a neutral age screen. The app needs no screen because it complies as a whole:
its content is rated Everyone, and it has no ads, analytics, accounts, or personal data.

Keep the listing consistent with this: no "for kids" wording, and screenshots of the
Bible, bulletin, and hymns rather than the children's library shelf.

## Ads and app access

- **Ads:** No. The app has no ad SDK.
- **App access:** All functionality is available without special access. The reviewer
  notes are in [Store listings](store-listing.md#reviewer-notes).

## Data safety

**Does your app collect or share any of the required user data types?** No. The
listing then shows "No data collected" and "No data shared with third parties."

- The app has no analytics, ads, crash reporting, push notifications, or over-the-air
  update SDK. These are the usual reasons an Expo app has to answer Yes.
- Every network request fetches content: a Bible chapter or commentary, the bulletin
  for a date (only `?date=` is sent), or a library or lesson catalog. No search
  terms, form input, identifiers, or location leave the phone.
- Settings and saved verses stay on the phone.
- Sharing a verse is user-initiated, which Google exempts from "shared".
- The giving button and other external links open the phone's browser, which Google
  counts as the open web, not an in-app WebView.
- Content hosts see the phone's IP address in their ordinary server logs, like any
  web request. Google doesn't treat that as collection unless the app uses it, for
  example to estimate location, and this app doesn't.

The [privacy policy](../../public/privacy-policy.html) says the same, and reviewers
compare the two. The **Independent security review** and **UPI Payments** badges were
skipped; the first is a paid audit and the second is for payment apps in India.

## Advertising ID

**Does your app use advertising ID?** No. The merged release manifest has no
`com.google.android.gms.permission.AD_ID`, and no dependency uses the advertising ID.
An ads, analytics, or attribution SDK would add the permission through its own
manifest, so recheck the merged manifest after adding any SDK.

## Foreground service

The app declares `FOREGROUND_SERVICE_MEDIA_PLAYBACK` for Bible audio, through
`expo-audio`'s background playback.

- **Task:** Media playback only. There's no video or picture-in-picture.
- **Description:**

  ```text
  The app plays Bible chapter audio that the user starts from the Bible tab. Playback continues while the app is in the background or the screen is locked, and moves on to the following chapters, like an audiobook. The user controls it with play/pause and skip back or forward in the media notification and on the lock screen, and can set a sleep timer to stop at the end of a chapter. The service is used only while the user is listening to audio they started.
  ```

- **Video:** <https://youtube.com/shorts/B20UirUx1VI> (unlisted, no sound).

Google asks only that the video show the steps that start the feature. It was recorded
on the Android emulator with `adb shell screenrecord`, which captures no sound; the
moving progress bar and the media controls show the playback. To record it again:

1. Open a chapter in the Bible tab (Psalm 23, BSB, was used) and tap play.
2. Press Home and pull down the notification shade to show the media controls.
3. Lock the screen, wake it, and pause and resume from the lock screen. The emulator
   needs a swipe lock screen for this: `adb shell locksettings set-disabled false`,
   and `true` afterwards.
4. Unlock and return to the app; the audio is still playing.

Upload it to YouTube as unlisted, and replace the link here and in Play Console.

## Category and tags

- **App type:** App. **Category:** Lifestyle, the usual home for church apps.
- **Tags:** Religious text, Lifestyle, and Books & reference.

Google Play has no religion category. Books & Reference was the alternative, since
the Bible is the app's largest feature; the **Religious text** tag connects the app
to Bible searches either way. Avoid tags that contradict the answers above:
Children's literature, Early childhood education, Education, Study guide, Social,
News & magazines, Events (which means ticket sales), and Music & audio.

## Store listing assets

- **Name, short description, and full description:** the English text in
  [Store listings](store-listing.md#english).
- **App icon:** `public/icon-512x512.png`, the same logo as the app's launcher icon.
- **Feature graphic:** 1024 × 500. It shows the logo, the church's name in English and
  Chinese, "Bilingual Bible · Audio · Weekly bulletin · Hymns", and the pinyin and
  audio screenshots in phone frames on the brand blue (`#00405C`).
- **Phone screenshots:** eight in English, captured as
  [Store listings](store-listing.md#screenshots) describes.

The feature graphic and screenshots aren't kept in this repository.

## When to revisit

| If a release adds | Revisit |
| --- | --- |
| Analytics, crash reporting, or ads | Data safety, Advertising ID, Ads, and Target audience |
| Push notifications | Data safety (device tokens) |
| EAS over-the-air updates | Data safety (the update client sends an install ID) |
| A prayer-request, contact, or sign-up form | Data safety, and User Content Sharing if others see it |
| Chat, posting, or comments | User Content Sharing |
| Location permission or a nearby-church feature | Data safety and the location question |
| In-app payments or donations | Digital purchases and Data safety; see the audit's [item 1](store-policy-audit.md#1-nonprofit-identity-and-donation-flow--release-blocker) |
| Children's content shown in the app | Target audience |
| A Bible bundled in the app package | Content rating's Downloaded App question |
| A new foreground service type, such as downloads | Foreground service, with a new video |
