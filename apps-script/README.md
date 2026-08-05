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
- [PWA presentation](#pwa-presentation)
- [Failure behavior](#failure-behavior-and-troubleshooting)
- [Change management](#change-management-checklist)
- [Production integration monitoring](#production-integration-monitoring)
- [Deployment](#deploy)
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
| Google Apps Script | Joins the three data sources, removes private fields, shortens names, and returns JSON | Runs beside the spreadsheet without a separate backend account |
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
Apps Script web app (Code.gs, executes as the deploying account)
   |
   +--> Script cache -------- two-minute privacy-filtered response cache
   |
   +--> YYYY Sabbath -------- roster and schedule assignments
   |
   +--> Queens Worship Data - latest matching Queens form response
   |
   +--> Brooklyn Worship Data - latest matching Brooklyn form response
   |
   v
Allowlisted, privacy-filtered JSON
   |
   v
Bulletin screen
   |
   +--> device local storage - bulletin + successful-fetch time per date
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
6. Each worship-data tab is independently filtered to the same date. When there are
   multiple form submissions, the row with the latest `Timestamp` wins.
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
  fetch it. Therefore every value returned by `Code.gs` must be treated as public.
- The PWA is read-only. It does not submit changes to the spreadsheet through this API.
- `Code.gs` in this repository is the canonical source. Changes copied into Apps Script
  should be reviewed here first so the deployed version and repository do not drift.

### Repository source map

| File | Role |
| --- | --- |
| `apps-script/Code.gs` | Deployed backend logic, allowlists, date matching, and name privacy |
| `apps-script/appsscript.json` | Apps Script runtime, timezone, and web-app manifest settings |
| `constants/ExternalLinks.ts` | Production `/exec` URL and restricted staff-schedule URL |
| `services/BulletinService.ts` | PWA response types, upcoming-Sabbath calculation, fetching, device cache, persisted refresh cooldown, and empty-location detection |
| `app/(tabs)/home/bulletin.tsx` | Localized This Week/Next Week UI, location cards, `TBD` rendering, and staff link |
| `test/bulletin-service.test.ts` | PWA date, API error, and possible-joint-service behavior |
| `test/bible-scripture-reference.test.ts` | Multilingual 66-book parsing, formatting, ranges, and safe rejection behavior |
| `apps-script/README.md` | Architecture contract and operator runbook |

## Workbook and form layout

The script is intended to be bound to **Official Schedule for NYCCSDA Queens and
Brooklyn**. It derives the yearly Sabbath schedule tab from the requested date:

- A request such as `?date=2026-08-08` reads `2026 Sabbath`.
- A future Saturday automatically moves to the corresponding tab, such as
  `2027 Sabbath`.

Tabs such as `2026 Non-Sabbath` are intentionally ignored by the bulletin API.

The workbook is organized as follows:

```text
Official Schedule for NYCCSDA Queens and Brooklyn
├── Queens Worship Data       linked Queens Google Form responses
├── Brooklyn Worship Data     linked Brooklyn Google Form responses
├── 2026 Sabbath              2026 roster and schedule source
├── 2026 Non-Sabbath          ignored by this API
├── 2027 Sabbath              2027 roster and schedule source
└── ...
```

`Queens Worship Data` and `Brooklyn Worship Data` are sheet-tab names. The purple
`Form_Responses` and `Form_Responses2` labels visible inside Google Sheets are table names,
not tab names, and Apps Script does not address them.

The schedule header row must use this order (the repeated headers are intentional):

```text
Date | Quarter | Special Remark | Tithe Purpose | Pastor Travel |
Queens Sermon | Translation | Chinese Teacher | English Teacher |
Children Teacher | Chair/Pastoral Prayer | Special Music |
Offering Prayer | Pianist | SS Chair | Opening Prayer | Closing Prayer |
Brooklyn Sermon | Chair/Pastoral Prayer | Offering Prayer | Sabbath School
```

### Yearly schedule column contract

`COLUMN_SCHEMA` in `Code.gs` is an explicit allowlist. Columns must remain in the order
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
| `Opening Prayer` | 1 | `bulletin.queens.openingPrayer` | Person-name privacy filter |
| `Closing Prayer` | 1 | `bulletin.queens.closingPrayer` | Person-name privacy filter |
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
| `Timestamp` | Sort matching responses; newest wins | Not returned |
| `Email Address` | None | Never returned |
| `What date is this Sabbath?` | Match the requested bulletin date | Not returned separately |
| `What is the English name and number for the Hymn of Praise this week?` | Allowlisted worship content | `location.hymnOfPraise.english` |
| `What is the Chinese name and number for the Hymn of Praise this week?` | Allowlisted worship content | `location.hymnOfPraise.chinese` |
| `What is the sermon title in English?` | Allowlisted worship content | `location.sermonTitle.english` |
| `What is the sermon title in Chinese?` | Allowlisted worship content | `location.sermonTitle.chinese` |
| `What is the Hymn of Response in English?` | Allowlisted worship content | `location.hymnOfResponse.english` |
| `What is the Hymn of Response in Chinese?` | Allowlisted worship content | `location.hymnOfResponse.chinese` |
| `What are the Bible verses for this week?` | Allowlisted worship content | `location.bibleVerses` |

Operational rules for the forms:

- Keep both forms' English question prefixes identical to the table above.
- Let Forms append response rows; do not sort or restructure the response headers manually.
- A corrected resubmission for the same Sabbath is supported: the latest `Timestamp` row
  replaces the earlier response for that location.
- If no response matches, roster data still loads and worship-content fields remain blank,
  which the PWA displays as `TBD`.
- Adding an unrelated question does not expose it. New content remains unavailable to the
  PWA until it is deliberately added to `FORM_RESPONSE_SCHEMA` and the TypeScript/UI schema.
- `Email Address` remains stored in the protected church workbook even though it is never
  sent to the public API. Spreadsheet access must therefore remain limited to trusted
  collaborators under the church's Workspace policies.

## Annual schedule rollover

Create one new Sabbath schedule tab before each calendar year begins. The API derives the
tab name directly from the requested date, so the name must be exactly `YYYY Sabbath`:

```text
2026 Sabbath
2027 Sabbath
2028 Sabbath
```

Recommended rollover procedure:

1. Duplicate the prior year's Sabbath tab, or duplicate a clean schedule template if one
   is available.
2. Rename the new tab to the four-digit year followed by one space and `Sabbath`, such as
   `2027 Sabbath`. Do not add punctuation or extra words.
3. Remove the copied assignments and other prior-year data while retaining the header
   row, formatting, formulas, and data validation that belong to the template.
4. Populate the new year's Sabbath dates and quarter values.
5. Confirm that every required header remains in the documented order. The repeated
   `Chair/Pastoral Prayer` and `Offering Prayer` headers must remain repeated and in their
   original Queens/Brooklyn positions.
6. Reapply and verify the structural protections described below. Do not assume duplicated
   protection settings are correct.
7. Test at least the first Sabbath with the production API before the new year begins:

   ```text
   /exec?date=2027-01-02
   ```

   The response must contain `"ok":true` and data from `2027 Sabbath`.

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

If a fork uses different sheet-tab names, update `CONFIG.responseSheets` in `Code.gs` and
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
- A missing yearly schedule row is a request error because the bulletin has no canonical
  roster record for that date.

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
| Multiple submissions for one date | Latest timestamp wins independently per location | No deletion is required; submit a correction |
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
| Rename a response tab | `CONFIG.responseSheets`, documentation, Apps Script tests | New version of existing Apps Script deployment |
| Rename/add/reorder a schedule role | `COLUMN_SCHEMA`, TypeScript `BulletinLocation`, UI labels/rendering, tests, mapping table | Apps Script deployment and PWA deployment |
| Rename/add a Form question used by the PWA | `FORM_RESPONSE_SCHEMA`, TypeScript schema/UI when applicable, tests, mapping table | Apps Script deployment and possibly PWA deployment |
| Change JSON field names or nesting | Apps Script, `BulletinService.ts`, bulletin UI, tests, example JSON | Apps Script deployment and PWA deployment coordinated together |
| Create a replacement web-app deployment | `BULLETIN_API_BASE_URL`, `Code.gs` comment, this README | PWA deployment |
| Change only bulletin layout/copy | React Native screen and tests | PWA deployment only |

For Apps Script changes, copy the reviewed `Code.gs` into the bound project and edit the
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

Because a pull request cannot deploy its proposed `Code.gs` safely, this live check verifies
the PR's PWA contract against the currently deployed production Apps Script. Changes to
`Code.gs` still require the local/unit checks, review of the mapping tables, deployment as
a new version, and a post-deployment integration run.

## Deploy

1. In the spreadsheet, open **Extensions → Apps Script**.
2. Copy `Code.gs` into the editor and use the settings from `appsscript.json`.
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
   URL after updating the deployment.

The current production deployment is:

```text
https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec
```

`constants/ExternalLinks.ts` is the PWA's canonical endpoint configuration. The URL is
public by design, but it exposes only the allowlisted, privacy-filtered response.

Official reference: [Deploy an Apps Script web app](https://developers.google.com/apps-script/guides/web).

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
      "openingPrayer": "Lee H.",
      "closingPrayer": "Morgan Y."
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

## Optional `clasp` workflow

You can manage this as a standalone Apps Script project with `clasp`. Keep the local
`.clasp.json` uncommitted if it contains a spreadsheet or script identifier that should
not be shared.
