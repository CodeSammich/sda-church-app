# Persona walk-through: Deacon Chen (made up)
Build: `org.nyccsda.app.preview` 1.9.0 (versionCode 1009000), a key-screens build with made-up bulletin and team data and no launch animation. Installed 2026-11-26 14:57.
Date: Thursday 2026-11-26 (not a Sabbath; This Week showed the coming Sabbath, November 28, 2026; Next Week showed December 5, 2026).
Device: Android 16 emulator, Pixel 9a profile, 1080x2424, gesture navigation (no on-screen Back button), no screen lock set.
Settings: app language English (app locale cleared before first launch, phone in English); switched in the app to 繁體中文 (Traditional Chinese) for task 7 and back. In-app text size 125% (the default), 150% for task 10, then reset. System font scale 1.0. Other setup steps left at their defaults. Media volume muted.

## Bottom line
Deacon Chen could check every line of both bulletins, for both weeks, in English and in Chinese. Every "Open hymn" button opened the right number and title, every Chinese hymn link matched, and both Bible links opened the right chapter. The labels read like spreadsheet columns, and the hard cases display cleanly: the three-person role fits on one line, and the long hyphenated first name and the long sermon title wrap without being cut off, even at 150%. What he cannot do is be sure he is looking at the latest version. Nothing on the page says when the bulletin was fetched. Refresh turns grey for about two minutes with no words, and it looks exactly the same online, offline and after a restart. Once he scrolls, the floating title only says "Weekly Bulletin": nothing says which week or which church, and the page reopens wherever he left it. Smaller snags: empty slots say "TBD", so he can't tell a blank cell from a typed one. "Name withheld" comes with no reason. Brooklyn shows the same people twice under near-identical labels. Chinese hymn titles change script between the bulletin and the hymn page they open. The "This Week" button sometimes reads only "This". There is no share or copy, so proof for the pastor means several phone screenshots.

