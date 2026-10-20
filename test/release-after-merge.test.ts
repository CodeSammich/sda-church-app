import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Release - After Merge finds the pull request a merge commit came from, but
// GitHub can take a few seconds to link the two (#486). This runs the step's
// own script against a fake `gh`.
const workflow = readFileSync(join(process.cwd(), '.github/workflows/release-after-merge.yml'), 'utf8');
const stepText = (() => {
  const start = workflow.indexOf('      - name: Find the merged pull request\n');
  const end = workflow.indexOf('\n      - name: ', start + 1);
  return workflow.slice(start, end);
})();
// The run block, without the YAML's 10-space indent.
const run = stepText
  .slice(stepText.indexOf('        run: |\n') + '        run: |\n'.length)
  .split('\n')
  .map((line) => line.replace(/^ {10}/, ''))
  .join('\n');

// What each call prints after the step's --jq filter: the pull request, '' when
// GitHub lists none merged into main, or null for a failed call. The last one
// repeats.
const findPull = (calls: (string | null)[]) => {
  const dir = mkdtempSync(join(tmpdir(), 'after-merge-'));
  writeFileSync(join(dir, 'calls.json'), JSON.stringify(calls));
  writeFileSync(join(dir, 'call'), '0');
  writeFileSync(join(dir, 'output'), '');
  const script = (name: string, body: string) => {
    writeFileSync(join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(dir, name), 0o755);
  };
  script(
    'gh',
    `call=$(cat "${dir}/call"); echo $((call + 1)) > "${dir}/call"
node -e 'const c=require(process.argv[1]); const r=c[Math.min(+process.argv[2], c.length-1)]; if (r === null) process.exit(1); if (r) console.log(r)' "${dir}/calls.json" "$call"`,
  );
  script('sleep', 'exit 0');
  const result = spawnSync('bash', ['-c', run], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_TOKEN: 'fake',
      GITHUB_OUTPUT: join(dir, 'output'),
      GITHUB_REPOSITORY: 'org/repo',
      GITHUB_SHA: 'abc123',
      PATH: `${dir}:${process.env.PATH}`,
    },
  });
  return {
    code: result.status,
    calls: Number(readFileSync(join(dir, 'call'), 'utf8')),
    output: readFileSync(join(dir, 'output'), 'utf8'),
  };
};

const releasePull = 'number=482\nhead_ref=release-candidate';

describe('finding the merged pull request', () => {
  it('finds it at once when GitHub has linked it', () => {
    const { code, calls, output } = findPull([releasePull]);
    expect(code).toBe(0);
    expect(calls).toBe(1);
    expect(output).toBe('number=482\nhead_ref=release-candidate\n');
  });

  it('asks again while GitHub hasn\'t linked it yet, or the call fails', () => {
    const { code, calls, output } = findPull(['', null, releasePull]);
    expect(code).toBe(0);
    expect(calls).toBe(3);
    expect(output).toBe('number=482\nhead_ref=release-candidate\n');
  });

  it('gives up after six tries for a direct push, so the comment step skips', () => {
    const { code, calls, output } = findPull(['']);
    expect(code).toBe(0);
    expect(calls).toBe(6);
    expect(output).toBe('');
  });
});
