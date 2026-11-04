/**
 * Keeps the scheduled workflows running through a quiet spell (#658). GitHub
 * turns off a public repository's scheduled workflows after 60 days with no
 * repository activity
 * (https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows),
 * which would silently stop the Apple Signing Monitor, the Yearly Checkup, the
 * Workspace Backup Reminder, and the Due-Date Reminders if development paused.
 *
 * Twice a month, Scheduled Workflows Keepalive (.github/workflows/
 * scheduled-workflows-keepalive.yml) runs keepAlive:
 *
 * - Every workflow with a schedule, this one included, is enabled again
 *   through the REST API (PUT .../actions/workflows/{file}/enable), which sets
 *   it active. Calling it on a workflow that's still active is how
 *   liskin/gh-workflow-keepalive stops GitHub turning it off, with no commit.
 *   GitHub doesn't document that this restarts the 60 days, so it isn't
 *   relied on alone.
 * - One GitHub turned off for inactivity is turned back on, and the alert
 *   issue names it. One a person turned off stays off.
 * - When main has had no commit for 45 days, the alert issue says so, while
 *   there are still 15 days to merge something into main, the one activity
 *   known to count.
 *
 * The alert issue closes itself once nothing is wrong.
 */
const { readdirSync, readFileSync } = require('node:fs');
const { join } = require('node:path');

const ALERT_TITLE = 'Scheduled workflows may stop: GitHub turns them off after 60 days without activity';
const WARN_AFTER_DAYS = 45;
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
 * Enables each scheduled workflow again, and reports what it found:
 * { refreshed, reenabled, leftOff, failed, daysSinceCommit }.
 */
const keepAlive = async ({ github, context, core, workflows, now = new Date() }) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const result = { refreshed: [], reenabled: [], leftOff: [], failed: [], daysSinceCommit: null };
  for (const workflow of workflows) {
    try {
      const { data } = await github.rest.actions.getWorkflow({ ...repo, workflow_id: workflow.file });
      if (data.state === 'disabled_manually' || data.state === 'deleted' || data.state === 'disabled_fork') {
        result.leftOff.push({ ...workflow, state: data.state });
        continue;
      }
      await github.rest.actions.enableWorkflow({ ...repo, workflow_id: workflow.file });
      (data.state === 'disabled_inactivity' ? result.reenabled : result.refreshed).push(workflow);
    } catch (error) {
      core?.warning(`Couldn't enable ${workflow.file}: ${error.message}`);
      result.failed.push({ ...workflow, error: error.message });
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
 * The alert issue's body for what keepAlive found, or null when there's
 * nothing to say.
 */
const buildAlert = (result, runUrl, runbookUrl) => {
  const findings = [];
  if (result.reenabled.length) {
    findings.push(
      `- GitHub had turned off ${list(result.reenabled)} for inactivity. This run turned them back on. Check that each one's next scheduled run starts, and run any reminder it missed by hand (**Run workflow**).`,
    );
  }
  if (result.failed.length) {
    findings.push(
      `- Couldn't enable ${list(result.failed)}. Check its state under **Actions**, and enable it by hand if GitHub turned it off.`,
    );
  }
  if (result.daysSinceCommit !== null && result.daysSinceCommit >= WARN_AFTER_DAYS) {
    findings.push(
      `- \`main\` has had no commit for ${result.daysSinceCommit} days. GitHub turns off scheduled workflows after 60 days without activity. This workflow enables them again twice a month, but GitHub doesn't promise that keeps them on, so merge any pull request into \`main\` before day 60, such as a small docs fix through \`release-candidate\` and a release.`,
    );
  }
  if (!findings.length) return null;
  return [
    `Scheduled Workflows Keepalive found something that could stop the scheduled workflows, which include the Apple Signing Monitor, the Yearly Checkup, the Workspace Backup Reminder, and the Due-Date Reminders:`,
    '',
    ...findings,
    '',
    `This issue closes itself on the first run that finds nothing wrong. Run: ${runUrl}`,
    '',
    `What to do: ${runbookUrl}`,
  ].join('\n');
};

module.exports = { ALERT_TITLE, WARN_AFTER_DAYS, buildAlert, findScheduledWorkflows, keepAlive };
