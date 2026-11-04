import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Maintenance Release Reminder (#658): GitHub turns off a public repository's
// scheduled workflows after 60 days without a commit to main. From 45 days,
// this opens a maintenance release's version pull request into
// release-candidate. It never enables a workflow itself.
const reminder = require('../scripts/maintenance-release-reminder.cjs');
const alerts = require('../scripts/monitor-alert-issue.cjs');
const { syncVersion } = require('../public/sync-version.js');

const repoFile = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const workflowsDir = resolve(__dirname, '..', '.github/workflows');
const workflow = repoFile('.github/workflows/maintenance-release-reminder.yml');
const context = { serverUrl: 'https://github.com', repo: { owner: 'church', repo: 'app' }, actor: 'someone', runId: 9 };
const docs = { dependabot: 'DEPENDABOT', release: 'RELEASE', runbook: 'RUNBOOK', tokenEvents: 'TOKEN' };
const notFound = () => Object.assign(new Error('Not Found'), { status: 404 });

// release-candidate's version files, as the API returns them.
const rcFiles = (version: string) => ({
  'package.json': `${JSON.stringify({ name: 'app', version }, null, 2)}\n`,
  'package-lock.json': `${JSON.stringify({ name: 'app', version, packages: { '': { version } } }, null, 2)}\n`,
  'app.json': `${JSON.stringify({ expo: { version } }, null, 2)}\n`,
  'public/sw.js': `const VERSION = '${version}';\n`,
});

type Pull = { number: number; user: { login: string }; head: { ref: string; repo: { full_name: string } } };

/** A fake GitHub client that records every write. */
const fakeGithub = ({
  rcVersion = '1.6.3' as string | null,
  pulls = [] as Pull[],
  issues = [] as { number: number; title: string; body?: string }[],
  existingBranches = [] as string[],
} = {}) => {
  const writes: Array<[string, Record<string, any>]> = [];
  const files = rcVersion ? rcFiles(rcVersion) : {};
  const github = {
    writes,
    paginate: async (method: unknown) => (method === github.rest.pulls.list ? pulls : issues),
    graphql: async () => ({ repository: { issueFields: { nodes: [] }, issue: { id: 'I', issueFieldValues: { nodes: [] } } } }),
    rest: {
      actions: { getWorkflow: async () => ({ data: { state: 'active' } }) },
      repos: {
        getContent: async ({ path, ref }: { path: string; ref: string }) => {
          expect(ref).toBe('RC-SHA');
          const text = (files as Record<string, string>)[path];
          if (text === undefined) throw notFound();
          return { data: text };
        },
      },
      git: {
        getRef: async ({ ref }: { ref: string }) => {
          if (ref === 'heads/release-candidate' && rcVersion) return { data: { object: { sha: 'RC-SHA' } } };
          if (existingBranches.includes(ref.slice('heads/'.length))) return { data: { object: { sha: 'X' } } };
          throw notFound();
        },
        getCommit: async () => ({ data: { tree: { sha: 'RC-TREE' } } }),
        createBlob: async (args: Record<string, any>) => {
          writes.push(['createBlob', args]);
          return { data: { sha: `BLOB-${writes.length}` } };
        },
        createTree: async (args: Record<string, any>) => {
          writes.push(['createTree', args]);
          return { data: { sha: 'TREE' } };
        },
        createCommit: async (args: Record<string, any>) => {
          writes.push(['createCommit', args]);
          return { data: { sha: 'COMMIT' } };
        },
        createRef: async (args: Record<string, any>) => {
          writes.push(['createRef', args]);
          return { data: {} };
        },
        deleteRef: async (args: Record<string, any>) => {
          writes.push(['deleteRef', args]);
          return { data: {} };
        },
      },
      pulls: {
        list: () => undefined,
        create: async (args: Record<string, any>) => {
          writes.push(['createPull', args]);
          return { data: { number: 700 } };
        },
        update: async (args: Record<string, any>) => {
          writes.push(['updatePull', args]);
          return { data: {} };
        },
      },
      issues: {
        listForRepo: () => undefined,
        create: async (args: Record<string, any>) => {
          writes.push(['createIssue', args]);
          return { data: { number: 800 } };
        },
        createComment: async (args: Record<string, any>) => {
          writes.push(['comment', args]);
        },
        addLabels: async () => undefined,
        update: async (args: Record<string, any>) => {
          writes.push(['updateIssue', args]);
        },
      },
    },
  };
  return github;
};

const run = (github: ReturnType<typeof fakeGithub>, days: number | null, { mainVersion = '1.6.3', turnedOff = [] as object[] } = {}) =>
  reminder.remind({
    github,
    context,
    core: { warning: () => undefined },
    alerts,
    syncVersion,
    result: { turnedOff, unread: [], daysSinceCommit: days },
    mainVersion,
    assignees: ['maintainer'],
    runUrl: 'RUN',
    docs,
  });
const named = (github: ReturnType<typeof fakeGithub>, name: string) => github.writes.filter(([kind]) => kind === name).map(([, args]) => args);
const ownPull = (version: string, number = 700): Pull => ({
  number,
  user: { login: 'github-actions[bot]' },
  head: { ref: `maintenance/version-${version}`, repo: { full_name: 'church/app' } },
});

describe('the version pull request', () => {
  it('opens nothing before 45 days after main\'s last commit', async () => {
    const github = fakeGithub();
    await expect(run(github, 44)).resolves.toMatchObject({ pull: 'not due' });
    expect(github.writes).toEqual([]);
  });

  it('opens the tracking issue at 45 days, and links the version pull request to it both ways', async () => {
    const github = fakeGithub();
    await expect(run(github, 45)).resolves.toMatchObject({ issue: 'opened #800', pull: 'opened #700' });
    const [issue] = named(github, 'createIssue');
    expect(issue).toMatchObject({ title: reminder.RELEASE_TITLE, assignees: ['maintainer'], labels: ['maintenance'] });
    expect(issue.body).toContain('Merge the version pull request, **Set the version to 1.6.4**');
    expect(issue.body).toContain('`Release/1.6.4: …`');
    expect(issue.body).toContain('reject them unless it should');
    expect(named(github, 'createPull')[0].body.split('\n')).toContain('Part of #800');
    expect(named(github, 'comment')).toEqual([
      expect.objectContaining({ issue_number: 800, body: 'Opened the version pull request, #700: **Set the version to 1.6.4**.' }),
    ]);
  });

  it('opens it at 45 days: the next patch version, from release-candidate, on its own new branch', async () => {
    const github = fakeGithub();
    await expect(run(github, 45)).resolves.toMatchObject({ pull: 'opened #700' });
    // Only the four version files change, each to 1.6.4.
    const blobs = named(github, 'createBlob').map((args) => args.content);
    expect(blobs).toHaveLength(4);
    for (const blob of blobs) {
      expect(blob).toContain('1.6.4');
      expect(blob).not.toContain('1.6.3');
    }
    expect(named(github, 'createTree')[0]).toMatchObject({ base_tree: 'RC-TREE' });
    expect(named(github, 'createTree')[0].tree.map((entry: { path: string }) => entry.path)).toEqual(reminder.VERSION_FILES);
    expect(named(github, 'createCommit')[0]).toMatchObject({ parents: ['RC-SHA'], message: expect.stringMatching(/^Set the version to 1\.6\.4\n/) });
    expect(named(github, 'createRef')).toEqual([{ owner: 'church', repo: 'app', ref: 'refs/heads/maintenance/version-1.6.4', sha: 'COMMIT' }]);
    const [pull] = named(github, 'createPull');
    expect(pull).toMatchObject({ title: 'Set the version to 1.6.4', head: 'maintenance/version-1.6.4', base: 'release-candidate' });
    expect(pull.body).toContain('**A release to `main` is due in 15 days.**');
    expect(pull.body).toContain('GitHub turns this repository\'s scheduled workflows off after 60 days without a commit to `main`');
    // Its required checks wait for a person: approve or reopen, or an admin's bypass.
    expect(pull.body).toContain('a required check that never reports blocks the merge');
    expect(pull.body).toContain('select "Approve workflows to run" in the merge box');
    expect(pull.body).toContain('close this pull request and reopen it once');
    expect(pull.body).toContain('"Merge without waiting for requirements to be met (bypass rules)"');
    expect(pull.body).toContain('It changes only the four version files');
    expect(pull.body).toContain('Merge or close the open Dependabot pull requests');
    expect(pull.body).toContain('`npm audit`');
    expect(pull.body).toContain('`npx expo install --check`');
    expect(pull.body).toContain('`Release/1.6.4: …`');
    expect(pull.body).toContain('reject them unless it should');
    expect(pull.body.split('\n')).toContain('Related to #658');
  });

  it('updates the count in its own open pull request, and never opens a second, or a second issue', async () => {
    const github = fakeGithub({ pulls: [ownPull('1.6.4')], issues: [{ number: 800, title: reminder.RELEASE_TITLE }] });
    await expect(run(github, 52)).resolves.toMatchObject({ issue: 'kept #800', pull: 'updated #700' });
    expect(named(github, 'createPull')).toEqual([]);
    expect(named(github, 'createIssue')).toEqual([]);
    expect(named(github, 'comment')).toEqual([]);
    expect(named(github, 'updatePull')[0].body.split('\n')).toContain('Part of #800');
    expect(named(github, 'createRef')).toEqual([]);
    const [update] = named(github, 'updatePull');
    expect(update).toMatchObject({ pull_number: 700 });
    expect(update.body).toContain('**A release to `main` is due in 8 days.**');
    expect(update.state).toBeUndefined();
  });

  it('ignores a person\'s pull request on a branch named like its own', async () => {
    const human = { ...ownPull('1.6.4', 701), user: { login: 'someone' } };
    const github = fakeGithub({ pulls: [human], existingBranches: ['maintenance/version-1.6.4'] });
    await run(github, 50);
    expect(named(github, 'updatePull')).toEqual([]);
    // Its branch exists, so nothing is pushed to it.
    expect(named(github, 'createRef')).toEqual([]);
    expect(named(github, 'createPull')).toEqual([]);
  });

  it('closes its pull request and deletes its branch once a release moves the version on', async () => {
    const github = fakeGithub({ rcVersion: '1.6.4', pulls: [ownPull('1.6.4')] });
    await expect(run(github, 0, { mainVersion: '1.6.4' })).resolves.toMatchObject({ pull: 'closed #700' });
    expect(named(github, 'updatePull')).toEqual([{ owner: 'church', repo: 'app', pull_number: 700, state: 'closed' }]);
    expect(named(github, 'deleteRef')).toEqual([{ owner: 'church', repo: 'app', ref: 'heads/maintenance/version-1.6.4' }]);
  });

  it('opens only the issue when release-candidate\'s version is already raised', async () => {
    const github = fakeGithub({ rcVersion: '1.6.4' });
    await expect(run(github, 46)).resolves.toMatchObject({ issue: 'opened #800', pull: 'version already raised' });
    expect(named(github, 'createRef')).toEqual([]);
    expect(named(github, 'createPull')).toEqual([]);
    const [issue] = named(github, 'createIssue');
    expect(issue.title).toBe(reminder.RELEASE_TITLE);
    expect(issue.body).toContain('- [x] The version: `release-candidate` already has 1.6.4.');
    expect(issue.body).toContain('`Release/1.6.4: …`');
  });

  it('closes the issue on the first run after a new commit on main', async () => {
    const github = fakeGithub({ rcVersion: '1.6.4', issues: [{ number: 800, title: reminder.RELEASE_TITLE }] });
    await expect(run(github, 1, { mainVersion: '1.6.4' })).resolves.toMatchObject({ issue: 'closed' });
    expect(named(github, 'updateIssue')).toEqual([expect.objectContaining({ issue_number: 800, state: 'closed' })]);
  });

  it('does nothing to the version without release-candidate', async () => {
    const github = fakeGithub({ rcVersion: null });
    await run(github, 50);
    expect(named(github, 'createRef')).toEqual([]);
    expect(named(github, 'createPull')).toEqual([]);
  });
});

describe('scheduled workflows turned off', () => {
  it('finds every workflow with a schedule, this one included, and no other', () => {
    const files = reminder.findScheduledWorkflows(workflowsDir).map((entry: { file: string }) => entry.file);
    for (const file of ['apple-signing-monitor.yml', 'yearly-checkup.yml', 'workspace-backup-reminder.yml', 'due-date-reminders.yml', 'maintenance-release-reminder.yml']) {
      expect(files).toContain(file);
    }
    for (const file of ['ios-key-screens.yml', 'release-after-merge.yml', 'key-screens-recheck.yml']) {
      expect(files).not.toContain(file);
    }
  });

  it('says how to turn one back on by hand, at High priority, and never enables it', async () => {
    const github = fakeGithub();
    await run(github, 10, { turnedOff: [{ file: 'apple-signing-monitor.yml', name: 'Apple Signing Monitor' }] });
    const [issue] = named(github, 'createIssue');
    expect(issue.title).toBe(reminder.TURNED_OFF_TITLE);
    expect(issue.body).toContain('GitHub has turned off **Apple Signing Monitor** (`apple-signing-monitor.yml`) for inactivity.');
    expect(issue.body).toContain('select **Enable workflow**, or run `gh workflow enable <file>`');
    for (const file of ['scripts/maintenance-release-reminder.cjs', '.github/workflows/maintenance-release-reminder.yml']) {
      expect(repoFile(file)).not.toMatch(/enableWorkflow|\/enable\b/);
    }
  });

  it('reads each state and main\'s last commit, changing nothing', async () => {
    const github = {
      rest: {
        actions: {
          getWorkflow: async ({ workflow_id }: { workflow_id: string }) => ({ data: { state: workflow_id === 'a.yml' ? 'disabled_inactivity' : 'disabled_manually' } }),
        },
        repos: {
          get: async () => ({ data: { default_branch: 'main' } }),
          getBranch: async () => ({ data: { commit: { commit: { committer: { date: '2027-02-03T12:00:00Z' } } } } }),
        },
      },
    };
    const result = await reminder.check({
      github,
      context,
      workflows: [{ file: 'a.yml', name: 'A' }, { file: 'b.yml', name: 'B' }],
      now: new Date('2027-03-20T12:00:00Z'),
    });
    // One a person turned off isn't reported.
    expect(result).toEqual({ turnedOff: [{ file: 'a.yml', name: 'A' }], unread: [], daysSinceCommit: 45, lastCommit: '2027-02-03T12:00:00.000Z' });
  });
});

describe('the workflow', () => {
  it('runs every Monday, and by hand, only in the church repository', () => {
    expect(workflow).toContain('  schedule:\n');
    expect(workflow).toContain('- cron: "23 13 * * 1"');
    expect(workflow).toContain('  workflow_dispatch: {}');
    expect(workflow).toContain('if: github.event.repository.fork == false');
  });

  it('uses only the workflow token, with no credentials on disk, and runs only main\'s code', () => {
    expect(workflow).not.toMatch(/secrets\./);
    const permissions = workflow.split('\n').filter((line) => /^ {6}[a-z-]+: (read|write)$/.test(line)).map((line) => line.trim());
    expect(permissions).toEqual(['actions: read', 'contents: write', 'pull-requests: write', 'issues: write']);
    expect(workflow).toContain('persist-credentials: false');
    // One checkout, of the default branch: release-candidate's files are only read through the API.
    expect(workflow.match(/actions\/checkout@/g)).toHaveLength(1);
    expect(workflow).not.toMatch(/\bref:|git push|\bnpm |\bnpx /);
  });

  it('is in the yearly checkup, the admin runbook, and the contributing guide', () => {
    const runbook = repoFile('docs/operations/admin-runbook.md');
    expect(runbook).toContain('## Maintenance releases');
    expect(runbook).toContain('(`maintenance-release-reminder.yml`)');
    expect(runbook).toContain('**Allow GitHub\nActions to create and approve pull requests**');
    expect(repoFile('scripts/yearly-checkup.cjs')).toContain('Maintenance Release Reminder');
    expect(repoFile('docs/CONTRIBUTING.md').split('\n').join(' ')).toContain('**Maintenance Release Reminder**');
  });
});
