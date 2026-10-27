/**
 * Keeps the red "needs priority" label in step with the organization's Priority
 * issue field (Urgent, High, Medium, Low). GitHub Mobile can't set issue fields
 * yet, so an issue opened there gets the label, which stands out on desktop
 * until someone gives the issue a Priority. The daily sweep then takes it off.
 *
 * - A new or reopened issue: labeled unless it already has a Priority.
 * - The daily sweep: labels every open issue without a Priority, and unlabels
 *   every one that has one. Issues the monitors open with the built-in Actions
 *   token don't trigger workflows, so the sweep is what labels those.
 *
 * Called from actions/github-script, which passes its `github`, `context`, and
 * `core` objects in:
 *   const priorities = require(`${process.env.GITHUB_WORKSPACE}/scripts/needs-priority-label.cjs`);
 */
const LABEL = 'needs priority';
const PRIORITY_FIELD = 'Priority';

// Whether the token can see issue fields at all. Without that, every issue
// would look unprioritized, so the sweep must stop rather than label them all.
const FIELD_ACCESS = `viewerCanSeeIssueFields
    issueFields(first: 20) { nodes { ... on IssueFieldSingleSelect { name } } }`;

const ISSUE_DETAILS = `number
      labels(first: 50) { nodes { name } }
      issueFieldValues(first: 20) {
        nodes { ... on IssueFieldSingleSelectValue { name field { ... on IssueFieldSingleSelect { name } } } }
      }`;

const ONE_ISSUE_QUERY = `query($owner: String!, $repo: String!, $number: Int!) {
  repository(owner: $owner, name: $repo) {
    ${FIELD_ACCESS}
    issue(number: $number) { ${ISSUE_DETAILS} }
  }
}`;

const OPEN_ISSUES_QUERY = `query($owner: String!, $repo: String!, $after: String) {
  repository(owner: $owner, name: $repo) {
    ${FIELD_ACCESS}
    issues(states: OPEN, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { ${ISSUE_DETAILS} }
    }
  }
}`;

const canSeePriority = (repository) =>
  Boolean(
    repository.viewerCanSeeIssueFields &&
      repository.issueFields.nodes.some((field) => field && field.name === PRIORITY_FIELD),
  );

const hasPriority = (issue) =>
  issue.issueFieldValues.nodes.some(
    (value) => value && value.name && value.field && value.field.name === PRIORITY_FIELD,
  );

const hasLabel = (issue) => issue.labels.nodes.some((label) => label.name === LABEL);

const addLabel = (github, context, number) =>
  github.rest.issues.addLabels({ ...context.repo, issue_number: number, labels: [LABEL] });

const removeLabel = (github, context, number) =>
  github.rest.issues.removeLabel({ ...context.repo, issue_number: number, name: LABEL });

/**
 * Labels a new or reopened issue unless it has a Priority. When GitHub won't
 * show the issue's fields, it labels the issue anyway, because a label that
 * shouldn't be there is easier to notice than one that's missing.
 * Returns what happened, for logging and tests.
 */
const labelNewIssue = async ({ github, context, core, number }) => {
  let repository;
  try {
    ({ repository } = await github.graphql(ONE_ISSUE_QUERY, { ...context.repo, number }));
  } catch (error) {
    core.warning(`Could not read #${number}'s Priority: ${error.message}`);
  }
  if (!repository || !canSeePriority(repository)) {
    await addLabel(github, context, number);
    return { action: 'labeled-unchecked', number };
  }
  if (hasPriority(repository.issue) || hasLabel(repository.issue)) {
    return { action: 'none', number };
  }
  await addLabel(github, context, number);
  return { action: 'labeled', number };
};

/**
 * Labels every open issue without a Priority and unlabels every one with a
 * Priority. Throws when the token can't see the Priority field, so a run that
 * can't tell fails visibly instead of labeling every issue.
 * Returns the issue numbers it labeled and unlabeled.
 */
const sweep = async ({ github, context }) => {
  const labeled = [];
  const unlabeled = [];
  let after = null;
  do {
    const { repository } = await github.graphql(OPEN_ISSUES_QUERY, { ...context.repo, after });
    if (!canSeePriority(repository)) {
      throw new Error(`This token can't see the ${PRIORITY_FIELD} issue field, so no labels were changed.`);
    }
    for (const issue of repository.issues.nodes) {
      const prioritized = hasPriority(issue);
      const flagged = hasLabel(issue);
      if (!prioritized && !flagged) {
        await addLabel(github, context, issue.number);
        labeled.push(issue.number);
      } else if (prioritized && flagged) {
        await removeLabel(github, context, issue.number);
        unlabeled.push(issue.number);
      }
    }
    const { hasNextPage, endCursor } = repository.issues.pageInfo;
    after = hasNextPage ? endCursor : null;
  } while (after);
  return { labeled, unlabeled };
};

module.exports = {
  LABEL,
  labelNewIssue,
  sweep,
};
