/**
 * Shared alert-issue handling for the scheduled monitors (External Dependency
 * Monitor and Store Toolchain Monitor). Each monitor keeps one open issue,
 * found by its exact title: a failing run opens it or comments on it, and a
 * passing run closes it.
 *
 * Alerts are assigned to the usernames in the MONITOR_ALERT_ASSIGNEES Actions
 * variable so they notify a maintainer without anyone watching the repository.
 * With no assignees, or when GitHub rejects one, the alert @mentions the run's
 * actor instead, so an alert is never lost.
 *
 * Called from actions/github-script, which passes its `github`, `context`, and
 * `core` objects in:
 *   const alerts = require(`${process.env.GITHUB_WORKSPACE}/scripts/monitor-alert-issue.cjs`);
 */
const fs = require('node:fs');

/** Parses a comma-separated username list; tolerates spaces and leading @. */
const parseAssignees = (value) =>
  String(value || '')
    .split(',')
    .map((login) => login.trim().replace(/^@/, ''))
    .filter(Boolean);

const getRunUrl = (context) =>
  `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`;

/** Reads a monitor's JSON report, or returns null with a warning. */
const readReport = (reportPath, core) => {
  try {
    return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  } catch (error) {
    core.warning(`Could not read ${reportPath}: ${error.message}`);
    return null;
  }
};

const findOpenAlert = async ({ github, context, title }) => {
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'open',
    per_page: 100,
  });
  return issues.find((issue) => issue.title === title) || null;
};

const mentionActor = (context, body) => [`@${context.actor}`, '', body].join('\n');

/**
 * Opens the alert issue, or comments on it when it is already open. Labels are
 * added in both cases and never removed, so a label a person added stays.
 * Returns what happened, for logging and tests.
 */
const openOrUpdateAlert = async ({
  github,
  context,
  core,
  title,
  body,
  labels = [],
  assignees = [],
}) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const text = assignees.length ? body : mentionActor(context, body);
  const existing = await findOpenAlert({ github, context, title });

  if (existing) {
    await github.rest.issues.createComment({ ...repo, issue_number: existing.number, body: text });
    if (labels.length) {
      await github.rest.issues.addLabels({ ...repo, issue_number: existing.number, labels });
    }
    return { action: 'commented', number: existing.number };
  }

  try {
    const created = await github.rest.issues.create({ ...repo, title, body: text, labels, assignees });
    return { action: 'created', number: created.data.number };
  } catch (error) {
    if (!assignees.length) {
      throw error;
    }
    // An assignee without repository access makes the whole request fail;
    // never lose the alert over it.
    core.warning(`Could not assign ${assignees.join(', ')}: ${error.message}`);
    const created = await github.rest.issues.create({
      ...repo,
      title,
      body: mentionActor(context, body),
      labels,
    });
    return { action: 'created-without-assignees', number: created.data.number };
  }
};

/** Comments on and closes the open alert issue, if there is one. */
const closeAlert = async ({ github, context, title, body }) => {
  const existing = await findOpenAlert({ github, context, title });
  if (!existing) {
    return { action: 'none' };
  }
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  await github.rest.issues.createComment({ ...repo, issue_number: existing.number, body });
  await github.rest.issues.update({
    ...repo,
    issue_number: existing.number,
    state: 'closed',
    state_reason: 'completed',
  });
  return { action: 'closed', number: existing.number };
};

module.exports = {
  closeAlert,
  findOpenAlert,
  getRunUrl,
  openOrUpdateAlert,
  parseAssignees,
  readReport,
};
