import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// The release PR's screenshot review comment, which both key-screen workflows
// write through key-screens-review.yml: the iPhone run posts it, and Android's
// refreshes it, as after a rerun of a failed Android group (#632).
const repoFile = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const review = repoFile('.github/workflows/key-screens-review.yml');
const ios = repoFile('.github/workflows/ios-key-screens.yml');
const android = repoFile('.github/workflows/android-key-screens.yml');

/** One job of a workflow, up to the next job. */
const jobOf = (text: string, id: string) => {
  const start = text.indexOf(`\n  ${id}:\n`);
  expect(start).toBeGreaterThan(-1);
  const next = text.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
  return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
};
/** A step's run block, without the YAML's 10-space indent. */
const stepRun = (name: string) => {
  const start = review.indexOf(`      - name: ${name}\n`);
  expect(start).toBeGreaterThan(-1);
  const end = review.indexOf('\n      - name: ', start + 1);
  const text = review.slice(start, end === -1 ? undefined : end);
  return text
    .slice(text.indexOf('        run: |\n') + '        run: |\n'.length)
    .split('\n')
    .map((line) => line.replace(/^ {10}/, ''))
    .join('\n');
};

const SHA = '2624c98cc12ea72f0e13c63f6834978b7a739c5f';

type Api = {
  /** The PR's review comments and notices, as "<id> <first line>". */
  reviews: string[];
  /** Each workflow's newest run for the commit, as "<id> <attempt>". */
  runs: Record<string, string>;
  /** How each run's join job ended. */
  joins: Record<string, string>;
  /**
   * Each name's newest matching download, by
   * "<run> <iphone|ipad|app-store|app-store-ipad|app|android|android-tablet|google-play|google-play-tablet>",
   * as "<id> <bytes>" lines, one per part, in name order.
   */
  artifacts: Record<string, string>;
  patchFails?: boolean;
};

// Runs "Post or refresh the review comment" with `gh` replaced by a script
// that answers as each call's --jq filter would print GitHub's answer, logs
// each call on one line, and saves a posted or updated comment.
const postOrRefresh = (env: Record<string, string>, api: Api) => {
  const dir = mkdtempSync(join(tmpdir(), 'key-screens-review-'));
  writeFileSync(join(dir, 'data.json'), JSON.stringify(api));
  writeFileSync(
    join(dir, 'gh'),
    `#!/usr/bin/env node
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(${JSON.stringify(join(dir, 'data.json'))}, 'utf8'));
const args = process.argv.slice(2);
fs.appendFileSync(${JSON.stringify(join(dir, 'calls'))}, args.join(' ').replace(/\\n/g, ' ') + '\\n');
const url = args.find((arg) => arg.startsWith('repos/')) || '';
const jq = args.includes('--jq') ? args[args.indexOf('--jq') + 1] : '';
const body = args.find((arg) => arg.startsWith('body='));
const method = args.includes('-X') ? args[args.indexOf('-X') + 1] : body ? 'POST' : 'GET';
const print = (value) => { if (value) console.log(value); };
let match;
if (method === 'PATCH') { fs.writeFileSync(${JSON.stringify(join(dir, 'patched.md'))}, body.slice(5)); process.exit(data.patchFails ? 1 : 0); }
else if (method === 'POST') fs.writeFileSync(${JSON.stringify(join(dir, 'posted.md'))}, body.slice(5));
else if (method === 'DELETE') {}
else if (/\\/issues\\/\\d+\\/comments/.test(url)) print(data.reviews.join('\\n'));
else if ((match = /workflows\\/([^/]+)\\/runs/.exec(url))) print(data.runs[match[1]]);
else if ((match = /runs\\/(\\d+)\\/jobs/.exec(url))) print(jq.includes('completed_at != null') ? '' : data.joins[match[1]]);
else if ((match = /runs\\/(\\d+)\\/artifacts/.exec(url))) {
  const kind = ['iphone', 'app-store-ipad', 'ipad', 'app-store', 'android-tablet', 'android', 'google-play-tablet', 'google-play']
    .find((name) => jq.includes('-' + name)) || 'app';
  print(data.artifacts[match[1] + ' ' + kind]);
}
`,
  );
  chmodSync(join(dir, 'gh'), 0o755);
  const result = spawnSync('bash', ['-c', stepRun('Post or refresh the review comment')], {
    cwd: dir,
    encoding: 'utf8',
    env: {
      ...process.env,
      GH_TOKEN: 'fake',
      PATH: `${dir}:${process.env.PATH}`,
      REPO: 'org/repo',
      PR: '631',
      SHA,
      ...env,
    },
  });
  const read = (file: string) => (existsSync(join(dir, file)) ? readFileSync(join(dir, file), 'utf8') : '');
  const calls = read('calls').split('\n').filter(Boolean);
  return {
    code: result.status,
    out: `${result.stdout}${result.stderr}`,
    writes: calls.filter((call) => /-X (PATCH|DELETE)|-f body=/.test(call)).map((call) => call.split(' -f body=')[0]),
    patched: read('patched.md'),
    posted: read('posted.md'),
  };
};

