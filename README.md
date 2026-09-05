# SDA Church App

A React Native mobile application built with Expo for Seventh-day Adventist church
community features.

For latest production build, you may install app directly from browser

https://app.nyccsda.org

on Safari (iOS) or Chrome (Android).

## Table of Contents

### Project overview

- [Project Tenets](#project-tenets)

### Legal, licensing, and privacy

- [Legal, Licensing & Privacy](docs/LEGAL.md)

### Project documentation

- [Technical Setup & Testing](docs/README.md)
- [Web and Native Build Workflows](docs/operations/native-builds.md)
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

## Build workflows

The repository uses one Expo source for the website and native apps. Website deployment
stays automatic: a push to `main` runs the existing GitHub Pages workflow. It can also be
run manually with `npm run deploy`.

Native binaries are opt-in. In GitHub Actions, open **Native binaries** and choose **Run
workflow**. Select the source branch or tag, choose a builder, and check any combination
of these targets:

- iOS store build (`.ipa`) for App Store Connect and TestFlight.
- Android store build (`.aab`) for Google Play.
- Android preview build (`.apk`) for direct device installation.

The default `github` builder compiles on GitHub-hosted runners and uploads the binary as a
workflow artifact. Choose `eas` to compile on Expo's cloud builders. Both choices require
the church-owned Expo project, configured signing credentials, and the `EXPO_TOKEN` GitHub
secret. Native builds never publish to a store automatically, so review and submission
remain separate steps.

Signing credentials are managed by EAS by default. You can instead store Android
and Apple signing files as encrypted GitHub secrets and use a local-credentials
profile, but that requires additional workflow setup and ongoing certificate
rotation. The [native build guide](docs/operations/native-builds.md) explains
both approaches.

The same targets are available locally:

```sh
eas --version                         # installed with: npm install --global eas-cli@23.2.0
npm run build:ios
npm run build:android
npm run build:android:apk
```

The global `eas` command is optional; the npm scripts use the pinned CLI version.
For GitHub Actions, create an access token in Expo under **Account settings →
Access tokens**, then add it to the repository under **Settings → Secrets and
variables → Actions** with the name `EXPO_TOKEN`. The **Native binaries** workflow
uses that secret to access the church-owned Expo project. Keep the token out of
source control. For a local session, use `export EXPO_TOKEN='your-token'` and
remove it afterward with `unset EXPO_TOKEN`.

Local Android compilation needs Java 17 and the Android SDK/NDK. Local iOS compilation
needs macOS, Xcode, CocoaPods, and fastlane. See the
[Web and Native Build Workflows](docs/operations/native-builds.md) guide for account
setup, signing, runner details, artifact handling, and store submission commands.
