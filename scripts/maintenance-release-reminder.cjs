/**
 * A maintenance release before GitHub turns the scheduled workflows off
 * (#658). GitHub turns off a public repository's scheduled workflows after 60
 * days with no repository activity
 * (https://docs.github.com/en/actions/how-tos/manage-workflow-runs/disable-and-enable-workflows),
 * which would silently stop the Apple Signing Monitor, the Yearly Checkup, the
 * Workspace Backup Reminder, the Due-Date Reminders, and this reminder too. A
 * commit to main, which here means a release, is the activity known to count.
 *
 * Every Monday, Maintenance Release Reminder (.github/workflows/
 * maintenance-release-reminder.yml) runs check and remind:
 *
 * - From 45 days after main's last commit, it opens one "Maintenance release
 *   due" tracking issue, at High priority, with the release's checklist, and
 *   the maintenance release's version pull request into release-candidate,
 *   "Set the version to X.Y.Z", on its own new branch,
 *   maintenance/version-X.Y.Z. The pull request says "Part of #" the issue,
 *   and how many days are left; each later run updates that count. It never
 *   opens a second of either.
 * - The first run after a new commit on main closes the issue (Closes only
 *   works on main), and, once the version has moved on, the pull request,
 *   deleting its branch. It never pushes to a branch it didn't just create.
 * - If release-candidate's version is already raised, there's no version
 *   pull request to open, so it opens only the issue.
 * - Separately, an alert issue names any scheduled workflow GitHub has
 *   already turned off for inactivity, with how to turn it back on by hand.
 *
 * It never enables a workflow, and it runs none of release-candidate's code:
 * main's sync-version.js raises the version in copies of the version files.
 */
const { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { dirname, join } = require('node:path');

const DUE_AFTER_DAYS = 45;
const DISABLE_AFTER_DAYS = 60;
const BASE = 'release-candidate';
const BRANCH_PREFIX = 'maintenance/version-';
const BOT = 'github-actions[bot]';
const VERSION_FILES = ['package.json', 'package-lock.json', 'app.json', 'public/sw.js'];
const RELEASE_TITLE = 'Maintenance release due';
const TURNED_OFF_TITLE = 'Scheduled workflows turned off for inactivity';
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

/** The next patch version, as `sync-version --increment` makes it. */
const nextPatch = (version) => {
  const [major, minor, patch] = String(version).split('.').map(Number);
  return `${major}.${minor}.${patch + 1}`;
};

/** -1, 0, or 1, comparing two major.minor.patch versions. */
const compareVersions = (a, b) => {
  const [x, y] = [a, b].map((version) => String(version).split('.').map(Number));
  for (let i = 0; i < 3; i += 1) {
    if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  }
  return 0;
};

/**
 * Reads each scheduled workflow's state and main's last commit, and reports
 * { turnedOff, unread, daysSinceCommit }. It changes nothing.
 */
const check = async ({ github, context, core, workflows, now = new Date() }) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const result = { turnedOff: [], unread: [], daysSinceCommit: null, lastCommit: null };
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
    result.lastCommit = committed.toISOString();
  } catch (error) {
    core?.warning(`Couldn't read main's last commit: ${error.message}`);
  }
  return result;
};

/** "in 12 days", "today", or "now: it may be overdue". */
const dueIn = (days) => {
  const left = DISABLE_AFTER_DAYS - days;
  if (left > 1) return `in ${left} days`;
  if (left === 1) return 'tomorrow';
  return left === 0 ? 'today' : 'now, and GitHub may already have turned them off';
};

/** The date, YYYY-MM-DD, 60 days after main's last commit, or "soon". */
const offDate = (lastCommit) =>
  lastCommit ? new Date(new Date(lastCommit).getTime() + DISABLE_AFTER_DAYS * DAY_MS).toISOString().slice(0, 10) : 'soon';

