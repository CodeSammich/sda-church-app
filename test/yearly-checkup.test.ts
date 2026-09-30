import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const {
  CHECKLIST,
  buildYearlyCheckup,
  openYearlyCheckup,
  yearlyCheckupTitle,
} = require('../scripts/yearly-checkup.cjs');

const repoFile = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');

/** GitHub's anchor for a Markdown heading. */
const anchorOf = (heading: string) =>
  heading
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s/g, '-');

const anchorsIn = (path: string) =>
  repoFile(path)
    .split('\n')
    .filter((line) => /^#{1,6} /.test(line))
    .map((line) => anchorOf(line.replace(/^#+ /, '')));

const context = {
  serverUrl: 'https://github.com',
  repo: { owner: 'church', repo: 'app' },
  actor: 'someone',
};

/** A fake GitHub client with some existing issues. */
const fakeGithub = (issues: Array<{ number: number; title: string; pull_request?: object }>, { rejectAssignees = false } = {}) => {
  const created: Array<Record<string, unknown>> = [];
  return {
    created,
    paginate: async () => issues,
    rest: {
      issues: {
        listForRepo: jest.fn(),
        create: jest.fn(async (request: Record<string, unknown>) => {
          if (rejectAssignees && (request.assignees as string[] | undefined)?.length) {
            throw new Error('Validation Failed: assignee');
          }
          created.push(request);
          return { data: { number: 100 } };
        }),
      },
    },
  };
};

describe('yearly checkup checklist', () => {
  it('links every item to a real heading in the docs', () => {
    for (const [, items] of CHECKLIST) {
      for (const [, path, anchor] of items) {
        expect(anchorsIn(path)).toContain(anchor);
      }
    }
  });

  it('covers the Cloudflare card, billing, and free plan, and the other yearly tasks', () => {
    const { title, body } = buildYearlyCheckup(2027, 'https://github.com/church/app');
    expect(title).toBe('Yearly checkup, 2027');
    for (const text of [
      'card on file hasn\'t expired',
      'billing page lists only the domain',
      'nothing else in the account is on a paid plan',
      'The Free plan still covers DNS',
      'Bible Brain API key',
      'sda-church-app-play',
      'only one with a card',
      'two-factor login',
      'MONITOR_ALERT_ASSIGNEES',
      'apple-signing-expiry.json',
      'Google Play',
      'Apps Script',
      'scheduled workflows',
    ]) {
      expect(body).toContain(text);
    }
    expect(body).toContain('https://github.com/church/app/blob/main/docs/operations/admin-runbook.md#the-cloudflare-account-and-domain');
    // Nothing runs on Cloudflare but the domain, so the checklist doesn't ask about Workers.
    expect(body).not.toMatch(/Worker/);
    // Every item is a box to tick.
    expect(body.match(/^- \[ \] /gm)!.length).toBe(
      CHECKLIST.reduce((count: number, [, items]: [string, unknown[]]) => count + items.length, 0),
    );
  });

  it('lists every yearly row of the upkeep calendar', () => {
    const calendar = repoFile('docs/architecture.md');
    const rows = calendar.slice(calendar.indexOf('## Upkeep calendar')).split('\n## ')[0];
    expect(rows).toContain('(in the checkup)');
    expect(rows).toContain('[yearly checkup](operations/admin-runbook.md#yearly-checkup)');
  });
});

describe('opening the yearly checkup', () => {
  it('opens this year’s issue, assigned to the maintainers', async () => {
    const github = fakeGithub([{ number: 7, title: yearlyCheckupTitle(2026) }]);
    await expect(openYearlyCheckup({ github, context, year: 2027, assignees: ['maintainer'] })).resolves.toEqual({
      action: 'created',
      number: 100,
    });
    expect(github.created[0]).toMatchObject({ title: 'Yearly checkup, 2027', assignees: ['maintainer'] });
  });

  it('does nothing on the later Mondays, even after the issue is closed', async () => {
    const github = fakeGithub([{ number: 9, title: yearlyCheckupTitle(2027) }]);
    await expect(openYearlyCheckup({ github, context, year: 2027 })).resolves.toEqual({
      action: 'exists',
      number: 9,
    });
    expect(github.rest.issues.create).not.toHaveBeenCalled();
  });

  it('ignores a pull request with the same title', async () => {
    const github = fakeGithub([{ number: 3, title: yearlyCheckupTitle(2027), pull_request: {} }]);
    await expect(openYearlyCheckup({ github, context, year: 2027 })).resolves.toMatchObject({ action: 'created' });
  });

  it('mentions whoever ran it when there are no assignees, or GitHub rejects one', async () => {
    const unassigned = fakeGithub([]);
    await openYearlyCheckup({ github: unassigned, context, year: 2027 });
    expect(unassigned.created[0].body).toMatch(/^@someone\n/);

    const rejected = fakeGithub([], { rejectAssignees: true });
    await expect(
      openYearlyCheckup({ github: rejected, context, year: 2027, assignees: ['gone'] }),
    ).resolves.toMatchObject({ action: 'created without assignees' });
    expect(rejected.created[0].body).toMatch(/^@someone\n/);
  });
});

describe('Yearly Checkup workflow', () => {
  const workflow = repoFile('.github/workflows/yearly-checkup.yml');

  it('runs every Monday in January, New York time, and by hand', () => {
    expect(workflow).toContain('cron: "41 10 * 1 1"');
    expect(workflow).toContain('timezone: "America/New_York"');
    expect(workflow).toContain('workflow_dispatch: {}');
  });

  it('only opens an issue, in the church’s repository, with no secrets', () => {
    expect(workflow).toContain('github.event.repository.fork == false');
    expect(workflow).toMatch(/permissions:\n\s+contents: read\n\s+issues: write\n/);
    expect(workflow).not.toMatch(/secrets\.|pull_request/);
    expect(workflow).toContain('persist-credentials: false');
  });
});
