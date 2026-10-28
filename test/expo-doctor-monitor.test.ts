import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const {
  ALERT_TITLE,
  buildExpoDoctorAlert,
  getSkipReason,
  stripAnsi,
} = require('../scripts/expo-doctor-monitor.cjs');

const readWorkflow = (file: string) =>
  readFileSync(join(process.cwd(), '.github/workflows', file), 'utf8');

// The section of a workflow from one job's key to the next job's, or the end.
const jobSection = (workflow: string, job: string) => {
  const start = workflow.indexOf(`\n  ${job}:\n`);
  const next = workflow.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
  return next < 0 ? workflow.slice(start) : workflow.slice(start, start + 1 + next);
};

describe('Expo doctor monitor', () => {
  it('runs on stable Expo and React Native releases', () => {
    expect(getSkipReason({ expo: '58.0.16', reactNative: '0.88.0' })).toBeNull();
  });

  it('skips while Expo or React Native is a pre-release, like the Expo 58 canary', () => {
    expect(getSkipReason({ expo: '58.0.0', reactNative: '0.88.0-rc.3' })).toBe(
      "React Native 0.88.0-rc.3 is a pre-release, so the package versions can't match the SDK's yet.",
    );
    expect(
      getSkipReason({ expo: '58.0.0-canary-20260909-ea7a89a', reactNative: '0.88.0-rc.3' }),
    ).toMatch(/^Expo 58\.0\.0-canary-20260909-ea7a89a and React Native 0\.88\.0-rc\.3 are pre-releases/);
  });

  it("puts expo-doctor's output in the alert, without terminal colors", () => {
    const alert = buildExpoDoctorAlert(
      {
        status: 'failed',
        output: '\u001b[31m✖ Check that packages match versions required by installed Expo SDK\u001b[39m',
      },
      'https://github.com/org/repo/actions/runs/42',
    );
    expect(alert.title).toBe(ALERT_TITLE);
    expect(alert.priority).toBe('High');
    expect(alert.body).toContain(
      '```\n✖ Check that packages match versions required by installed Expo SDK\n```',
    );
    expect(alert.body).toContain('npx expo install --fix');
    expect(alert.body).toContain('Run: https://github.com/org/repo/actions/runs/42');
  });

  it('cuts very long output and still alerts without a report', () => {
    const long = buildExpoDoctorAlert({ output: 'x'.repeat(20000) }, 'run').body;
    expect(long.length).toBeLessThan(14000);
    expect(long).toContain("(cut; the run's log has the rest)");
    expect(buildExpoDoctorAlert(null, 'run').body).toContain('The report was missing');
  });

  it('strips terminal colors', () => {
    expect(stripAnsi('\u001b[1m\u001b[32m20/20\u001b[39m\u001b[22m checks passed')).toBe(
      '20/20 checks passed',
    );
  });

  it('installs and runs dependencies only in the job that cannot write issues', () => {
    const workflow = readWorkflow('expo-doctor-monitor.yml');
    const doctor = jobSection(workflow, 'doctor');
    const alert = jobSection(workflow, 'alert');
    expect(workflow).toMatch(/\npermissions:\n {2}contents: read\n\n/);
    expect(doctor).toContain('npm ci');
    expect(doctor).not.toContain('issues: write');
    expect(alert).toContain('issues: write');
    expect(alert).not.toMatch(/npm (ci|install)|npx /);
    for (const job of [doctor, alert]) expect(job).toContain('persist-credentials: false');
  });
});

describe('Expo doctor on pull requests', () => {
  const job = jobSection(readWorkflow('pr-tests.yml'), 'expo-doctor');

  it('is its own job, so a failure never blocks a merge', () => {
    // Required checks are listed by name in the rulesets; this name isn't one.
    expect(job).toContain('name: Expo Doctor (config)');
    expect(job).not.toContain('Jest unit tests');
  });

  it('leaves the dependency version check to the weekly monitor', () => {
    expect(job).toContain('EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK: 1');
    expect(job).toContain('EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS: 1');
    expect(job).toContain('run: npm run doctor');
  });
});
