import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Scheduled Workflows Watch (#658): GitHub turns off a public repository's
// scheduled workflows after 60 days without activity. This warns 15 days
// before, and when one is already off. It never enables one itself.
const {
  ALERT_TITLE,
  WARN_AFTER_DAYS,
  buildAlert,
  findScheduledWorkflows,
  watch,
} = require('../scripts/scheduled-workflows-watch.cjs');

const repoFile = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const workflowsDir = resolve(__dirname, '..', '.github/workflows');
const workflow = repoFile('.github/workflows/scheduled-workflows-watch.yml');
const context = { serverUrl: 'https://github.com', repo: { owner: 'church', repo: 'app' }, actor: 'someone' };
const now = new Date('2027-03-20T12:00:00Z');

/** A fake GitHub client: each workflow's state, and main's last commit date. */
const fakeGithub = (states: Record<string, string | Error>, committed = '2027-03-10T12:00:00Z') => ({
  rest: {
    actions: {
      getWorkflow: async ({ workflow_id }: { workflow_id: string }) => {
        const state = states[workflow_id];
        if (state instanceof Error) throw state;
        return { data: { state } };
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
});

const monitor = { file: 'apple-signing-monitor.yml', name: 'Apple Signing Monitor' };
const checkup = { file: 'yearly-checkup.yml', name: 'Yearly Checkup' };

describe('finding the scheduled workflows', () => {
  it('finds every workflow with a schedule, this one included, and no other', () => {
    const found = findScheduledWorkflows(workflowsDir);
    const files = found.map((entry: { file: string }) => entry.file);
    for (const file of [
      'apple-signing-monitor.yml',
      'yearly-checkup.yml',
      'workspace-backup-reminder.yml',
      'due-date-reminders.yml',
      'scheduled-workflows-watch.yml',
    ]) {
      expect(files).toContain(file);
    }
    for (const file of ['ios-key-screens.yml', 'release-after-merge.yml', 'key-screens-recheck.yml']) {
      expect(files).not.toContain(file);
    }
    expect(found).toContainEqual({ file: 'scheduled-workflows-watch.yml', name: 'Scheduled Workflows Watch' });
  });
});

describe('watching them', () => {
  it('says nothing while every one is on and main has a recent commit', async () => {
    const result = await watch({ github: fakeGithub({ [monitor.file]: 'active', [checkup.file]: 'active' }), context, workflows: [monitor, checkup], now });
    expect(result).toEqual({ turnedOff: [], unread: [], daysSinceCommit: 10 });
    expect(buildAlert(result, 'RUN', 'RUNBOOK')).toBeNull();
  });

  it(`warns once main has had no commit for ${WARN_AFTER_DAYS} days, 15 days before GitHub turns them off`, async () => {
    const quiet = await watch({ github: fakeGithub({ [monitor.file]: 'active' }, '2027-02-03T12:00:00Z'), context, workflows: [monitor], now });
    expect(quiet.daysSinceCommit).toBe(45);
    const body = buildAlert(quiet, 'RUN', 'RUNBOOK');
    expect(body).toContain('`main` has had no commit for 45 days. GitHub turns off scheduled workflows after 60 days without activity, 15 days from now.');
    expect(body).toContain('Merge any real commit into `main`');
    expect(body).toContain('Run: RUN');
    expect(body).toContain('More: RUNBOOK');
    const recent = await watch({ github: fakeGithub({ [monitor.file]: 'active' }, '2027-02-04T12:00:00Z'), context, workflows: [monitor], now });
    expect(recent.daysSinceCommit).toBe(44);
    expect(buildAlert(recent, 'RUN', 'RUNBOOK')).toBeNull();
  });

  it('says how to turn back on one GitHub turned off for inactivity, and leaves one a person turned off alone', async () => {
    const result = await watch({
      github: fakeGithub({ [monitor.file]: 'disabled_inactivity', [checkup.file]: 'disabled_manually' }),
      context,
      workflows: [monitor, checkup],
      now,
    });
    expect(result.turnedOff).toEqual([monitor]);
    const body = buildAlert(result, 'RUN', 'RUNBOOK');
    expect(body).toContain('GitHub has turned off **Apple Signing Monitor** (`apple-signing-monitor.yml`) for inactivity.');
    expect(body).toContain('select **Enable workflow**, or run `gh workflow enable <file>`');
    expect(body).toContain('A commit to `main` starts the 60 days again.');
    expect(body).not.toContain('yearly-checkup.yml');
  });

  it("reports a state it couldn't read, and still checks the rest", async () => {
    const warnings: string[] = [];
    const result = await watch({
      github: fakeGithub({ [monitor.file]: new Error('Not Found'), [checkup.file]: 'disabled_inactivity' }),
      context,
      core: { warning: (text: string) => warnings.push(text) },
      workflows: [monitor, checkup],
      now,
    });
    expect(result.unread).toEqual([monitor]);
    expect(result.turnedOff).toEqual([checkup]);
    expect(warnings).toEqual(["Couldn't read apple-signing-monitor.yml's state: Not Found"]);
  });

  it('never enables a workflow itself', () => {
    const script = repoFile('scripts/scheduled-workflows-watch.cjs');
    expect(script).not.toMatch(/enableWorkflow|\/enable\b/);
    expect(workflow).not.toMatch(/enableWorkflow|\/enable\b|gh workflow enable/);
  });
});

describe('the workflow', () => {
  it('runs twice a month, and by hand, only in the church repository', () => {
    expect(workflow).toContain('  schedule:\n');
    expect(workflow).toContain('- cron: "23 13 1,15 * *"');
    expect(workflow).toContain('  workflow_dispatch: {}');
    expect(workflow).toContain('if: github.event.repository.fork == false');
  });

  it('uses only the workflow token, reading workflows and writing only the alert issue', () => {
    expect(workflow).not.toMatch(/secrets\./);
    const writes = workflow.split('\n').filter((line) => line.trim().endsWith(': write')).map((line) => line.trim());
    expect(writes).toEqual(['issues: write']);
    expect(workflow).toContain('      actions: read\n');
    expect(workflow).toContain('title: watcher.ALERT_TITLE');
    expect(workflow).toContain("priority: 'High'");
    expect(workflow).toContain('assignees: alerts.parseAssignees(process.env.ALERT_ASSIGNEES)');
    expect(ALERT_TITLE).toContain('60 days');
  });

  it('is in the yearly checkup, the admin runbook, and the contributing guide', () => {
    const runbook = repoFile('docs/operations/admin-runbook.md');
    expect(runbook).toContain('## Keeping scheduled workflows on');
    expect(runbook).toContain('(`scheduled-workflows-watch.yml`)');
    expect(repoFile('scripts/yearly-checkup.cjs')).toContain('Scheduled Workflows Watch');
    expect(repoFile('docs/CONTRIBUTING.md').split('\n').join(' ')).toContain('**Scheduled Workflows Watch**');
  });
});