/** The version pull request's description. */
const buildVersionPullBody = ({ version, days, issueNumber, runUrl, docs }) =>
  [
    `**A release to \`main\` is due ${dueIn(days)}.** \`main\`'s last commit was ${days} days ago, and GitHub turns this repository's scheduled workflows off after ${DISABLE_AFTER_DAYS} days without a commit to \`main\`: the Apple Signing Monitor, the Yearly Checkup, the Workspace Backup Reminder, the Due-Date Reminders, and the reminder that opened this. Once they're off, nothing reminds anyone.`,
    '',
    `This sets the version to ${version} (\`npm run sync-version -- --increment\`, a patch release) for a maintenance release.`,
    '',
    `**Its checks don't start on their own.** \`release-candidate\` requires Jest unit tests, validate-pr, and require-linked-issue, and a required check that never reports blocks the merge, but a pull request the workflow token opens holds its runs ([GitHub's docs](${docs.tokenEvents})). Either:`,
    '- select "Approve workflows to run" in the merge box below, or close this pull request and reopen it once, and they finish in a few minutes; or',
    '- as an admin, merge it with "Merge without waiting for requirements to be met (bypass rules)", which the PR approval ruleset allows admins.',
    '',
    'It changes only the four version files, and the release pull request runs every check again.',
    '',
    'The maintenance release:',
    `- [ ] Merge or close the open Dependabot pull requests ([Dependabot pull requests](${docs.dependabot})).`,
    '- [ ] Run `npm audit`, and take Expo\'s SDK patch updates with `npx expo install --check`, each in its own pull request. A change to `package-lock.json` gets an Android and an iPhone launch on a device or emulator before it\'s called ready.',
    '- [ ] Merge this pull request.',
    `- [ ] Open the release pull request from \`release-candidate\` into \`main\`, titled \`Release/${version}: …\`, and merge it once its checks and the screenshot review pass ([Shipping a release to \`main\`](${docs.release})).`,
    '- [ ] At the merge, **Native Android build** and **Native iOS build** wait for `production` approval. A maintenance release needn\'t go to the stores, so reject them unless it should. Approve or reject **Deploy Bulletin Apps Script** as usual.',
    '',
    `The reminder updates the count here each Monday, and closes this pull request once a release moves the version past ${version}. Last run: ${runUrl}`,
    '',
    ...(issueNumber ? [`Part of #${issueNumber}`] : []),
    'Related to #658',
  ].join('\n');

/**
 * The "Maintenance release due" tracking issue. `version` is the version to
 * release: release-candidate's when it's already raised (`raised`), or the
 * one the version pull request sets.
 */
const buildReleaseIssue = ({ version, raised, days, lastCommit, runUrl, docs }) =>
  [
    `**A release to \`main\` is due by ${offDate(lastCommit)}.** \`main\`'s last commit was ${days} days ago, and GitHub turns this repository's scheduled workflows off after ${DISABLE_AFTER_DAYS} days without a commit to \`main\`: the Apple Signing Monitor, the Yearly Checkup, the Workspace Backup Reminder, the Due-Date Reminders, and this reminder. Once they're off, nothing reminds anyone.`,
    '',
    'A light maintenance release:',
    `- [ ] Merge or close the open Dependabot pull requests ([Dependabot pull requests](${docs.dependabot})).`,
    '- [ ] Run `npm audit`, and take Expo\'s SDK patch updates with `npx expo install --check`, each in its own pull request. A change to `package-lock.json` gets an Android and an iPhone launch on a device or emulator before it\'s called ready.',
    raised
      ? `- [x] The version: \`release-candidate\` already has ${version}.`
      : `- [ ] Merge the version pull request, **Set the version to ${version}**, which the reminder opens and links here. Its description says how to get it past its checks.`,
    `- [ ] Open the release pull request from \`release-candidate\` into \`main\`, titled \`Release/${version}: …\`, and merge it once its checks and the screenshot review pass ([Shipping a release to \`main\`](${docs.release})).`,
    '- [ ] At the merge, **Native Android build** and **Native iOS build** wait for `production` approval. A maintenance release needn\'t go to the stores, so reject them unless it should. Approve or reject **Deploy Bulletin Apps Script** as usual.',
    '',
    `The reminder closes this issue on its first run after a new commit on \`main\`, and the version pull request too if the release moved the version past it. Run: ${runUrl}`,
    '',
    'Related to #658',
  ].join('\n');