// 1.6.0's runs: the iPhone's passed on its first attempt, and Android's
// passed on its second, after a group's emulator ran out of disk. The iPhone
// screenshots come in two parts, to stay under the 50 MB Chrome checks.
const iosRun = { PLATFORM: 'ios', RUN_ID: '200', RUN_ATTEMPT: '1', CHECKS: 'success' };
const androidRerun = { PLATFORM: 'android', RUN_ID: '100', RUN_ATTEMPT: '2', CHECKS: 'success' };
const api: Api = {
  reviews: [`12 <!-- key-screens-review sha=${SHA} -->`],
  runs: { 'ios-key-screens.yml': '200 1', 'android-key-screens.yml': '100 2' },
  joins: { 200: 'success', 100: 'success' },
  // Whole MB of 1,048,576 bytes, the unit of the 50 MB (52,428,800 bytes) Chrome looks inside.
  artifacts: {
    '200 iphone': '901 25165824\n903 26214400',
    '200 ipad': '904 35651584',
    '200 app-store': '906 25165824',
    '200 app-store-ipad': '910 27262976',
    '200 app': '902 40894464',
    '100 android': '905 29360128',
    '100 android-tablet': '911 11534336',
    '100 google-play': '907 7340032',
    '100 google-play-tablet': '912 31457280',
  },
};
const androidLink =
  '[the Android screenshots](https://github.com/org/repo/actions/runs/100/artifacts/905) (a zip of about 28 MB, from attempt 2 of its run)';
// The Android tablet's (#695), from the same run.
const tabletLink =
  '[the Android tablet screenshots](https://github.com/org/repo/actions/runs/100/artifacts/911) (a zip of about 11 MB, from attempt 2 of its run)';
const iphoneLinks =
  'the iPhone screenshots ([part 1](https://github.com/org/repo/actions/runs/200/artifacts/901), about 24 MB; [part 2](https://github.com/org/repo/actions/runs/200/artifacts/903), about 25 MB)';

describe('refreshing the review comment from the Android run', () => {
  it("updates the commit's comment in place, with the rerun's result and newest screenshots", () => {
    const { code, writes, patched } = postOrRefresh(androidRerun, api);
    expect(code).toBe(0);
    expect(writes).toEqual(['api -X PATCH repos/org/repo/issues/comments/12']);
    expect(patched.startsWith(`<!-- key-screens-review sha=${SHA} -->\n`)).toBe(true);
    expect(patched).toContain('✅ The automatic checks passed on both platforms');
    expect(patched).toContain(androidLink);
    expect(patched).toContain(
      `**Download** ${iphoneLinks}, [the iPad screenshots](https://github.com/org/repo/actions/runs/200/artifacts/904) (a zip of about 34 MB), ${androidLink}, and ${tabletLink}, ` +
        'and open their `screens/ios/` (iPhone), `screens/ipad/`, `screens/android/`, and `screens/android-tablet/` folders.',
    );
    expect(patched).toContain(
      // The iPhone's and the iPad's apart, each under 50 MB (#681).
      'The App Store copies are in [the iPhone download](https://github.com/org/repo/actions/runs/200/artifacts/906) (a zip of about 24 MB), `screens/app-store/`, ' +
        'and [the iPad download](https://github.com/org/repo/actions/runs/200/artifacts/910) (a zip of about 26 MB), `screens/app-store-ipad/`. ' +
        'The Google Play copies are in [theirs](https://github.com/org/repo/actions/runs/100/artifacts/907) (a zip of about 7 MB, from attempt 2 of its run): `screens/google-play/`, ' +
        "and the tablet's in [the tablet download](https://github.com/org/repo/actions/runs/100/artifacts/912) (a zip of about 30 MB, from attempt 2 of its run), `screens/google-play-tablet/`.",
    );
    // The approval is still on the iPhone run.
    expect(patched).toContain('opens [this run](https://github.com/org/repo/actions/runs/200), clicks **Review deployments**');
  });

  it('says which platform failed', () => {
    const { patched } = postOrRefresh({ ...androidRerun, CHECKS: 'failure' }, api);
    expect(patched).toContain('⚠️ **The automatic checks failed or didn\'t finish** (iOS: success, Android: failure).');
  });

  it("leaves the comment to the iPhone run until it's posted, and never touches another commit's", () => {
    const { code, out, writes } = postOrRefresh(androidRerun, {
      ...api,
      reviews: [`11 <!-- key-screens-review pending sha=${SHA} -->`, '10 <!-- key-screens-review sha=0724fc4 -->'],
    });
    expect(code).toBe(0);
    expect(writes).toEqual([]);
    expect(out).toContain(`No review comment for ${SHA} yet.`);
  });

  it('passes quietly if the iPhone run replaced the comment meanwhile', () => {
    const { code, out } = postOrRefresh(androidRerun, { ...api, patchFails: true });
    expect(code).toBe(0);
    expect(out).toContain(`::warning::Couldn't refresh the review comment for ${SHA}.`);
  });
});

