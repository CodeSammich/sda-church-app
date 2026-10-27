import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const alerts = require('../scripts/monitor-alert-issue.cjs');
const { buildStoreToolchainAlert } = require('../scripts/check-store-toolchain.cjs');

const TITLE = '[monitor] Example alert';
const context = {
  serverUrl: 'https://github.com',
  repo: { owner: 'org', repo: 'repo' },
  runId: 42,
  actor: 'workflow-actor',
};

type Call = [string, Record<string, any>];

// A stand-in for actions/github-script's `github` and `core` objects that
// records every call. `rejectAssignees` mimics GitHub refusing an assignee
// without repository access, which fails the whole create request.
const PRIORITY_FIELD = {
  id: 'FIELD',
  name: 'Priority',
  options: ['Urgent', 'High', 'Medium', 'Low'].map((name) => ({ id: `OPT-${name}`, name })),
};

const createGitHub = ({
  openIssues = [] as { number: number; title: string; pull_request?: object }[],
  rejectAssignees = false,
  // The issue's current Priority, the repository's issue fields, and whether
  // GitHub refuses the GraphQL request, as with a token that can't set fields.
  currentPriority = null as string | null,
  issueFields = [PRIORITY_FIELD, {}] as Record<string, any>[],
  rejectGraphql = false,
} = {}) => {
  const calls: Call[] = [];
  // What each list request asked for, kept apart so `calls` holds only writes.
  const listed: Record<string, any>[] = [];
  const github = {
    paginate: async (_method: unknown, params: Record<string, any>) => {
      listed.push(params);
      return openIssues;
    },
    rest: {
      issues: {
        listForRepo: () => undefined,
        create: async (args: Record<string, any>) => {
          calls.push(['create', args]);
          if (rejectAssignees && args.assignees?.length) {
            throw new Error('Validation Failed: invalid assignee');
          }
          return { data: { number: 101 } };
        },
        createComment: async (args: Record<string, any>) => {
          calls.push(['comment', args]);
        },
        addLabels: async (args: Record<string, any>) => {
          calls.push(['addLabels', args]);
        },
        update: async (args: Record<string, any>) => {
          calls.push(['update', args]);
        },
      },
    },
    graphql: async (query: string, variables: Record<string, any>) => {
      if (query.startsWith('mutation')) {
        calls.push(['setPriority', variables]);
        return {};
      }
      listed.push(variables);
      if (rejectGraphql) {
        throw new Error('Resource not accessible by integration');
      }
      return {
        repository: {
          issueFields: { nodes: issueFields },
          issue: {
            id: `ISSUE-${variables.number}`,
            issueFieldValues: {
              nodes: currentPriority ? [{ name: currentPriority, field: { id: 'FIELD' } }] : [],
            },
          },
        },
      };
    },
  };
  const core = { warning: (message: string) => calls.push(['warning', { message }]) };
  const of = (name: string) => calls.filter((call) => call[0] === name).map((call) => call[1]);
  return { github, core, calls, listed, of };
};

