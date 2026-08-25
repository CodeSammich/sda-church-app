# UI/UX Design: The Four-Tab App Structure

This is a Progressive Web App (PWA) and not a native iOS or Android binary. Therefore,
please be careful with the UI libraries you use.

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
main or muted tone; prominent affordances may use the full gradient.

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

### Special External Brand Colors

These brand colors are used for third-party recognition in Light Mode and follow the
"YouTube Treatment" (monochrome) in Dark Mode.

| Element           | Light Mode Hex | Dark Mode Hex | Rationale                                                   |
| :---------------- | :------------- | :------------ | :---------------------------------------------------------- |
| **YouTube Brand** | #FF0000        | #D2B258       | Official red in light; shared monochrome gold in dark.      |
| **Spotify Brand** | #1DB954        | #D2B258       | Official green in light; shared monochrome gold in dark.    |
| **Zoom Brand**    | #0B5CFF        | #D2B258       | Official blue in light; shared monochrome gold in dark.     |

### Key Principles & Exceptions:

1.  **Brand Neutrality:** Following YouTube's "Neutral Treatment" guidelines, third-party
    logos are generally rendered in monochrome variants. By standardizing external logos,
    we visually reinforce that the user remains within their "Digital Home," even when
    accessing external media.
    - **Exception:** YouTube and Spotify icons utilize their respective brand colors to
      aid immediate recognition and content surfacing, as mentioned below.
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
    `viewport-fit=cover` for PWA).
  - **Hardware-Software Synergy:** Like the YouTube app, this design choice removes the
    visual separation between the app and the device hardware, reinforcing the "Digital
    Sanctuary" metaphor by making the interface feel like an integrated environment rather
    than a window inside a frame.
- **Header Opacity:** The top header is completely opaque (using the base background
  color) to provide a solid anchor for the "Digital Sanctuary."
- **Absolute Positioning & Offset:** Global navigation elements are positioned absolute.
  To prevent initial overlap, screens must apply a `paddingTop` equal to the total header
  height (Status Bar + 64px).
- **Boundary Definition:** Do not use any boundary definition for the bottom tab
  navigation bar
- **Future-Proofing:** It shifts your design from "Standard App" to a custom "Digital
  Sanctuary."

## Navigation Layout

### 1. Home (The "Pulse")

**Purpose:** Immediate relevance, containing latest livestream, breaking news, and other
priority announcements.

**UI:** A scrolling dashboard of widgets

**Tenet Alignment:**

- **Tenet 5 (Simplicity):** A widget-based dashboard provides a "glanceable" interface
  where the most important information is surfaced immediately without digging through
  menus.
- **Tenet 7 (Focused):** Featured content like the livestream keeps the spiritual
  experience internal to the app, protecting users from external algorithm distractions.

### 2. Bible (The Reader)

**Purpose:** Focused Scripture reading, saved verses, translation selection, and on-demand
Bible audio.

**UI:** Immersive reader with chapter-local search and persistent audio controls.

**Tenet Alignment:**

- **Tenet 3 (Sanctuary):** Reading and saved-verse history remain local to the device.
- **Tenet 6 (Devotional):** Text, audio, and translation controls share one focused reader.

### 3. Explore (The "Spiritual" Library)

**Purpose:** Deep personal growth through sermons, hymnals, and other church resources.

**UI:** Reader-focused (Immersive text) through a bookshelf style archive, possibly
grouped by media type

**Tenet Alignment:**

- **Tenet 5 (Simplicity):** Immersive, text-heavy UI ensures that the content—not the
  chrome—is the focus for all age groups.
- **Tenet 6 (Devotional):** Reader-focused resources lower the friction for worship and
  daily devotion.

### 4. You (The Personal History "Utility" Drawer)

**Purpose:** Administrative tasks, personal history, preferences, and personal actions.
Give/Tithes, Dark Mode, Language, History (Recent Sermons), data privacy settings, etc.

**UI:** Similar to Resources with bookshelf style archive. An additional Settings cogwheel
may be placed on the top right of the tab if needed, like YouTube.

**Tenet Alignment:**

- **Tenet 1 (Sustainable):** Giving features are placed here to ensure the "tower" remains
  funded and the app remains free to maintain.
- **Tenet 2 (Liability-Free):** Centralizes settings and staff contact to provide
  transparent access to privacy controls and leadership.
- **Tenet 5 (Simplicity):** Since the "History" (Recent Sermons) is stored locally on the
  device, this pillar demonstrates that the app provides a personalized experience without
  harvesting Personally Identifiable Information (PII). It honors the "Sanctuary" by
  keeping the user’s study habits private.