describe('posting the review comment from the iPhone run', () => {
  it("replaces the notice and earlier comments, linking Android's newest run", () => {
    const { code, writes, posted } = postOrRefresh(iosRun, {
      ...api,
      reviews: [`11 <!-- key-screens-review pending sha=${SHA} -->`, '10 <!-- key-screens-review sha=0724fc4 -->'],
    });
    expect(code).toBe(0);
    expect(writes).toEqual([
      'api -X DELETE repos/org/repo/issues/comments/11',
      'api -X DELETE repos/org/repo/issues/comments/10',
      'api repos/org/repo/issues/631/comments',
    ]);
    expect(posted).toContain(androidLink);
    expect(posted).toContain('[the iOS Simulator app](https://github.com/org/repo/actions/runs/200/artifacts/902)');
  });

  it("says the Android screenshots aren't ready if its join hasn't finished", () => {
    const { posted } = postOrRefresh(iosRun, { ...api, joins: { 200: 'success', 100: 'not finished' } });
    expect(posted).toContain("the Android screenshots, which aren't ready: [their runs]");
    expect(posted).toContain('(iOS: success, Android: not finished)');
    expect(posted).toContain('`screens/app-store-ipad/`. Each download stays under');
    expect(posted).not.toContain('Google Play copies are in');
    expect(posted).not.toContain('tablet screenshots](');
  });

  it('lists every part, and says which attempt they came from', () => {
    const { posted } = postOrRefresh({ ...iosRun, RUN_ATTEMPT: '2' }, {
      ...api,
      artifacts: { ...api.artifacts, '200 ipad': '904 31457280\n908 31457280\n909 20971520' },
    });
    expect(posted).toContain(
      'the iPad screenshots ([part 1](https://github.com/org/repo/actions/runs/200/artifacts/904), about 30 MB; ' +
        '[part 2](https://github.com/org/repo/actions/runs/200/artifacts/908), about 30 MB; ' +
        '[part 3](https://github.com/org/repo/actions/runs/200/artifacts/909), about 20 MB, from attempt 2 of its run)',
    );
  });

  it('writes the same comment as the Android refresh, once both have finished', () => {
    const posted = postOrRefresh(iosRun, api).posted;
    expect(posted).not.toBe('');
    expect(postOrRefresh(androidRerun, api).patched).toBe(posted);
  });
});

