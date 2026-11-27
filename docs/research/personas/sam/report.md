# Persona walk-through: Sam (made up)
Build: `org.nyccsda.app.preview` 1.9.0 (versionCode 1009000), a key-screens build with made-up bulletin and team data and no launch animation. Installed 2026-11-26 14:30:57; data cleared and no app locale set before first launch.
Date: Thursday 2026-11-26 (Thanksgiving Day in the US, not a Sabbath; the bulletin showed the coming Sabbath, November 28, 2026).
Device: Android 16 emulator, Pixel 9a profile, 1080x2424, gesture navigation (no on-screen Back button).
Settings: phone and app in English (no app locale set), in-app text size 125% (the setup default), system font scale 1.0, theme and contrast left at their defaults (System, High contrast). Media volume muted. Network on throughout.

## Bottom line
Sam got through setup with the defaults in about a minute (5 taps). Sam could find the church's address and directions, read a plain-English beliefs page, see who leads the church, read an all-English bulletin, open a hymn score, read and play John 3 in English, and share the app with a QR code. No account, sign-in or app permission prompt appeared at any point. The privacy policy says in its first paragraph that there are no accounts, ads or analytics. Two things would stop a first-time visitor. The app never plainly says when the service is or whether there is an English service: the only time is under New Member & Visitor → Fellowship ("Saturday: 10:00 AM - 1:00 PM"), next to "All services at this location are offered in Chinese and English." Nothing tells a visitor what to expect (dress, length, children, parking). Smaller things:
- The only time on Home is "Sabbath starts in 1d 01:57:56". It counts down to Friday evening, not to the service.
- The beliefs page never says the Sabbath is Saturday.
- The Bible opens with Traditional Chinese under every English verse.
- Setup and Home never name the church.

