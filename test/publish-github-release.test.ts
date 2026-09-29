import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const SCRIPT = resolve(process.cwd(), 'scripts/publish-github-release.sh');

// A fake `gh` that keeps the release's state in files and logs each call.
const FAKE_GH = `#!/usr/bin/env bash
state="$FAKE_STATE"
echo "$*" >> "$state/calls"
if [ "$1 $2" = "release view" ]; then
  [ -f "$state/exists" ] || exit 1
  case " $* " in *" --json assets "*) cat "$state/assets" 2>/dev/null ;; esac
  exit 0
fi
if [ "$1 $2" = "release create" ]; then
  if [ -n "$FAKE_CREATE_RACES" ]; then touch "$state/exists"; exit 1; fi
  touch "$state/exists"
  for arg in "\${@:4}"; do case "$arg" in --*) break ;; *) basename "$arg" >> "$state/assets" ;; esac; done
  exit 0
fi
if [ "$1 $2" = "release upload" ]; then
  for arg in "\${@:4}"; do case "$arg" in --*) break ;; *)
    name="$(basename "$arg")"
    grep -qxF "$name" "$state/assets" 2>/dev/null && exit 1
    echo "$name" >> "$state/assets" ;;
  esac; done
  exit 0
fi
exit 2
`;

const setup = ({ existing }: { existing?: string[] } = {}) => {
  const dir = mkdtempSync(join(tmpdir(), 'publish-release-'));
  const bin = join(dir, 'bin');
  const state = join(dir, 'state');
  for (const path of [bin, state]) spawnSync('mkdir', ['-p', path]);
  writeFileSync(join(bin, 'gh'), FAKE_GH);
  chmodSync(join(bin, 'gh'), 0o755);
  if (existing) {
    writeFileSync(join(state, 'exists'), '');
    writeFileSync(join(state, 'assets'), existing.map((name) => `${name}\n`).join(''));
  }
  for (const name of ['app.aab', 'app.apk', 'NewYorkChineseSDAChurch.ipa']) {
    writeFileSync(join(dir, name), 'binary');
  }
  const run = (args: string[], extraEnv: Record<string, string> = {}) =>
    spawnSync('bash', [SCRIPT, ...args], {
      cwd: dir,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        FAKE_STATE: state,
        GH_TOKEN: 'token',
        GITHUB_REPOSITORY: 'church/app',
        GITHUB_SHA: 'abc123',
        ...extraEnv,
      },
    });
  const calls = () =>
    existsSync(join(state, 'calls')) ? readFileSync(join(state, 'calls'), 'utf8').trim().split('\n') : [];
  const assets = () =>
    existsSync(join(state, 'assets')) ? readFileSync(join(state, 'assets'), 'utf8').trim().split('\n') : [];
  return { run, calls, assets };
};

const actions = (calls: string[]) => calls.map((call) => call.split(' ').slice(0, 2).join(' '));

describe('publishing to the GitHub Release', () => {
  it('creates the release when it is the first workflow to finish', () => {
    const { run, calls, assets } = setup();
    const result = run(['v0.41.0', 'app.aab', 'app.apk']);
    expect(result.status).toBe(0);
    expect(actions(calls())).toEqual(['release view', 'release create']);
    expect(calls()[1]).toContain('--target abc123');
    expect(calls()[1]).toContain('--latest');
    expect(assets()).toEqual(['app.aab', 'app.apk']);
  });

  it('adds its file when the other workflow already created the release', () => {
    const { run, calls, assets } = setup({ existing: ['app.aab', 'app.apk'] });
    const result = run(['v0.41.0', 'NewYorkChineseSDAChurch.ipa']);
    expect(result.status).toBe(0);
    expect(actions(calls())).toEqual(['release view', 'release view', 'release upload']);
    expect(assets()).toEqual(['app.aab', 'app.apk', 'NewYorkChineseSDAChurch.ipa']);
  });

  it('refuses to replace a binary the release already has', () => {
    const { run, calls, assets } = setup({ existing: ['app.aab', 'app.apk'] });
    const result = run(['v0.41.0', 'app.aab', 'app.apk']);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('The v0.41.0 release already has app.aab. Bump the version');
    expect(actions(calls())).toEqual(['release view', 'release view']);
    expect(assets()).toEqual(['app.aab', 'app.apk']);
  });

  it('adds its files when both workflows create the release at once', () => {
    const { run, calls } = setup();
    const result = run(['v0.41.0', 'NewYorkChineseSDAChurch.ipa'], { FAKE_CREATE_RACES: '1' });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('appeared meanwhile');
    expect(actions(calls())).toEqual(['release view', 'release create', 'release upload']);
  });

  it('explains how to call it', () => {
    const { run } = setup();
    expect(run(['v0.41.0']).status).toBe(1);
    expect(run([]).stderr).toContain('Usage:');
  });
});