describe('the shared review comment workflow', () => {
  it('is called by both key-screen workflows after their join, with its result', () => {
    const iosCaller = jobOf(ios, 'review-comment');
    const androidCaller = jobOf(android, 'review-comment');
    for (const [caller, platform, join] of [
      [iosCaller, 'ios', 'simulator'],
      [androidCaller, 'android', 'screens'],
    ]) {
      expect(caller).toContain(`needs: ${join}\n`);
      expect(caller).toContain('uses: ./.github/workflows/key-screens-review.yml\n');
      expect(caller).toContain(`      platform: ${platform}\n      checks: \${{ needs.${join}.result }}\n`);
      // Only on the release PR, as the comment and approval are.
      expect(caller).toContain("github.head_ref == 'release-candidate'");
      expect(caller).toContain('github.event.pull_request.head.repo.full_name == github.repository');
      expect(caller).toMatch(/if: >-\n\s+!cancelled\(\) &&/);
    }
    expect(review).toMatch(/\non:\n  workflow_call:\n/);
    // Only the iPhone run waits for the other platform.
    expect(review).toMatch(/- name: Wait for the Android key screens\n(?: +#.*\n)* +if: inputs\.platform == 'ios'\n/);
  });

  it('gets from each caller exactly the permissions it asks for, or GitHub refuses to start the run', () => {
    const permissions = (text: string) =>
      /\n {4}permissions:\n((?: {6}.*\n)+)/.exec(text)![1].split('\n').filter((line) => /^ {6}[a-z-]+:/.test(line)).map((line) => line.trim());
    const asked = permissions(jobOf(review, 'comment'));
    expect(asked).toEqual(['actions: read', 'contents: read', 'pull-requests: write']);
    expect(permissions(jobOf(ios, 'review-comment'))).toEqual(asked);
    expect(permissions(jobOf(android, 'review-comment'))).toEqual(asked);
  });

  it('never runs pull request code or reads a secret, and takes pull request text only through the environment', () => {
    expect(review).not.toMatch(/actions\/checkout|secrets\.|\bnpm |\bnpx |node scripts/);
    for (const script of review.split('run: |').slice(1).map((rest) => rest.split(/\n\s*- (?:name|uses):/)[0])) {
      expect(script).not.toMatch(/\$\{\{/);
    }
    // The callers run no steps of their own.
    expect(jobOf(ios, 'review-comment')).not.toContain('steps:');
    expect(jobOf(android, 'review-comment')).not.toContain('steps:');
  });

  it("links each name's newest unexpired download, which is a rerun's own, every part in order", () => {
    expect(review).toContain(
      '[.artifacts[] | select(.expired | not) | select($3)] | group_by(.name) | map(max_by(.id)) | sort_by(.name)',
    );
    // The names the joins upload (scripts/pack-review-downloads.cjs).
    for (const [variable, run, suffix] of [
      ['iphone', 'ios', 'iphone-[0-9]+'],
      ['ipad', 'ios', 'ipad-[0-9]+'],
      ['app_store', 'ios', 'app-store'],
      ['app_store_ipad', 'ios', 'app-store-ipad'],
      ['android', 'android', 'android-[0-9]+'],
      ['android_tablet', 'android', 'android-tablet-[0-9]+'],
      ['google_play', 'android', 'google-play'],
      ['google_play_tablet', 'android', 'google-play-tablet'],
    ]) {
      expect(review).toContain(
        `${variable}="$(screenshots "$${run}_run" "$${run}_attempt" '.name | test("^${run}-key-screens-(manual|[0-9]+)-[0-9]+-${suffix}$")'`,
      );
    }
    expect(ios).toContain("name: ios-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-iphone-1\n");
    expect(ios).toContain("name: ios-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-ipad-1\n");
    expect(ios).toContain("name: ios-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-app-store\n");
    expect(ios).toContain("name: ios-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-app-store-ipad\n");
    expect(android).toContain("name: android-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-android-1\n");
    expect(android).toContain("name: android-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-google-play\n");
    expect(android).toContain("name: android-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-android-tablet-1\n");
    expect(android).toContain("name: android-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}-google-play-tablet\n");
  });

  it("reads each run's result from its join job, in its newest attempt", () => {
    // join_result and took find the join jobs by name, so renaming one would
    // drop its result or time quietly.
    expect(jobOf(ios, 'simulator')).toContain('name: iOS key screens join');
    expect(jobOf(android, 'screens')).toContain('name: Android key screens join');
    expect(review).toContain(`android_checks=$(join_result "$android_run" 'Android key screens join' || true)`);
    expect(review).toContain(`ios_checks=$(join_result "$ios_run" 'iOS key screens join' || true)`);
    expect(review).toContain('select(.name == "Android key screens join")');
    expect(review).toContain(`ios_took="$(took "$ios_run" 'iOS key screens join')" || ios_took=""`);
    expect(review).toContain(`android_took="$(took "$android_run" 'Android key screens join')" || android_took=""`);
    expect(review).toMatch(/\n\s+\$checks\n\n\s+\$timing\n/);
  });
});
