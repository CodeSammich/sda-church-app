import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const {
  parseDueDate,
  postDueDateReminders,
  stageFor,
  todayInNewYork,
} = require('../scripts/due-date-reminders.cjs');

const context = { repo: { owner: 'church', repo: 'app' }, actor: 'someone' };

type Issue = {
  number: number;
  body: string;
  author_association?: string;
  user?: { login: string };
  pull_request?: object;
  locked?: boolean;
};
type Comment = string | { body: string; login: string };

/**
 * A fake GitHub client with open issues, their comments (a plain string is one
 * of this workflow's own), and the repository access of some users.
 */
const fakeGithub = (issues: Issue[], comments: Record<number, Comment[]> = {}, roles: Record<string, string> = {}) => {
  const posted: Array<{ issue_number: number; body: string }> = [];
  const listForRepo = jest.fn();
  const listComments = jest.fn();
  return {
    posted,
    paginate: async (method: unknown, request: { issue_number?: number }) =>
      method === listForRepo
        ? issues.map((issue) => ({ author_association: 'OWNER', ...issue }))
        : (comments[request.issue_number as number] || []).map((comment) =>
            typeof comment === 'string'
              ? { body: comment, user: { login: 'github-actions[bot]' } }
              : { body: comment.body, user: { login: comment.login } },
          ),
    rest: {
      issues: {
        listForRepo,
        listComments,
        createComment: jest.fn(async (request: { issue_number: number; body: string }) => {
          if (issues.find((issue) => issue.number === request.issue_number)?.locked) {
            throw new Error('Issue is locked');
          }
          posted.push(request);
        }),
      },
      repos: {
        getCollaboratorPermissionLevel: jest.fn(async ({ username }: { username: string }) => {
          if (!(username in roles)) throw new Error('Not Found');
          return { data: { role_name: roles[username] } };
        }),
      },
    },
  };
};

describe('due dates', () => {
  it('reads the Due: line, bold or not, anywhere in the description', () => {
    expect(parseDueDate('Due: 2027-04-01')).toBe('2027-04-01');
    expect(parseDueDate('Some text.\n\n**Due: 2027-04-01**, when the App Store requires it.')).toBe('2027-04-01');
    expect(parseDueDate('**Due:** 2027-04-01')).toBe('2027-04-01');
    expect(parseDueDate('due: 2027-04-01')).toBe('2027-04-01');
    expect(parseDueDate('**Due**: 2027-04-01')).toBe('2027-04-01');
    expect(parseDueDate('- Due: 2027-04-01')).toBe('2027-04-01');
    expect(parseDueDate('* Due: 2027-04-01')).toBe('2027-04-01');
  });

  it('ignores missing, vague, and impossible dates, and Due: in the middle of a line', () => {
    expect(parseDueDate('')).toBeNull();
    expect(parseDueDate(null)).toBeNull();
    expect(parseDueDate('**Due: April 2027**')).toBeNull();
    expect(parseDueDate('Due: 2027-02-30')).toBeNull();
    expect(parseDueDate('The fix is Due: 2027-04-01')).toBeNull();
  });

  it('reaches the 30-day, 7-day, and overdue stages', () => {
    expect(stageFor('2027-04-01', '2027-03-01')).toBeNull();
    expect(stageFor('2027-04-01', '2027-03-02')).toEqual({ key: '30', daysLeft: 30 });
    expect(stageFor('2027-04-01', '2027-03-25')).toEqual({ key: '7', daysLeft: 7 });
    expect(stageFor('2027-04-01', '2027-04-01')).toEqual({ key: '7', daysLeft: 0 });
    expect(stageFor('2027-04-01', '2027-04-02')).toEqual({ key: 'overdue', daysLeft: -1 });
  });

  it("counts days from New York's date, not UTC's", () => {
    // 1 a.m. UTC on March 2 is still March 1 in New York.
    expect(todayInNewYork(new Date('2027-03-02T01:00:00Z'))).toBe('2027-03-01');
  });
});

