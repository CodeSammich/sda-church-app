# Legal, Licensing, and Privacy

Last reviewed: 2026-08-09

This document centralizes the project's licensing records, third-party source reviews,
privacy disclosures, branding restrictions, and legal disclaimer. It records engineering
decisions and public evidence; it is not legal advice or a guarantee that third-party
terms, ownership, or permissions will remain unchanged.

## Contents

- [Bible Sources and Licensing](#bible-sources-and-licensing)
- [Library Sources and Licensing](#library-sources-and-licensing)
- [English Hymnal Integration and Link Safety](#english-hymnal-integration-and-link-safety)
- [Chinese Hymnal Source and Link Safety](#chinese-hymnal-source-and-link-safety-rationale)
- [Branding & Trademarks](#branding--trademarks)
- [Privacy Policy](#privacy-policy)
- [Legal Disclaimer](#legal-disclaimer)

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

Chinese Union Version audio is streamed chapter by chapter from
[Audio Power](https://theaudiopower.org/translations/cuv/#nar1), which credits the
recordings to 基督徒团契 (Christian Fellowship). The app links directly to the
church's copies on Adventist Connect, with Internet Archive and Audio Power copies as
playback fallbacks; the repository does not bundle the recordings. Audio Power's owner,
Phil, explicitly approved the church app's use, download, and self-hosting of these recordings in
[issue #134](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/134#issuecomment-5274730608).

### Audio Power permission scope

The permission covers **only Audio Power's own Chinese Union Version narration**. That
is all the app uses from Audio Power: its audio sources are limited to the `cmn_cuv`
and `cmn_cu1` translations in `services/BibleAudioSources.ts`. The quoted permission
and its limits are recorded as text in
[issue #134](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/134#issuecomment-5851783677).

Audio Power's site also carries **Spanish and English recordings that belong to
others**, so they are not Audio Power's to license and are **not covered**:

| Recording | Rights holder | Status |
| --- | --- | --- |
| KJV (Hosanna) | Believed to be Faith Comes By Hearing (Hosanna); unconfirmed | Believed free for non-commercial use; unconfirmed. See the Faith Comes By Hearing status below. |
| KJV (D. Wagner) | Unconfirmed | Audio Power once bought a commercial license; current status unconfirmed. |
| Spanish Reina-Valera 1909 | Unconfirmed | Reported as publicly available; unconfirmed. The recording's status is separate from the 1909 text. |

**Faith Comes By Hearing (FCBH), as of August 2026.** The church asked FCBH about
KJV and Reina-Valera 1909 audio, including the Hosanna KJV recording above. FCBH
replied that it **does not have KJV English or Reina-Valera 1909 Spanish audio**
filesets, nor the New Tibetan Bible or the public-domain Japanese translations
requested. Still open:

- Whether FCBH (Hosanna) owns the Hosanna KJV recording that Audio Power hosts, and
  whether the church may use it. FCBH's replies covered only its current catalog.
- Whether any FCBH audio may be downloaded and hosted on the church's own storage.
  FCBH said it would check.
- Redistributing FCBH audio through this public repository would need FCBH's
  separate approval. FCBH noted that an audio recording can carry its own copyright
  even when the Bible text is public domain.
- The church's application for FCBH API access is pending.

### Bible Brain API license (Faith Comes By Hearing): planned, not in use

> [!NOTE]
> **Work in progress.** The app does **not** use Bible Brain or any Faith Comes By
> Hearing content today. The church has applied for API access and is waiting for a
> reply. This section records the license terms ahead of time so the integration
> ([#241](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/241))
> is designed to follow them.

Using FCBH audio through its Bible Brain API (the Digital Bible Platform, DBP) would
mean agreeing to the [API License Agreement](https://www.faithcomesbyhearing.com/bible-brain/license)
(last modified April 15, 2021), which the key application requires. Its terms that
would affect this project, quoted from the agreement (not legal advice):

| Topic | The agreement says | What it would mean here |
| --- | --- | --- |
| Downloading and offline use | "No DBP Content may be downloaded or made available for offline use by any person or outside of DBP except for DBP Content that is accessible via the /download endpoint." | No hosting FCBH audio or text on church storage, no caching it in a proxy, and offline listening only for content offered through `/download`, unless FCBH grants specific permission. |
| Proxies | "You do not create a proxy distribution network for DBP Content (for instance, enabling other developers to use DBP Content or metadata via your servers or API instead of ours)." | A key-hiding proxy must serve only this app: forward only the specific requests the app needs, and never act as an open relay others could use. Whether even a private proxy is acceptable has been asked of FCBH. |
| The API key | "You may not share your API Key with any other person and may only use the API through your assigned API Key." | The key must never ship in the app or the repository. Keep it as a server-side secret. |
| Cost to users | "You enable your End Users to access DBP Content completely free of charge." | Matches the app, which must stay free anyway (see the [App stores](architecture.md#app-stores) rule). |
| Attribution | You must "conspicuously post all proprietary rights notices on all DBP Content and FCBH Marks that is/are made available through Your Application." | The app must display FCBH's copyright notice wherever it plays or shows FCBH content. |
| Copying by users | "Your Application shall not allow End Users to reproduce, copy, or replicate any DBP Content", apart from `/download` content. | No share-audio-file or export features for FCBH content. |
| Termination | FCBH "may immediately terminate or suspend this Agreement … at any time and for any reason". | FCBH audio must never be the only source for a feature; keep a fallback, as the CUV audio has. |

The planned Cloudflare Worker proxy for the key is tracked in
[#241](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/241).
It must follow the proxy and caching terms above, and it must stay on Cloudflare's
Workers Free plan, which returns errors at its limits instead of billing.

Before the app uses or hosts any of these, get written confirmation from the
recording's rights holder and record it in #134 and in this section. Adding Spanish
and KJV audio, and the other routes to it, is tracked in
[#142](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/142). Audio Power can
be reached at info@theaudiopower.com, the contact address on its website.

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
[assets/fonts/README.md](../assets/fonts/README.md).

---

## Library Sources and Licensing

The Library is a curated catalog, not a web search. It links to each book's source;
the app doesn't bundle book text. The only document the church hosts is the Sabbath
Encouragement PDF, served with the web app. The content policy, catalog, and
research queue are in [Christian Library](feature_designs/christian_library.md). A
work may be copied into the app only when the exact edition, including any
translation, is public domain where the app is distributed, a stable source records
its rights status, and the required attribution can be kept. When in doubt, the work
is linked, not copied.

| Source | What the app uses | Rights basis |
| --- | --- | --- |
| **Ellen G. White writings** (EGW Writings, `egwwritings.org`) | Links that open each book's official English, Chinese, or Spanish edition, and small cover thumbnails from `a.egwwritings.org` | The Ellen G. White Estate holds the rights to its editions, translations, website, and app content. The app only links to the official reader and never copies the text. Using the thumbnails to identify books that lead to their official editions is a fair-use assessment, not an express license. |
| **Chinese Union Mission** (`api.sdabible.org`, `cms.sdabible.site`) | Cover thumbnails for the Chinese EGW editions only, loaded from its public catalog. The books themselves open on EGW Writings. | Same limited navigational use as the EGW covers. Image URLs are checked against the Mission's storage host. |
| **Adventist pioneer books on EGW Writings** | A link to Uriah Smith, *Daniel and the Revelation*, 1897 edition (`text.egwwritings.org/read/12861.1`) | Published in 1897, so public domain in the U.S. The app only links to it. Later revisions, such as the 1944 *The Prophecies of Daniel and the Revelation*, are still copyrighted and must not be substituted. |
| **Project Gutenberg** (`gutenberg.org`) | Links to six works: Joseph Bates, *The Seventh Day Sabbath, a Perpetual Sign* (1847); J. N. Andrews, *History of the Sabbath and First Day of the Week* (1873); Uriah Smith, *The State of the Dead and the Destiny of the Wicked* (1873); John Bunyan, *The Pilgrim's Progress* (1678); Andrew Murray, *Humility* (1895); John Foxe, *Fox's Book of Martyrs* (an abridged 19th-century American edition) | Each record is explicitly marked public domain in the U.S. |
| **Internet Archive** (`archive.org`) | Links to two scans: Richard Sibbes, *The Bruised Reed* (1630), in the 1838 London edition by Pickering, which also contains *A Fountain Sealed* and *A Description of Christ* (`archive.org/details/bwb_C0-AVW-616`); and Andrew Murray, *Abide in Christ* (1882), in the 1895 Revell edition (Chicago, New York, Toronto), microfilmed from the National Library of Canada's copy (`archive.org/details/cihm_11323`) | Checked 2026-09-27 under [Internet Archive sources](#internet-archive-sources). The scanned title pages read 1838 and 1895. The only later material is the 1838 editor's preface and Revell's 1895 list of Murray's books. Both scans are openly downloadable rather than lend-only. The archive.org record `abideinchristtho0000murr` is a 2013 reprint catalogued as 1880 and must not be used. |
| **The church's own copy** (`app.nyccsda.org/library/`) | *Sabbath Encouragement* (安息日勉言), the Chinese PDF the Brooklyn bulletin also uses, from `public/library/` | A compilation of Bible verses and Ellen G. White quotations, edited and shared freely by churches in China, who treat it as free of copyright. That comes secondhand, through the pastor ([#248](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/248#issuecomment-5852167793)); see [Sabbath Encouragement](operations/sabbath-encouragement-copyright.md). |

Each source falls back to the app's own original, text-free cover art if its
thumbnail can't load. That art was generated for this app without using the official
covers as input or reference.

The covers of the other library books are the app's own designs too. *The Pilgrim's
Progress* and *The Story of Jesus* use illustrations generated for the app. The rest
are typographic covers in the style of old cloth bindings, drawn from scratch by
[`scripts/generate-library-covers.py`](../scripts/generate-library-covers.py) with fonts
under the SIL Open Font License; none reproduces a publisher's cover.

### Internet Archive sources

The Internet Archive holds both public-domain scans, which anyone can download, and
in-copyright books, which it only lends. An old book's text can also be public domain
while a later edition of it isn't, because an introduction, notes, modernized wording,
or a translation carries its own copyright. So each Internet Archive item is checked
on its own before the library links to it:

1. **Read the scan's title page, not just the catalog record.** Catalog dates can be
   wrong: an *Abide in Christ* record dated 1880 is really a 2013 large-print reprint.
   The scanned edition itself must be from before 1928, the catalog's cutoff, and the
   entry records it as `editionYear`.
2. **Look for later additions.** Skip the scan if it adds an introduction, notes,
   illustrations, or a translation from after the cutoff.
3. **Check that it's openly downloadable.** Skip items that are access-restricted or
   in a lending collection (`inlibrary`, `printdisabled`, `lendinglibrary`); those are
   under copyright.
4. **Record what was checked** in the table above: the edition, publisher, identifier,
   and date.

The [external dependency monitor](operations/external-dependency-monitor.md) rechecks
every linked scan daily and fails if one becomes restricted, lend-only, or dated after
the cutoff.

### Before copying any book into the app

Linking is the current design. Copying text into an in-app reader, or storing it for
offline reading, needs more care:

- **Project Gutenberg texts.** The underlying works are public domain in the U.S., but
  Project Gutenberg's files carry its trademark and license. Either keep the Project
  Gutenberg license header and follow its terms, or remove every reference to Project
  Gutenberg and treat the result as a plain public-domain text. Decide which before
  building the reader. Tracked in
  [#166](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/166)
  and [#238](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/238).
- **Ellen G. White texts.** Although many original English works are old, the White
  Estate's editions and every translation are its own. Don't copy or cache EGW text,
  including the Chinese and Spanish editions, without the Estate's permission. Keep
  linking to the official reader.
- **Modern books.** Works such as C. S. Lewis's and other 20th-century authors' are
  likely still under copyright and need permission or an official link. Candidates
  are tracked in
  [#171](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/171)
  (C. S. Lewis) and
  [#149](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/149)
  (marriage preparation resources).
- **Chinese Adventist authors.** Only pre-1928 editions with a verified record are
  candidates for copying; later works need the publisher's or estate's permission.
  See the research queue in [Christian Library](feature_designs/christian_library.md).

---

## English Hymnal Integration and Link Safety

The English hymnal stores searchable metadata but does not host, proxy, cache, or embed
musical scores. A selected hymn opens externally on Hymns for Worship with the public
`#hymn-score` fragment, which places the user directly at the sheet music while retaining
the source page, attribution, copyright information, and site context.

Some source pages reproduce notices such as "used by permission." Those notices do not,
without the underlying grant, prove that the website received the permission, that it may
sublicense the work, or that this app may reproduce or embed it. The project therefore
does not claim to have independently verified publisher approval and does not treat public
image URLs as a redistribution license.

The as-built architecture, source-site findings, legal distinctions, rejected raw-image
and embedding approaches, maintenance rules, and reviewed sources are documented in
[English Hymnal Integration: As-Built Design and Link-Safety Record](feature_designs/hymnal_integration_design.md).

---

## Chinese Hymnal Source and Link-Safety Rationale

The Chinese 505, 506, and 707 hymnal directories link to sheet-music pages on
[zgaxr.com](https://www.zgaxr.com/). The site describes itself as a Chinese
Seventh-day Adventist website, and its [contact page](https://www.zgaxr.com/footer/16.html)
lists an address in Pingyang County, Zhejiang Province. It should not be described as a
Zhejiang municipal-government website: neither its location nor its regulatory filings
establish government ownership or endorsement.

The site footer displays the following registrations:

- ICP filing `浙ICP备12047548号`;
- internet religious-information filing `浙民宗备（2022）0000033号`; and
- public-security filing `浙公网安备33032602100278号`.

These identifiers are positive accountability signals because they associate the public
site with China's internet and religious-information regulatory processes. The
[Internet Religious Information Services Measures](https://www.miit.gov.cn/gyhxxhb/jgsj/cyzcyfgs/bmgz/xxtxl/art/2022/art_36c84b53178948ffba50dffaa7503cb1.html)
require a qualifying provider to apply through a provincial-level religious-affairs
authority, maintain information-review and security-management measures, and display its
license number. The filings are not, however, a technical security audit, copyright
clearance, privacy certification, or guarantee that the domain and its content can never
change.

Linking to the source is considered a reasonable, limited risk for this app because:

1. the repository stores only hymn numbers, titles, and zgaxr page IDs; it does not copy
   or serve zgaxr's sheet music;
2. destination URLs use a fixed `https://m.zgaxr.com` origin and locally checked-in page
   IDs rather than user-supplied URLs;
3. a hymn opens through the operating system's external-link handler, so zgaxr scripts
   and pages are not embedded in or executed as part of the app; and
4. the app does not create a zgaxr account, submit credentials, import zgaxr cookies, or
   receive and store data that zgaxr may collect from a visitor.

This is a defense-in-depth rationale, not a claim that any third-party website is
unconditionally safe. After leaving the app, the user is subject to zgaxr's own content,
privacy practices, and any future site changes. Maintainers should inspect generated
hymnal-data diffs, keep every destination on the exact HTTPS host above, periodically
verify the registration notices and representative hymn pages, and disable the links if
the domain changes ownership, begins redirecting unexpectedly, or no longer serves the
expected hymnal content.

The checked-in mappings and their regeneration scripts are:

- [`features/hymnal/Chinese505Hymnal.ts`](../features/hymnal/Chinese505Hymnal.ts) and
  [`scripts/scrape-chinese-505-hymnal.mjs`](../scripts/scrape-chinese-505-hymnal.mjs);
- [`features/hymnal/Chinese506Hymnal.ts`](../features/hymnal/Chinese506Hymnal.ts) and
  [`scripts/scrape-chinese-506-hymnal.mjs`](../scripts/scrape-chinese-506-hymnal.mjs); and
- [`features/hymnal/Chinese707Hymnal.ts`](../features/hymnal/Chinese707Hymnal.ts) and
  [`scripts/scrape-chinese-707-hymnals.mjs`](../scripts/scrape-chinese-707-hymnals.mjs).

### 506 hymn recordings on YouTube

The 506 hymnal's YouTube button opens that hymn's recording from a
[public YouTube playlist of the 506 hymnal](https://www.youtube.com/playlist?list=PLZpA9AftZl_JIt-MCXSfP364-qR3ddrd3)
that the church recommended. Hymns without a recording yet, and the 505 and 707
hymnals, search YouTube instead. The same limits apply as for zgaxr:

1. the repository stores only the playlist ID and one video ID per hymn number; it does
   not copy, download, or embed the recordings;
2. a video maps to a hymn only when its number and title match the hymnal, or a person
   has compared a differing title with the hymn;
3. the video opens in the YouTube app or browser, under YouTube's terms and the
   uploader's rights; and
4. the External Dependency Monitor checks a mapped video each day and fails when it is
   no longer public.

The mapping is [`features/hymnal/Chinese506YouTube.json`](../features/hymnal/Chinese506YouTube.json),
regenerated with [`scripts/map-chinese-506-youtube.mjs`](../scripts/map-chinese-506-youtube.mjs)
through the YouTube Data API.

---

## Branding & Trademarks

The source code in this repository is licensed under an open-source license, but this
software license does not grant any rights or permissions to use the proprietary branding,
registered trademarks, or official logos contained within the project.

**Unauthorized use of the Seventh-day Adventist® (SDA) Church symbol and related branding
is strictly prohibited.**

Please refer to the [Full Branding Policy](LEGAL_BRANDING.md) for detailed usage
permissions and restrictions.

The app bundles unmodified official YouTube and Spotify icon assets only inside
clickable controls that open the corresponding fixed external URLs. Those assets are
not covered by this repository's software license; their provider brand rules remain
applicable. The Zoom destination currently uses a generic video icon because the
available Zoom terms grant logo rights in narrower partner and SDK contexts. Asset
sources and the implementation restrictions are recorded in
[`assets/images/brand/README.md`](../assets/images/brand/README.md).

---

## Privacy Policy

### 1. Introduction

This application values privacy and uses data minimization. The app does not require a
user account for ordinary use, does not include advertising or analytics, and does not
provide public user profiles, chat, or user-generated posting. Authorized church
schedule managers maintain bulletin information in a restricted staff-managed Google
Sheet outside the app.
Church administrative systems and service providers still process limited information
needed to operate the app, as described below.

### 2. Worship Schedule Information (Google Workspace)

Authorized church schedule managers enter participant names and worship assignments into
a restricted, church-managed Google Sheet. Final owners maintain weekly worship-program
details in the `Sabbath Sermon Data` tab; the source Sheet may record account activity
permitted by the church's Workspace settings.

A Google Apps Script web app reads the requested Sabbath schedule and reviewed sermon data and
returns only an allowlisted bulletin response. Before the response becomes public, the
script shortens Latin-script full names to a first name and last initial. A single-word
Latin-script name may appear as entered, while unsupported non-Latin names are replaced
with a privacy placeholder. Full names, account metadata, and other
non-allowlisted spreadsheet fields are not included in the public API response. The
shortened names may still identify people within the church community and are therefore
treated as personal information rather than anonymous data.

This information is used to communicate worship assignments and weekly program details.
Access to the source Sheets is controlled by the church through Google Workspace, and
source-data retention is governed by the church's administrative practices.

### 3. Temporary Caching and Device Storage

Google Apps Script temporarily caches privacy-filtered bulletin responses to reduce Sheet
reads. The app may store settings, saved verse references, cached Bible selections,
library cover links, and the same filtered bulletin data in device-local storage. This data is not synced to a
church account. Web users can remove the device copy by clearing this site's browser
data; native users can uninstall the app or clear its storage using the operating
system's app settings.

### 4. Hosting and Traffic Services

This app requests Bible text, Bible-audio metadata or files, cover images, and
privacy-filtered bulletin data from external services over HTTPS. GitHub Pages,
Cloudflare, Google Workspace/Apps Script, HelloAO, fetch(bible), Adventist Connect, the
Internet Archive, Audio Power, and the Chinese Union Mission services may process
ordinary connection metadata such as an IP address, user agent, request path, and request
time for delivery, security, or service operations. The app does not receive or store
those providers' server logs. Each provider handles information under its own applicable
terms and privacy policies.

### 5. External Links

This application links to external platforms such as AdventistGiving, YouTube, Spotify,
Zoom, HymnsForWorship.org, zgaxr.com, EGW Writings (egwwritings.org), and Sabbath School
services. The donation button opens AdventistGiving outside the app; payment details and
any donation receipts are handled by that service and the receiving organization, not by
this app. Library screens request current book-cover thumbnails from EGW Writings and,
for Chinese languages, the Chinese Union Mission's cover catalog and image service. When
you follow these links or when those images load, you are subject to the privacy policies
of those third-party providers. These services may collect information such as IP
addresses as part of their standard operations. The church does not receive or store
information those external platforms independently collect from you. When you choose to
share a Bible verse, the selected text is passed to the operating system share sheet and
the app you choose; this app does not receive the recipient's information.

### Device Permissions and Data Requests

The native app uses audio playback, including background playback. It does not request
device location, camera, microphone, contacts, photos, or notifications. Because the app does not create
user accounts or maintain a personal server profile, there is no account to delete. A
user may request correction or removal of church-managed bulletin information by
contacting `pastor@nyccsda.org`. The church will handle requests according to applicable
law and its administrative retention practices.

### 7. Privacy Frameworks and Questions

The project's minimization measures are informed by privacy principles found in laws such
as the CCPA and GDPR, but they do not by themselves guarantee legal compliance. Which laws
apply depends on the deploying organization, its users, and its data practices. This
policy should be updated whenever the app's data practices change.

---

## Legal Disclaimer

### 1. Usage of External Resources

This app links to HymnsForWorship.org and zgaxr.com for hymn resources and to EGW Writings
(egwwritings.org) for externally hosted religious books. Some linked material may be
copyrighted. When you follow these links, you are subject to the destination provider’s
terms and conditions. Please respect copyright laws and do not attempt to bypass access
requirements.

### 2. Data Attribution

This application provides searchable hymn metadata and a curated index of book titles and
language editions to facilitate navigation. It displays small current cover thumbnails
served by EGW Writings and, for Chinese app languages, the Chinese Union Mission; bundled
original artwork remains the fallback. We do not copy these covers into the app or host or
reproduce the externally linked EGW book text, protected musical notation, or lyrics.
External content is accessed through third-party providers; a link, thumbnail, or the
public availability of a destination is not a representation that this project has
independently verified every provider's copyright permissions.

### 3. External Platforms & Services

This application provides links to external platforms and third-party services (e.g.,
YouTube, Spotify, HymnsForWorship.org, zgaxr.com, and EGW Writings at egwwritings.org) to
assist users in locating books, musical performances, recordings, or sheet music. These
are external platforms, and use of them is subject to their respective terms and
conditions. We do not host, curate, or endorse the specific content or search results
returned by these services. Users are responsible for ensuring their use complies with
applicable copyright and performance licensing requirements; linking does not constitute
legal authorization for public performance or reuse.

### 4. Open-Source Software

This application includes the following open-source software, whose licenses require
these notices. The in-app Legal Disclaimer screen shows the same text from
[`constants/OpenSourceNotices.ts`](../constants/OpenSourceNotices.ts).

**[SunCalc](https://github.com/mourner/suncalc)**, which calculates the Sabbath sunset
times and the sunrise/sunset theme:

> Copyright (c) 2026, Volodymyr Agafonkin
> All rights reserved.
>
> Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:
>
> 1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.
>
> 2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.
>
> THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
