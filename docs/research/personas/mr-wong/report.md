# Persona walk-through: Mr. Wong (made up)
Build: `org.nyccsda.app.preview` 1.9.0 (versionCode 1009000), a key-screens build with made-up bulletin and team data and no launch animation. Installed 2026-11-26 14:04.
Date: Thursday 2026-11-26 (not a Sabbath; the bulletin showed the coming Sabbath, 2026年11月28日).
Device: Android 16 emulator, Pixel 9a profile, 1080x2424, gesture navigation (no on-screen Back button), no screen lock set.
Settings: app language 繁體中文 (Traditional Chinese; app locale set to zh-TW before first launch, phone system language left in English), in-app text size 125%, system font scale 1.0, the other setup steps left at their defaults. Media volume muted.

## Bottom line
Mr. Wong could do everything he set out to do. He switched John 3 to Cantonese, kept it playing from the notification and with the screen off, and let it run on into John 4. He saved the Gospel of John for the bus without spending mobile data, played it offline after a restart, and deleted it again. Changing to Cantonese was easy because the player's language button has a word on it (國語 "Mandarin", which becomes 粵語 "Cantonese"). Downloading was handled well: each book shows its size, the app asks before using mobile data and offers 等待 Wi-Fi ("Wait for Wi-Fi"), and the download starts by itself when Wi-Fi returns. The weak spot is flaky Wi-Fi. A 30-second drop in the middle of a chapter did no harm. But when the network was down as a new chapter began, the reading simply stopped, with no Chinese message and no reason given: only a play button and a small spinner. Twice the screen also jumped to Luke 5 with a blank page and no player. It recovered by itself within seconds of the network coming back. Offline, the hymn and livestream buttons drop him into YouTube with no warning. After a restart the app remembered his chapter, but not his place in it.