## Findings, by severity
| # | Severity | Task | What happened | Why it matters to Sam | Screenshot | Suggested direction |
|---|---|---|---|---|---|---|
| 1 | **Major** | 2 | Home has no service-time line. New Member & Visitor has no "Service times" or "Plan a visit" tile. Locations & History gives the address and "Church services are conducted in both English and Mandarin Chinese.", but no time. The time is under New Member & Visitor → Fellowship, two screens down: "Sabbath Worship · Saturday: 10:00 AM - 1:00 PM • Join us for song service, Sabbath school, and our weekly main worship service." The same page says "All services at this location are offered in Chinese and English." The bulletin shows no times, and its roster lists "Translation". | The friend invited Sam to the "English service". Sam can't tell if there is a separate English service, when it starts, or which part of the three hours to come for. Sam found the time only by guessing that "Fellowship" might hold it, at tap 5, about 3.5 minutes after launch. Also seen by Mrs. Lin (her finding 1), from a member's side. | [07](images/07-visitor-page.jpg), [08](images/08-locations-history.jpg), [09](images/09-worship-locations.jpg), [11](images/11-service-time-under-fellowship.jpg) | Put service times, the language of each service (or that it is interpreted), the address and directions together, in one place a visitor sees first. |
| 2 | **Major** | 2 | Nothing in the app covers dress, service length, children, parking, or where to go on arrival. The only hints are scattered. The bulletin has "Kids Teacher" and "Youth Teacher" lines and "Thanksgiving Sabbath: fellowship lunch for everyone after the service". The 10:00 AM - 1:00 PM block hints at the length. | These are a first-time visitor's main questions. Sam would have to ask the friend or search the web, and may judge the church as not expecting visitors. | [07](images/07-visitor-page.jpg), [11](images/11-service-time-under-fellowship.jpg), [17](images/17-bulletin-open.jpg) | Add a short "What to expect" for visitors: dress, length, children's classes, parking or transit, lunch, and who greets newcomers. |
| 3 | Minor | 7 | The Bible opens bilingual in the English app. The chip reads "EN BSB + 繁 CUV", and a Traditional Chinese line sits under every English verse. To read English only, Sam taps the chip, turns off the "Dual-language reading" switch in "Reader languages", and closes the popup (3 taps). | Sam doesn't read Chinese, so half of every screen is unreadable and scrolling doubles. Sam may think the app is not meant for English readers. The chip shows only abbreviations. Also seen by Mrs. Lin (her finding 11), from the other side. | [22](images/22-bible-tab.jpg), [25](images/25-reader-languages-popup.jpg), [26](images/26-john-3-english-only.jpg) | Consider English-only as the default when the app is in English, or ask once. |
| 4 | Minor | 1, 2 | The only time on Home is "Sabbath starts in 1d 01:57:56 / New York, NY", with no explanation. Tapping it did nothing. It counts down to about 4:30 PM on Friday; the service is 10:00 AM on Saturday. | Sam doesn't know that the Sabbath starts at Friday sunset. Sam may read this as the time until the service and plan for Friday afternoon. | [05](images/05-home-first-view.jpg) | Add a short line ("Friday sunset to Saturday sunset"), or show the next service time beside it. |
| 5 | Minor | 3 | The Sabbath card says "The seventh-day Sabbath is a weekly gift from God, a time for rest, worship, and community." Nowhere on About Denomination does it say Saturday, or sunset to sunset. The page doesn't explain the name "Seventh-day Adventist" either. "The Second Coming of Christ" card is there but isn't linked to "Adventist". | These are the two words an outsider asks about first. Sam reads the page in about a minute and is still unsure the church meets on Saturday. | [13](images/13-about-denomination.jpg), [15](images/15-beliefs-sabbath-no-day.jpg) | Add one sentence for each: the Sabbath is Saturday (Friday sunset to Saturday sunset), and what the name means. |
| 6 | Minor | 1 | Setup and Home never name the church. Setup opens with "Welcome / Let's personalize your experience", and all five steps are display choices. Home shows "Today's Verse", the countdown and tiles. The name "New York Chinese Seventh-day Adventist Church" first appears two taps in, on Locations & History. | Sam is deciding whose app this is and judging the church by it. Inside the app, nothing says so until Sam goes looking. Sam may not expect two contrast questions before seeing anything about the church. Also seen by Mrs. Lin: the dark-mode question (her finding 5). | [01](images/01-first-screen.jpg), [05](images/05-home-first-view.jpg), [08](images/08-locations-history.jpg) | Name the church on the welcome screen or at the top of Home. |
| 7 | Minor | 9 | On You, "Help & Feedback: Ask for help or suggest a feature, by email" reads as help with the app. The church's own "Email Us" and "Call Us" buttons sit at the end of the Elmhurst part of Fellowship. "Email" and "Call" also appear on the pastor's card. There is no "Contact the church" line on Home or You. | Sam wants to ask the church a question, such as where to park. Sam may not look under Fellowship, or may send the question to app feedback. | [12](images/12-fellowship-email-call.jpg), [28](images/28-you-about-support.jpg) | Add a plainly named "Contact the church" entry with phone and email, on You or the visitor page. |
| 8 | Minor | 6 | Watch Livestream and Sermon Archive both leave the app straight for the YouTube app. Audio Archive opens open.spotify.com in the full Chrome browser. There, the first episode under "All Episodes" was "[Mandarin]" plus a Chinese title, dated Jan 13, 2025. Nothing in the app says which sermons are in English. | Sam wants to hear an English sermon before deciding. Sam can't tell where the English ones are, and may think the audio archive is no longer kept up. | [21](images/21-explore-tab.jpg) | Say on the tiles which sermons are in English. Check that the audio archive shows recent episodes first. |
| 9 | Minor | 3 | On About Denomination, at the default 125%, one tile label breaks mid-word: "Bible-Cente" / "red". The three tiles (Bible-Centered, Faith & Love, Community) look like buttons, but tapping "Faith & Love" did nothing. | The broken word looks unfinished, and the tap is a dead end. | [14](images/14-beliefs-bible-centered-break.jpg) | Let the label wrap at the hyphen or shrink. Make the tiles look like labels, or make them open something. |
| 10 | Minor | 2, 7, 10 | Floating title pills and chips cover headings. On Locations & History the "History" pill sits over the "Worship Locations" heading while Sam reads the addresses. In the Bible, the "EN BSB" chip hides most of the heading "Jesus and Nicodemus" ("Jesus and N…"). On Give, the "Tithe & Offering" pill covers "Online Portal". | Headings are cut off, and the pill names a section Sam isn't reading. Also seen by Mrs. Lin (her finding 13). | [09](images/09-worship-locations.jpg), [26](images/26-john-3-english-only.jpg) | As for her finding 13: keep pills off the first line, or have them show the current section. |
| 11 | Note | 5, 10 | The bulletin is all English, but it uses words a visitor may not know: "Q4", "Sabbath School", "Invocation", "Benediction", "Postlude", "Tithe & Offering", "Lesson 9: Testing the Prophets". It shows a "Queens / Brooklyn" switch and no times for its parts. The Home tile "This Week's Lesson" opens a page titled "Sabbath School" that mentions "quarterlies". | Sam understands most of it, but not what Sabbath School is, how it differs from the worship service, or when each starts. "Q4" was also seen by Mrs. Lin (her finding 8). | [17](images/17-bulletin-open.jpg) | Show start times on the section headings. Add a one-line explanation of Sabbath School. |
| 12 | Note | 5 | "Open hymn" under 348 opens the hymnal page with a card ("348. The Church Has One Foundation", "Chinese 505 · 413", "With singing", "Piano only", and an outside-link icon), not the hymn itself. Tapping the title opened hymnsforworship.org in a browser tab, with the English score. | Two taps. The outside-link icon warns Sam that it leaves the app, and the page was in English and readable. Also seen by Mrs. Lin (her finding 2). | none | As for her finding 2. |
| 13 | Note | 10 | "Tithe & Offering" is the third tile on Home's first screen. The Give page opens with Malachi 3:10: "Bring the full tithe into the storehouse… Test Me in this,". Then come Online Giving ("Payment details are entered on the external website, not in this app."), a Donor-Advised Fund section (an EIN, Fidelity Charitable, other sponsors) and In-Person Giving (cash, "Please write your name in English on the envelope."). Nothing on the page speaks to guests. | The tone is not pushy, and the note about payments is reassuring. But a "full tithe" verse at the top of a page Sam reaches from the first screen may read as an ask to someone who hasn't visited yet. | [05](images/05-home-first-view.jpg), [31](images/31-give-page.jpg) | Consider a line saying guests are welcome without giving, or a gentler opening for the page. |
| 14 | Note | 8 | No account, sign-in or app permission prompt appeared during the walk-through. The notification permission stayed not granted, and audio still played. The Privacy Policy opens in a browser tab at a github.io address: "The app does not require a user account for ordinary use. It does not include advertising, analytics, public user profiles, chat, or user-generated posting." Later sections are technical ("Final owners maintain weekly worship-program details in the Sabbath Sermon Data tab…"). Outside pages showed their own prompts: Google Maps asked for location, and adventist.org showed a cookie banner. | The first paragraph is exactly what Sam wants to read. The rest is written for church staff. Sam may not expect a github.io address rather than the church's site, and may not tell the outside prompts from the app's. | [28](images/28-you-about-support.jpg) | Consider a three-line plain summary at the top of the policy. |
| 15 | Note | 4 | Meet Our Team shows two cards with made-up names: "Senior Pastor" (with Email and Call buttons), and "Bible Worker · Elder at her home church". Both cards use the same church-building photo, with no portraits. | Sam can see who leads, but may not know what a "Bible Worker" or "Elder" is. The building photo may come from this made-up build. | [16](images/16-team-made-up-pastor.jpg) | Consider a few words on what each role does. |

