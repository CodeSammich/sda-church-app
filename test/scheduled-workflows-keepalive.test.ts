import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Scheduled Workflows Keepalive (#658): GitHub turns off a public repository's
// scheduled workflows after 60 days without activity.
const {
  ALERT_TITLE,
  WARN_AFTER_DAYS,
  buildAlert,
  findScheduledWorkflows,
  keepAlive,
} = require('../scripts/scheduled-workflows-keepalive.cjs');

const workflowsDir = resolve(__dirname, '..', '.github/workflows');
const workflow = readFileSync(resolve(workflowsDir, 'scheduled-workflows-keepalive.yml'), 'utf8');
const context = { serverUrl: 'https://github.com', repo: { owner: 'church', repo: 'app' }, actor: 'someone' };
const now = new Date('2027-03-20T12:00:00Z');

/** A fake GitHub client: each workflow's state, and main's last commit date. */
const fakeGithub = (states: Record<string, string | Error>, committed = '2027-03-10T12:00:00Z') => {
  const enabled: string[] = [];
  return {
    enabled,
    rest: {
      actions: {
        getWorkflow: async ({ workflow_id }: { workflow_id: string }) => {
          const state = states[workflow_id];
          if (state instanceof Error) throw state;
          return { data: { state } };
        },
        enableWorkflow: async ({ workflow_id }: { workflow_id: string }) => {
          enabled.push(workflow_id);
          return { status: 204 };
        },
      },
      repos: {
        get: async () => ({ data: { default_branch: 'main' } }),
        getBranch: async ({ branch }: { branch: string }) => {
          expect(branch).toBe('main');
          return { data: { commit: { commit: { committer: { date: committed } } } } };
        },
      },
    },
  };
};

const monitor = { file: 'apple-signing-monitor.yml', name: 'Apple Signing Monitor' };
const checkup = { file: 'yearly-checkup.yml', name: 'Yearly Checkup' };
const cache = { file: 'ios-compile-cache.yml', name: 'iOS compile cache' };

describe('finding the scheduled workflows', () => {
  it('finds every workflow with a schedule, this one included, and no other', () => {
    const found = findScheduledWorkflows(workflowsDir);
    const files = found.map((entry: { file: string }) => entry.file);
    for (const file of [
      'apple-signing-monitor.yml',
      'yearly-checkup.yml',
      'workspace-backup-reminder.yml',
      'due-date-reminders.yml',
      'scheduled-workflows-keepalive.yml',
    ]) {
      expect(files).toContain(file);
    }
    for (const file of ['ios-key-screens.yml', 'release-after-merge.yml', 'key-screens-recheck.yml']) {
      expect(files).not.toContain(file);
    }
    expect(found).toContainEqual({ file: 'scheduled-workflows-keepalive.yml', name: 'Scheduled Workflows Keepalive' });
  });
});

describe('keeping them on', () => {
  it('enables each one that is on again, and reports main\'s last commit', async () => {
    const github = fakeGithub({ [monitor.file]: 'active', [checkup.file]: 'active' });
    const result = await keepAlive({ github, context, workflows: [monitor, checkup], now });
    expect(github.enabled).toEqual([monitor.file, checkup.file]);
    expect(result).toMatchObject({ refreshed: [monitor, checkup], reenabled: [], leftOff: [], failed: [], daysSinceCommit: 10 });
    expect(buildAlert(result, 'RUN', 'RUNBOOK')).toBeNull();
  });

  it('turns back on one GitHub turned off for inactivity, and says so', async () => {
    const github = fakeGithub({ [monitor.file]: 'disabled_inactivity', [checkup.file]: 'active' });
    const result = await keepAlive({ github, context, workflows: [monitor, checkup], now });
    expect(github.enabled).toEqual([monitor.file, checkup.file]);
    expect(result.reenabled).toEqual([monitor]);
    const body = buildAlert(result, 'RUN', 'RUNBOOK');
    expect(body).toContain('GitHub had turned off **Apple Signing Monitor** (`apple-signing-monitor.yml`) for inactivity. This run turned them back on.');
    expect(body).toContain('Run: RUN');
    expect(body).toContain('What to do: RUNBOOK');
  });

  it('leaves off one a person turned off', async () => {
    const github = fakeGithub({ [monitor.file]: 'disabled_manually', [cache.file]: 'active' });
    const result = await keepAlive({ github, context, workflows: [monitor, cache], now });
    expect(github.enabled).toEqual([cache.file]);
    expect(result.leftOff).toEqual([{ ...monitor, state: 'disabled_manually' }]);
    expect(buildAlert(result, 'RUN', 'RUNBOOK')).toBeNull();
  });

  it('reports one it couldn\'t enable, and still enables the rest', async () => {
    const github = fakeGithub({ [monitor.file]: new Error('Resource not accessible by integration'), [checkup.file]: 'active' });
    const warnings: string[] = [];
    const result = await keepAlive({ github, context, core: { warning: (text: string) => warnings.push(text) }, workflows: [monitor, checkup], now });
    expect(github.enabled).toEqual([checkup.file]);
    expect(result.failed).toEqual([{ ...monitor, error: 'Resource not accessible by integration' }]);
    expect(warnings).toEqual(["Couldn't enable apple-signing-monitor.yml: Resource not accessible by integration"]);
    expect(buildAlert(result, 'RUN', 'RUNBOOK')).toContain("Couldn't enable **Apple Signing Monitor**");
  });

  it(`warns once main has had no commit for ${WARN_AFTER_DAYS} days, while there's time to merge one`, async () => {
    const quiet = await keepAlive({ github: fakeGithub({ [monitor.file]: 'active' }, '2027-02-03T12:00:00Z'), context, workflows: [monitor], now });
    expect(quiet.daysSinceCommit).toBe(45);
    expect(buildAlert(quiet, 'RUN', 'RUNBOOK')).toContain('`main` has had no commit for 45 days.');
    const recent = await keepAlive({ github: fakeGithub({ [monitor.file]: 'active' }, '2027-02-04T12:00:00Z'), context, workflows: [monitor], now });
    expect(recent.daysSinceCommit).toBe(44);
    expect(buildAlert(recent, 'RUN', 'RUNBOOK')).toBeNull();
  });
});

describe('the workflow', () => {
  it('runs twice a month, and by hand, only in the church repository', () => {
    expect(workflow).toContain('  schedule:\n');
    expect(workflow).toContain('- cron: "23 13 1,15 * *"');
    expect(workflow).toContain('  workflow_dispatch: {}');
    expect(workflow).toContain('if: github.event.repository.fork == false');
  });

  it('uses only the workflow token, to enable workflows and open the alert issue', () => {
    expect(workflow).not.toMatch(/secrets\./);
    const writes = workflow.split('\n').filter((line) => line.trim().endsWith(': write')).map((line) => line.trim());
    expect(writes).toEqual(['actions: write', 'issues: write']);
    expect(workflow).toContain('title: keepalive.ALERT_TITLE');
    expect(ALERT_TITLE).toContain('60 days');
  });

  it('is in the yearly checkup and the admin runbook', () => {
    const runbook = readFileSync(resolve(__dirname, '..', 'docs/operations/admin-runbook.md'), 'utf8');
    expect(runbook).toContain('## Keeping scheduled workflows on');
    expect(runbook).toContain('(`scheduled-workflows-keepalive.yml`)');
    expect(readFileSync(resolve(__dirname, '..', 'scripts/yearly-checkup.cjs'), 'utf8')).toContain('Scheduled Workflows Keepalive');
  });
});
