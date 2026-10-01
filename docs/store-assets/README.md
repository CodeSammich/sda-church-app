# Store assets

Copies of the images uploaded to Google Play and the App Store, so the next update
starts from what's live instead of from scratch. Each store has one set of six phone
screenshots, which every listing language shows. The listing text and the rules for
what screenshots may show are in [Store listings](../operations/store-listing.md#screenshots).

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

The Play app icon is `public/icon-512x512.png`, so it isn't copied here. Play
screenshots are 1080 × 1920, captured on the Android emulator with Android's demo mode
for a clean status bar. The App Store screenshots come from the iOS PR preview's key
screens, which are the App Store's 6.9-inch iPhone size with a clean status bar; see
[iOS PR preview](../operations/native-builds.md#ios-pr-preview-unsigned-simulator-builds).
The ones here are from the 0.43.0 release PR's preview on September 30, 2026, before
the audio button showed the audio language. The preview still saves a Chinese set in
`screens/app-store/zh-Hant/` (see `appStore` in `test/screens/screens.json`), which isn't
uploaded.

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
