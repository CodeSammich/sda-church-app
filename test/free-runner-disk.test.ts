import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// An emulator needs about 7.4 GB free, and a hosted runner once had 6.4 GB
// (#632), so every job that boots one first removes preinstalled tools it never
// uses, with scripts/free-runner-disk.sh.
const script = resolve(__dirname, '../scripts/free-runner-disk.sh');
const workflows = resolve(__dirname, '../.github/workflows');

// What the jobs use, which must stay.
const used = [
  '/usr/local/lib/android/sdk',
  '/usr/lib/jvm',
  '/opt/hostedtoolcache/node',
  '/opt/hostedtoolcache/Java_Temurin-Hotspot_jdk',
  '/opt/hostedtoolcache/Python',
  '/usr/bin',
];
const unused = ['/usr/share/dotnet', '/usr/local/.ghcup', '/opt/hostedtoolcache/CodeQL', '/usr/share/swift'];

describe('scripts/free-runner-disk.sh', () => {
  it('removes the unused tools and keeps what the jobs use', () => {
    const root = mkdtempSync(join(tmpdir(), 'free-disk-'));
    for (const dir of [...used, ...unused]) {
      mkdirSync(join(root, dir), { recursive: true });
      writeFileSync(join(root, dir, 'file'), 'x');
    }
    // sudo, which the runner needs for these folders, just runs the command here.
    const bin = join(root, 'bin');
    mkdirSync(bin);
    writeFileSync(join(bin, 'sudo'), '#!/usr/bin/env bash\n"$@"\n');
    chmodSync(join(bin, 'sudo'), 0o755);
    const result = spawnSync(script, [], {
      encoding: 'utf8',
      env: { ...process.env, FREE_DISK_ROOT: root, PATH: `${bin}:${process.env.PATH}` },
    });
    expect(result.status).toBe(0);
    for (const dir of unused) expect({ dir, kept: existsSync(join(root, dir)) }).toEqual({ dir, kept: false });
    for (const dir of used) expect({ dir, kept: existsSync(join(root, dir, 'file')) }).toEqual({ dir, kept: true });
    // The free space before and after, for the job's log.
    expect(result.stdout).toMatch(/Free disk space before:\n.*Avail[\s\S]*Free disk space after:\n.*Avail/);
  });

  it('never names the Android SDK, Java, Node, Python, or the whole tool cache', () => {
    const text = readFileSync(script, 'utf8');
    const list = text.slice(text.indexOf('unused=('), text.indexOf(')', text.indexOf('unused=(')));
    expect(list).not.toMatch(/android|jvm|java|node|python|\/opt\/hostedtoolcache\n/i);
  });

  it('runs before each emulator is installed and started', () => {
    const jobs = readdirSync(workflows).flatMap((file) => {
      const workflow = readFileSync(join(workflows, file), 'utf8');
      // The steps of each job that starts an emulator, up to that start.
      return [...workflow.matchAll(/\/emulator\/emulator" -avd/g)].map((match) => ({
        file,
        job: workflow.slice(workflow.lastIndexOf('\n    steps:\n', match.index), match.index),
      }));
    });
    expect(jobs.map(({ file }) => file).sort()).toEqual(['android-audio-e2e.yml', 'android-key-screens.yml']);
    for (const { file, job } of jobs) {
      const free = job.indexOf('run: scripts/free-runner-disk.sh\n');
      expect({ file, free: free > -1 }).toEqual({ file, free: true });
      // Before the system image is downloaded.
      expect({ file, first: free < job.indexOf('scripts/sdkmanager-install.sh') }).toEqual({ file, first: true });
    }
  });
});
