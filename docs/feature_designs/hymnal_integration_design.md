# English Hymnal Integration: As-Built Design and Link-Safety Record

Last reviewed: 2026-08-09

## 1. Purpose and Current Decision

The English hymnal feature provides a searchable index of the Seventh-day Adventist
Hymnal (1985 Edition) and sends users to externally hosted sheet music. The app does not
host, proxy, cache, or embed the scores.

For a selected hymn, the app opens this form of URL in the operating system's external
browser:

```text
https://hymnsforworship.org/sdah-214#hymn-score
```

The `#hymn-score` fragment makes the browser scroll directly to the score section. This
removes most of the navigational friction that prompted consideration of raw image links,
while retaining the publisher-facing page, attribution, copyright information, and site
context. If no hymn number is supplied, the app opens the site's 1985 hymnal directory.

This is a risk-reduction decision, not a declaration that the feature is "liability-free"
or that every externally hosted score is licensed for every possible use.

## 2. Source-Site Findings

### 2.1 Operator and provenance

[Hymns for Worship](https://hymnsforworship.org/) is an independent ministry founded by
Irene Bennett. The site's [published biography](https://hymnsforworship.org/about-us/)
describes her as a music educator, pianist, and organist with degrees in Piano Performance
and Music Education, a former college instructor, and a participant in music ministry in
the Philippines. Future documentation should not describe the operator as a college
student or imply that the site is operated by the Seventh-day Adventist denomination.

### 2.2 What the score pages show

The score pages identify authors, composers, and copyright notices for individual hymns.
Examples reviewed on 2026-08-09 include:

- [SDAH 214, "We Have This Hope"](https://hymnsforworship.org/sdah-214-we-have-this-hope/),
  which identifies copyrights held by Wayne Hooper; and
- [SDAH 689, "Day by Day, Dear Lord"](https://hymnsforworship.org/sdah-689-day-day-dear-lord/),
  which states that the music is copyrighted by H.W. Gray Co. and "used by permission."

The corresponding score images say that the notation was prepared by
`hymnsforworship.org` and sourced from the Seventh-day Adventist Hymnal, 1985.

The phrase "used by permission" is evidence that some permission exists somewhere in the
work's publication history. It is not, by itself, proof that:

1. the permission was granted directly to Hymns for Worship rather than to the publisher
   of the 1985 hymnal;
2. it covers publication of the score on the web;
3. it authorizes Hymns for Worship to sublicense the work; or
4. it grants this app permission to copy, embed, or redistribute the score.

Hymns for Worship may possess non-public licenses or correspondence. The public pages
reviewed do not establish their scope, so this project must not represent that publisher
approval has been independently verified.

### 2.3 Published site terms

The site's [Terms of Use](https://hymnsforworship.org/terms-of-use/) reserve its
intellectual-property rights, state that images may not be copied, modified, or
distributed except by permission, and require prior written consent for uses not granted
by the terms. The terms give some downloadable files at least a private, non-commercial
download permission, subject to any file-specific terms. That provision should not be
generalized into permission to reproduce all score images in an app.

A file returning HTTP 200, appearing in a sitemap, or being allowed by `robots.txt` means
that it is technically public. Those facts are not a copyright license or permission to
consume the host's bandwidth through an embedded image.

## 3. Copyright Layers and Evidentiary Limits

A hymnal entry can contain several legally distinct things:

- factual metadata such as a hymn number, author name, year, and scripture reference;
- a short title, which ordinarily receives little or no copyright protection by itself;
- protected lyrics, melody, harmony, or an arrangement;
- a publisher's selection and arrangement of the compilation; and
- Hymns for Worship's own notation, layout, image, or editorial material.

The app stores numbers, titles, and selected scripture references, not lyrics or notation.
This materially reduces risk. Under
[_Feist Publications, Inc. v. Rural Telephone Service Co._](https://supreme.justia.com/cases/federal/us/499/340/),
facts are not protected merely because someone collected them, although an original
selection or arrangement of facts can be. The project's metadata-only approach should
therefore be described as conservative risk reduction, not as a categorical ruling that
every aspect of the dataset is public domain.

Public availability and a copyright notice also do not answer whether the host obtained
permission. The U.S. Copyright Office notes that whether a protected work is being made
available with authority is a question of fact and recommends assuming protection when
clear information is absent. See its
[Fair Use FAQ](https://www.copyright.gov/help/faq/faq-fairuse.html).

## 4. Link and Display Options Considered

| Technique | What the app does | Relative risk | Project decision |
| --- | --- | --- | --- |
| Page link with `#hymn-score` | Opens the source HTML page and scrolls to its score | Lowest of the considered options; preserves context and notices | **Use** |
| Raw-image navigation | Opens a `.png`/`.jpg` URL as the browser's page | Does not require the app to store the image, but bypasses the source page and lacks express site permission | Do not use without written approval |
| Remote-image embedding | Presents the host's image inside the app or an app-controlled page | Adds hotlinking, terms, jurisdictional, attribution, and bandwidth concerns | Do not use |
| Proxying, caching, or hosting | Makes and serves a project-controlled copy | Directly implicates reproduction and distribution rights | Prohibited without a reviewed license |

### 4.1 Why a hyperlink is not treated like a hosted copy

In [_Hunley v. Instagram_](https://cdn.ca9.uscourts.gov/datastore/opinions/2023/07/17/22-15293.pdf),
the U.S. Court of Appeals for the Ninth Circuit reaffirmed the "server test" from
_Perfect 10 v. Amazon_: directing a browser to retrieve an image stored on somebody
else's server did not itself constitute direct infringement of the display right in that
jurisdiction. The opinion also records that some courts outside the Ninth Circuit have
rejected or limited that reasoning. It therefore does not support a nationwide,
categorical statement that all hyperlinking or embedding is noninfringing.

A normal external navigation link is more conservative than embedding because the user
leaves the app and views the host's own resource. Nevertheless, secondary-liability,
contract, access-control, and jurisdiction-specific questions may remain if a developer
knowingly points users to infringing material or bypasses restrictions.

Section 512(d) of the Digital Millennium Copyright Act contains a conditional safe harbor
for qualifying services that use information-location tools such as hyperlinks. It has
knowledge, financial-benefit, notice, and other compliance conditions and is not an
automatic license. See the U.S. Copyright Office's
[DMCA summary](https://www.copyright.gov/legislation/dmca.pdf).

### 4.2 Why the fragment link was selected

Representative pages for hymns 1, 214, and 689 were checked and each exposed a public
element named `hymn-score`. A URL fragment is handled by the browser after loading the
page; it does not request, copy, alter, or bypass access controls on the score. It gives
users a focused starting position while retaining the page that the site owner chose to
publish.

## 5. As-Built Technical Architecture

### 5.1 Metadata and search

`constants/EnglishHymnal.ts` stores the English hymn metadata as a
`Record<number, HymnEntry>`. `getSortedHymns` hydrates and sorts that record for the
reader and unified search. Search supports hymn numbers, titles, and scripture
references. The app also provides YouTube discovery and Bible-reader navigation without
storing third-party media.

### 5.2 External routing

`getEnglishHymnUrl` owns URL construction and is intentionally testable without opening a
browser. It:

1. pads numeric IDs to three digits;
2. appends `#hymn-score` for a selected hymn; and
3. returns the official directory when no number is supplied.

`openHymnal` passes that URL to the shared external-link handler. Links must continue to
open in the native browser. Do not replace this handoff with an iframe, WebView, remote
`Image`, server-side proxy, service-worker cache, or downloaded local asset.

### 5.3 Reader state

The English hymnal reader retains its search state while the user visits the external
page and returns. This preserves the user's place without importing the external content
into the app.

## 6. Maintenance Rules

When changing this integration:

1. Keep selected-hymn destinations on the HTTPS `hymnsforworship.org` HTML origin and
   retain `#hymn-score`.
2. Do not derive or check in raw score-image URLs.
3. Do not download, cache, screenshot, transcode, proxy, or redistribute scores.
4. Do not state that Hymns for Worship or this app has publisher permission unless the
   applicable written grant has been reviewed and its scope documented.
5. Recheck representative public-domain and copyrighted hymn pages, the score anchor,
   redirects, and the site's Terms of Use periodically.
6. Remove or disable a link promptly if a rights holder or the source site objects, the
   domain changes ownership, the destination begins redirecting unexpectedly, or the
   expected source page disappears.
7. Treat any future in-app score viewer as a new legal and architectural decision, not a
   cosmetic refactor.

The focused URL tests live in `test/english-hymnal.test.ts` and should cover both padded
hymn links and the no-number directory fallback.

## 7. Path to a Raw-Image Experience

If a future maintainer still wants raw-image navigation, the clean path is written
permission rather than reliance on a "loophole." Ask Hymns for Worship to authorize this
specific app to deep-link to its raw score images and to confirm that its underlying
rights permit that use for copyrighted hymns. Preserve the correspondence and any
conditions in the project's private organizational records; do not commit private contact
information or confidential agreements to this public repository.

Even with permission, prefer external-browser navigation, retain a visible source and
copyright link in the app, avoid caching, and provide a working takedown contact. A
license from the site owner only covers rights the site owner actually controls.

## 8. Scope of This Record

This document records the engineering decision and the public evidence reviewed as of the
date above. It is not legal advice, a legal opinion, or a guarantee that the source site,
its terms, ownership, or permissions will remain unchanged.
