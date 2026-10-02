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

## Setup

From the repository root:

1. Run `npm install`. The deploy script builds `PinyinPro.gs` from the
   installed `pinyin-pro` package and stops if it is missing.
2. Install clasp and sign in with a Google account that can edit the Apps
   Script project:

   ```bash
   npm install --global @google/clasp
   clasp login    # add --no-localhost in WSL if the browser sign-in can't return
   ```

3. Copy `google-apps-script/.clasp.json.example` to `.clasp.json` and
   `google-apps-script/.clasp-deployment.json.example` to
   `.clasp-deployment.json` in the same folder. Replace the placeholders with
   the existing project ID and the existing web-app deployment ID. Instead of
   copying, you can set `APPS_SCRIPT_PROJECT_ID` and `APPS_SCRIPT_DEPLOYMENT_ID`,
   and the deploy script writes both files. Git ignores both files; never commit
   them or `~/.clasprc.json`.

## Commands

```bash
npm test -- test/apps-script-physical-bulletin.test.ts test/apps-script-bulletin-merge.test.ts test/apps-script-schedule-assignment-checks.test.ts
npm run apps-script:push      # upload the code
npm run apps-script:deploy    # upload, then update the existing web-app deployment
```

**Both commands change production.** There is one Apps Script project, bound to
the live spreadsheet, and no test copy. `apps-script:push` replaces the code that
the spreadsheet's **Printed Bulletin** menu and edit triggers run.
`apps-script:deploy` also points the public `/exec` web app, which the mobile app
reads, at the new code. It updates the existing deployment, so the `/exec` URL
stays the same; it never creates a new public deployment.

Since 1.0.0, the code on `main` prints the **Download Mobile App** QR code on the
bulletin. Don't push or deploy it until the app is public in both stores; see
[Giving QR slots](../docs/operations/bulletin-automation.md#giving-qr-slots).

The **Deploy Bulletin Apps Script** workflow does the same as
`apps-script:deploy` from GitHub Actions, after `production` approval; see
[Deploying the bulletin Apps Script](../docs/operations/admin-runbook.md#deploying-the-bulletin-apps-script).
