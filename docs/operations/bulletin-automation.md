# Bulletin Automation Operations

This is the operator runbook for the church bulletin system: the master Google
Spreadsheet, the bound Apps Script project, the public mobile-app API, and the
printed Google Doc/PDF workflow.

The implementation source remains in
[`google-apps-script/`](../../google-apps-script/). The directory README is now a
short source-directory pointer; this document is the consolidated API,
deployment, testing, and operator reference. It records the behavior that
operators must preserve when editing the workbook or changing a bulletin layout.

This runbook describes the current native mobile-app workflow. The web/PWA
preview remains useful for browser checks, but it is not the production bulletin
client. The centered `Schedule` button in the mobile bulletin opens the staff
master spreadsheet; it is intentionally not an intake endpoint.

## System boundaries

```text
Master spreadsheet
├── Sabbath Calendar       roster, service assignments, metadata
├── Sabbath Sermon Data    reviewed final-owner bulletin content
└── Name Dictionary        private physical-print name resolution
        │
        ├── BulletinApi.gs ── public, privacy-filtered JSON ──> mobile app
        │
        └── Printed*.gs ── authorized full-name render ──> Google Doc + PDF
```

There is one bound Apps Script project. `BulletinApi.gs`, the printed renderers,
the schedule-maintenance script, and the generated `PinyinPro.gs` are deployed
together. The public web-app endpoint is read-only; users enter or correct
content in the spreadsheet, not through the mobile app.

### Why this architecture

Google Sheets, Docs, Drive, and Apps Script are already part of the
church's managed Google Workspace. Apps Script keeps Google authorization and
the date-specific join out of the app, while the mobile app receives only a
small allowlisted response. No spreadsheet ID, OAuth token, submitter email address,
or full response table is shipped in the app bundle.