## Task by task

### 1. First launch and setup: Done (5 taps, about 1 minute)
- Launched at 14:31:05. The first screen said "Welcome / Let's personalize your experience", with English already chosen. Each language card showed a tab-bar picture ([01](images/01-first-screen.jpg)). Sam tapped Next.
- Text size: 125% was already chosen, with John 3:16 as the sample. Next.
- Appearance: System was already chosen. Next. The light-mode contrast step had High contrast chosen. Next. Then the dark-mode contrast step. Get Started.
- Home appeared at 14:32:03, showing "Today's Verse", "Share Verse" / "Read Verse", the Sabbath countdown and tiles ([05](images/05-home-first-view.jpg)). Scrolling showed Watch Livestream, Weekly Bulletin, Tithe & Offering, Hymnal, This Week's Lesson and New Member & Visitor.
- It is clear this is a church app, with a Bible, bulletin and livestream, but not whose (finding 6). The countdown is the only time shown (finding 4). No permission prompt appeared.

### 2. Decide whether to go: Partly done (5 taps, about 6 scrolls, plus a trip to Google Maps)
- Home → New Member & Visitor ([07](images/07-visitor-page.jpg)). The tiles: About Denomination, Locations & History, Meet Our Team, Joining the Church, Fellowship, Holy Bible.
- Locations & History opened on the church name and History ([08](images/08-locations-history.jpg)). One scroll down, Worship Locations listed: Elmhurst Church, 76-06 41st Ave, Elmhurst, Queens, NY 11373, "conducted in both English and Mandarin Chinese"; Brooklyn Church (Bay Ridge), in Mandarin; and Flushing Fellowship (Mandarin). No times ([09](images/09-worship-locations.jpg)).
- Get Directions (Elmhurst) left the app for the Google Maps app (`VIEW https://www.google.com/...`). After Maps' own first-run screens, it showed the church's place page. Two Backs brought Sam to the same spot in the app.
- ‹ → Fellowship. Two scrolls down: "All services at this location are offered in Chinese and English." and "Sabbath Worship · Saturday: 10:00 AM - 1:00 PM" ([11](images/11-service-time-under-fellowship.jpg)). Further down: Weekday Mandarin Ministries (Zoom), Baptism Classes, and "Email Us" / "Call Us" ([12](images/12-fellowship-email-call.jpg)).
- Address: found. Time: found only by guessing "Fellowship". English service: unclear (finding 1). Dress, children, parking and length: not found (finding 2).