## Findings, by severity
| # | Severity | Task | What happened | Why it matters to him | Screenshot | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | **Major** | 8 | No "last updated" or "fetched at" anywhere on the bulletin, top or bottom. Tapping the round Refresh button turns it grey at once, with no message. It stays grey for about 2 minutes, then turns blue again. Only a screen reader hears the countdown ("Refresh (1:15)"). It looks identical online, offline, and after the app is closed and reopened (the grey carries over the restart). Offline, the full bulletin shows with no note: also seen by Mr. Wong (his finding 7). | He opens the app right after editing the sheet to see whether members get his change. He can't tell whether the app has his edit, whether Refresh worked, failed, or is broken. He may sign off on an old copy. | [33](images/33-refresh-grey-no-message.jpg), [34](images/34-offline-bulletin-no-note.jpg), [35](images/35-offline-refresh-looks-same.jpg), [36](images/36-offline-after-restart.jpg) | Show "Updated 3:16 PM" under the date. After Refresh, say what happened ("Up to date", "Couldn't refresh: no connection, showing the copy from …"). Show the wait on screen instead of only greying the button. |
| 2 | **Major** | 3, 4, 7 | After the first scroll, the floating title says only "Weekly Bulletin" (and covers the first line of content: also seen by Mrs. Lin, her finding 13). Nothing shows the week, date or church. Next Week's Brooklyn page, scrolled, looks the same as This Week's except the lesson number. The page also reopens where he left it: once partway down the page (in Chinese), and on the church he looked at last (Brooklyn, even after a restart). | He checks Queens and Brooklyn, this week and next, against four columns of his sheet. Partway down, he can't see whether he is on Queens or Brooklyn, or this week or next. He may "confirm" the wrong one. | [04](images/04-queens-sabbath-school.jpg), [17](images/17-next-week-brooklyn-scrolled.jpg), [26](images/26-zh-bulletin-reopens-mid-page.jpg), [32](images/32-this-week-cut-off-when-selected.jpg), [36](images/36-offline-after-restart.jpg) | Put church and date in the floating title, e.g. "Queens · Nov 28". Consider opening the bulletin at the top. |
| 3 | Minor | 2, 7 | Youth Teacher and Flower Offering show "TBD". In Chinese they show 尚未安排 ("not yet arranged"), so the app writes this word. Brooklyn is missing many rows Queens has (see finding 5). So some empty-looking slots say "TBD" and others are simply not there. | He can't tell a blank cell from someone typing "TBD". He also can't tell whether a missing Brooklyn row means "Brooklyn doesn't use it" or "I forgot to fill it in". | [05](images/05-queens-withheld-and-tbd.jpg), [08](images/08-queens-offering-special-music.jpg), [28](images/28-zh-queens-tbd-withheld.jpg) | Use clear wording for an empty cell, e.g. "Not assigned yet", and say on the page which rows each church uses. |
| 4 | Minor | 2, 7 | Chinese Teacher, Offering Prayer and Translation show "Name withheld" (Chinese 姓名保留, literally "name reserved"). Tapping it does nothing, and nothing says why. Withholding names is deliberate; the problem is only that it's unexplained. | He typed a name, and the app shows "Name withheld". Unless he knows the church's privacy rule, he may think the app lost his entry or that he made a mistake. Members may wonder too. | [05](images/05-queens-withheld-and-tbd.jpg), [28](images/28-zh-queens-tbd-withheld.jpg), [30](images/30-zh-announcements-roster.jpg) | Add a one-line note the first time it appears, e.g. "Some names are not shown in the app for privacy" (為保護隱私，部分姓名不顯示). |
| 5 | Minor | 3 | Brooklyn's layout differs a lot. It has no Chair, Opening Prayer, class teachers or Closing Prayer. Its worship program has only Hymn of Praise, Bible Verses, Sermon and Hymn of Response. It has no Announcements section. Its roster has Technician, Encouragement and Sabbath School instead of Translation and Pianist. The same made-up names appear twice: under "Prayer" and "Chair / Pastoral Prayer", under "Sabbath Encouragement" and "Encouragement", and under "Sabbath School" twice. One row is labelled "Sabbath School" inside the "Sabbath School" section. | He can't tell whether these are two cells or one shown twice, or what the "Sabbath School" row means (superintendent? teacher?). If he edits one cell, he isn't sure which line will change. | [12](images/12-brooklyn-sabbath-school-fields.jpg), [14](images/14-brooklyn-no-announcements-roster.jpg), [15](images/15-brooklyn-roster-repeats.jpg) | Show each cell once, give the row a role name, and label Brooklyn's sections the way its sheet does. |
| 6 | Minor | 2, 3 | "Opening & Closing Hymns" lists two hymns with no "opening" or "closing" marker. In Brooklyn it lists only one. | He can't tell whether Brooklyn's one hymn is the opening or the closing hymn, or whether one is missing. | [04](images/04-queens-sabbath-school.jpg), [11](images/11-brooklyn-top.jpg) | Label each hymn ("Opening", "Closing"), or say "Opening and closing: same hymn" when only one is given. |
| 7 | Minor | 5, 7 | In the Chinese bulletin, "497. 讚美上帝" and "504. 散會頌" are in Traditional characters. "Open hymn" opens hymn pages titled "497. 赞美上帝" and "504. 散会颂", in Simplified. In English, the Chinese hymn pages also show Simplified titles (e.g. 498. 请听我祈求, while the Chinese bulletin shows 498. 請聽我祈求). The mixed scripts inside the bulletin were also seen by Mrs. Lin (her finding 9). | He checks character by character. The same hymn looks different on the hymn page that opens, so he stops to work out whether it's the right hymn. | [22](images/22-hymn-690-chinese-504.jpg), [26](images/26-zh-bulletin-reopens-mid-page.jpg), [41](images/41-zh-card-497-simplified.jpg) | Show the hymn page title in the same script as the bulletin, Traditional in 繁體中文. |
| 8 | Minor | 5, 7 | Brooklyn's "100. Great Is Thy Faithfulness" opens a hymn page with no Chinese hymn link (all the other hymns have one). In the Chinese bulletin it stays English: "100. Great Is Thy Faithfulness". | Chinese readers get an English-only hymn. He can't tell whether he should have entered a Chinese hymn number, or whether none exists. | [23](images/23-hymn-100-no-chinese-link.jpg), [31](images/31-zh-brooklyn-hymn-100-english.jpg) | When there is no Chinese hymn, say so on the hymn page and in the Chinese bulletin. |
| 9 | Minor | 4, 8 | After he tapped Next Week, the other button read "This" instead of "This Week". Later it read "This" even when selected. After the app was closed and reopened, it read "This Week" again. In Chinese, 本週 was always whole. | It looks broken, and "This" alone is unclear when he is checking which week he is on. | [16](images/16-next-week-top.jpg), [18](images/18-next-week-queens-this-cut-off.jpg), [32](images/32-this-week-cut-off-when-selected.jpg), [36](images/36-offline-after-restart.jpg) | Keep the full label; let the button grow or shrink the text. |
| 10 | Minor | 9 | No share or copy option on the bulletin, its sections or its rows. Long-pressing the special remark, a hymn line or the date selected nothing. | To send the pastor "it's right" or "look at this", he must take phone screenshots. Queens alone is about 8 screens at 125%. | [03](images/03-bulletin-top-queens.jpg), [10](images/10-queens-announcements-roster-end.jpg) | Add "Share" for the bulletin (or one section) as text, or a copy option on long-press. |
| 11 | Minor | 7 | Chinese labels: the Doxology row is 讚美 ("Praise"), right above the Hymn of Praise row 讚美詩 ("Hymn of praise"). Pastoral Prayer is 牧養禱告 in Queens but 牧禱 in Brooklyn's 主席／牧禱 ("Chair / Pastoral prayer"). The offering line shows 本地教會預算 with "Local Church Budget" on the next line, and the special-music piece stays English. | Two near-identical labels for different rows, and two names for the same role, make him wonder whether they're different slots or a mistake. | [26](images/26-zh-bulletin-reopens-mid-page.jpg), [29](images/29-zh-offering-english-line.jpg) | Use one Chinese term for each role. Consider a separate word for Doxology (e.g. 三一頌). |
| 12 | Note | 6 | Brooklyn's "Read now" for Psalms 119:105 opened Psalms 119 scrolled to verse 105, but verse 105 isn't highlighted. Here the top bar was hidden, so he needed the Back gesture to return. Queens' Psalms 46:1–3 opened at the top of the chapter, and verses 1–3 aren't marked. | He can see it's the right place, but must count verses himself. | [24](images/24-brooklyn-psalm-119-105-opens.jpg), [25](images/25-queens-psalm-46-opens.jpg) | Highlight the verse or range from the bulletin. |
| 13 | Note | 4 | Only "This Week" and "Next Week". Swiping sideways does nothing. There is no past week and no week after next. | He may expect to look back at last week, or plan two weeks ahead. | [16](images/16-next-week-top.jpg) | Consider whether a third week or a past week is wanted. |
| 14 | Note | 10 | With the phone turned to landscape, the app stayed upright. | He may expect wider lines in landscape. Nothing breaks. | [40](images/40-landscape-app-stays-upright.jpg) | None needed unless landscape is wanted. |
| 15 | Note | 10 | The text-size popup says "Adjust persistent app text from 100% to 200%." "Reset to 125%" was also seen by Mrs. Lin (her finding 22). | "Persistent" is jargon; he isn't sure what it covers. | none | Plainer wording, e.g. "Text size for the whole app". |