## Findings, by severity
| # | Severity | Task | What happened | Why it matters to him | Screenshot | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | **Major** | 5 | Network off at the end of a chapter that was not downloaded (John 4). John 5's text appeared, but its audio never started. The player showed a play button, 0:00 and a small spinner at the right of the bar. No words appeared. Tapping play started the spinner again, then nothing. In about three minutes offline, no message came. A small blue dot on the 粵語 button appeared only after the network was back; tapping it showed, in blue, 播放時常停下來載入。下載後即可收聽，不必等待。("Playback often stops to load. Once downloaded you can listen without waiting.") | He is listening, not looking, and the reading just stops. Nothing tells him the network is the cause, that it will carry on by itself, or that downloading would help. He doesn't know a dot means "tap here". | [19](images/19-offline-end-of-john-4.jpg), [20](images/20-offline-john-5-waiting.jpg), [24](images/24-dot-popup.jpg) | Put a worded line on the player when audio can't load, such as 沒有網絡，恢復後會自動繼續 ("No network; it will continue when the network is back"), with a 下載 ("Download") button beside it. |
| 2 | **Major** | 5 | Twice while it was retrying offline, the screen jumped to the wrong book. The book button read 路加福音 ("Luke") 5, the page was blank with a spinner, and the audio player was gone. A few seconds later it was back on 約翰福音 ("John") 5. The first time came with no tap at all, about 15 seconds after John 5 appeared; the second came about 13 seconds after he tapped play. | He sees the wrong book name and the player disappear. If he taps at that moment he may end up in Luke, or think he has lost his place. | [21](images/21-offline-jumped-to-luke-5-blank.jpg), [22](images/22-offline-play-tap-luke-again.jpg) | Keep the screen on the chapter being retried while the app tries its audio sources. |
| 3 | Minor | 6 | After the app was closed completely and reopened offline, it remembered 約翰福音 5 and 粵語, but the player started at 0:00. He had stopped at about 3:35. | On the bus he has to hear the start again, or find his place with the 30-second button. | [31](images/31-bible-remembers-john-5.jpg) | Resume from where he stopped, or offer 從上次停止處繼續 ("Continue from where you stopped"). |
| 4 | Minor | 3, 4 | The media notification reads 約翰福音 3 · CUV (HelloAO) on the first line and CUV • 粵語 (WordProject) on the second. | He can pick out 約翰福音 3 and 粵語, but CUV, HelloAO and WordProject are English he can't read. HelloAO is also not where the Cantonese audio comes from. | [11](images/11-notification-shade.jpg) | Use plain Chinese, such as 約翰福音 第3章 and 粵語朗讀 ("read in Cantonese"). |
| 5 | Minor | 4 | After the player moved on to John 4 by itself, the notification's progress bar sat about three quarters along. At the same moment the app showed 0:50 of 8:03. | If he looks at that bar, or drags it, it gives the wrong idea of how much is left. | [16](images/16-shade-bar-wrong-john-4.jpg) | Update the notification's position when a new chapter starts. |
| 6 | Minor | 7 | With the network off, 演唱 ("Sung") on a hymn and the 觀看直播 ("Watch live") tile both opened the YouTube app at once. YouTube then showed "Connect to the internet" and "Can't load link". The church app said nothing first. | He lands in another app with an error, without warning. The phone uses gesture navigation, so he needs the Back swipe to return. The YouTube text is English only because the phone is in English here. | none | When offline, show a short Chinese note in the app, such as 需要網絡才能觀看 ("Needs the network to watch"), instead of opening YouTube. |
| 7 | Minor | 7 | Offline, 每週週報 ("Weekly bulletin") showed a full bulletin for 2026年11月28日, with no note that it was a saved copy or that he was offline. When he tapped the round refresh button, it turned grey and stayed grey, with no words. | He can't tell whether this is the latest bulletin. A grey button with no reason looks broken. | [33](images/33-bulletin-offline.jpg), [34](images/34-bulletin-refresh-grey-offline.jpg) | Show a line such as 離線：顯示上次儲存的週報 ("Offline: showing the last saved bulletin"), and say why refresh is unavailable. |
| 8 | Minor | 2 | The 書卷 ("Books") list is one list of 66 names with no 舊約 / 新約 ("Old / New Testament") headings. It took 5 drags to reach 約翰福音, the 43rd book. | He reads slowly, so scanning 40 names is tiring, and a fast drag overshoots. | [05](images/05-book-list.jpg) | Add 舊約 / 新約 headings, or a way to jump to 新約. |
| 9 | Minor | 8 | On 離線聖經音訊 ("Offline Bible audio"), rows with downloads say, for example, 已下載 1 / 66 卷 · 尚餘 774.4 MB ("Downloaded 1 of 66 books · 774.4 MB remaining"). Delete is a trash icon with no word, and the first one is on 整本聖經 ("Whole Bible"). Coming from 您, the 福音書 ("Gospels") group was folded, so John was hidden until he tapped 福音書. | He may read 尚餘 as free space left on his phone. He has to know that John sits under 福音書. A wordless trash icon near the top could delete more than he means (it does ask first). | [38](images/38-offline-page-remaining-trash-icons.jpg), [39](images/39-delete-confirm.jpg) | Say 未下載 ("not yet downloaded") instead of 尚餘. Put the word 刪除 ("Delete") by the icon. Keep a group with a downloaded book open. |
| 10 | Minor | 8 | At 125%, the delete question splits its size across lines: 刪除約翰福音？（17.9 on the first line, MB） alone on the second. | The size looks broken. | [39](images/39-delete-confirm.jpg) | Put the size on its own line, or in the line below the title. |
| 11 | Note | 3, 6 | After he paused, the audio notice stayed in the notification shade, and the system marks it as not clearable. `am kill` could not close the app while it was there. Only swiping the app away on the Recents screen removed it. | He may wonder why the notice never goes away after he stops listening. | none | Consider letting a paused notice be swiped away, or removing it after a while. |
| 12 | Note | 6 | While waiting, the 約翰福音 row read 等待 Wi-Fi · 0.0 MB / 17.9 MB, with a download arrow and an X beside it. What the arrow does was not tested. | He may think he must tap the arrow to start, and it might use his mobile data. | [28](images/28-waiting-for-wifi.jpg) | Show only the X, or word the arrow (for example 立即用行動數據下載, "Download now on mobile data"). |
| 13 | Note | 2 | The 有聲書設定 ("Audiobook settings") popup that holds the language choice also has 優先音源 ("Preferred audio source") with HelloAO and NYCCSDA.org, and names the publishers in English (WordProject, Audio Power). The Simplified 基督徒团契 there was also seen by Mrs. Lin (her finding 23). | He has to open this popup to change language, and half of it is words he can't read. He leaves them alone. | [07](images/07-audio-settings.jpg), [24](images/24-dot-popup.jpg) | He may not expect a source choice here; consider placing it lower or elsewhere. |
| 14 | Note | 1 | On the 文字大小 ("Text size") step, 125% is already chosen. Only a thin blue outline shows it, and tapping it changes nothing on screen. | He can't be sure his choice took. | [02](images/02-text-size-125.jpg) | A check mark or a filled button on the chosen size. |
| 15 | Note | 4 | The end of each chapter shows an English credit line: "Public domain (1919). Text adapted from WordProject." Below it is 粵語錄音：WordProject (wordproject.org). | He can't read the English line. | [14](images/14-near-end-john-3-credits.jpg) | Give the credit line in Chinese. |

