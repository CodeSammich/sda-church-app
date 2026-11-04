# UI/UX Design: The Four-Tab App Structure

This is a shared Expo/React Native app with native iOS and Android builds plus a web/PWA
testing preview. Core components must work across all three targets; platform-specific
behavior should be explicit rather than assuming the browser is the primary runtime.

## Design Language: Warm Sanctuary & Uplifting Simplicity

To uphold **Tenet 5 (Simplicity)** and **Tenet 7 (Focused)**, the application uses a warm,
low-glare foundation with a restrained ocean-blue interaction accent. Muted category
colors help users distinguish Home and Explore cards without overwhelming the content.

When implementing this color scheme, it is important to map back to a variable-lookup with
`customLightTheme` or `customDarkTheme` in `constants/Themes.ts` instead of hard-coding
hex-values to ensure consistency and maintainability. If any hex values in this spec does
not exist in that custom theme file, it must be populated.

There are a few system-defaults that manage how OS-level UI is colored, notably with
hardcoded hex colors in `app.json` and `manifest.json` that manage the edge of the
screen's top and bottom bar colors. Please ensure these colors match the view color
(usually background) of the app.

### Primary Color Accent

Deep Ocean Blue `#0369A1` is the light-mode interaction color. Dark mode uses a restrained
gold `#D2B258` over a near-black canvas, giving controls and reader annotations a premium,
evening-oriented identity while warm-white remains reserved for long-form reading text.
This direction adapts the black-and-gold principle from Coca-Cola Zero Sugar Zero Caffeine's
[premium evening redesign](https://www.cocacolaep.com/news-and-stories/zeroing-in-on-the-relaunch-of-coca-cola-zero-sugar-zero-caffeine/),
without reproducing Coca-Cola trademarks or product graphics.

<!-- prettier-ignore -->
| Element | Light Mode Hex | Dark Mode Hex | Rationale |
| :---| :---| :---| :---|
| **Primary Interaction Color Accent** | #0369A1 | #D2B258 | **Luminance over Hue.** Light mode uses a deep accessible ocean blue; dark mode uses the sampled main gold for premium, low-glare focus. |
| **Tertiary Decorative / Narrative Icons** | #0369A1 | #D2B258 | **Unified Metallic Identity.** Reader annotations and functional icons share the main gold. |

Dark mode uses a tonal range sampled from Coca-Cola's official product render instead of
pretending metallic ink can be represented by one flat digital color. Opaque icons use the
main or muted tone; prominent affordances may use the full gradient. Home and New Member /
Visitor category cards remain an intentional exception: their established chromatic
backgrounds and icons provide destination wayfinding and must not be flattened into gold.

| Metallic role | Hex |
| :--- | :--- |
| Shadow | `#74612F` |
| Muted | `#947D3F` |
| Midtone | `#B89C4D` |
| Main | `#D2B258` |
| Highlight | `#EBCD78` |

### Core Surface Palette

These colors provide Material Design 3 elevation and boundary logic. Light mode uses a
warm canvas and warm surfaces; dark mode uses a restrained charcoal hierarchy. The theme
tokens below are the source of truth for application components.

The system is built on the philosophy of **Perceptual Balance** (see
[APCA Contrast Standards](https://www.accessibilitychecker.org/blog/apca-advanced-perceptual-contrast-algorithm/))
and a **Hierarchy of Light** (see
[Material Design Elevation](https://m3.material.io/styles/elevation/overview)). In this
model, we move away from simple mathematical inversion. Instead, depth is communicated
through relative lightness: surfaces "closer" to the user are always brighter than the
background beneath them, mimicking physical objects in a 3D space. We reserve extreme
contrast (#FFFFFF and #0F0F0F) exclusively for **Active Focus** states (like bottom bar
icons and primary buttons) to create a "spotlight" effect that guides the user’s eye
without the need for loud brand colors.

The palette transitions to dark mode with off-white text and softened icons, keeping the
interface consistent and spiritually focused while minimizing retinal distractions.

<!-- prettier-ignore -->
| Element | Light Mode Hex | Dark Mode Hex | Rationale |
| :---| :---| :---| :---|
| **Background**    | #F2E6DF  | #080808 | **The Canvas.** A warm low-glare light canvas and render-matched near-black evening canvas. |
| **Surface (Cards/Containers)**  | #FAF4EF  | #14130F | **The Object.** Warm cards lift clearly from their respective canvases. |
| **Surface Variant**    | #F1F3F4  | #211F18 | **Secondary UI.** Search bars, unselected controls, and subtle grouped UI. |
| **On Surface**   | #1A1A1A  | #F3EDE1 | **The Ink.** Warm-white dark-mode text mitigates **Irradiation Illusion** ([NIH/PMC3939872](https://pmc.ncbi.nlm.nih.gov/articles/PMC3939872/)) and stays visually dominant over gold annotations. |
| **On Surface Variant**   | #606060  | #BDB5A2 | **Muted Intent.** Warm neutral content recedes without becoming illegible. |
| **Text/Icon on Primary**  | #FFFFFF  | #181202 | **The Stencil.** High-contrast content shown inside primary controls. |
| **Selection Container**  | #E3F2FD  | #302714 | **The State.** A quiet gold-brown selected state avoids large luminous blocks. |
| **Boundary (Outline)**   | #CAC4D0  | #947D3F | **The Frame.** A visible muted-gold boundary for controls and focus regions. |
| **Boundary (Subtle)**   | #E0E0E0  | #3B3423 | **The Divider.** Used for subtle organization within grouped cards. |
| **Functional Icons (e.g. Bottom Bar)** | #1A1A1A  | #D2B258 | **Active Focus.** Main gold identifies selected and actionable elements; inactive navigation uses `#947D3F`. |

### Grid Menu Card Tokens

Grid menu cards use category-specific backgrounds and icons from `cardBgColors` and
`iconColors`. Their shared chrome must use `colors.gridMenuCard` rather than literals in
the component.

<!-- prettier-ignore -->
| Token | Light Mode | Dark Mode | Purpose |
| :---| :---| :---| :---|
| **Card Border** | #E0E0E0 | #3B3423 | Subtle boundary around each category card. |
| **Decorative Icon** | rgba(40, 40, 40, 0.18) | #D2B258 | Gold illustration on the near-black card surface. |
| **Arrow Background** | #FFFFFF | Metallic gradient | Glossy circular navigation affordance using the five-tone gold range. |
| **Arrow Border** | #374151 | #EBCD78 | Highlight boundary around the metallic affordance. |
| **Arrow Foreground** | #374151 | #181202 | Dark icon over the metallic fill. |

### External Service Links

Links to YouTube, Spotify, Zoom, and other external services use the provider's
unmodified official logo assets where the provider's current guidelines permit that
linking or attribution use. The assets are rendered as untinted, contain-fit images
inside the existing controls; service names remain plain descriptive text. Provider
logos are not used in the app icon or as the app's own branding. If a future release
adds a provider logo or embedded content, record the applicable permission and
brand-guideline review before adding it.

Websites open in the in-app browser, which slides up over the app and closes back to
it: Safari View Controller on iOS, a Custom Tab on Android, and a new tab on the web.
Links that belong to another app open that app instead: phone numbers, email addresses,
YouTube, Spotify, Zoom, Google Maps, and the App Store and Google Play. A phone without
that app opens them in its own browser. Every link goes through `openURL` (websites) or
`openInItsApp` (other apps) in `constants/ExternalLinks.ts`; `test/link-opening.test.ts`
checks where each one opens, and that no screen opens a link itself.

Large files, such as lesson PDFs of more than a few megabytes, don't open straight in
the in-app browser. There, a phone can show a blank page until the whole file has arrived,
which can take a minute on a slow connection. On iOS and Android, the app downloads
them itself instead:

- a popup appears as soon as the person taps, and shows the download's progress
  ("Downloading · 5.1 of 14.2 MB"), with an X that stops it;
- the file is kept in the cache directory while it's current, so it opens at once the
  next time, even offline. Nothing downloads without a tap, so people who don't use
  a feature never download its files;
- it opens in the phone's own viewer, through `expo-file-system`'s `File.preview()`:
  Quick Look on iPhone, and the app that opens PDFs on Android. That opens the
  downloaded copy, not a link, so it's outside `constants/ExternalLinks.ts`.

If the phone has no viewer, or the download fails, the file's address opens in the
in-app browser as before; if it fails because the phone is offline, the popup says
there's no connection instead. The web keeps opening files in a new tab. Anything new that
opens a big file should work the same way. The children's Sabbath School lessons came
first ([#529](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/529));
see [Opening a lesson on a phone](feature_designs/sabbath_school_lessons.md#opening-a-lesson-on-a-phone).
The download itself and what its progress says are shared: `services/FileDownloads.ts`
and `constants/DownloadCopy.ts`. Use them, rather than copy the lessons' code. Bible audio
shares the progress text; on a phone, its download is the phone's own
(`modules/bible-audio-downloads`, #611), so it goes on while the phone is locked.

Bible audio downloaded to listen offline
([#556](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/556))
is the second use, for later rather than to open now. It's downloaded and deleted on one
page, **Offline Bible Audio** in the You tab, which **Listen offline** in the Bible's audio
settings opens. The page is a tree of the whole Bible, its Testaments, their sections,
closed until tapped, and their books, for one narrator; opened from the Bible, it shows
the book being read. Each row says what it holds: its size, how far along its download
is, part of it, or all of it. Narrators are named language first, as "English – Souer
(BSB)" or "Mandarin (Chinese Union Version)", and listed in one order, as the translation
picker lists their translations (`constants/BibleAudioNarrators.ts`); the Bible's audio
settings name the English ones the same way. A row's download
progress shows at once, with an X that stops it. It goes on when the page closes, and
with the phone locked or the app in the background, since the whole Bible takes a while:
the phone itself downloads it (#611), on Wi-Fi only unless the member chose mobile data.
Meanwhile a notification can show it, with Stop, as **Notifications** below says: the
app's own on Android 14 and later, and the system's download notification on Android 13
and lower; on the iPhone, a word when it's done. Deleting goes by the same rows, after the app's popup
asks, naming what it deletes and its size. It stays in the documents directory until the
member deletes it, rather than in the cache, and the size of each choice shows before it
starts. Over mobile data,
the app's popup asks first: Use mobile data, Wait for Wi-Fi, or Cancel; and a download
over 1 GB, such as the English Bible, asks first even on Wi-Fi. See
[Bible audio downloaded to listen offline](feature_designs/on_device_storage.md#bible-audio-downloaded-to-listen-offline).

When streamed Bible audio keeps stopping to load
([#595](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/595)),
the audio settings button at the left of the audio bar points the listener to Listen
offline:
- **When:** after 3 stalls in one listening session, or one longer than 5 seconds. The
  usual loading at a chapter's start, or after a skip or a drag, doesn't count toward the 3.
- **How:** the button's border pulses three times in the theme's main color, then a dot,
  like the sleep timer's, stays until the popup opens. With Reduce Motion (iOS) or Remove
  animations (Android) on, only the dot shows. A pulse due while the screen is off waits
  until the app is back.
- **In the popup:** it scrolls to Listen offline, which says "Playback often stops to
  load. Download to listen without waiting." above the row that opens Offline Bible
  Audio. Screen readers hear the same line as the button's hint, not as an announcement.
- **Not nagging:** at most once each time the app starts, never again once Bible audio has
  been on the phone, and not for 7 days after the listener closes the popup without
  downloading.

`services/BibleAudioDownloadTip.ts` decides when.

### Key Principles & Exceptions:

1.  **Brand Neutrality:** External service destinations use official provider assets
    only for truthful identification of the linked destination. Their placement must
    not suggest sponsorship, endorsement, or co-branding by the service provider.
2.  **Visual Hierarchy (The 90/10 Rule):** Most of the interface uses warm neutrals or
    charcoal surfaces. Restrained category colors and the primary accent identify actions
    and destinations without competing with content.
3.  **Iconography:** Icons across all pillars utilize consistent stroke weights and
    monochrome styling. This provides a "premium" feel and ensures accessibility across
    both light and dark modes.

#### Elevation & Modern

To maintain a modern, native feel and satisfy **Tenet 5 (Simplicity)**, the app focuses on
simple, blended colors.

- **Edge-to-Edge Immersive UI:** The app must blend seamlessly into the device's physical
  boundaries, extending the UI to the very edge of the screen at both the top (status bar)
  and bottom (home indicator/navigation bar).
  - **Immersive Canvas:** Eliminate "letterboxing" or hard-coded safe area gutters. The
    background content or navigation bars should bleed into the system safe areas (using
    `viewport-fit=cover` for the web/PWA preview).
  - **Hardware-Software Synergy:** Like the YouTube app, this design choice removes the
    visual separation between the app and the device hardware, reinforcing the "Digital
    Sanctuary" metaphor by making the interface feel like an integrated environment rather
    than a window inside a frame.
- **Header Opacity:** The top header is completely opaque (using the base background
  color) to provide a solid anchor for the "Digital Sanctuary."
- **Absolute Positioning & Offset:** Global navigation elements are positioned absolute.
  To prevent initial overlap, screens must apply a `paddingTop` equal to the total header
  height from `useGlobalHeaderHeight()`: the status bar plus 64px at 100% text size.
  The header grows with the app's text size and with the phone's text size up to 1.35×
  (`hooks/useGlobalHeaderHeight.ts`).
- **Boundary Definition:** A restrained 0.5px top boundary using the theme's subtle
  outline token is permitted for the bottom tab navigation bar and persistent audio
  controls. Do not add shadows, strong dividers, or decorative glass effects.
- **Popups:** Every popup is the app's own, never the system's alert (`Alert.alert`),
  which on Android looks unlike the rest of the app. A popup is centred, with the shared
  corners and canvas (`getPopupSurfaceStyle`), and at most 65% of the screen tall at any
  text size, scrolling beyond that. One that only says something has an X in its title row
  and no Close button. One that asks a question has its answers as buttons, stacked so
  large text fits, the main one first and Cancel last, and no X; a tap outside it answers
  Cancel. Code shows a notice or question with `showAppAlert`
  (`components/AppAlert.tsx`), and `test/app-alert.test.ts` fails on a system alert.
- **Notifications:** The app's notifications are few, quiet, and only ones the member asked
  for (Tenet 7). Today there's one kind: a Bible audio download the member started (#610).
  - **What they say, by phone.** None is needed for a download to go on in the
    background; they only show it.
    - **Android 14 and later:** while chapters download, the download's
      progress ("Mandarin (Chinese Union Version): 312 of 1,189 chapters"), with Stop; then
      "Downloaded", or that it waits for Wi-Fi or a connection. Android requires a
      notification while the app's own download job runs, so with the member's notifications
      off it's the quiet kind: minimized, with no status bar icon, and gone when the job ends.
      Without the permission, Android shows the job only in its Task Manager.
    - **iPhone:** a word when a download finishes, or couldn't, while the app is out of
      sight. iOS shows no progress for a background download.
    - **Android 13 and lower:** nothing of the app's. The system's own download notification
      shows the chapters, as Android requires for them to download while the phone is locked.
  - **Asked at need, never at launch.** The first time a download of a section of several
    books or more starts, the app's own popup asks first, since the phone's question can't
    say why: what the notifications are for, that the download keeps going either way, and
    that the page's switch turns them on or off. Only **Allow** brings the phone's question.
    After **Not now**, the app asks once more at most, at the next Testament or whole Bible,
    and then never. Turning the switch on asks the phone at once, or opens the app's settings
    where the phone won't ask again.
  - **One switch:** **Download notifications**, on Offline Bible Audio, below the narrator,
    with the downloads it's about: a row with just its name and its switch. It shows on only when the member wants them and the phone
    allows them.
  - **Never:** badges, reminders to come back, sounds, marketing, or anything sent from a
    server. They're made on the phone, so nothing about them leaves it, and Data safety and
    App Privacy don't change.
  - **Why the permission isn't dropped after each download:** iOS can't take back leave once
    given, and on Android asking at every download would nag, and Android stops showing its
    question after two refusals. So the app limits what it does instead:
    `test/notification-guard.test.ts` fails if anything but `modules/bible-audio-downloads`
    posts a notification.
  - **Anything new,** such as announcements (#562) or event reminders (#49), needs its own
    decision, and an update to this policy, first.
- **Future-Proofing:** It shifts your design from "Standard App" to a custom "Digital
  Sanctuary."

#### Opening the app

The phone's own launch screen is plain brand blue (`#00405C`, from `expo-splash-screen` in
`app.json`). The app's first screen takes over in the same blue, and the church symbol is
drawn as if with a pen, from the bottom up, at half the screen's width, in under a
second (`components/LaunchSplash.tsx`, `components/LaunchDrawing.ts`, #538). It runs on
the UI thread with Reanimated and `react-native-svg` while the app loads underneath, and
the blue fades once both are done. A tap skips the drawing. It plays only when the app
starts, not when it comes back from the background. With Reduce Motion (iOS) or Remove
animations (Android) on, the finished symbol shows still. The key-screen builds and the
web skip it.

The drawing can only start once the app's code has loaded, and by then the app is
nearly ready, so most of the drawing's length is added to the time the app takes to
open. On November 1, 2026, the church chose to keep the drawing but keep it short.
Keep it under a second if you change it. The brand rules it follows are in
[LEGAL_BRANDING.md](LEGAL_BRANDING.md#the-launch-animation).

#### Wide screens: iPad, tablets, and foldables

The app is one layout that follows the window's width, not a separate tablet design
(#324). Older members read on iPads for the bigger text and screen, so a wide screen
shows the phone's pages larger and roomier, not more on each page:

- **Text starts at 150% on a tablet**, not a phone's 125% (`getDefaultTextScale` in
  `constants/AppPreferences.ts`). A tablet is held farther away, so at 125% its pages
  read small, and Text size's Reset returns to 150% there. A device counts as a tablet
  when its screen's shorter side is at least 600 points, Android's own line, which every
  iPad passes and no phone does; the web stays at 125%, since its wide windows are mostly
  computers. First-launch setup saves the size, so a foldable keeps the size it was set
  up with.
- **A centered content column.** A page's content grows to at most 720 points wide at
  the default 125% text (`CONTENT_MAX_WIDTH` in `constants/Layout.ts`) and stays
  centered, so lines of Bible text stay a comfortable length and a page's cards and
  buttons stay near each other. Larger text widens it in proportion, 864 points at a
  tablet's 150% and 1152 at 200%, so a line holds about as many words: members who chose an iPad for
  bigger text get the screen's width, not a narrow column of short lines. The size it
  follows is the app's text size times the device's (`useContentColumnScale`), since
  members enlarge text in either place. Phones are narrower than the column, so their
  layout never changes. Put a new page's content in the column with
  `contentColumnStyle(columnScale)`, and size anything that depends on the width from
  `getContentWidth(width, columnScale)`, not the window's width. On a tablet the Bible's
  text also gets 24-point margins, since a phone's 4 points would leave it against the
  screen's edge once the column fills the screen.
- **Full-width edges.** Banner images, the header, and the Bible's dock background still
  span the screen, so the app reaches the edges as it does on a phone (see Edge-to-Edge
  above). Their text and buttons line up with the column (`contentColumnWithin`). Rows
  that scroll sideways, such as the library's shelves, span the screen too, starting in
  line with the column.
- **The tab bar on a tablet** (a window at least 600 points wide, #589) is a rounded
  capsule centered above the bottom edge, at most 520 points wide, in the app's warm card
  colour with a lighter pill behind the selected tab, and slightly larger icons and labels
  (`components/TabletTabBar.tsx`). A phone's full-width bar stretched across an iPad looked
  like a phone app blown up. It's the same on iPad and Android, and its labels follow the
  app's text size as on a phone. Phones, and a narrow window beside another app, keep the
  full-width bar (its buttons within the column, `getContentSideInset`). The system's own
  iPad tab bar would sit at the top, over the header, so the app draws its own.
- **A third column of book covers** in a library shelf's grid once the column is 600
  points wide (`getLibraryGridColumns`), so covers stay a sensible size. Other grids,
  such as Home's cards, keep two columns, which the column keeps a phone-like shape.
- **Popups at most 560 points wide** (`POPUP_MAX_WIDTH` in `styles/PopupStyles.ts`),
  centered as on a phone (`usePopupWidthStyle`, or `getPopupWidthStyle` for a popup with
  side margins). Give a popup that number, never a percentage width with a `maxWidth`:
  on iOS, Paper splits the two between its views, and an iPad popup filled 90% of the
  screen with its content in part of it.
- **Tab labels under their icons**, as on a phone. React Navigation's default puts each
  label beside its icon on a wide screen, far from it on a tablet.
- **Every way up on a large screen, portrait on phones.** The iPad turns to any
  orientation and can share the screen with another app or be resized, as iPadOS 26
  expects of every iPad app (Apple's
  [TN3192](https://developer.apple.com/documentation/technotes/tn3192-migrating-your-app-from-the-deprecated-uirequiresfullscreen-key)).
  Android tablets and unfolded foldables turn freely (#426). Phones stay in portrait on
  both platforms. In a narrow window beside another app, the layout is a phone's.

The release PR's screenshot run takes the iPad's pages in both orientations
([iPad key screens](operations/native-builds.md#ipad-key-screens)).

## Navigation Layout

### 1. Home (The "Pulse")

**Purpose:** Immediate relevance: today's verse, the Sabbath countdown, and the church's
main destinations for the week.

**UI:** A scrolling dashboard (`app/(tabs)/index.tsx`): the **Today's Verse** hero with
**Read Verse** and **Share Verse**, a Sabbath countdown card for New York, NY, and a grid
of cards for **Watch Livestream**, **Weekly Bulletin**, **Tithe & Offering**, **Hymnal**,
**This Week's Lesson** (Sabbath School lessons for adults and children), and **New Member
& Visitor**. Giving, the hymnals, and the staff list (**Meet Our Team**, under New Member &
Visitor) live here.

**Android home screen widget (#235):** **Today's Verse** can also sit on an Android
phone's home screen, laid out like YouVersion's Verse of the Day widget: the heading, the
reference, a light/dark button and a share button, and the verse with its number in the
phone's serif font, in the app's language. It leaves out the translation's name, which
YouVersion shows at the bottom, so the verse has the rest of the widget; the shared text
still names it. A verse longer than the widget's size stops at the end of the last whole
line that fits, as YouVersion's does. The colors are the app's: the primary blue on the
warm canvas, or gold on near-black, following the phone's light or dark mode. Android 12 and later switch it with the phone;
older versions at its next hourly redraw. A member whose phone is dark but whose wallpaper
is light, or the reverse, can tap the light/dark button. Each tap flips the widget's
colors. When the new look matches the phone's mode, the widget goes back to following the
phone. Each widget keeps its own choice. Tapping it opens the verse in the Bible reader,
as **Read Verse** does, and the share button shares it as **Share Verse** does. Once a
day, when Home loads the verse, it hands the widget the next week's verses, and the widget
shows the day's, so the verse changes within an hour of 6 AM without the app being opened.
After a week without the app, it keeps the last verse. iPhones don't have the widget. The
code is in `features/verse-of-the-day/`, `services/VerseOfTheDayWidgetData.ts`,
`modules/verse-widget/`, and `plugins/withAndroidVerseWidget.js`.

**Hymnal** opens the hymnal page (`features/hymnal/HymnalScreen.tsx`). A carousel of the
six hymnals, in the style of the Library's featured books, puts the app language's hymnals
first; swiping to one, tapping its dot, or tapping the little arrows on the banner's sides
(#447) shows its search and hymns below, in one list. Each hymnal keeps its own search. A
search also looks through the other five hymnals: their matches follow under
**In other hymnals**, grouped under each hymnal's name, the hymnal a cross-reference
table pairs with this one first (1985 ↔ 505). Each group is in
number order and shows its first 10 matches, with **Show all** for the rest. A number
leads each group with its hymn of that number, so "hymn 100" shows 1985's and 505's 100
with their titles, whichever hymnal is showing. Tapping a result shows that hymn in its hymnal. The page says nothing
matches only when no hymnal has a match. A hymn with a number in another hymnal shows it as a
chip, such as "Chinese 505 · 16" on a 1985 hymn or "English · 82" on a 505 hymn; tapping it
shows the hymn there. The chips
come from the cross-reference tables (see [Hymnal
integration](feature_designs/hymnal_integration_design.md#54-cross-references-between-hymnals)).
An English hymn's scripture reference is a chip there too, and opens the passage in the
Bible. A 505 hymn shows its 1985 equivalent's, in the app's language (詩篇 103:2-5), and
opens it in the Chinese Bible. Below each hymn, **With singing** opens its recording on YouTube or a search for it.
Most English and 505 hymns also have **Piano only**: the hymn's piano accompaniment, for a
church without a pianist.
Each hymnal's older route, such as `/home/english-hymnal?hymnNum=12` from a bulletin hymn,
opens the same page with that hymnal picked and just that hymn showing, marked, above
**Show all hymns**. The old English–Chinese hymn lookup's route opens the hymnal page.

**Tithe & Offering** (`app/(tabs)/home/give.tsx`) describes the ways to give, and its
buttons open giving sites in the in-app browser; the app takes no payment. **Give
Online** opens the church's AdventistGiving page. The **Donor-Advised Fund** card's
**Fidelity Charitable** button, for the sponsor the church prefers, opens Fidelity
Charitable's own grant link: its sign-in, then a grant with the church already chosen
by its EIN. The church needs no account or sign-up for it. **Other Sponsors** opens a
popup listing the other sponsors the card names, each opening its home page, as they
have no such link, with the church's legal name and EIN (#646). The card and the popup
name DAFgiving360 with its old name, Schwab Charitable. The sponsors are one list,
`DAF_SPONSORS` in `constants/ExternalLinks.ts`.

**Tenet Alignment:**

- **Tenet 5 (Simplicity):** A widget-based dashboard provides a "glanceable" interface
  where the most important information is surfaced immediately without digging through
  menus.
- **Tenet 7 (Focused):** The dashboard keeps to the church's worship life: the
  bulletin, the verse of the day, and links to lessons, hymns, and giving. **Watch
  Livestream** opens the church's YouTube streams page outside the app; there is no
  embedded player.

### 2. Bible (The Reader)

**Purpose:** Focused Scripture reading, saved verses, translation selection, and on-demand
Bible audio.

**UI:** Immersive reader with whole-Bible search and persistent audio controls. The
search box looks through every verse of the translations on screen, offline on a phone, and lists the
open chapter's matches first, then the whole Bible's by book with a count for each. A
reference typed in a short form, such as "Jn 3:16", "Sal 23", or 約3：16, is offered first,
to jump to (`hooks/useBibleSearch.ts`, `services/BibleSearch.ts`). The results are a
page of their own under the search box, over the chapter, the audio controls, and the
tab bar. They stay up with the keyboard put away. The keyboard's Search key opens a
reference, but for words it only puts the keyboard away, since the first match is only
a guess. The X closes them, and so does Android's Back, whose first press puts the
keyboard away if it's up.
While a chapter's audio plays, or is paused partway, a thin bar in the primary color
(blue in light mode, gold in dark) beside a verse's number marks the verse being read,
for each narrator with verse times (`services/BibleAudioTimings.ts`, #561). The reader
keeps that verse in the middle of the screen, scrolling as the narrator reaches each
verse. That scrolling leaves the tab bar and audio controls where they are, so they don't
move under a finger reaching for them. Scrolling by hand pauses following; five seconds after the last touch while the audio
plays, or when play is pressed, it scrolls back. Saved and selected verses keep their colors.
Tapping a verse opens its details, with **Save**, **Share**, and, when a hymn's verse
includes it, **Hymn** (or **Hymns**, which lists each with its verse and hymnal, such as
"Psalm 23 · English"): the English hymns and the same hymns in the 505, with the 505 first
for CUV and CUVS and the English hymnal first otherwise. It opens the hymn on
the hymnal page, whose way back returns to the verse (`features/hymnal/HymnScripture.ts`).

**Tenet Alignment:**

- **Tenet 3 (Sanctuary):** Reading and saved-verse history remain local to the device.
- **Tenet 6 (Devotional):** Text, audio, and translation controls share one focused reader.

### 3. Explore (The "Spiritual" Library)

**Purpose:** Deep personal growth through books, recorded sermons, and classes.

**UI:** A short list of cards (`app/(tabs)/explore/index.tsx`): **Library** (精選書庫, a
hand-picked library, in Chinese), **Sermon Archive** (YouTube), **Audio Archive** (Spotify),
**In-depth Bible Study** (深入研經) in Chinese only, and **Zoom Class**. In-depth Bible
Study opens the Chinese Union Mission's SDA Bible app, with Chinese commentary and over
1,000 books: its App Store page on iPhone and iPad, its online reader on Android and the
web (#554). It has a plain book icon, not the app's logo. The Library is the
bookshelf-style part: a carousel of featured books, turned by swiping, a dot, or the
little arrows on the banner's sides, then shelves that are each a row of covers, with a search
across all books (see [Christian Library](feature_designs/christian_library.md)). Hymnals
are on Home, not here.

**Tenet Alignment:**

- **Tenet 5 (Simplicity):** Immersive, text-heavy UI ensures that the content—not the
  chrome—is the focus for all age groups.
- **Tenet 6 (Devotional):** Reader-focused resources lower the friction for worship and
  daily devotion.

### 4. You (The Personal History "Utility" Drawer)

**Purpose:** Preferences and information about the app.

**UI:** A list of cards (`app/(tabs)/you/index.tsx`) in two groups. **Settings** has
**Language**, **Text size**, **Theme** (System, Sunrise/Sunset, Light, or Dark), and,
on a phone, **Offline Bible Audio**, where Bible audio is downloaded to listen offline,
and deleted, by book, section, Testament, or the whole Bible (#556).
**About & Support** starts with **Share the App** (#555): a popup with a QR code a
friend can scan with their phone's camera to reach the download page
(`https://app.nyccsda.org/download`, which sends them to their app store), the address,
and **Share Link** for the device's share sheet. The code sits on white, so it scans in
the dark theme too. Next is **Help & Feedback**, which opens a draft email to
`technology@nyccsda.org` in the device's email app, for help or a feature request
(#541). Its subject is always English, `[NYCCSDA App] Help or feature request`, with
the same prefix as the Bible translation request's, so the emails are easy to filter.
The body asks, in the reader's language and more simply than the issue templates,
whether it's a problem or an idea, what happened or what they'd like, and what they
were doing just before, and ends with the app version and system (the iOS version,
Android's API level, or "web app"). Then come the **Privacy Policy**, **Legal Disclaimer**, and
**Open-Source Licenses** (all English only), followed by the app version. **Privacy
Policy** and **Legal Disclaimer** open the website's copies in the in-app browser; the
app keeps no copy of its own (#403, #412). **Open-Source Licenses** is an app screen,
because those notices must ship with the app. On web, tapping the version checks for an update.
There is no giving, history, or staff contact here: **Tithe & Offering** and **Meet Our
Team** are on Home, and the app has no history feature.

**Tenet Alignment:**

- **Tenet 2 (Liability-Free):** Puts the privacy policy and legal terms in one place.
- **Tenet 5 (Simplicity):** Preferences are saved on the device, with no account or
  sign-in, so the app is personalized without collecting Personally Identifiable
  Information (PII).