## Task by task

### 1. Setup and open the bulletin: Done (6 taps)
- The app opened on "Welcome" with English already chosen ([01](images/01-welcome.jpg)). He tapped Next four times (Text size 125% already chosen, appearance, two contrast steps), then "Get Started": 5 taps.
- Home showed the "Weekly Bulletin" tile on the first screen ([02](images/02-home.jpg)). 1 tap.

### 2. This week, Queens, top to bottom: Done with doubts (0 taps, 8 scrolls)
- Top: "This Week" / "Next Week", "November 28, 2026", a "Q4" chip (a screen reader hears "Quarter: Q4"; "Q4" also seen by Mrs. Lin, her finding 8), the round Refresh button, then "Queens" / "Brooklyn" ([03](images/03-bulletin-top-queens.jpg)).
- "Special Remark": "Thanksgiving Sabbath: fellowship lunch for everyone after the service", in a yellow box ([03](images/03-bulletin-top-queens.jpg)).
- Sabbath School: Chair (the long hyphenated made-up name, on one line). Opening Prayer: three made-up names separated by " / ", on one line. "Opening & Closing Hymns": 1. Praise to the Lord and 530. It Is Well With My Soul, each with "Open hymn" ([04](images/04-queens-sabbath-school.jpg), finding 6). Lesson "Lesson 9: Testing the Prophets" with "Read lesson". Chinese Teacher "Name withheld". Youth Teacher "TBD". Kids Teacher: two names joined by "&". Then Closing Prayer ([05](images/05-queens-withheld-and-tbd.jpg), findings 3, 4).
- Worship Program: Doxology "694. Praise God, From Whom All Blessings" (wraps cleanly). Invocation / Opening Prayer. Hymn of Praise 12. Bible Verses "Psalms 46:1–3" with "Read now". Pastoral Prayer with Hymn 684. Tithe & Offering "Local Church Budget", with Offering Prayer "Name withheld". Special Music (two names) with Piece. Flower Offering "TBD" ([06](images/06-queens-worship-program-start.jpg), [07](images/07-queens-hymns-bible-pastoral.jpg), [08](images/08-queens-offering-special-music.jpg)).
- Sermon (a made-up name), with Sermon Title "When the Waters Rise: Trusting God Through the Storms of Life" on two lines, nothing cut. Then Hymn of Response 348, Benediction, Postlude 690 ([09](images/09-queens-sermon-long-title.jpg)).
- "Announcements": "Fellowship lunch after the service." "Service Roster": Translation "Name withheld", then Pianist. Nothing below: no update time, no end note ([10](images/10-queens-announcements-roster-end.jpg)).
- After the first scroll, the floating title said only "Weekly Bulletin" ([04](images/04-queens-sabbath-school.jpg), finding 2).