## Task by task

### 1. Reopen and setup: Done (6 taps)
- The app opened in Traditional Chinese with 繁體中文 already chosen. He tapped 下一步 ("Next").
- On 文字大小, 125% was already chosen. He tapped it anyway, and nothing changed on screen ([02](images/02-text-size-125.jpg), finding 14).
- He left the other steps alone: 下一步 three times, then 開始使用 ("Start").
- Home looked as Mrs. Lin saw it. The countdown read 1d 02:24:29: also seen by Mrs. Lin (her finding 7). No permission prompts.

### 2. John 3 in Cantonese: Done (9 taps, 5 drags)
- He tapped 聖經 ("Bible"). Genesis 1 opened with English under every verse: also seen by Mrs. Lin (her finding 11). It matters less to him, since he listens.
- 創世記 ▾ ("Genesis") opened the 書卷 list. It took 5 drags to reach 約翰福音 ([05](images/05-book-list.jpg), finding 8). Then 1 ▾ and 第 3 章 ("Chapter 3").
- How he finds out which language is playing: the round button at the left of the player says 國語 ("Mandarin"). It is the only worded button on the player, so he taps it.
- 有聲書設定 opened with 朗讀語言 ("Reading-aloud language"): 國語 with a check mark, and 粵語 ("Cantonese") ([07](images/07-audio-settings.jpg)). He tapped 粵語, and the check moved. The popup stayed open; he closed it with X. The player button now said 粵語 ([09](images/09-player-cantonese.jpg)).
- He tapped the big play button. Cantonese audio started at once, 0:05 of 5:33, with a blue bar beside verse 1.

### 3. Keep listening while doing other things: Done (3 taps)
- He pressed Home. The audio kept playing.
- In the notification shade, a media card showed 約翰福音 3 · CUV (HelloAO) and CUV • 粵語 (WordProject), a large pause button, back 10 and forward 30 buttons, and a progress bar ([11](images/11-notification-shade.jpg), finding 4).
- He tapped pause, and it paused. He tapped play, and it carried on.
- Screen off for 10 seconds, then on: the audio kept going. No lock screen appeared, because this emulator has none set (see Limits). He reopened the app from its icon: 1:36 of 5:33, and the page had followed to verse 11.
- No notification-permission prompt appeared, and the media card showed anyway: also seen by Mrs. Lin (her finding 19).

### 4. Run to the end and on to John 4: Done (0 taps)
- To save time the tester dragged the bar to 5:22. Verse 36 was highlighted, with the credit lines below ([14](images/14-near-end-john-3-credits.jpg), finding 15).
- At the end the player went on to 約翰福音 4 by itself, still in 粵語. The chapter button changed to 4, and the page followed: verse 3 highlighted at 0:19.
- The notification's progress bar was wrong after the change ([16](images/16-shade-bar-wrong-john-4.jpg), finding 5).

