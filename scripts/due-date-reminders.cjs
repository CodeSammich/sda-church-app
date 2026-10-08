/**
 * Due-date reminders. An open issue with a line such as `Due: 2027-04-01` (bold
 * is fine) gets a comment 30 days before that date, another 7 days before, and
 * one more once it has passed. Each comment @mentions the usernames in the
 * MONITOR_ALERT_ASSIGNEES Actions variable, so it notifies a maintainer without
 * anyone watching the repository. Run daily by
 * .github/workflows/due-date-reminders.yml.
 *
 * The repository is public, so only issues opened by someone who can triage or
 * manage the repository count; anyone else's `Due:` line can't make it notify
 * people. Each comment carries a hidden marker naming the date and the stage,
 * so a stage is posted once per date, and changing the date starts over. Only
 * this workflow's own comments count, so nobody else can silence a reminder.
 *
 * Called from actions/github-script, which passes its `github` and `context` in:
 *   const reminders = require(`${process.env.GITHUB_WORKSPACE}/scripts/due-date-reminders.cjs`);
 */

const TRUSTED_AUTHORS = ['OWNER', 'MEMBER', 'COLLABORATOR'];
const TRUSTED_ROLES = ['admin', 'maintain', 'write', 'triage'];
const REMINDER_AUTHOR = 'github-actions[bot]';

// Longest lead first: the first stage a date has reached is the one to post.
const STAGES = [
  { key: 'overdue', reached: (daysLeft) => daysLeft < 0 },
  { key: '7', reached: (daysLeft) => daysLeft <= 7 },
  { key: '30', reached: (daysLeft) => daysLeft <= 30 },
];

/** The ISO date on an issue's `Due:` line, or null. Ignores impossible dates. */
const parseDueDate = (body) => {
  const match = /^\s*(?:[-*+]\s+)?\**\s*Due\s*\**\s*:\s*\**\s*(\d{4})-(\d{2})-(\d{2})\b/im.exec(String(body || ''));
  if (!match) return null;
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return match.slice(1, 4).join('-');
};

/** Today's date in New York, as YYYY-MM-DD. */
const todayInNewYork = (now = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(now);

const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);

/** The stage a due date has reached today, or null when it is more than 30 days off. */
const stageFor = (dueDate, today) => {
  const daysLeft = daysBetween(today, dueDate);
  const stage = STAGES.find((candidate) => candidate.reached(daysLeft));
  return stage ? { key: stage.key, daysLeft } : null;
};

const markerFor = (dueDate, stageKey) => `<!-- due-reminder ${dueDate} ${stageKey} -->`;

const formatDate = (isoDate) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${isoDate}T00:00:00Z`));

const buildReminder = ({ dueDate, stage, mentions }) => {
  const when =
    stage.key === 'overdue'
      ? `was due on **${formatDate(dueDate)}**, ${-stage.daysLeft} ${-stage.daysLeft === 1 ? 'day' : 'days'} ago`
      : stage.daysLeft === 0
        ? `is due **today**, ${formatDate(dueDate)}`
        : `is due on **${formatDate(dueDate)}**, in ${stage.daysLeft} ${stage.daysLeft === 1 ? 'day' : 'days'}`;
  return [
    markerFor(dueDate, stage.key),
    `${mentions.map((login) => `@${login}`).join(' ')} This issue ${when}.`,
    '',
    'To change the date, edit the `Due:` line in the description. To stop these reminders, remove it or close the issue.',
  ].join('\n');
};

/**
 * Whether the issue's author can triage or manage the repository. Private
 * organization members can look like outsiders to the Actions token
 * (CONTRIBUTOR or NONE), so when the association isn't enough, ask for the
 * author's access.
 */
const openedByMaintainer = async ({ github, repo, issue }) => {
  if (TRUSTED_AUTHORS.includes(issue.author_association)) return true;
  const username = issue.user && issue.user.login;
  if (!username) return false;
  try {
    const { data } = await github.rest.repos.getCollaboratorPermissionLevel({ ...repo, username });
    return TRUSTED_ROLES.includes(data.role_name);
  } catch {
    return false;
  }
};

const remindIssue = async ({ github, repo, issue, dueDate, today, mentions }) => {
  if (!(await openedByMaintainer({ github, repo, issue }))) return 'ignored: not opened by a maintainer';
  const stage = stageFor(dueDate, today);
  if (!stage) return 'not yet';
  const marker = markerFor(dueDate, stage.key);
  const comments = await github.paginate(github.rest.issues.listComments, {
    ...repo,
    issue_number: issue.number,
    per_page: 100,
  });
  const reminded = comments.some(
    (comment) => comment.user && comment.user.login === REMINDER_AUTHOR && String(comment.body || '').includes(marker),
  );
  if (reminded) return 'already reminded';
  await github.rest.issues.createComment({
    ...repo,
    issue_number: issue.number,
    body: buildReminder({ dueDate, stage, mentions }),
  });
  return `reminded (${stage.key})`;
};

/**
 * Posts every reminder that is due today. Returns what it did, one entry per
 * issue with a due date, for logging and tests.
 */
const postDueDateReminders = async ({ github, context, assignees = [], today = todayInNewYork() }) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const mentions = assignees.length ? assignees : [context.actor];
  const issues = await github.paginate(github.rest.issues.listForRepo, { ...repo, state: 'open', per_page: 100 });
  const results = [];

  for (const issue of issues) {
    if (issue.pull_request) continue;
    const dueDate = parseDueDate(issue.body);
    if (!dueDate) continue;
    // One issue's failure, such as a locked issue, must not cost the others
    // their reminders.
    try {
      const action = await remindIssue({ github, repo, issue, dueDate, today, mentions });
      results.push({ number: issue.number, dueDate, action });
    } catch (error) {
      results.push({ number: issue.number, dueDate, action: `failed: ${error.message}` });
    }
  }
  return results;
};

module.exports = { buildReminder, parseDueDate, postDueDateReminders, stageFor, todayInNewYork };
