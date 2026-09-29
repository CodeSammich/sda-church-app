/**
 * Three Apple things expire every year: the Apple Distribution certificate that
 * signs iOS builds, the App Store provisioning profile made from it, and the
 * Apple Developer Program membership. Their dates are recorded in
 * .github/apple-signing-expiry.json. None of them is secret, and knowing them
 * gives no access to anything: the certificate and profile dates are inside
 * every signed IPA the workflow builds, and the alert issue shows only dates.
 *
 * - The weekly Apple Signing Monitor runs `--report`. It exits non-zero from 60
 *   days before any date, when one has passed, or when one isn't recorded, and
 *   the workflow opens an alert issue with the renewal steps.
 * - Each signed iOS build runs `--profile` on the provisioning profile inside
 *   the IPA it just built (Apple re-signs App Store and TestFlight copies, so
 *   only this build has it), and warns when the recorded dates don't match, for
 *   example after a renewal that forgot to update the file.
 *
 * Renewal steps: docs/operations/app-store-setup.md#yearly-apple-renewals.
 *
 * Usage:
 *   node scripts/check-apple-signing-expiry.cjs --report <path>
 *   node scripts/check-apple-signing-expiry.cjs --profile <embedded.mobileprovision>
 */
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const DATES_FILE = path.resolve(__dirname, '..', '.github', 'apple-signing-expiry.json');
const ALERT_TITLE = '[monitor] Apple signing needs renewal';
const RENEWAL_DOCS = 'docs/operations/app-store-setup.md#yearly-apple-renewals';
// Two months: enough time to reach a Mac, renew, and test a signed build.
const WARNING_DAYS = 60;
const DAY = 86400000;

const ITEMS = Object.freeze([
  { key: 'distributionCertificate', label: 'Apple Distribution certificate' },
  { key: 'provisioningProfile', label: 'App Store provisioning profile' },
  { key: 'developerMembership', label: 'Apple Developer Program membership' },
]);

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'long',
  });

/** Checks each recorded date against today. */
const checkExpiry = (dates, now = new Date()) => {
  const items = ITEMS.map(({ key, label }) => {
    const value = dates?.[key];
    const time = value ? Date.parse(value) : NaN;
    if (!value || Number.isNaN(time)) {
      return { key, label, expires: null, daysLeft: null, status: 'missing' };
    }
    const daysLeft = Math.ceil((time - now.getTime()) / DAY);
    const status = daysLeft <= 0 ? 'expired' : daysLeft <= WARNING_DAYS ? 'soon' : 'ok';
    return { key, label, expires: new Date(time).toISOString(), daysLeft, status };
  });
  return { items, needsAttention: items.some((item) => item.status !== 'ok') };
};

const describe = (item) => {
  switch (item.status) {
    case 'missing':
      return `**${item.label}:** no date recorded. Add it to \`.github/apple-signing-expiry.json\`.`;
    case 'expired':
      return `**${item.label}:** **expired on ${formatDate(item.expires)}.**`;
    case 'soon':
      return `**${item.label}:** expires on ${formatDate(item.expires)}, in ${item.daysLeft} days.`;
    default:
      return `${item.label}: expires on ${formatDate(item.expires)}, in ${item.daysLeft} days.`;
  }
};

const formatReport = (result) => result.items.map((item) => `- ${describe(item)}`).join('\n');

/** The alert issue text, from the --report JSON, or from null when it's missing. */
const buildAppleSigningAlert = (report, runUrl) => ({
  title: ALERT_TITLE,
  body: [
    'Apple signing needs attention. When the certificate or profile expires, new iOS builds can\'t be signed or uploaded; when the membership lapses, the app is removed from the App Store.',
    '',
    report ? formatReport(report) : '- The monitor exited before producing a readable report.',
    '',
    'To renew, follow **Yearly Apple renewals** in `' + RENEWAL_DOCS + '`. In short:',
    '',
    '1. **Membership:** the Account Holder renews it and reconfirms the nonprofit fee waiver (renewal opens 30 days before it expires).',
    '2. **Certificate:** on a Mac, create a certificate signing request, then a new **Apple Distribution** certificate, and export it as a `.p12` with a new password.',
    '3. **Profile:** generate a new **App Store Connect** provisioning profile for `org.nyccsda.app` with the new certificate.',
    '4. **GitHub:** replace `IOS_DISTRIBUTION_CERTIFICATE_BASE64`, `IOS_DISTRIBUTION_CERTIFICATE_PASSWORD`, and `IOS_PROVISIONING_PROFILE_BASE64` in the `production` environment.',
    '5. **Dates:** update `.github/apple-signing-expiry.json` with the new expiry dates, in a pull request into the release branch.',
    '6. **Check:** run **Native iOS build** from `main`, then revoke the old certificate, and keep the new files and password where the IT administrators store signing files.',
    '',
    'This issue closes by itself on the first weekly run after every date is more than 60 days away.',
    '',
    `Run: ${runUrl}`,
  ].join('\n'),
});

