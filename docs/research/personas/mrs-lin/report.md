# Persona walk-through: Mrs. Lin (made up)
Build: `org.nyccsda.app.preview` 1.9.0 (versionCode 1009000), a key-screens build with made-up bulletin and team data and no launch animation. Installed 2026-11-24 19:33.
Date: Tuesday 2026-11-24 (not a Sabbath; the bulletin showed the coming Sabbath, 2026年11月28日).
Device: Android 16 emulator, Pixel 9a profile, 1080x2424, gesture navigation (no on-screen Back button).
Settings: app language 繁體中文 (Traditional Chinese; app locale set to zh-TW before first launch, phone system language left in English), in-app text size 150%, system font scale 1.0, theme and contrast left at their defaults (系統, 高對比度). Media volume muted.

## Bottom line
Mrs. Lin could set up the app, read this week's bulletin, open Psalm 23 in Chinese, play and download the audio, and change the text size and language. She did most of it by tapping clear Chinese words. She could not find the church's address and service times: they sit under 新會友／訪客 ("New members / Visitors"), and after trying 探索 (Explore) and 您 (You) she would give up. Three other places would trip her up. The round arrow in the Bible book list picks a book instead of scrolling. A bulletin hymn opens on an outside web page in Simplified Chinese. The offline download can only be reached through a button labelled 國語 ("Mandarin"). At 150% the text is large and mostly fits, but in a few places a word breaks onto its own line or text hides under a floating title.

