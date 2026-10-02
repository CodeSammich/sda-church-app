# Store assets

Copies of the images uploaded to Google Play and the App Store, so the next update
starts from what's uploaded instead of from scratch. Each store has one set of six
phone screenshots, which every listing language shows. How each store's screenshots
are captured, their sizes, and what they may show are in
[Store listings](../operations/store-listing.md#screenshots).

- `google-play/feature-graphic.png`: the 1024 × 500 feature graphic. It shows the app
  icon, the church's name in English and Traditional Chinese, and two English Bible
  screenshots in phone frames on the brand blue (`#00405C`): one with pinyin, which is no
  longer a store screenshot (it's in this folder's git history as `02-bible-pinyin.png`),
  and `02-bible-audio.png`. An AI assistant laid
  it out, so declare it as AI-generated in Play Console; see
  [Store listing assets](../operations/play-console-answers.md#store-listing-assets).
- `google-play/phone/en-US/`: the six phone screenshots, in upload order: Home, the
  Bible with audio playing, the audio-language choice with 粵語 (Cantonese) selected,
  the Bible in the dark theme, Explore, and the Library. The other languages' listings
  show these too.
- `app-store/en-US/`: the six iPhone screenshots, in upload order, at the 6.9-inch size
  (1320 × 2868): Home, the Bible in English and Chinese, the Bible in Chinese and
  English with the Chinese interface, the Bible in the dark theme, Explore, and the
  Library. Home comes first: the first three appear on the App Store's install sheets,
  and Home shows what the app is. The other languages' listings show these too.
- `google-play/foreground-service-demo.mp4`: the original of the unlisted YouTube video
  that Play Console's foreground service declaration links to. If the YouTube video is
  ever deleted, upload this file again and update the link; see
  [Foreground service](../operations/play-console-answers.md#foreground-service).

The Play app icon is `public/icon-512x512.png`, so it isn't copied here. The App Store
screenshots here are from the 0.43.0 release PR's **iOS PR preview** run on September
30, 2026, before the audio button showed the audio language.

Each run also saves numbered App Store copies in its artifact's `screens/app-store/`,
from the `appStore` lists in `test/screens/screens.json`. They aren't the set uploaded
here:

- `screens/app-store/en-US/`: Home, the Bible in English and Chinese, the Bible with
  pinyin, Explore, the Library, and the Bible in the dark theme. The uploaded set has
  the Chinese-interface Bible (`bible-cuv-zh`) in place of the pinyin one, and the dark
  Bible fourth.
- `screens/app-store/zh-Hant/`: seven shots with the Chinese interface, which aren't
  uploaded.

For a new App Store set, take the matching shots from the run's `screens/ios/` and
number them in the uploaded order, or change `appStore` first.

**No transparency.** Both stores reject screenshots with an alpha channel: Google Play
takes JPEG or 24-bit PNG, and App Store Connect refuses images with transparency. The
Simulator and the Android emulator both save PNGs with one, so every screenshot here has
had it removed. Every pixel was opaque already, so nothing changed visibly. The iOS
preview's App Store copies come without it. For a new screenshot, remove it with
`sharp` (`removeAlpha()`), then check with `sharp(file).metadata()` that `hasAlpha` is
false.

The repository is public. Before adding a screenshot, check it shows no members'
names, photos of people, phone numbers, or email addresses, and run
`node scripts/strip-image-metadata.cjs <file>`.
