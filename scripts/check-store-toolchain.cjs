/**
 * Compares the app's Android target API and the iOS build's Xcode version with
 * the current Google Play and App Store Connect requirements, read from the
 * official requirement pages. Run weekly by the Store Toolchain Monitor
 * workflow; exits non-zero when action is needed or a page can't be read, so
 * a wording change on either page is reported instead of silently passing.
 *
 * Usage: node scripts/check-store-toolchain.cjs [--report <path>]
 */
const fs = require('node:fs');
const path = require('node:path');

const SOURCES = Object.freeze({
  // hl=en: without it, developer.android.com sometimes serves another
  // language (Indonesian was seen), which the English patterns can't read.
  androidTargetApi: 'https://developer.android.com/google/play/requirements/target-sdk?hl=en',
  appleUpcoming: 'https://developer.apple.com/news/upcoming-requirements/',
  appleSubmitting: 'https://developer.apple.com/app-store/submitting/',
});

const ALERT_TITLE = '[monitor] Store toolchain requirements need attention';
// Applied only when the app misses a store requirement, not when a page just
// can't be read, so the label keeps meaning "uploads will be rejected".
const CRITICAL_LABEL = 'critical / launch blocking';

// Requirements taking effect within this many days count as needing action
// now, so there is time to update and test before the store deadline.
const LEAD_DAYS = 120;

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const DATE_PATTERN = '([A-Z][a-z]+ \\d{1,2},? \\d{4})';

const htmlToText = (html) =>
  String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&rsquo;/g, "'")
    // Decode &amp; last, so "&amp;#39;" stays "&#39;" instead of being
    // decoded twice into "'".
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

const parseRequirementDate = (text) => {
  const match = /^([A-Za-z]+) (\d{1,2}),? (\d{4})$/.exec(String(text).trim());
  const month = match ? MONTHS.indexOf(match[1].toLowerCase()) : -1;
  if (month === -1) {
    return null;
  }
  return new Date(Date.UTC(Number(match[3]), month, Number(match[2])));
};

/**
 * Reads phone/tablet target API requirements such as "Starting August 31 2026:
 * New apps and app updates must target Android 16 (API level 36) or higher".
 * Wear OS, TV, and Automotive exceptions later in the sentence are ignored.
 */
const parseAndroidTargetRequirements = (text) => {
  const pattern = new RegExp(
    `(?:Starting|Beginning|Since|As of|From) ${DATE_PATTERN}:? New apps and app updates must target Android [\\d.]+ \\(API level (\\d+)\\)`,
    'g',
  );
  return [...text.matchAll(pattern)]
    .map((match) => ({ effective: parseRequirementDate(match[1]), apiLevel: Number(match[2]) }))
    .filter((requirement) => requirement.effective);
};

/**
 * Reads App Store Connect build requirements such as "Since April 28, 2026
 * Apps uploaded to App Store Connect must be built with Xcode 26 or later
 * using an SDK for iOS 26".
 */
const parseAppleXcodeRequirements = (text) => {
  const pattern = new RegExp(
    `(?:Starting|Beginning|Since|As of) ${DATE_PATTERN}[:,]? Apps uploaded to App Store Connect must be built with Xcode (\\d+)(?:\\.\\d+)? or later using (?:an? |the )?SDK for iOS (\\d+)`,
    'gi',
  );
  return [...text.matchAll(pattern)]
    .map((match) => ({
      effective: parseRequirementDate(match[1]),
      xcodeMajor: Number(match[2]),
      iosSdk: Number(match[3]),
    }))
    .filter((requirement) => requirement.effective);
};

// Apple's submission page names the newest Xcode as a recommendation, for
// example "Build and test with Xcode 27". Informational only.
const parseAppleLatestXcode = (text) => {
  const match = /Build and test with Xcode (\d+(?:\.\d+)?)/i.exec(text);
  return match ? match[1] : null;
};