/** The alert for workflows GitHub turned off, or null when there are none. */
const buildTurnedOffAlert = (turnedOff, runUrl, runbookUrl) => {
  if (!turnedOff.length) return null;
  const names = turnedOff.map((workflow) => `**${workflow.name}** (\`${workflow.file}\`)`).join(', ');
  return [
    `GitHub has turned off ${names} for inactivity.`,
    '',
    `Turn each back on by hand: open it under **Actions** and select **Enable workflow**, or run \`gh workflow enable <file>\`. Then run any reminder it missed (**Run workflow**). A commit to \`main\` starts GitHub's ${DISABLE_AFTER_DAYS} days again.`,
    '',
    `This issue closes itself once none is off. Run: ${runUrl}`,
    '',
    `More: ${runbookUrl}`,
  ].join('\n');
};

/** A file's text on a ref, or null if it isn't there. */
const readFile = async ({ github, repo, path, ref }) => {
  try {
    const { data } = await github.rest.repos.getContent({ ...repo, path, ref, mediaType: { format: 'raw' } });
    return String(data);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
};

/** The open version pull request this reminder opened, if any. */
const findOwnPull = async ({ github, repo }) => {
  const pulls = await github.paginate(github.rest.pulls.list, { ...repo, state: 'open', base: BASE, per_page: 100 });
  return (
    pulls.find(
      (pull) =>
        pull.user?.login === BOT &&
        pull.head?.ref?.startsWith(BRANCH_PREFIX) &&
        pull.head?.repo?.full_name === `${repo.owner}/${repo.repo}`,
    ) || null
  );
};

/**
 * Opens the version pull request: the version files from release-candidate,
 * raised one patch by main's syncVersion, committed on a new branch through
 * the API. Returns { action, number?, version? }.
 */
const openVersionPull = async ({ github, repo, syncVersion, rcSha, days, issueNumber, runUrl, docs }) => {
  const dir = mkdtempSync(join(tmpdir(), 'maintenance-version-'));
  const before = {};
  for (const path of VERSION_FILES) {
    const text = await readFile({ github, repo, path, ref: rcSha });
    if (text === null) continue;
    before[path] = text;
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  const version = syncVersion({ projectRoot: dir, increment: true, logger: { log: () => {} } });
  const branch = `${BRANCH_PREFIX}${version}`;
  try {
    await github.rest.git.getRef({ ...repo, ref: `heads/${branch}` });
    // Someone's branch, or one left over: never push to it.
    return { action: 'branch-exists', branch, version };
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const changed = Object.keys(before).filter((path) => readFileSync(join(dir, path), 'utf8') !== before[path]);
  const tree = [];
  for (const path of changed) {
    const { data: blob } = await github.rest.git.createBlob({
      ...repo,
      content: readFileSync(join(dir, path), 'utf8'),
      encoding: 'utf-8',
    });
    tree.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
  }
  const { data: base } = await github.rest.git.getCommit({ ...repo, commit_sha: rcSha });
  const { data: newTree } = await github.rest.git.createTree({ ...repo, base_tree: base.tree.sha, tree });
  const { data: commit } = await github.rest.git.createCommit({
    ...repo,
    message: `Set the version to ${version}\n\nThe maintenance release (#658).`,
    tree: newTree.sha,
    parents: [rcSha],
  });
  await github.rest.git.createRef({ ...repo, ref: `refs/heads/${branch}`, sha: commit.sha });
  const { data: pull } = await github.rest.pulls.create({
    ...repo,
    title: `Set the version to ${version}`,
    head: branch,
    base: BASE,
    body: buildVersionPullBody({ version, days, issueNumber, runUrl, docs }),
  });
  return { action: 'opened', number: pull.number, version, branch };
};

/**
 * Opens, updates, or closes the version pull request, the fallback issue, and
 * the turned-off alert for what check found. `alerts` is
 * scripts/monitor-alert-issue.cjs, and `syncVersion` main's
 * public/sync-version.js. Returns what it did, for logging and tests.
 */
const remind = async ({ github, context, core, alerts, syncVersion, result, mainVersion, assignees, runUrl, docs }) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const done = {};
  const days = result.daysSinceCommit;

  let rcSha = null;
  try {
    const { data } = await github.rest.git.getRef({ ...repo, ref: `heads/${BASE}` });
    rcSha = data.object.sha;
  } catch (error) {
    if (error.status !== 404) throw error;
  }
  const rcPackage = rcSha && (await readFile({ github, repo, path: 'package.json', ref: rcSha }));
  const rcVersion = rcPackage ? JSON.parse(rcPackage).version : null;

  const due = days !== null && days >= DUE_AFTER_DAYS && rcSha;
  const raised = Boolean(rcVersion && compareVersions(rcVersion, mainVersion) > 0);
  const own = await findOwnPull({ github, repo });
  const ownVersion = own ? own.head.ref.slice(BRANCH_PREFIX.length) : null;
  const stale =
    own && (compareVersions(mainVersion, ownVersion) >= 0 || (rcVersion && compareVersions(rcVersion, ownVersion) >= 0));

  // The tracking issue, opened once at 45 days.
  let issueNumber = null;
  if (due) {
    const existing = await alerts.findOpenAlert({ github, context, title: RELEASE_TITLE });
    if (existing) {
      issueNumber = existing.number;
      done.issue = `kept #${issueNumber}`;
    } else {
      // The version to release: release-candidate's if it's raised, else the
      // next patch, which the version pull request sets.
      const version = raised ? rcVersion : own && !stale ? ownVersion : nextPatch(rcVersion || mainVersion);
      const opened = await alerts.openOrUpdateAlert({
        github,
        context,
        core,
        title: RELEASE_TITLE,
        body: buildReleaseIssue({ version, raised, days, lastCommit: result.lastCommit, runUrl, docs }),
        priority: 'High',
        assignees,
      });
      issueNumber = opened.number;
      done.issue = `opened #${issueNumber}`;
    }
  } else if (days !== null && days < DUE_AFTER_DAYS) {
    // The first run after a new commit on main.
    const closed = await alerts.closeAlert({
      github,
      context,
      title: RELEASE_TITLE,
      body: `\`main\` has a commit from ${days} days ago, so this is done. Run: ${runUrl}`,
    });
    done.issue = closed.action;
  }

  if (own && stale) {
    await github.rest.issues.createComment({
      ...repo,
      issue_number: own.number,
      body: `The version has moved on (\`main\` ${mainVersion}, \`release-candidate\` ${rcVersion ?? 'missing'}), so this is no longer needed. Closing it and deleting its branch. Run: ${runUrl}`,
    });
    await github.rest.pulls.update({ ...repo, pull_number: own.number, state: 'closed' });
    await github.rest.git.deleteRef({ ...repo, ref: `heads/${own.head.ref}` });
    done.pull = `closed #${own.number}`;
  } else if (own) {
    if (days !== null) {
      await github.rest.pulls.update({
        ...repo,
        pull_number: own.number,
        body: buildVersionPullBody({ version: ownVersion, days, issueNumber, runUrl, docs }),
      });
      done.pull = `updated #${own.number}`;
    } else {
      done.pull = `kept #${own.number}`;
    }
  } else if (due && !raised) {
    const opened = await openVersionPull({ github, repo, syncVersion, rcSha, days, issueNumber, runUrl, docs });
    if (opened.action === 'opened') {
      done.pull = `opened #${opened.number}`;
      if (issueNumber) {
        await github.rest.issues.createComment({
          ...repo,
          issue_number: issueNumber,
          body: `Opened the version pull request, #${opened.number}: **Set the version to ${opened.version}**.`,
        });
      }
    } else {
      done.pull = `${opened.action} ${opened.branch}`;
      core?.warning(`${opened.branch} already exists, so no version pull request was opened.`);
    }
  } else {
    done.pull = raised && due ? 'version already raised' : days === null ? 'unknown' : 'not due';
  }

  const offBody = buildTurnedOffAlert(result.turnedOff, runUrl, docs.runbook);
  if (offBody) {
    const opened = await alerts.openOrUpdateAlert({
      github,
      context,
      core,
      title: TURNED_OFF_TITLE,
      body: offBody,
      priority: 'High',
      assignees,
    });
    done.turnedOff = `${opened.action} #${opened.number}`;
  } else {
    const closed = await alerts.closeAlert({
      github,
      context,
      title: TURNED_OFF_TITLE,
      body: `Every scheduled workflow is on again, as of ${runUrl}.`,
    });
    done.turnedOff = closed.action;
  }
  return done;
};

module.exports = {
  BRANCH_PREFIX,
  DUE_AFTER_DAYS,
  RELEASE_TITLE,
  TURNED_OFF_TITLE,
  VERSION_FILES,
  buildReleaseIssue,
  buildTurnedOffAlert,
  buildVersionPullBody,
  check,
  compareVersions,
  findScheduledWorkflows,
  remind,
};