## Findings, by severity
| # | Severity | Task | What happened | Why it matters to her | Screenshot | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | **Blocker** | 6 | Home has no tile for church address or service times. 探索 (Explore) lists books, sermons, audio and Zoom. 您 (You) lists settings, help and legal pages. The address is under 首頁 → 新會友／訪客 ("New members / Visitors") → 地點與歷史 ("Location and history"). The service times are under 新會友／訪客 → 團契 ("Fellowship"), as 安息日崇拜 星期六上午 10:00 - 下午 1:00 ("Sabbath worship, Saturday 10:00 AM to 1:00 PM"). | She is a member, not a visitor, so she won't open 新會友／訪客. Nobody looks for service times under 團契 ("Fellowship"). After two wrong turns (探索, 您) she gives up. | [28](images/28-home-tiles-no-church-info.jpg), [31](images/31-you-bottom.jpg), [33](images/33-location-addresses.jpg), [34](images/34-fellowship-service-times.jpg) | Add a plainly worded entry such as 教會地址與聚會時間 ("Church address and service times") on Home or under 您, or give 新會友／訪客 a name that includes members. |
| 2 | **Major** | 3 | In the bulletin, 開啟詩歌 ("Open hymn") opens the hymnal page with one card for 413, not the hymn itself. Tapping the hymn title on the card leaves the app for an outside site (m.zgaxr.com) in a browser tab. There the title and all the lyrics are in Simplified Chinese (教会基础, 教会有一个基础…), and the browser bar showed English: "Minimize tab to return to it later" and "Translate". | She may not expect the button to show a list card, or to land in a browser. She reads Traditional only, so the Simplified lyrics are hard for her. The English browser prompts come from the phone being in English here; on her own phone they would be in Chinese. | [11](images/11-hymn-413-open.jpg) | Let 開啟詩歌 open the hymn in one tap. Say before leaving the app that the words open on an outside page. Look for a Traditional-script source, or say that the page is in Simplified. |
| 3 | **Major** | 4 | In the 書卷 ("Books") list a round blue down-arrow floats over the last row. Tapping it did not scroll: it chose the book under it, 撒母耳記上 (1 Samuel), and closed the list. The same arrow sits over rows or text in the chapter list, the Bible version list, the language list and the text-size popup. | It looks like a button meaning "more below", so she taps it and lands in the wrong book. That is her first wrong turn in this task. | [15](images/15-book-picker.jpg), [16](images/16-arrow-picked-1-samuel.jpg), [35](images/35-text-size-150-preview-cut.jpg) | Make the arrow scroll the list, or keep it from sitting over a tappable row. |
| 4 | **Major** | 5 | Nothing on the audio player says 下載 ("Download") or 離線 ("Offline"). The download is behind the 國語 ("Mandarin") button: 有聲書設定 ("Audiobook settings") → 離線收聽 → 離線聖經音訊. She found it only because 國語 is the one button on the player with a word on it. The download list then uses icon-only download buttons. Opening it also switched the bottom tab from 聖經 to 您. | She finishes only by luck. A button labelled with a dialect name does not suggest "save for offline". | [21](images/21-audio-playing.jpg), [22](images/22-audio-settings-offline.jpg), [23](images/23-offline-audio-page.jpg) | Put a worded 下載／離線收聽 control on the player, or show a 離線收聽 line on the player. |
| 5 | Minor | 1 | Setup step 外觀模式 ("Appearance"): the pictures for 系統 ("System") and 日出/日落 ("Sunrise/Sunset") look the same, half light and half dark. The last step asks which bar is clearer in 深色模式 ("dark mode"), but her phone is in light mode. | She can't tell the first two choices apart, and she may not expect a question about a mode she never sees. She leaves the defaults. | [04](images/04-appearance-step.jpg) | Make the two pictures differ, or skip the dark-mode question when the phone is in light mode. |
| 6 | Minor | 1 | At 150%, the two buttons on the Home picture break one character onto its own line: 分享經 / 文 ("Share verse") and 查閱經 / 文 ("Look up verse"). | Each word reads as broken. | [06](images/06-home-first-view.jpg) | Let the buttons grow, or stack them, so 經文 stays together. |
| 7 | Minor | 1 | The Sabbath countdown reads 2d 20:55:32, with an English "d" for days. | She may not know what "d" means. | [06](images/06-home-first-view.jpg) | Use 天 ("days") in Chinese. |
| 8 | Minor | 2 | The bulletin is long at 150%. The Sabbath School hymns (5., 225.) come first. The worship hymns start about three screens down, and the preacher (證道 "Sermon": Jonathan P., a made-up name) is about four screens down. A "Q4" chip sits beside the date. | She may take the Sabbath School hymns for the service hymns. She may not know what "Q4" means. | [08](images/08-bulletin-sabbath-school-hymns.jpg), [10](images/10-bulletin-preacher.jpg) | Consider a short summary at the top (preacher and service hymns), and a Chinese word for "Q4". |
| 9 | Minor | 2, 3 | Some hymn titles show in Simplified characters while the rest of the app is Traditional. Bulletin: 5. 赞美上主, 16. 快乐颂, 413. 教会基础. Others are in Traditional: 497. 讚美上帝, 498. 請聽我祈求, 504. 散會頌. The hymnal list also shows 2. 圣哉真神. | The mixed scripts look wrong, and characters like 乐, 颂 and 础 are harder for her. Because the hymnal list does it too, this is not only the made-up bulletin data. | [08](images/08-bulletin-sabbath-school-hymns.jpg), [11](images/11-hymn-413-open.jpg), [13](images/13-hymnal-list-simplified.jpg) | Show Traditional titles when the app is in 繁體中文. |
| 10 | Minor | 3 | On the full hymnal list at 150%, the floating title 中文讚美詩 – 505 版 ("Chinese Hymnal, 505 edition") wraps to two lines, with 版 ("edition") alone on the second line. | The title looks broken. | [13](images/13-hymnal-list-simplified.jpg) | Shorten the title or let it shrink. |
| 11 | Minor | 4 | The Bible opens with English (BSB) under every Chinese verse (chip "繁 CUV + EN BSB"). To read Chinese only, she has to tap that chip, which has only letters and no Chinese word, and then turn off 雙語閱讀 ("Bilingual reading"). | She may not expect English lines in every verse. They double the scrolling at 150%. | [14](images/14-bible-tab.jpg) | Consider Chinese-only as the default for 繁體中文, or a worded control. |
| 12 | Minor | 4 | In 閱讀語言 ("Reading language"), tapping the words 雙語閱讀 did nothing. Only the small switch at the right turned it off. | She taps words, not small switches. | [19](images/19-bilingual-row-tap-no-change.jpg) | Make the whole row toggle the switch. |
| 13 | Minor | 5, 6 | Floating title pills cover page text. On 離線聖經音訊 ("Offline Bible audio") the group line for 詩歌智慧書 ("Poetry and Wisdom books": 已下載部分 · 尚餘 121.6 MB) is hidden under the title. On 地點與歷史 the pill keeps saying 歷史 ("History") while she reads 崇拜地點 ("Worship locations") and 團契 ("Fellowship"). | She can't read the hidden line, and the title names the wrong section. | [24](images/24-downloading.jpg), [33](images/33-location-addresses.jpg) | Keep the pill from covering the first line, and have it show the current section (or the page name). |
| 14 | Minor | 6 | The church addresses are in English only (76-06 41st Ave, Elmhurst, Queens, NY 11373), in light grey above the Chinese church name. | She can't read the address, and it is the least visible line in the card. | [33](images/33-location-addresses.jpg) | Add the address in Chinese, or a "show to a taxi driver" style layout; make the address darker. |
| 15 | Minor | 6 | The service-times text reads 星期六上午 10:00 - 下午 1:00 ("Saturday 10:00 AM to 1:00 PM"), then 每週的主日崇拜服務 ("the weekly Lord's-day worship service"). | Many Chinese Christians read 主日 as Sunday, so she may wonder whether there is a Sunday service. | [34](images/34-fellowship-service-times.jpg) | Say 安息日崇拜 ("Sabbath worship") instead of 主日崇拜. |
| 16 | Minor | 7 | The 您 tab reopened scrolled to the bottom (where she had left it in task 6), so 文字大小 ("Text size") was off the screen. The tester's tap where 文字大小 usually sits opened 法律聲明 ("Legal notice"), an English-only web page. | She has to scroll up first. A tap in the usual place can open an English page. | [31](images/31-you-bottom.jpg) | Open 您 at the top, or put the settings where they stay visible. |
| 17 | Minor | 7 | At 150%, the 字體大小 ("Font size") popup cuts off its sample verse: "約翰福音 9:25" is half hidden under the bottom edge, with the round arrow over it. At 130% it fits. | The sample that shows her the size is clipped at the size she uses. | [35](images/35-text-size-150-preview-cut.jpg) | Give the sample room, or drop it under the buttons, at large sizes. |
| 18 | Note | 1 | On the first screen, each language card holds a picture of the tab bar (首頁 聖經 探索 您: Home, Bible, Explore, You) that looks like real buttons. Not tested whether tapping them does anything. | She may tap the pictures and expect something to happen. | none | Make the pictures look less like buttons, or make a tap on them choose the card. |
| 19 | Note | 1, 5 | No notification-permission prompt appeared during the whole walk-through (the permission stayed not granted). Audio still played. | Nothing to confuse her. Worth knowing if download or audio notices rely on it. | none | Check whether the app is meant to ask. |
| 20 | Note | 1 | Seen before the restart: when the app went to the background mid-setup (caused by another test session, not by her) and was reopened, setup began again at the language step. | If a phone call interrupts setup, she may have to start over. The cause here was outside the app, so this needs a clean recheck. | none (first attempt) | Recheck; consider saving setup progress. |
| 21 | Note | 5 | The smallest download is the whole book of 詩篇 ("Psalms", 68.3 MB). It started at once with no size question, and it finished in under 30 seconds on emulator Wi-Fi. It showed 下載中 · 2.5 / 68.3 MB ("Downloading"), then 已下載 · 68.3 MB ("Downloaded"). | She can't save just one chapter. On mobile data, 68 MB may surprise her. | [24](images/24-downloading.jpg) | Consider a note when she isn't on Wi-Fi. |
| 22 | Note | 7 | The text-size popup has 重設為 125% ("Reset to 125%"). | She may expect "reset" to go back to her own 150%. | none | Consider wording that says what it resets to and why. |
| 23 | Note | 1, 5, 7 | Small wording mismatches. The 您 row says 文字大小 but its popup says 字體大小 (both mean text size). Setup calls the step 外觀模式 but points her to 「您」→「主題」 ("Theme"). The audio settings show the publisher as 基督徒团契 (Audio Power), in Simplified characters. | Different names for the same thing make her unsure she is in the right place. | [04](images/04-appearance-step.jpg), [22](images/22-audio-settings-offline.jpg), [35](images/35-text-size-150-preview-cut.jpg) | Use one name for each setting. |

