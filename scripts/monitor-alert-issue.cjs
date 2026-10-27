/**
 * Shared alert-issue handling for the scheduled workflows. Each monitor
 * (External Dependency, Store Toolchain, Expo Doctor, Apple Signing) keeps one
 * open issue, found by its exact title: a failing run opens it or comments on
 * it, and a passing run closes it. The dated reminders (Yearly Checkup,
 * Workspace Backup Reminder) instead open each title once, with openIssueOnce.
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

// The organization's Priority issue field (Urgent, High, Medium, Low), which
// replaced the old `critical` label. Only the GraphQL API can set it.
const PRIORITY_FIELD = 'Priority';

const PRIORITY_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    issueFields(first: 20) { nodes { ... on IssueFieldSingleSelect { id name options { id name } } } }
    issue(number: $number) {
      id
      issueFieldValues(first: 20) {
        nodes { ... on IssueFieldSingleSelectValue { name field { ... on IssueFieldSingleSelect { id } } } }
      }
    }
  }
}`;

const SET_PRIORITY_MUTATION = `mutation($issueId: ID!, $fieldId: ID!, $optionId: ID!) {
  setIssueFieldValue(input: { issueId: $issueId, issueFields: [{ fieldId: $fieldId, singleSelectOptionId: $optionId }] }) {
    clientMutationId
  }
}`;

/**
 * Gives the issue a Priority unless it already has one, so a priority a person
 * chose stays, as a label they added does. A missing field or a refused token
 * only logs a warning: the alert itself matters more than its priority.
 * Returns what happened, for logging and tests.
 */
const setPriority = async ({ github, context, core, issueNumber, priority }) => {
  if (!priority) {
    return { action: 'none' };
  }
  try {
    const { repository } = await github.graphql(PRIORITY_QUERY, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      number: issueNumber,
    });
    const field = repository.issueFields.nodes.find((node) => node && node.name === PRIORITY_FIELD);
    const option = field && field.options.find((candidate) => candidate.name === priority);
    if (!option) {
      core.warning(`The repository has no ${PRIORITY_FIELD} field with a ${priority} option.`);
      return { action: 'missing-field' };
    }
    const current = repository.issue.issueFieldValues.nodes.find(
      (value) => value && value.field && value.field.id === field.id,
    );
    if (current) {
      return { action: 'kept', priority: current.name };
    }
    await github.graphql(SET_PRIORITY_MUTATION, {
      issueId: repository.issue.id,
      fieldId: field.id,
      optionId: option.id,
    });
    return { action: 'set', priority };
  } catch (error) {
    core.warning(`Could not set #${issueNumber}'s ${PRIORITY_FIELD} to ${priority}: ${error.message}`);
    return { action: 'failed' };
  }
};

/**
 * Opens the alert issue, or comments on it when it is already open. Labels are
 * added in both cases and never removed, so a label a person added stays. A
 * `priority` sets the Priority field the same way (see setPriority).
 * Returns what happened, for logging and tests.
 */
const openOrUpdateAlert = async ({
  github,
  context,
  core,
  title,
  body,
  labels = [],
  priority = null,
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
    await setPriority({ github, context, core, issueNumber: existing.number, priority });
    return { action: 'commented', number: existing.number };
  }

  let created;
  let action = 'created';
  try {
    created = await github.rest.issues.create({ ...repo, title, body: text, labels, assignees });
  } catch (error) {
    if (!assignees.length) {
      throw error;
    }
    // An assignee without repository access makes the whole request fail;
    // never lose the alert over it.
    core.warning(`Could not assign ${assignees.join(', ')}: ${error.message}`);
    created = await github.rest.issues.create({
      ...repo,
      title,
      body: mentionActor(context, body),
      labels,
    });
    action = 'created-without-assignees';
  }
  await setPriority({ github, context, core, issueNumber: created.data.number, priority });
  return { action, number: created.data.number };
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

/**
 * Opens an issue unless one with this exact title already exists, open or
 * closed, so a dated reminder opens once however often its workflow runs.
 * With no assignees, or when GitHub rejects one, it @mentions the run's actor
 * instead. Returns what happened, for logging and tests.
 */
const openIssueOnce = async ({ github, context, core, title, body, assignees = [] }) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...repo,
    state: 'all',
    per_page: 100,
  });
  const existing = issues.find((issue) => issue.title === title && !issue.pull_request);
  if (existing) {
    return { action: 'exists', number: existing.number };
  }

  try {
    const created = await github.rest.issues.create({
      ...repo,
      title,
      body: assignees.length ? body : mentionActor(context, body),
      assignees,
    });
    return { action: 'created', number: created.data.number };
  } catch (error) {
    if (!assignees.length) {
      throw error;
    }
    core?.warning(`Could not assign ${assignees.join(', ')}: ${error.message}`);
    const created = await github.rest.issues.create({ ...repo, title, body: mentionActor(context, body) });
    return { action: 'created-without-assignees', number: created.data.number };
  }
};

module.exports = {
  closeAlert,
  findOpenAlert,
  getRunUrl,
  openIssueOnce,
  openOrUpdateAlert,
  parseAssignees,
  readReport,
  setPriority,
};