const readAppToolchain = (root = path.resolve(__dirname, '..')) => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'));
  const buildProperties = (appJson.expo.plugins || []).find(
    (plugin) => Array.isArray(plugin) && plugin[0] === 'expo-build-properties',
  );
  const android = buildProperties ? buildProperties[1].android || {} : {};
  const iosWorkflow = fs.readFileSync(
    path.join(root, '.github/workflows/native-ios-build.yml'),
    'utf8',
  );
  const xcode = /Xcode_(\d+(?:\.\d+)*)\.app/.exec(iosWorkflow);
  return {
    androidTargetApi: Number(android.targetSdkVersion) || null,
    androidCompileApi: Number(android.compileSdkVersion) || null,
    xcodeVersion: xcode ? xcode[1] : null,
  };
};

const formatDate = (date) => date.toISOString().slice(0, 10);

/**
 * Splits parsed requirements into the one in force today and the next one
 * starting within LEAD_DAYS, and checks the app against both. A failed check
 * has kind 'requirement' when the app falls short, which the workflow labels
 * critical, or 'unreadable' when the page could not be parsed.
 */
const getDaysUntil = (date, today) => Math.ceil((date - today) / 86400000);

const evaluateRequirement = ({ requirements, today, meets, describe, name, store, fix, source }) => {
  if (!requirements.length) {
    return {
      name,
      status: 'failed',
      kind: 'unreadable',
      detail: `Could not read the requirement from ${source}. The page wording may have changed; check it by hand and update scripts/check-store-toolchain.cjs.`,
    };
  }
  const leadEnd = new Date(today.getTime() + LEAD_DAYS * 86400000);
  const inForce = requirements
    .filter((requirement) => requirement.effective <= today)
    .sort((a, b) => b.effective - a.effective)[0];
  const upcoming = requirements
    .filter((requirement) => requirement.effective > today && requirement.effective <= leadEnd)
    .sort((a, b) => a.effective - b.effective)[0];

  if (inForce && !meets(inForce)) {
    return {
      name,
      status: 'failed',
      kind: 'requirement',
      store,
      fix,
      deadline: formatDate(inForce.effective),
      daysLeft: getDaysUntil(inForce.effective, today),
      detail: `Below the requirement in force since ${formatDate(inForce.effective)}: ${describe(inForce)}. Store uploads will be rejected.`,
    };
  }
  if (upcoming && !meets(upcoming)) {
    return {
      name,
      status: 'failed',
      kind: 'requirement',
      store,
      fix,
      deadline: formatDate(upcoming.effective),
      daysLeft: getDaysUntil(upcoming.effective, today),
      detail: `A new requirement starts ${formatDate(upcoming.effective)}: ${describe(upcoming)}. Update before then.`,
    };
  }
  return {
    name,
    status: 'passed',
    detail: inForce
      ? `Meets the requirement in force since ${formatDate(inForce.effective)}: ${describe(inForce)}.`
      : 'No requirement is in force yet.',
  };
};

const evaluateStoreToolchain = ({ app, androidRequirements, appleRequirements, latestXcode, today }) => {
  const xcodeMajor = app.xcodeVersion ? Number(app.xcodeVersion.split('.')[0]) : 0;
  const checks = [
    evaluateRequirement({
      name: `Google Play target API (app targets ${app.androidTargetApi})`,
      store: 'Google Play',
      fix: 'the Android target API is raised',
      source: SOURCES.androidTargetApi,
      requirements: androidRequirements,
      today,
      meets: (requirement) => app.androidTargetApi >= requirement.apiLevel,
      describe: (requirement) => `target API level ${requirement.apiLevel} or higher`,
    }),
    evaluateRequirement({
      name: `App Store Xcode (iOS build uses Xcode ${app.xcodeVersion})`,
      store: 'App Store Connect',
      fix: 'the iOS build moves to the required Xcode',
      source: SOURCES.appleUpcoming,
      requirements: appleRequirements,
      today,
      meets: (requirement) => xcodeMajor >= requirement.xcodeMajor,
      describe: (requirement) =>
        `Xcode ${requirement.xcodeMajor} or later with the iOS ${requirement.iosSdk} SDK`,
    }),
  ];
  const notes = [];
  if (latestXcode && Number(latestXcode.split('.')[0]) > xcodeMajor) {
    notes.push(
      `Apple recommends building with Xcode ${latestXcode}; the iOS build uses Xcode ${app.xcodeVersion}. Not required yet.`,
    );
  }
  if (app.androidCompileApi && app.androidCompileApi < app.androidTargetApi) {
    notes.push(
      `Android compile API ${app.androidCompileApi} is below the target API ${app.androidTargetApi}.`,
    );
  }
  return { checks, notes };
};

