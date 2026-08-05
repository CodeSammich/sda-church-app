# Design Doc: Bible Integration (HelloAO and fetch(bible))

## 1. Objective

Provide a seamless, multi-language Bible reading experience (English, Chinese Traditional,
Chinese Simplified, Spanish) within the PWA. The goal is to provide a fast,
offline-capable interface that respects API rate limits and protects developer
credentials.

## 2. Technical Architecture

### 2.1 Translated Bible Source Routing

Instead of proprietary embeds, the app consumes raw JSON from HelloAO and fetch(bible).
The public app translation IDs remain stable even when their chapter provider differs:

| App translation | Chapter source | Provider resource | Reason |
| --- | --- | --- | --- |
| BSB (`BSB`) | HelloAO | `BSB` | Genesis sampling found the same notes on both providers; HelloAO retains richer chapter structure and chapter-sized requests |
| KJV (`eng_kjv`) | HelloAO | `eng_kjv` | Genesis sampling found the same notes on both providers; HelloAO retains richer chapter structure and chapter-sized requests |
| Traditional CUV (`cmn_cuv`) | fetch(bible) | `cmn_cut` | Use fetch(bible's normalized source text and translation-note metadata |
| Simplified CUV (`cmn_cu1`) | fetch(bible) | `cmn_cus` | Use fetch(bible's normalized source text and translation-note metadata |
| Reina-Valera 1909 (`spa_r09`) | fetch(bible) | `spa_rv` | HelloAO omits the edition's translation notes; fetch(bible retains them |

The English routing was audited against Genesis 1, 4, 12, 22, 37, and 49. BSB
and KJV had identical note counts between providers in every sampled chapter,
and the Genesis 1 note contents matched after normalizing reference prefixes.
Re-run this comparison if either provider revises its underlying resource.

HelloAO remains the shared source of translated-edition book names and chapter counts.
`BibleService.fetchChapter` routes chapter content according to the table above.

`BibleService.parseScriptureReference` converts a single book/chapter reference and an
optional same-chapter verse range into canonical USFM coordinates. Its localized 66-book
table accepts and formats English, Traditional Chinese, Simplified Chinese, and Spanish
book names. Bulletin links use those coordinates to open the current app language's
default translation and scroll to the first requested verse without selecting it.
Ambiguous, multi-passage, or cross-chapter strings retain their entered display text but
their action falls back to Genesis 1:1 in that same language; blank and `TBD` fields remain
non-actionable.

- **No Auth:** Open access to the selected BSB, KJV, CUV, and Reina-Valera resources
  requires no API keys. This aligns with Tenet 1, 2, and 3 by avoiding user-tracked tokens
  or developer credentials.
- **Format:** Both services return structured JSON that is adapted into the app's native
  chapter, verse, heading, and footnote model.
- **CORS:** Both providers support direct requests from the PWA without proxy overhead.
- **Performance Optimization:** HelloAO content is loaded by chapter. fetch(bible content
  is delivered by book, cached as an in-memory promise, and sliced into chapters without
  downloading a whole translation.
- **Rate Limiting:** The selected static resources do not require a metered commercial API
  tier. Their CDN-oriented delivery aligns with **Tenet 1 (Sustainable)**.

Provider references:

- https://bible.helloao.org/docs/reference/#available-translations
- https://fetch.bible/access/manual/

### 2.2 fetch(bible) Resources

#### 2.2.1 Translated Chapter Adapter

fetch(bible's normalized plain-text JSON stores a whole book as 1-based chapter and verse
arrays. Inline `heading` and `note` objects are converted into the existing
`ChapterHeading`, `VerseFootnoteReference`, and `ChapterFootnote` models. This preserves
the reader UI, saved references, search, sharing, and app-level translation IDs while
allowing the richer provider resource to be authoritative.

The translated book promise is cached by fetch(bible resource ID and canonical lowercase
USFM book ID. Failed promises are evicted so a later request can retry.

#### 2.2.2 Original-Language Reference Lookup

The lookup is independent of the displayed translation. `BibleService` sends the
canonical USFM book ID, chapter number, and verse number to fetch(bible's normalized
plain-text collection. fetch(bible uses lowercase USFM book IDs and standardizes its
distributed formats to the common KJV-style versification. Therefore an English, Chinese,
or Spanish translation can resolve the same original-language verse without attempting a
fragile one-to-one text match.

The original-language book promise uses the same book-level caching strategy and extracts
the requested 1-based chapter and verse array. This keeps repeat popup views responsive.

The displayed sources are critical editions reconstructed from manuscript witnesses;
they are not scans, facsimiles, or diplomatic transcriptions of a single “latest
manuscript.” The selected open editions are:

| Testament | fetch(bible) ID | Edition | Display language |
| --- | --- | --- | --- |
| Old Testament | `hbo_sr` | Solid Rock Hebrew Bible | Hebrew, including the Biblical Aramaic passages |
| New Testament | `grc_sr` | Statistical Restoration Greek New Testament | Koine Greek |

For presentation, the parser omits separate note objects from fetch(bible's plain-text
payload and collapses layout whitespace so word-per-line Greek data reads naturally in a
React Native text block. It otherwise preserves the source character strings and textual
sigla. Hebrew/Aramaic is rendered right-to-left with Ezra SIL; Greek is rendered
left-to-right with Gentium. Font sources and their separate licenses are documented in
[`assets/fonts/README.md`](../../assets/fonts/README.md).

#### 2.2.3 Licensing Boundary: Free Service vs. Licensed Content

This distinction is mandatory for maintenance and legal review:

> **fetch(bible's CDN is free to access, but fetch(bible does not place every work it
> distributes into the public domain.** Service access and content licensing are separate
> grants of permission.

[fetch(bible's official access policy](https://fetch.bible/access/#no-limits-from-us)
states that the service itself imposes no usage limits and permits long-term caching, but
also explicitly requires consumers to comply with the terms of each individual Bible
resource. A future maintainer must never infer permission to redistribute a work solely
because it appears on fetch(bible).

The translated CUV and Reina-Valera resources above are public domain. Both
original-language editions selected by the app use
[Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/):

- [Solid Rock Hebrew Bible license and required citation](https://github.com/jjmccollum/solid-rock-hb#license-and-citation)
- [Statistical Restoration Greek New Testament license and attribution](https://github.com/Center-for-New-Testament-Restoration/SR#license)

CC BY 4.0 is free and open: it permits copying, redistribution, adaptation, and commercial
use without a fee or separate permission. It is not public domain and it is not
condition-free. Distribution must retain appropriate creator/editor credit, provide a
link to CC BY 4.0, indicate presentation or other changes, and must not impose additional
legal or technological restrictions that prevent recipients from exercising the licensed
rights.

Consequently:

1. The edition/editor attribution in the verse-detail popup must not be removed.
2. The source links, CC BY 4.0 link, and formatting-change disclosure in the repository
   documentation must be retained.
3. If the app later exposes clickable attribution, both the edition source and license
   should be linked directly.
4. Changing either original-language fetch(bible resource ID requires reviewing and
   documenting the new work's individual license before release.
5. The Bible-text licenses are separate from fetch(bible's service policy, HelloAO's
   service behavior, the application source-code license, and the OFL/MIT licenses of the
   bundled fonts.

### 2.3 Longevity

1. **Legal Sustainability (Non-Profit Governance) - Tenet 2**

AO Lab is a 501(c)(3) non-profit organization dedicated to open-access Bible data. Unlike
commercial startups, its governance model is mission-driven rather than profit-driven.
Choosing CC0 translations like the BSB mitigates the liabilities mentioned in **Tenet 2
(Liability-Free)**.

Furthermore, the Berean Standard Bible (BSB) is released under Creative Commons Zero
(CC0). This ensures that the legal right to host and distribute the text is irrevocable,
independent of any single provider's existence.

2. **Technical Resilience (Open Architecture) - Tenet 1**

Unlike "black box" proprietary APIs, the HelloAO API is essentially a wrapper around
static assets.

- **Static Assets:** The data architecture avoids complex database maintenance, relying
  instead on static JSON files.
- **Infrastructure Portability:** The entire API engine and transformation scripts are
  open-source. In a scenario where the primary service becomes unavailable, the repository
  fork allows for rapid redeployment to a self-hosted environment (e.g., GitHub Pages or
  AWS).

This portability is essential for **Tenet 1 (Sustainable)**, ensuring the app remains free
and maintainable regardless of external corporate changes.

### 2.4 Contingency & Sustainability

To ensure the longevity of the application and mitigate risks if the 501c3 (HelloAO Lab)
shuts down:

- **Source Fork:** The core API engine and data scripts have been forked to
  CodeSammich/bible-api from the original repository.
- **Contingency Plan:** If the primary API becomes unavailable, the project can be
  redeployed as a collection of static JSON files via GitHub Pages or a self-hosted
  instance.

### 2.5 Alternatives

#### 2.5.1 Why YouVersion is not Preferred

While YouVersion (Digital Bible Library) offers an extensive catalog, it was excluded for
this specific native-first architecture due to:

1.  **The WebView Trap:** YouVersion's API is primarily designed for WebViews/Iframes.
    This creates a "latency tax" where the UI flickers during chapter transitions.
2.  **Branding Constraints:** It is nearly impossible to inject custom CSS into an iframe
    to match our theme. Maintaining internal rendering supports **Tenet 7 (Focused)**.
3.  **Offline Blockers:** Browser security (SOP) prevents the app from reading text inside
    a cross-origin iframe. This makes it impossible to cache YouVersion content into
    `IndexedDB` for offline church use.
4.  **UI Overhead:** Rerendering a WebView is heavier than rendering text strings, which
    violates **Tenet 5 (Simplicity)** regarding smooth performance on older hardware.

#### 2.5.2 api.bible (American Bible Society)

While api.bible offers a wide range of translations, it was excluded due to the following
technical and operational constraints:

1. **Request Quotas:** The free tier is limited to 5,000 API calls per month. This
   dependency on a tiered pricing model violates the "Free to maintain" goal of **Tenet
   1**.
2. **Translation Limits:** Access is restricted to a maximum of three copyright-protected
   translations.
3. **Provisioning Requirements:** Access requires manual developer registration and
   approval, which introduces friction for open-source contributors.

#### 2.5.3 bible-api.com

bible-api.com was considered for its simplicity but rejected for several technical
reasons:

1. **Restricted Catalog:** The service primarily offers English Public Domain
   translations, lacking the multi-language depth (e.g., CUV, RVR) required for the
   community.
2. **Rate Limiting:** Aggressive throttling (15 requests every 30 seconds) significantly
   impacts performance during initial data synchronization or rapid navigation.
3. **Availability Guarantees:** Lacks formal uptime commitments or service level
   agreements (SLAs) necessary for a reliable production environment.

---

## 3. Bible Translation Requirements

While the NIV is a global standard, it introduces several "Enterprise" hurdles that
conflict with our tenets:

1. **Legal Risk:** Biblica owns the copyright. Usage requires strict adherence to
   licensing. This creates the "data liabilities" and "legal vulnerabilities" we seek to
   avoid in **Tenet 2**.
2. **API Barriers:** Accessing restricted translations via providers like
   [api.bible](https://api.bible/sign-up) requires developer registration, manual approval
   for API keys, and is subject to strict **rate limits** that can cause "jank" or
   failures during peak usage times.
3. **Caching Restrictions:** Most commercial licenses forbid local storage/caching of the
   full text. This would break our goal of providing a "Frictionless interface" for
   spiritual growth (**Tenet 6**) during offline scenarios.

Preference criteria for primary English Bible:

1. Gender inclusive (adelphoi -> brothers & sisters > brothers)
2. Culturally common (The LORD > Yahweh)
3. No archaic language (you > thee/thou)
4. Public domain to avoid copyright or scaling issues with Biblica (NIV)
5. **Internal Focus:** Native rendering ensures the user stays within our "Digital Home"
   (**Tenet 7**).

See full comparison below:

### 3.1 The Community Test: James 1:2

_Focus: Gender-inclusive language._

| Translation | Verse Text                                                                                     | Legal Status            |
| :---------- | :--------------------------------------------------------------------------------------------- | :---------------------- |
| **BSB**     | "Consider it pure joy, my **brothers and sisters**, whenever you face trials of many kinds..." | **Public Domain (CC0)** |
| **NIV**     | "Consider it pure joy, my **brothers and sisters**, whenever you face trials of many kinds..." | Licensed (Needs Credit) |
| **WEBBE**   | "Count it all joy, my **brothers**, when you fall into various temptations..."                 | **Public Domain**       |
| **WEB**     | "Count it all joy, my **brothers**, when you fall into various temptations..."                 | **Public Domain**       |
| **KJV**     | "My **brethren**, count it all joy when ye fall into divers temptations..."                    | Public Domain (US)      |

---

### 3.2 The Gospel Test: John 3:16

_Focus: Modern tone vs. archaic "high English."_

| Translation | Verse Text                                                              | Tone    |
| :---------- | :---------------------------------------------------------------------- | :------ |
| **BSB**     | "For God so loved the world that He gave His **one and only Son**..."   | Modern  |
| **NIV**     | "For God so loved the world that he gave his **one and only Son**..."   | Modern  |
| **WEBBE**   | "For God so loved the world, that he gave his **one and only Son**..."  | Modern  |
| **WEB**     | "For God so loved the world, that he gave his **one and only Son**..."  | Modern  |
| **KJV**     | "For God so loved the world, that he gave his **only begotten Son**..." | Archaic |

---

### 3.3 The Name Test: Psalm 23:1

_Focus: Use of "The LORD" vs. "Yahweh."_

| Translation | Verse Text                                           | Handling of Tetragrammaton |
| :---------- | :--------------------------------------------------- | :------------------------- |
| **BSB**     | "**The LORD** is my shepherd; I shall not want."     | Standard (The LORD)        |
| **NIV**     | "**The Lord** is my shepherd, I lack nothing."       | Standard (The Lord)        |
| **WEBBE**   | "**The LORD** is my shepherd: I shall lack nothing." | Standard (The LORD)        |
| **WEB**     | "**Yahweh** is my shepherd: I shall lack nothing."   | Transliterated (Yahweh)    |
| **KJV**     | "**The LORD** is my shepherd; I shall not want."     | Standard (The LORD)        |

---

### 3.4 The Service Test: Romans 12:1

_Focus: Sentence structure and "natural" flow._

| Translation | Verse Text                                                                                       | Clarity Level         |
| :---------- | :----------------------------------------------------------------------------------------------- | :-------------------- |
| **BSB**     | "...present your bodies as a living sacrifice... this is your **spiritual service of worship**." | High (Formal)         |
| **NIV**     | "...offer your bodies as a living sacrifice... this is your **true and proper worship**."        | High (Conversational) |
| **WEBBE**   | "...present your bodies a living sacrifice... which is your **spiritual service**."              | Medium (Literal)      |
| **WEB**     | "...present your bodies a living sacrifice... which is your **spiritual service**."              | Medium (Literal)      |
| **KJV**     | "...present your bodies a living sacrifice... which is your **reasonable service**."             | Low (Archaic)         |

---

### 3.5 Summary Comparison Matrix

| Feature               | **BSB**        | **WEBBE** | **WEB**     | **NIV**            | **KJV**      |
| :-------------------- | :------------- | :-------- | :---------- | :----------------- | :----------- |
| **Gender-Inclusive?** | **YES**        | NO        | NO          | YES                | NO           |
| **"The LORD"?**       | **YES**        | **YES**   | NO (Yahweh) | YES                | YES          |
| **Modern English?**   | **YES**        | YES       | YES         | YES                | NO           |
| **Legal Risk?**       | **ZERO (CC0)** | **ZERO**  | **ZERO**    | LOW (Needs Credit) | ZERO (in US) |

KJV will be maintained for reference purposes, while modern translations like BSB will
serve as the default.

**Supported Translations:**

1. BSB - Modern Public Domain English
2. KJV - English Traditional
3. CUV (Traditional) - 1919 edition (Public Domain).
4. CUVS (Simplicity) - Public Domain.
5. RVR1909 (Spanish Traditional) - Public Domain.
6. SSE (Spanish Modern) - Public Domain.

## 4. Future Work

### 4.1 Caching and Offline Access

While the PWA supports service worker caching, explicit persistence in `IndexedDB` is
planned. `IndexedDB` is preferred over `AsyncStorage` due to the large payload size of
full Bible chapters and better performance with structured data queries.

### 4.2 Bible Sharing Feature

- **Mechanism:** Standard Web Share API.
- **Implementation:** A "Share" button on every verse or chapter header. The routing logic
  utilizes "Smart Parsing" to handle case-insensitivity and common short-codes (e.g.,
  `Jn 1:1` vs `John 1:1`) to ensure deep-link reliability.
- **Payload:** Generates a deep link back to the PWA (e.g.,
  `church-app.io/bible?v=john.1.1&t=cuvs`) or a plain-text snippet for WhatsApp.

### 4.3 Additional Language Support

Indonesian, German, Japanese also have free public bibles. Can consider later.

Notably, Tibetan (Moravian Version Yoseb Gergan, 1948) is also public domain. While UTF-8
encoding was historically challenging, the HelloAO API provides TBTI (Central Tibetan) via
their source metadata, offering a Unicode-encoded path for these scripts.

### 4.4.Select Reader Fonts & Highlighting & Personal Saved Verses

Like the YouVersion Bible app, users should be able to customize select high-quality fonts
and add colored highlighting. Favorite verses will be saved to personal storage.
