# Store assets

Copies of the images uploaded to Google Play and the App Store, so the next update
starts from what's live instead of from scratch. The listing text and the rules for
what screenshots may show are in [Store listings](../operations/store-listing.md#screenshots).

- `google-play/feature-graphic.png`: the 1024 × 500 feature graphic. It shows the app
  icon, the church's name in English and Traditional Chinese, and the `02` and `03`
  English screenshots in phone frames on the brand blue (`#00405C`). An AI assistant laid
  it out, so declare it as AI-generated in Play Console; see
  [Store listing assets](../operations/play-console-answers.md#store-listing-assets).
- `google-play/phone/en-US/`: the eight phone screenshots for the English listing, in
  upload order.
- `google-play/phone/zh-TW/`: the four for the Traditional Chinese listings, `zh-TW`
  and `zh-HK`. Simplified Chinese and Spanish show the English ones.
- `google-play/foreground-service-demo.mp4`: the original of the unlisted YouTube video
  that Play Console's foreground service declaration links to. If the YouTube video is
  ever deleted, upload this file again and update the link; see
  [Foreground service](../operations/play-console-answers.md#foreground-service).

The Play app icon is `public/icon-512x512.png`, so it isn't copied here. Play
screenshots are 1080 × 1920, captured on the Android emulator with Android's demo mode
for a clean status bar. App Store screenshots will go in `app-store/`.

The repository is public. Before adding a screenshot, check it shows no members'
names, photos of people, phone numbers, or email addresses, and run
`node scripts/strip-image-metadata.cjs <file>`.
