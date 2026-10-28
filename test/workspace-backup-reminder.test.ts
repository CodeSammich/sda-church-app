import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const {
  RUNBOOK,
  STEPS,
  buildWorkspaceBackup,
  dueDateFor,
  monthInNewYork,
  openWorkspaceBackup,
  workspaceBackupTitle,
} = require('../scripts/workspace-backup-reminder.cjs');
const { parseDueDate } = require('../scripts/due-date-reminders.cjs');

const repoFile = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

/** GitHub's anchor for a Markdown heading. */
const anchorOf = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

const context = {
  serverUrl: 'https://github.com',
  repo: { owner: 'church', repo: 'app' },
  actor: 'someone',
};

describe('Google Workspace backup issue', () => {
  const { title, body } = buildWorkspaceBackup(2027, 1, 'https://github.com/church/app');

  it('links every step to a real heading in the runbook', () => {
    const anchors = repoFile(RUNBOOK)
      .split('\n')
      .filter((line) => /^#{1,6} /.test(line))
      .map((line) => anchorOf(line.replace(/^#+ /, '')));
    for (const [, anchor] of STEPS) {
      expect(anchors).toContain(anchor);
    }
    expect(body).toContain('https://github.com/church/app/blob/main/docs/operations/admin-runbook.md#starting-the-export');
  });

  it('names the month, and is due at the end of the next one, so the due-date reminders follow it up', () => {
    expect(title).toBe('Google Workspace backup, January 2027');
    expect(parseDueDate(body)).toBe('2027-02-28');
    expect(dueDateFor(2028, 1)).toBe('2028-02-29');
    expect(dueDateFor(2027, 4)).toBe('2027-05-31');
    expect(dueDateFor(2027, 10)).toBe('2027-11-30');
    // Run by hand in December, it's due at the end of January.
    expect(dueDateFor(2027, 12)).toBe('2028-01-31');
  });

  it('gives the export and download steps, and keeps the download free', () => {
    for (const text of [
      'Data import & export',
      'Export all user data for the entire organization',
      'super administrator',
      '60 days',
      'gcloud storage cp',
      'Status Report.html',
      'gcloud auth login',
      'never run `gcloud init` or set a project, and never add a billing project',
      'not the computer\'s system drive',
      'not a folder that syncs to a cloud account',
      'Errors',
      '_.gstmp',
    ]) {
      expect(body).toContain(text);
    }
    // The folder comes before the download into it.
    expect(body.indexOf('Make a folder')).toBeLessThan(body.indexOf('Download the export'));
    // Every step is a box to tick.
    expect(body.match(/^- \[ \] /gm)!.length).toBe(STEPS.length);
  });

  it('uses the month in New York, where the schedule runs', () => {
    // 10 p.m. on December 31 in New York is already January 1 in UTC.
    expect(monthInNewYork(new Date('2027-01-01T03:00:00Z'))).toEqual({ year: 2026, month: 12 });
    expect(monthInNewYork(new Date('2027-04-05T14:43:00Z'))).toEqual({ year: 2027, month: 4 });
  });

  it('opens once a month, assigned to the maintainers', async () => {
    const created: Array<Record<string, unknown>> = [];
    const priorities: string[] = [];
    const github = (issues: Array<{ number: number; title: string }>) => ({
      paginate: async () => issues,
      graphql: async (query: string, variables: Record<string, unknown>) => {
        if (query.startsWith('mutation')) {
          priorities.push(variables.optionId as string);
          return {};
        }
        return {
          repository: {
            issueFields: { nodes: [{ id: 'FIELD', name: 'Priority', options: [{ id: 'Urgent', name: 'Urgent' }] }] },
            issue: { id: 'ISSUE', issueFieldValues: { nodes: [] } },
          },
        };
      },
      rest: {
        issues: {
          listForRepo: jest.fn(),
          create: jest.fn(async (request: Record<string, unknown>) => {
            created.push(request);
            return { data: { number: 100 } };
          }),
        },
      },
    });

    await expect(
      openWorkspaceBackup({ github: github([]), context, year: 2027, month: 4, assignees: ['maintainer'] }),
    ).resolves.toEqual({ action: 'created', number: 100 });
    expect(created[0]).toMatchObject({
      title: 'Google Workspace backup, April 2027',
      labels: ['maintenance'],
      assignees: ['maintainer'],
    });
    expect(priorities).toEqual(['Urgent']);

    await expect(
      openWorkspaceBackup({
        github: github([{ number: 9, title: workspaceBackupTitle(2027, 4) }]),
        context,
        year: 2027,
        month: 4,
      }),
    ).resolves.toEqual({ action: 'exists', number: 9 });
    expect(created).toHaveLength(1);
  });
});

describe('Workspace Backup Reminder workflow', () => {
  const workflow = repoFile('.github/workflows/workspace-backup-reminder.yml');

  it('runs every Monday in January, April, July, and October, New York time, and by hand', () => {
    expect(workflow).toContain('cron: "43 10 * 1,4,7,10 1"');
    expect(workflow).toContain('timezone: "America/New_York"');
    expect(workflow).toContain('workflow_dispatch: {}');
  });

  it('only opens an issue, in the church’s repository, with no secrets', () => {
    expect(workflow).toContain('github.event.repository.fork == false');
    expect(workflow).toMatch(/permissions:\n\s+contents: read\n\s+issues: write\n/);
    expect(workflow).not.toMatch(/secrets\.|pull_request/);
    expect(workflow).toContain('persist-credentials: false');
    expect(workflow).toContain('ALERT_ASSIGNEES: ${{ vars.MONITOR_ALERT_ASSIGNEES }}');
  });
});