### 3. Beliefs, "Seventh-day Adventist" and "Sabbath": Done with trouble (2 taps, 4 scrolls, about 1.5 minutes)
- ‹ → About Denomination ([13](images/13-about-denomination.jpg)). It shows 2 Timothy 3:16–17, then "Seventh-day Adventists are a global Protestant Christian community that regards the Bible as the supreme authority…", with "Sola Scriptura (By Scripture Alone)" explained.
- The "Bible-Cente/red" tile breaks mid-word, and tapping "Faith & Love" did nothing ([14](images/14-beliefs-bible-centered-break.jpg), finding 9).
- Our Beliefs has one or two plain sentences for each of these cards, written for an outsider: Creation, The Nature of Humanity, The Great Controversy ("a universal conflict between good and evil…"), God the Son, Life, Death, and Resurrection of Christ, Experience of Salvation, Growing in Christ, The Sabbath, The Second Coming of Christ, and The New Earth. It never says which day the Sabbath is ([15](images/15-beliefs-sabbath-no-day.jpg), finding 5).
- "Read All 28 Beliefs" left the app for adventist.org in a browser tab with a cookie banner. Closed with X.

### 4. Who leads the church: Done (2 taps)
- ‹ → Meet Our Team ([16](images/16-team-made-up-pastor.jpg)). Two cards with made-up names: "Senior Pastor" (Email / Call) and "Bible Worker · Elder at her home church". Both show the church building, not a person (finding 15). No real names or faces.

