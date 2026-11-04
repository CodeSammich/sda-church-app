# Bulletin Hymn Resolution: As-Built Extension Guide

## Purpose

Bulletin hymn fields are bilingual, human-entered data. They may contain a number, a
title, both, a misspelled title, content in the wrong language field, or only one of the
two language answers. A hymn may come from any hymnal, usually a Chinese one, or from
none, such as a song on YouTube. The app resolves this input locally against every
hymnal it has; it does not machine-translate hymn titles.

All bulletin hymn fields in the app must use
`resolveBulletinHymnPresentation()` from `services/BulletinHymnalService.ts`. It returns
one object containing the visible `displayText`, the optional reader `destination`, and,
when no hymnal has the hymn, the optional `youtubeSearchQuery`. Keeping those values together prevents the title and button from resolving
different intake answers.

The printed bulletin doesn't use this resolver. `resolvePrintedHymnText_` in
`google-apps-script/PrintedHymnLookup.gs` keeps both supplied values as entered and fills
only a missing side, by hymn number, with that hymn's number and title, such as
`AH 73 Holy, Holy, Holy` for `第2首 聖哉真神`. It has no title matching. The maps and titles
are in `HymnalData.gs`, which `scripts/build-hymnal-apps-script.cjs` makes from
`HymnalNumberMappings.json`, `EnglishHymnal.ts` and `Chinese505Hymnal.json` on every Apps
Script deploy (#619), so they never fall behind; `test/apps-script-hymnal-data.test.ts`
checks the generated data against those files. See
[Bulletin automation](../operations/bulletin-automation.md#hymns).

## Display and routing rules

Chinese UI means either `zh` or `zh-cn`. The English hymnal is preferred for every other
UI language currently supported by the bulletin.

| Submitted bulletin data | Result |
| --- | --- |
| Both language fields have values | Resolve the field matching the selected UI language. |
| Only the selected-language field has a value | Show its canonical number and title and open that hymnal. |
| Only the other-language field has a mapped equivalent | Show and open the equivalent in the selected UI language. Mapping works in both directions. |
| Only the other-language field has no mapped equivalent | Keep its canonical source number and title and open the source hymnal. |
| Content was placed in the wrong language field | Use title and writing-system evidence to detect its actual catalog, then apply the same mapping rules. |
| A correct number has a mistyped title | Treat the number as primary and repair the title from the catalog. |
| Only a title was entered | Fuzzy-match every hymnal's titles; reject weak matches. |
| The hymn is only in another hymnal, such as the 506 or a 707 | Show its number and title with that hymnal's short name, such as `61. 奇异恩典（中文 506）`, and open that hymnal. |
| Text cannot be recognized | Display the submitted text unchanged, with no hymn-number link, and offer a **Search YouTube** button for the text as typed. |
| Both fields are blank | Display the localized empty state and provide no action. |

Cross-hymnal mappings are curated number equivalences in
`features/hymnal/HymnalNumberMappings.json`. They are not general translations, and missing
entries must never be guessed from similar titles.

### Every hymnal (#558)

The resolver looks in every hymnal on the hymnal page (`HYMNALS` in
`features/hymnal/Hymnals.ts`), with the church's own two first:

- **Numbers.** A number is looked up in every hymnal that has it. The declared hymnal
  (the 1985 for the `english` side, the 505 for the `chinese` side; a one-cell hymn's
  side is set by how it's written) gets a bonus, so a bare number
  stays in the church's hymnal. A typed title still counts, so `第1首 聖哉真神` opens the
  506's hymn 1, because the 505's hymn 1 has another title.
- **Titles.** A title-only answer is compared with every hymnal's titles, Traditional and
  Simplified alike. A match outside the church's two hymnals must be close (0.8, against
  0.55 for the church's own), since thousands of titles make a loose match likely to be
  wrong.
- **Speed.** A title search compares about 3,800 hymns, so each hymn's normalized title
  and bigrams are worked out once, and each answer is looked up once: the bulletin
  redraws every second while its refresh countdown runs.
- **YouTube.** An answer no hymnal has gets `youtubeSearchQuery`, the text as typed, and
  the bulletin shows **Search YouTube** in place of **Open hymn**. It opens like the
  hymnal page's recordings (`openYouTubeSearch`): in the YouTube app where one is
  installed.

Only the 1985 and the 505 have a cross-reference table, so a 506 or 707 hymn shows in
Chinese whatever the app's language.

### One-cell hymns

Each Sabbath School hymn has a single cell in the weekly sheet, typed in either
language. `toBulletinHymnText()` turns it into a `BulletinHymnText`: Chinese text or a
bare number goes in `chinese` (a Chinese hymnal number), anything else in Latin letters
in `english`. From there it takes the same path as every other bulletin hymn. The
printed bulletin reads a cell the same way (`formatSabbathSchoolHymnsForPrint_`).

The hymn of praise and the hymn of response have one cell each too. The Apps Script
files that cell under `english` or `chinese` by the same rule (`getBulletinHymnLanguage_`
in `BulletinApi.gs`), so the API still returns both sides, one of them blank, and the
app needs no change. A tab that still has the older English and Chinese columns is read
as before.

## Adding another bulletin hymn field

1. Expose the intake value as `{ english: string; chinese: string }`, represented by
   `BulletinHymnText`. A one-cell field in either language goes through
   `toBulletinHymnText()` first.
2. Call `resolveBulletinHymnPresentation(fieldValue, language)` once during bulletin
   rendering.
3. Use `presentation.displayText` for the row value and derive its accessible button from
   `presentation.destination`, or `presentation.youtubeSearchQuery` when there's no
   destination (`getBulletinHymnAction` in `app/(tabs)/home/bulletin.tsx`). Do not call
   the display and destination compatibility helpers separately in new UI code.
4. Add tests for both UI languages, a one-language submission, a missing mapping, blank
   data, and any field-specific fixed value.

`Hymn of Praise` and `Hymn of Response` are ordinary examples of this flow. The Queens
doxology, pastoral prayer, and postlude also use the presentation resolver for routing,
but deliberately retain their church-approved fixed wording for display.

## Changing or adding a primary hymnal

`features/hymnal/BulletinHymnalConfig.ts` is the final selection point, not a complete hymnal
plugin system. Before changing one of its primary IDs, a fork must:

1. Add the hymnal metadata and number mappings to `HymnalNumberMappings.json`. The printed
   bulletin's `HymnalData.gs` reads only the 1985 ↔ 505 maps, so another primary hymnal
   also needs `scripts/build-hymnal-apps-script.cjs` and `PrintedHymnLookup.gs` changed.
2. Add or import its searchable catalog in `BulletinHymnalService.ts`.
3. Register a hymnal adapter with its catalog lookup, valid number range, and reader route.
4. Implement the reader route if it does not already exist: add the hymnal to `HYMNALS` in
   `features/hymnal/Hymnals.ts` and `HYMNAL_LABELS` in `features/hymnal/HymnalLabels.ts`,
   and a route file that renders `HymnalScreen` with that hymnal picked, like
   `app/(tabs)/home/english-hymnal.tsx`. Add its hymns to `getHymnalSearchItems` in
   `features/hymnal/HymnalSearch.ts` so the hymnal page's search finds them from other
   hymnals. Its cross-references come from the mappings in step 1, with no other change; see
   [Cross-references between hymnals](hymnal_integration_design.md#54-cross-references-between-hymnals).
5. Change `PRIMARY_BULLETIN_HYMNALS` and `BULLETIN_HYMNAL_DISPLAY_NAMES`.
6. Extend mapping, display, routing, and accessibility tests.

The resolver currently models one English and one Chinese primary hymnal. Supporting a
third bulletin language requires generalizing `BulletinHymnText`, the language-to-hymnal
selection, and the adapter types rather than merely adding another constant.

## Regression coverage

`test/bulletin-hymnal-service.test.ts` is the behavioral specification. In particular, it
covers bidirectional mappings, number-first typo repair, title-only fuzzy matching,
wrong-field detection, unmapped fallbacks, fixed Queens responses, hymns only another
hymnal has, the YouTube fallback, how a Sabbath School cell is read, and the requirement
that display text and routing use the same selected form answer.
