# What the app keeps on the phone

Issues: [#517](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/517) (the bundled 1919 Chinese Union Version), [#52](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/52) (offline reading), [#524](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/524) (what's backed up), and [#556](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/556) (Bible audio to listen offline)

The app keeps four kinds of data on the device:

- **The Bible texts, which ship inside the app.** They're read-only, and the same on every phone.
- **A small store of settings and saved verses**, kept with AsyncStorage, which the phone's own backup includes.
- **Copies the app can download again:** the bulletin, today's verse, the children's lesson PDFs, and on Android the copies of the bundled Bible files. On a phone they're kept where the backup leaves them out. The web app also keeps an offline copy of itself.
- **Bible audio a member downloads to listen offline:** a book, a section such as the Gospels, a Testament, or the whole Bible, for one narrator, on a phone. It stays until the member deletes it, and the backup leaves it out too.

Nothing on the device is sent anywhere, and the app doesn't use iCloud Drive or CloudKit. This page explains where each kind lives on iOS, Android, and the web, what's backed up, and what the store policies say about it.

## Bible texts shipped with the app

Every Bible text ships with the app, so it opens with no network:

- the 1919 Chinese Union Version, in Traditional and Simplified;
- the BSB;
- the Reina-Valera 1909;
- the verse popup's Hebrew Old Testament and Greek New Testament.

That's 66 books in each translation, and 39 in the Hebrew and 27 in the Greek: about 26 MB in all (about 6.8 MB compressed). Only audio streams, unless the member downloads it (see [Bible audio downloaded to listen offline](#bible-audio-downloaded-to-listen-offline)).

**The files.** The texts are in `assets/bible/<collection>/<book>.biblejson`, such as `assets/bible/cuv1919/hant/gen.biblejson` or `assets/bible/bsb/jhn.biblejson`. The translations are `cuv1919/hant`, `cuv1919/hans`, `bsb`, and `rv1909`, and each also has a `books.biblejson` with every book's name and size. The Hebrew and Greek are `original/hbo_sr` and `original/grc_sr`, with no book list: the popup finds a verse by book, chapter, and verse. `audio-timings/<narrator>` holds when each verse starts in that narrator's recordings, about 200 KB a narrator, also with no book list (#561): `scripts/build-bible-audio-timings.mjs` writes the three HelloAO narrators', and `scripts/bible-audio-alignment/finish.py` the church recordings'.

- The CUV, the Reina-Valera, and the Hebrew and Greek use fetch(bible)'s plain-text book format. The BSB holds each chapter as HelloAO's chapter API returns it, with its narrator links. `services/BibleService.ts` already read both formats when the text came from the network, and now reads only these files: a translation without them can't open.
- `metro.config.js` treats `.biblejson` as an asset type, so Metro bundles the files with the app.
- `assets/bible/index.ts` maps each file to its asset. `scripts/write-bible-asset-index.mjs` writes it, and the build scripts run it.
- `scripts/build-cuv-1919.mjs` builds the CUV, and `scripts/build-bundled-bibles.mjs` the other texts. [LEGAL.md](../LEGAL.md) says why each text may ship with the app, and the [CUV's rights record](../rights-records/cuv-1919-2026-10-27/README.md) how its text was checked.

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
| `has-completed-setup`, `user-language`, `user-theme`, `user-text-scale`, `user-contrast-light`, `user-contrast-dark`, `whats-new-seen` | First-launch setup and the app's preferences (`user-contrast-light` and `-dark`: `high` or `standard`, saved when setup finishes, and high contrast when missing; `whats-new-seen`: the newest version whose question after an update was shown, #669) | `app/_layout.tsx` |
| `user-bible-translation`, `user-bible-supporting-translation`, `user-bible-dual-language`, `user-bible-show-pinyin`, `user-bible-book`, `user-bible-chapter`, `user-bible-audio-readers`, `user-bible-audio-sources` | The Bible reader's choices and the place last read | `app/(tabs)/bible/index.tsx`; `app/_layout.tsx` also resets the translation to the new language's when the app language changes |
| `saved-bible-verses-v1` | Saved verses | `services/SavedVersesService.ts` |
| `preferred-bulletin-location` | Which congregation's bulletin to show | `app/(tabs)/home/bulletin.tsx` |
| `chinese-mission-spotlight` | The newest Mandarin mission video (聖工剪影) the phone has found: its YouTube ID, Sabbath, and story title, a few bytes, so the app in Chinese can offer it until the next one is found (#508) | `features/sabbath-school/ChineseMissionSpotlight.ts` |
| `bible-audio-download-tip` | Whether the tip pointing to Listen offline may show again (#595): `downloaded` once Bible audio has been on the phone, or when its 7-day rest ends | `services/BibleAudioDownloadTip.ts` |
| `pwa-update-last-check-v1` | When the web app last checked for an update (web only, in `localStorage` directly) | `app/_layout.tsx` |
| `screenshot-route` | The screen to open, in key-screen builds only | The key-screen capture scripts; `services/ScreenshotRoute.ts` reads it, then deletes it |

Where AsyncStorage keeps them, and whether they're backed up:

| Platform | Where | Backed up? |
| --- | --- | --- |
| iOS | `Library/Application Support/<bundle ID>/RCTAsyncLocalStorage_V1` | **Yes, in the phone's iCloud or computer backup.** AsyncStorage leaves its folder out of backups unless `Info.plist` sets `RCTAsyncStorageExcludeFromBackup` to `NO`, so `app.json` sets it to `false` under `ios.infoPlist` (#524). |
| Android | A SQLite database, `RKStorage`, in the app's databases directory | **Yes, if the member has Google backup on.** `app.json` sets `android.allowBackup` to `true`, which is also Expo's default; Google recommends setting it explicitly. So Android's Auto Backup includes the database in the member's Google Drive backup. |
| Web | The browser's `localStorage` for `app.nyccsda.org` | It's kept by the browser, on that device only. |

So a member who sets up a new phone from a backup keeps their settings and saved verses, on iOS and Android alike. They're the member's own choices and verses, which the app can't get back any other way. Apple's [File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html) also says "Any file that can be re-created or downloaded must be excluded from the backup", so the bulletin, today's verse, and the children's lessons, which the app can download again, stay out of AsyncStorage on a phone (below). `test/device-backup.test.ts` checks both settings, and that those copies go through `services/CacheStore.ts`.

## Copies the app can download again

`services/CacheStore.ts` keeps the copies of what the app can download again.

- On a phone, they're files in the cache directory, which neither iOS nor Android backs up, and which the system may clear when space is low; the app then downloads them again.
- On the web, which has no backups, they're AsyncStorage keys.
- Phones kept these copies in AsyncStorage before #524. The app reads such a copy until it saves a new one, then deletes it, so it doesn't stay in the backup.

| Copy | On a phone | On the web | Kept by |
| --- | --- | --- | --- |
| Each Sabbath's bulletin, already privacy-filtered by the Bulletin API, and when the page may next refresh it | `bulletins/<date>.json` and `bulletins/<date>.refresh` | `bulletin-cache-v2:<date>` and `bulletin-refresh-v1:<date>` | `services/BulletinService.ts` |
| Today's verse, so Home shows it straight away, even offline | `verse-of-the-day/<language>.json` | `votd_cache_<language>` | `app/(tabs)/index.tsx` |
| Children's lesson PDFs, so a lesson opened once opens at once for the rest of its week, and which lesson each age group has this week (#529) | `children-lessons/<age group>-<hash>.pdf` and `children-lessons/index.json` | None: the browser opens the PDF | `features/sabbath-school/LessonDownloads.ts` |

The app only shows this Sabbath's bulletin and the next, so saving one deletes the copies dated more than two weeks before it. Today's verse has one copy per language, replaced each day.

Each lesson in the index has the days it's the lesson for: from the catalog, a quarterly lesson runs Sabbath to Friday and an Alive in Jesus week Sunday to Sabbath; a lesson picked by its number gets only the Sabbath, or Sunday to Friday. A copy is kept until its lesson's last day, and deleted the first time the app checks after that. A lesson downloads only when someone taps it, so a phone keeps only the lessons its owner opened. The app checks after each lesson it opens, and a few seconds after it opens or comes back, with no network, so old copies go even if the person doesn't open another lesson. See [Children's Sabbath School Lessons](sabbath_school_lessons.md#opening-a-lesson-on-a-phone).

The other copies:

- **The web app's offline copy.** `public/sw.js`, the service worker, is network-first: it keeps the response to every GET request, from the website or elsewhere, in the browser's Cache Storage under `sda-church-v<version>`, and serves that copy when the network fails. A new version deletes the older copies.
- **Bundled Bible files on Android.** These are the `expo-asset` copies above, in the cache directory, which the system may clear.
- **The Android widget's verses.** `expo-widgets` keeps the widget's layout and the week of verses the app last gave it (#235) in the app's `expo.modules.widgets` shared preferences, a few kilobytes. `plugins/withAndroidBackupRules.js` leaves them out of Android's backup and a transfer to a new phone, since the app gives the widget its week again whenever it runs. The light or dark look a widget's button chose is in `verse_widget_theme`, by widget ID, also left out of the backup, since another phone's widgets have other IDs. Home makes the widget a new week once a day, or when the language changes, and keeps a copy with the day, language, and labels it was made for in `verse-of-the-day/widget.json` in the cache directory, to hand the widget each time the app runs (`services/VerseOfTheDayWidget.android.ts`).
- **Streamed audio isn't saved by the app.** Bible audio streams through `expo-audio`, unless the member downloaded it (below). On the web, the browser and the service worker may keep what was fetched, as for any request.

## Bible audio downloaded to listen offline

Bible audio streams chapter by chapter, which stalls where the signal comes and goes, as on the subway. So on a phone, a member can download a book's audio, a section's (`constants/BibleSections.ts`: the Law, History, Poetry and Wisdom, the Major and Minor Prophets, the Gospels, Paul's Letters, the General Letters, and Acts and Revelation, which are a book each), a Testament's, or the whole Bible's, for one narrator, in **Offline Bible Audio** in the You tab (#556). It's one page for downloading and deleting: a tree of the whole Bible, its Testaments, their sections, closed until tapped, and their books, each with its state, its size, and download, stop, or delete. **Listen offline**, in the Bible's audio settings, is one row that opens it at the narrator chosen there, with the book being read showing; Back returns to the Bible. Nothing downloads without a tap, though when streaming keeps stalling, the audio settings button points the listener to Listen offline (#595). The web streams, and offers no downloads.

| | |
| --- | --- |
| **Where** | `bible-audio/<narrator>/<book>/<chapter>.mp3` in the documents directory (`Paths.document`): `Documents` on iOS, and the files directory on Android. The narrators are `cuv-mandarin`, `cuv-cantonese`, `rv1909`, `souer`, `hays`, and `david`. `bible-audio/requests.json` keeps what the member asked for while it downloads, so a download the phone carries on with the app closed still shows when the app opens again. On Android, a chapter downloads into `bible-audio-partial` first: in the no-backup files folder on Android 14 and later, and in the app's external files folder on Android 13 and lower. The module keeps its list of downloads under way and waiting their turn in its own preferences file, `bible-audio-downloads` (#611). |
| **Kept** | Until the member deletes it. The phone doesn't clear the documents directory when space runs low, as it may clear the cache, and a member who downloads a book for the commute expects it to be there, as Spotify's and YouTube's downloads are. |
| **Backed up?** | **No.** On iOS, `modules/backup-exclusion` sets `isExcludedFromBackup` on the folder and on each file; if it can't mark the folder, the app downloads nothing. The phone's downloader marks each chapter as it lands (#611), and the in-app downloader marks each one it saves. On Android, `plugins/withAndroidBackupRules.js` leaves the folder, the external `bible-audio-partial`, and the module's preferences file out of Auto Backup (Android never backs up the no-backup folder) and out of a transfer to a new phone, with `android:fullBackupContent` (Android 11 and lower) and `android:dataExtractionRules` (Android 12 and later). Everything else is backed up as before. |
| **How big** | The whole Bible is 0.94 GB in Mandarin, 0.79 GB in Cantonese, and 0.86 GB in Spanish, but 4–7 GB in English (Souer 5.50, Hays 4.05, David 6.83), whose recordings are about four to eight times the bitrate. John is 18–25 MB in Chinese and Spanish, and 104–171 MB in English. `constants/BibleAudioDownloadSizes.json` has every chapter's size for each narrator, so the app shows a choice's size before it starts, and keeps a downloaded chapter only within 2% of its size (`services/BibleAudioDownloadSizes.ts`). Every host serves the very file measured, to the byte, so `scripts/build-bible-audio-download-sizes.mjs`, which writes it, must run again if a host replaces a recording. |

Why not the cache, like the lesson PDFs: Apple's [File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html) says "the system may delete the `Caches/` directory to free up disk space", and Android's does too (below). A lesson is needed for a week; a book of audio may be for months. Why it must stay out of the backup: Apple's guide says "If your application downloads video or audio files, make sure they are not included in the backup", and on Android, a backup over 25 MB stops all of the app's backup, settings and saved verses included.

**Downloading** (`services/BibleAudioDownloads.ts`, and on a phone `modules/bible-audio-downloads`):

- **The phone does the downloading (#611)**, so it goes on while the phone is locked, or the app is in the background or closed:
  - **iPhone:** two background `URLSession`s. iOS paces a background session's downloads as it sees fit: Apple documents that it delays tasks started while the app is in the background, more each time it relaunches the app, so the app hands everything over while it's on screen.
  - **Android 14 and later:** the app's own user-initiated data transfer jobs (`BibleAudioTransfers`, `BibleAudioTransferService`), one for chapters on Wi-Fi only and one for chapters allowed on mobile data. Android doesn't hold them to the hour's quota below: on the emulator, locked on battery, one downloaded about 400 Mandarin chapters in three and a half minutes. Android stops the Wi-Fi one when Wi-Fi goes, and starts it again when it's back, with the app closed. It requires a notification while it runs: see [Notifications](../UI_UX.md).
  - **Android 13 and lower:** the system's `DownloadManager`. While it downloads, the system shows its own notification, one for all the app's downloads ("3 files downloading"), which needs no permission. It has to show: a hidden download runs as the app's background work, which Android puts off while the phone is locked.
  - The app hands over all of a choice's chapters at once, to the module. While it's open, it asks the phone how they're doing every second.
  - **Three at a time**, as the in-app downloader, since one mirror is a small ministry's own server. On Android 14 and later, the jobs download three between them, whatever the host. On Android 13 and lower, the module gives `DownloadManager` three and keeps the rest in order, and each chapter that ends starts the next, with the app closed too; left to itself, `DownloadManager` ran 11 of a whole Bible at once, and handing it all 1,189 at once took long enough that Android said the app wasn't responding. On both, a chapter waiting for Wi-Fi doesn't take one of the three from a chapter allowed on mobile data, and one tried again from its next source goes first. On iOS, each of the two sessions opens at most three connections to a host. That holds for the ministry's server, which speaks HTTP/1.1; HTTP/2 hosts, such as the church's copies and HelloAO, carry more than one download over a connection.
  - **Android 13 and lower, locked:** each chapter is one of the app's background jobs, and with the app out of sight on battery, Android runs only so many an hour. On the Android 16 emulator, before the app's own jobs, that was 75 chapters and 20 minutes of downloading an hour, and about 20 starts a minute; then the rest waited, Wi-Fi or not. So a locked phone on battery downloads the Gospels (89 chapters) in about an hour, but a whole Bible (1,189) takes most of a day. Charging, or with the app open, there's no limit.
  - Each finished chapter is moved into place by native code, even with the app closed, so the app finds it there.
  - It's custom code, until Expo can keep a background download on Wi-Fi only (#612): Expo SDK 58's `DownloadTask` has no Wi-Fi-only setting on iOS, and no background session on Android. `test/bible-audio-system-downloads.test.ts` fails once `expo-file-system`'s options change.
- **Wi-Fi only:** a download the member didn't allow on mobile data is handed over as Wi-Fi only, and that holds with the phone locked.
  - **iPhone:** its session allows no cellular and no expensive networks.
  - **Android:** it may use only Wi-Fi that isn't metered.
  - So it also waits on a phone's hotspot, which is someone's data plan, when the phone sees it as one: an iPhone counts a personal hotspot as an expensive network, and Android counts as metered a hotspot it recognizes, or a Wi-Fi the member marks. A Wi-Fi marked metered (Android) or set to Low Data Mode (iPhone) waits too.
  - While a chapter waits like that, its row says "Waiting for Wi-Fi": on mobile data, or once Android pauses it for an unmetered Wi-Fi. One Android hasn't started yet says "Waiting to download"
  - "Use mobile data" hands what's waiting over again, allowed on any network.
- **Each chapter is its own file**, put in place only once it's all there.
  - A download stopped part way, by its X, keeps the chapters it finished, and the next tap downloads only the rest.
  - On iOS, swiping the app away stops its downloads. The next time the app opens, what's left of a choice is handed over again, from `bible-audio/requests.json`.
  - On Android 14 and later, a chapter downloads into `bible-audio-partial` in the no-backup folder and moves into `bible-audio` whole. One stopped part way, as when Wi-Fi goes, carries on from where it was if its source allows it, and only from the same source.
  - On Android 13 and lower, `DownloadManager` writes only to the app's external files folder. So each chapter lands in `bible-audio-partial` there, and a receiver that runs with the app closed moves it into `bible-audio`. The app deletes each partial file itself once the chapter is moved or stopped, since `DownloadManager.remove()` may leave it, and clears any it no longer owns.
  - A download stopped from its notification (Android 14 and later), or by Android's Task Manager, counts as the member's stop: it isn't handed over again.
- **Sources:** each chapter comes from where it streams from: the church's copy first, and for Mandarin its two mirrors after, which are the same file.
  - The WordProject recordings (Cantonese and Spanish) come only from the church's copies, and the English ones from HelloAO. See [LEGAL.md](../LEGAL.md#bible-audio-downloaded-to-listen-offline).
  - If one source fails, the next is tried: on Android 14 and later by the job, with the app closed too; otherwise by the app when it next looks. `DownloadManager` retries a host that doesn't answer for minutes, so the app moves it to its mirror sooner.
- Before it starts, the app checks the phone will still have 500 MB free afterwards. If it won't, it says so and downloads nothing.
- A download over 1 GB asks first, even on Wi-Fi ("Download 5.50 GB?"): an English whole Bible or Old Testament, Hays' or David's New Testament, and some English sections, such as each narrator's History books, but nothing in Chinese or Spanish. Smaller English copies are a later optimization (#585).
- On mobile data, the app's popup asks first: Use mobile data, Wait for Wi-Fi, or Cancel.
- If the connection drops, the download waits and goes on by itself. After six chapters in a row fail every source while the phone is online, as when a host is down, it stops; the next tap tries again.
  - Nothing retries in a loop. A busy host's answer (429 or 503), or a chapter that isn't the recording, fails the chapter, which moves to its next source, at most three times round them each time the app opens. A chapter isn't the recording when its size is more than 2% off, as a Wi-Fi's sign-in page or a file cut off part way is, or when the server says it's a web page. Every downloader, the phone's and the in-app one, deletes it rather than keep it, and stops a download that grows past its size, so a host can't fill the phone; one whose size isn't known is kept between 20 KB and 60 MB, and by the phone's downloaders only if the server says it's audio. iOS doesn't tell the app how a background download is going, nor does `DownloadManager` with the app closed, so there one that's too big is deleted when it ends. A failed download's partial file goes at once, and the app checks the chapters on the phone when it starts, deleting any that aren't the recording, as one an earlier version kept. On Android 13 and lower, `DownloadManager` itself waits as a 503 asks, or 30 seconds and longer each time, before trying a host again.
  - With the app closed, Android starts no more chapters after six fail in a row, until the app opens. On Android 14 and later the job has already tried every source, so the app then stops the download as above. On Android 13 and lower it tries the next source, or, for a chapter with only one source (all but Mandarin), stops as above.
- **Where there's no native module,** an in-app downloader does the same, three chapters at a time, through a `.part` file each (`services/FileDownloads.ts`, shared with the lesson PDFs).
  - It stops when the iPhone leaves the app, and goes on when it's back.
  - A download the member didn't allow on mobile data starts no new chapter while the phone is on it.
- It goes on after the page closes, so the whole Bible needn't keep it open. Each row shows its own progress: a book downloading as part of the Gospels shows it, but the New Testament doesn't look downloading because a section in it is.
- **Deleting** goes by the same rows: a book, a section, a Testament, or all of a narrator's downloads. Each asks first, naming what it deletes and its size, as "Delete the Gospels? (108.4 MB)" in Mandarin, and stops any of it still downloading; a chapter that finishes just then is deleted too. The page also lists other narrators with downloads, each with its total and a delete.

**Playing:** a downloaded chapter plays from the phone first, whatever source the listener chose, and then from the sources it streams from, in their usual order: the listener's chosen source first, if any, then the church's copy and the fallbacks (`withDownloadedCopy` in `services/BibleAudioService.ts`). That's so for the chapter in the reader and for the queue behind the lock screen and earbuds' next and previous (#543). The lock screen credits the first source it would otherwise stream from, and the verse times (#561) still fit, since the file is the same. The Android queue keeps the chapters it's given, and stops adding more if one it holds changes, so each playback session uses the downloads there when it started (`snapshotDownloadedChapters`); a chapter that finishes downloading meanwhile plays from the phone from the next session, and in the reader at once.

## No iCloud storage

- The app has no iCloud capability or entitlement, and doesn't use CloudKit or iCloud Drive: nothing is stored in the member's iCloud by the app.
- It writes only downloaded Bible audio to the Documents directory, marked to stay out of the backup (above).
- The phone's own backup, to iCloud or to a computer, includes AsyncStorage's folder, as above. That backup is the member's, made by iOS, and the app can't read it.

## Store policies

**Apple App Store.**

- [App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/), 2.5.2: apps "may not read or write data outside the designated container area". Every location above is inside the app's container.
  - The guidelines have no rule limiting what goes in iCloud backups. The only iCloud storage rule, 5.1.3(ii), concerns personal health information, which the app doesn't have.
- Apple's guidance on backups is in [Optimizing Your App's Data for iCloud Backup](https://developer.apple.com/documentation/foundation/optimizing-your-app-s-data-for-icloud-backup), which the guidelines link to. Its [File System Programming Guide](https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html) lists what's backed up:
  - the app bundle: "The contents of this directory are not backed up by iTunes or iCloud";
  - `Library/Caches`: "the contents of this directory are not backed up by iTunes or iCloud";
  - `Library/Application Support`: "backed up by iTunes and iCloud". AsyncStorage's folder is there, with the settings and saved verses, so the app lets it be backed up.
  - `Documents` and `Application Support` are "backed up by default. You can exclude files from the backup by calling `-[NSURL setResourceValue:forKey:error:]` using the `NSURLIsExcludedFromBackupKey` key." Downloaded Bible audio is in `Documents`, excluded that way, through Swift's `isExcludedFromBackup`.
  - and, on what may not go in the backup: "Any file that can be re-created or downloaded must be excluded from the backup." The bulletin, today's verse, and the children's lesson PDFs go in `Library/Caches`.
- [App privacy details](https://developer.apple.com/app-store/app-privacy-details/): "Data that is processed only on device is not “collected” and does not need to be disclosed". "Collect" means "transmitting data off the device". So nothing on this page changes the App Store privacy answers.
- [Privacy manifests and required-reason APIs](https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api): `expo-file-system`, which reads the Bible files, ships its own `PrivacyInfo.xcprivacy`, declaring the file timestamp and disk space APIs it uses. It was already installed with `expo`, which depends on it; the Bible files are the first code to use it.

**Google Play.**

- [Data safety](https://support.google.com/googleplay/android-developer/answer/10787469): "Collect" means "transmitting data from your app off a user's device", and data "only processed locally on the user's device and not sent off device" doesn't need to be disclosed. So the Data safety form doesn't change either.
  - Android's own backup to Google Drive is Google's service, which the member turns on. It isn't the app sending data.
- [Back up user data with Auto Backup](https://developer.android.com/identity/data/autobackup): by default, Auto Backup includes the app's "Shared preferences files", its internal files, and "Files in the directory returned by `getDatabasePath(String)`", stored "in a private folder in the user's Google Drive account". It "excludes files in directories returned by `getCacheDir()`", where the Bible file copies, the bulletin, today's verse, and the children's lesson PDFs are. "The default value is `true`, but we recommend explicitly setting the attribute in your manifest", so `app.json` sets `allowBackup` to `true`; setting it to `false` would turn Auto Backup off.
  - Downloaded Bible audio is in the files directory, which Auto Backup includes ("Files saved to your app's internal storage and accessed by `getFilesDir()`"). And "If the amount of data is over 25 MB, the system calls `onQuotaExceeded()` and doesn't back up data to the cloud", so audio left in would stop the settings and saved verses being backed up too. The app's backup rules leave the folder out, and since #611, `bible-audio-partial` in the external files folder (`getExternalFilesDir()`, which Auto Backup also includes) and the downloader's preferences file. They only exclude: "If you specify an `<include>` element, the system no longer includes any files by default", so with none, everything else is backed up as before.
- [Access app-specific files](https://developer.android.com/training/data-storage/app-specific): "When the device is low on internal storage space, Android may delete these cache files to recover space". The app copies a Bible file again if that happens.

## Tests

- `test/bundled-bible.test.ts`: the loader on a phone and on the web, retrying after a failed read, and that `assets/bible/index.ts` lists exactly the files in `assets/bible`.
- `test/bundled-bibles.test.ts`: the BSB and Reina-Valera files, with all 66 books and the right number of verses, chapters that open with no network request, the BSB's narrator links, and that every translation the reader offers ships with the app.
- `test/original-language-texts.test.ts`: the Hebrew and Greek files, a verse of each with its credit and license and no network request, and that every verse of every translation gets its original-language verse, except the passages the editions leave out.
- `test/cuv-1919-text.test.ts`: the 1919 text's verses, footnotes, and pinyin, and that chapters and book lists open with no network request.
- `test/cuv-1919-witnesses.test.ts`: every verse's wording and punctuation against two other copies of the 1919 text, and that the Simplified text is the Traditional converted.
- `test/cache-store.test.ts` and `test/cache-store.web.test.ts`: that a phone keeps the copies in the cache directory and deletes the ones AsyncStorage kept before #524, and that the web keeps them in AsyncStorage without touching the file system.
- `test/bulletin-service.test.ts`: that the bulletin copies are in the cache directory on a phone, and only the last two weeks' are kept.
- `test/children-lesson-downloads.test.ts`: that a lesson PDF is downloaded once into the cache directory, that a failed download is never taken for the lesson, and that a copy opens offline on its lesson's days and is deleted after its last day.
- `test/device-backup.test.ts`: the backup settings in `app.json`, on iOS and Android, that the copies the app can download again go through `services/CacheStore.ts`, and that downloaded Bible audio is in the documents directory, marked on iOS and left out by Android's backup rules, with the downloader's partial files and preferences (#611), which exclude nothing else.
- `test/bible-audio-downloads.test.ts`: where each narrator's chapters download from (never WordProject's servers, and HelloAO's the links the reader streams), every book's size, a download into the documents directory one file a chapter, the order playback tries, stopping, waiting for Wi-Fi or a connection, refusing when the iPhone can't keep it out of the backup, finding an earlier session's downloads, and deleting.
- `test/bible-audio-system-downloads.test.ts`: the phone's downloader (#611): a choice handed over at once, on Wi-Fi only unless allowed; progress and finished chapters; mobile data allowed later; held off a metered network; the next source after a failure; stopping after repeated failures; stop and delete; carrying on when the app starts again; that the native code keeps the Wi-Fi rule; and the reminder that fails once Expo can do it (#612).
- `test/offline-bible-audio.test.ts`: the Offline Bible Audio page: its tree, with the sections closed until tapped, each row's state and size, downloading and stopping, the mobile data question, the no connection and not enough space messages, deleting at each level, and its narrator.
- `test/bible-audio-offline-section.test.ts`: the Listen offline row, what it says, and that it opens the page.
- `test/bible-sections.test.ts`: that the sections hold the 66 books once each, in order.
- `test/bible-audio-service.test.ts`: that the queue puts a downloaded chapter first, then the sources it streams from, in their usual order.
- `test/setup.ts` replaces `services/BundledBible.ts` for the other tests with a reader of the files on disk.
