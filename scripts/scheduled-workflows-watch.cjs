/**
 * Warns before the scheduled workflows stop for inactivity (#658). GitHub
 * turns off a public repository's scheduled workflows after 60 days with no
 * repository activity
 * (https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows),
 * which would silently stop the Apple Signing Monitor, the Yearly Checkup, the
 * Workspace Backup Reminder, and the Due-Date Reminders if development paused.
 *
 * Twice a month, Scheduled Workflows Watch (.github/workflows/
 * scheduled-workflows-watch.yml) runs watch, which only reads, and opens the
 * alert issue when:
 *
 * - main has had no commit for 45 days, 15 days before GitHub would turn them
 *   off. A commit to main is the activity known to count; or
 * - GitHub has already turned one off for inactivity (`disabled_inactivity`).
 *
 * It never enables a workflow itself: a person turns one back on, as the issue
 * says. The issue closes itself once neither holds.
 */
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const ALERT_TITLE = 'Scheduled workflows may stop: GitHub turns them off after 60 days without activity';
const WARN_AFTER_DAYS = 45;
const DISABLE_AFTER_DAYS = 60;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * The workflows with a schedule, as { file, name }: a line `  schedule:` under
 * `on:`. Read line by line, with no regular expression over the file.
 */
const findScheduledWorkflows = (dir) =>
  readdirSync(dir)
    .filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'))
    .sort()
    .flatMap((file) => {
      const lines = readFileSync(join(dir, file), 'utf8').split('\n');
      if (!lines.some((line) => line.trimEnd() === '  schedule:')) return [];
      const nameLine = lines.find((line) => line.startsWith('name:'));
      const name = nameLine ? nameLine.slice('name:'.length).trim().replace(/^["']|["']$/g, '') : file;
      return [{ file, name }];
    });

/**
 * Reads each scheduled workflow's state and main's last commit, and reports
 * { turnedOff, unread, daysSinceCommit }. It changes nothing.
 */
const watch = async ({ github, context, core, workflows, now = new Date() }) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const result = { turnedOff: [], unread: [], daysSinceCommit: null };
  for (const workflow of workflows) {
    try {
      const { data } = await github.rest.actions.getWorkflow({ ...repo, workflow_id: workflow.file });
      if (data.state === 'disabled_inactivity') result.turnedOff.push(workflow);
    } catch (error) {
      core?.warning(`Couldn't read ${workflow.file}'s state: ${error.message}`);
      result.unread.push(workflow);
    }
  }
  try {
    const { data: repository } = await github.rest.repos.get(repo);
    const { data: branch } = await github.rest.repos.getBranch({ ...repo, branch: repository.default_branch });
    const committed = new Date(branch.commit.commit.committer.date);
    result.daysSinceCommit = Math.floor((now.getTime() - committed.getTime()) / DAY_MS);
  } catch (error) {
    core?.warning(`Couldn't read main's last commit: ${error.message}`);
  }
  return result;
};

const list = (workflows) => workflows.map((workflow) => `**${workflow.name}** (\`${workflow.file}\`)`).join(', ');

/**
 * The alert issue's body for what watch found, or null when there's nothing
 * to say.
 */
const buildAlert = (result, runUrl, runbookUrl) => {
  const findings = [];
  if (result.daysSinceCommit !== null && result.daysSinceCommit >= WARN_AFTER_DAYS) {
    const left = DISABLE_AFTER_DAYS - result.daysSinceCommit;
    findings.push(
      `- \`main\` has had no commit for ${result.daysSinceCommit} days. GitHub turns off scheduled workflows after ${DISABLE_AFTER_DAYS} days without activity, ${left > 0 ? `${left} days from now` : 'so it may already have'}. Merge any real commit into \`main\`, such as a small docs fix through \`release-candidate\` and a release; that starts the ${DISABLE_AFTER_DAYS} days again.`,
    );
  }
  if (result.turnedOff.length) {
    findings.push(
      `- GitHub has turned off ${list(result.turnedOff)} for inactivity. Turn each back on by hand: open it under **Actions** and select **Enable workflow**, or run \`gh workflow enable <file>\`. Then run any reminder it missed (**Run workflow**). A commit to \`main\` starts the ${DISABLE_AFTER_DAYS} days again.`,
    );
  }
  if (!findings.length) return null;
  return [
    'Scheduled Workflows Watch found that the scheduled workflows may stop. They include the Apple Signing Monitor, the Yearly Checkup, the Workspace Backup Reminder, and the Due-Date Reminders:',
    '',
    ...findings,
    '',
    `This issue closes itself on the first run that finds neither. Run: ${runUrl}`,
    '',
    `More: ${runbookUrl}`,
  ].join('\n');
};

module.exports = { ALERT_TITLE, WARN_AFTER_DAYS, buildAlert, findScheduledWorkflows, watch };
