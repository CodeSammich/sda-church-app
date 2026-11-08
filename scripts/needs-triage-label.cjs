/**
 * Keeps the red "needs triage" label in step with the organization's Priority
 * issue field (Urgent, High, Medium, Low). GitHub Mobile can't set issue fields
 * yet, so an issue opened there gets the label, which stands out on desktop
 * until someone gives the issue a Priority. An issue with a Priority no longer
 * needs triage, so the label comes off.
 *
 * - A new or reopened issue: labeled unless it already has a Priority, and
 *   unlabeled if it has both.
 * - The daily sweep: labels every open issue without a Priority, and unlabels
 *   every one that has one. Issues the monitors open with the built-in Actions
 *   token don't trigger workflows, so the sweep is what labels those.
 *
 * If the repository has no "needs triage" label, it's made red, with its
 * description, before the first issue gets it. Otherwise GitHub would make a
 * grey one without a description.
 *
 * Called from actions/github-script, which passes its `github`, `context`, and
 * `core` objects in:
 *   const triage = require(`${process.env.GITHUB_WORKSPACE}/scripts/needs-triage-label.cjs`);
 */
const LABEL = 'needs triage';
const LABEL_COLOR = 'B60205';
const LABEL_DESCRIPTION = 'Set a Priority (Urgent, High, Medium, Low) on desktop, then remove this label.';
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

/**
 * Makes the label, red and with its description, if the repository doesn't
 * have it. An existing label is left as it is, so a colour or description
 * someone changed by hand stays.
 */
const ensureLabel = async (github, context) => {
  try {
    await github.rest.issues.getLabel({ ...context.repo, name: LABEL });
    return;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  try {
    await github.rest.issues.createLabel({
      ...context.repo,
      name: LABEL,
      color: LABEL_COLOR,
      description: LABEL_DESCRIPTION,
    });
  } catch (error) {
    // 422: another run made it in the meantime.
    if (error.status !== 422) throw error;
  }
};

/**
 * Returns a function that adds the label to an issue. Before the first one, it
 * makes sure the label exists, so addLabels never makes a grey one.
 */
const labeler = (github, context) => {
  let ready;
  return async (number) => {
    ready = ready || ensureLabel(github, context);
    await ready;
    await github.rest.issues.addLabels({ ...context.repo, issue_number: number, labels: [LABEL] });
  };
};

const removeLabel = (github, context, number) =>
  github.rest.issues.removeLabel({ ...context.repo, issue_number: number, name: LABEL });

/**
 * Labels a new or reopened issue unless it has a Priority, and unlabels one
 * that has both. When GitHub won't show the issue's fields, it labels the issue
 * anyway, because a label that shouldn't be there is easier to notice than one
 * that's missing. Returns what happened, for logging and tests.
 */
const labelNewIssue = async ({ github, context, core, number }) => {
  const addLabel = labeler(github, context);
  let repository;
  try {
    ({ repository } = await github.graphql(ONE_ISSUE_QUERY, { ...context.repo, number }));
  } catch (error) {
    core.warning(`Could not read #${number}'s Priority: ${error.message}`);
  }
  if (!repository || !canSeePriority(repository)) {
    await addLabel(number);
    return { action: 'labeled-unchecked', number };
  }
  const prioritized = hasPriority(repository.issue);
  const flagged = hasLabel(repository.issue);
  if (prioritized && flagged) {
    await removeLabel(github, context, number);
    return { action: 'unlabeled', number };
  }
  if (prioritized || flagged) {
    return { action: 'none', number };
  }
  await addLabel(number);
  return { action: 'labeled', number };
};

/**
 * Labels every open issue without a Priority and unlabels every one with a
 * Priority. Throws when the token can't see the Priority field, so a run that
 * can't tell fails visibly instead of labeling every issue.
 * Returns the issue numbers it labeled and unlabeled.
 */
const sweep = async ({ github, context }) => {
  const addLabel = labeler(github, context);
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
        await addLabel(issue.number);
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
