# Store assets

Copies of the images uploaded to Google Play and the App Store, so the next update
starts from what's uploaded instead of from scratch. Each store has one set of six
phone screenshots, which every listing language shows. How each store's screenshots
are captured, their sizes, and what they may show are in
[Store listings](../operations/store-listing.md#screenshots).

- `google-play/feature-graphic.png`: the 1024 × 500 feature graphic. It shows the app
  icon, the church's name in English and Traditional Chinese, a line of features, and
  two of the phone screenshots below in phone frames on the brand blue (`#00405C`): the
  Bible in the dark theme behind the Bible in English and Chinese.
  `scripts/make-play-feature-graphic.cjs` builds it from them, so run it again when
  they change. An AI assistant designed it and wrote that script, so declare it as
  AI-generated in Play Console; see
  [Store listing assets](../operations/play-console-answers.md#store-listing-assets).
- `google-play/phone/en-US/`: the six phone screenshots, in upload order, at 1080 × 1920:
  Home, the Bible in English and Chinese, the audio settings with the CUV's audio
  languages, the Bible in the dark theme, Explore, and the Library. The other languages'
  listings show these too.
- `app-store/en-US/`: the six iPhone screenshots, in upload order, at the 6.9-inch size
  (1320 × 2868): Home, the Bible in English and Chinese, the Bible in Chinese and
  English with the Chinese interface, the Bible in the dark theme, Explore, and the
  Library. Home comes first: the first three appear on the App Store's install sheets,
  and Home shows what the app is. The other languages' listings show these too.
- `app-store/header/`: the App Store product page headers, one per listing language:
  `en-US.png`, `zh-Hant.png`, `zh-Hans.png`, and `es.png` for both Spanish listings.
  Each is a 3840 × 1646 (21:9) PNG with no transparency. App Store Connect's header
  upload takes PNG only. A tagline ("Church life,
  all week long") and a line of features (Bible, livestream, classes, library) sit over
  three iPhone screenshots: the Bible, Home, and Explore. Behind them is the church
  building photo that Home and Explore show, tinted brand blue (`#00405C`). The tagline
  and phones sit in the middle, because the App Store crops the edges on some devices.
  `scripts/make-app-store-headers.cjs` builds them from `app-store/en-US/`, so run it
  again when those screenshots change. They leave out the logo, because the app icon
  shows just below the header. Home and Explore show the YouTube, Spotify, and Zoom
  icons. That's allowed: Apple's rule against other platforms' logos (guideline 2.3.10)
  means other mobile platforms and app stores, such as Android or Google Play. If a
  header is ever rejected for them, swap Explore for the Library screenshot and Home
  for the other Bible screenshot.
- `google-play/foreground-service-demo.mp4`: the original of the unlisted YouTube video
  that Play Console's foreground service declaration links to. If the YouTube video is
  ever deleted, upload this file again and update the link; see
  [Foreground service](../operations/play-console-answers.md#foreground-service).

The Play app icon is `public/icon-512x512.png`, so it isn't copied here. The screenshots
and headers here are from the key-screen runs for 1.4.0 on October 28, 2026, the first
with the 1919 Chinese Union Version: [iOS](https://github.com/CodeSammich/sda-church-app/actions/runs/40628414994)
and [Android](https://github.com/CodeSammich/sda-church-app/actions/runs/40632080157). The
feature graphic was built from the Google Play ones.

Each run also saves numbered App Store copies in its screenshots download's
`screens/app-store/`, from the `appStore` lists in `test/screens/screens.json`:

- `screens/app-store/en-US/`: the uploaded set, in upload order: Home, the Bible in
  English and Chinese, the Bible with the Chinese interface (`bible-cuv-zh`), the Bible
  in the dark theme, Explore, and the Library.
- `screens/app-store/zh-Hant/`: seven shots with the Chinese interface, which aren't
  uploaded.

Each run saves numbered Google Play copies too, in `screens/google-play/en-US/` and
`screens/google-play/zh-TW/`, from the `googlePlay` lists, on an emulator of Google
Play's size (1080 × 1920), without transparency (#372). `en-US` is the uploaded set, in
upload order: Home, the Bible in English and Chinese, the audio settings with the CUV's
audio languages (`bible-audio-settings-default`), the Bible in the dark theme, Explore,
and the Library. So for a new set, copy a run's two `en-US` folders here.

**No transparency.** Both stores reject screenshots with an alpha channel: Google Play
takes JPEG or 24-bit PNG, and App Store Connect refuses images with transparency. The
Simulator and the Android emulator both save PNGs with one, so every screenshot here has
had it removed. Every pixel was opaque already, so nothing changed visibly. The iOS
preview's App Store and Google Play copies come without it. For a new screenshot, remove it with
`sharp` (`removeAlpha()`), then check with `sharp(file).metadata()` that `hasAlpha` is
false.

The repository is public. Before adding a screenshot, check it shows no members'
names, photos of people, phone numbers, or email addresses, and run
`node scripts/strip-image-metadata.cjs <file>`.