describe('monitor alert issues', () => {
  it('parses assignees from the Actions variable', () => {
    expect(alerts.parseAssignees(' alice, @bob ,,')).toEqual(['alice', 'bob']);
    expect(alerts.parseAssignees(undefined)).toEqual([]);
  });

  it('opens a new alert assigned and labeled, without an @mention', async () => {
    const { github, core, of } = createGitHub();

    const result = await alerts.openOrUpdateAlert({
      github, context, core, title: TITLE, body: 'Body', labels: ['needs-attention'], assignees: ['alice'],
    });

    expect(result).toEqual({ action: 'created', number: 101 });
    expect(of('create')).toEqual([
      { owner: 'org', repo: 'repo', title: TITLE, body: 'Body', labels: ['needs-attention'], assignees: ['alice'] },
    ]);
  });

  it('@mentions the run actor when no one is assigned', async () => {
    const { github, core, of } = createGitHub();

    await alerts.openOrUpdateAlert({ github, context, core, title: TITLE, body: 'Body' });

    expect(of('create')[0]).toMatchObject({ body: '@workflow-actor\n\nBody', assignees: [] });
  });

  it('still opens the alert, labeled and with an @mention, when an assignee is rejected', async () => {
    const { github, core, of } = createGitHub({ rejectAssignees: true });

    const result = await alerts.openOrUpdateAlert({
      github, context, core, title: TITLE, body: 'Body', labels: ['needs-attention'], assignees: ['no-access'],
    });

    expect(result.action).toBe('created-without-assignees');
    expect(of('create')[1]).toEqual({
      owner: 'org', repo: 'repo', title: TITLE, body: '@workflow-actor\n\nBody', labels: ['needs-attention'],
    });
    expect(of('warning')[0].message).toContain('Could not assign no-access');
  });

  it('comments on and labels the open alert instead of opening another', async () => {
    const { github, core, of } = createGitHub({
      openIssues: [{ number: 8, title: 'Unrelated' }, { number: 7, title: TITLE }],
    });

    const result = await alerts.openOrUpdateAlert({
      github, context, core, title: TITLE, body: 'Body', labels: ['needs-attention'], assignees: ['alice'],
    });

    expect(result).toEqual({ action: 'commented', number: 7 });
    expect(of('create')).toEqual([]);
    expect(of('comment')).toEqual([{ owner: 'org', repo: 'repo', issue_number: 7, body: 'Body' }]);
    expect(of('addLabels')).toEqual([{ owner: 'org', repo: 'repo', issue_number: 7, labels: ['needs-attention'] }]);
  });

  it('adds no labels to the open alert when there are none to add', async () => {
    const { github, core, of } = createGitHub({ openIssues: [{ number: 7, title: TITLE }] });

    await alerts.openOrUpdateAlert({ github, context, core, title: TITLE, body: 'Body', assignees: ['alice'] });

    expect(of('addLabels')).toEqual([]);
  });

  it('sets the Priority of a new alert', async () => {
    const { github, core, of } = createGitHub();

    await alerts.openOrUpdateAlert({
      github, context, core, title: TITLE, body: 'Body', priority: 'Urgent', assignees: ['alice'],
    });

    expect(of('setPriority')).toEqual([{ issueId: 'ISSUE-101', fieldId: 'FIELD', optionId: 'OPT-Urgent' }]);
    expect(of('warning')).toEqual([]);
  });

  it('sets the Priority of the open alert, but keeps one a person chose', async () => {
    const unset = createGitHub({ openIssues: [{ number: 7, title: TITLE }] });
    await alerts.openOrUpdateAlert({
      github: unset.github, context, core: unset.core, title: TITLE, body: 'Body', priority: 'Urgent', assignees: ['alice'],
    });
    expect(unset.of('setPriority')).toEqual([{ issueId: 'ISSUE-7', fieldId: 'FIELD', optionId: 'OPT-Urgent' }]);

    const chosen = createGitHub({ openIssues: [{ number: 7, title: TITLE }], currentPriority: 'High' });
    const result = await alerts.setPriority({
      github: chosen.github, context, core: chosen.core, issueNumber: 7, priority: 'Urgent',
    });
    expect(result).toEqual({ action: 'kept', priority: 'High' });
    expect(chosen.of('setPriority')).toEqual([]);
  });

  it('still opens the alert, with a warning, when the Priority cannot be set', async () => {
    const refused = createGitHub({ rejectGraphql: true });
    const result = await alerts.openOrUpdateAlert({
      github: refused.github, context, core: refused.core, title: TITLE, body: 'Body', priority: 'Urgent', assignees: ['alice'],
    });
    expect(result).toEqual({ action: 'created', number: 101 });
    expect(refused.of('warning')[0].message).toContain('Could not set #101');

    const noField = createGitHub({ issueFields: [{}] });
    await alerts.openOrUpdateAlert({
      github: noField.github, context, core: noField.core, title: TITLE, body: 'Body', priority: 'Urgent', assignees: ['alice'],
    });
    expect(noField.of('setPriority')).toEqual([]);
    expect(noField.of('warning')[0].message).toContain('no Priority field with a Urgent option');
  });

  it('asks GitHub nothing about the Priority when the alert has none', async () => {
    const { github, core, of, listed } = createGitHub();

    await alerts.openOrUpdateAlert({ github, context, core, title: TITLE, body: 'Body', assignees: ['alice'] });

    expect(of('setPriority')).toEqual([]);
    expect(listed.filter((params) => 'number' in params)).toEqual([]);
  });

  it('closes the open alert on recovery, and does nothing when none is open', async () => {
    const open = createGitHub({ openIssues: [{ number: 7, title: TITLE }] });
    const none = createGitHub({ openIssues: [{ number: 8, title: 'Unrelated' }] });

    expect(await alerts.closeAlert({ ...open, context, title: TITLE, body: 'Recovered' })).toEqual({
      action: 'closed', number: 7,
    });
    expect(open.of('update')).toEqual([
      { owner: 'org', repo: 'repo', issue_number: 7, state: 'closed', state_reason: 'completed' },
    ]);
    expect(await alerts.closeAlert({ ...none, context, title: TITLE, body: 'Recovered' })).toEqual({ action: 'none' });
    expect(none.calls).toEqual([]);
  });

  it('reads a missing report as null with a warning', () => {
    const { core, of } = createGitHub();

    expect(alerts.readReport('/nonexistent/report.json', core)).toBeNull();
    expect(of('warning')).toHaveLength(1);
  });
});

