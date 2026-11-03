/**
 * Opens a cleanup issue for each bulletin API changeover that's ready to
 * retire (#580). A changeover is a way of answering the Apps Script keeps for
 * older apps beside the new one. The script notes the last day an older app
 * asked for a bulletin, and says a changeover is ready once none has for 14
 * days (getChangeoverStatus_ in google-apps-script/BulletinApi.gs). This only
 * reads that, and opens each issue once, with GitHub's own token, so the
 * script holds no GitHub token.
 *
 * Run daily by the External Dependency Monitor through actions/github-script:
 *   const changeovers = require(`${process.env.GITHUB_WORKSPACE}/scripts/bulletin-changeovers.cjs`);
 *   await changeovers.openCleanupIssues({ github, context, core });
 */
const alerts = require('./monitor-alert-issue.cjs');

const BULLETIN_API_URL =
  'https://script.google.com/macros/s/AKfycbzBDlptzh5JpDyAiucJBXO4pQXe2hy2X3DL_1t6NixK-2tV3md_WbyhdDAtCGvGCwzX/exec';

const DESIGN_DOC = 'docs/feature_designs/bulletin_spreadsheet_tags.md#changeovers';

/** The issue a ready changeover opens. Its title is how it's opened only once. */
const getCleanupIssue = (changeover) => ({
  title: `[changeover] Retire the bulletin API's ${changeover.id} changeover`,
  body: [
    `No app older than ${changeover.retiresWith} has asked the bulletin API for a bulletin ` +
      `since ${changeover.olderAppLastCalled || changeover.watchedSince}, ` +
      `${changeover.quietDays} days or more, so the \`${changeover.id}\` changeover can go.`,
    '',
    '### What to remove',
    '',
    changeover.cleanup,
    '',
    `Then remove its entry from \`BULLETIN_CHANGEOVERS\` in \`google-apps-script/BulletinApi.gs\`. ` +
      `See [Changeovers](${DESIGN_DOC}).`,
    '',
    'An older app that still calls after the cleanup gets the newer answer. Before you ' +
      'merge it, open the bulletin API with `?changeovers=1` and check that this ' +
      "changeover's `olderAppLastCalled` is still old and `ready` is still true.",
  ].join('\n'),
});

/**
 * The changeovers the live API reports. Throws when it can't be read, such as
 * before the script that reports them is deployed.
 */
const readChangeovers = async ({ fetchImpl = fetch, url = BULLETIN_API_URL } = {}) => {
  const response = await fetchImpl(`${url}?changeovers=1`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) {
    throw new Error(`the bulletin API returned HTTP ${response.status}`);
  }
  const payload = await response.json();
  if (payload?.ok !== true || !Array.isArray(payload.changeovers)) {
    throw new Error(`the bulletin API didn't list its changeovers: ${payload?.error || 'no list'}`);
  }
  return payload.changeovers;
};

/**
 * Opens a cleanup issue for each ready changeover, once. A failure only warns:
 * the monitor's own bulletin check already reports an API that's down.
 * Returns what happened, for logging and tests.
 */
const openCleanupIssues = async ({ github, context, core, fetchImpl, url, assignees = [] }) => {
  let changeovers;
  try {
    changeovers = await readChangeovers({ fetchImpl, url });
  } catch (error) {
    core.warning(`Could not read the bulletin API's changeovers: ${error.message}`);
    return [];
  }
  const results = [];
  for (const changeover of changeovers.filter((candidate) => candidate.ready)) {
    const result = await alerts.openIssueOnce({
      github,
      context,
      core,
      ...getCleanupIssue(changeover),
      priority: 'Low',
      assignees,
    });
    core.info(`Changeover ${changeover.id}: cleanup issue ${result.action} (#${result.number})`);
    results.push({ id: changeover.id, ...result });
  }
  if (!results.length) {
    core.info(`No changeover is ready to retire (${changeovers.length} watched).`);
  }
  return results;
};

module.exports = {
  BULLETIN_API_URL,
  getCleanupIssue,
  openCleanupIssues,
  // The workflow step assigns the issue as the monitor's alerts are assigned.
  parseAssignees: alerts.parseAssignees,
  readChangeovers,
};