### 3. Brooklyn: Done with doubts (1 tap, 4 scrolls)
- Same date and same special remark ([11](images/11-brooklyn-top.jpg)). The church shows only in the selected "Brooklyn" button at the top.
- Sabbath School: one hymn under "Opening & Closing Hymns" (100. Great Is Thy Faithfulness), then Prayer, Sabbath Encouragement, a row named "Sabbath School", and Lesson 9 ([12](images/12-brooklyn-sabbath-school-fields.jpg)).
- Worship Program: Hymn of Praise 1, Bible Verses "Psalms 119:105", Sermon (a made-up name) with title "A Light to My Path", Hymn of Response 348 ([13](images/13-brooklyn-worship-program.jpg)).
- No Announcements section. Service Roster: Chair / Pastoral Prayer, Offering Prayer "Name withheld", Technician, Encouragement, Sabbath School ([14](images/14-brooklyn-no-announcements-roster.jpg), [15](images/15-brooklyn-roster-repeats.jpg)). The differences and repeats are in finding 5.

### 4. Next week, both churches: Done with doubts (3 taps, about 11 scrolls, 2 sideways swipes)
- "Next Week": "December 5, 2026", with Brooklyn still chosen ([16](images/16-next-week-top.jpg)). The other button now read "This" (finding 9).
- Brooklyn next week matched this week except "Lesson 10: Prophetic Authority and Relevance". Scrolled, nothing said which week ([17](images/17-next-week-brooklyn-scrolled.jpg), finding 2).
- Queens next week also matched except Lesson 10 ([18](images/18-next-week-queens-this-cut-off.jpg)).
- He looked for a third week or a past week. Sideways swipes on the page and on the date did nothing (finding 13). He tapped "This" to go back.