describe('posting reminders', () => {
  it('mentions the assignees once a due date is 30 days away', async () => {
    const github = fakeGithub([{ number: 432, body: '**Due: 2027-04-01**, when the App Store requires it.' }]);
    const results = await postDueDateReminders({
      github,
      context,
      assignees: ['church-it'],
      today: '2027-03-02',
    });
    expect(results).toEqual([{ number: 432, dueDate: '2027-04-01', action: 'reminded (30)' }]);
    expect(github.posted).toHaveLength(1);
    expect(github.posted[0].issue_number).toBe(432);
    expect(github.posted[0].body).toContain('<!-- due-reminder 2027-04-01 30 -->');
    expect(github.posted[0].body).toContain('@church-it This issue is due on **April 1, 2027**, in 30 days.');
  });

  it('posts each stage only once per date', async () => {
    const github = fakeGithub(
      [{ number: 432, body: 'Due: 2027-04-01' }],
      { 432: ['<!-- due-reminder 2027-04-01 30 -->\n@church-it This issue is due…'] },
    );
    const later = await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-03-10' });
    expect(later[0].action).toBe('already reminded');
    expect(github.posted).toHaveLength(0);

    const weekBefore = await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-03-25' });
    expect(weekBefore[0].action).toBe('reminded (7)');
    expect(github.posted[0].body).toContain('in 7 days');
  });

  it('starts over when the date changes', async () => {
    const github = fakeGithub(
      [{ number: 432, body: 'Due: 2027-04-28' }],
      { 432: ['<!-- due-reminder 2027-04-01 30 -->'] },
    );
    await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-04-01' });
    expect(github.posted[0].body).toContain('<!-- due-reminder 2027-04-28 30 -->');
  });

  it('says when a date is today or has passed', async () => {
    const today = fakeGithub([{ number: 1, body: 'Due: 2027-04-01' }]);
    await postDueDateReminders({ github: today, context, assignees: ['church-it'], today: '2027-04-01' });
    expect(today.posted[0].body).toContain('is due **today**, April 1, 2027');

    const overdue = fakeGithub([{ number: 1, body: 'Due: 2027-04-01' }]);
    await postDueDateReminders({ github: overdue, context, assignees: ['church-it'], today: '2027-04-03' });
    expect(overdue.posted[0].body).toContain('<!-- due-reminder 2027-04-01 overdue -->');
    expect(overdue.posted[0].body).toContain('was due on **April 1, 2027**, 2 days ago');
  });

  it("ignores a Due: line on an issue someone outside the church opened", async () => {
    const github = fakeGithub(
      [
        { number: 7, body: 'Due: 2027-04-01', author_association: 'NONE', user: { login: 'stranger' } },
        { number: 8, body: 'Due: 2027-04-01', author_association: 'CONTRIBUTOR', user: { login: 'past-contributor' } },
      ],
      {},
      { 'past-contributor': 'read' },
    );
    const results = await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-03-30' });
    expect(results.map((result: { action: string }) => result.action)).toEqual([
      'ignored: not opened by a maintainer',
      'ignored: not opened by a maintainer',
    ]);
    expect(github.posted).toHaveLength(0);
  });

  it('counts a private organization member by their access, not how the token sees them', async () => {
    const github = fakeGithub(
      [{ number: 9, body: 'Due: 2027-04-01', author_association: 'CONTRIBUTOR', user: { login: 'private-member' } }],
      {},
      { 'private-member': 'triage' },
    );
    const results = await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-03-30' });
    expect(results[0].action).toBe('reminded (7)');
  });

  it("doesn't let someone else's comment with the marker silence a reminder", async () => {
    const github = fakeGithub(
      [{ number: 432, body: 'Due: 2027-04-01' }],
      { 432: [{ body: '<!-- due-reminder 2027-04-01 30 -->', login: 'stranger' }] },
    );
    const results = await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-03-10' });
    expect(results[0].action).toBe('reminded (30)');
  });

  it("still reminds the other issues when one can't be commented on", async () => {
    const github = fakeGithub([
      { number: 1, body: 'Due: 2027-04-01', locked: true },
      { number: 2, body: 'Due: 2027-04-01' },
    ]);
    const results = await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-03-30' });
    expect(results.map((result: { action: string }) => result.action)).toEqual([
      'failed: Issue is locked',
      'reminded (7)',
    ]);
    expect(github.posted.map((post) => post.issue_number)).toEqual([2]);
  });

  it('skips pull requests, issues without a date, and dates more than 30 days off', async () => {
    const github = fakeGithub([
      { number: 1, body: 'Due: 2027-04-01', pull_request: {} },
      { number: 2, body: 'No date here.' },
      { number: 3, body: 'Due: 2027-12-25' },
    ]);
    const results = await postDueDateReminders({ github, context, assignees: ['church-it'], today: '2027-03-30' });
    expect(results).toEqual([{ number: 3, dueDate: '2027-12-25', action: 'not yet' }]);
    expect(github.posted).toHaveLength(0);
  });

  it("mentions the run's actor when there are no assignees, so a reminder is never lost", async () => {
    const github = fakeGithub([{ number: 1, body: 'Due: 2027-04-01' }]);
    await postDueDateReminders({ github, context, today: '2027-03-30' });
    expect(github.posted[0].body).toContain('@someone This issue');
  });
});

describe('due-date reminder workflow', () => {
  it('runs daily on the canonical repository and mentions the alert assignees', () => {
    const workflow = readFileSync(join(process.cwd(), '.github/workflows/due-date-reminders.yml'), 'utf8');
    expect(workflow).toMatch(/cron: "\d+ \d+ \* \* \*"/);
    expect(workflow).toContain('github.event.repository.fork == false');
    expect(workflow).toContain('ALERT_ASSIGNEES: ${{ vars.MONITOR_ALERT_ASSIGNEES }}');
    expect(workflow).toContain('reminders.postDueDateReminders(');
    expect(workflow).toContain('core.setFailed(');
    expect(workflow).toContain('issues: write');
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./);
  });
});
