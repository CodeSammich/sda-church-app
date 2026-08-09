# Bulletin Hymn Resolution: As-Built Extension Guide

## Purpose

Bulletin hymn fields are bilingual, human-entered data. They may contain a number, a
title, both, a misspelled title, content in the wrong language field, or only one of the
two language answers. The app resolves this input locally against the configured hymn
catalogs; it does not machine-translate hymn titles.

All bulletin hymn fields must use
`resolveBulletinHymnPresentation()` from `services/BulletinHymnalService.ts`. It returns
one object containing both the visible `displayText` and the optional reader
`destination`. Keeping those values together prevents the title and button from resolving
different form answers.

## Display and routing rules

Chinese UI means either `zh` or `zh-cn`. The English hymnal is preferred for every other
UI language currently supported by the bulletin.

| Submitted form data | Result |
| --- | --- |
| Both language fields have values | Resolve the field matching the selected UI language. |
| Only the selected-language field has a value | Show its canonical number and title and open that hymnal. |
| Only the other-language field has a mapped equivalent | Show and open the equivalent in the selected UI language. Mapping works in both directions. |
| Only the other-language field has no mapped equivalent | Keep its canonical source number and title and open the source hymnal. |
| Content was placed in the wrong form field | Use title and writing-system evidence to detect its actual catalog, then apply the same mapping rules. |
| A correct number has a mistyped title | Treat the number as primary and repair the title from the catalog. |
| Only a title was entered | Fuzzy-match both active catalogs; reject weak matches. |
| Text cannot be recognized | Display the submitted text unchanged and do not invent a hymn-number link. |
| Both fields are blank | Display the localized empty state and provide no action. |

Cross-hymnal mappings are curated number equivalences in
`constants/HymnalNumberMappings.json`. They are not general translations, and missing
entries must never be guessed from similar titles.

## Adding another bulletin hymn field

1. Expose the form value as `{ english: string; chinese: string }`, represented by
   `BulletinHymnText`.
2. Call `resolveBulletinHymnPresentation(fieldValue, language)` once during bulletin
   rendering.
3. Use `presentation.displayText` for the row value and derive its accessible button from
   `presentation.destination`. Do not call the display and destination compatibility
   helpers separately in new UI code.
4. Add tests for both UI languages, a one-language submission, a missing mapping, blank
   data, and any field-specific fixed value.

`Hymn of Praise` and `Hymn of Response` are ordinary examples of this flow. The Queens
doxology, pastoral prayer, and postlude also use the presentation resolver for routing,
but deliberately retain their church-approved fixed wording for display.

## Changing or adding a primary hymnal

`constants/BulletinHymnalConfig.ts` is the final selection point, not a complete hymnal
plugin system. Before changing one of its primary IDs, a fork must:

1. Add the hymnal metadata and number mappings to `HymnalNumberMappings.json`.
2. Add or import its searchable catalog in `BulletinHymnalService.ts`.
3. Register a hymnal adapter with its catalog lookup, valid number range, and reader route.
4. Implement the reader route if it does not already exist.
5. Change `PRIMARY_BULLETIN_HYMNALS` and `BULLETIN_HYMNAL_DISPLAY_NAMES`.
6. Extend mapping, display, routing, and accessibility tests.

The resolver currently models one English and one Chinese primary hymnal. Supporting a
third bulletin language requires generalizing `BulletinHymnText`, the language-to-hymnal
selection, and the adapter types rather than merely adding another constant.

## Regression coverage

`test/bulletin-hymnal-service.test.ts` is the behavioral specification. In particular, it
covers bidirectional mappings, number-first typo repair, title-only fuzzy matching,
wrong-field detection, unmapped fallbacks, fixed Queens responses, and the requirement
that display text and routing use the same selected form answer.
