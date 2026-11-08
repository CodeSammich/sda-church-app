import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const triage = require('../scripts/needs-triage-label.cjs');

const context = { repo: { owner: 'org', repo: 'repo' } };

type Issue = { number: number; priority?: string; labels?: string[] };

const node = ({ number, priority, labels = [] }: Issue) => ({
  number,
  labels: { nodes: labels.map((name) => ({ name })) },
  issueFieldValues: {
    // Other fields, such as a date, come back as empty objects.
    nodes: [{}, ...(priority ? [{ name: priority, field: { name: 'Priority' } }] : [])],
  },
});

const httpError = (status: number) => Object.assign(new Error(`HTTP ${status}`), { status });

// A stand-in for actions/github-script's `github` and `core` that serves the
// given open issues, in pages of `pageSize`, and records every label change,
// including making the label itself.
const createGitHub = ({
  issues = [] as Issue[],
  pageSize = 100,
  canSeeFields = true,
  rejectGraphql = false,
  labelExists = true,
  labelMadeMeanwhile = false,
} = {}) => {
  const changes: [string, number?][] = [];
  const warnings: string[] = [];
  const access = {
    viewerCanSeeIssueFields: canSeeFields,
    issueFields: { nodes: canSeeFields ? [{ name: 'Priority' }, {}] : [] },
  };
  let exists = labelExists;
  const github = {
    graphql: async (_query: string, variables: Record<string, any>) => {
      if (rejectGraphql) {
        throw new Error('Resource not accessible by integration');
      }
      if ('number' in variables) {
        const issue = issues.find((candidate) => candidate.number === variables.number);
        return { repository: { ...access, issue: node(issue!) } };
      }
      const start = variables.after ? Number(variables.after) : 0;
      const page = issues.slice(start, start + pageSize);
      const end = start + page.length;
      return {
        repository: {
          ...access,
          issues: {
            pageInfo: { hasNextPage: end < issues.length, endCursor: String(end) },
            nodes: page.map(node),
          },
        },
      };
    },
    rest: {
      issues: {
        getLabel: async (args: Record<string, any>) => {
          expect(args).toEqual({ owner: 'org', repo: 'repo', name: 'needs triage' });
          if (!exists) throw httpError(404);
          return { data: { name: 'needs triage' } };
        },
        createLabel: async (args: Record<string, any>) => {
          expect(args).toEqual({
            owner: 'org',
            repo: 'repo',
            name: 'needs triage',
            color: 'B60205',
            description: 'Set a Priority (Urgent, High, Medium, Low) on desktop, then remove this label.',
          });
          if (labelMadeMeanwhile) {
            exists = true;
          }
          if (exists) throw httpError(422);
          exists = true;
          changes.push(['create']);
        },
        addLabels: async (args: Record<string, any>) => {
          expect(args).toEqual({ owner: 'org', repo: 'repo', issue_number: args.issue_number, labels: ['needs triage'] });
          // GitHub would make a missing label itself, grey and undescribed.
          if (!exists) throw new Error('added the label before making it');
          changes.push(['add', args.issue_number]);
        },
        removeLabel: async (args: Record<string, any>) => {
          expect(args).toEqual({ owner: 'org', repo: 'repo', issue_number: args.issue_number, name: 'needs triage' });
          changes.push(['remove', args.issue_number]);
        },
      },
    },
  };
  const core = { warning: (message: string) => warnings.push(message) };
  return { github, core, changes, warnings };
};

