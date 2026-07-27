# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features.

For latest production build, you may install app directly from browser

https://codesammich.github.io/sda-church-app/

on Safari (iOS) or Chrome (Android).

## Table of Contents

- [Technical Setup & Testing](docs/README.md)
- [Known Bugs](#known-bugs)
- [UI/UX Design](docs/UI_UX.md)
- [Feature Designs](docs/feature_designs/)
- [Contributing Code](docs/CONTRIBUTING.md)
- [Branding & Trademarks](docs/LEGAL_BRANDING.md)

# Project Tenets

_Guiding our design philosophy in decreasing order of priority._

### 1. Sustainable

The app must be cost-effective, preferably free to maintain, and support both iOS and
Android. We prioritize the **Progressive Web App (PWA)** workflow to ensure long-term
viability, zero distribution fees, and instant updates without the gatekeeping or
technical debt of traditional App Stores.

> _"For which of you, wanting to build a tower, does not first sit down and calculate the
> cost to see if he has enough to complete it?"_ — **Luke 14:28**

### 2. Liability-Free

We proactively mitigate privacy and legal risks (e.g., CCPA, GDPR), even if the tradeoff
results in fewer functional features. Protecting the congregation is a non-negotiable
constraint; our volunteers should not be exposed to complex data liabilities or external
legal vulnerabilities.

> _"Behold, I am sending you out like sheep among wolves. Therefore be as shrewd as snakes
> and as innocent as doves."_ — **Matthew 10:16**

### 3. Sanctuary

We prioritize total anonymity, treating the digital experience as a secure refuge. While
we use aggregate data to help leadership make Informed Decisions about community needs, we
strictly reject the collection or storage of Personally Identifiable Information (PII). A
church is a "third space" and a final refuge; our technology must be a shade from the
heat, not a source of surveillance.

> _"For You have been a refuge for the poor, a stronghold for the needy in distress, a
> refuge from the storm, a shade from the heat."_ — **Isaiah 25:4**

### 4. Community

Every feature must serve the goal of promoting **in-person fellowship**. Digital
tools—such as event sign-ups or notifications—are high-value only if they make it easier
for a member to show up to a physical gathering. We facilitate connection without
requiring or compromising Personally Identifiable Information (PII).

> _"And let us consider how to spur one another on to love and good deeds. Let us not
> neglect meeting together, as some have made a habit, but let us encourage one
> another..."_ — **Hebrews 10:24-25**

### 5. Simplicity

We use simple design philosophies to ensure elderly and non-technical stakeholders can
navigate with ease. If a feature is too complex for a casual user to understand in
seconds, it must be simplified or removed.

> _"...You have hidden these things from the wise and learned, and revealed them to little
> children."_ — **Matthew 11:25**

### 6. Devotional

Centralization lowers barriers for daily devotion. By unifying the Bible, hymnal, and
community updates into one frictionless interface, we support the spiritual growth of
seekers and long-time members alike.

> _"But his delight is in the law of the LORD, and on His law he meditates day and
> night."_ — **Psalm 1:2**

### 7. Focused

The app is a **Digital Home** that protects users from "doomscrolling" and external
algorithms. While we leverage infrastructure like YouTube or Spotify, the user experience
remains internal to maintain spiritual focus.

> _"Finally, brothers, whatever is true, whatever is honorable, whatever is right,
> whatever is pure, whatever is lovely, whatever is admirable—if anything is excellent or
> praiseworthy—think on these things."_ — **Philippians 4:8**

---

## Bible Sources and Licensing

The Bible reader uses two separate content services with different roles:

- [HelloAO](https://bible.helloao.org/) supplies the English reader text and the
  shared translated-edition book catalog.
- [fetch(bible)](https://fetch.bible/) supplies the Chinese Union Version,
  Reina-Valera 1909, and the original-language critical editions shown in the
  verse-detail popup. Its normalized Chinese and Spanish resources expose the
  source editions' translation footnotes directly.

The translated fetch(bible) resources are the public-domain `cmn_cut` (traditional
CUV), `cmn_cus` (simplified CUV), and `spa_rv` (Reina-Valera 1909) editions.

### “Free to access” does not mean “public domain”

fetch(bible) provides an open CDN with no API key, usage fee, request quota, or
provider-imposed caching limit. That permission applies to access to the
fetch(bible) service; it does **not** erase or replace the license of each work
distributed through the service. fetch(bible explicitly states that consumers
must follow the terms of each individual Bible resource. See its
[official access and licensing explanation](https://fetch.bible/access/#no-limits-from-us).

The app currently requests these open critical editions:

| Testament | fetch(bible) ID | Edition | License and source |
| --- | --- | --- | --- |
| Old Testament | `hbo_sr` | Solid Rock Hebrew Bible | [CC BY 4.0; Stephen L. Brown, editor](https://github.com/jjmccollum/solid-rock-hb#license-and-citation) |
| New Testament | `grc_sr` | Statistical Restoration Greek New Testament | [CC BY 4.0; Alan Bunning / Center for New Testament Restoration](https://github.com/Center-for-New-Testament-Restoration/SR#license) |

[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) is an open and free
license. It permits copying, redistribution, adaptation, and commercial use
without a fee or separate permission. It is **not condition-free** and it is
not the same as a public-domain dedication. Users of the material must:

1. give appropriate credit to the creator and designated attribution parties;
2. link to the CC BY 4.0 license;
3. indicate whether the material was changed; and
4. avoid imposing legal or technological restrictions that prevent recipients
   from exercising the rights granted by the license.

The app preserves an edition-and-editor attribution in the verse-detail popup.
For display, `BibleService.fetchOriginalLanguageVerse` omits the separate note
objects in fetch(bible's plain-text payload and collapses source layout
whitespace; the returned biblical character strings and textual sigla are
otherwise displayed as provided. This formatting disclosure, the attribution,
the edition source links above, and the CC BY 4.0 link must be retained. Any
future replacement of either edition requires a fresh review of that resource's
individual license; fetch(bible's free service access alone is not sufficient
evidence that a replacement work may be redistributed.

The licenses for the bundled Greek and Hebrew fonts are separate from the
licenses for the biblical text. Font sources and exact terms are documented in
[assets/fonts/README.md](assets/fonts/README.md).

---

## Known Bugs

### Android PWA may require a notification-shade cycle for fullscreen

The installed Android PWA uses `"display": "fullscreen"` in its web app manifest. On
some Android and Chrome combinations, the app launches in its fullscreen window but does
not immediately hide the Android status and navigation bars. Pulling down the notification
shade and closing it causes Android and Chrome to recalculate the window insets and restore
the expected immersive fullscreen state.

**User workaround:** Swipe down from the top of the screen to open notifications, then
swipe back up to close them. The Home screen displays an Android-only reminder once per
fresh app session.

The web app cannot perform the equivalent operation itself. A standard PWA runs inside the
browser security sandbox and has no access to the Android `Window`,
`WindowInsetsController`, or `WindowInsetsControllerCompat` APIs used by native apps to
hide system bars. The browser Fullscreen API is a separate web capability: it generally
requires a transient user interaction and does not provide direct control over the native
Android activity's system-bar flags. CSS viewport changes, forced reflows, and page reloads
also cannot reliably reproduce an operating-system notification-shade transition.

A native Android or hybrid wrapper could explicitly call
`WindowInsetsControllerCompat.hide(WindowInsetsCompat.Type.systemBars())` when its window
regains focus. This project currently prioritizes the cross-platform, browser-installable
PWA workflow, so it uses the user-facing workaround instead.

References:

- [Chromium fullscreen PWA issue](https://issues.chromium.org/issues/40780591#comment26)
- [Fullscreen API security requirements](https://developer.mozilla.org/en-US/docs/Web/API/Element/requestFullscreen#security)
- [Android immersive-mode system-bar API](https://developer.android.com/develop/ui/views/layout/immersive)

### iOS installed PWAs do not support manifest fullscreen

iOS and iPadOS do not support the web app manifest's `"display": "fullscreen"` mode.
When this PWA is installed from Safari, the operating system falls back to a standalone
app window. The iOS status area, Home indicator, and system gestures remain controlled by
the operating system and a PWA cannot hide them permanently.

Apple-specific metadata can adjust the appearance of the status area or allow content to
extend behind it, but it does not provide the Android-style immersive fullscreen behavior.
This is a platform limitation rather than an application bug, and there is no notification-
shade workaround on iOS.

Reference: [PWA fullscreen platform support](https://web.dev/learn/pwa/enhancements#fullscreen_support)

---

## Branding & Trademarks

The source code in this repository is licensed under an open-source license, but this
software license does not grant any rights or permissions to use the proprietary branding,
registered trademarks, or official logos contained within the project.

**Unauthorized use of the Seventh-day Adventist® (SDA) Church symbol and related branding
is strictly prohibited.**

Please refer to the [Full Branding Policy](docs/LEGAL_BRANDING.md) for detailed usage
permissions and restrictions.

---

## Privacy Policy

### 1. Introduction

This application values your privacy. We do not host, store, or manage any personal
identifiable information on our own servers. This section outlines how third-party
services handle data to keep the application functional.

### 2. Hosting (GitHub Pages)

This web application is deployed using GitHub Pages. GitHub may collect basic server logs
and IP addresses for security, debugging, and operational maintenance.

### 3. Traffic Management (Cloudflare)

We use Cloudflare to manage domain traffic and protect the application from common web
threats. Cloudflare may process basic connection data (such as IP addresses) to identify
malicious traffic and optimize performance. No user-level activity within the app is
tracked by this service.

### 4. External Services

This application provides links to external platforms, such as YouTube, Spotify, and
HymnsForWorship.org. When you interact with these links, you are subject to the privacy
policies of those third-party providers. These services may collect data (such as IP
addresses) as part of their standard operations. We do not have access to, nor do we
store, any data collected by these external platforms.

---

## Legal Disclaimer

### 1. Usage of External Resources

This app links to HymnsForWorship.org for hymn resources. Please be aware that some hymns
are copyrighted. When you follow these links, you are subject to HymnsForWorship.org’s
terms and conditions. You may be prompted to accept their terms before viewing certain
content. Please respect copyright laws and do not attempt to bypass these requirements.

### 2. Data Attribution

This application provides access to non-copyrightable metadata (hymn titles and index
numbers) to facilitate navigation. We do not host or reproduce protected musical notation
or lyrics. All external content is accessed through direct links to authorized third-party
providers.

### 3. External Platforms & Services

This application provides links to external platforms and third-party services (e.g.,
YouTube, Spotify, HymnsForWorship.org) to assist users in locating musical performances,
recordings, or sheet music. Please note that these are external platforms, and your use of
them is subject to their respective terms and conditions. We do not host, curate, or
endorse the specific content or search results returned by these services. Users are
responsible for ensuring that their playback or usage of such content complies with their
local copyright and performance licensing requirements; linking to these services does not
constitute legal authorization for public performance.