## Task by task

### 1. First open and setup: Done (7 taps)
- The app opened straight into Traditional Chinese: 歡迎 ("Welcome"), with 繁體中文 already chosen. She tapped 繁體中文 anyway to be sure, then 下一步 ("Next").
- On 文字大小 ("Text size") she tapped 150%. The sample verse grew at once, so she knew it worked.
- On 外觀模式 ("Appearance") she couldn't tell 系統 and 日出/日落 apart and left the default ([04](images/04-appearance-step.jpg), finding 5).
- She left 高對比度 ("High contrast") on both contrast steps and tapped 開始使用 ("Start").
- Home showed 今日經文 ("Today's verse"), the countdown and the tiles; 分享經/文 breaks at 150% ([06](images/06-home-first-view.jpg), findings 6, 7).
- No permission prompts appeared (finding 19).

### 2. This week's bulletin: Done (1 tap, 4 scrolls)
- On Home she tapped the 每週週報 ("Weekly bulletin") tile. The page opened on 本週 ("This week"), 2026年11月28日, location 皇后區 ("Queens").
- The Sabbath School section came first, with 開會及結會詩歌 ("Opening and closing hymns") 5. 赞美上主 and 225. 平安如河水 ([08](images/08-bulletin-sabbath-school-hymns.jpg)).
- Scrolling on, 崇拜程序 ("Order of worship") listed 497. 讚美上帝, 16. 快乐颂 and 498. 請聽我祈求.
- 證道 ("Sermon"): Jonathan P. (made-up), with 講道題目 ("Sermon title") 當洪水上漲時…; then 回應詩 ("Response hymn") 413. 教会基础 and 後奏曲 ("Postlude") 504. 散會頌 ([10](images/10-bulletin-preacher.jpg)).
- Every hymn has a big 開啟詩歌 button with words. She hesitated over the Simplified titles and the length of the page (findings 8, 9).