describe('needs triage label on a new issue', () => {
  it('labels an issue with no Priority', async () => {
    const { github, core, changes } = createGitHub({ issues: [{ number: 5 }] });

    await expect(triage.labelNewIssue({ github, context, core, number: 5 })).resolves.toEqual({
      action: 'labeled',
      number: 5,
    });
    expect(changes).toEqual([['add', 5]]);
  });

  it('leaves an issue alone that has a Priority, or the label already', async () => {
    const { github, core, changes } = createGitHub({
      issues: [{ number: 5, priority: 'High' }, { number: 6, labels: ['needs triage'] }],
    });

    await triage.labelNewIssue({ github, context, core, number: 5 });
    await triage.labelNewIssue({ github, context, core, number: 6 });

    expect(changes).toEqual([]);
  });

  it('takes the label off an issue that has a Priority, since it no longer needs triage', async () => {
    const { github, core, changes } = createGitHub({
      issues: [{ number: 7, priority: 'Medium', labels: ['needs triage', 'bug'] }],
    });

    await expect(triage.labelNewIssue({ github, context, core, number: 7 })).resolves.toEqual({
      action: 'unlabeled',
      number: 7,
    });
    expect(changes).toEqual([['remove', 7]]);
  });

  it("labels the issue anyway, with a warning, when GitHub won't show its fields", async () => {
    const refused = createGitHub({ issues: [{ number: 5, priority: 'High' }], rejectGraphql: true });
    await expect(
      triage.labelNewIssue({ github: refused.github, context, core: refused.core, number: 5 }),
    ).resolves.toEqual({ action: 'labeled-unchecked', number: 5 });
    expect(refused.changes).toEqual([['add', 5]]);
    expect(refused.warnings[0]).toContain("Could not read #5's Priority");

    const hidden = createGitHub({ issues: [{ number: 5 }], canSeeFields: false });
    await triage.labelNewIssue({ github: hidden.github, context, core: hidden.core, number: 5 });
    expect(hidden.changes).toEqual([['add', 5]]);
  });

  it('makes the missing label red, with its description, before adding it', async () => {
    const { github, core, changes } = createGitHub({ issues: [{ number: 5 }], labelExists: false });

    await triage.labelNewIssue({ github, context, core, number: 5 });

    expect(changes).toEqual([['create'], ['add', 5]]);
  });

  it('still labels the issue when another run made the label first', async () => {
    const { github, core, changes } = createGitHub({
      issues: [{ number: 5 }],
      labelExists: false,
      labelMadeMeanwhile: true,
    });

    await expect(triage.labelNewIssue({ github, context, core, number: 5 })).resolves.toEqual({
      action: 'labeled',
      number: 5,
    });
    expect(changes).toEqual([['add', 5]]);
  });
});

describe('needs triage daily sweep', () => {
  it('labels issues without a Priority and unlabels ones that have one, across pages', async () => {
    const { github, changes } = createGitHub({
      pageSize: 2,
      issues: [
        { number: 1 },
        { number: 2, priority: 'Urgent' },
        { number: 3, priority: 'Low', labels: ['needs triage'] },
        { number: 4, labels: ['needs triage', 'pending release'] },
        { number: 5 },
      ],
    });

    await expect(triage.sweep({ github, context })).resolves.toEqual({
      labeled: [1, 5],
      unlabeled: [3],
    });
    expect(changes).toEqual([['add', 1], ['remove', 3], ['add', 5]]);
  });

  it('makes the missing label once, red, before the first issue gets it', async () => {
    const { github, changes } = createGitHub({
      pageSize: 1,
      labelExists: false,
      issues: [{ number: 1, priority: 'High' }, { number: 2 }, { number: 3 }],
    });

    await triage.sweep({ github, context });

    expect(changes).toEqual([['create'], ['add', 2], ['add', 3]]);
  });

  it("changes nothing, and fails, when the token can't see the Priority field", async () => {
    const { github, changes } = createGitHub({ issues: [{ number: 1 }, { number: 2 }], canSeeFields: false });

    await expect(triage.sweep({ github, context })).rejects.toThrow("can't see the Priority issue field");
    expect(changes).toEqual([]);
  });
});

describe('needs triage workflow wiring', () => {
  const workflow = readFileSync(join(process.cwd(), '.github/workflows/needs-triage-label.yml'), 'utf8');

  it('runs on new and reopened issues, daily, and by hand, with only issue access', () => {
    expect(workflow).toMatch(/^name: Needs Triage Label$/m);
    expect(workflow).toContain('issues:\n    types: [opened, reopened]');
    expect(workflow).toMatch(/schedule:\n\s+# .*\n\s+- cron: "41 6 \* \* \*"/);
    expect(workflow).toContain('workflow_dispatch: {}');
    expect(workflow).toContain('permissions:\n  contents: read\n  issues: write\n');
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./);
    expect(workflow).not.toContain('pull_request');
  });

  it('labels a new issue on the issues event and sweeps otherwise, using the shared script', () => {
    expect(workflow).toContain('scripts/needs-triage-label.cjs');
    expect(workflow).toContain("context.eventName === 'issues'");
    expect(workflow).toContain('triage.labelNewIssue(');
    expect(workflow).toContain('triage.sweep(');
  });

  it('no longer adds the old "needs priority" label anywhere', () => {
    const script = readFileSync(join(process.cwd(), 'scripts/needs-triage-label.cjs'), 'utf8');
    expect(triage.LABEL).toBe('needs triage');
    for (const text of [workflow, script]) {
      expect(text).not.toMatch(/needs[ -]priority/i);
    }
  });
});
