# Bulletin Apps Script API

This directory stores the Google Apps Script source used by the bulletin PWA. It is not
part of the public Expo bundle.

## Contents

- [Why this stack](#why-this-stack-the-sustainable-tenet)
- [Architecture](#architecture)
- [Workbook and form layout](#workbook-and-form-layout)
- [Annual schedule rollover](#annual-schedule-rollover)
- [Structural sheet protection](#structural-sheet-protection)
- [Name privacy](#name-privacy)
- [Physical Google Doc output](#physical-google-doc-output)
- [PWA presentation](#pwa-presentation)
- [Failure behavior](#failure-behavior-and-troubleshooting)
- [Change management](#change-management-checklist)
- [Production integration monitoring](#production-integration-monitoring)
- [Deployment](#deploy)
- [Automated deployment from WSL or GitHub Actions](#automated-deployment-from-wsl-or-github-actions)
- [Google for Nonprofits](#google-for-nonprofits)
- [Example API response](#example-api-response)

## Why this stack: the Sustainable tenet

This feature deliberately follows the project's
[Sustainable/no-fee tenet](../README.md#1-sustainable). The church already uses Google
Workspace through Google for Nonprofits, and the PWA is hosted as static files on GitHub
Pages. Using Google Sheets, Google Forms, and a bound Google Apps Script web app lets the
bulletin operate without introducing a separately billed database, application server,
API gateway, secret-management service, or user-authentication product.

Each part has one narrow responsibility:

| Component | Responsibility | Why it fits the tenet |
| --- | --- | --- |
| GitHub Pages PWA | Presents the bulletin and makes read-only HTTP requests | Static hosting; no application server to operate |
| Google Forms | Gives authorized church workers a familiar way to submit worship content | No custom administrative UI to build or host |
| Google Sheets | Stores yearly rosters and the two form-response tables | Existing church workflow remains the source of truth |
| Google Apps Script | Joins data for the public API and, for authorized staff triggers, renders the Queens or Brooklyn printed bulletin to Docs/PDF | Runs beside the spreadsheet without a separate backend account |
| Google Workspace for Nonprofits | Provides church-domain ownership, collaboration, Forms, Sheets, Drive, and administration | Eligible organizations can use the nonprofit Workspace offer instead of volunteer-owned consumer accounts |

This is best described as **no additional application-hosting fee within the programs and
allowances already used by the church**, not a guarantee that every surrounding cost is
forever zero. Domain registration, optional Workspace upgrades, future Google/GitHub
policy changes, and usage beyond service limits may affect cost or availability. Check
the current [Google Workspace for Nonprofits offer](https://www.google.com/nonprofits/offerings/workspace/)
and [Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas)
during annual maintenance.

### Why the PWA does not read Sheets directly

A browser-side Sheets integration would require exposing a public data surface or adding
Google OAuth/API configuration to the PWA. It would also make every device download and
join the yearly roster plus both form-response datasets. The Apps Script boundary keeps
Google authorization on the server side, performs one date-specific join, and returns a
small allowlisted object. No credential, API key, spreadsheet ID, or form-response email
address is shipped in the PWA bundle or API response.

## Architecture

The bulletin uses Google Apps Script as a small read-only API between the public PWA and
the private working spreadsheet:

```text
Public PWA
   |
   | GET /exec?date=YYYY-MM-DD
   v
Apps Script web app (BulletinApi.gs, executes as the deploying account)
   |
   +--> Script cache -------- two-minute privacy-filtered response cache
   |
   +--> YYYY Sabbath -------- roster and schedule assignments
   |
   +--> Queens Worship Data - all matching Queens form responses
   |
   +--> Brooklyn Worship Data - all matching Brooklyn form responses
   |
   v
Allowlisted, privacy-filtered JSON
   |
   v
Bulletin screen
   |
   +--> device local storage - bulletin + successful-fetch time per date
```

The same project has a separate staff-triggered path:

```text
Queens or Brooklyn Google Form
   |
   v
Matching worship-data response tab
   |
   | spreadsheet On form submit trigger
   v
PrintedQueensBulletin.gs + PrintedQueensCommunionBulletin.gs + PrintedBrooklynBulletin.gs
  --> one location-specific Google Doc + one PDF per Sabbath date
```

The browser never reads Google Sheets directly and receives no spreadsheet ID, Google
credentials, OAuth token, form-response email address, timestamp, or full roster last
name. Apps Script performs the join server-side and exposes only the JSON fields defined
in `COLUMN_SCHEMA` and `FORM_RESPONSE_SCHEMA`.

### Request lifecycle

1. The PWA chooses a bulletin date. It first checks the device's local cache. A cached
   future bulletin remains usable until that Sabbath begins; a bulletin fetched before
   its own Sabbath becomes stale at local midnight on that Sabbath.
2. When data is absent or stale, the PWA requests `/exec?date=YYYY-MM-DD`.
3. Apps Script checks a two-minute script-wide cache containing only the already
   allowlisted, privacy-filtered bulletin JSON. A hit avoids reading and joining Sheets.
4. On a cache miss, Apps Script validates the date and derives the `YYYY Sabbath` tab name. Non-Sabbath
   tabs are never queried.
5. The matching schedule row supplies metadata and Queens/Brooklyn assignments.
6. Each worship-data tab is independently filtered to the same date. All matching form
   submissions are merged field by field. Blank answers do not erase an earlier answer;
   when multiple nonblank answers conflict, the latest `Timestamp` wins.
7. Person-valued schedule fields are reduced to `First L.`; `Choir` is retained.
8. Only allowlisted worship content is copied from the form rows. `Email Address` and
   other form metadata cannot enter the response object.
9. Apps Script caches and serializes the result as JSON. The PWA stores the successful
   result and fetch time locally for later visits.

### Ownership and trust boundaries

- The schedule, response tabs, and bound Apps Script project remain in the church's
  Google Workspace account.
- Human collaborators may view the response tabs. Protecting those tabs is recommended
  to prevent accidental edits, but sheet protection is not a confidentiality boundary.
- The deployed `/exec` endpoint is public because an unauthenticated PWA must be able to
  fetch it. Therefore every value returned by `BulletinApi.gs` must be treated as public.
- The PWA is read-only. It does not submit changes to the spreadsheet through this API.
- `BulletinApi.gs` in this repository is the canonical source. Changes copied into Apps Script
  should be reviewed here first so the deployed version and repository do not drift.

### Repository source map

| File | Role |
| --- | --- |
| `google-apps-script/BulletinApi.gs` | Deployed backend logic, allowlists, date matching, and name privacy |
| `google-apps-script/PrintedQueensBulletin.gs` | Shared data preparation, stable Queens regular renderer, and common Google Docs helpers |
| `google-apps-script/PrintedQueensCommunionBulletin.gs` | Communion page order and fixed foot-washing/Communion Scripture references |
| `google-apps-script/PrintedBrooklynBulletin.gs` | Brooklyn-specific cover presentation and location copy |
| `google-apps-script/appsscript.json` | Apps Script runtime, timezone, and web-app manifest settings |
| `constants/ExternalLinks.ts` | Production `/exec` URL and restricted staff-schedule URL |
| `services/BulletinService.ts` | PWA response types, upcoming-Sabbath calculation, fetching, device cache, persisted refresh cooldown, and empty-location detection |
| `services/BulletinHymnalService.ts` | Number-first bulletin hymn resolution, English/Chinese edition detection, fuzzy title fallback, and cross-reference routing |
| `features/hymnal/BulletinHymnalConfig.ts` | Church-level primary English/Chinese hymnal selection and displayed edition metadata |
| `features/hymnal/HymnalNumberMappings.json` | Reviewed bidirectional English 1985 ↔ Chinese 505 hymn-number cross-references |
| `app/(tabs)/home/bulletin.tsx` | Localized This Week/Next Week UI, location cards, `TBD` rendering, and staff link |
| `test/bulletin-service.test.ts` | PWA date, API error, and possible-joint-service behavior |
| `test/bulletin-hymnal-service.test.ts` | Bulletin hymn typo tolerance, language preference, mapping, and fallback behavior |
| `test/bible-scripture-reference.test.ts` | Multilingual 66-book parsing, formatting, ranges, and safe rejection behavior |
| `google-apps-script/README.md` | Architecture contract and operator runbook |

The Queens worship program also renders three fixed congregational pieces directly in
the PWA: Doxology (SDAH 694 / Chinese 497), Pastoral Prayer response (SDAH 684 /
Chinese 498), and Postlude (SDAH 690 / Chinese 504). They are not workbook fields.
Their score buttons use the same language-aware exact hymn routing as submitted hymns.
The person assigned to Chair / Pastoral Prayer remains workbook-driven roster data.

## Workbook and form layout

The script is intended to be bound to **Official Schedule for NYCCSDA Queens and
Brooklyn**. Every requested date is looked up in the single `Sabbath Calendar` tab.
There is no annual Apps Script rollover or yearly tab rename.

Tabs such as `2026 Non-Sabbath` are intentionally ignored by the bulletin API.

The workbook is organized as follows:

```text
Official Schedule for NYCCSDA Queens and Brooklyn
├── Queens Worship Data       linked Queens Google Form responses
├── Brooklyn Worship Data     linked Brooklyn Google Form responses
├── Name Dictionary            English/Chinese name pairs for physical printing
├── Sabbath Calendar          all Sabbath roster and schedule rows
├── 2026 Non-Sabbath          ignored by this API
└── ...
```

`Queens Worship Data` and `Brooklyn Worship Data` are sheet-tab names. The purple
`Form_Responses` and `Form_Responses2` labels visible inside Google Sheets are table names,
not tab names, and Apps Script does not address them.

### Automatic schedule maintenance

`BulletinScheduleMaintenance.gs` keeps the `Sabbath Calendar` usable without deleting
historical planning data. The existing bound `onOpen` trigger runs this quietly for
every user who can open the spreadsheet; no email allowlist or setup action is needed.
Each sheet open will:

- keep the current calendar quarter visible;
- keep the immediately preceding seven days visible at a quarter boundary;
- hide older dated rows instead of deleting them; and
- during the final 21 days of a quarter, append every missing Saturday in the
  immediately following quarter with blank assignment cells and the matching
  quarter value. If that quarter is already complete, the script waits until the
  next quarter boundary rather than pre-populating a later quarter.

The operation is idempotent: it compares dates before appending, so repeated opens do
not create duplicate rows. The only visible **Printed Bulletin** menu action remains
the Google Doc/PDF workflow; schedule maintenance is intentionally background-only.

The schedule header row must use this order (the repeated headers are intentional):

```text
Date | Quarter | Special Remark | Tithe Purpose | Pastor Travel | Announcements | Sunset Time |
Queens Sermon | Translation | Chinese Teacher | English Teacher |
Children Teacher | Chair/Pastoral Prayer | Special Music |
Offering Prayer | Pianist | SS Chair | SS Opening Prayer | Closing Prayer |
Flower Offering |
Brooklyn Sermon | Chair/Pastoral Prayer | Offering Prayer | Sabbath School
```

### Yearly schedule column contract

`COLUMN_SCHEMA` in `BulletinApi.gs` is an explicit allowlist. Columns must remain in the order
below because the two repeated headers are disambiguated by occurrence: the first
`Chair/Pastoral Prayer` and `Offering Prayer` belong to Queens; the second pair belongs to
Brooklyn.

| Sheet header | Occurrence | JSON destination | Handling |
| --- | ---: | --- | --- |
| `Date` | 1 | `bulletin.date` | Request key; accepts the displayed `M/D/YYYY` sheet date |
| `Quarter` | 1 | `bulletin.quarter` | Public metadata |
| `Special Remark` | 1 | `bulletin.specialRemark` | Public metadata; displayed prominently for both churches |
| `Tithe Purpose` | 1 | `bulletin.tithePurpose` | Public metadata |
| `Pastor Travel` | 1 | `bulletin.pastorTravel` | Public metadata |
| `Announcements` | 1 | `bulletin.announcements` | Optional multiline back-page announcement text |
| `Sunset Time` | 1 | `bulletin.sunsetTime` | Optional current/next Sabbath schedule value |
| `Queens Sermon` | 1 | `bulletin.queens.sermon` | Person-name privacy filter |
| `Translation` | 1 | `bulletin.queens.translation` | Person-name privacy filter |
| `Chinese Teacher` | 1 | `bulletin.queens.chineseTeacher` | Person-name privacy filter |
| `English Teacher` | 1 | `bulletin.queens.englishTeacher` | Person-name privacy filter |
| `Children Teacher` | 1 | `bulletin.queens.childrenTeacher` | Person-name privacy filter |
| `Chair/Pastoral Prayer` | 1 | `bulletin.queens.chairPastoralPrayer` | Person-name privacy filter |
| `Special Music` | 1 | `bulletin.queens.specialMusic` | Person-name privacy filter; exact `Choir` is preserved |
| `Offering Prayer` | 1 | `bulletin.queens.offeringPrayer` | Person-name privacy filter |
| `Pianist` | 1 | `bulletin.queens.pianist` | Person-name privacy filter |
| `SS Chair` | 1 | `bulletin.queens.ssChair` | Person-name privacy filter |
| `SS Opening Prayer` | 1 | `bulletin.queens.ssOpeningPrayer` | Person-name privacy filter |
| `Closing Prayer` | 1 | `bulletin.queens.closingPrayer` | Person-name privacy filter |
| `Flower Offering` | 1 | `bulletin.queens.flowerOffering` | Person-name privacy filter |
| `Brooklyn Sermon` | 1 | `bulletin.brooklyn.sermon` | Person-name privacy filter |
| `Chair/Pastoral Prayer` | 2 | `bulletin.brooklyn.chairPastoralPrayer` | Person-name privacy filter |
| `Offering Prayer` | 2 | `bulletin.brooklyn.offeringPrayer` | Person-name privacy filter |
| `Sabbath School` | 1 | `bulletin.brooklyn.sabbathSchool` | Person-name privacy filter |

Blank schedule cells become empty strings in JSON and `TBD` in the PWA. Columns outside
this allowlist are not copied to the response.

### Google Forms and response-tab contract

Queens and Brooklyn use separate Google Forms because each congregation submits its own
worship content. The forms use the same questions and write to their corresponding tabs:

| Form / response tab | `CONFIG.responseSheets` key | JSON location |
| --- | --- | --- |
| Queens form → `Queens Worship Data` | `queens` | `bulletin.queens` |
| Brooklyn form → `Brooklyn Worship Data` | `brooklyn` | `bulletin.brooklyn` |

The response headers may include Chinese text after the English question on a new line.
`findFirstHeaderIndex_` normalizes whitespace and matches the English prefix. This permits
the existing bilingual labels, but the English question prefix is an API contract: do not
rename it without updating `FORM_RESPONSE_SCHEMA`, tests, and this table.

| Google Form response column / English question prefix | Code use | JSON destination |
| --- | --- | --- |
| `Timestamp` | Sort matching responses; newest nonblank answer wins per field | Not returned |
| `Email Address` | None | Never returned |
| `What date is this Sabbath?` | Match the requested bulletin date | Not returned separately |
| `What is the English name and number for the Hymn of Praise this week?` | Allowlisted worship content | `location.hymnOfPraise.english` |
| `What is the Chinese name and number for the Hymn of Praise this week?` | Allowlisted worship content | `location.hymnOfPraise.chinese` |
| `What is the sermon title in English?` | Allowlisted worship content | `location.sermonTitle.english` |
| `What is the sermon title in Chinese?` | Allowlisted worship content | `location.sermonTitle.chinese` |
| `What is the Hymn of Response in English?` | Allowlisted worship content | `location.hymnOfResponse.english` |
| `What is the Hymn of Response in Chinese?` | Allowlisted worship content | `location.hymnOfResponse.chinese` |
| `What are the Bible verses for this week?` or `What verse should appear at the bottom of Church at Study?` | Allowlisted worship content | `location.bibleVerses` |

Operational rules for the forms:

- Keep both forms' English question prefixes identical to the table above.
- Let Forms append response rows; do not sort or restructure the response headers manually.
- Multiple people may submit different answers for the same Sabbath. All nonblank answers
  are merged into that location's bulletin.
- A corrected answer for the same Sabbath is supported: when two nonblank answers target
  the same field, the answer from the latest `Timestamp` replaces the earlier answer.
- A blank answer in a later submission does not erase an earlier nonblank answer.
- If no response matches, roster data still loads and worship-content fields remain blank,
  which the PWA displays as `TBD`.
- Adding an unrelated question does not expose it. New content remains unavailable to the
  PWA until it is deliberately added to `FORM_RESPONSE_SCHEMA` and the TypeScript/UI schema.
- `Email Address` remains stored in the protected church workbook even though it is never
  sent to the public API. Spreadsheet access must therefore remain limited to trusted
  collaborators under the church's Workspace policies.

## Annual schedule rollover

Keep one `Sabbath Calendar` tab for all years. Add future Sabbath rows to that tab while
retaining its formatting, formulas, and data validation.

Recommended rollover procedure:

1. Add the next year's Sabbath dates and quarter values to `Sabbath Calendar`.
2. Confirm that every required header remains in the documented order. The repeated
   `Chair/Pastoral Prayer` and `Offering Prayer` headers must remain repeated and in their
   original Queens/Brooklyn positions.
5. Reapply and verify the structural protections described below. Do not assume duplicated
   protection settings are correct.
6. Test at least the first Sabbath with the production API before the new year begins:

   ```text
   /exec?date=2027-01-02
   ```

   The response must contain `"ok":true` and data from the matching row in
   `Sabbath Calendar`.

Non-Sabbath tabs may remain in the workbook, but the bulletin API intentionally ignores
them.

## Structural sheet protection

Protect the following schedule structures from routine roster editing:

- the complete header row;
- the entire `Date` column; and
- the entire `Quarter` column.

These cells control API routing and field mapping. Renaming, reordering, deleting, or
accidentally overwriting them can make an otherwise valid bulletin unavailable or map a
person to the wrong role.

For the official NYCCSDA deployment, protected-range editing must be restricted to the
Google Workspace group **technology@nyccsda.org**. Membership in that group is reserved
for developers responsible for the PWA/mobile app. Ordinary schedule editors may edit the
unprotected assignment and remark cells but should not be able to alter the protected API
structure.

In Google Sheets, use **Data → Protect sheets and ranges**, choose **Restrict who can edit
this range**, and grant the technology group access to each protected structure. Review
group membership when developers join or leave, and keep at least two current maintainers
in the group so maintenance does not depend on one person.

Protection prevents accidental or unauthorized edits within the shared workbook; it does
not hide data from people who can view the spreadsheet. This is intentional for the
official church workflow. A fork or independently deployed copy must replace
`technology@nyccsda.org` with its own developer/administrator group and document that local
ownership policy rather than requesting access to the NYCCSDA group.

If a fork uses different sheet-tab names, update `CONFIG.responseSheets` in `BulletinApi.gs` and
the local documentation together.

## Name privacy

Every person-valued field is transformed by the API before it leaves Apps Script:

- `Jane Smith` becomes `Jane S.`
- `Jane Smith / John Doe` becomes `Jane S. / John D.`
- `Choir` remains `Choir`
- A Chinese name such as `王小明`, or any other non-Latin name, becomes
  `Name withheld`.
- A single-token Latin name is treated as a first name and preserved: `Meihong` remains
  `Meihong`.

The full names are never included in the JSON response. The metadata fields `Quarter`,
`Special Remark`, `Tithe Purpose`, and `Pastor Travel` are not treated as person names.
Hymn names, sermon titles, and Bible verses are also preserved as entered because they
are content rather than roster names.

A first name and last initial may still identify someone within a church community. This
transformation is a data-minimization and public-disclosure safeguard, not anonymization
or a guarantee of compliance with any particular privacy law. The deploying church
remains responsible for access, notice, retention, correction, and removal practices for
the restricted source data.

The API intentionally does not transliterate non-Latin names. Transliteration can be
ambiguous and could disclose a complete identity. The PWA may translate the
`Name withheld` placeholder for display, but it must not attempt to reconstruct the
original name.

Additional value rules:

- Hyphenated Latin first names are preserved: `Mary-Jane Smith` becomes `Mary-Jane S.`.
- Blank roster cells return `""`; the PWA displays **TBD**.
- Blank worship-content cells return `""`; the PWA displays **TBD**.
- If no form response matches a date, the location's worship-content fields remain blank
  while its schedule assignments can still be displayed.
- A missing schedule row in `Sabbath Calendar` is a request error because the bulletin has
  no canonical roster record for that date.

## Physical Google Doc output

`PrintedQueensBulletin.gs`, `PrintedQueensCommunionBulletin.gs`, and
`PrintedBrooklynBulletin.gs` are additional source files in the **same spreadsheet-bound Apps
Script project** as `BulletinApi.gs`; it is not a second backend or deployment. It reads the
spreadsheet directly through the shared `buildBulletin_` function with full names enabled.
The public `doGet` path continues to use the privacy-filtered default, so full names never
enter the public JSON API.

After saving both files in the bound Apps Script project, reload the spreadsheet and use
**Printed Bulletin → Create Google Doc + PDF…**. The bilingual dialog provides buttons for
Queens/Brooklyn and regular/communion format selection, defaulting to Regular. The dialog
first links to the Queens/Brooklyn digital-bulletin intake Forms so an administrator can fill
one in on behalf of a speaker if the current week is missing. It then preloads the matching
Form verse when available. An administrator can edit that verse for the printed bulletin only.
Choose the optional Bible book and chapter from dropdowns, then type a verse or range such as
`11` or `11-15`. Choose BSB or KJV for English. Chinese text is fixed to
CUV（和合本, Traditional Chinese） for now. The
reference is looked up through the HelloAO API
and printed only under Church at Study. Church at Worship
does not receive a duplicate verse box. Longer selections show an English/Traditional
Chinese warning before generation. The function creates or updates the Google Doc for that
date and also creates or replaces a PDF export for printing. It returns the URLs for both.
It requires the staff member running it to authorize Google Docs and Drive access; the
function is never called by the anonymous web-app endpoint.

### Setup actions and normal workflow

The Sheets menu intentionally exposes only **Printed Bulletin → Create Google Doc + PDF…**.
The one-time configuration actions—installing the form-submit trigger and adding the
Bible-verse question to both Forms—are not shown to any user, including admins.
They remain in the source only for deliberate maintenance or migration work and are
protected by the `PHYSICAL_BULLETIN_ADMIN_EMAILS` Script Property if they ever need to
be run directly from the Apps Script editor. Normal bulletin generation, including
printed-only verse and announcement edits, uses the Sheet's existing access controls
and does not require that maintenance property.

In the normal workflow, the existing trigger identifies whether a submission came from
Queens or Brooklyn, merges submissions by Sabbath date, and creates or updates the
matching document/PDF. The Bible-verse question should be added to both Forms once
during setup with `addBibleVerseQuestions()`; each response is merged by Sabbath date like the other form fields. A
reference such as `John 12:24` or `Psalm 119:103` is looked up through the BSB/CUV
HelloAO API and printed in a borderless bilingual box under Church at Study.

Multiple submissions and corrections for one location/date update the same document,
identified by private Script Properties, instead of creating duplicates. A Queens trigger
installed by an older version continues to work because the legacy handler name is
retained.

The generated document uses landscape US Letter pages with two vertical panels per sheet.
Queens regular bulletins use four panels—announcements/schedule, cover, church at study,
and church at worship. That renderer remains the stable reference path. Communion page
order and Brooklyn cover copy live in their own `.gs` files: Brooklyn regular bulletins
use four panels—Sabbath School, worship, the meetings schedule, and the fellowship
cover/contact block; Communion adds four ceremony panels to the selected location's
regular layout.

The communion PDF is booklet-imposed rather than simple reading order. From the first PDF
page to the last, the landscape faces are: `(back/announcements | cover)`,
`(church at study | closing)`, `(Holy Communion—continued | church at worship)`, and
`(foot washing | Holy Communion)`. The opening Communion actions appear on the final
right-hand panel, and the remaining actions continue on the preceding left-hand panel
when the booklet is folded. Print duplex and fold at the center; the folded reading
order is cover, study, worship, foot washing, Holy Communion, Holy Communion—continued,
closing, and back/announcements.

The Queens template uses English and Traditional Chinese labels. The Brooklyn template
follows the supplied two-page landscape reference: Sabbath School, worship, the rotating
Today/Next Sabbath names table, online study times, and the fellowship contact/cover block.
The long `TESTIMONIES OF SABBATH` reading is intentionally omitted; the `Testimonies` row
in the rotating names table remains. Bilingual hymns and sermon titles are printed on
separate Chinese/English lines in three-column service tables (item, details/hymn, and
person), while names and other submitted Chinese content remain exactly as entered in the
Forms/Sheets data. These service tables are borderless; the back-page meeting schedule is
the only table with a visible black border. The Bible-reading table and QR placeholders
are borderless. Missing Chinese/English offering text is shown with an em dash so the two
language rows stay aligned.

The regular Queens and Brooklyn covers use `churchsketch.png`; communion covers use
`lastsupper.png`. The current file IDs are configured as defaults in `PrintedQueensBulletin.gs`.
The Communion Scripture references are fixed in `PrintedQueensCommunionBulletin.gs`, so the selected
Church-at-Study verse cannot replace the bread, cup, proclamation, or foot-washing
references. Brooklyn cover title/address copy is isolated in `PrintedBrooklynBulletin.gs`.
If either image is replaced, set these Script Properties to the new Drive file IDs:
`CHURCH_SKETCH_IMAGE_FILE_ID` and `LAST_SUPPER_IMAGE_FILE_ID`. The cover also supports the
black SDA logo through `SDA_LOGO_IMAGE_FILE_ID`. The files only need to be accessible to
the account running the trigger; they do not need to be public. If an image is unavailable,
the generated cover uses a text fallback and the rest of the layout is unchanged.

Physical person names are enriched from the `Name Dictionary` sheet when it exists. The
header row is `English Name | Chinese Name`, and data begins on row 2. A matched name
prints the Chinese line followed by the English line; if either side is missing or
unmatched, only the source name is printed.
This lookup is used only by the private physical generator and is never added to the
public API response.

For a folded handout, print landscape, double-sided, with the printer set to flip on the
short edge, then fold at the center. The generator currently includes the fields already
available to the digital bulletin: schedule assignments, hymns, sermon title/speaker,
Bible references, offering purpose, and special remark. The Bible reference answer may be
entered as `Book Chapter:verse-range` (for example, `Jeremiah 29:11-15`; the shorthand
`Jeremiah:29:11-15` is also accepted). The physical generator uses the reference to
retrieve the English BSB and Traditional Chinese 和合本 text from the HelloAO Bible API,
prints the English and Chinese book names with the selected translation labels, and flows
each language's passage as one paragraph. Before asking for confirmation, the popup fetches
the selected passage and measures the English text; it warns when the passage is over roughly
180 words or 1,000 characters, or is a full chapter. If the lookup is unavailable, it falls
back to warning at nine or more verses. If the reference cannot be parsed or the API is
unavailable during generation, the reference itself is retained instead.
For the meeting schedule's offering-purpose value only, an English-only entry is translated
with Apps Script `LanguageApp` into Traditional Chinese (`zh-TW`); existing Chinese or
bilingual text is left alone. If the translation service fails or reaches its quota, the
missing language is shown as `—` so the rows remain aligned.
For the long text shown above the back-page schedule in the reference bulletin, add an
`Announcements` column to `Sabbath Calendar` or an `Announcements`/`Announcement`
form question. Its multiline text is printed before the back-page schedule.

Announcements are intentionally a printed/admin feature rather than a normal mobile
bulletin section. Their content and formatting are fluid, and the congregation already
hears them in person and on the livestream. The mobile client may eventually support an
explicitly curated short summary, but it must not automatically mirror arbitrary printed
announcement text.

The planned printed workflow should let an administrator add a repeatable list of
announcement entries for a Sabbath instead of forcing several announcements into one
cell. Each entry should have optional English and Traditional Chinese text, and the
interface should provide an **Add announcement** button plus a remove button. The saved
entries should preserve their order and be rendered as a single human-approved block
above the back-page schedule. This workflow is separate from the speaker form; the
generated Google Doc/PDF remains output rather than the source of truth.

The same printed-only property store keeps an optional Bible-reference override per
Sabbath and location. The digital bulletin continues to use the Form response; the
printed generator uses the saved override only when an administrator has deliberately
changed it.

Because these are small, printed-only admin overrides, the implementation stores the
ordered entries in Apps Script `PropertiesService`, keyed by Sabbath date, instead of
adding another visible spreadsheet tab. Each entry carries its location scope. The editor
enforces the property-size limit, uses a script-wide property store so all authorized
administrators see the same content, and uses a script lock when saving. Browser storage
and `CacheService` may preserve an unfinished draft or speed up a read, but neither is a
durable source of bulletin content.

The back/announcements panel includes the standing offering notice, donor-advised-fund/Zelle/
AdventistGiving note, DAF EIN `11-3004814`, Zelle destination `zelle@nyccsda.org`, and
horizontal QR-code placeholders for AdventistGiving and Zelle. The mobile-app QR placeholder
is on the front cover, while the DAF note follows the back-page QR codes. The church is set up
with Fidelity Charitable; staff should be contacted in advance for Schwab Charitable, Vanguard
Charitable, or another provider.
All three slots currently use the shared dummy QR image in the configuration so the layout can
be reviewed before the final destinations are ready. Replace the slot-specific values by setting
`ADVENTIST_GIVING_QR_IMAGE_FILE_ID`, `ZELLE_QR_IMAGE_FILE_ID`, and
`MOBILE_APP_QR_IMAGE_FILE_ID` Script Properties. If a slot-specific property is absent, the
dummy image remains in place. Sunset times in the printed meeting schedule are fetched for the current
and next Sabbath from the same `api.sunrise-sunset.org` endpoint used by the app. The camp-meeting announcement is not
included in the generated standing note.

### Generate a QR image

The repository includes a one-time QR generator. It creates a local PNG only; it does
not upload files to Drive or require any Google credential:

```sh
npm run generate:qr
```

The default output is `build/qr/adventistgiving.png`, encoding
`https://adventistgiving.org/donate/AN48CO`. Inspect the PNG, upload it manually to the
shared Drive assets folder, copy its Drive file ID, and add that ID as the
`ADVENTIST_GIVING_QR_IMAGE_FILE_ID` Script Property. The Apps Script account must be able
to read the file; it does not need to be public. The same generator accepts another
HTTPS destination with `node scripts/generate-qr.mjs --url URL --output build/qr/name.png`.

For a remote one-time run, open **Actions → Generate physical bulletin QR code → Run
workflow**. Download the resulting `physical-bulletin-qr` artifact and upload the PNG to
Drive manually. The workflow intentionally has no Drive-upload step, so the GitHub
Actions credentials cannot write arbitrary files into the church’s shared drive.

Generated Queens documents default to the Queens output folder and Brooklyn documents
default to the Brooklyn output folder configured in `PrintedQueensBulletin.gs`. To override
them, set `PHYSICAL_BULLETIN_QUEENS_FOLDER_ID` or
`PHYSICAL_BULLETIN_BROOKLYN_FOLDER_ID`; the legacy `PHYSICAL_BULLETIN_FOLDER_ID` remains
the final fallback. The account running the manual action or installed trigger must have
permission to create and move files there. Output names use the short format
`YYYY-MM-DD Bulletin - Regular Worship` or `YYYY-MM-DD Bulletin - Holy Communion`.

A manual run or form submission updates the existing Google Doc for that location/date and
creates a replacement PDF when one has already been created; the previous PDF is moved to
Trash. An invalid or deleted saved document ID causes a replacement to be created. This
means a Queens and Brooklyn submission for the same Sabbath produce two distinct output
pairs in their respective folders.

## PWA presentation

The bulletin screen loads only the upcoming Sabbath on initial entry. **Next Week** is
loaded lazily the first time that sub-tab is opened, avoiding a second request for users
who never view it. A **This Week / Next Week** sub-tab control displays one response at a
time, and each week maintains its own loading/error state. For each location, the screen shows:

The displayed date pair rolls forward at the first local midnight after Sabbath and is
also re-evaluated whenever the app returns to the foreground. This calendar rollover is
independent of PWA code updates and does not require a deployment or an update-banner
action. If the following week's form has not been submitted yet, its worship-content
fields continue to use the documented `TBD` behavior.

1. Hymn of Praise
2. Sermon title
3. Bible verses
4. Hymn of Response
5. Every roster position represented by the API schema

Traditional and simplified Chinese app modes prefer the Chinese form answer with an
English fallback. English and Spanish modes prefer the English answer with a Chinese
fallback. Roster-role labels, empty-state text, `Choir`, and `Name withheld` are localized
by the PWA; names themselves are never translated or reconstructed.

Hymn of Praise and Hymn of Response show an **Open hymn** action when either bilingual
answer can be resolved. Submitted numbers are treated as the strongest evidence because
form-entered titles may contain typos. The declared English/Chinese field and title/script
similarity disambiguate numbers shared by both editions. The action prefers the English
1985 or Chinese 505 reader that matches the app language and uses the reviewed
cross-reference mapping when only the other edition was submitted. If no cross-reference
exists, it opens the source edition that best matches the submitted number and title. A
Chinese number whose source page is unavailable uses an English cross-reference when one
exists; otherwise the action falls back to the matching hymnal directory. The reader
receives the resolved number and a back link to the bulletin. A routed `hymnNum` is an
exact preselection: the reader renders that hymn as the selected result instead of relying
on a delayed virtual-list scroll.

Praise and Response display language follows the available form answers rather than
automatic translation. When both answers exist, the app language selects the preferred
one. When only one exists, its English or Chinese language is retained in every UI
language. The chosen answer is searched across both catalogs, allowing a correct number
to repair a mistyped title and allowing Chinese content entered in the English field (or
vice versa) to be identified. A title-only search compares normalized text against both
catalogs with fuzzy edit/bigram similarity; writing system and declared field affect the
ranking but never exclude the other catalog. If no source hymn can be identified reliably,
the raw form response is preserved. Cross-references affect the score destination, not the
displayed language.

`PRIMARY_BULLETIN_HYMNALS` is the denomination/church customization point. A fork changing
it must also provide the selected hymnal catalog and reader adapter, add the hymnal ID and
cross-reference table to `HymnalNumberMappings.json`, and extend the resolver's catalog and
route handling in `hymnalAdapters`. Once those supporting pieces exist, selection and
cross-reference routing follow the configured IDs rather than denomination-specific mapping
functions. Do not change only the ID: number matching is safe only when its catalog, route,
and mappings move together. The bulletin includes a visible, screen-reader-readable note
for the hymnal relevant to the UI language: Chinese modes identify the 505 Hymnal, while
English and Spanish modes identify the SDA Hymnal (1985).

When the Bible-verses answer is one recognized book and chapter with an optional verse or
same-chapter range—for example, `Psalms 15:1-5`—the PWA displays the canonical book name
in the current app language and makes the reference a link. The link opens the in-app
Bible reader using that language's default translation, loads the canonical book and
chapter, and scrolls to the first requested verse without activating selection mode.
The canonical mapping in `BibleService.ts` includes English, Traditional Chinese,
Simplified Chinese, and Spanish names for all 66 books. Unsupported non-empty free-form
text, multiple passages, and cross-chapter ranges remain visible as entered, but their
**Read now** action safely falls back to Genesis 1:1 in the current app language's default
translation. Blank and literal `TBD` scripture fields do not show the action.

After the weekly bulletin content, a separate **Planning** section links to the staff
schedule in Google Drive. Its Explore-style card explicitly says **Church staff only**.
Google—not the PWA—requires the visitor to be signed in with an authorized `nyccsda.org`
account. The public app neither embeds nor proxies that restricted spreadsheet.

The global `Special Remark` is displayed prominently inside both the Queens and Brooklyn
cards when it contains a value other than literal `TBD`; a blank or `TBD` remark hides the
banner entirely. Likewise, a blank or `TBD` Pastor Travel value hides that metadata row.
Every other blank bulletin field continues to render as `TBD`. The PWA does not maintain
a hardcoded list of communion, baptism, or other joint
service events. When every Brooklyn worship and roster field is blank or literally `TBD`,
the Brooklyn card keeps all of its `TBD` rows and adds a cautious note that there may be a
joint service at Elmhurst. That note includes a button to the established Elmhurst church
map location from `constants/ChurchData.ts`. Any populated Brooklyn field suppresses the
note.

A contained **Refresh** icon beside the date reloads only the currently selected week and
stays on the same header line in every language. After a manual refresh, that week enters
a five-minute cooldown; its localized accessibility label includes the remaining `M:SS` time.
The synchronous cooldown guard prevents rapid taps from starting parallel requests even
before React rerenders. Its expiry is saved in device local storage, so reloading or
reopening the PWA does not reset the cooldown. Manual refresh bypasses the device cache
and makes a new API request. It intentionally continues to respect the
two-minute shared Apps Script cache, preventing many users from forcing simultaneous
spreadsheet reads. Therefore a just-edited Sheet can take up to two minutes to appear.
The other week's loaded state is not cleared.

Successful bulletins and their fetch times are also stored locally per Sabbath date. This
means ordinary page visits do not repeatedly execute Apps Script. A future bulletin is
automatically considered stale when its Sabbath begins; the page checks on entry, when it
returns to the foreground, and at the Sabbath boundary while it remains open. The next
load then obtains current data. This is deliberately a local cache rather than an HTTP
cookie: the API has no login session and receives only the requested date.

Apps Script separately caches each privacy-filtered date response for 120 seconds. This
greatly reduces repeated spreadsheet reads during a Sabbath-morning traffic burst, though
each uncached HTTP request can still count as an Apps Script execution. The initial
one-week load, lazy Next Week tab, persistent device cache, and manual-refresh cooldown
work together to keep traffic comfortably below what an unthrottled two-request screen
would produce. Service limits can change; maintainers should review Google's current
[Apps Script quotas](https://developers.google.com/apps-script/guides/services/quotas).

## Failure behavior and troubleshooting

| Condition | API/PWA behavior | Corrective action |
| --- | --- | --- |
| Missing `date` or invalid `YYYY-MM-DD` | JSON error | Fix the PWA/request URL |
| Missing `YYYY Sabbath` tab | JSON `Schedule sheet not found` error | Create and protect the correctly named yearly tab |
| No matching row in the yearly tab | JSON `No schedule found` error | Verify the Date cell, displayed date, year tab, and deployment version |
| Missing response tab | That location has blank worship content; roster still loads | Restore the tab or update `CONFIG.responseSheets` |
| No form submission for the date | Worship content displays `TBD`; roster still loads | Submit the location's form if content is available |
| Multiple submissions for one date | Nonblank fields merge; latest timestamp wins each conflict independently per location | No deletion is required; submit a correction |
| Renamed/reordered schedule header | Field may be blank or mapped incorrectly | Restore the documented header contract and protections |
| Renamed Form question prefix | Corresponding worship field becomes blank | Restore the question or update `FORM_RESPONSE_SCHEMA` |
| HTTP 403 / Google access page | Public PWA cannot call the API | Redeploy as Web app, execute as deployer, access `Anyone` |
| Apps Script timeout/quota exhaustion | Week shows its retryable load error | Check Apps Script executions/quotas and retry later |
| One week fails while the other succeeds | Only the failing sub-tab shows an error | Correct that date's source data; the other week remains usable |

Do not “fix” an API mapping problem by publishing the raw spreadsheet or adding Sheets
credentials to frontend code. Restore the documented contract or update the allowlisted
backend and PWA together.

## Change-management checklist

The repository version is canonical. Use this matrix before changing the workbook or
forms:

| Change | Repository updates | Deployment required |
| --- | --- | --- |
| Correct a cell value or submit a replacement form response | None | None; next request reads the new value |
| Add a new yearly `YYYY Sabbath` tab with the existing schema | Documentation only if conventions change | None; test the first date |
| Change the physical Google Doc layout or ceremony copy | The relevant `Printed*.gs` file, Apps Script tests, and this section when operation changes | New version of the same Apps Script project; no new web-app URL |
| Add a physical-bulletin data field | `BulletinApi.gs` allowlist, the relevant `Printed*.gs` file, tests, and the sheet/form contract | New version of the same Apps Script project |
| Rename a response tab | `CONFIG.responseSheets`, documentation, Apps Script tests | New version of existing Apps Script deployment |
| Rename/add/reorder a schedule role | `COLUMN_SCHEMA`, TypeScript `BulletinLocation`, UI labels/rendering, tests, mapping table | Apps Script deployment and PWA deployment |
| Rename/add a Form question used by the PWA | `FORM_RESPONSE_SCHEMA`, TypeScript schema/UI when applicable, tests, mapping table | Apps Script deployment and possibly PWA deployment |
| Change JSON field names or nesting | Apps Script, `BulletinService.ts`, bulletin UI, tests, example JSON | Apps Script deployment and PWA deployment coordinated together |
| Create a replacement web-app deployment | `BULLETIN_API_BASE_URL`, `BulletinApi.gs` comment, this README | PWA deployment |
| Change only bulletin layout/copy | React Native screen and tests | PWA deployment only |

For Apps Script changes, copy the reviewed `.gs` files into the bound project and edit the
existing deployment to use a **New version**; this preserves the `/exec` URL. Creating a
brand-new deployment changes the URL and requires a PWA update. For PWA changes, run the
full project check before publishing.

## Production integration monitoring

`test/integration/bulletin-api.mjs` is a separate, opt-in integration test for the deployed
Apps Script endpoint. It makes exactly **one read-only GET request** and validates:

- anonymous HTTP and JSON access;
- the success envelope and requested date;
- required schedule metadata;
- both Queens and Brooklyn worship-content structures;
- every expected roster field;
- the public name shapes (`First L.`, a Latin first name, or an approved placeholder); and
- absence of email/timestamp keys anywhere in the response.

It intentionally does not run as part of `npm test`, so the local unit suite remains
deterministic and does not depend on Google. Run it locally only when production
verification is appropriate:

```bash
npm run test:integration:bulletin
```

Override the endpoint or fixture date without editing the test:

```bash
BULLETIN_API_URL="https://script.google.com/macros/s/DEPLOYMENT_ID/exec" \
BULLETIN_TEST_DATE="2026-08-08" \
npm run test:integration:bulletin
```

`.github/workflows/bulletin-integration.yml` runs as a separate pull-request check, similar
to the Jest PR workflow, and can also be started manually. Each run makes one request; PR
concurrency cancels an older in-progress run when a newer commit supersedes it. The stable
`2026-08-08` fixture exercises schedule data, both forms, bilingual content, blank values,
and name privacy without depending on whether next week's form has been submitted. This
workflow never opens the PWA page and never writes to Forms or Sheets.

Because a pull request cannot deploy its proposed `BulletinApi.gs` safely, this live check verifies
the PR's PWA contract against the currently deployed production Apps Script. Changes to
`BulletinApi.gs` still require the local/unit checks, review of the mapping tables, deployment as
a new version, and a post-deployment integration run.

## Deploy

This section describes the one-time browser setup or a manual fallback. For ordinary
source changes, use the automated deployment procedure below so the repository remains
the source of truth.

1. In the spreadsheet, open **Extensions → Apps Script**.
2. Copy `BulletinApi.gs` and the three `Printed*.gs` files into the editor. Apps Script treats
   multiple `.gs` files in one project as one script, so they deploy together. Use the
   settings from `appsscript.json`.
3. Select **Deploy → New deployment → Web app**.
4. Set **Execute as** to the deploying account.
5. Set **Who has access** to **Anyone**, including anonymous users. A public PWA cannot
   complete an interactive Google sign-in during a normal API request.
6. Deploy and copy the production URL ending in `/exec`; do not use the `/dev` test URL.
7. Verify the deployment in a signed-out/incognito browser with a real date. A successful
   response starts with `{"ok":true` and has a JSON content type. An access-request page
   or HTTP 403 means the deployment is not ready for the PWA.
8. Add the verified base URL to `constants/ExternalLinks.ts` with a date-building helper:

   ```ts
   export const BULLETIN_API_BASE_URL =
     'https://script.google.com/macros/s/DEPLOYMENT_ID/exec';

   export const getBulletinApiUrl = (date: string) =>
     `${BULLETIN_API_BASE_URL}?date=${encodeURIComponent(date)}`;
   ```

9. Each Apps Script code change requires a new deployment version. Re-test the `/exec`
   URL after updating the deployment. The printed bulletin menu is available after
   reloading the bound spreadsheet and authorizing the new Docs/Drive permissions.

The current production deployment is:

```text
https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec
```

`constants/ExternalLinks.ts` is the PWA's canonical endpoint configuration. The URL is
public by design, but it exposes only the allowlisted, privacy-filtered response.

Official reference: [Deploy an Apps Script web app](https://developers.google.com/apps-script/guides/web).

## Automated deployment from WSL or GitHub Actions

This project is one spreadsheet-bound Apps Script project. `BulletinApi.gs` and
`Printed*.gs` files are uploaded and deployed together. The project uses Google Sheets,
Forms, Docs, and Drive, so deployment requires more than just a GitHub repository:

```text
Google Sheet ── bound Apps Script ──┬── public bulletin API
                                    ├── Forms and submit triggers
                                    ├── printable Google Docs/PDFs
                                    └── Drive/shared-drive assets and output
```

### Google-side prerequisites

Before configuring a computer or GitHub, confirm that these already exist:

1. The main Google Sheet and its bound Apps Script project.
2. The Queens/Brooklyn Google Forms and their response sheets.
3. The Drive/shared-drive folder used for generated Docs and PDFs.
4. The source images used by the printed bulletin.
5. An existing production web-app deployment whose `/exec` URL is used by the app.

The Google account used for setup should be able to open the Sheet's **Extensions → Apps
Script**, edit the bound project, view its IDs and deployments, read the source images,
and create/edit files in the output folder. Spreadsheet access by itself does not grant
Shared Drive access.

The account that first runs physical-bulletin actions must also approve Google's runtime
permissions for Sheets, Forms, Docs, and Drive. A Workspace administrator may need to
allow `clasp` or third-party OAuth access. Deployment does not automatically authorize
every person who later opens the Sheet.

### Which ID goes where

These values are different:

| Value | Where to find it | Use |
| --- | --- | --- |
| Apps Script project ID / Script ID | Apps Script → **Project Settings → IDs** | `APPS_SCRIPT_PROJECT_ID` |
| Existing deployment ID | Apps Script → **Deploy → Manage deployments** | `APPS_SCRIPT_DEPLOYMENT_ID` |
| Production `/exec` URL | The web-app deployment details | Used by the PWA, never as the deployment ID |

Reuse the existing deployment ID. Updating it creates a new version while preserving the
same production `/exec` URL. Creating a new deployment creates a different URL.

### Local setup in WSL

Run this in WSL, not Windows PowerShell. A WSL login is stored separately from a Windows
login:

```sh
cd /home/dev/dev/sda-church-app
npm install --global @google/clasp
clasp login
```

If WSL cannot open a browser, use `clasp login --no-localhost` and follow the displayed
instructions. A successful login creates `~/.clasprc.json` in WSL. Check it without
printing the OAuth credential:

```sh
test -f ~/.clasprc.json && echo 'clasp credentials found'
```

Do not commit that file or put it in `.zshrc`. It contains a refresh token. Local `clasp`
uses it automatically; it does not need to be copied into the repository.

Export the two non-secret IDs in the shell. Replace the placeholder values with the IDs
from the Google-side steps above:

```sh
export APPS_SCRIPT_PROJECT_ID='your Apps Script project ID'
export APPS_SCRIPT_DEPLOYMENT_ID='your existing deployment ID'
```

These exports last for the current shell session. To load them for every WSL zsh session,
put the same two lines in `~/.zshrc`, then run `source ~/.zshrc`. The local deploy helper
uses these variables to create the ignored `.clasp` config files. The alternative is to
copy the templates and fill them in manually:

```sh
cp google-apps-script/.clasp.json.example google-apps-script/.clasp.json
cp google-apps-script/.clasp-deployment.json.example google-apps-script/.clasp-deployment.json
```

### Local commands

Run tests before deploying a reviewed change:

```sh
npm test -- --runInBand
```

Upload the source without changing the live web-app version:

```sh
npm run apps-script:push
```

Upload the source and update the existing production deployment:

```sh
npm run apps-script:deploy
```

After deployment, reload the main Sheet and test the relevant menu action. The first use
of Docs/Drive or installation of a Form trigger may require a one-time authorization.

### GitHub Actions setup

GitHub Actions is the remote, repeatable deployment path. It is intentionally manual and
does not deploy every push or pull request. The workflow is
[`.github/workflows/apps-script-deploy.yml`](../.github/workflows/apps-script-deploy.yml).

In GitHub, open **Settings → Environments → production**. Create the `production`
Environment if necessary, optionally require an approval, and add these Environment
secrets:

| Secret | Value |
| --- | --- |
| `APPS_SCRIPT_PROJECT_ID` | The Apps Script project ID, not the `/exec` URL |
| `APPS_SCRIPT_DEPLOYMENT_ID` | The existing production deployment ID |
| `CLASPRC_JSON` | The complete contents of WSL's `~/.clasprc.json` |

To copy the OAuth JSON for the GitHub secret:

```sh
cat ~/.clasprc.json
```

Copy the entire JSON object into GitHub's `CLASPRC_JSON` secret. Never commit it, put it
in a workflow file, or print it in a build log. The local WSL file remains the credential
for local deployment; the GitHub secret is the credential for the temporary runner.

To deploy remotely:

1. Push the reviewed branch to the repository.
2. Open GitHub **Actions**.
3. Select **Deploy Bulletin Apps Script**.
4. Choose **Run workflow**.
5. Select the intended branch, such as `release/0.38.0`.
6. Add an optional deployment description and start the run.
7. Approve the `production` Environment if GitHub asks.

The runner installs `clasp`, writes temporary config and credential files, pushes the
checked-in Apps Script files, updates the existing deployment ID, and then is discarded.
GitHub secrets are not available to untrusted pull requests from forks.

### Credentials, permissions, and recovery

The `CLASPRC_JSON` value does not need to be replaced for every deployment. It contains a
refresh token. Re-run `clasp login` and replace the secret only if the account revokes the
credential, Workspace policy changes, or the refresh token otherwise stops working.

If local deployment says it is unauthorized, run `clasp login` in the same WSL environment.
If Docs or Drive operations fail, run the relevant Sheet menu action once as the intended
staff account, approve the prompts, and verify Shared Drive permissions. If the app stops
reaching the API, verify that the existing deployment ID—not a newly created deployment—
was used. The production URL must only change intentionally.

`clasp push --force` makes the repository authoritative for the files it manages. Manual
Apps Script editor changes can be overwritten; reproduce them in the repository or inspect
them with `clasp pull` before deploying again.

Official references: [Apps Script web apps](https://developers.google.com/apps-script/guides/web),
[clasp configuration](https://github.com/google/clasp/blob/master/docs/config-files.md),
and [clasp commands](https://github.com/google/clasp/blob/master/README.md).

## Google for Nonprofits

This architecture works with ordinary Google Workspace, but the church can use its
Google for Nonprofits account to keep the spreadsheet, Forms, Apps Script ownership, and
administration under the church's managed domain rather than a volunteer's personal
account.

### Applying in the United States

1. Review Google's [country-specific eligibility requirements](https://support.google.com/nonprofits/answer/3215869?co=GENIE.CountryCode%3DUS&hl=en).
   A U.S. organization generally needs IRS-recognized 501(c)(3) status or documented
   coverage under a qualifying group exemption. Google notes that a church which is
   automatically tax-exempt but is not recognized by the IRS or listed in the IRS
   exempt-organization records is not eligible for this program.
2. If the local church operates under a denominational group exemption, gather its EIN
   and documentation showing affiliation with the central 501(c)(3) organization and
   group exemption. See Google's guidance for
   [group-exempt and local chapter organizations](https://support.google.com/nonprofits/answer/1699858?hl=en).
3. Sign in with an account controlled by the church—not a departing volunteer—and start
   the request from the official
   [Google for Nonprofits eligibility and application page](https://www.google.com/nonprofits/about/eligibility/).
4. Complete nonprofit verification through Google's current validation partner. Google
   says most requests are reviewed in approximately 2–14 business days, although it may
   request additional documentation.
5. After the organization is verified, activate **Google Workspace for Nonprofits**
   separately in the nonprofit account. Verification alone does not activate each Google
   product.
6. Establish at least two trusted nonprofit-account administrators and document ownership
   of the spreadsheet, Forms, Apps Script project, and web-app deployment.

The no-cost Google Workspace for Nonprofits offer currently includes the church-domain
collaboration tools used here—Drive, Sheets, Forms, and related administration. Review
Google's [current Workspace nonprofit offering](https://www.google.com/nonprofits/offerings/workspace/)
before relying on a particular storage, user, or feature limit because program benefits
can change.

## Example API response

The response shape below is the contract consumed by `BulletinService.ts`. Full names,
emails, and response timestamps are intentionally absent.

```json
{
  "ok": true,
  "bulletin": {
    "date": "2026-08-08",
    "quarter": "Q3",
    "specialRemark": "Communion",
    "tithePurpose": "Local Conference",
    "pastorTravel": "",
    "queens": {
      "sermon": "Jane S.",
      "sermonTitle": {
        "english": "Walking by Faith",
        "chinese": "憑信心而行"
      },
      "hymnOfPraise": {
        "english": "100 - Great Is Thy Faithfulness",
        "chinese": "100 - 祢的信實廣大"
      },
      "hymnOfResponse": {
        "english": "511 - I Know Whom I Have Believed",
        "chinese": "511 - 深知所信"
      },
      "bibleVerses": "Hebrews 11:1-6",
      "translation": "John D.",
      "chineseTeacher": "Mei L.",
      "englishTeacher": "Alex W.",
      "childrenTeacher": "Sam T.",
      "chairPastoralPrayer": "Chris C.",
      "specialMusic": "Choir",
      "offeringPrayer": "Pat B.",
      "pianist": "Robin K.",
      "ssChair": "Taylor M.",
      "ssOpeningPrayer": "Lee H.",
      "closingPrayer": "Morgan Y.",
      "flowerOffering": "Lily C."
    },
    "brooklyn": {
      "sermon": "Jamie N.",
      "sermonTitle": {
        "english": "Grace Upon Grace",
        "chinese": "恩上加恩"
      },
      "hymnOfPraise": {
        "english": "1 - Praise to the Lord",
        "chinese": "1 - 讚美真神"
      },
      "hymnOfResponse": {
        "english": "499 - What a Friend We Have in Jesus",
        "chinese": "499 - 耶穌恩友"
      },
      "bibleVerses": "John 1:14-18",
      "chairPastoralPrayer": "Casey P.",
      "offeringPrayer": "Jordan F.",
      "sabbathSchool": "Drew G."
    }
  }
}
```

## Deployment reference

The complete local WSL and remote GitHub Actions deployment procedure is documented in
the [Automated deployment from WSL or GitHub Actions](#automated-deployment-from-wsl-or-github-actions)
section above. The older
[operations page](../docs/operations/apps-script-deployment.md) remains as a redirect for
existing links.