Google Workspace for Nonprofits currently includes Apps Script at no additional
charge under the nonprofit offering; see Google's [nonprofit product
listing](https://www.google.com/nonprofits/offerings/workspace/) for the current
terms. This is still not a promise that every domain, storage, API, or quota
cost will always be zero. Review current [Apps Script
quotas](https://developers.google.com/apps-script/guides/services/quotas) and
the church's Workspace terms during annual maintenance.

### Source map

| Source | Responsibility |
| --- | --- |
| `google-apps-script/BulletinApi.gs` | Public API, sheet contracts, data joins, privacy filtering, and metadata translations |
| `google-apps-script/BulletinScheduleMaintenance.gs` | Background `onOpen` maintenance, header protection, validation, hiding, and quarter expansion |
| `google-apps-script/PrintedQueensBulletin.gs` | Shared data preparation, Queens Regular renderer, common Docs helpers, hymn/Bible/QR helpers |
| `google-apps-script/PrintedQueensCommunionBulletin.gs` | Queens Communion page order and fixed Communion/Foot Washing readings |
| `google-apps-script/PrintedBrooklynBulletin.gs` | Brooklyn cover, Zoom, Sabbath School, worship, and location-specific printed layout |
| `google-apps-script/PrintedHymnLookup.gs` | Reviewed bidirectional English/Chinese hymn-number lookup for physical printing |
| `google-apps-script/SabbathEncouragement.gs` | 52-page Brooklyn encouragement rotation containing Ellen White quotations plus Bible/editorial/other source material, machine translation, and direct Bible replacement |
| `services/BulletinService.ts` | App response types, date selection, local cache, refresh cooldown, and empty-location behavior |
| `app/(tabs)/home/bulletin.tsx` | Digital bulletin sections, labels, privacy-safe names, translations, and staff link |
| `test/apps-script-physical-bulletin.test.ts` | Physical layout, contract, privacy, lookup, QR, and maintenance regression tests |
| `test/apps-script-bulletin-merge.test.ts` | Intake mapping and precedence regression tests |
| `test/integration/bulletin-api.mjs` | Opt-in read-only production API contract check |

## The three mandatory sheets

These three tabs are the stable workbook contract. Keep their first-row headers
exactly as documented, including capitalization and order. Do not insert a new
column between existing columns without updating Apps Script, tests, and the
mobile app first.

### 1. `Name Dictionary`

Row 1 must be:

```text
English Name | Chinese Name
```

Data begins on row 2.

- `English Name` is the canonical English name used for physical printing.
- `Chinese Name` is the traditional-Chinese display name. The dictionary normally
  stores Chinese names surname-first.
- The private printed renderer derives surname-first and given-name-first pinyin
  aliases from `Chinese Name` with the generated `pinyin-pro` runtime. Pinyin is
  never stored as a third column, returned by the public API, or used to display
  Chinese names in the digital bulletin.
- If the sheet is missing, a name is printed exactly as supplied. If a lookup
  is incomplete or unmatched, the source value is preserved rather than guessed.

The pinyin implementation is generated from the pinned `pinyin-pro` dependency
when Apps Script is deployed. `PinyinPro.gs` is generated output: do not edit it
by hand, and do not add the generated file to a manual source patch. If pinyin
conversion fails, the source value remains unchanged and the renderer does not
guess.

### 2. `Sabbath Calendar`

This is the broadly shared schedule and roster sheet. The current protected
contract uses this exact order:

```text
Date | Quarter | Special Remark | Tithe Purpose | Pastor Travel |
Queens Sermon | Translation | Chinese Teacher | English Teacher | Youth Teacher | Kids Teacher |
Chair/Pastoral Prayer | Special Music | Offering Prayer | Pianist | SS Chair |
SS Opening Prayer | SS Closing Prayer | Flower Offering |
Brooklyn Sermon | Chair/Pastoral Prayer | Offering Prayer | Technician | Encouragement | Sabbath School
```

Important structural columns:

- Column A, `Date`, is the canonical Sabbath date. Existing rows should use a
  real spreadsheet date or a consistently parseable displayed date.
- Column B, `Quarter`, is the schedule-maintenance quarter marker. The script
  owns the date and quarter structure; do not manually move these columns.
- The repeated `Chair/Pastoral Prayer` and `Offering Prayer` headers are
  intentional. The first occurrence belongs to Queens; the second belongs to
  Brooklyn.
- `Flower Offering` belongs to the Queens worship program and schedule data. It
  does not belong in the Queens Church at Study printed section.
- `Technician`, `Encouragement`, and `Sabbath School` are Brooklyn fields.
  Printed Brooklyn uses `Encouragement`, not the older `Testimonies` wording.
- `Announcements` and `Sunset Time` remain recognized legacy/API response aliases
  in the source, but they are not current protected `Sabbath Calendar` contract
  columns. Adding either back to the sheet requires a coordinated contract,
  test, and app/renderer change.

The first-row contract is protected for the technology group
`technology@nyccsda.org`. Columns A:B are also protected for that group across
the schedule. Ordinary schedule cells remain governed by the spreadsheet's
normal sharing permissions.

### 3. `Sabbath Sermon Data`

This is the reviewed, final-owner intake sheet. Keep one row per Sabbath and
location. Row 1 must be:

```text
Date | Location | English Hymn of Praise | Chinese Hymn of Praise |
English Sermon Title | Chinese Sermon Title | English Hymn of Response |
Chinese Hymn of Response | Bible Verses
```

Rules:

- `Date` uses `YYYY-MM-DD`.
- `Location` is exactly `Queens` or `Brooklyn`.
- The English and Chinese hymn/title columns are independent. A blank side may
  be filled by the reviewed hymnal lookup; a supplied side is never overwritten.
- `Bible Verses` stores the reference used by Church at Study and the digital
  bulletin's Today's Verse. It may be a same-chapter range or supported
  semicolon-separated references.
- There are intentionally no speaker password, source, last-updated, or
  updated-by columns in this contract.
- Nonblank cells in this sheet feed both digital and printed bulletins. A blank
  cell permits the documented fallback behavior.

The printed-bulletin dialog links directly to this sheet. This is the only
normal bulletin-content intake workflow.

## Header protection and validation automation

The bound spreadsheet's simple `onOpen` maintenance path runs for every user who
can open the workbook. It is intentionally quiet and does not require an email
allowlist. The visible custom menu exposes only the document/PDF creation action;
maintenance and setup operations stay hidden.

On open, the script:

1. verifies the exact header contracts for `Sabbath Calendar` and `Sabbath Sermon Data`;
2. installs or refreshes strict header validation with a bilingual message;
3. normalizes the header protections and restricts their editors to
   `technology@nyccsda.org`;
4. protects `Sabbath Calendar!A:B` for the technology group;
5. appends missing Saturdays for the next quarter when the current quarter is in
   its final 21 days; and
6. hides old schedule rows without deleting them.

The header validation message tells editors to update Apps Script and the mobile
app before adding, removing, renaming, or reordering a contract column.

### English-only Sabbath Calendar input

The script automatically installs the data-validation rule on the editable
`Sabbath Calendar` range and expands it after automatic quarter rows are added.
The rule rejects CJK characters and displays bilingual help text explaining that
the mobile app redacts last names for anonymity and that editors should use the
`Name Dictionary` tab for approved English names.

Data validation alone is not sufficient against copy/paste: pasting a cell can
replace validation metadata. Therefore the script also has a narrowly scoped
`onEdit` guard:

- it applies only to `Sabbath Calendar` columns A:X and data rows beginning at row 2;
- it clears edited or pasted cells containing CJK Han characters;
- it does not alter other tabs or columns; and
- it does not delete rows or rewrite unrelated content.

Do not add a manually maintained finite range such as `A2:X53`. The script
reapplies the rule to the current data range and updates it after expansion.

### Automatic quarter and visibility maintenance

The schedule-maintenance behavior is intentionally non-destructive:

- the current quarter remains visible;
- the immediately preceding seven days remain visible at quarter boundaries;
- older dated rows are hidden, never deleted;
- during the final 21 days of a quarter, missing Saturdays in the immediately
  following quarter are appended with blank assignment cells and the correct
  quarter value; and
- if the next quarter is already complete, nothing is appended and the script
  waits until the following quarter boundary.

The operation is idempotent. It compares existing dates before appending, so
opening the sheet repeatedly does not create duplicates. If rows already exist
for a future quarter, the script does not delete or rewrite them.

## Data precedence and fallback behavior

For a requested date, the API builds data in this order:

1. `Sabbath Calendar` supplies the canonical date, quarter, metadata, and roster.
2. Nonblank values from matching `Sabbath Sermon Data` rows are applied by
   location. If duplicate rows exist, the latest `Last Updated`/`Timestamp`
   row wins for each nonblank field; a blank later cell does not erase an older
   nonblank value.

The printed prompt has one additional fallback for its manual, print-only verse
selection. The reviewed `Sabbath Sermon Data → Bible Verses` value takes priority;
only when it is blank may a saved printed override or older fallback memory be
used. This prevents an old manual selection from masking newly reviewed intake.

Blank content remains blank in the API and renders as `TBD` in the app or as the
bilingual printed placeholder. Missing roster rows are different: a missing
`YYYY Sabbath` sheet or missing date row is an API error because there is no
canonical schedule record.

### Public response boundary

The response is shaped by the explicit `COLUMN_SCHEMA` and the reviewed intake
mapping. The app may receive schedule metadata, bilingual worship content,
redacted roster roles, `metadataTranslations`, and the Brooklyn-specific fields
`technician`, `encouragement`, and `sabbathSchool`. It does not receive arbitrary
columns, full names, pinyin, email addresses, or timestamps.

The production web app is configured to execute as the deploying account and be
accessible anonymously. This is required for an installed app that cannot stop
for an interactive Google login. The endpoint must therefore remain narrowly
allowlisted and privacy-filtered.

## Privacy, auto-translation, and name behavior

The public `/exec` endpoint is anonymous by design, so every returned value must
be treated as public.

- Person fields are reduced to a first name and last initial where possible.
- `Choir` is preserved as a role value.
- Email addresses, timestamps, pinyin aliases, and full last names
  are never returned.
- The digital bulletin always uses English/redacted names. It must never use a
  Chinese dictionary name or a pinyin alias.
- Physical generation runs with full names and may print a Chinese line followed
  by the canonical English line.
- English↔Chinese and pinyin lookups are only for physical printing. A matched
  pinyin alias resolves to the dictionary's canonical English/Chinese row; it
  does not create a new person or alter the digital API.

The API automatically translates selected schedule metadata (`Tithe Purpose`,
`Pastor Travel`, and related supported metadata) into the supported language
keys while retaining the original English. The app displays both translated and
original English values when they differ. This translation path must not be used
for Bible text, Bible references, names, hymns, or sermon titles.

The Brooklyn Sabbath Encouragement English side is a separate, explicit machine
translation exception. The source quotes Ellen G. White but is not exclusively her
writing; Bible quotations, editorial headings, and other source material must be
identified separately. The English side is labeled with a disclaimer because it
may not be fully accurate. Bible quotations inside it are replaced with direct BSB
text from the approved Bible API. Do not silently expand machine translation to
Scripture, names, or worship content.

## Digital mobile bulletin behavior

The native mobile app is the primary digital product. The PWA is a testing and
preview surface, not the canonical release channel.

### Sections and location-specific rules

- Queens has separate Sabbath School and Church at Worship sections.
- Queens `Flower Offering` appears in the worship program, not under Church at
  Study.
- Brooklyn's digital Sabbath School section intentionally contains only Prayer,
  Sabbath Encouragement, and Sabbath School. Unplanned welcome, song/Bible
  verse, opening hymn, closing hymn, closing prayer, and Five Minutes Break rows
  are omitted.
- Brooklyn uses the label `Sabbath Encouragement`, not `Sabbath Message`.
- The centered `Schedule` pill on its own row below the week selector links to the
  master spreadsheet, not to a separate intake link.
- Every blank content field displays `TBD`; a populated field suppresses the
  cautious joint-service fallback note for Brooklyn.

### Caching and refresh

- The API caches privacy-filtered responses for 120 seconds.
- The app caches successful bulletin responses per Sabbath date on the device.
- Next Week loads lazily when opened.
- A manual refresh bypasses the device cache but still observes the server's
  two-minute Apps Script cache and enters a five-minute local cooldown.
- A cached future bulletin becomes stale when its Sabbath begins. Entry,
  foreground resume, and the Sabbath boundary recheck the date.

### Bible references and translations

The app supports recognized multilingual book names and same-chapter ranges.
Unsupported free-form or multiple-passage input remains visible but its Read Now
action safely falls back to Genesis 1:1 rather than guessing a location.

Tithe Purpose and Pastor Travel return translated metadata plus the original
English value. The app displays both when they differ and avoids duplicating a
string when the translation is identical. Bible text is not translated by the
metadata translation path.

## Printed bulletin generation

The **Printed Bulletin → Create Google Doc + PDF…** action is the only normal
manual workflow. It opens a staff dialog that:

1. defaults to the closest upcoming Saturday;
2. links the operator to `Sabbath Sermon Data`;
3. lets the operator select Queens or Brooklyn;
4. supports Queens Regular or Queens Holy Communion; Brooklyn Communion is
   intentionally disabled; and
5. optionally accepts a print-only Bible reference and printed announcements.

The generator requires the operator to authorize Sheets, Docs, and Drive access.
The anonymous public API never invokes the print generator.

### Output names and Drive folders

The canonical names are:

```text
YYYY-MM-DD Bulletin - Regular Worship
YYYY-MM-DD Bulletin - Holy Communion
```

The Google Doc and PDF are stored together in the location-specific output folder:

- Queens: the configured Queens folder;
- Brooklyn: the configured Brooklyn folder;
- legacy folder configuration is only a fallback.

If a saved Google Doc ID is valid, the generator updates it. A trashed, deleted,
or inaccessible saved Doc is treated as missing and a new Doc is created. A
replacement PDF is created on regeneration and the previous PDF is moved to
Drive Trash. This is why finding an old Doc in Trash does not cause the next run
to update that copy.

### Page and fold order

All printed output is landscape US Letter with two vertical panels and an explicit
center fold gutter. Keep the panels and gutter wide enough for duplex printing;
never solve overflow by clipping the center of either panel.

Queens Regular is two physical pages:

1. left: Church at Study; right: Church at Worship, with the giving footer;
2. left: announcements/schedule; right: shared cover.

Queens Holy Communion is four physical pages in imposed order:

1. left: announcements/back; right: cover;
2. left: Church at Study; right intentionally blank;
3. left: Holy Communion worship plus vertical giving section; right: Church at Worship;
4. left: Foot Washing; right: the complete Holy Communion service.

The Communion ceremony has fixed references and fixed order. The submitted study
verse cannot replace the Foot Washing or Communion readings. Communion service
assignments use Moses Fang (`方舟`) except for Congregation. Brooklyn Communion is
rejected server-side and should remain disabled in any intake UI.

Brooklyn Regular is three physical pages:

1. left: fellowship/service locations; right: shared three-location cover plus
   Mandarin-only Zoom information;
2. left: Brooklyn Sabbath School; right: Brooklyn Sabbath Worship, with giving;
3. bilingual Sabbath Encouragement spread.

The Brooklyn cover uses Brooklyn as the primary address while still highlighting
all three locations. The Zoom rows are two on top and one centered below, with
the topic before the day/time.

## Printed edge cases and content rules

### Hymns

`PrintedHymnLookup.gs` contains the reviewed English↔Chinese hymnal number map.
For each printed hymn:

- if both language values are supplied, preserve both exactly;
- if only English is supplied, fill only the missing Chinese hymn number;
- if only Chinese is supplied, fill only the missing English hymn number; and
- never copy an English title/reference into the Chinese slot.

Queens Regular, Queens Communion, and Brooklyn all use this shared path. The
Communion response hymn remains a fixed bilingual reference and must fit on one
line in the printed layout.

### Bible readings

Printed worship tables have separate Chinese and English reference lines. A value
such as `John 3:14-17` becomes a Chinese book reference such as
`約翰福音 3:14–17` and a separate English `John 3:14–17`; the English reference
must not be duplicated in the Chinese slot.

The printed renderer uses the deterministic book map for references and the
configured HelloAO Bible API for Bible text. Bible text and references must never
be passed through `LanguageApp`, an LLM, or an improvised machine translation.
The English translation may be selected in the print dialog; Chinese is currently
CUV/和合本. Multiple parsed references are joined deliberately, but very long
passages can trigger a preflight warning or affect pagination.

Sabbath Encouragement is a separate exception: its Chinese source quotes Ellen
White but also contains Bible, editorial, and other material; it is machine
translated for the English side, carries a disclaimer, and has Bible quotations
replaced with direct BSB text. Review
[`sabbath-encouragement-copyright.md`](sabbath-encouragement-copyright.md)
before changing that source or translation policy.

### Brooklyn Sabbath Encouragement

The source PDF has 52 sequential pages. The anchor is:

```text
2026-08-22 → page 20
```

Each following Sabbath advances one page and wraps page 52 back to page 1. The
Chinese and English columns are rendered separately, with paragraph spacing and
the Today's Verse section divider preserved. The Chinese heading is intentionally
regular rather than bold or underlined.

### Giving QR slots

The code keeps three physical slots in stable order:

```text
1. Mobile App
2. ACH/card
3. Zelle
```

Current temporary state:

- Queens Regular: Mobile App and Zelle are reserved/hidden; ACH/card remains active.
- Queens Holy Communion: same shared QR behavior.
- Brooklyn: Mobile App and Zelle are reserved/hidden; ACH/card remains active.
- Brooklyn does not have a Zelle destination.

The code and slot dimensions remain in place so the assets can be restored without
reflowing the bulletin. Current asset filename conventions end in
`_368x368.jpg`; the mobile-app caption is `Download Mobile App | 下載 APP`.

## Deployment and verification

The repository is the canonical source. Local WSL deployment uses the existing
Apps Script deployment ID so the production `/exec` URL does not change:

```bash
npm install
npm test -- --runInBand test/apps-script-physical-bulletin.test.ts test/apps-script-bulletin-merge.test.ts
npm run apps-script:push       # upload source only
npm run apps-script:deploy     # upload and create a new version of the existing deployment
```

The deployment helper:

- regenerates `PinyinPro.gs` from the pinned npm dependency;
- writes ignored `.clasp.json` and `.clasp-deployment.json` from environment values;
- accepts `APPS_SCRIPT_PROJECT_ID`, `APPS_SCRIPT_DEPLOYMENT_ID`, and an optional
  `DEPLOYMENT_DESCRIPTION`; and
- can write `CLASPRC_JSON` to the WSL clasp credential file for CI-style authentication.

The current workflow is manual: use the printed-bulletin dialog after the reviewed
sheet rows are ready. Remove any obsolete spreadsheet installable triggers left by
the former append-only workflow; the current source does not install an automatic
content-submission trigger.

Run `clasp login --no-localhost` when WSL cannot receive the localhost OAuth
callback. Never commit `.clasprc.json`, `.clasp.json`, deployment IDs, or refresh
tokens.

GitHub Actions has a manual, protected-production Apps Script deployment workflow.
It requires `APPS_SCRIPT_PROJECT_ID`, `APPS_SCRIPT_DEPLOYMENT_ID`, and
`CLASPRC_JSON`. A GitHub push or PR does not deploy Apps Script automatically.
The workflow updates the existing deployment; it does not create a new public URL.

If clasp authorization fails repeatedly after a fixed time window, first check the
Google Workspace session-control policy. This church account has had a 16-hour
reauthorization policy. Apps Script/clasp should be marked Trusted and the Workspace
admin's **Exempt Trusted apps** setting should cover the relevant Google Cloud
session-control policy. A recurring failure is not necessarily an expired JSON
credential.

After deployment:

1. reload the bound spreadsheet to refresh the menu;
2. generate a test date for each changed location/format;
3. verify both the Google Doc and PDF links;
4. confirm the Doc and PDF are in the correct folder and the old PDF was trashed
   only when replacing an existing output;
5. verify the public `/exec?date=YYYY-MM-DD` response does not contain email,
   timestamps, Chinese names, pinyin, or full last names; and
6. run the opt-in integration test when production verification is appropriate:

```bash
npm run test:integration:bulletin
```

Do not create a new web-app deployment merely to publish code. A new deployment
changes the URL and requires a coordinated mobile-app update.

## Troubleshooting matrix

| Symptom | Likely cause | Corrective action |
| --- | --- | --- |
| App shows `TBD` for worship content | No matching intake value | Add or correct the row in `Sabbath Sermon Data`; allow up to 120 seconds for API cache expiry |
| New intake verse is ignored by print prompt | Old print memory or override | Check that `Sabbath Sermon Data → Bible Verses` is nonblank; it has priority over old memory |
| API returns schedule-not-found | Missing `YYYY Sabbath` tab or row | Restore the exact tab name and a matching Date row |
| A field moved to the wrong location | Header renamed/reordered or repeated header occurrence changed | Restore the exact header contract and deploy matching code |
| Header says contract violation | A protected header was changed | Update Apps Script/tests/app first; technology group restores the header |
| Chinese text appears in Sabbath Calendar | Typed or pasted into A:X | The validation/onEdit guard should reject/clear it; use Name Dictionary for approved English names |
| New quarter rows lack validation | Maintenance did not run or append failed | Open the workbook as an editor, inspect Apps Script logs, and rerun maintenance; do not manually limit the rule to X53 |
| Old rows disappeared | They were hidden, not deleted | Unhide rows when historical planning is needed; maintenance is non-destructive |
| Google Doc is in Trash or not updated | Saved ID points to a trashed/deleted file | Run generation again; the script treats it as missing and creates a new Doc in the configured folder |
| PDF has an extra page or clipped fold content | Layout overflow or altered gutter/margins | Restore the renderer's panel/gutter structure; never clip text to fit |
| Bible reference repeats English in Chinese slot | Renderer bypassed bilingual helper | Use `formatBibleReferenceForPrint_` and the deterministic Chinese book map |
| Hymn English appears in Chinese slot | A manually supplied Chinese value was overwritten | Preserve the supplied side; only the missing side may use `PrintedHymnLookup.gs` |
| QR slot is blank | Asset is intentionally reserved or Drive file is unavailable | Confirm current temporary QR policy and file naming before changing layout |
| Brooklyn Communion is unavailable | Intentional safety/layout restriction | Use Queens Holy Communion or Brooklyn Regular; do not re-enable without a dedicated layout review |
| Apps Script deploy fails after working previously | Workspace session-control reauthorization | Verify Trusted Apps and Exempt Trusted apps policy before rotating credentials |
| Mobile app receives a Google sign-in page/403 | Web app access or deployment settings changed | Deploy as a web app executing as the owner with anonymous access and preserve the `/exec` URL |

## Change checklist

Before changing a bulletin field, sheet column, or layout:

- update the appropriate schema and renderer;
- update the mobile-app type/UI when the public JSON changes;
- update the three-sheet/header documentation;
- add or update deterministic tests;
- run the relevant Apps Script and mobile tests;
- deploy Apps Script as a new version when `.gs` changes;
- build/upload an APK only when native app code changes; and
- verify a generated Doc, PDF, and public API response for the affected location.

For header changes, the order is mandatory: change the repository contract,
tests, and mobile app first; then have the technology group update the protected
sheet header; then deploy and verify. Do not solve a contract mismatch by making
the public API read arbitrary columns.
