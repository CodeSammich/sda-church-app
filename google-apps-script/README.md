# Bulletin Apps Script source

This directory contains the Google Apps Script source for the church bulletin
API and printed Google Doc/PDF workflow. It is not bundled into the mobile app.

The consolidated architecture, workbook contract, sheet layouts, privacy rules,
fallback behavior, printed layouts, QR policy, Sabbath Encouragement handling,
testing, deployment, GitHub Actions, and troubleshooting runbook now live in:

[`docs/operations/bulletin-automation.md`](../docs/operations/bulletin-automation.md)

The Sabbath Encouragement attribution and copyright review is maintained at:

[`docs/operations/sabbath-encouragement-copyright.md`](../docs/operations/sabbath-encouragement-copyright.md)

What each file here does, including the generated `PinyinPro.gs` (never edit
it by hand), is in the runbook's
[Source map](../docs/operations/bulletin-automation.md#source-map).

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
   them, `~/.clasprc.json`, a deployment ID, or a refresh token.

## Commands

```bash
npm test -- test/apps-script-physical-bulletin.test.ts test/apps-script-bulletin-merge.test.ts test/apps-script-schedule-assignment-checks.test.ts
npm run apps-script:push      # upload the code
npm run apps-script:deploy    # upload, then update the existing web-app deployment
```

**Both commands change production.** There is one Apps Script project, bound to
the live spreadsheet, and no test copy. `push` replaces the code the
spreadsheet's **Printed Bulletin** menu and edit triggers run; `deploy` also
points the public `/exec` web app, which the mobile app reads, at the new code,
keeping the same URL.

The **Deploy Bulletin Apps Script** workflow does the same as
`apps-script:deploy` from GitHub Actions. Every merge into `main` starts it, and it
waits for `production` approval; see
[Deploying the bulletin Apps Script](../docs/operations/admin-runbook.md#deploying-the-bulletin-apps-script).
