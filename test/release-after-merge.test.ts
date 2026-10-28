import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Release - After Merge runs after every merge into main. These run its steps'
// own scripts against a fake `gh`.
const workflow = readFileSync(join(process.cwd(), '.github/workflows/release-after-merge.yml'), 'utf8');
const stepText = (name: string) => {
  const start = workflow.indexOf(`      - name: ${name}\n`);
  const end = workflow.indexOf('\n      - name: ', start + 1);
  return workflow.slice(start, end === -1 ? undefined : end);
};
// A step's run block, without the YAML's 10-space indent.
const stepRun = (name: string) => {
  const text = stepText(name);
  return text
    .slice(text.indexOf('        run: |\n') + '        run: |\n'.length)
    .split('\n')
    .map((line) => line.replace(/^ {10}/, ''))
    .join('\n');
};

// Runs a step with `gh` replaced by a script that gets the call number as $call
// and the folder as $dir, and logs each call on one line. `sleep` returns at
// once.
const runStep = (name: string, gh: string, data: unknown, env: Record<string, string> = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'after-merge-'));
  writeFileSync(join(dir, 'data.json'), JSON.stringify(data));
  writeFileSync(join(dir, 'call'), '0');
  writeFileSync(join(dir, 'output'), '');
  const script = (file: string, body: string) => {
    writeFileSync(join(dir, file), `#!/usr/bin/env bash\n${body}\n`);
    chmodSync(join(dir, file), 0o755);
  };
  script('gh', `dir="${dir}"; call=$(cat "$dir/call"); echo $((call + 1)) > "$dir/call"; echo "$*" | tr '\\n' ' ' >> "$dir/calls"; echo >> "$dir/calls"\n${gh}`);
  script('sleep', 'exit 0');
  const result = spawnSync('bash', ['-c', stepRun(name)], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_TOKEN: 'fake',
      GITHUB_OUTPUT: join(dir, 'output'),
      GITHUB_REPOSITORY: 'org/repo',
      GITHUB_SHA: 'abc123',
      PATH: `${dir}:${process.env.PATH}`,
      REPO_URL: 'https://github.com/org/repo',
      ...env,
    },
  });
  const read = (file: string) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : '');
  return {
    code: result.status,
    out: `${result.stdout}${result.stderr}`,
    calls: read('calls').split('\n').map((call) => call.trim()).filter(Boolean),
    output: read('output'),
    comment: read('comment.md'),
  };
};

// Prints data.json's entry for this call (the last one repeats): a string to
// print, or null to fail as a failed API call would.
const replay = `node -e 'const d=require(process.argv[1]); const r=d[Math.min(+process.argv[2], d.length-1)]; if (r === null) process.exit(1); if (r) console.log(r)' "$dir/data.json" "$call"`;

describe('finding the merged pull request', () => {
  // GitHub can take a few seconds to link a merge commit to its pull request
  // (#486). Each entry is what a call prints after the step's --jq filter.
  const findPull = (calls: (string | null)[]) => runStep('Find the merged pull request', replay, calls);
  const releasePull = 'number=482\nhead_ref=release-candidate';

  it('finds it at once when GitHub has linked it', () => {
    const { code, calls, output } = findPull([releasePull]);
    expect(code).toBe(0);
    expect(calls).toHaveLength(1);
    expect(output).toBe('number=482\nhead_ref=release-candidate\n');
  });

  it('asks again while GitHub hasn\'t linked it yet, or the call fails', () => {
    const { code, calls, output } = findPull(['', null, releasePull]);
    expect(code).toBe(0);
    expect(calls).toHaveLength(3);
    expect(output).toBe('number=482\nhead_ref=release-candidate\n');
  });

  it('gives up after six tries for a direct push, so the comment step skips', () => {
    const { code, calls, output } = findPull(['']);
    expect(code).toBe(0);
    expect(calls).toHaveLength(6);
    expect(output).toBe('');
  });
});