### 5. Flaky Wi-Fi: Done with trouble (recovers by itself, but no message)
- Drop in mid-chapter: Wi-Fi and mobile data off for 30 seconds while John 4 (not downloaded) played. It kept playing without a gap: 1:41 at the end of the 30 seconds, 2:02 twenty seconds after the network came back. Nothing appeared, and nothing was needed.
- Drop at a chapter change: network off, and the tester dragged to 7:49 of John 4 ([19](images/19-offline-end-of-john-4.jpg)). When John 4 ended, John 5's text appeared but its audio didn't start: play button, 0:00, small spinner ([20](images/20-offline-john-5-waiting.jpg), finding 1).
- About 15 seconds later the screen showed 路加福音 5, blank, with no player, then went back to John 5 ([21](images/21-offline-jumped-to-luke-5-blank.jpg), finding 2).
- He tapped play. The spinner came back, the Luke screen came again ([22](images/22-offline-play-tap-luke-again.jpg)), and there was still no message.
- Network on: within 5 seconds John 5 began playing in 粵語 by itself. A small dot was now on the 粵語 button. Tapping it opened 有聲書設定 at 離線收聽 ("Offline listening"), with the blue tip ([24](images/24-dot-popup.jpg)).

### 6. Save John for the bus: Done (3 taps to download; 3 taps to play offline after a restart)
- From the tip he tapped 離線聖經音訊. The bottom tab moved to 您 ("You"), and the page opened at 福音書 with 約翰福音 17.9 MB. The way in is through the language button again: also seen by Mrs. Lin (her finding 4). For him there is also a worded row in 您, which he finds in task 8.
- The top of the page says the audio stays on this phone until he deletes it and isn't in the phone's backup, and shows 朗讀者 ("Reader") 粵語（和合本） with 更改 ("Change"). The page itself says nothing about Wi-Fi or mobile data.
- To check the data question, the tester turned Wi-Fi off and left mobile data on. Tapping the download arrow by 約翰福音 brought up 使用行動數據？您正在使用行動數據。這次下載共 17.9 MB。("Use mobile data? You are on mobile data. This download is 17.9 MB."), with 使用行動數據 ("Use mobile data"), 等待 Wi-Fi and 取消 ("Cancel") ([27](images/27-mobile-data-question.jpg)). He chose 等待 Wi-Fi.
- The row read 等待 Wi-Fi · 0.0 MB / 17.9 MB ([28](images/28-waiting-for-wifi.jpg), finding 12). When Wi-Fi came back it showed 等待下載 ("Waiting to download"), then 已下載 · 17.9 MB ("Downloaded") within about 30 seconds, with no tap.
- Network off. He paused from the notification. `am kill` could not end the app while the audio notice was up, so the tester swiped the app away on the Recents screen, then ran `am kill`; `pidof` then found no process (finding 11).
- He reopened the app offline. It opened on Home. He tapped 聖經: 約翰福音 5, 粵語, 0:00 ([31](images/31-bible-remembers-john-5.jpg), finding 3). He tapped play: 0:06 of 7:09, playing from the download with no network.

### 7. Network-only parts while offline: Done (9 taps)
- 每週週報: a full bulletin, with no offline note. The refresh button turned grey when tapped ([33](images/33-bulletin-offline.jpg), [34](images/34-bulletin-refresh-grey-offline.jpg), finding 7). The names on it are the build's made-up data.
- 詩歌本 ("Hymnal"): the list loaded offline. Some titles are in Simplified (1. 在主宝座前): also seen by Mrs. Lin (her finding 9). 演唱 opened YouTube with "Connect to the internet" (finding 6). He went back with the Back gesture.
- 觀看直播: YouTube again, with "Can't load link". Back again.
- Then the network was turned back on.