### 5. Each hymn: Done (about 27 taps)
- Every "Open hymn" opened "SDA Hymnal", "1985 Edition", with a single hymn page showing the same number and title ([19](images/19-hymn-1-card.jpg), [21](images/21-hymn-690-card.jpg), [23](images/23-hymn-100-no-chinese-link.jpg)). Each page links to the Chinese Hymnal (505 Edition), and the Chinese page links back to the same English number ([20](images/20-hymn-1-chinese-505-5.jpg), [22](images/22-hymn-690-chinese-504.jpg)).
- Pairs: 1 ↔ 5. 赞美上主 · 530 ↔ 225. 平安如河水 · 694 ↔ 497. 赞美上帝 · 12 ↔ 16. 快乐颂 · 684 ↔ 498. 请听我祈求 · 348 ↔ 413. 教会基础 · 690 ↔ 504. 散会颂 · 100: no Chinese link (finding 8).
- The Chinese bulletin uses those same Chinese numbers (5, 225, 497, 16, 498, 413, 504); some titles differ in script (finding 7).
- Back from a hymn page returned to the bulletin at the same place.
- Tapping the title on the 690 hymn page opened a browser tab on hymnsforworship.org (not screenshotted); Back returned to the app. Leaving the app without warning was also seen by Mrs. Lin (her finding 2).

### 6. Bible links: Done (4 taps)
- Brooklyn: "Read now" opened Psalms 119 at verse 105, in English with Chinese under each verse ([24](images/24-brooklyn-psalm-119-105-opens.jpg)). The Back gesture returned to the bulletin.
- Queens: Psalms 46 opened at verse 1, with the ‹ button visible ([25](images/25-queens-psalm-46-opens.jpg)). English with Chinese under each verse was also seen by Mrs. Lin (her finding 11); he reads both, so it suits him.
- Neither link highlights its verse or range (finding 12).

### 7. Traditional Chinese, Queens: Done with doubts (5 taps, 8 scrolls)
- You → Language → 繁體中文: the app switched at once (3 taps). 首頁 ("Home") → 每週週報 ("Weekly bulletin"): 2 taps. The bulletin reopened partway down the page ([26](images/26-zh-bulletin-reopens-mid-page.jpg), finding 2).
- Translated: every section and row label (特別事項 "Special remark", 安息日學 "Sabbath School", 崇拜程序 "Order of worship", 報告事項 "Announcements", 服事安排 "Service roster", and so on). Also the buttons (開啟詩歌 "Open hymn", 立即閱讀 "Read now", 閱讀課程 "Read lesson"), the date (2026年11月28日), 皇后區 / 布魯克林 (Queens / Brooklyn), and 本週 / 下週 (This week / Next week) ([27](images/27-zh-queens-top.jpg)).
- From the data: the remark (感恩安息日：崇拜後全體團契午餐, "Thanksgiving Sabbath: fellowship lunch for all after worship"), the lesson (第9課 驗證先知), the sermon title (當洪水上漲時：在人生風暴中信靠上帝), and the announcement (崇拜後有愛筵。"Love feast after worship."). "TBD" became 尚未安排 and "Name withheld" became 姓名保留 ([28](images/28-zh-queens-tbd-withheld.jpg), [30](images/30-zh-announcements-roster.jpg)).
- Stayed English: the made-up names (as typed), "Local Church Budget" under 本地教會預算, and the special-music piece ([29](images/29-zh-offering-english-line.jpg)).
- Brooklyn in Chinese: hymn 100 stays English ([31](images/31-zh-brooklyn-hymn-100-english.jpg), finding 8). The Chinese hymn pages show Simplified titles ([41](images/41-zh-card-497-simplified.jpg), finding 7).
- Apart from finding 11, nothing read as machine-translated.

### 8. Freshness: Not done (no way to find out)
- No update time anywhere on the page ([03](images/03-bulletin-top-queens.jpg), [10](images/10-queens-announcements-roster-end.jpg)).
- Refresh turned grey at once and stayed grey for about 2 minutes, with no words ([33](images/33-refresh-grey-no-message.jpg)). Tapping "Q4" and pulling the page down did nothing.
- Home and back: still grey. After it turned blue, a second Refresh did the same.
- Network off, bulletin reopened: full bulletin, no offline note ([34](images/34-offline-bulletin-no-note.jpg)). Refresh, once the wait was over, behaved the same as online ([35](images/35-offline-refresh-looks-same.jpg)).
- Closed and reopened offline: full bulletin, Brooklyn remembered, Refresh still grey, "This Week" whole again ([36](images/36-offline-after-restart.jpg)). Network back on (finding 1).
- On this build the data is fixed, so real refresh timing could not be tested.