### 3. Open a bulletin hymn: Done with trouble (3 taps)
- Under 413 she tapped 開啟詩歌. She landed on the hymnal page, 中文讚美詩 505 版, with one card for 413. 教会基础, not the hymn itself ([11](images/11-hymn-413-open.jpg)).
- The card offers the title, 英文 · 348 ("English · 348"), 演唱 ("Sung", YouTube) and 鋼琴伴奏 ("Piano accompaniment"). She tapped the title.
- A browser tab opened on m.zgaxr.com, blank for a few seconds. Then it showed the numbered score and all four verses in Simplified, under an English browser bar (finding 2).
- She closed it with the X at the top left and was back on the card.
- On the full hymnal list, titles mix scripts and the page title wraps ([13](images/13-hymnal-list-simplified.jpg), findings 9, 10).

### 4. Open Psalm 23 in Chinese: Done with trouble (7 taps and 5 scrolls; 4 more taps to remove English)
- She tapped 聖經 ("Bible"). Genesis 1 opened with English under every verse ([14](images/14-bible-tab.jpg)).
- She tapped 創世記 ▾ ("Genesis"). In the 書卷 list she tapped the round down-arrow to see more, and it opened 撒母耳記上 (1 Samuel) instead. That was her first wrong turn ([15](images/15-book-picker.jpg), [16](images/16-arrow-picked-1-samuel.jpg), finding 3).
- She opened the list again and scrolled to 詩篇 ("Psalms"). It opened at chapter 1. She tapped 1 ▾, scrolled to 第 23 章 ("Chapter 23") and tapped it.
- To drop the English she tapped the "繁 CUV + EN BSB" chip. Tapping the words 雙語閱讀 did nothing; the small switch worked ([19](images/19-bilingual-row-tap-no-change.jpg), findings 11, 12).
- Psalm 23 in Traditional CUV, Chinese only, reads well at 150%: about four verses per screen above the player.

### 5. Play audio, download, play offline: Done with trouble (7 taps)
- She tapped the big play button. Mandarin audio played at once (0:02 / 1:11), and a blue bar beside the verses followed along ([21](images/21-audio-playing.jpg)).
- She looked for a 下載 ("Download") button and found none. She tried 國語, the only worded button, and found 離線收聽 → 離線聖經音訊 ([22](images/22-audio-settings-offline.jpg), finding 4).
- The list opened at 詩歌智慧書 ("Poetry and Wisdom books"), and the bottom tab had moved to 您 ([23](images/23-offline-audio-page.jpg)). She tapped the download arrow beside 詩篇 (68.3 MB). It showed 下載中, then 已下載 within about 30 seconds ([24](images/24-downloading.jpg)).
- With Wi-Fi and mobile data turned off, she tapped 聖經 and then play. Psalm 23 played offline.
- Tester check: Psalm 23 had already been fully buffered while online. So the tester also played Psalm 24 offline, a chapter never streamed; it played from the download.

### 6. Church address and service times: Not done (2 taps, 2 wrong turns)
- She scrolled Home: 觀看直播 ("Watch live"), 每週週報, 奉獻 ("Giving"), 詩歌本 ("Hymnal"), 本週安息日學課程 ("This week's Sabbath School lesson"), 新會友／訪客. Nothing said address or times ([28](images/28-home-tiles-no-church-info.jpg)).
- She tried 探索: books, sermons, audio, Bible study, Zoom. That was wrong turn 1.
- She tried 您: settings, share, help, privacy, legal ([31](images/31-you-bottom.jpg)). That was wrong turn 2, and she gives up.
- Where it actually is (tester): Home → 新會友／訪客 → 地點與歷史, which shows the addresses in English under 崇拜地點 ([33](images/33-location-addresses.jpg)). Then back → 團契, two screens down: 安息日崇拜 星期六上午 10:00 - 下午 1:00 ([34](images/34-fellowship-service-times.jpg)). That is about 4 taps and 4 scrolls (findings 1, 13, 14, 15).

