import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const script = resolve(__dirname, '../scripts/sdkmanager-install.sh');
const workflows = resolve(__dirname, '../.github/workflows');

// Runs the script with a fake sdkmanager that fails its first `failures` calls,
// as a broken system-image download did on 2026-10-20.
const run = (failures: number) => {
  const dir = mkdtempSync(join(tmpdir(), 'sdkmanager-'));
  const sdk = join(dir, 'sdk');
  mkdirSync(join(sdk, '.temp'), { recursive: true });
  writeFileSync(join(sdk, '.temp', 'partial.zip'), 'broken');
  writeFileSync(join(dir, 'calls'), '');
  writeFileSync(
    join(dir, 'sdkmanager'),
    `#!/usr/bin/env bash
echo "$*" >> "${dir}/calls"
[ "$(wc -l < "${dir}/calls")" -gt ${failures} ] || { echo "Error reading Zip content"; exit 1; }
`,
  );
  chmodSync(join(dir, 'sdkmanager'), 0o755);
  const result = spawnSync(script, ['emulator', 'system-images;android-36;google_apis;x86_64'], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, ANDROID_HOME: sdk, SDKMANAGER_RETRY_DELAY: '0' },
  });
  const calls = readFileSync(join(dir, 'calls'), 'utf8').trim().split('\n');
  return { status: result.status, output: result.stdout + result.stderr, calls, sdk };
};

describe('scripts/sdkmanager-install.sh', () => {
  it('installs with one call when the download works', () => {
    const { status, calls } = run(0);
    expect(status).toBe(0);
    expect(calls).toEqual(['emulator system-images;android-36;google_apis;x86_64']);
  });

  it('downloads again after a broken download', () => {
    const { status, calls, output, sdk } = run(2);
    expect(status).toBe(0);
    expect(calls).toHaveLength(3);
    expect(output).toContain('::warning::sdkmanager failed (attempt 1 of 3)');
    // The partial download is thrown away before the retry.
    expect(existsSync(join(sdk, '.temp'))).toBe(false);
  });

  it('fails after three broken downloads', () => {
    const { status, calls, output } = run(3);
    expect(status).toBe(1);
    expect(calls).toHaveLength(3);
    expect(output).toContain('::error::sdkmanager failed 3 times.');
  });

  it('is how every workflow installs Android SDK packages', () => {
    // Only accepting the licenses calls sdkmanager directly.
    for (const file of readdirSync(workflows)) {
      const direct = readFileSync(join(workflows, file), 'utf8')
        .split('\n')
        .filter((line) => /^(?!\s*#)(.*[\s|;&(])?sdkmanager(\s|$)/.test(line))
        .filter((line) => !/sdkmanager --licenses|install=sdkmanager/.test(line));
      expect([file, direct]).toEqual([file, []]);
    }
  });
});