### 9. Proof for the pastor: Not done in the app (3 long-presses)
- There is no share or copy on the bulletin. Long-presses selected nothing (finding 10).
- What he would do instead: phone screenshots, one per screen. Android's own screenshot offered "Capture more"; whether it captures the whole bulletin was not tested.

### 10. 150% text and landscape: Done (8 taps to 150%, 4 to restore)
- You → Text size → "+5%" five times ("Current selection: 150%") → X (finding 15).
- At 150%, "Q4" moved below the date ([37](images/37-150-bulletin-top.jpg)). The three names still fit on one line; long titles wrap cleanly. The roster ends above the tab bar with nothing hidden ([38](images/38-150-sabbath-school-three-names.jpg), [39](images/39-150-roster.jpg)). Queens took about 9 scrolls.
- Landscape: the app stayed upright ([40](images/40-landscape-app-stays-upright.jpg), finding 14). Rotation was set back to portrait, and "Reset to 125%" restored the text size.

## What worked well
- The bulletin is one tap from Home, and setup took 5 taps.
- Labels read like spreadsheet columns. The sections are clear and in a sensible order: Special Remark, Sabbath School, Worship Program, Announcements, Service Roster.
- The hard cases display cleanly at 125% and 150%: the long hyphenated name, three names in one role, and the long sermon title. Nothing is cut off.
- Every hymn opened the right number and title, and every Chinese link matched in both directions. Back returns to the same spot in the bulletin.
- Both Bible links opened the right chapter; Psalms 119 opened at verse 105.
- The language switch is instant. Labels, dates, church names, data fields and hymn numbers all change, and "TBD" and "Name withheld" are translated too.
- Offline, the whole bulletin stayed readable, even after a restart.
- No crashes or error screens.

## Limits of this walk-through
- The church's real spreadsheet and real bulletin were not used and not reached. The build shows a fixed made-up bulletin, so he could not edit a cell and watch it change. Real refresh timing could not be tested; Refresh may fetch nothing on this build.
- Next week's content repeats this week's apart from the lesson (including the Thanksgiving remark on December 5). This is likely the made-up data, so it is not judged.
- Whether "TBD" comes from a blank cell or typed text, and whether Brooklyn's missing rows are blank cells or absent columns, can't be confirmed without the sheet.
- The offline bulletin may come from this build's built-in data rather than a saved copy (as Mr. Wong noted). Recheck findings 1 and 2 on a normal build.
- The phone stayed in English; only the app language was switched.
- Outside pages (hymn score site, YouTube) were not opened or screenshotted, apart from one hymn title that opened a browser tab.
- Android's "Capture more" screenshot was not tested; its button had closed before the tester tapped it, and the test screenshot was deleted from the emulator.
- Landscape was forced with auto-rotate off (`user_rotation` 1), then set back to portrait.
- The Refresh countdown was read from its screen-reader label; TalkBack was not used.
- Thursday, not a Sabbath. No screen lock. Tap counts are the tester's.

## Proposed issues
- Show when the bulletin was last updated, and say what Refresh did (worked, no connection, or wait). Covers 1. High. Filed as [#836](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/836).
- Keep the church and date visible while scrolling; consider opening at the top. Covers 2. High. Filed as [#837](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/837).
- Make empty slots and withheld names understandable. Covers 3, 4. Medium. Filed as [#838](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/838).
- Chinese hymn titles: same script as the bulletin, and handle hymns with no Chinese version. Covers 7, 8. Medium. The script part was added to [#795](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/795); the hymn with no Chinese version is [#839](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/839).
- "This Week" button label cut to "This". Covers 9. Medium. Filed as [#840](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/840).
- Brooklyn layout: rows shown twice, the "Sabbath School" row, and marking opening vs closing hymns. Covers 5, 6. Low. Filed as [#841](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/841).
- Share or copy the bulletin for sending to the pastor. Covers 10. Low. Filed as [#842](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/842).
- Small wording and polish: Chinese role labels, verse highlight, past or third week, landscape, text-size wording. Covers 11–15. Low. Filed as [#843](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/843).
