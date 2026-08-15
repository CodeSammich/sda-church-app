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

Deep Ocean Blue `#0369A1` is the light-mode interaction color. Dark mode replaces saturated
blue actions with the softer off-white `#E2E8F0`, reducing glare while preserving clear
focus. The brighter Sanctuary Blue `#3EA6FF` is reserved for the dark Bible reader's
footnote indicator rather than used as the global primary color.

<!-- prettier-ignore -->
| Element | Light Mode Hex | Dark Mode Hex | Rationale |
| :---| :---| :---| :---|
| **Primary Interaction Color Accent** | #0369A1 | #E2E8F0 | **Luminance over Hue.** Light mode uses a deep accessible ocean blue; dark mode uses a softened off-white to avoid high-glare saturated controls. |
| **Tertiary Decorative / Narrative Icons** | #0369A1 | #E2E8F0 | **Unified Action Language.** Primary and tertiary share one interaction treatment so controls remain predictable. |

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
| **Background**    | #F2E6DF  | #0F0F0F | **The Canvas.** A warm low-glare light canvas and deep dark canvas. |
| **Surface (Cards/Containers)**  | #FAF4EF  | #1E1E1E | **The Object.** Warm light cards and charcoal dark cards lift clearly from the canvas. |
| **Surface Variant**    | #F1F3F4  | #2C2C2C | **Secondary UI.** Search bars, unselected controls, and subtle grouped UI. |
| **On Surface**   | #1A1A1A  | #F5F5F5 | **The Ink.** High-contrast monochrome. Uses reduced-luminance white (#F5F5F5) to mitigate **Irradiation Illusion** ([NIH/PMC3939872](https://pmc.ncbi.nlm.nih.gov/articles/PMC3939872/)), preventing optical "bleeding" (halation) and maintaining sharp typography on OLED screens. |
| **On Surface Variant**   | #606060  | #AAAAAA | **Muted Intent.** Recedes into the header to minimize distraction. Special case from [Material Design](https://m3.material.io/components/app-bars/specs) similar to YouTube.   |
| **Text/Icon on Primary**  | #FFFFFF  | #0F172A | **The Stencil.** High-contrast content shown inside primary controls. |
| **Selection Container**  | #E3F2FD  | #2C2C2C | **The State.** Used for active/selected states and primary containers to provide tactile feedback without shifting brand colors.   |
| **Boundary (Outline)**   | #CAC4D0  | #938F99 | **The Frame.** Standard Material Design 3 boundary color for high-visibility component borders. |
| **Boundary (Subtle)**   | #E0E0E0  | #3F3F3F | **The Divider.** Used for subtle dividers and non-critical borders within grouped cards to organize lists without visual noise.    |
| **Functional Icons (e.g. Bottom Bar)** | #1A1A1A  | #F5F5F5 | **Active Focus.** Selection is indicated by a fill state while using `onBackground`. |

### Grid Menu Card Tokens

Grid menu cards use category-specific backgrounds and icons from `cardBgColors` and
`iconColors`. Their shared chrome must use `colors.gridMenuCard` rather than literals in
the component.

<!-- prettier-ignore -->
| Token | Light Mode | Dark Mode | Purpose |
| :---| :---| :---| :---|
| **Card Border** | #E0E0E0 | #3F3F3F | Subtle boundary around each category card. |
| **Decorative Icon** | rgba(40, 40, 40, 0.18) | rgba(255, 255, 255, 0.18) | Default low-emphasis illustration when no category icon color is supplied. |
| **Arrow Background** | #FFFFFF | #2C2C2C | Circular navigation affordance surface. |
| **Arrow Border** | #374151 | #938F99 | Crisp affordance boundary. |
| **Arrow Foreground** | #374151 | #AAAAAA | Diagonal arrow icon. |

### Special External Brand Colors

These brand colors are used for third-party recognition in Light Mode and follow the
"YouTube Treatment" (monochrome) in Dark Mode.

| Element           | Light Mode Hex | Dark Mode Hex | Rationale                                                   |
| :---------------- | :------------- | :------------ | :---------------------------------------------------------- |
| **YouTube Brand** | #FF0000        | #FFFFFF       | Official YouTube red in light; Monochrome in dark (Spec).   |
| **Spotify Brand** | #1DB954        | #FFFFFF       | Official Spotify green in light; Monochrome in dark (Spec). |
| **Zoom Brand**    | #0B5CFF        | #FFFFFF       | Official Zoom blue in light; Monochrome in dark.            |

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
