/**
 * The Google Workspace backup reminder (#461). Every three months, on the
 * first Monday of January, April, July, and October,
 * .github/workflows/workspace-backup-reminder.yml opens an issue asking a super
 * administrator to export all of the church's Workspace data and keep a copy
 * off Google. The steps are in docs/operations/admin-runbook.md, under
 * "Google Workspace backups"; test/workspace-backup-reminder.test.ts checks
 * that every link still points at a real heading.
 *
 * Called from actions/github-script, which passes its `github`, `context`, and
 * `core` objects in:
 *   const backup = require(`${process.env.GITHUB_WORKSPACE}/scripts/workspace-backup-reminder.cjs`);
 */
const { openIssueOnce } = require('./monitor-alert-issue.cjs');

const RUNBOOK = 'docs/operations/admin-runbook.md';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** `month` is 1 to 12. */
const workspaceBackupTitle = (year, month) => `Google Workspace backup, ${MONTHS[month - 1]} ${year}`;

/** The last day of the month after `month`, as YYYY-MM-DD: about eight weeks away. */
const dueDateFor = (year, month) => new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);

/** This month in New York, where the schedule runs. */
const monthInNewYork = (now = new Date()) => {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { year: 'numeric', month: 'numeric', timeZone: 'America/New_York' })
      .formatToParts(now)
      .map(({ type, value }) => [type, value]),
  );
  return { year: Number(parts.year), month: Number(parts.month) };
};

/** Each step: [text, heading anchor in the runbook]. */
const STEPS = [
  [
    'Start a full export: in the Google Admin console, **Data → Data import & export → Data export → Set up new export**, with the scope **Export all user data for the entire organization**. Only a super administrator can. It usually takes about 3 days, and Google emails whoever started it when it\'s done.',
    'starting-the-export',
  ],
  [
    'When it\'s done, check that the **Data export** table doesn\'t show **Errors**. For 20 days, Google can fetch what an export with errors is missing.',
    'downloading-it',
  ],
  [
    'Make a folder named for the export date, such as `Jan 4 2027 export backup`, on the backup drive: not the computer\'s system drive, and not a folder that syncs to a cloud account.',
    'downloading-it',
  ],
  [
    'Download the export\'s folder and its `Status Report.html` into it with `gcloud storage cp`, before Google deletes them 60 days after the export started. It\'s free: sign in with `gcloud auth login`, never run `gcloud init` or set a project, and never add a billing project.',
    'downloading-it',
  ],
  [
    'Check the copy: the downloaded export folder is exactly as many bytes as the export, and no file ends in `_.gstmp`.',
    'checking-the-copy',
  ],
  [
    'Comment here with the export\'s date and size. If the drive is low on space, delete the oldest export, but keep the two newest.',
    'checking-the-copy',
  ],
];

/** The issue's title and body for a month; links go to the docs on `main`. */
const buildWorkspaceBackup = (year, month, repoUrl) => ({
  title: workspaceBackupTitle(year, month),
  body: [
    'Every three months, back up the church\'s Google Workspace: export all of its email, files, and other data, and keep a copy off Google, in case the account is ever suspended, taken over, or emptied. Tick each box as you go, and close this issue when the copy is checked.',
    '',
    // Read by .github/workflows/due-date-reminders.yml, which comments here
    // 30 and 7 days before this date, and once after it passes, while the
    // issue is still open.
    `**Due: ${dueDateFor(year, month)}.** While this is open, the due-date reminders comment here 30 and 7 days before, and once after.`,
    '',
    ...STEPS.map(([text, anchor]) => `- [ ] ${text} ([how](${repoUrl}/blob/main/${RUNBOOK}#${anchor}))`),
    '',
    'This issue opens on the first Monday of January, April, July, and October (`.github/workflows/workspace-backup-reminder.yml`). To change how often, edit that schedule, the runbook\'s **Google Workspace backups** section, and the upkeep calendar.',
  ].join('\n'),
});

/**
 * Opens this month's backup issue unless it already exists, open or closed, so
 * the later Mondays in the month do nothing.
 */
const openWorkspaceBackup = ({ github, context, core, year, month, assignees = [] }) =>
  openIssueOnce({
    github,
    context,
    core,
    ...buildWorkspaceBackup(year, month, `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`),
    assignees,
  });

module.exports = {
  RUNBOOK,
  STEPS,
  buildWorkspaceBackup,
  dueDateFor,
  monthInNewYork,
  openWorkspaceBackup,
  workspaceBackupTitle,
};
