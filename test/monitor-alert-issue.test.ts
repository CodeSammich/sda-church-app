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
const createGitHub = ({ openIssues = [] as { number: number; title: string }[], rejectAssignees = false } = {}) => {
  const calls: Call[] = [];
  const github = {
    paginate: async () => openIssues,
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
  };
  const core = { warning: (message: string) => calls.push(['warning', { message }]) };
  const of = (name: string) => calls.filter((call) => call[0] === name).map((call) => call[1]);
  return { github, core, calls, of };
};

describe('monitor alert issues', () => {
  it('parses assignees from the Actions variable', () => {
    expect(alerts.parseAssignees(' alice, @bob ,,')).toEqual(['alice', 'bob']);
    expect(alerts.parseAssignees(undefined)).toEqual([]);
  });

  it('opens a new alert assigned and labeled, without an @mention', async () => {
    const { github, core, of } = createGitHub();

    const result = await alerts.openOrUpdateAlert({
      github, context, core, title: TITLE, body: 'Body', labels: ['critical'], assignees: ['alice'],
    });

    expect(result).toEqual({ action: 'created', number: 101 });
    expect(of('create')).toEqual([
      { owner: 'org', repo: 'repo', title: TITLE, body: 'Body', labels: ['critical'], assignees: ['alice'] },
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
      github, context, core, title: TITLE, body: 'Body', labels: ['critical'], assignees: ['no-access'],
    });

    expect(result.action).toBe('created-without-assignees');
    expect(of('create')[1]).toEqual({
      owner: 'org', repo: 'repo', title: TITLE, body: '@workflow-actor\n\nBody', labels: ['critical'],
    });
    expect(of('warning')[0].message).toContain('Could not assign no-access');
  });

  it('comments on and labels the open alert instead of opening another', async () => {
    const { github, core, of } = createGitHub({
      openIssues: [{ number: 8, title: 'Unrelated' }, { number: 7, title: TITLE }],
    });

    const result = await alerts.openOrUpdateAlert({
      github, context, core, title: TITLE, body: 'Body', labels: ['critical'], assignees: ['alice'],
    });

    expect(result).toEqual({ action: 'commented', number: 7 });
    expect(of('create')).toEqual([]);
    expect(of('comment')).toEqual([{ owner: 'org', repo: 'repo', issue_number: 7, body: 'Body' }]);
    expect(of('addLabels')).toEqual([{ owner: 'org', repo: 'repo', issue_number: 7, labels: ['critical'] }]);
  });

  it('adds no labels to the open alert when there are none to add', async () => {
    const { github, core, of } = createGitHub({ openIssues: [{ number: 7, title: TITLE }] });

    await alerts.openOrUpdateAlert({ github, context, core, title: TITLE, body: 'Body', assignees: ['alice'] });

    expect(of('addLabels')).toEqual([]);
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

describe('store toolchain alert text', () => {
  const runUrl = 'https://github.com/org/repo/actions/runs/42';

  it('labels a missed requirement critical and leads with its deadline', () => {
    const alert = buildStoreToolchainAlert(
      {
        checks: [{ status: 'failed', kind: 'requirement' }],
        markdown: '### Store toolchain requirements\n\n**Deadline passed on 2026-08-31:** …',
      },
      runUrl,
    );

    expect(alert.title).toBe('[monitor] Store toolchain requirements need attention');
    expect(alert.labels).toEqual(['critical / launch blocking']);
    expect(alert.body).toContain('**Deadline passed on 2026-08-31:**');
    expect(alert.body).toContain(`Run: ${runUrl}`);
  });

  it('does not label an unreadable page or a missing report critical', () => {
    const unreadable = buildStoreToolchainAlert(
      { checks: [{ status: 'failed', kind: 'unreadable' }], markdown: '### …' },
      runUrl,
    );
    const missing = buildStoreToolchainAlert(null, runUrl);

    expect(unreadable.labels).toEqual([]);
    expect(missing.labels).toEqual([]);
    expect(missing.body).toContain('exited before producing a readable report');
  });
});

describe('monitor workflow wiring', () => {
  it.each(['external-dependency-monitor.yml', 'store-toolchain-monitor.yml'])(
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