### 5. This week's bulletin and one hymn: Done (2 taps to the bulletin, 2 more to the hymn score, about 6 scrolls)
- Home → Weekly Bulletin ([17](images/17-bulletin-open.jpg)). It shows This Week / Next Week, "November 28, 2026", "Q4", Queens / Brooklyn, and "Special Remark: Thanksgiving Sabbath: fellowship lunch for everyone after the service".
- Sabbath School lists "1. Praise to the Lord", "530. It Is Well With My Soul", "Lesson 9: Testing the Prophets", and Chinese, English, Youth and Kids teachers.
- The Worship Program lists Hymn of Praise "12. Joyful, Joyful, We Adore Thee", Psalms 46:1–3 ("Read now"), "684. Hear Our Prayer, O Lord", Tithe & Offering, Special Music, and the Sermon by a made-up name, titled "When the Waters Rise: Trusting God Through the Storms of Life". Then Hymn of Response "348. The Church Has One Foundation", Benediction and Postlude "690". Announcements: "Fellowship lunch after the service." The Service Roster lists Translation and Pianist.
- Everything is in English; there is no Chinese-only text. There are no times (findings 1, 11).
- Under 348, Open hymn opened the hymnal page ("ENGLISH / SDA Hymnal / 1985 Edition") with the hymn's card. Tapping the title opened hymnsforworship.org in a browser tab with the English score. X brought Sam back (finding 12).

### 6. Watch or listen: Done, but every option leaves the app (1 tap for the livestream; 2 taps each for the archives)
- Home → Watch Livestream went straight to the YouTube app (`VIEW https://www.youtube.com/...`). It needed two Backs to return.
- Explore ([21](images/21-explore-tab.jpg)) → Sermon Archive also went to the YouTube app.
- Explore → Audio Archive opened open.spotify.com in Chrome. The first episode listed was "[Mandarin]" with a Chinese title, dated Jan 13, 2025. One Back returned to the app (finding 8).

