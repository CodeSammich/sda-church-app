/**
 * The yearly checkup issue (#342). Everything the docs say to check once a year,
 * in one checklist, opened on the first Monday of January by
 * .github/workflows/yearly-checkup.yml. The Apple renewals keep their own
 * reminder (Apple Signing Monitor), which opens 60 days before each date.
 *
 * When a doc gains a yearly task, add it here too; test/yearly-checkup.test.ts
 * checks that every link still points at a real heading.
 *
 * Called from actions/github-script, which passes its `github` and `context` in:
 *   const checkup = require(`${process.env.GITHUB_WORKSPACE}/scripts/yearly-checkup.cjs`);
 */

const yearlyCheckupTitle = (year) => `Yearly checkup, ${year}`;

/** Each item: [text, doc path, heading anchor]. Paths are from the repository root. */
const CHECKLIST = [
  [
    'Money',
    [
      [
        'Cloudflare: the card on file hasn\'t expired, auto-renew is on for `nyccsda.org`, and the domain\'s paid-through date is at least a year away.',
        'docs/operations/admin-runbook.md',
        'the-cloudflare-account-and-domain',
      ],
      [
        'Cloudflare: the billing page lists only the domain registration, and the bank\'s charge alerts show nothing else in the past year. Every Worker is still on Workers Free.',
        'docs/operations/admin-runbook.md',
        'why-a-free-worker-cant-bill',
      ],
      [
        'Cloudflare: re-read the Workers limits and pricing pages linked here. A Worker over the free limit must still fail with Error 1027, not bill.',
        'docs/operations/admin-runbook.md',
        'why-a-free-worker-cant-bill',
      ],
      [
        'Cloudflare: each Worker that holds an API key, starting with the Bible Brain Worker, is still needed and its key still works. Delete any Worker for a service the app no longer uses.',
        'docs/operations/admin-runbook.md',
        'workers-that-hold-api-keys',
      ],
      [
        'Google Cloud: the Play upload project (`sda-church-app-play`) still has no billing account.',
        'docs/operations/service-limits-and-costs.md',
        'google-cloud-play-upload-service-account',
      ],
      [
        'No other service has gained a payment method: Cloudflare is still the only one with a card.',
        'docs/architecture.md',
        'payment-methods',
      ],
    ],
  ],
  [
    'Accounts and access',
    [
      [
        'Every Cloudflare administrator logs in, which proves the backups work. Remove anyone who has left.',
        'docs/operations/admin-runbook.md',
        'the-cloudflare-account-and-domain',
      ],
      [
        'On every system, the administrators are current, each is a super administrator, and each uses two-factor login that isn\'t by text message, with their own backup codes.',
        'docs/architecture.md',
        'governance-principles',
      ],
      [
        '`technology@nyccsda.org` has the current administrators, and the `APPLE_SIGNING_ALERT_ASSIGNEES` and `MONITOR_ALERT_ASSIGNEES` Actions variables name current maintainers.',
        'docs/operations/admin-runbook.md',
        'getting-notified-only-when-action-is-needed',
      ],
    ],
  ],
  [
    'Stores',
    [
      [
        'Apple: the dates in `.github/apple-signing-expiry.json` match Apple\'s. The Apple Signing Monitor opens its own reminder 60 days before each one.',
        'docs/operations/app-store-setup.md',
        'yearly-apple-renewals',
      ],
      [
        'Google Play: the developer contact email and phone still work; the D-U-N-S record, payments profile, and website agree; and no policy or declaration prompt is waiting.',
        'docs/operations/app-store-setup.md',
        'yearly-google-play-upkeep',
      ],
    ],
  ],
  [
    'Services',
    [
      [
        'Google Workspace for Nonprofits still includes Apps Script at no charge, and the Apps Script quotas still fit the bulletin.',
        'docs/operations/bulletin-automation.md',
        'why-this-architecture',
      ],
      [
        'Re-read the service limits and costs, and update anything that changed.',
        'docs/operations/service-limits-and-costs.md',
        'summary',
      ],
      [
        'Re-read the architecture page, including the upkeep calendar, and update anything that changed.',
        'docs/architecture.md',
        'upkeep-calendar',
      ],
      [
        'The scheduled workflows are still enabled under Actions: External Dependency Monitor, Store Toolchain Monitor, Apple Signing Monitor, and Yearly Checkup. GitHub turns schedules off after 60 days without activity in the repository.',
        'docs/operations/external-dependency-monitor.md',
        'alerts-and-recovery',
      ],
    ],
  ],
];

/** The issue's title and body for a year; links go to the docs on `main`. */
const buildYearlyCheckup = (year, repoUrl) => {
  const link = (path, anchor) => `${repoUrl}/blob/main/${path}#${anchor}`;
  const sections = CHECKLIST.map(([heading, items]) => [
    `### ${heading}`,
    '',
    ...items.map(([text, path, anchor]) => `- [ ] ${text} ([how](${link(path, anchor)}))`),
    '',
  ]);
  return {
    title: yearlyCheckupTitle(year),
    body: [
      `Once a year, check everything the docs say to check yearly. Tick each box as you go, note anything that changed in a comment, and close this issue when every box is ticked.`,
      '',
      ...sections.flat(),
      'This issue opens on the first Monday of each January (`.github/workflows/yearly-checkup.yml`). To add a yearly task, add it to `scripts/yearly-checkup.cjs` and to the upkeep calendar.',
    ].join('\n'),
  };
};

/**
 * Opens the year's checkup issue unless it already exists, open or closed, so
 * the later Mondays in January do nothing. With no assignees, or when GitHub
 * rejects one, it @mentions the run's actor instead.
 */
const openYearlyCheckup = async ({ github, context, year, assignees = [] }) => {
  const repo = { owner: context.repo.owner, repo: context.repo.repo };
  const { title, body } = buildYearlyCheckup(
    year,
    `${context.serverUrl}/${context.repo.owner}/${context.repo.repo}`,
  );
  const issues = await github.paginate(github.rest.issues.listForRepo, {
    ...repo,
    state: 'all',
    per_page: 100,
  });
  const existing = issues.find((issue) => issue.title === title && !issue.pull_request);
  if (existing) return { action: 'exists', number: existing.number };

  const mention = `@${context.actor}\n\n${body}`;
  try {
    const created = await github.rest.issues.create({
      ...repo,
      title,
      body: assignees.length ? body : mention,
      assignees,
    });
    return { action: 'created', number: created.data.number };
  } catch (error) {
    if (!assignees.length) throw error;
    const created = await github.rest.issues.create({ ...repo, title, body: mention });
    return { action: 'created without assignees', number: created.data.number };
  }
};

module.exports = { CHECKLIST, buildYearlyCheckup, openYearlyCheckup, yearlyCheckupTitle };
