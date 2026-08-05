# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features.

For latest production build, you may install app directly from browser

https://app.nyccsda.org

on Safari (iOS) or Chrome (Android).

## Table of Contents

- [Technical Setup & Testing](docs/README.md)
- [Bulletin API Architecture & Operations](apps-script/README.md)
- [Accessibility Guidelines](docs/accessibility/README.md)
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

We proactively reduce privacy and legal risk through purpose limitation, data
minimization, restricted administrative access, and conservative public disclosure, even
when the tradeoff results in fewer features. Privacy frameworks such as the CCPA and GDPR
inform these design goals; mentioning them is not a certification or claim that this
project, every deployment, or every organization using a fork automatically complies with
those laws. Deploying organizations remain responsible for reviewing their own legal and
operational obligations.

> _"Behold, I am sending you out like sheep among wolves. Therefore be as shrewd as snakes
> and as innocent as doves."_ — **Matthew 10:16**

### 3. Sanctuary

We minimize the collection and public exposure of personal information, treating the
digital experience as a secure refuge. The public PWA does not require an account for
ordinary use. Restricted church administrative systems may contain personal information
that is necessary for church operations, such as worship assignments, but public features
must disclose only what is needed for their stated purpose. A church is a "third space"
and a final refuge; our technology must be a shade from the heat, not a source of
surveillance.

> _"For You have been a refuge for the poor, a stronghold for the needy in distress, a
> refuge from the storm, a shade from the heat."_ — **Isaiah 25:4**

### 4. Community

Every feature must serve the goal of promoting **in-person fellowship**. Digital
tools—such as event sign-ups or notifications—are high-value only if they make it easier
for a member to show up to a physical gathering. We facilitate connection without
requiring public-app accounts or exposing more personal information than the feature
needs.

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

**User workaround:** Tap anywhere in the installed app after launch. That trusted user
gesture lets the PWA request the browser Fullscreen API. Chrome may briefly display its
own fullscreen confirmation; the site cannot reposition or style that browser-owned UI.
Cycling the notification shade remains a fallback on devices where Chrome does not honor
the fullscreen request.

The web app cannot directly control the equivalent native operation. A standard PWA runs
inside the browser security sandbox and has no access to the Android `Window`,
`WindowInsetsController`, or `WindowInsetsControllerCompat` APIs used by native apps to
hide system bars. The Fullscreen API requires a transient user interaction and does not
provide direct control over the native Android activity's system-bar flags. CSS viewport
changes and forced reflows also cannot reliably reproduce an operating-system
notification-shade transition.

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

This application values privacy and uses data minimization to limit what the public app
receives. The PWA does not require a user account for ordinary use. Church administrative
systems and service providers still process limited information needed to operate the
app, as described below.

### 2. Worship Schedule Information (Google Workspace)

Authorized church schedule managers enter participant names and worship assignments into
a restricted, church-managed Google Sheet. Authorized form submitters provide weekly
worship-program details through Google Forms; the restricted response Sheet may record a
submitter's email address.

A Google Apps Script web app reads the requested Sabbath schedule and form response and
returns only an allowlisted bulletin response. Before the response becomes public, the
script shortens Latin-script full names to a first name and last initial. A single-word
Latin-script name may appear as entered, while unsupported non-Latin names are replaced
with a privacy placeholder. Full names, form submitter email addresses, and other
non-allowlisted spreadsheet fields are not included in the public API response. The
shortened names may still identify people within the church community and are therefore
treated as personal information rather than anonymous data.

This information is used to communicate worship assignments and weekly program details.
Access to the source Sheets is controlled by the church through Google Workspace, and
source-data retention is governed by the church's administrative practices.

### 3. Temporary Caching and Device Storage

Google Apps Script temporarily caches privacy-filtered bulletin responses to reduce Sheet
reads. The PWA may store the same filtered bulletin data and refresh timing in browser
local storage so ordinary visits do not repeatedly call the API and the bulletin can
refresh around Sabbath boundaries. Users can remove the device copy by clearing this
site's browser data.

### 4. Hosting and Traffic Services

This web application is deployed using GitHub Pages. GitHub may collect basic server logs
and IP addresses for security, debugging, and operational maintenance.
We use Cloudflare to manage domain traffic and protect the application from common web
threats. Cloudflare may process basic connection data (such as IP addresses) to identify
malicious traffic and optimize performance. Google processes the restricted source data
and API requests through Google Workspace, Google Sheets, Google Forms, and Google Apps
Script. Each provider handles information under its own applicable terms and privacy
policies.

### 5. External Links

This application links to external platforms such as YouTube, Spotify, and
HymnsForWorship.org. When you follow these links, you are subject to the privacy policies
of those third-party providers. These services may collect information such as IP
addresses as part of their standard operations. The church does not receive or store
information those external platforms independently collect from you.

### 6. Privacy Frameworks and Questions

The project's minimization measures are informed by privacy principles found in laws such
as the CCPA and GDPR, but they do not by themselves guarantee legal compliance. Which laws
apply depends on the deploying organization, its users, and its data practices. Questions
or requests concerning church-managed schedule information may be sent to
`pastor@nyccsda.org`.

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
