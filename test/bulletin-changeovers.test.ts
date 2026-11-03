import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The External Dependency Monitor opens a cleanup issue, once, for each
// bulletin API changeover that no older app has needed for 14 days (#580).

const changeovers = require('../scripts/bulletin-changeovers.cjs');

const context = {
  serverUrl: 'https://github.com',
  repo: { owner: 'org', repo: 'repo' },
  runId: 42,
  actor: 'workflow-actor',
};

const READY = {
  id: 'schedule-not-set',
  retiresWith: '1.6.0',
  cleanup: 'Remove the version gate.',
  watchedSince: '2026-11-03',
  olderAppLastCalled: '2026-11-20',
  quietDays: 14,
  ready: true,
};

const WAITING = { ...READY, id: 'other', olderAppLastCalled: '2026-12-01', ready: false };

// A stand-in for actions/github-script's objects, recording the issues made.
const createGitHub = (issues: { number: number; title: string }[] = []) => {
  const created: Record<string, any>[] = [];
  const github = {
    paginate: async () => issues,
    rest: {
      issues: {
        listForRepo: () => undefined,
        create: async (args: Record<string, any>) => {
          created.push(args);
          return { data: { number: 700 + created.length } };
        },
      },
    },
    // No Priority field, so setPriority only warns.
    graphql: async () => ({ repository: { issueFields: { nodes: [] }, issue: { id: 'I', issueFieldValues: { nodes: [] } } } }),
  };
  const core = { info: jest.fn(), warning: jest.fn() };
  return { github, core, created };
};

const answer = (payload: unknown, status = 200) =>
  jest.fn(async () => ({ ok: status === 200, status, json: async () => payload }));

describe('bulletin changeover cleanup issues', () => {
  it('opens a cleanup issue for each changeover the API says is ready, and only those', async () => {
    const { github, core, created } = createGitHub();
    const fetchImpl = answer({ ok: true, changeovers: [READY, WAITING] });

    const results = await changeovers.openCleanupIssues({ github, context, core, fetchImpl, url: 'https://api.test/exec' });

    expect(fetchImpl).toHaveBeenCalledWith('https://api.test/exec?changeovers=1', expect.anything());
    expect(results).toEqual([{ id: 'schedule-not-set', action: 'created', number: 701 }]);
    expect(created).toHaveLength(1);
    expect(created[0].title).toBe("[changeover] Retire the bulletin API's schedule-not-set changeover");
    expect(created[0].body).toContain('No app older than 1.6.0');
    expect(created[0].body).toContain('since 2026-11-20');
    expect(created[0].body).toContain('Remove the version gate.');
    expect(created[0].labels).toContain('maintenance');
  });

  it("doesn't open a changeover's issue again, even once it's closed", async () => {
    const { github, core, created } = createGitHub([
      { number: 650, title: "[changeover] Retire the bulletin API's schedule-not-set changeover" },
    ]);

    const results = await changeovers.openCleanupIssues({
      github,
      context,
      core,
      fetchImpl: answer({ ok: true, changeovers: [READY] }),
    });

    expect(results).toEqual([{ id: 'schedule-not-set', action: 'exists', number: 650 }]);
    expect(created).toEqual([]);
  });

  it.each([
    ['a script that predates changeovers', answer({ ok: false, error: 'A valid date query parameter is required (YYYY-MM-DD)' })],
    ['an API that is down', answer({}, 500)],
    ['an answer without a list', answer({ ok: true, bulletin: {} })],
  ])('only warns when it reads %s', async (_, fetchImpl) => {
    const { github, core, created } = createGitHub();

    expect(await changeovers.openCleanupIssues({ github, context, core, fetchImpl })).toEqual([]);

    expect(created).toEqual([]);
    expect(core.warning).toHaveBeenCalledWith(expect.stringContaining("Could not read the bulletin API's changeovers"));
  });

  it('says when nothing is ready', async () => {
    const { github, core, created } = createGitHub();

    await changeovers.openCleanupIssues({ github, context, core, fetchImpl: answer({ ok: true, changeovers: [WAITING] }) });

    expect(created).toEqual([]);
    expect(core.info).toHaveBeenCalledWith('No changeover is ready to retire (1 watched).');
  });

  it('reads the same API the app does', () => {
    const links = readFileSync(join(process.cwd(), 'constants', 'ExternalLinks.ts'), 'utf8');

    expect(links).toContain(changeovers.BULLETIN_API_URL);
  });

  it('runs daily from the External Dependency Monitor, without failing it', () => {
    const workflow = readFileSync(
      join(process.cwd(), '.github', 'workflows', 'external-dependency-monitor.yml'),
      'utf8',
    );
    const step = workflow.slice(workflow.indexOf('- name: Open cleanup issues for retired bulletin changeovers'));

    expect(step).toMatch(/^\s+if: always\(\)$/m);
    expect(step).toMatch(/^\s+continue-on-error: true$/m);
    expect(step).toContain('scripts/bulletin-changeovers.cjs');
    expect(step).toContain('changeovers.parseAssignees(process.env.ALERT_ASSIGNEES)');
  });
});