describe('dated reminder issues', () => {
  it('opens the issue assigned, without an @mention', async () => {
    const { github, core, of } = createGitHub();

    const result = await alerts.openIssueOnce({ github, context, core, title: TITLE, body: 'Body', assignees: ['alice'] });

    expect(result).toEqual({ action: 'created', number: 101 });
    expect(of('create')).toEqual([{ owner: 'org', repo: 'repo', title: TITLE, body: 'Body', assignees: ['alice'] }]);
  });

  it('does nothing when the title already exists, even closed, but ignores a pull request', async () => {
    const closed = createGitHub({ openIssues: [{ number: 7, title: TITLE }] });
    expect(await alerts.openIssueOnce({ ...closed, context, title: TITLE, body: 'Body' })).toEqual({
      action: 'exists', number: 7,
    });
    expect(closed.of('create')).toEqual([]);
    // It finds closed issues because it lists every state.
    expect(closed.listed).toEqual([{ owner: 'org', repo: 'repo', state: 'all', per_page: 100 }]);

    const pullRequest = createGitHub({ openIssues: [{ number: 3, title: TITLE, pull_request: {} }] });
    expect(await alerts.openIssueOnce({ ...pullRequest, context, title: TITLE, body: 'Body' })).toMatchObject({
      action: 'created',
    });
  });

  it('@mentions the run actor when no one is assigned, or an assignee is rejected', async () => {
    const unassigned = createGitHub();
    await alerts.openIssueOnce({ ...unassigned, context, title: TITLE, body: 'Body' });
    expect(unassigned.of('create')[0]).toMatchObject({ body: '@workflow-actor\n\nBody' });

    const rejected = createGitHub({ rejectAssignees: true });
    expect(
      await alerts.openIssueOnce({ ...rejected, context, title: TITLE, body: 'Body', assignees: ['no-access'] }),
    ).toEqual({ action: 'created-without-assignees', number: 101 });
    expect(rejected.of('create')[1]).toEqual({ owner: 'org', repo: 'repo', title: TITLE, body: '@workflow-actor\n\nBody' });
    expect(rejected.of('warning')[0].message).toContain('Could not assign no-access');
  });
});

describe('store toolchain alert text', () => {
  const runUrl = 'https://github.com/org/repo/actions/runs/42';

  it('makes a missed requirement Urgent and leads with its deadline', () => {
    const alert = buildStoreToolchainAlert(
      {
        checks: [{ status: 'failed', kind: 'requirement' }],
        markdown: '### Store toolchain requirements\n\n**Deadline passed on 2026-08-31:** …',
      },
      runUrl,
    );

    expect(alert.title).toBe('[monitor] Store toolchain requirements need attention');
    expect(alert.priority).toBe('Urgent');
    expect(alert).not.toHaveProperty('labels');
    expect(alert.body).toContain('**Deadline passed on 2026-08-31:**');
    expect(alert.body).toContain(`Run: ${runUrl}`);
  });

  it('gives an unreadable page or a missing report no priority', () => {
    const unreadable = buildStoreToolchainAlert(
      { checks: [{ status: 'failed', kind: 'unreadable' }], markdown: '### …' },
      runUrl,
    );
    const missing = buildStoreToolchainAlert(null, runUrl);

    expect(unreadable.priority).toBeNull();
    expect(missing.priority).toBeNull();
    expect(missing.body).toContain('exited before producing a readable report');
  });
});

describe('monitor workflow wiring', () => {
  it.each(['external-dependency-monitor.yml', 'store-toolchain-monitor.yml', 'expo-doctor-monitor.yml'])(
    '%s uses the shared module and the assignee variable',
    (file) => {
      const workflow = readFileSync(join(process.cwd(), '.github/workflows', file), 'utf8');

      expect(workflow).toContain('actions/checkout@');
      // One require in the open step and one in the close step.
      expect(
        workflow.match(/require\(`\$\{process\.env\.GITHUB_WORKSPACE\}\/scripts\/monitor-alert-issue\.cjs`\)/g),
      ).toHaveLength(2);
      expect(workflow).toContain('ALERT_ASSIGNEES: ${{ vars.MONITOR_ALERT_ASSIGNEES }}');
      expect(workflow).toContain('alerts.openOrUpdateAlert(');
      expect(workflow).toContain('alerts.closeAlert(');
    },
  );
});