/**
 * Reads the profile's expiry and its Apple Distribution certificate's expiry
 * from an embedded.mobileprovision. The profile is a signed plist whose XML is
 * stored as plain text, so no signature check or Apple tool is needed.
 */
const readProfileDates = (buffer) => {
  const raw = Buffer.from(buffer).toString('latin1');
  const start = raw.indexOf('<?xml');
  const end = raw.indexOf('</plist>');
  if (start === -1 || end === -1) {
    throw new Error('The file is not a provisioning profile: it has no plist.');
  }
  const xml = raw.slice(start, end);
  const expiration = /<key>ExpirationDate<\/key>\s*<date>([^<]+)<\/date>/.exec(xml);
  const certificates = /<key>DeveloperCertificates<\/key>\s*<array>([\s\S]*?)<\/array>/.exec(xml);
  if (!expiration || !certificates) {
    throw new Error('The provisioning profile has no expiry date or certificate.');
  }
  const certificateExpiries = [...certificates[1].matchAll(/<data>([\s\S]*?)<\/data>/g)]
    .map(([, base64]) => new crypto.X509Certificate(Buffer.from(base64.replace(/\s+/g, ''), 'base64')))
    .map((certificate) => Date.parse(certificate.validTo));
  if (!certificateExpiries.length) {
    throw new Error('The provisioning profile lists no certificate.');
  }
  return {
    provisioningProfile: new Date(expiration[1]).toISOString(),
    // With more than one certificate, the first to expire is what matters.
    distributionCertificate: new Date(Math.min(...certificateExpiries)).toISOString(),
  };
};

/** The recorded dates that differ from the built IPA's by more than a day. */
const compareWithBuild = (recorded, actual) =>
  ['distributionCertificate', 'provisioningProfile']
    .filter((key) => {
      const recordedTime = Date.parse(recorded?.[key] || '');
      return Number.isNaN(recordedTime) || Math.abs(recordedTime - Date.parse(actual[key])) > DAY;
    })
    .map((key) => ({
      key,
      label: ITEMS.find((item) => item.key === key).label,
      recorded: recorded?.[key] || null,
      actual: actual[key],
    }));

const appendSummary = (text) => {
  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${text}\n`);
  }
};

const main = () => {
  const argument = (name) => {
    const index = process.argv.indexOf(name);
    return index === -1 ? null : process.argv[index + 1];
  };
  const recorded = JSON.parse(fs.readFileSync(DATES_FILE, 'utf8'));

  const profilePath = argument('--profile');
  if (profilePath) {
    const actual = readProfileDates(fs.readFileSync(profilePath));
    const mismatches = compareWithBuild(recorded, actual);
    for (const { key, label, recorded: was, actual: is } of mismatches) {
      const message = `${label} in this build expires on ${formatDate(is)}, but .github/apple-signing-expiry.json says ${was ? formatDate(was) : 'nothing'}. Set "${key}" to "${is}" so the reminders are right.`;
      console.log(`::warning title=Update the recorded Apple signing dates::${message}`);
      appendSummary(message);
    }
    if (!mismatches.length) {
      const message = `The recorded Apple signing dates match this build: the certificate and profile expire on ${formatDate(actual.provisioningProfile)}.`;
      console.log(message);
      appendSummary(message);
    }
    return;
  }

  const result = checkExpiry(recorded);
  const markdown = formatReport(result);
  console.log(markdown);
  appendSummary(markdown);
  const reportPath = argument('--report');
  if (reportPath) {
    fs.writeFileSync(reportPath, `${JSON.stringify(result, null, 2)}\n`);
  }
  if (result.needsAttention) {
    process.exitCode = 1;
  }
};

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  ALERT_TITLE,
  DATES_FILE,
  ITEMS,
  WARNING_DAYS,
  buildAppleSigningAlert,
  checkExpiry,
  compareWithBuild,
  formatReport,
  readProfileDates,
};
