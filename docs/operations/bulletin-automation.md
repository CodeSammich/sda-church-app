# Bulletin Automation Operations

This is the operator runbook for the church bulletin system: the master Google
Spreadsheet, the bound Apps Script project, the public mobile-app API, and the
printed Google Doc workflow. It records the behavior to preserve when
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
  [sheet layouts](#the-three-mandatory-sheets), [Data precedence](#data-precedence-and-fallback-behavior) and
  privacy rules, [Deployment and verification](#deployment-and-verification), and
  the [Change checklist](#change-checklist).

Contents:

- [System boundaries](#system-boundaries)
- [The three mandatory sheets](#the-three-mandatory-sheets)
- [The `Leadership` tab](#the-leadership-tab)
- [The `Hymn Bank` tab](#the-hymn-bank-tab)
- [Header protection and validation automation](#header-protection-and-validation-automation)
- [Data precedence and fallback behavior](#data-precedence-and-fallback-behavior)
- [Privacy, auto-translation, and name behavior](#privacy-auto-translation-and-name-behavior)
- [Chinese script](#chinese-script)
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
├── Weekly Data           reviewed final-owner bulletin content
├── Name Dictionary        private physical-print name resolution
├── Leadership             pastors and elders, for printed titles
└── Hymn Bank              hymns to copy into Weekly Data; no script reads it
        │
        ├── BulletinApi.gs ── public, privacy-filtered JSON ──> mobile app
        │
        └── Printed*.gs ── authorized full-name render ──> Google Doc
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
| `google-apps-script/BulletinApi.gs` | Public API, expected sheet columns, data joins, privacy filtering, and metadata translations |
| `google-apps-script/BulletinScheduleMaintenance.gs` | Background `onOpen` maintenance, header protection, validation, hiding, and quarter expansion |
| `google-apps-script/ScheduleAssignmentChecks.gs` | Same-day roster conflict highlights and Name Dictionary unknown-name warnings |
| `google-apps-script/PrintedBulletin.gs` | Shared printed-bulletin code: Sheet menu and prompts, data preparation, Google Doc creation, page and table helpers, and the shared cover, giving, announcement, hymn, Bible, and QR helpers |
| `google-apps-script/PrintedCommunionBulletin.gs` | Communion service content both locations print: fixed Communion/Foot Washing readings, response hymn, and ceremony panels |
| `google-apps-script/PrintedQueensBulletin.gs` | Queens Regular and Queens Communion page layouts |
| `google-apps-script/PrintedBrooklynBulletin.gs` | Brooklyn cover, Zoom, Sabbath School, worship, Communion, and giving footer layouts, and placing the Sabbath Encouragement spread |
| `google-apps-script/PrintedHymnLookup.gs` | Reviewed bidirectional English/Chinese hymn-number lookup for physical printing |
| `google-apps-script/SabbathEncouragement.gs` | 52-page Brooklyn encouragement rotation containing Ellen White quotations plus Bible/editorial/other source material, machine translation, direct Bible replacement, and the bilingual printed spread |
| `google-apps-script/appsscript.json` | Apps Script runtime and web-app manifest |
| `google-apps-script/PinyinPro.gs` | Generated on each push or deploy from the pinned `pinyin-pro` npm dependency; ignored by Git, never edited by hand |
| `services/BulletinService.ts` | App response types, date selection, local cache, refresh cooldown, and empty-location behavior |
| `app/(tabs)/home/bulletin.tsx` | Digital bulletin sections, labels, privacy-safe names, translations, and staff link |
| `test/apps-script-physical-bulletin.test.ts` | Physical layout, sheet columns, privacy, lookup, QR, and maintenance regression tests |
| `test/apps-script-bulletin-merge.test.ts` | Intake mapping and precedence regression tests |
| `test/apps-script-schedule-assignment-checks.test.ts` | Roster conflict highlighting and unknown-name warning tests |
| `test/apps-script-bulletin-resilience.test.ts` | Renamed and moved tabs and columns found by their tags, and bulletins without their schedule |
| `test/integration/bulletin-api.mjs` | Opt-in read-only production API contract check |

## The three mandatory sheets

The scripts read these three tabs, and `Leadership`. Row 1 holds the headers.
In `Sabbath Calendar` and `Weekly Data`, each column is found by its header,
wherever it is, and still found after it's renamed (see [Columns are read by
name](#columns-are-read-by-name)). Keep those header names as documented,
though capitalization and extra spaces don't matter. The `Name Dictionary` is
read by position: English names in column A, Chinese in column B. All four
tabs can be renamed.

### 1. `Name Dictionary`

Row 1 must be:

```text
English Name | Chinese Name
```

Data begins on row 2.

- `English Name` is the canonical English name used for physical printing.
- `Chinese Name` is the traditional-Chinese display name. The dictionary normally
  stores Chinese names surname-first. A name prints exactly as typed, in either
  script. A character the bulletin's Chinese font lacks, such as most
  Simplified-only characters (张, 陈), prints in the fallback font (see
  [Type](#type)); in Traditional it prints in the bulletin's font. The
  unknown-name dialog's **Add** warns once about Simplified-only characters
  (see [Name not in the Name Dictionary](#name-not-in-the-name-dictionary-popup)),
  but never converts a name.
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

This is the broadly shared schedule and roster sheet. Its columns, in their
current order:

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
  intentional. A location's copy can be named outright, such as `Queens Offering
  Prayer` or `Brooklyn Chair/Pastoral Prayer`, and is then found wherever it is.
  Otherwise each location's copy is the one on its side of `Brooklyn Sermon`:
  Queens's before it, Brooklyn's after (`findScheduleColumn_`). Without a
  `Brooklyn Sermon` column, the first copy is Queens's and the second Brooklyn's.
- `Flower Offering` belongs to the Queens worship program and schedule data. It
  does not belong in the Queens Church at Study printed section.
- `Technician`, `Encouragement`, and `Sabbath School` are Brooklyn fields.
  Printed Brooklyn uses `Encouragement`, not the older `Testimonies` wording.
- `Announcements` and `Sunset Time` remain recognized legacy/API response aliases
  in the source, but they aren't expected columns, so nothing reports them
  missing. The app shows neither. An `Announcements` column would still reach
  the printed bulletin, which uses it when no printed announcements were saved
  for that date; the printed sunset time is calculated, not read from the
  sheet.
- The roster conflict highlights, the unknown-name checks, and the
  English-only guard find their columns by name too, wherever they are
  (`getSchedulePersonColumns_`, `getSabbathCalendarColumnNumbers_`). A column
  you add is left alone by all three unless it's also added to
  `BULLETIN_SHEET_COLUMNS`. Keep `Date` and `Quarter` in columns A and B,
  which the technology group's protection covers.

The header row is protected for the technology group
`technology@nyccsda.org`. Columns A:B are also protected for that group across
the schedule. Ordinary schedule cells remain governed by the spreadsheet's
normal sharing permissions.

### 3. `Weekly Data`

This is the reviewed, final-owner intake sheet, filled in week by week. Keep
one row per Sabbath and location. Its columns:

```text
Date | Location | Bible Verses | English Sermon Title | Chinese Sermon Title |
Sabbath School Hymn 1 | Sabbath School Hymn 2 | Sabbath School Hymn 3 |
Hymn of Praise | Special Music Title | Hymn of Response
```

Any order works. This one puts the speaker's columns first, then the hymns in
the order they're sung.

Until #558 the weekly content was in a tab named `Sabbath Sermon Data`, with an
English and a Chinese column for each hymn of praise and response, and no
Sabbath School or special music columns. #558 replaced it with this tab.

Opening the spreadsheet adds the rows to fill in: a `Queens` and a `Brooklyn`
row, with the date, for this coming Sabbath and the one after, the two weeks the
app shows (see [Automatic quarter and visibility
maintenance](#automatic-quarter-and-visibility-maintenance)).

Rows 2 and 3 are worked examples, one for each location, with `Example` in
`Date`. Nothing reads a row whose `Date` isn't a date, so they never reach a
bulletin, and the date rule below lets them stay. Keep them at the top for
whoever fills in the week.

The script keeps this tab in shape, so nobody has to guard it. Each time the
spreadsheet opens, a deleted or emptied `Weekly Data` is set up again with
these headers and the two example rows (`WEEKLY_DATA_EXAMPLE_ROWS`), and an
expected column that's gone is added back, empty, at the far right, with a
notice naming it (`ensureWeeklyDataTab_`). Nothing is renamed, moved, or
removed. A renamed tab or column isn't gone: it's still read by its tag, so
nothing is added back for it. Only one renamed before its first tag, or
deleted, comes back empty: move any data across and delete the renamed column.

Rules:

- `Date` is a Saturday, shown as `YYYY-MM-DD`. Typing `2026-11-07` or
  `11/7/2026` both work, since Sheets turns either into a date. A data
  validation rule rejects anything else, and any date that isn't a Saturday,
  with a popup in English and Simplified Chinese. The same text shows as a hint
  on a selected date cell. The rule starts at row 2, below the header, and each
  open sets it again in case pasted cells replaced it.
- `Location` is `Queens` or `Brooklyn`, chosen from a dropdown. Anything else
  is rejected with a popup in English and Simplified Chinese, and each open sets
  the dropdown again.
- `English Sermon Title` and `Chinese Sermon Title` are separate on purpose:
  people write both, and neither is machine-translated from the other.
- Chinese in the title and hymn columns here, and in the print dialog's
  announcements, prints exactly as typed. A character the bulletin's Chinese
  font lacks, such as most Simplified-only characters, prints in the fallback
  font (see [Type](#type)). The Chinese Bible reference isn't typed: it's built
  from the English one.
- `Hymn of Praise` and `Hymn of Response` each hold one hymn, typed in either
  language like the Sabbath School hymns below, such as `AH 1 Praise to the Lord`
  or `第452首 遵命有福`. The script files it as English or Chinese by how it's
  written (`getBulletinHymnLanguage_`), and the hymnal lookup fills in the other
  language where it can. A tab that still has the older `English …` and
  `Chinese …` columns for either hymn is read too, and a supplied side is never
  overwritten.
- `Bible Verses` stores the reference used by Church at Study and the digital
  bulletin's Today's Verse. It may be a same-chapter range or supported
  semicolon-separated references, such as `John 3:16-18; Psalm 23`. The printed
  bulletin uses it too, and **Create Google Doc…** won't make the Doc while it's
  blank, `TBD`, or has a passage it can't read, such as a misspelled book, a
  chapter the book doesn't have, or a bare `18` after a comma (#622). Write
  `John 3:16; John 3:18` instead.
- `Sabbath School Hymn 1` to `3` each hold one opening hymn, typed in either
  language as a number, a title, or both, such as `第12首 讚美上帝大君王`,
  `AH 73 Holy, Holy, Holy`, or `還要等多久`. Chinese text or a bare number is
  read as a Chinese hymnal number. Leave unused cells blank. There's no
  closing-hymn column: the closing repeats every opening hymn, so both
  bulletins show them once, as the opening and closing hymns.
- The [`Hymn Bank` tab](#the-hymn-bank-tab) has every hymn written this way,
  ready to copy into any of the hymn cells.
- `Special Music Title` is the piece performed. Who performs it stays in the
  `Sabbath Calendar`'s `Special Music`, which is a Queens column, so Brooklyn's
  piece shows with `TBD` for its performer.
- The week's Sabbath School lesson needs no column. Both bulletins read its
  title from the Adventech lesson catalog: the adult lesson whose week (Sabbath
  to Friday) ends the day before that Sabbath, since the class discusses the
  week just studied.
- There are intentionally no speaker password, source, last-updated, or
  updated-by columns in this tab.
- Nonblank cells in this sheet feed both digital and printed bulletins. A blank
  cell permits the documented fallback behavior, except `Bible Verses`, which
  the printed bulletin needs (see `Bible Verses` above).

The printed-bulletin dialog links directly to this sheet. This is the only
normal bulletin-content intake workflow.

## The `Leadership` tab

This optional tab lists the church's pastors and elders, so the printed
bulletin can give them their titles without naming anyone in the schedule or
the code. Keeping it current is a maintainer's job; see
[Updating pastors and elders](admin-runbook.md#updating-pastors-and-elders).

```text
     | Pastors   | Elders
Head | Paul Wen  | Ruth Ho
     | Grace Lin | Mark Sun
```

- Row 1 holds the headers. `Pastors` and `Elders` are found by a header that
  holds only the title, in any column and either case, in English, Chinese, or
  both (`Pastors`, `Pastor(s)`, `Pastors 牧師`, and `牧師` all work; `Pastors
  list` doesn't).
- Enter one plain name per cell, in English or Chinese, spelled as in the
  `Name Dictionary`. A `Pastor`/`Elder` typed before the name, or `牧師`/`長老`
  before or after it, is dropped.
- A listed person prints as `Pastor …` / `…牧師` or `Elder …` / `…長老` on every
  printed person row except the roster grid, whichever language the schedule
  cell uses, as long as the person is in the `Name Dictionary`. Someone who
  isn't must be scheduled under the same spelling, and gets the title only on
  that language's line, with `—` on the other. A person on both lists prints
  as Pastor.
- The roster grid (`Meetings Schedule`) keeps plain names, since its cells are
  too narrow for titles. Enter plain names in the `Sabbath Calendar` too:
  titles come only from this tab.
- `Head` in a column other than `Pastors` and `Elders` (column A above) marks
  that row's pastor as the one who leads Communion; the topmost `Head` row
  counts. It is only read, never printed: the title stays `Pastor`. Without a
  `Head` row, or with its `Pastors` cell blank, the first name in `Pastors`
  leads Communion; with no pastors listed, those rows print `TBD`.
- Edits take effect on the next print, with no deploy. If the tab is missing,
  names print without titles.
- To add another title, add a column here and an entry in
  `PHYSICAL_NAME_TITLES` in `PrintedBulletin.gs`.

## The `Hymn Bank` tab

This optional tab lists every hymn in the church's two hymnals, to copy into
`Weekly Data`'s hymn cells instead of typing them (#606). No script reads it,
so it can be renamed, sorted, or deleted, and refreshing it needs no deploy.

```text
Chinese Hymnal 505 中文赞美诗 | SDA Hymnal 1985 英文诗歌本
第1首 在主寶座前              | AH 82 Before Jehovah’s Awful Throne
第163首 門外有一位客人        |
                              | AH 2 All Creatures of Our God and King
```

- Each cell holds one hymn, written the way `Weekly Data` takes it. Copy a
  cell and paste it into a hymn cell. The other language is filled in from it,
  as for any typed hymn.
- The 505 comes first, in number order, with the same hymn in the 1985 beside
  it wherever the hymnals' number map pairs them. The 1985 hymns with no 505
  pair follow, also in number order.
- To find a hymn by number or title, press Ctrl+F (⌘F on a Mac).
- Hymn titles are in Traditional Chinese, because they print (see [Chinese
  script](#chinese-script)); the headers are staff-facing, so they're
  Simplified. The app stores the 505's titles in Simplified, as printed on
  each hymn's score (`scripts/scrape-chinese-505-hymnal.mjs`). The script
  converts them with `opencc-js`, and its `TRADITIONAL_FIXES` corrects the
  characters the converter gets wrong, such as 祢, which it turns into 禰.

To make the tab, or refresh it after the app's hymnal data or number map
changes, run this from the repo:

```sh
node scripts/export-hymn-bank.cjs --output hymn-bank.tsv
```

Open `hymn-bank.tsv`, select everything, and copy it. In the spreadsheet, add a
tab named `Hymn Bank` (or clear the old one), click cell A1, and paste: the
tabs in the file split it into the two columns. Then **View → Freeze → 1 row**
keeps the headers in sight, and **Protect sheet** (right-click the tab), with
**Restrict who can edit this range**, lets staff copy cells but not change
them. `test/hymn-bank.test.ts` checks that the app and the printed bulletin
read every cell as its own hymn.

## Header protection and validation automation

The bound spreadsheet's simple `onOpen` maintenance path runs for every user who
can open the workbook. It is intentionally quiet and does not require an email
allowlist. The visible custom menu exposes only the Google Doc creation action
and **Fonts…**; maintenance and setup operations stay hidden.

On open, the script:

1. removes the fixed-name rules the header rows had before #558;
2. normalizes the header protections and restricts their editors to
   `technology@nyccsda.org`;
3. protects `Sabbath Calendar!A:B` for the technology group;
4. appends missing Saturdays so the next three quarters always have rows, plus
   the fourth quarter ahead when the current quarter is in its final 21 days;
5. puts back a deleted `Weekly Data` tab or its missing columns, adds its rows
   for the next two Sabbaths, and sets its `Date` and `Location` rules;
6. hides old schedule rows without deleting them;
7. repaints the conflict highlights described below across every schedule row;
8. tags the tabs and columns it finds by name, so a later rename doesn't lose
   them (see [Columns are read by name](#columns-are-read-by-name)); and
9. shows one alert, in English and Simplified Chinese, listing any expected
   column or tab still missing from `Sabbath Calendar` or `Weekly Data`, and
   any tab or column renamed, or any name more than one column has, since the
   last notice.

### Columns are read by name

The API and the printed bulletin find every `Sabbath Calendar` and `Weekly
Data` column by its header, wherever it is. Each open also tags the four tabs,
and each of those columns, with
[developer metadata](https://developers.google.com/apps-script/reference/spreadsheet/developer-metadata),
which stays with a tab or column through a rename or a move and can't be seen
or edited in Sheets (`tagBulletinTabsAndColumns_`, #580). The rules, the
reasons for them, and every known edge case are in
[Bulletin spreadsheet tags](../feature_designs/bulletin_spreadsheet_tags.md).
For the people running the sheet:

- moving a column, or adding one the scripts don't use, changes nothing;
- renaming a tab or column the scripts use changes nothing either, once the
  spreadsheet has been opened since the deploy: the app, the printed bulletin,
  the roster checks, and the English-only guard keep reading it by its tag. The
  next open's alert names each rename once, such as `Sabbath Calendar:
  "Speaker" is read as Queens Sermon`. Nothing needs doing, though renaming it
  back is fine too;
- a tab or column made again under its old name takes over from the renamed
  one, and a copied tab doesn't take over from an original that still has its
  name;
- when two columns have the same expected name, the alert says which one is
  read, such as `Sabbath Calendar: 2 columns are named Date; column B is
  read`: the one with data, and then the original. A prayer column that
  appears on both sides counts on its own side, such as `2 Queens columns are
  named Offering Prayer`. Rename the extra column, or delete an empty one an
  open added;
- deleting a column the scripts use, or renaming it before the spreadsheet has
  been opened since this was deployed, blanks only that field, in the app and
  in print, and the rest of the bulletin still loads. On `Weekly Data`, the
  next open adds the column back (see [`Weekly Data`](#3-weekly-data)). On the
  `Sabbath Calendar`, the alert above names it each time the spreadsheet
  opens, until a column with that name is back, in any position. A repeated
  prayer column, listed as `Queens …` or `Brooklyn …`, goes back on its
  location's side of `Brooklyn Sermon`, named without the location. The alert
  also names a `Weekly Data` column when the person opening the sheet can't
  edit its protected header row, so the column couldn't be added back;
- a missing `Weekly Data` tab, or one without `Date` or `Location`, leaves every
  week's content blank until the next open puts it back. A deleted `Sabbath
  Calendar`, or one without `Date`, leaves every week without its schedule (see
  [Data precedence and fallback behavior](#data-precedence-and-fallback-behavior)).
  A `Sabbath Calendar` without `Date` or
  `Quarter` also stops the open-time upkeep from its quarter rows on (steps 4
  to 7 above) until the column is back. The tagging in step 8 still runs.

Since the header row and `Sabbath Calendar!A:B` are protected, an open by
someone outside the technology group may not be able to tag them; a later open
by the group does, and nothing else waits on it.

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
- the next three quarters always have rows, so planners have a year of
  Saturdays to plan in; missing Saturdays are appended in date order with blank
  assignment cells and the correct quarter value, which also catches up a sheet
  that has fallen behind;
- during the final 21 days of a quarter, the fourth quarter ahead is appended
  too, so each quarter adds exactly one new quarter, starting three weeks and
  three quarters later; and
- nothing is appended past that fourth quarter, even if later dates were
  entered by hand.

The operation is idempotent. It compares existing dates before appending, so
opening the sheet repeatedly does not create duplicates. If rows already exist
for a future quarter, the script does not delete or rewrite them.

The same run gives `Weekly Data` a `Queens` and a `Brooklyn` row, with the date
filled in, for this coming Sabbath (today, on a Saturday) and the one after
(`weeklyDataSabbaths` in `BULLETIN_SCHEDULE_MAINTENANCE_CONFIG`). It adds a row
only where that date and location has none, however the date is written, so a
row staff added themselves is never repeated. New rows go at the bottom, and
nothing is removed, reordered, or hidden. Every run also sets the `Date` column's
`yyyy-mm-dd` format and its Saturday rule, described under
[`Weekly Data`](#3-weekly-data). A problem here is logged and doesn't stop the
`Sabbath Calendar` upkeep.

### Roster conflict highlights and unknown names

`ScheduleAssignmentChecks.gs` helps planners catch two roster mistakes in the
person columns: the expected columns from `Queens Sermon` through `Sabbath
School`, each found by its header wherever it is. Row 1, the date, quarter,
and service metadata columns, and any column you add are never checked or
changed.

#### Same person twice on one Sabbath (automatic red)

If a name appears in more than one roster cell of the same row, every cell holding
it turns pale red (`#ea9999`, the Sheets "light red 2" color). No click or
setup is needed.

- Queens and Brooklyn columns are compared together, so the main case caught is
  one person scheduled at both locations.
- The rule is deliberately simple: any repeat is red. Some repeats are fine
  (for example Offering Prayer and Special Music at one service), and the
  planner decides whether to leave those. The value is never changed.
- Each red cell has a note, shown by the small black triangle in its top-right
  corner. Hovering over the cell lists the person's other roles that Sabbath by
  column header, for example `Duplicate / 重复: English Teacher`. The repeated
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
clears notes that start with `Duplicate / 重复:` (or the earlier `Duplicate /
重複:` and `Roster check / 名單檢查` wordings). Other cell colors and
planners' own notes are left alone; a cell with a planner's note still turns
red but keeps that note. Do not use `#ea9999` for manual highlighting in the roster columns.

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

If the Chinese name has a Simplified-only character, such as 张 or 聪, **Add**
first says so in English and Simplified Chinese, and becomes **Add anyway**
(#623). The editor can type the name in Traditional, or add it as typed: names
print exactly as they're stored. A name is never converted, because many
surnames, such as 余, 于, 范, 姜, 沈, 云 and 温, are also Traditional characters.
Only characters that are in neither Traditional nor Taiwan's or Hong Kong's
forms, from OpenCC's tables (`SIMPLIFIED_ONLY_CHINESE_CHARACTERS_`), count.

Google does not let simple triggers open HTML dialogs or create the
installable trigger that can. So the dialog turns itself on the first time an
account listed in `PHYSICAL_BULLETIN_ADMIN_EMAILS` uses **Printed Bulletin →
Create Google Doc…**, because that click runs with full authorization.
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
2. Nonblank values from matching `Weekly Data` rows are applied by
   location. If duplicate rows exist, the lowest row in the sheet wins for each
   nonblank field (the code would order them by a `Last Updated` or `Timestamp`
   column, but the tab has neither); a blank later cell does not
   erase an older nonblank value.

The printed bulletin uses the same `Weekly Data → Bible Verses` value as the
app, with no print-only fallback (#622). The print dialog had a verse picker
until 1.6.1, which saved a print-only verse in a `PRINTED_BIBLE_VERSE_*` Script
Property; the next **Create Google Doc…** deletes any left.

Blank content remains blank in the API and renders as `TBD` in the app or as the
bilingual printed placeholder. The exception is a blank `Bible Verses`: the
printed bulletin isn't made until it's filled in.

A missing schedule is different: the `Sabbath Calendar` tab, its `Date` column,
or the Sabbath's row is gone, so there's no schedule record at all (#580).
Then:

- **App 1.6.0 and later** send their version with each request
  (`appVersion=1.6.0`), and get the bulletin with every schedule field blank,
  `Weekly Data`'s content, and `scheduleNotSet: true`. The app shows "This
  Sabbath's schedule isn't set yet" above the rest, which shows `TBD`. It
  doesn't store that bulletin, so a copy it stored earlier, with a schedule,
  is shown instead, and the next look asks again.
- **Older apps, and the API checks** (`verify-bulletin-api` and the external
  dependency monitor), get the error as before: `Schedule sheet not found: …`,
  `Schedule sheet is missing a Date column`, or `No schedule found for …`. An
  older app keeps showing the last copy it stored, rather than a blank one it
  can't explain. `SCHEDULE_NOT_SET_APP_VERSION` in `BulletinApi.gs` sets the
  first version that gets the bulletin instead. This is a
  [changeover](../feature_designs/bulletin_spreadsheet_tags.md#changeovers):
  a cleanup issue opens once no older app has asked for 14 days.
- **The printed bulletin** is still made, with its roster as `TBD`, and the
  dialog says the Sabbath Calendar has no schedule for that Sabbath yet.

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

## Chinese script

The printed bulletin and the text staff read in the spreadsheet use different
Chinese scripts on purpose (#565):

- **Printed bulletins are in Traditional Chinese.** That covers the church
  name, headings, Bible book names, the schedule, the giving notes, and the
  Sabbath Encouragement. The bulletin is formal, and most of the people who read
  it on paper are older members. Younger readers mostly use the app, which shows
  either script. What staff type (names, titles, announcements) prints as
  typed, in either script.
- **Staff-facing text is in English and Simplified Chinese.** That covers the
  Create bulletin dialog, alerts, error messages, cell notes, and column help.
  The people who run the bulletin read Simplified. The text uses the terms in
  Google Sheets' Simplified Chinese interface (电子表格, 工作表, 单元格), so it
  names what staff see on screen.

Don't change one to match the other. A comment above the staff-facing strings in
each script points here. Anything that reads input accepts both forms, for
example `牧[師师]` and `長老|长老`.

## Digital mobile bulletin behavior

The native mobile app is the primary digital product. The PWA is a testing and
preview surface, not the canonical release channel.

### Sections and location-specific rules

- Queens has separate Sabbath School and Church at Worship sections.
- Queens `Flower Offering` appears in the worship program, not under Church at
  Study.
- Both Sabbath School sections show the opening and closing hymns on one row,
  each hymn with its own button, and the week's lesson with a **Read lesson**
  button that opens it on the Sabbath School website. If the lesson catalog
  can't be reached, the lesson row shows `TBD`.
- Brooklyn's digital Sabbath School section otherwise contains only Prayer,
  Sabbath Encouragement, and Sabbath School. Unplanned welcome, song/Bible
  verse, closing prayer, and Five Minutes Break rows are omitted.
- The Special Music row shows the piece under its performer when the weekly
  sheet names one. Brooklyn, which has no performer column, shows the row only
  then, with `TBD` for the performer.
- A hymn links to whichever of the app's hymnals has it, and one that none has
  gets a **Search YouTube** button instead (see
  [Bulletin hymn resolution](../feature_designs/bulletin_hymn_resolution.md)).
- Brooklyn uses the label `Sabbath Encouragement`, not `Sabbath Message`.
- The bulletin doesn't link to the master spreadsheet, which only church
  accounts can open (#553).
- Every blank content field displays `TBD`; a populated field suppresses the
  cautious joint-service fallback note for Brooklyn.

### Caching and refresh

- The API caches privacy-filtered responses for 120 seconds. A response for an
  app from 1.6.0, which may come without its schedule, is cached apart from one
  for older apps and the API checks.
- The app caches successful bulletin responses per Sabbath date on the device,
  except one without its schedule (`scheduleNotSet`), which never replaces a
  stored copy.
- Next Week loads lazily when opened.
- A manual refresh bypasses the device cache but still observes the server's
  two-minute Apps Script cache and enters a five-minute local cooldown.
- A cached future bulletin becomes stale when its Sabbath begins. Entry,
  foreground resume, and the Sabbath boundary recheck the date.

### Bible references

The app recognizes book names in every app language, their published short forms
(such as `Jn`, `Sal`, or 約), and same-chapter ranges. When it
can read an entry, it shows that reference in the app's language and its **Read now**
button opens it. For several passages, it shows and opens only the first one; for a
range across chapters, it shows and opens only its first verse; and a bare book name
opens chapter 1. An
entry it can't read, such as an unknown book, a backwards range, or a chapter range
like `John 3-5`, is shown as entered, and **Read now** opens Genesis 1:1 rather than
guessing a location (`parseScriptureReference` in `services/BibleService.ts`,
`app/(tabs)/home/bulletin.tsx`).

## Printed bulletin generation

The **Printed Bulletin → Create Google Doc…** action is the only normal
manual workflow. It makes only a Google Doc, with no PDF: staff edit the Doc
most weeks (a long sermon title, a change of special music), so a PDF made with
it would soon be out of date, and Google Docs can download a PDF whenever one is
needed. It opens a staff dialog that:

1. defaults to the closest upcoming Saturday;
2. links the operator to the `Weekly Data` tab;
3. lets the operator select Queens or Brooklyn;
4. supports Queens Regular or Queens Holy Communion; Brooklyn Communion is
   intentionally disabled;
5. shows the Bible reading from `Weekly Data → Bible Verses`, read-only, the
   same one the app shows. While it's blank or can't be read, the dialog says
   why (and, for one it can't read, how to write it), and **Create** stays off. To change it, close the
   dialog, edit `Weekly Data`, and open the dialog again;
6. optionally accepts printed announcements; and
7. makes a Word copy of the week's Doc for printing in Songti TC, which needs a
   Mac with Word. See [Printing in Songti TC needs a Mac](#printing-in-songti-tc-needs-a-mac).

A long passage still asks before it's printed, since it can push the bulletin
onto another page.

The generator requires the operator to authorize Sheets, Docs, and Drive access.
The anonymous public API never invokes the print generator.

### Output names and Drive folders

The canonical names are:

```text
YYYY-MM-DD Bulletin - Regular Worship
YYYY-MM-DD Bulletin - Holy Communion
```

The Google Doc is stored in the location-specific output folder:

- Queens: the configured Queens folder;
- Brooklyn: the configured Brooklyn folder;
- legacy folder configuration is only a fallback.

If a saved Google Doc ID is valid, the generator updates it. A trashed, deleted,
or inaccessible saved Doc is treated as missing and a new Doc is created. This is
why finding an old Doc in Trash does not cause the next run to update that copy.
Before #558 the generator also made a PDF. If one was made for the same date and
location, making the Doc again moves that PDF to Drive Trash, so it can't be
mistaken for the edited Doc.

The Doc IDs, and each week's printed announcements, are Script Properties by
Sabbath. The project settings page can manage only 50 properties by hand, so
after each Doc is made the generator deletes these, and the PDF IDs from before
#558, for Sabbaths more than four weeks past (#622). A reprint of an older week
makes a new Doc. The Docs and PDFs themselves stay in Drive, and no other Script
Property is touched.

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

The Communion ceremony has fixed references and fixed order. The `Weekly Data`
study verse cannot replace the Foot Washing or Communion readings. Communion service
assignments use the `Leadership` tab's head pastor (or, without one, its first
pastor), with the title, except for Congregation. Brooklyn Communion is
rejected server-side and should remain disabled in any intake UI.

Brooklyn Regular is three physical pages:

1. left: fellowship/service locations; right: shared three-location cover plus
   Mandarin-only Zoom information;
2. left: Brooklyn Sabbath School; right: Brooklyn Sabbath Worship, with giving;
3. bilingual Sabbath Encouragement spread.

The Brooklyn cover uses Brooklyn as the primary address while still highlighting
all three locations. The Zoom rows are two on top and one centered below, with
the topic before the day/time.

### Type

The pastor's rules for the printed bulletin (#603):

- English prints in Times New Roman and Chinese in one Song (Ming) style font,
  set run by run: a Doc holds one font per run, so `setPrintedFontFamilies_`
  gives the Latin font to everything and then the Chinese font to each run of
  Chinese characters and punctuation.
- No text is smaller than 10 points. Body and table text is 10 points with
  single line spacing (0.9 for the giving notes), panel titles 13, the
  announcement and giving headings 11, and the Sabbath Encouragement's headings
  12. Long announcements stay at 10 points; shorten them in the Doc.
- A panel title's Chinese line sits right above its English line, with single
  spacing between them.
- Chinese stays regular (not bold), as before.

Google Docs prints only fonts in its own **Font → More fonts** list, so a Mac
font such as 宋體-繁 (Songti TC) can't be used in the Doc; to print in it, see
[Printing in Songti TC needs a Mac](#printing-in-songti-tc-needs-a-mac). In that list,
**UoqMunThenKhung** (宇文天穹) is the only Ming style face for Traditional
Chinese, so it's the default. It has every common Traditional character and the
Simplified forms Japanese shares (国, 会), but not most Simplified-only ones
(张, 陈), and it lacks these 67 rare characters of the CUV Bible:
儹匉咷嗐嘬噝墁戥挓揝搋摞杴橛汊洑玎璫癤瞅矬碡磣秸窨綹繸纍羢臌荽菢蒺蔯蔻薅虼蝘蝻蟥蠓訇誆讟賙跐蹧躥醡鍤鏇鏊鐏颻餂饈騌騸鴞鵀鶘鶿鸇鸕麀麃鼫. Each character it lacks prints in the fallback font, alone; the rest of the name
or verse stays in UoqMunThenKhung.

Any operator can change the Chinese and English fonts without a deploy, in
**Printed Bulletin → Fonts…** (#624). Each lists only fonts in Docs'
**Font → More fonts** list, plus **Default**. The fonts apply to every bulletin
made after that, by anyone; a Doc already made changes only when it's made
again. Another font can change the line heights, so check that the next Doc
still fits its pages.

| Slot | Default | Other choices |
| --- | --- | --- |
| Chinese | UoqMunThenKhung (Ming) | Noto Sans TC, Chocolate Classical Sans, Iansui |
| English | Times New Roman | Georgia, EB Garamond |

The dialog saves the Script Properties below. Each can also be set by hand, in
**Extensions → Apps Script → Project Settings → Script properties**, to a font
name from Docs' **Font → More fonts** list; the dialog keeps a font set that
way. The next **Create Google Doc…** uses it, and deleting the property, or
choosing **Default**, goes back to the default. The fallback font is set only
by hand.

| Script property | Default | Used for |
| --- | --- | --- |
| `PRINTED_BULLETIN_CJK_FONT` | `UoqMunThenKhung` | All Chinese |
| `PRINTED_BULLETIN_LATIN_FONT` | `Times New Roman` | English, digits, and Latin punctuation |
| `PRINTED_BULLETIN_CJK_FALLBACK_FONT` | `Noto Sans SC` | Each Chinese character UoqMunThenKhung lacks |

The script knows UoqMunThenKhung's characters (`PRINTED_DEFAULT_CHINESE_FONT_COVERAGE_`)
but not another font's. With another Chinese font set, every Chinese character
uses it and the fallback font isn't used.

### Printing in Songti TC needs a Mac

The pastor's preferred Chinese font is Songti TC (宋體-繁). It comes only with
macOS, under Apple's license, and Google Docs can't print it: Docs prints only
fonts in its own list, and none of its Chinese lists (Traditional, Hong Kong
or Simplified) has a Song face besides UoqMunThenKhung. **So printing the
bulletin in Songti TC needs a Mac with Microsoft Word.** Without one, print the
Google Doc itself, in UoqMunThenKhung. Both dialogs say so.

To print in Songti TC (#627):

1. Make and edit the week's Doc as usual.
2. After the last edit, open **Printed Bulletin → Create Google Doc…**, choose
   the date and location, and click **Make Word copy** in step 3. It reads the
   Doc as it stands, so a copy made before an edit misses that edit.
3. Click **Download Word copy** and open the file in Word on the Mac. Print
   from Word.

The copy is saved as `<Doc title> (Word, Songti TC).docx` in the Doc's own
Drive folder, replacing that week's earlier copy. The Doc doesn't change. The
script exports the Doc as `.docx` through the Drive API, with the permissions
it already has, and changes only `word/document.xml` and `word/styles.xml`:

- Every run's East Asian font becomes Songti TC. A run in the Doc's Chinese or
  fallback font gets Songti TC in every slot. English keeps its own font.
- Songti's lines are taller in Word than UoqMunThenKhung's are in Docs. With
  only the font changed, a Queens Regular bulletin ran to four pages. So each
  paragraph of text gets an exact line height: 1.15 times its largest font
  size, times its own line spacing. Set `PRINTED_BULLETIN_WORD_LINE_HEIGHT` to
  change the 1.15 without a deploy; values outside 0.8 to 2 are ignored.
- A paragraph with a picture (the cover, the QR codes, the logo) keeps its own
  spacing, since an exact height would crop the picture. Empty `<w:p/>`
  paragraphs are left alone too.
- The document grid is removed, so Chinese lines don't snap to it.

If the copy runs onto an extra page, lower `PRINTED_BULLETIN_WORD_LINE_HEIGHT`
a little, such as to 1.1. If tall characters look clipped, raise it, such as to
1.2. The next **Make Word copy** uses it.

## Printed edge cases and content rules

### Hymns

`PrintedHymnLookup.gs` contains the reviewed English↔Chinese hymnal number map.
For each printed hymn:

- if both language values are supplied, preserve both exactly, except that a
  bare number in the Chinese value prints as `第N首`;
- if only English is supplied, fill only the missing Chinese hymn number;
- if only Chinese is supplied, fill only the missing English hymn number; and
- never copy an English title/reference into the Chinese slot. The Sabbath
  School hymns (below) have no separate slots: each prints on one line.

Queens Regular, Queens Communion, and Brooklyn all use this shared path. The
Communion response hymn remains a fixed bilingual reference and must fit on one
line in the printed layout.

The Sabbath School hymns print in each Sabbath School panel's **Opening Hymns**
row, after the opening prayer, one hymn per line, such as
`AH 348 · 第413首 教會根基` (`formatSabbathSchoolHymnsForPrint_`). Each cell has
one hymn in either language. Where the map has the other language by number,
the line is the English, a dot, then the Chinese; otherwise the hymn prints
once, as typed. A bare number is `第N首`. The closing sings the same hymns, so
the **Closing Hymns** row, after the lesson, says `同開會詩歌` (`同開會唱詩` in
Brooklyn) and `Same as Opening Hymns` rather than listing them twice (`getPrintedSabbathSchoolHymnRows_`). With one
hymn, the rows say Hymn; with none, both say `TBD`. The lesson prints in the Queens `Lesson / Study` row and the Brooklyn
`Sabbath School` row, and the special music piece beside its performer (`TBD`
in Brooklyn).

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

The script's snapshot of the pages is in Simplified Chinese, like the PDF. The
Chinese column prints it in Traditional (#603): `toPrintedTraditionalChinese_`
converts each Simplified character the snapshot uses, then the words whose
Traditional form depends on context, such as 關係 but 牢繫, and 干犯 but 枯乾.
Both lists were made with OpenCC (cn to tw) and checked by reading every
changed line. A new snapshot needs both lists made again. The English column
still translates the Simplified snapshot, so its Bible references keep
matching `SABBATH_BIBLE_BOOKS_`.

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
in the QR code folder, skipping files in the trash, then by its Script Property (such
as `MOBILE_APP_QR_IMAGE_FILE_ID`). The folder is in a restricted shared drive where
most people who make bulletins are viewers, so the search goes through the Drive
advanced service, which finds a shared drive's files for viewers too
([Bulletin inputs in Google Drive](../architecture.md#bulletin-inputs-in-google-drive)).

The QR workflow generates `mobile_app_qr_code_368x368.jpg`, pointing at
`https://app.nyccsda.org/download`, and uploads it to Drive with the giving codes
([Admin Runbook](admin-runbook.md#bulletin-qr-codes)).

**The mobile app code** (#323). The code leads to the store pages, so the script
that prints it waited until the app was public on both Google Play and the App
Store. Both stores have released it, so it now goes live with each approved
deploy. If a printed code stops working:

1. Check that https://app.nyccsda.org/download sends an Android phone to Google
   Play and an iPhone to the App Store.
2. Check that `mobile_app_qr_code_368x368.jpg` is in the QR code folder and not in
   the trash. If `MOBILE_APP_QR_IMAGE_FILE_ID` is set, check that it names that
   file, not an old placeholder.
3. Generate test bulletins for Queens (Regular and Holy Communion) and Brooklyn,
   and scan the printed code with an Android phone and an iPhone.

## Deployment and verification

The repository is the canonical source. Local WSL deployment uses the existing
Apps Script deployment ID so the production `/exec` URL does not change. Setup
(installing clasp, `clasp login`, and copying the `.example` config files) is in
the [Apps Script README](../../google-apps-script/README.md#setup), and the test,
push, and deploy commands, with what each one changes in production, are in its
[Commands](../../google-apps-script/README.md#commands).

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

From GitHub, **Deploy Bulletin Apps Script** runs the same deploy with the
`production` environment's `APPS_SCRIPT_PROJECT_ID`, `APPS_SCRIPT_DEPLOYMENT_ID`, and
`CLASPRC_JSON` secrets. Every merge into `main` starts it, and it waits for
`production` approval; a pull request never deploys. How to approve it, or run it by
hand from `main`, is in the Admin Runbook's
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
3. verify the Google Doc link;
4. confirm the Doc is in the correct folder;
5. verify the public `/exec?date=YYYY-MM-DD&client=check` response does not
   contain email, timestamps, Chinese names, pinyin, or full last names; and
6. run the opt-in integration test when production verification is appropriate:

```bash
npm run test:integration:bulletin
```

Do not create a new web-app deployment merely to publish code. A new deployment
changes the URL and requires a coordinated mobile-app update.

## Troubleshooting matrix

| Symptom | Likely cause | Corrective action |
| --- | --- | --- |
| App shows `TBD` for worship content | No matching intake value | Add or correct the row in `Weekly Data`; allow up to 120 seconds for API cache expiry |
| **Create Google Doc…** says Weekly Data has no Bible Verses, or can't read them | The Sabbath's `Weekly Data → Bible Verses` cell for that location is blank, `TBD`, or has a passage the parser can't read | Close the dialog, write each passage as `Book chapter:verse` with `;` between them, then open the dialog again. The app shows the same verse |
| API returns `No schedule found for …`, or the app says the schedule isn't set | Missing `Sabbath Calendar` date row (a deleted tab returns `Schedule sheet not found` instead; a renamed one is still found by its tag, unless it was renamed before the spreadsheet was opened after the deploy). Apps from 1.6.0 get the bulletin without its schedule instead of the error | Restore the tab and a matching Date row |
| The spreadsheet opens with **Bulletin columns not found** | A column or tab it lists was deleted, or renamed before it was ever tagged, so that field is blank | Give a column that exact name again, in any position |
| The spreadsheet opens with **Bulletin tabs or columns changed** | Someone renamed a tab or column the scripts read, or gave a second column an expected column's name | Nothing: the renamed one is still read by its tag, the notice says which of two same-named columns is read, and it shows once. Rename the extra column, or delete an empty one an open added, if it was a mistake. See [Columns are read by name](#columns-are-read-by-name) |
| A renamed column stopped being read | A column with its old name was added, which the scripts read instead | Delete the new column, or move its data into it and delete the renamed one |
| An empty column appeared at the far right of `Weekly Data` | An expected column was deleted, or renamed before it was tagged, and the open-time upkeep added it back | Move any data into the added column and delete the renamed one |
| A prayer role shows under the wrong location | A repeated `Chair/Pastoral Prayer` or `Offering Prayer` column was moved across `Brooklyn Sermon` | Move it back to its location's side, or name it with its location, such as `Queens Offering Prayer` |
| A roster cell is pale red | The same name is in another roster cell of that row | Hover over the cell to see the other roles; reassign one, or leave it if intended. The color clears on the next edit |
| No unknown-name dialog, only an alert | No bulletin admin has used the Printed Bulletin menu yet, or the trigger owner's account was removed | Have an admin open **Printed Bulletin → Create Google Doc…**; if the owner was removed, delete the `SCHEDULE_NAME_CHECK_TRIGGER` script property first |
| A red cell shows no hover note | The cell already had a planner's own note, which the script keeps | Read the row to find the other role, or delete the planner's note so the script can add its own |
| Chinese text appears in Sabbath Calendar | Typed or pasted into A:Y | The onEdit guard should clear it with a popup; if it stays with a red corner, check **Extensions → Apps Script → Executions** for errors. Use Name Dictionary for approved English names |
| New quarter rows lack validation | Maintenance did not run or append failed | Open the workbook as an editor, inspect Apps Script logs, and rerun maintenance; do not manually limit the rule to X53 |
| Old rows disappeared | They were hidden, not deleted | Unhide rows when historical planning is needed; maintenance is non-destructive |
| Google Doc is in Trash or not updated | Saved ID points to a trashed/deleted file | Run generation again; the script treats it as missing and creates a new Doc in the configured folder |
| The Doc, or its printout, has an extra page or clipped fold content | Layout overflow or altered gutter/margins | Shorten the long text in the Doc (an announcement, a sermon title). If every week overflows, restore the renderer's panel/gutter structure; never clip text or go under 10 points to fit |
| A Chinese character prints in a plainer font than the rest | It's a Simplified or rare character the bulletin's Chinese font lacks, so it uses the fallback font | Nothing, if it's spelled as intended. A Simplified name or title typed in Traditional prints in the bulletin's font; a rare character always prints in the fallback font. See [Type](#type) |
| All Chinese, or all English, prints in the wrong font | `PRINTED_BULLETIN_CJK_FONT` or `PRINTED_BULLETIN_LATIN_FONT` names a font Docs doesn't offer, typed by hand | Choose a font in **Printed Bulletin → Fonts…**, or **Default** |
| Bible reference repeats English in Chinese slot | Renderer bypassed bilingual helper | Use `formatBibleReferenceForPrint_` and the deterministic Chinese book map |
| Hymn English appears in Chinese slot | A manually supplied Chinese value was overwritten (on the Sabbath School hymns row, an unmapped English hymn repeats on purpose) | Preserve the supplied side; only the missing side may use `PrintedHymnLookup.gs` |
| QR slot is blank | The slot is reserved (Zelle, or Brooklyn's third slot), the deployed script predates the mobile app code, or that code isn't in Drive | Check [Giving QR slots](#giving-qr-slots) and the Drive file name before changing the layout |
| A pastor or elder prints without a title, or Communion rows print `TBD` | The name isn't in the `Leadership` tab, is spelled differently from the schedule or the `Name Dictionary`, or the tab or its `Pastors`/`Elders` header was renamed (a header must hold only the title) | Fix the [`Leadership` tab](#the-leadership-tab); **Extensions → Apps Script → Executions** logs a missing tab or column. No deploy is needed |
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
- approve the Apps Script deploy that the release's merge into `main` starts;
- build/upload an APK only when native app code changes; and
- verify a generated Doc and public API response for the affected location.

For header changes:

- **Moving a column, or adding one the scripts don't read,** needs no code
  change. On the `Sabbath Calendar`, add it at the far right (see above).
- **Renaming a tab or column in the spreadsheet** needs no code change; its tag
  keeps it read (see [Columns are read by name](#columns-are-read-by-name)).
- **Changing the name the code expects for a column, or adding one the scripts
  should read,** starts in the code: the field's schema entry (`COLUMN_SCHEMA` or
  `BULLETIN_INTAKE_SCHEMA`), `BULLETIN_SHEET_COLUMNS`, the tests, and this
  document. Search the scripts for the old name too: `Date`, `Location`,
  `Quarter`, `Bible Verses`, `Queens Sermon`, and `Brooklyn Sermon` are also
  used directly. A new expected name gets a new tag: the first open after the
  deploy tags the column once it has that name.
  - **`Weekly Data`:** to rename without a gap, add the old name after the new
    one in the entry's `headers`, and in `BULLETIN_COLUMN_ALTERNATIVES` for the
    open-time alert and repair. The sheet can then be renamed any time after
    the deploy. Without the old name, that field is blank from the deploy until
    the sheet is renamed, and the first open after the deploy adds the new name
    as an empty column at the far right.
  - **`Sabbath Calendar`:** an entry has one `header` and no alternatives, so
    rename the column straight after approving the deploy. Until then, that
    one field is blank.

For a change to the API's answer that older apps can't handle, such as a
renamed field or an answer they'd show wrongly:

- **Keep the old answer for older apps** beside the new one. Since 1.6.0 the
  app sends its version (`appVersion`) with each request, and
  `isAppVersionAtLeast_` tells them apart, as `SCHEDULE_NOT_SET_APP_VERSION`
  does.
- **Mark it as a changeover** in `BULLETIN_CHANGEOVERS` in `BulletinApi.gs`:
  an `id`, the app version that makes the old answer unneeded (`retiresWith`),
  and what to remove (`cleanup`).
- **Leave the timing to the monitor.** Once no older app has asked for a
  bulletin for 14 days, the daily External Dependency Monitor opens the issue
  **[changeover] Retire the bulletin API's … changeover**. Then do the cleanup
  it describes, and remove the entry. A new check of the live API should send
  `client=check`, so it isn't taken for an older app. See
  [Changeovers](../feature_designs/bulletin_spreadsheet_tags.md#changeovers).

The API returns only the fields in its schemas and the optional Brooklyn fields
in `populateOptionalBrooklynScheduleFields_`, so any other new column reaches
the app only through a schema change. Don't make it pass along whatever columns a tab
has.
