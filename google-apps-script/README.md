# Bulletin Apps Script source

This directory contains the Google Apps Script source for the church bulletin
API and printed Google Doc/PDF workflow. It is not bundled into the mobile app.

The consolidated architecture, workbook contract, sheet layouts, privacy rules,
fallback behavior, printed layouts, QR policy, Sabbath Encouragement handling,
testing, deployment, GitHub Actions, and troubleshooting runbook now live in:

[`docs/operations/bulletin-automation.md`](../docs/operations/bulletin-automation.md)

The Sabbath Encouragement attribution and copyright review is maintained at:

[`docs/operations/sabbath-encouragement-copyright.md`](../docs/operations/sabbath-encouragement-copyright.md)

## Source files

- `BulletinApi.gs` — public API, sheet contracts, joins, privacy filtering, and metadata translations.
- `BulletinScheduleMaintenance.gs` — automatic validation, protection, visibility, and quarter maintenance.
- `ScheduleAssignmentChecks.gs` — same-day roster conflict highlights and unknown-name warnings.
- `PrintedBulletin.gs` — shared printed-bulletin code: Sheet menu and prompts, data preparation, Docs and PDF export, page and table helpers, and the shared cover, giving, announcement, hymn, Bible, and QR helpers.
- `PrintedCommunionBulletin.gs` — Communion service content both locations print: fixed ceremony readings, response hymn, and the Foot Washing and Holy Communion panels.
- `PrintedQueensBulletin.gs` — Queens Regular and Queens Communion page layouts.
- `PrintedBrooklynBulletin.gs` — Brooklyn Regular and Communion page layouts and Sabbath Encouragement integration.
- `PrintedHymnLookup.gs` — reviewed bidirectional hymn-number lookup for physical printing.
- `SabbathEncouragement.gs` — rotating 52-page source and bilingual printed spread.
- `appsscript.json` — Apps Script runtime and web-app manifest.

`PinyinPro.gs` is generated from the pinned `pinyin-pro` npm dependency during
deployment. Do not edit it directly.

## Commands

From the repository root, after installing dependencies and configuring the
existing Apps Script project/deployment IDs:

```bash
npm test -- --runInBand test/apps-script-physical-bulletin.test.ts test/apps-script-bulletin-merge.test.ts test/apps-script-schedule-assignment-checks.test.ts
npm run apps-script:push
npm run apps-script:deploy
```

`apps-script:deploy` updates the existing web-app deployment so the production
`/exec` URL remains stable. It does not create a replacement public deployment.
