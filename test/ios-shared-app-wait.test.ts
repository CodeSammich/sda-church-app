import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The iOS key screens' other batches wait for the one compiling runner to share
// the app. When GitHub's Mac runners are in short supply, that runner can get
// its Mac long after the others did, so they wait for it rather than for a
// fixed time. This runs the step's own script against a fake `gh`.
const workflow = readFileSync(join(process.cwd(), '.github/workflows/ios-key-screens.yml'), 'utf8');
const stepText = (() => {
  const start = workflow.indexOf('      - name: Wait for the shared app\n');
  const end = workflow.indexOf('\n      - name: ', start + 1);
  return workflow.slice(start, end);
})();
const step = {
  if: /\n {8}if: (.+)\n/.exec(stepText)?.[1],
  timeout: /\n {8}timeout-minutes:/.test(stepText),
  maxQueuedSeconds: Number(/\n {10}MAX_QUEUED_SECONDS: (\d+)\n/.exec(stepText)?.[1]),
  // The run block, without the YAML's 10-space indent.
  run: stepText
    .slice(stepText.indexOf('        run: |\n') + '        run: |\n'.length)
    .split('\n')
    .map((line) => line.replace(/^ {10}/, ''))
    .join('\n'),
};

// Each poll: whether the app is shared yet, and the compiling runner's job
// "<status> <conclusion>", or null for a failed API call.
type Poll = { shared: boolean; builder: string | null };

const runWait = (polls: Poll[], { minutesPerClockRead = 1 } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'shared-app-wait-'));
  writeFileSync(join(dir, 'polls.json'), JSON.stringify(polls));
  writeFileSync(join(dir, 'poll'), '0');
  writeFileSync(join(dir, 'clock'), '1000000');
  const script = (name: string, body: string) => {
    writeFileSync(join(dir, name), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(dir, name), 0o755);
  };
  // The artifacts call starts each poll; the jobs call follows it. The last
  // poll repeats.
  script(
    'gh',
    `poll=$(cat "${dir}/poll")
entry=$(node -e 'const p=require(process.argv[1]); const i=Math.min(+process.argv[2], p.length-1); process.stdout.write(JSON.stringify(p[i]))' "${dir}/polls.json" "$poll")
case "$*" in
  *artifacts*)
    [ "$(node -e 'process.stdout.write(String(JSON.parse(process.argv[1]).shared))' "$entry")" = true ] && echo "ios-simulator-app-$RUN_ID"
    echo "something-else" ;;
  *jobs*)
    echo $((poll + 1)) > "${dir}/poll"
    builder=$(node -e 'const b=JSON.parse(process.argv[1]).builder; process.stdout.write(b === null ? "\\u0000" : b)' "$entry")
    [ "$builder" = $'\\0' ] || [ -z "$builder" ] && exit 1
    echo "$builder" ;;
esac`,
  );
  script('sleep', 'exit 0');
  script(
    'date',
    `clock=$(cat "${dir}/clock"); echo $((clock + ${minutesPerClockRead * 60})) > "${dir}/clock"; echo "$clock"`,
  );
  const result = spawnSync('bash', ['-c', step.run], {
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_TOKEN: 'fake',
      MAX_QUEUED_SECONDS: String(step.maxQueuedSeconds),
      PATH: `${dir}:${process.env.PATH}`,
      REPO: 'org/repo',
      RUN_ID: '42',
    },
  });
  return { code: result.status, out: `${result.stdout}${result.stderr}` };
};

describe('waiting for the shared app', () => {
  it('has no fixed step timeout, and only the waiting batches get the longer job limit', () => {
    expect(step.if).toBe('${{ !matrix.builds }}');
    expect(step.timeout).toBe(false);
    const capture = workflow.slice(workflow.indexOf('\n  capture:\n'), workflow.indexOf('\n    steps:\n'));
    expect(capture).toContain('\n    timeout-minutes: ${{ matrix.builds && 40 || 90 }}\n');
    expect(step.maxQueuedSeconds).toBe(2700);
    expect(step.run).toContain('set -euo pipefail\n');
  });

  it('keeps waiting while the compiling runner waits for a Mac and then compiles', () => {
    const { code, out } = runWait([
      { shared: false, builder: 'queued ' },
      { shared: false, builder: 'queued ' },
      { shared: false, builder: 'in_progress ' },
      { shared: false, builder: 'in_progress ' },
      { shared: true, builder: 'in_progress ' },
    ]);
    expect(code).toBe(0);
    expect(out).toContain('still waiting for a Mac');
  });

  it('stops as soon as the compiling runner ends without the app', () => {
    const { code, out } = runWait([
      { shared: false, builder: 'queued ' },
      { shared: false, builder: 'completed failure' },
    ]);
    expect(code).toBe(1);
    expect(out).toContain('The bible-text runner ended (failure) without sharing the app.');
  });

  it('gives up after 45 minutes when the compiling runner never gets a Mac', () => {
    // Each clock read moves on 10 minutes, so the limit passes on the sixth.
    const { code, out } = runWait([{ shared: false, builder: 'queued ' }], { minutesPerClockRead: 10 });
    expect(code).toBe(1);
    expect(out).toContain('waited 45 minutes for a Mac without getting one');
  });

  it('counts only an unbroken wait for a Mac, and asks again after a failed API call', () => {
    const { code } = runWait(
      [
        { shared: false, builder: 'queued ' },
        { shared: false, builder: null },
        { shared: false, builder: 'in_progress ' },
        { shared: false, builder: 'queued ' },
        { shared: true, builder: 'in_progress ' },
      ],
      { minutesPerClockRead: 30 },
    );
    expect(code).toBe(0);
  });
});
