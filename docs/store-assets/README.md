# Store assets

Copies of the images uploaded to Google Play and the App Store, so the next update
starts from what's uploaded instead of from scratch. The What's New text for the version
being released, for both stores, is in [whats-new.md](whats-new.md). From 1.7.1, each
store has a set of phone screenshots in English, Traditional Chinese, and Simplified
Chinese, the App Store an iPad set in each (#324, #681), and Google Play a tablet set in
each (#695). Each set is in its own
interface, except that each Chinese phone set has one Bible shot in the other script,
to show the app has both. Spanish has its own sets too, in `es/` folders, but they're
**one-off**: taken once, by hand, rather than on every release PR (#692), so they stay
as taken until someone runs a
[one-off run](../operations/native-builds.md#one-off-store-sets) again. How each store's
screenshots are captured, their sizes, and what they may show are in
[Store listings](../operations/store-listing.md#screenshots).

- `google-play/feature-graphic.png`: the 1024 × 500 feature graphic. It shows the app
  icon, the church's name in English and Traditional Chinese, a line of features, and
  two of the English phone screenshots below in phone frames on the brand blue
  (`#00405C`): the Bible in the dark theme behind the Bible in English and Chinese.
  `google-play/feature-graphic-es.png` is the Spanish listings' (`es-US`, `es-419`):
  the same, but with no Chinese, as the user asked of every Spanish image (#692): the
  church's name in English and in Spanish, "Iglesia Adventista del Séptimo Día China de
  Nueva York", which Claude translated, the line of features in Spanish, and two of
  Spanish's phone screenshots, the Spanish Bible in the dark theme behind the Bible in
  Spanish and English.
  `scripts/make-play-feature-graphic.cjs` builds both from those screenshots, so run it
  again when they change. An AI assistant designed them and wrote that script, so
  declare them as AI-generated in Play Console; see
  [Store listing assets](../operations/play-console-answers.md#store-listing-assets).
- `google-play/phone/`: the phone screenshots, in upload order, at 1080 × 1920, one
  set per listing language, each ending with the You tab:
  - `en-US/`: Home, the Bible in English and Chinese, the audio settings with the CUV's
    audio languages, the Bible in the dark theme, Explore, the Library, and You.
  - `zh-TW/`, for the `zh-TW` and `zh-HK` listings: with the Traditional Chinese
    interface, Home, the Bible with Cantonese audio, the Bible with pinyin, Explore, the
    Library, the Bible in Simplified characters (with the Simplified interface), the
    Bible in the dark theme, and You.
  - `zh-CN/`: with the Simplified Chinese interface, Home, the Bible in Simplified
    characters, the Bible in Traditional characters with Cantonese audio (with the
    Traditional interface), Explore, the Library, the Simplified Bible in the dark theme,
    and You.
  - `es/`, for the `es-US` and `es-419` listings, one-off (#692): English's screens with
    the Spanish interface, in the same order, with no Chinese anywhere. Home, the
    Bible in Spanish (Reina-Valera 1909) and English, the Spanish Bible's audio settings
    with its Spanish narration, the Spanish Bible in the dark theme, Explore, the
    Library, and You.
- `google-play/tablet/`: the tablet screenshots, for Play's **7-inch tablet** and
  **10-inch tablet** slots, in upload order, at 1620 × 2880, the 9:16 shape Play asks of
  tablet screenshots, one set per listing language, each ending with the You tab (#695).
  They're the key screens' Android tablet shots: the app's tablet layout at a 10-inch
  tablet's 800 dp width, upright, at a tablet's own 150% text:
  - `en-US/`: Home, the Bible in English and Chinese, Explore, the Library, and You.
  - `zh-TW/`, for the `zh-TW` and `zh-HK` listings: with the Traditional Chinese
    interface, Home, the Bible with Cantonese audio, Explore, the Library, and You.
  - `zh-CN/`: with the Simplified Chinese interface, Home, the Simplified Bible,
    Explore, the Library, and You.
  - `es/`, for the `es-US` and `es-419` listings, one-off (#692): with the Spanish
    interface, Home, the Bible in Spanish and English, Explore, the Library, and You.

  The same screens as the iPad's sets, all upright. Copy a newer run's sets here only
  when the tablet layout changes; a different day's verse on Home isn't a reason.
- `app-store/en-US/`, `app-store/zh-Hant/`, `app-store/zh-Hans/`, and `app-store/es/`: the iPhone
  screenshots for each listing, in upload order, at 1206 × 2622, the size App Store
  Connect's iPhone slot takes. English's are Home, the Bible in English and Chinese,
  the Bible with the Traditional Chinese interface, the Bible in the dark theme, Explore, the
  Library, and You; the two Chinese sets are Google Play's `zh-TW` and `zh-CN` sets.
  Spanish's, for both Spanish listings, is one-off (#692): English's screens with the
  Spanish interface, with no Chinese anywhere, the Bible in Spanish and English in
  place of English and Chinese, and, third, the Spanish Bible's audio settings, as on
  Google Play. Home comes first: the first three appear on the App Store's install
  sheets, and Home shows what the app is.
- `app-store/ipad/`: the iPad screenshots for each listing, in upload order, at
  2064 × 2752 in portrait, the size App Store Connect's **iPad
  13-inch display** slot takes. They're the key screens' 13-inch iPad shots, at the
  iPad's own 150% text:
  - `en-US/`: Home, the Bible in English and Chinese, Explore, the Library, and You.
  - `zh-Hant/`: Home, the Bible with Cantonese audio, Explore, the Library, and You.
  - `zh-Hans/`: Home, the Simplified Bible, Explore, the Library, and You.
  - `es/`, one-off (#692): Home, the Bible in Spanish and English, Explore, the Library,
    and You.

  All portrait (#681): the App Store shows a set's iPad screenshots in one row, where
  a landscape shot among portrait ones shows smaller.

  Copy a newer run's sets here only when the iPad's layout changes; a different day's
  verse on Home isn't a reason.
- `app-store/header/`: the App Store product page headers, one per listing language:
  `en-US.png`, `zh-Hant.png`, `zh-Hans.png`, and `es.png` for both Spanish listings.
  Each is a 3840 × 1646 (21:9) PNG with no transparency. App Store Connect's header
  upload takes PNG only. A tagline ("Church life,
  all week long") and a line of features (Bible, livestream, classes, library) sit over
  three iPhone screenshots: the Bible, Home, and Explore. Behind them is the church
  building photo that Home and Explore show, tinted brand blue (`#00405C`). The tagline
  and phones sit in the middle, because the App Store crops the edges on some devices.
  `scripts/make-app-store-headers.cjs` builds each from its listing's own set, the
  Spanish one from Spanish's one-off `app-store/es/`, so run it again when those
  screenshots change. Run it into another folder to rebuild only one, and copy that one
  here.
  They leave out the logo, because the app icon shows just below the header. Home and Explore show the YouTube, Spotify, and Zoom
  icons. That's allowed: Apple's rule against other platforms' logos (guideline 2.3.10)
  means other mobile platforms and app stores, such as Android or Google Play. If a
  header is ever rejected for them, swap Explore for the Library screenshot and Home
  for another Bible screenshot from the same set.
- `google-play/foreground-service-demo.mp4`: the original of the unlisted YouTube video
  that Play Console's foreground service declaration links to. If the YouTube video is
  ever deleted, upload this file again and update the link; see
  [Foreground service](../operations/play-console-answers.md#foreground-service).

The Play app icon is `public/icon-512x512.png`, so it isn't copied here. The screenshots
and headers here are from the key-screen runs for 1.7.1 on November 6, 2026, with the
floating tab bar and Bible card (#589) and the soft halo behind them (#681), on
release PR #686's head when the shots were taken (db050e58):
[iOS](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/actions/runs/42172839268)
and [Android](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/actions/runs/42172839380).
Every batch of both runs passed; the iOS join failed only its 50 MB download guard,
which #690 fixes. The feature graphic was built from the English Google Play ones. The
Google Play tablet sets are from the Android key screens run on November 8, 2026 on the
branch that added them (#695), at 42ed22b2, on a fork
([run](https://github.com/CodeSammich/sda-church-app/actions/runs/42533621560)), where every batch passed.
Spanish's sets are from one-off runs (#692):
- From November 8, 2026, on the code then live in the stores (1.7.1's app, which 1.7.2
  didn't change): the Google Play phone set but its third shot, and the iPad's You.
- From November 8 and 9, on `release-candidate` as it stood after #715, with unreleased
  app changes (#715, #717, #718): the tablet set, once the tablet batch existed (#695),
  and, once Spanish's sets dropped every Chinese word, the Play phone's third shot, the
  App Store iPhone set, and the iPad's other four. The iPad's You came from the earlier
  run because the later one's iPad timed out on it. The header was built from that
  iPhone set, and the feature graphic from the Play phone set.
- From November 9, on the branch that named the countdown's place in Spanish, "Nueva
  York, NY" (#729), at a5d7dc74: the Google Play phone and tablet Home shots
  ([run](https://github.com/CodeSammich/sda-church-app/actions/runs/42747646177), on a
  fork, where every batch passed), and the App Store iPhone Home shot
  ([run](https://github.com/CodeSammich/sda-church-app/actions/runs/42751392298), on a
  fork, where every batch passed). The header was built again from it. The iPad's Home
  is still the earlier one, with "New York, NY": in that run, the church photo behind
  the verse hadn't loaded on the iPad.

None of the unreleased changes shows: Spanish's phone shots from the later runs match the
earlier ones but for a pixel's shift in the tab bar's pill, and the day's verse on Home.

Each run also saves numbered App Store copies, from the `appStore` and `appStoreIpad`
lists in `test/screens/screens.json`, in two downloads, each under 50 MB (#690):

- `ios-key-screens-<number>-<run>-app-store`, under `screens/app-store/en-US/`,
  `zh-Hant/`, and `zh-Hans/`: each listing's iPhone set, in upload order.
- `ios-key-screens-<number>-<run>-app-store-ipad`, under `screens/app-store-ipad/en-US/`,
  `zh-Hant/`, and `zh-Hans/`: each listing's iPad set.

Each run saves numbered Google Play copies too, in its Google Play download,
`android-key-screens-<pr>-<run>-google-play`, under `screens/google-play/en-US/`,
`zh-TW/`, and `zh-CN/`, from the `googlePlay` lists, on an emulator of Google Play's
size (1080 × 1920), without transparency (#372). The tablet's are in
`android-key-screens-<pr>-<run>-google-play-tablet`, under
`screens/google-play-tablet/en-US/`, `zh-TW/`, and `zh-CN/`, from the
`googlePlayTablet` lists, on the tablet's emulator (#695); they go in
`google-play/tablet/`. A one-off run (#692) saves its language's sets in the same
downloads, under `es/` for Spanish, and nothing else. So for new sets, copy each of a run's folders here, then run both
scripts above.

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
