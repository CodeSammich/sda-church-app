# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features.

For latest production build, you may install app directly from browser

https://app.nyccsda.org

on Safari (iOS) or Chrome (Android).

## Table of Contents

### Project overview

- [Project Tenets](#project-tenets)
- [Known Bugs](#known-bugs)

### Legal, licensing, and privacy

- [Legal, Licensing & Privacy](docs/LEGAL.md)

### Project documentation

- [Technical Setup & Testing](docs/README.md)
- [Bulletin API Architecture & Operations](apps-script/README.md)
- [Accessibility Guidelines](docs/accessibility/README.md)
- [UI/UX Design](docs/UI_UX.md)
- [Feature Designs](docs/feature_designs/)
  - [Bulletin Hymn Resolution & Extension Guide](docs/feature_designs/bulletin_hymn_resolution.md)
  - [Offline Bulletin Translation: Bergamot Feasibility](docs/feature_designs/offline_bulletin_translation.md)
- [Contributing Code](docs/CONTRIBUTING.md)

## Project Tenets

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

## Platform Notes

### Bible background audio in installed PWAs

Release `0.27.0` resolves the iOS/iPadOS background and chapter-transition failures tracked
in [issue #126](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/126).
On the tested Android installed PWA, playback now survives backgrounding and advances
several chapters, but it still pauses after approximately three chapters. Android therefore
remains partial rather than resolved.

The custom web player keeps one active document-attached audio element, preloads only the
immediately following chapter in a guarded standby element, and holds up to 24 lightweight
future chapter descriptors. Later audio files and chapter text are not fetched in advance.
When the PWA becomes visible, the Bible reader catches up to the chapter already selected
by the audio engine.

Lock-screen presentation remains controlled by the operating system. Android notification
privacy/media settings may hide the player on the lock screen even while audio and
notification-shade controls continue to work. iOS may show the audio host (for example,
`helloao.org`) as a system-controlled origin even when Media Session metadata supplies the
chapter, translation, and provider title. The church-hosted Audio Power mirror is labeled
`NYCCSDAS.org`.

Before the improved Pixel test, Android's **Show media on lock screen** setting was toggled
off and back on, then left in its original state. That may have reset cached system/Chrome
media state, so the test cannot prove that the queue changes alone caused the improvement.
The 24-item descriptor queue is much longer than the observed three-chapter run, making a
simple queue-length limit unlikely.

Preloading every chapter at launch was rejected because the BSB recordings are roughly
86 MB per hour at their current bitrate, and downloading more data would add unnecessary
network and storage cost. The web implementation instead preloads one chapter on demand
after the user presses Play.

If dependable long-running Android background playback is required, a compiled Expo build
with a native media queue remains the fallback. Capacitor alone would still require a
native audio plugin or custom platform implementation and would add native-project
maintenance, so it is not a simpler fix for this remaining PWA lifecycle limitation.

References:

- [Expo background audio](https://docs.expo.dev/versions/latest/sdk/audio/#playing-audio-in-the-background)
- [Expo Continuous Native Generation](https://docs.expo.dev/workflow/continuous-native-generation/)
- [Media Session API](https://developer.mozilla.org/en-US/docs/Web/API/Media_Session_API)
- [Capacitor native plugin model](https://github.com/ionic-team/capacitor#readme)

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
