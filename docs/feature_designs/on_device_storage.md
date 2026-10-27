# What the app keeps on the phone

Issues: [#517](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/517) (the bundled 1919 Chinese Union Version) and [#52](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/52) (offline reading)

The app keeps three kinds of data on the device:

- **The Bible texts, which ship inside the app.** They're read-only, and the same on every phone.
- **A small store of settings, saved verses, and cached copies** of the bulletin and today's verse, kept with AsyncStorage.
- **Caches that the operating system manages:** the web app's offline copy, and the Android copies of the bundled Bible files.

Nothing on the device is sent anywhere, and the app doesn't use iCloud. This page explains where each kind lives on iOS, Android, and the web, what's backed up, and what the store policies say about it.

## Bible texts shipped with the app

Every reader translation ships with the app, so the Bible text opens with no network:

- the 1919 Chinese Union Version, in Traditional and Simplified;
- the BSB and the KJV;
- the Reina-Valera 1909.

That's 66 books in each, about 25 MB in all (about 7 MB compressed). Audio still streams, and the original-language verse popup loads over the network.

**The files.** The texts are in `assets/bible/<collection>/<book>.biblejson`, such as `assets/bible/cuv1919/hant/gen.biblejson` or `assets/bible/bsb/jhn.biblejson`. The collections are `cuv1919/hant`, `cuv1919/hans`, `bsb`, `kjv`, and `rv1909`, and each also has a `books.biblejson` with every book's name and size.

- The CUV and the Reina-Valera use fetch(bible)'s plain-text book format. The BSB and the KJV hold each chapter as HelloAO's chapter API returns it, with the BSB's narrator links. `services/BibleService.ts` already read both formats when the text came from the network.
- `metro.config.js` treats `.biblejson` as an asset type, so Metro bundles the files with the app.
- `assets/bible/index.ts` maps each file to its asset. `scripts/write-bible-asset-index.mjs` writes it, and the build scripts run it.
- `scripts/build-cuv-1919.mjs` builds the CUV, and `scripts/build-bundled-bibles.mjs` the other three. [LEGAL.md](../LEGAL.md) says why each text may ship with the app, and the [CUV's rights record](../rights-records/cuv-1919-2026-10-27/README.md) how its text was checked.

**How the app reads them.** `services/BundledBible.ts` reads a book the first time it opens and keeps the parsed book in memory for the rest of the session. How it reaches the file depends on the platform:

| Platform | Where the file is | What the app does |
| --- | --- | --- |
| iOS | Inside the app bundle | `expo-asset` returns the file's location in the bundle, and the app reads it there. Nothing is copied. |
| Android | Inside the APK, where a file can't be read in place | `expo-asset` copies the file once into the app's **cache** directory, as `ExponentAsset-<hash>.biblejson`, and the app reads that copy. If the system clears the cache, the next read copies it again. |
| Web | On the website, beside the app (`app.nyccsda.org`) | The app fetches the file the first time a book opens. The service worker keeps a copy (see [Caches](#caches)). |

**Adding or changing a text.**

1. Change the build script and its corrections, never the `.biblejson` files.
2. Run the script, which also rewrites `assets/bible/index.ts`.
3. The tests below catch a file left out of the index and any change to the 1919 wording or punctuation.

## Settings and saved verses (AsyncStorage)

The app saves its settings and the member's saved verses with [AsyncStorage](https://react-native-async-storage.github.io/async-storage/), a key-value store.

| Keys | What they hold | Saved by |
| --- | --- | --- |
| `has-completed-setup`, `user-language`, `user-theme`, `user-text-scale` | First-launch setup and the app's preferences | `app/_layout.tsx` |
| `user-bible-translation`, `user-bible-supporting-translation`, `user-bible-dual-language`, `user-bible-show-pinyin`, `user-bible-book`, `user-bible-chapter`, `user-bible-audio-readers`, `user-bible-audio-sources` | The Bible reader's choices and the place last read | `app/(tabs)/bible/index.tsx`; `app/_layout.tsx` also resets the translation to the new language's when the app language changes |
| `saved-bible-verses-v1` | Saved verses | `services/SavedVersesService.ts` |
| `votd_cache_<language>` | Today's verse, so Home shows it straight away, even offline | `app/(tabs)/index.tsx` |
| `bulletin-cache-v2:<date>`, `bulletin-refresh-v1:<date>` | The bulletin, already privacy-filtered by the Bulletin API, and when it was last fetched | `services/BulletinService.ts` |
| `preferred-bulletin-location` | Which congregation's bulletin to show | `app/(tabs)/home/bulletin.tsx` |
| `pwa-update-last-check-v1` | When the web app last checked for an update (web only, in `localStorage` directly) | `app/_layout.tsx` |
| `screenshot-route` | The screen to open, in key-screen builds only | The key-screen capture scripts; `services/ScreenshotRoute.ts` reads it, then deletes it |

Where AsyncStorage keeps them, and whether they're backed up:

| Platform | Where | Backed up? |
| --- | --- | --- |
| iOS | `Library/Application Support/<bundle ID>/RCTAsyncLocalStorage_V1` | **No.** AsyncStorage marks its folder as excluded from iCloud and iTunes backups unless `Info.plist` sets `RCTAsyncStorageExcludeFromBackup` to `NO`, and the app doesn't set it. |
| Android | A SQLite database, `RKStorage`, in the app's databases directory | **Yes, if the member has Google backup on.** The app doesn't set `android.allowBackup`, and Expo's default is `true`, so Android's Auto Backup includes the database in the member's Google Drive backup. |
| Web | The browser's `localStorage` for `app.nyccsda.org` | It's kept by the browser, on that device only. |

So a member who sets up a new iPhone from a backup starts with fresh settings and no saved verses. On Android, Google's restore brings them back. To make Android match iOS, set `"allowBackup": false` under `android` in `app.json`.

## Caches

- **The web app's offline copy.** `public/sw.js`, the service worker, is network-first: it keeps the response to every GET request, from the website or elsewhere, in the browser's Cache Storage under `sda-church-v<version>`, and serves that copy when the network fails. A new version deletes the older copies.
- **Bundled Bible files on Android.** These are the `expo-asset` copies above, in the cache directory, which the system may clear.
- **Audio isn't saved by the app.** Bible audio streams through `expo-audio`. On the web, the browser and the service worker may keep what was fetched, as for any request.

## No iCloud

- The app has no iCloud capability or entitlement, and doesn't use CloudKit or iCloud Drive.
- It writes nothing to the Documents directory, which iCloud backs up.
- AsyncStorage is excluded from iCloud backups, as above.

## Store policies

**Apple App Store.**

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), 2.5.2: apps "may not read or write data outside the designated container area". Every location above is inside the app's container.
  - The guidelines have no rule limiting what goes in iCloud backups. The only iCloud storage rule, 5.1.3(ii), concerns personal health information, which the app doesn't have.
- Apple's guidance on backups is in [Optimizing Your App's Data for iCloud Backup](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup), which the guidelines link to. Its [File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html) lists what's backed up:
  - the app bundle: "The contents of this directory are not backed up by iTunes or iCloud";
  - `Library/Caches`: "the contents of this directory are not backed up by iTunes or iCloud";
  - `Library/Application Support`: "backed up by iTunes and iCloud". AsyncStorage's folder is there, which is why the library excludes it.
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/): "Data that is processed only on device is not “collected” and does not need to be disclosed". "Collect" means "transmitting data off the device". So nothing on this page changes the App Store privacy answers.
- [Privacy manifests and required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api): `expo-file-system`, which reads the Bible files, ships its own `PrivacyInfo.xcprivacy`, declaring the file timestamp and disk space APIs it uses. It was already installed with `expo`, which depends on it; the Bible files are the first code to use it.

**Google Play.**

- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469): "Collect" means "transmitting data from your app off a user's device", and data "only processed locally on the user's device and not sent off device" doesn't need to be disclosed. So the Data safety form doesn't change either.
  - Android's own backup to Google Drive is Google's service, which the member turns on. It isn't the app sending data.