### 8. Space used, and delete a book: Done (5 taps, 2 drags)
- In 您, under 設定 ("Settings"), the row 離線聖經音訊 says 已下載：17.9 MB ("Downloaded: 17.9 MB"). That answers "how much space" in words, one tap from 您.
- He tapped it. The top row read 整本聖經 已下載 1 / 66 卷 · 尚餘 774.4 MB, with download and trash icons ([38](images/38-offline-page-remaining-trash-icons.jpg), finding 9). He dragged down twice; 福音書 was folded, and tapping its name opened it. 約翰福音 showed 已下載 · 17.9 MB and a trash icon.
- The trash icon asked 刪除約翰福音？（17.9 MB）之後可以再次下載。("Delete John? (17.9 MB) You can download it again later."), with 刪除 and 取消 ([39](images/39-delete-confirm.jpg), finding 10). He tapped 刪除. The row went back to 17.9 MB with a download arrow.

## What worked well
- The player's language button is worded (國語, then 粵語), so he could see which language was playing and change it in three taps. The notification also says 粵語.
- Audio kept playing through Home, the notification shade and the screen turning off. Pause and play in the notification worked.
- At the end of a chapter it went on to the next by itself, and the page and the verse highlight followed.
- A 30-second drop in the middle of a chapter caused no gap at all.
- When the network came back, playback carried on by itself, and a tip then suggested downloading.
- Downloads: every book and group shows its size. On mobile data the app asks first, gives the size, and offers 等待 Wi-Fi; the download then starts by itself on Wi-Fi.
- 您 shows the downloaded size in words. Delete asks first and says he can download again later.
- After a full restart with no network, the app remembered the book, chapter and 粵語, and played from the download.
- No crashes or error screens from the app.

## Limits of this walk-through
- "Had the app for a week" was simulated: data was cleared and setup run again, so there was no earlier history (no old downloads or settings).
- No screen lock is set on this emulator, so sleep then wake went straight to the home screen. The lock-screen media controls were not seen.
- Media volume was muted. Playback was judged from the phone's playback state and the screen. While offline, the app logged "Bible audio source failed to load; trying the next configured source." again and again.
- The tester dragged the seek bar twice to reach the end of a chapter.
- Network drops were made by switching Wi-Fi and mobile data off and on. Slow or patchy Wi-Fi was not simulated. The mid-chapter drop did no harm because the whole chapter had already loaded; on a slow line it might not have.
- The mobile-data question was checked by the tester with Wi-Fi off. On emulator mobile data the download itself was not tried.
- `am kill` could not close the app while the paused audio notice was up; the app was swiped away on Recents first.
- The offline bulletin may come from this special build's made-up data rather than a saved copy. Recheck finding 7 on a normal build.
- The phone's system language was English, so YouTube and system screens were in English.
- The Luke 5 jump was seen twice, both while retrying offline at John 5. Not tested online, or with other chapters.
- Tap counts are the tester's. A real user would add hesitation taps.
- Not tested: the sleep timer button, the arrow on the 等待 Wi-Fi row, the 下載通知 ("Download notifications") switch, downloading on mobile data, and a real phone.

## Proposed issues (not filed)
- Tell the listener in Chinese when audio stops for lack of network, and offer the download right there. Covers 1. High.
- Keep the Bible screen on the right chapter while the audio source is retried offline (Luke 5 jump). Covers 2. High.
- Resume the audio where he stopped after the app restarts. Covers 3. Medium.
- Plain-Chinese, up-to-date media notification: title, position after moving to the next chapter, and a paused notice he can clear. Covers 4, 5, 11. Medium.
- Offline handling for network-only buttons and the bulletin: a note before opening YouTube, a saved-copy note, a worded refresh state. Covers 6, 7. Medium.
- Offline audio page wording and controls: 尚餘, worded delete, the arrow on the waiting row, the split size in the delete question, a folded group hiding a downloaded book. Covers 9, 10, 12. Low.
- Book-list headings and small wording: 125% chosen state, English credit line, the audio-source section. Covers 8, 13, 14, 15. Low.