describe('moving feature pull requests back to release-candidate', () => {
  // Each look's open pull requests into main, as the step's --jq filter
  // prints their numbers, and the pull requests whose move fails.
  const movePulls = (looks: string[], failing: number[] = []) =>
    runStep(
      'Move feature pull requests back to release-candidate',
      `case "$*" in
  *"--method PATCH"*) for n in ${failing.join(' ')}; do [[ "$*" == *"/pulls/$n "* ]] && exit 1; done; exit 0 ;;
  *) n=$(grep -c 'pulls?state=open' "$dir/calls"); node -e 'const l=require(process.argv[1]); const r=l[Math.min(+process.argv[2]-1, l.length-1)]; if (r) console.log(r)' "$dir/data.json" "$n" ;;
esac`,
      looks,
    );
  const moves = (calls: string[]) =>
    calls.filter((call) => call.includes('--method PATCH')).map((call) => /\/pulls\/(\d+) /.exec(call)?.[1]);

  it('runs only after the release merge, once it has created release-candidate again', () => {
    expect(stepText('Move feature pull requests back to release-candidate')).toContain(
      "steps.pr.outputs.head_ref == 'release-candidate' &&\n" +
        "          steps.branch.outputs.result == 'created'\n",
    );
  });

  it('moves each one once, including those GitHub moves a little later', () => {
    const { code, calls, output } = movePulls(['12', '12\n34', '34']);
    expect(code).toBe(0);
    expect(moves(calls)).toEqual(['12', '34']);
    expect(calls).toContain('api --method PATCH repos/org/repo/pulls/12 -f base=release-candidate --silent');
    expect(output).toBe('moved=12 34\nfailed=\n');
  });

  it('moves Dependabot\'s pull requests too, since they target release-candidate', () => {
    expect(stepText('Move feature pull requests back to release-candidate')).not.toMatch(/user\.type|Bot/);
    const { code, calls, output } = movePulls(['12\n56']);
    expect(code).toBe(0);
    expect(moves(calls)).toEqual(['12', '56']);
    expect(output).toBe('moved=12 56\nfailed=\n');
  });

  it('reports one it couldn\'t move, and still moves the rest', () => {
    const { code, out, output } = movePulls(['12\n34'], [12]);
    expect(code).toBe(0);
    expect(out).toContain("::warning title=Pull request not moved::Change #12's base to release-candidate.");
    expect(output).toBe('moved=34\nfailed=12\n');
  });

  it('moves nothing when nothing is on main', () => {
    const { code, calls, output } = movePulls(['']);
    expect(code).toBe(0);
    expect(moves(calls)).toEqual([]);
    expect(output).toBe('moved=\nfailed=\n');
  });
});

describe('the comment on the release pull request', () => {
  const comment = (env: Record<string, string>) =>
    runStep(
      'Comment the next steps on the pull request',
      `case "$*" in
  *"--method POST"*) cp comment.md "$dir/posted.md" ;;
  *) echo "https://github.com/org/repo/actions/runs/1" ;;
esac`,
      [],
      { PR_NUMBER: '489', BRANCH_RESULT: 'created', ...env },
    );

  const onMain = '[open pull requests into `main`](https://github.com/org/repo/pulls?q=is%3Apr+is%3Aopen+base%3Amain)';

  it('names the pull requests it moved, and any it couldn\'t', () => {
    const { code, comment: body } = comment({ MOVED: '12 34', FAILED: '56' });
    expect(code).toBe(0);
    expect(body).toContain('Created `release-candidate` from this merge for the next release');
    expect(body).toContain('Moved #12, #34 from `main` to `release-candidate`, where feature and Dependabot pull requests belong.');
    expect(body).toContain("Couldn't move #56 back to `release-candidate`. Change each one's base on its page.");
  });

  it('says nothing about moving pull requests when none were on main', () => {
    const { code, comment: body } = comment({ MOVED: '', FAILED: '' });
    expect(code).toBe(0);
    expect(body).toContain('Created `release-candidate` from this merge for the next release');
    expect(body).not.toMatch(/[Mm]ove|Left/);
  });

  it('says to move them back by hand when release-candidate needs making by hand', () => {
    const failed = comment({ BRANCH_RESULT: 'failed' }).comment;
    expect(failed).toContain("Couldn't create `release-candidate`. Create it from `main` on the");
    expect(failed).toContain(`then change the base of the pull requests GitHub moved to \`main\` back to it (${onMain}).`);
    const stale = comment({ BRANCH_RESULT: 'stale' }).comment;
    expect(stale).toContain("`release-candidate` wasn't deleted");
    expect(stale).toContain(`so then change their base back to \`release-candidate\` (${onMain}).`);
  });
});