- [Back up user data with Auto Backup](https://developer.android.com/identity/data/autobackup): by default, Auto Backup includes the app's "Shared preferences files", its internal files, and "Files in the directory returned by `getDatabasePath(String)`", stored "in a private folder in the user's Google Drive account". It "excludes files in directories returned by `getCacheDir()`", where the Bible file copies are. Setting `android:allowBackup` to `false` turns it off.
- [Access app-specific files](https://developer.android.com/training/data-storage/app-specific): "When the device is low on internal storage space, Android may delete these cache files to recover space". The app copies a Bible file again if that happens.

## Tests

- `test/bundled-bible.test.ts`: the loader on a phone and on the web, retrying after a failed read, and that `assets/bible/index.ts` lists exactly the files in `assets/bible`.
- `test/bundled-bibles.test.ts`: the BSB, KJV, and Reina-Valera files, with all 66 books and the right number of verses, chapters that open with no network request, and the BSB's narrator links.
- `test/cuv-1919-text.test.ts`: the 1919 text's verses, footnotes, and pinyin, and that chapters and book lists open with no network request.
- `test/cuv-1919-witnesses.test.ts`: every verse's wording and punctuation against two other copies of the 1919 text, and that the Simplified text is the Traditional converted.
- `test/setup.ts` replaces `services/BundledBible.ts` for the other tests with a reader of the files on disk.