### 7. John 3 in English with audio: Done with trouble (5 taps and 3 scrolls to John 3; 1 tap to play; 3 more to remove the Chinese)
- The Bible tab opened Genesis 1 with Traditional Chinese under each English verse, and the chip "EN BSB + 繁 CUV" ([22](images/22-bible-tab.jpg)).
- Genesis ▾ → Sam flung the list, overshot to Revelation and scrolled back → John → 1 ▾ → Chapter 3. The book list has no search box.
- Play: English audio started at once ("John 3 · BSB (HelloAO), BSB • Souer", 0:09 / 4:32), and a blue bar followed the verses. Pause worked (playback state PAUSED).
- Chip → "Reader languages" ([25](images/25-reader-languages-popup.jpg)). The round arrow sits over "Show pinyin above Chinese" (also seen by Mrs. Lin, her finding 3; Sam didn't tap it). Sam turned off "Dual-language reading" and closed the popup. The text became English only, but the chip now covers the chapter heading ([26](images/26-john-3-english-only.jpg), findings 3, 10).
- English-only reading is not the default for an English user.

### 8. Trust: account, data, privacy, permissions: Done (2 taps)
- You lists Language, Text size ("Current: 125%"), Theme, Contrast and Offline Bible Audio. There is no account or sign-in anywhere.
- Scrolling down shows About & Support: Share the App, Help & Feedback, Privacy Policy, Legal Disclaimer, Open-Source Licenses, and "Version 1.9.0" ([28](images/28-you-about-support.jpg)). The Privacy Policy opened in a browser tab (finding 14).
- No permission prompt appeared from the app during the whole walk-through. The only prompts were Google Maps' own, after leaving the app.

### 9. Contact the church and share the app: Done (2 taps to share; contact found under Fellowship)
- Share the App opened a popup: "Show this code to a friend. Their phone's camera opens a page that sends them to their app store.", with a QR code, app.nyccsda.org/download and "Share Link" ([29](images/29-share-the-app.jpg)). Share Link opened the Android share sheet with "https://app.nyccsda.org/download".
- Help & Feedback opened a Gmail draft. It reads as help with the app (finding 7).
- Fellowship → "Email Us" opened a Gmail draft to the church. "Call Us" opened the phone dialer with the number filled in; no call was placed ([12](images/12-fellowship-email-call.jpg)).

### 10. Anything that would put a visitor off
- Chinese-only text in English mode: none on the app's own pages, apart from the Bible default (finding 3) and the language samples on the first screen.
- Insider words with no explanation: Sabbath (in the countdown), Sabbath School, quarterlies, Q4, Tithe, Bible Worker, Benediction, Postlude (findings 4, 11, 15). "Sola Scriptura" and "The Great Controversy" are explained.
- Dead ends: the decorative belief tiles (finding 9).
- Looks unfinished: the "Bible-Cente/red" break, and pills covering headings (findings 9, 10).
- Give: calm in tone, but it opens with a "full tithe" verse, from a tile on the first Home screen ([31](images/31-give-page.jpg), finding 13).
- No crashes or error screens.

## What worked well
- Setup with the defaults took about a minute. English came preselected, and the buttons are big and worded.
- No account, sign-in, ads or permission prompts. The privacy policy says so plainly in its first paragraph.
- The address and a "Get Directions" button opened Google Maps on the church.
- About Denomination explains each belief in one or two plain sentences, including "Sola Scriptura" and "The Great Controversy".
- The bulletin is fully in English in English mode, with English hymn titles and a friendly lunch note. "Open hymn" reaches an English score in 2 taps.
- English Bible audio started at once, followed the verses, and paused when asked.
- Share the App is clear: a QR code, the link, and the phone's share sheet.
- "Email Us" and "Call Us" hand off to email and the dialer without placing a call.
- The Library is in English and looks polished.
- The Give page says payment details are entered on the external website, not in the app.
- No crashes during the walk-through.

## Limits of this walk-through
- The date was a Thursday (Thanksgiving Day), not a Sabbath morning. The livestream was not live, and the bulletin showed the coming Sabbath.
- The bulletin and team data are made up. The team cards show the church building instead of portraits; the real build may differ. The "Thanksgiving Sabbath" remark is made-up data.
- YouTube stays on a loading skeleton on this emulator, so no sermon was watched. I couldn't check whether the past sermons are in English. The Spotify app is not installed, so Audio Archive opened in Chrome.
- First-run screens of Google Maps (sign-in, location), Chrome (notifications) and Gmail (welcome tour) come from the emulator being fresh, not from the app. Google Maps' own listing showed opening hours that differ from the app's; Maps itself is not judged here.
- Phone and app were in English, at the default 125%, with system font scale 1.0. The phone uses gesture navigation; system Back was used only to return from outside apps.
- Tap counts are the tester's. Which tile Sam would guess (such as Fellowship for times) is the tester's judgement.
- I had the emulator to myself for this run, with no interruptions.
- Not tested: the Brooklyn bulletin, Next Week, Bible search, the Hymnal tile from Home, Zoom, Give Online and the donor-advised fund links (no payment started), Offline Bible Audio, the "With singing" / "Piano only" hymn buttons, Legal Disclaimer, Theme and Contrast, and Share Verse.

## Proposed issues (not filed)
- Add a plainly named visitor entry with service times, which service is in English (or interpreted), the address and directions, and what to expect (dress, length, children, parking, lunch). Covers 1, 2. High.
- Explain "Sabbath" for outsiders, on the beliefs page and beside the Home countdown: which day it is (Friday sunset to Saturday sunset). Explain the name "Seventh-day Adventist". Covers 4, 5. Medium.
- Make English-only reading the Bible default when the app is in English, with bilingual as an option. Covers 3 (see Mrs. Lin's finding 11). Medium.
- Name the church on the welcome screen and Home, and add a "Contact the church" entry. Covers 6, 7. Medium.
- Say which sermons and audio are in English, and check that the audio archive shows recent episodes. Covers 8. Low.
- Visual polish: the "Bible-Cente/red" break, decorative tiles that look tappable, and pills and chips covering headings. Covers 9, 10 (see Mrs. Lin's finding 13). Low.
- Visitor-friendly wording: bulletin terms and times, "Sabbath School" and "quarterlies", "Q4", the Give page opening, team roles, and a short privacy-policy summary. Covers 11, 13, 14, 15. Low.
