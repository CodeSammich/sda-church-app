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
- **Future-Proofing:** It shifts your design from "Standard App" to a custom "Digital
  Sanctuary."

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

**UI:** Immersive reader with chapter-local search and persistent audio controls.
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

**UI:** A short list of cards (`app/(tabs)/explore/index.tsx`): **Library**, **Sermon
Archive** (YouTube), **Audio Archive** (Spotify), and **Zoom Class**. The Library is the
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
**Language**, **Text size**, and **Theme** (System, Sunrise/Sunset, Light, or Dark).
**About & Support** has the **Privacy Policy** and **Legal Disclaimer** (both English
only), followed by the app version. **Privacy Policy** opens the website's copy in the
in-app browser; the app keeps no copy of its own (#403). On web, tapping the version checks for an update.
There is no giving, history, or staff contact here: **Tithe & Offering** and **Meet Our
Team** are on Home, and the app has no history feature.

**Tenet Alignment:**

- **Tenet 2 (Liability-Free):** Puts the privacy policy and legal terms in one place.
- **Tenet 5 (Simplicity):** Preferences are saved on the device, with no account or
  sign-in, so the app is personalized without collecting Personally Identifiable
  Information (PII).
