# What the app keeps on the phone

Issues: [#517](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/517) (the bundled 1919 Chinese Union Version), [#52](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/52) (offline reading), and [#524](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/524) (what's backed up)

The app keeps three kinds of data on the device:

- **The Bible texts, which ship inside the app.** They're read-only, and the same on every phone.
- **A small store of settings and saved verses**, kept with AsyncStorage, which the phone's own backup includes.
- **Copies the app can download again:** the bulletin, today's verse, the children's lesson PDFs, and on Android the copies of the bundled Bible files. On a phone they're kept where the backup leaves them out. The web app also keeps an offline copy of itself.

Nothing on the device is sent anywhere, and the app doesn't use iCloud Drive or CloudKit. This page explains where each kind lives on iOS, Android, and the web, what's backed up, and what the store policies say about it.

## Bible texts shipped with the app

Every Bible text ships with the app, so it opens with no network:

- the 1919 Chinese Union Version, in Traditional and Simplified;
- the BSB;
- the Reina-Valera 1909;
- the verse popup's Hebrew Old Testament and Greek New Testament.

That's 66 books in each translation, and 39 in the Hebrew and 27 in the Greek: about 26 MB in all (about 6.8 MB compressed). Only audio streams.

**The files.** The texts are in `assets/bible/<collection>/<book>.biblejson`, such as `assets/bible/cuv1919/hant/gen.biblejson` or `assets/bible/bsb/jhn.biblejson`. The translations are `cuv1919/hant`, `cuv1919/hans`, `bsb`, and `rv1909`, and each also has a `books.biblejson` with every book's name and size. The Hebrew and Greek are `original/hbo_sr` and `original/grc_sr`, with no book list: the popup finds a verse by book, chapter, and verse.

- The CUV, the Reina-Valera, and the Hebrew and Greek use fetch(bible)'s plain-text book format. The BSB holds each chapter as HelloAO's chapter API returns it, with its narrator links. `services/BibleService.ts` already read both formats when the text came from the network, and now reads only these files: a translation without them can't open.
- `metro.config.js` treats `.biblejson` as an asset type, so Metro bundles the files with the app.
- `assets/bible/index.ts` maps each file to its asset. `scripts/write-bible-asset-index.mjs` writes it, and the build scripts run it.
- `scripts/build-cuv-1919.mjs` builds the CUV, and `scripts/build-bundled-bibles.mjs` the rest. [LEGAL.md](../LEGAL.md) says why each text may ship with the app, and the [CUV's rights record](../rights-records/cuv-1919-2026-10-27/README.md) how its text was checked.

**How the app reads them.** `services/BundledBible.ts` reads a book the first time it opens and keeps the parsed book in memory for the rest of the session. Whole-Bible search reads every book of the translations on screen the first time it's used (with the CUV, the CUVS's too, which it searches through), so those books stay in memory like any opened book, along with each verse's words prepared for matching (`services/BibleSearch.ts`). It saves nothing. How it reaches the file depends on the platform:

| Platform | Where the file is | What the app does |
| --- | --- | --- |
| iOS | Inside the app bundle | `expo-asset` returns the file's location in the bundle, and the app reads it there. Nothing is copied. |
| Android | Inside the APK, where a file can't be read in place | `expo-asset` copies the file once into the app's **cache** directory, as `ExponentAsset-<hash>.biblejson`, and the app reads that copy. If the system clears the cache, the next read copies it again. |
| Web | On the website, beside the app (`app.nyccsda.org`) | The app fetches the file the first time a book opens. The service worker keeps a copy (see [Copies the app can download again](#copies-the-app-can-download-again)). |

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
| `preferred-bulletin-location` | Which congregation's bulletin to show | `app/(tabs)/home/bulletin.tsx` |
| `pwa-update-last-check-v1` | When the web app last checked for an update (web only, in `localStorage` directly) | `app/_layout.tsx` |
| `screenshot-route` | The screen to open, in key-screen builds only | The key-screen capture scripts; `services/ScreenshotRoute.ts` reads it, then deletes it |

Where AsyncStorage keeps them, and whether they're backed up:

| Platform | Where | Backed up? |
| --- | --- | --- |
| iOS | `Library/Application Support/<bundle ID>/RCTAsyncLocalStorage_V1` | **Yes, in the phone's iCloud or computer backup.** AsyncStorage leaves its folder out of backups unless `Info.plist` sets `RCTAsyncStorageExcludeFromBackup` to `NO`, so `app.json` sets it to `false` under `ios.infoPlist` (#524). |
| Android | A SQLite database, `RKStorage`, in the app's databases directory | **Yes, if the member has Google backup on.** `app.json` sets `android.allowBackup` to `true`, which is also Expo's default; Google recommends setting it explicitly. So Android's Auto Backup includes the database in the member's Google Drive backup. |
| Web | The browser's `localStorage` for `app.nyccsda.org` | It's kept by the browser, on that device only. |

So a member who sets up a new phone from a backup keeps their settings and saved verses, on iOS and Android alike. They're the member's own choices and verses, which the app can't get back any other way. Apple's [File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html) also says "Any file that can be re-created or downloaded must be excluded from the backup", so the bulletin and today's verse, which the app can download again, stay out of AsyncStorage on a phone (below). `test/device-backup.test.ts` checks both settings, and that those copies go through `services/CacheStore.ts`.

## Copies the app can download again

`services/CacheStore.ts` keeps the copies of what the app can download again.

- On a phone, they're files in the cache directory, which neither iOS nor Android backs up, and which the system may clear when space is low; the app then downloads them again.
- On the web, which has no backups, they're AsyncStorage keys.
- Phones kept these copies in AsyncStorage before #524. The app reads such a copy until it saves a new one, then deletes it, so it doesn't stay in the backup.

| Copy | On a phone | On the web | Kept by |
| --- | --- | --- | --- |
| Each Sabbath's bulletin, already privacy-filtered by the Bulletin API, and when the page may next refresh it | `bulletins/<date>.json` and `bulletins/<date>.refresh` | `bulletin-cache-v2:<date>` and `bulletin-refresh-v1:<date>` | `services/BulletinService.ts` |
| Today's verse, so Home shows it straight away, even offline | `verse-of-the-day/<language>.json` | `votd_cache_<language>` | `app/(tabs)/index.tsx` |
| Children's lesson PDFs, so a lesson opened once opens at once for the rest of its week, and which lesson each age group has this week (#529) | `children-lessons/<name>.pdf` and `children-lessons/index.json` | None: the browser opens the PDF | `features/sabbath-school/LessonDownloads.ts` |

The app only shows this Sabbath's bulletin and the next, so saving one deletes the copies dated more than two weeks before it. Today's verse has one copy per language, replaced each day.

A lookup is kept for a week after its period (a Sabbath, or Sunday to Friday) begins, and a PDF only while a lookup names it. So a copy is deleted the first time the app checks more than a week after the last period it was opened in or fetched for. On Wi-Fi, the app also fetches the coming Sabbath's lesson for the two lessons opened most recently. The index remembers those two, by age group, guide, and app language. See [Children's Sabbath School Lessons](sabbath_school_lessons.md#opening-a-lesson-on-a-phone).

The other copies:

- **The web app's offline copy.** `public/sw.js`, the service worker, is network-first: it keeps the response to every GET request, from the website or elsewhere, in the browser's Cache Storage under `sda-church-v<version>`, and serves that copy when the network fails. A new version deletes the older copies.
- **Bundled Bible files on Android.** These are the `expo-asset` copies above, in the cache directory, which the system may clear.
- **Audio isn't saved by the app.** Bible audio streams through `expo-audio`. On the web, the browser and the service worker may keep what was fetched, as for any request.

## No iCloud storage

- The app has no iCloud capability or entitlement, and doesn't use CloudKit or iCloud Drive: nothing is stored in the member's iCloud by the app.
- It writes nothing to the Documents directory.
- The phone's own backup, to iCloud or to a computer, includes AsyncStorage's folder, as above. That backup is the member's, made by iOS, and the app can't read it.

## Store policies

**Apple App Store.**

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), 2.5.2: apps "may not read or write data outside the designated container area". Every location above is inside the app's container.
  - The guidelines have no rule limiting what goes in iCloud backups. The only iCloud storage rule, 5.1.3(ii), concerns personal health information, which the app doesn't have.
- Apple's guidance on backups is in [Optimizing Your App's Data for iCloud Backup](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup), which the guidelines link to. Its [File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html) lists what's backed up:
  - the app bundle: "The contents of this directory are not backed up by iTunes or iCloud";
  - `Library/Caches`: "the contents of this directory are not backed up by iTunes or iCloud";
  - `Library/Application Support`: "backed up by iTunes and iCloud". AsyncStorage's folder is there, with the settings and saved verses, so the app lets it be backed up.
  - and, on what may not go in the backup: "Any file that can be re-created or downloaded must be excluded from the backup." The bulletin, today's verse, and the children's lesson PDFs go in `Library/Caches`.
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/): "Data that is processed only on device is not “collected” and does not need to be disclosed". "Collect" means "transmitting data off the device". So nothing on this page changes the App Store privacy answers.
- [Privacy manifests and required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api): `expo-file-system`, which reads the Bible files, ships its own `PrivacyInfo.xcprivacy`, declaring the file timestamp and disk space APIs it uses. It was already installed with `expo`, which depends on it; the Bible files are the first code to use it.