const fetchText = async (url) => {
  const response = await fetch(url, {
    headers: {
      'Accept-Language': 'en-US,en;q=0.9',
      'User-Agent': 'sda-church-app store toolchain monitor',
    },
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`${url} returned HTTP ${response.status}`);
  }
  return htmlToText(await response.text());
};

/**
 * One line per store whose requirement the app misses, earliest deadline
 * first, saying when uploads start being rejected (or that they already are).
 */
const formatDeadlines = (checks) =>
  checks
    .filter((check) => check.kind === 'requirement')
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .map((check) =>
      check.daysLeft <= 0
        ? `**Deadline passed on ${check.deadline}:** ${check.store} is rejecting uploads now, until ${check.fix}.`
        : `**Deadline: ${check.deadline} (${check.daysLeft} day${check.daysLeft === 1 ? '' : 's'} left):** after that, ${check.store} rejects uploads until ${check.fix}.`,
    );

const formatReport = ({ checks, notes }) =>
  [
    '### Store toolchain requirements',
    '',
    ...formatDeadlines(checks).flatMap((line) => [line, '']),
    ...checks.map(
      (check) => `- ${check.status === 'passed' ? '✅' : '❌'} **${check.name}**: ${check.detail}`,
    ),
    ...(notes.length ? ['', '#### Notes', '', ...notes.map((note) => `- ${note}`)] : []),
  ].join('\n');

/**
 * Builds the alert issue text and labels from the --report JSON, or from null
 * when the report is missing. Used by the Store Toolchain Monitor workflow.
 */
const buildStoreToolchainAlert = (report, runUrl) => {
  const critical = Boolean(
    report && report.checks.some((check) => check.kind === 'requirement'),
  );
  return {
    title: ALERT_TITLE,
    labels: critical ? [CRITICAL_LABEL] : [],
    body: [
      'The weekly store toolchain check needs attention. Google Play or App Store Connect uploads may be rejected if the Android target API or Xcode version is not updated.',
      '',
      report ? report.markdown : '- The monitor exited before producing a readable report.',
      '',
      'See **Store toolchain requirements** in `docs/operations/admin-runbook.md` for what to update and test.',
      '',
      `Run: ${runUrl}`,
    ].join('\n'),
  };
};

const main = async () => {
  const reportIndex = process.argv.indexOf('--report');
  const reportPath = reportIndex === -1 ? null : process.argv[reportIndex + 1];
  const pageText = async (url) => {
    try {
      return await fetchText(url);
    } catch (error) {
      console.error(`Could not fetch ${url}: ${error.message}`);
      return '';
    }
  };

  const [androidText, appleText, submittingText] = await Promise.all([
    pageText(SOURCES.androidTargetApi),
    pageText(SOURCES.appleUpcoming),
    pageText(SOURCES.appleSubmitting),
  ]);
  const result = evaluateStoreToolchain({
    app: readAppToolchain(),
    androidRequirements: parseAndroidTargetRequirements(androidText),
    appleRequirements: parseAppleXcodeRequirements(appleText),
    latestXcode: parseAppleLatestXcode(submittingText),
    today: new Date(),
  });

  const markdown = formatReport(result);
  console.log(markdown);
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${markdown}\n`);
  }
  if (reportPath) {
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify({ ...result, deadlines: formatDeadlines(result.checks), markdown }, null, 2)}\n`,
    );
  }
  if (result.checks.some((check) => check.status === 'failed')) {
    process.exitCode = 1;
  }
};

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = {
  ALERT_TITLE,
  CRITICAL_LABEL,
  LEAD_DAYS,
  buildStoreToolchainAlert,
  SOURCES,
  evaluateStoreToolchain,
  formatDeadlines,
  formatReport,
  htmlToText,
  parseAndroidTargetRequirements,
  parseAppleLatestXcode,
  parseAppleXcodeRequirements,
  readAppToolchain,
};