### 7. Text size 130% and back; English and back: Done (15 taps, 2 scrolls)
- She tapped 您. It opened scrolled to the bottom, so she scrolled up to 文字大小 (finding 16).
- 文字大小 opened the 字體大小 popup at 目前選擇：150% ("Current: 150%"); the sample verse is cut off at 150% ([35](images/35-text-size-150-preview-cut.jpg), finding 17).
- She tapped −5% four times. Each tap shrank the text at once, down to 130%. Then she tapped +5% four times back to 150% and closed the popup with X.
- 語言 ("Language") → English: the app switched at once. The Language row stayed first, with the same 文A icon. In the English popup, 繁體中文 is still written in Chinese, so she could find it.
- She tapped 繁體中文. The app returned to Chinese at 150%. The Bible was still Chinese-only CUV at Psalm 24.

## What worked well
- The app opened in her language on first launch, with 繁體中文 already chosen.
- Setup buttons are big and worded (上一步 "Back", 下一步 "Next", 開始使用 "Start"). 150% applied at once, with a live sample.
- The bottom tabs have words under the icons (首頁, 聖經, 探索, 您), and the Home tiles are worded. The bulletin is one tap from Home.
- The bulletin uses big worded buttons (開啟詩歌 "Open hymn", 立即閱讀 "Read now", 閱讀課程 "Read lesson") and clear Chinese labels.
- The Bible book and chapter lists use Chinese names in large rows. Psalm 23 in Traditional CUV is very readable at 150%.
- Audio started at once and followed the verses. The download showed clear progress and a 已下載 state. Offline playback worked, including a chapter never streamed.
- Text size changes with worded −5% / +5% buttons, shows the current value, and applies at once.
- The language switch is instant. 繁體中文 is written in Chinese on the English screen, the row stays in the same place, and her Bible and text-size choices survived the round trip.
- No crashes or error screens during the walk-through.

## Limits of this walk-through
- The emulator was shared. The first attempt was disturbed by another session testing the same app: it sent the app to the background and restarted it. Everything was restarted from a fresh install and cleared data at 19:33. Only finding 20 comes from the first attempt.
- Only the app was set to Chinese; the phone stayed in English. Browser bars (Chrome) and any Android system dialogs would be in Chinese on her real phone.
- System font scale was 1.0; only the in-app 150% was used.
- The date was a Tuesday, not a Sabbath morning. The bulletin showed the coming Sabbath.
- The bulletin and team data are made up. Simplified hymn titles in the bulletin could partly come from that data, but the hymnal list showed them too.
- Scrolling: the persona doesn't know gestures like swipe. The walk-through assumed she can drag a page up and down. If she can't, tasks 2, 4 and 6 get much harder.
- The phone uses gesture navigation with no Back button. Only on-screen X and ‹ buttons were used.
- Tap counts are the tester's. A real first-time user would add hesitation taps.
- Not tested: playing a chapter offline that was never downloaded (what message appears), the 演唱 and 鋼琴伴奏 hymn buttons, 獲取路線 ("Get directions"), the 布魯克林 ("Brooklyn") bulletin, and whether the tab-bar pictures on the language step react to taps.
- The on-screen Pause worked here (playback state PAUSED); the known emulator pause quirk did not appear.

## Proposed issues (not filed)
- Make the church address and service times easy for members to find, in Chinese, with Sabbath wording. Covers 1, 14, 15. High.
- The "more below" arrow in popups and lists picks the row under it instead of scrolling. Covers 3, and 17 in part. High.
- Open a bulletin hymn in one tap, and show hymn titles in Traditional characters in 繁體中文. Covers 2, 9. Medium.
- Show a worded download / offline control on the Bible audio player. Covers 4, 21. Medium.
- Fix text that breaks or hides at 150% (Home buttons, hymnal title, title pills, text-size sample). Covers 6, 10, 13, 17. Medium.
- Bible reading for Chinese-only readers: bilingual default, and let the 雙語閱讀 row toggle. Covers 11, 12. Low.
- Setup and settings wording: identical appearance pictures, dark-mode question, "2d", "Q4", 重設為 125%, mismatched names, the You tab reopening at the bottom. Covers 5, 7, 8, 16, 22, 23. Low.
