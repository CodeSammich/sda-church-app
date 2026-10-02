# Bulletin Automation Operations

This is the operator runbook for the church bulletin system: the master Google
Spreadsheet, the bound Apps Script project, the public mobile-app API, and the
printed Google Doc/PDF workflow. It records the behavior to preserve when
editing the workbook or changing a bulletin layout.

The source is in [`google-apps-script/`](../../google-apps-script/). Its
[README](../../google-apps-script/README.md) has the clasp setup and the test
and deploy commands; this document is the reference for everything else.

Where to start:

- **Church staff** who plan the schedule or print bulletins: [The three
  mandatory sheets](#the-three-mandatory-sheets) (what goes in each tab), [Header
  protection and validation automation](#header-protection-and-validation-automation)
  (red cells and popups), [Printed bulletin generation](#printed-bulletin-generation),
  and the [Troubleshooting matrix](#troubleshooting-matrix).
- **Developers**: the [System boundaries](#system-boundaries) and source map, the
  sheet contracts, [Data precedence](#data-precedence-and-fallback-behavior) and
  privacy rules, [Deployment and verification](#deployment-and-verification), and
  the [Change checklist](#change-checklist).

Contents:

- [System boundaries](#system-boundaries)
- [The three mandatory sheets](#the-three-mandatory-sheets)
- [Header protection and validation automation](#header-protection-and-validation-automation)
- [Data precedence and fallback behavior](#data-precedence-and-fallback-behavior)
- [Privacy, auto-translation, and name behavior](#privacy-auto-translation-and-name-behavior)
- [Digital mobile bulletin behavior](#digital-mobile-bulletin-behavior)
- [Printed bulletin generation](#printed-bulletin-generation)
- [Printed edge cases and content rules](#printed-edge-cases-and-content-rules), including [Giving QR slots](#giving-qr-slots)
- [Deployment and verification](#deployment-and-verification)
- [Troubleshooting matrix](#troubleshooting-matrix)
- [Change checklist](#change-checklist)

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
| `google-apps-script/ScheduleAssignmentChecks.gs` | Same-day roster conflict highlights and Name Dictionary unknown-name warnings |
| `google-apps-script/PrintedBulletin.gs` | Shared printed-bulletin code: Sheet menu and prompts, data preparation, Docs and PDF export, page and table helpers, and the shared cover, giving, announcement, hymn, Bible, and QR helpers |
| `google-apps-script/PrintedCommunionBulletin.gs` | Communion service content both locations print: fixed Communion/Foot Washing readings, response hymn, and ceremony panels |
| `google-apps-script/PrintedQueensBulletin.gs` | Queens Regular and Queens Communion page layouts |
| `google-apps-script/PrintedBrooklynBulletin.gs` | Brooklyn cover, Zoom, Sabbath School, worship, Communion, and giving footer layouts, and placing the Sabbath Encouragement spread |
| `google-apps-script/PrintedHymnLookup.gs` | Reviewed bidirectional English/Chinese hymn-number lookup for physical printing |
| `google-apps-script/SabbathEncouragement.gs` | 52-page Brooklyn encouragement rotation containing Ellen White quotations plus Bible/editorial/other source material, machine translation, direct Bible replacement, and the bilingual printed spread |
| `google-apps-script/appsscript.json` | Apps Script runtime and web-app manifest |
| `google-apps-script/PinyinPro.gs` | Generated on each push or deploy from the pinned `pinyin-pro` npm dependency; ignored by Git, never edited by hand |
| `services/BulletinService.ts` | App response types, date selection, local cache, refresh cooldown, and empty-location behavior |
| `app/(tabs)/home/bulletin.tsx` | Digital bulletin sections, labels, privacy-safe names, translations, and staff link |
| `test/apps-script-physical-bulletin.test.ts` | Physical layout, contract, privacy, lookup, QR, and maintenance regression tests |
| `test/apps-script-bulletin-merge.test.ts` | Intake mapping and precedence regression tests |
| `test/apps-script-schedule-assignment-checks.test.ts` | Roster conflict highlighting and unknown-name warning tests |
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
   its final 21 days;
6. hides old schedule rows without deleting them; and
7. repaints the conflict highlights described below across every schedule row.

The header validation message tells editors to update Apps Script and the mobile
app before adding, removing, renaming, or reordering a contract column.

### English-only Sabbath Calendar input

Chinese characters in the `Sabbath Calendar` are handled by a narrowly scoped
`onEdit` guard, whether they are typed or pasted. It clears the cell and shows a
bilingual popup explaining that the mobile app redacts last names for anonymity
and that editors should use the `Name Dictionary` tab for approved English names.
The popup comes from the script, so it appears a second or two after the edit.

The script also installs a data-validation rule on the editable range, and
expands it after automatic quarter rows are added. The rule deliberately has no
help text and allows invalid input:

- Sheets shows a rule's help text on *every* selected cell, not only on invalid
  input, so a long explanation there covered every cell a planner clicked.
- Allowing invalid input lets typed Chinese reach the `onEdit` guard and its
  popup, instead of Sheets' own rejection dialog.
- If the guard ever fails to run, a cell with Chinese still shows the rule's red
  warning corner.

The guard:

- it applies only to `Sabbath Calendar` columns A:Y and data rows beginning at row 2;
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

### Roster conflict highlights and unknown names

`ScheduleAssignmentChecks.gs` helps planners catch two roster mistakes in the
person columns (`Queens Sermon` through `Sabbath School`, F:Y). Row 1 and
columns A:E are never checked or changed.

#### Same person twice on one Sabbath (automatic red)

If a name appears in more than one F:Y cell of the same row, every cell holding
it turns pale red (`#ea9999`, the Sheets "light red 2" color). No click or
setup is needed.

- Queens and Brooklyn columns are compared together, so the main case caught is
  one person scheduled at both locations.
- The rule is deliberately simple: any repeat is red. Some repeats are fine
  (for example Offering Prayer and Special Music at one service), and the
  planner decides whether to leave those. The value is never changed.
- Each red cell has a note, shown by the small black triangle in its top-right
  corner. Hovering over the cell lists the person's other roles that Sabbath by
  column header, for example `Duplicate / 重複: English Teacher`. The repeated
  Chair/Pastoral Prayer and Offering Prayer headers are named by location.
- Cells with several names (`Mary Lin / John Chen`) are compared name by name.
  Placeholders such as `TBD` and `Choir` are ignored. Case and spacing
  differences do not hide a repeat, and a pinyin spelling derived from a Name
  Dictionary entry counts as the same person as its English name.

The whole sheet is rescanned after every Sabbath Calendar edit, every Name
Dictionary edit, and every `onOpen` maintenance run. That includes hidden past
rows, and the scan runs after new quarter rows are appended, so highlights
copied into new rows are cleared. Expect the color to appear a few seconds
after an edit.

The script only clears cells that are exactly `#ea9999`, and only replaces or
clears notes that start with `Duplicate / 重複:` (or the earlier `Roster check /
名單檢查` wording). Other cell colors and
planners' own notes are left alone; a cell with a planner's note still turns
red but keeps that note. Do not use `#ea9999` for manual highlighting in F:Y.

#### Name not in the Name Dictionary (popup)

When an editor types or pastes a name the Name Dictionary does not know, a
popup lists it with close dictionary spellings: typos, swapped name order, or a
first name typed alone. The value is kept and the cell is not colored. Names
already in the sheet are not re-checked; only edited cells are.

There are two versions of the popup:

- **Plain alert (default).** The simple `onEdit` trigger shows a text alert
  with the suggestions. Editors fix the cell or add the name to the Name
  Dictionary tab themselves.
- **Interactive dialog.** Each unknown name gets its suggestions as buttons
  that fix the cell, plus English and optional Chinese name boxes with an
  **Add** button that appends them to the Name Dictionary.

Google does not let simple triggers open HTML dialogs or create the
installable trigger that can. So the dialog turns itself on the first time an
account listed in `PHYSICAL_BULLETIN_ADMIN_EMAILS` uses **Printed Bulletin →
Create Google Doc + PDF…**, because that click runs with full authorization.
It installs an `onEdit` trigger for `onScheduleNameCheckEdit`, owned by that
admin, and sets the `SCHEDULE_NAME_CHECK_TRIGGER` script property. After that,
the plain alert stops, so an edit never shows two popups, and no other admin
installs a duplicate.

If the owning admin's account is removed, its trigger stops. To recover,
delete the `SCHEDULE_NAME_CHECK_TRIGGER` script property. The next admin menu
click reinstalls the trigger, or you can run `installScheduleNameCheckTrigger`
from the Apps Script editor. The dialog's **Add** and suggestion buttons run
as the editor, so an editor who has never authorized the script sees an
authorization error there. The **Open Name Dictionary tab** button and editing
the tab by hand still work.

## Data precedence and fallback behavior

For a requested date, the API builds data in this order:

1. `Sabbath Calendar` supplies the canonical date, quarter, metadata, and roster.
2. Nonblank values from matching `Sabbath Sermon Data` rows are applied by
   location. If duplicate rows exist, the lowest row in the sheet wins for each
   nonblank field (the code would order them by a `Last Updated` or `Timestamp`
   column, but the current contract has neither); a blank later cell does not
   erase an older nonblank value.

The printed prompt has one additional fallback for its manual, print-only verse
selection. The reviewed `Sabbath Sermon Data → Bible Verses` value takes priority;
only when it is blank may a saved printed override or older fallback memory be
used. This prevents an old manual selection from masking newly reviewed intake.

Blank content remains blank in the API and renders as `TBD` in the app or as the
bilingual printed placeholder. Missing roster rows are different: a missing
`Sabbath Calendar` sheet or missing date row is an API error because there is no
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

The API machine-translates three schedule metadata fields (`Special Remark`,
`Tithe Purpose`, and `Pastor Travel`) from English into Traditional Chinese
(`zh-TW`), Simplified Chinese (`zh-CN`), and Spanish (`es`), returned in
`metadataTranslations` alongside the original English. These short notes are
unlabeled by design. For Tithe Purpose and Pastor Travel, the app shows the
original English on the next line when it differs from the translation; the
Special Remark banner shows the translation only. This path must not be used
for Bible text, Bible references, names, hymns, or sermon titles. How it works
in detail is in
[Offline bulletin translation](../feature_designs/offline_bulletin_translation.md#current-behavior).

The printed Brooklyn bulletin's English Sabbath Encouragement is a labeled
machine translation from the Chinese original (no original English exists), with
recognized Bible quotations printed as BSB text. Read [What the printed bulletin
does today](sabbath-encouragement-copyright.md#what-the-printed-bulletin-does-today)
before changing that source or translation policy. Do not extend machine
translation to Scripture, names, or worship content.

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

### Bible references

The app recognizes book names in every app language and same-chapter ranges. When it
can read an entry, it shows that reference in the app's language and its **Read now**
button opens it. For several passages, it shows and opens only the first one; for a
range across chapters, it shows and opens only its first verse; and a bare book name
opens chapter 1. An
entry it can't read, such as an unknown book, a backwards range, or a chapter range
like `John 3-5`, is shown as entered, and **Read now** opens Genesis 1:1 rather than
guessing a location (`parseScriptureReference` in `services/BibleService.ts`,
`app/(tabs)/home/bulletin.tsx`).

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
3. left intentionally blank; right: Church at Worship, followed by the vertical
   giving section with the QR codes;
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
passages can trigger a preflight warning or affect pagination. The Sabbath
Encouragement's English column is the one exception; see
[Privacy, auto-translation, and name behavior](#privacy-auto-translation-and-name-behavior).

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

A reserved slot prints nothing but keeps its space, so turning a code on or off
doesn't reflow the bulletin. The same rules apply to Queens Regular, Queens Holy
Communion, and Brooklyn:

- **Mobile App** prints. Unlike the giving codes, it never falls back to the
  placeholder image: if its code isn't found, the slot stays blank.
- **ACH/card** always prints.
- **Zelle** stays reserved in Queens until the treasury confirms the address
  (#384). Brooklyn has no Zelle destination, so its third slot is always empty.

Asset file names end in `_368x368.jpg`; the mobile-app caption is
`Download Mobile App | 下載 APP`. The script finds each code by its exact file name
anywhere in Drive, skipping files in the trash, then by its Script Property (such as
`MOBILE_APP_QR_IMAGE_FILE_ID`).

The QR workflow generates `mobile_app_qr_code_368x368.jpg`, pointing at
`https://app.nyccsda.org/download`, and uploads it to Drive with the giving codes
([Admin Runbook](admin-runbook.md#bulletin-qr-codes)).

**Deploying the mobile app code at launch** (#323). The code leads to the store
pages, so the script that prints it must not reach production until the app is
public on both Google Play and the App Store. Since 1.0.0 it is in the script on
`main`, and in every branch made from `main` since then. Until both stores have
released the app, don't deploy the bulletin Apps Script at all: not by the
**Deploy Bulletin Apps Script** workflow, `npm run apps-script:deploy`, or
`npm run apps-script:push`. Each of them changes production whatever the branch
(see the Apps Script README's [Commands](../../google-apps-script/README.md#commands)). Once both
stores have released the app:

1. Check that https://app.nyccsda.org/download sends an Android phone to Google
   Play and an iPhone to the App Store.
2. Check that `mobile_app_qr_code_368x368.jpg` is in Drive and not in the trash. If
   `MOBILE_APP_QR_IMAGE_FILE_ID` is set, check that it names that file, not an old
   placeholder.
3. Run **Deploy Bulletin Apps Script** from `main`; see
   [Deploying the bulletin Apps Script](admin-runbook.md#deploying-the-bulletin-apps-script).
4. Generate test bulletins for Queens (Regular and Holy Communion) and Brooklyn,
   and scan the printed code with an Android phone and an iPhone.

## Deployment and verification

The repository is the canonical source. Local WSL deployment uses the existing
Apps Script deployment ID so the production `/exec` URL does not change. Setup
(installing clasp, `clasp login`, and copying the `.example` config files) is in
the [Apps Script README](../../google-apps-script/README.md#setup), and the test,
push, and deploy commands, with what each one changes in production, are in its
[Commands](../../google-apps-script/README.md#commands). Until the app is public
in both stores, don't push or deploy; see [Giving QR slots](#giving-qr-slots).

The deployment helper:

- regenerates `PinyinPro.gs` from the pinned npm dependency;
- writes ignored `.clasp.json` and `.clasp-deployment.json` from environment values;
- accepts `APPS_SCRIPT_PROJECT_ID`, `APPS_SCRIPT_DEPLOYMENT_ID`, and an optional
  `APPS_SCRIPT_DEPLOYMENT_DESCRIPTION` or `DEPLOYMENT_DESCRIPTION`; and
- can write `CLASPRC_JSON` to the WSL clasp credential file for CI-style authentication.

The current workflow is manual: use the printed-bulletin dialog after the reviewed
sheet rows are ready. Remove any obsolete spreadsheet installable triggers left by
the former append-only workflow; the current source does not install an automatic
content-submission trigger. Keep the `onScheduleNameCheckEdit` trigger: it is the
unknown-name dialog described under
[Name not in the Name Dictionary](#name-not-in-the-name-dictionary-popup).

From GitHub, the manual **Deploy Bulletin Apps Script** workflow runs the same
deploy with the `production` environment's `APPS_SCRIPT_PROJECT_ID`,
`APPS_SCRIPT_DEPLOYMENT_ID`, and `CLASPRC_JSON` secrets; a push or PR never deploys. How to run and approve it, only from
`main`, is in the Admin Runbook's
[Deploying the bulletin Apps Script](admin-runbook.md#deploying-the-bulletin-apps-script).

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
| API returns `No schedule found for …` | Missing `Sabbath Calendar` date row (a missing or renamed tab shows as a contract violation instead) | Restore the exact tab name and a matching Date row |
| A field moved to the wrong location | Header renamed/reordered or repeated header occurrence changed | Restore the exact header contract and deploy matching code |
| Header says contract violation | A protected header was changed | Update Apps Script/tests/app first; technology group restores the header |
| A roster cell is pale red | The same name is in another F:Y cell of that row | Hover over the cell to see the other roles; reassign one, or leave it if intended. The color clears on the next edit |
| No unknown-name dialog, only an alert | No bulletin admin has used the Printed Bulletin menu yet, or the trigger owner's account was removed | Have an admin open **Printed Bulletin → Create Google Doc + PDF…**; if the owner was removed, delete the `SCHEDULE_NAME_CHECK_TRIGGER` script property first |
| A red cell shows no hover note | The cell already had a planner's own note, which the script keeps | Read the row to find the other role, or delete the planner's note so the script can add its own |
| Chinese text appears in Sabbath Calendar | Typed or pasted into A:Y | The onEdit guard should clear it with a popup; if it stays with a red corner, check **Extensions → Apps Script → Executions** for errors. Use Name Dictionary for approved English names |
| New quarter rows lack validation | Maintenance did not run or append failed | Open the workbook as an editor, inspect Apps Script logs, and rerun maintenance; do not manually limit the rule to X53 |
| Old rows disappeared | They were hidden, not deleted | Unhide rows when historical planning is needed; maintenance is non-destructive |
| Google Doc is in Trash or not updated | Saved ID points to a trashed/deleted file | Run generation again; the script treats it as missing and creates a new Doc in the configured folder |
| PDF has an extra page or clipped fold content | Layout overflow or altered gutter/margins | Restore the renderer's panel/gutter structure; never clip text to fit |
| Bible reference repeats English in Chinese slot | Renderer bypassed bilingual helper | Use `formatBibleReferenceForPrint_` and the deterministic Chinese book map |
| Hymn English appears in Chinese slot | A manually supplied Chinese value was overwritten | Preserve the supplied side; only the missing side may use `PrintedHymnLookup.gs` |
| QR slot is blank | The slot is reserved (Zelle, or Brooklyn's third slot), the deployed script predates the mobile app code, or that code isn't in Drive | Check [Giving QR slots](#giving-qr-slots) and the Drive file name before changing the layout |
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