**Google Play.**

- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469): "Collect" means "transmitting data from your app off a user's device", and data "only processed locally on the user's device and not sent off device" doesn't need to be disclosed. So the Data safety form doesn't change either.
  - Android's own backup to Google Drive is Google's service, which the member turns on. It isn't the app sending data.
- [Back up user data with Auto Backup](https://developer.android.com/identity/data/autobackup): by default, Auto Backup includes the app's "Shared preferences files", its internal files, and "Files in the directory returned by `getDatabasePath(String)`", stored "in a private folder in the user's Google Drive account". It "excludes files in directories returned by `getCacheDir()`", where the Bible file copies, the bulletin, today's verse, and the children's lesson PDFs are. "The default value is `true`, but we recommend explicitly setting the attribute in your manifest", so `app.json` sets `allowBackup` to `true`; setting it to `false` would turn Auto Backup off.
- [Access app-specific files](https://developer.android.com/training/data-storage/app-specific): "When the device is low on internal storage space, Android may delete these cache files to recover space". The app copies a Bible file again if that happens.

## Tests

- `test/bundled-bible.test.ts`: the loader on a phone and on the web, retrying after a failed read, and that `assets/bible/index.ts` lists exactly the files in `assets/bible`.
- `test/bundled-bibles.test.ts`: the BSB and Reina-Valera files, with all 66 books and the right number of verses, chapters that open with no network request, the BSB's narrator links, and that every translation the reader offers ships with the app.
- `test/original-language-texts.test.ts`: the Hebrew and Greek files, a verse of each with its credit and license and no network request, and that every verse of every translation gets its original-language verse, except the passages the editions leave out.
- `test/cuv-1919-text.test.ts`: the 1919 text's verses, footnotes, and pinyin, and that chapters and book lists open with no network request.
- `test/cuv-1919-witnesses.test.ts`: every verse's wording and punctuation against two other copies of the 1919 text, and that the Simplified text is the Traditional converted.
- `test/cache-store.test.ts` and `test/cache-store.web.test.ts`: that a phone keeps the copies in the cache directory and deletes the ones AsyncStorage kept before #524, and that the web keeps them in AsyncStorage without touching the file system.
- `test/bulletin-service.test.ts`: that the bulletin copies are in the cache directory on a phone, and only the last two weeks' are kept.
- `test/children-lesson-downloads.test.ts`: that a lesson PDF is downloaded once into the cache directory, that a failed download is never taken for the lesson, and that a copy is deleted a week after its period begins.
- `test/device-backup.test.ts`: the backup settings in `app.json`, on iOS and Android.
- `test/setup.ts` replaces `services/BundledBible.ts` for the other tests with a reader of the files on disk.
