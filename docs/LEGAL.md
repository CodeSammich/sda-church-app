# Legal, Licensing, and Privacy

Last reviewed: 2026-08-09

This document centralizes the project's licensing records, third-party source reviews,
privacy disclosures, branding restrictions, and legal disclaimer. It records engineering
decisions and public evidence; it is not legal advice or a guarantee that third-party
terms, ownership, or permissions will remain unchanged.

## Contents

- [Bible Sources and Licensing](#bible-sources-and-licensing)
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
church's copies on Adventist Connect, with Audio Power and Internet Archive copies as
playback fallbacks; the repository does not bundle the recordings. Audio Power's owner,
Phil, explicitly approved the church app's use, download, and self-hosting of these recordings in
[issue #134](https://github.com/New-York-Chinese-Seventh-day-Adventist/sda-church-app/issues/134#issuecomment-5274730608).

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
[`public/brand/README.md`](../public/brand/README.md).

---

## Privacy Policy

### 1. Introduction

This application values privacy and uses data minimization. The app does not require a
user account for ordinary use, does not include advertising or analytics, and does not
provide public user profiles, chat, or user-generated posting. Authorized church
contributors may submit bulletin information through linked Google Forms outside the app.
Church administrative systems and service providers still process limited information
needed to operate the app, as described below.

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
reads. The app may store settings, saved verse references, cached Bible selections, and
the same filtered bulletin data in device-local storage. This data is not synced to a
church account. Web users can remove the device copy by clearing this site's browser
data; native users can uninstall the app or clear its storage using the operating
system's app settings.

### 4. Hosting and Traffic Services

This app requests Bible text, Bible-audio metadata or files, sunset times, cover images,
and privacy-filtered bulletin data from external services over HTTPS. GitHub Pages,
Cloudflare, Google Workspace/Apps Script, HelloAO, fetch(bible), Audio Power, Adventist
Connect, the Chinese Union Mission services, and the sunrise-sunset service may process
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

The native app uses audio playback, including background playback, and may read the
device light sensor to adjust its theme locally. It does not request device location,
camera, microphone, contacts, photos, or notifications. Because the app does not create
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
