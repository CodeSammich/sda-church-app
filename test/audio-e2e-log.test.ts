import { logForAudioE2e } from '@/services/AudioE2eLog';

const { existsSync, readFileSync, readdirSync } = require('node:fs');
const { join } = require('node:path');

const withAudioE2eBuild = (value: string | undefined) => {
  if (value === undefined) delete process.env.EXPO_PUBLIC_AUDIO_E2E;
  else process.env.EXPO_PUBLIC_AUDIO_E2E = value;
};

describe("the reader's log for the Android audio e2e (#561)", () => {
  afterEach(() => {
    withAudioE2eBuild(undefined);
    jest.restoreAllMocks();
  });

  it('logs what the reader decided only in the e2e build', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    withAudioE2eBuild(undefined);
    logForAudioE2e('following verse 3');
    expect(log).not.toHaveBeenCalled();
    withAudioE2eBuild('1');
    logForAudioE2e('following verse 3');
    expect(log).toHaveBeenCalledWith('Bible reader: following verse 3');
  });
});

describe('which builds log what the reader decided', () => {
  const root = join(__dirname, '..');
  const workflows = join(root, '.github', 'workflows');

  it("is only the Android audio e2e's emulator build", () => {
    const setters = readdirSync(workflows).filter((name: string) =>
      readFileSync(join(workflows, name), 'utf8').includes('EXPO_PUBLIC_AUDIO_E2E'),
    );
    expect(setters).toEqual(['android-audio-e2e.yml']);
    const workflow = readFileSync(join(workflows, 'android-audio-e2e.yml'), 'utf8');
    const step = workflow.slice(workflow.indexOf('- name: Build the debug APK for the emulator'));
    expect(step.slice(0, step.indexOf('run:'))).toContain("EXPO_PUBLIC_AUDIO_E2E: '1'");
    expect(workflow.match(/EXPO_PUBLIC_AUDIO_E2E: '1'/g)).toHaveLength(1);
  });

  it('isn’t set anywhere a store build could pick it up', () => {
    for (const file of ['app.json', 'package.json', 'eas.json', '.env', '.env.production']) {
      const path = join(root, file);
      if (!existsSync(path)) continue;
      expect({ file, mentions: readFileSync(path, 'utf8').includes('AUDIO_E2E') }).toEqual({ file, mentions: false });
    }
  });

  it('runs the reader scenarios that read it', () => {
    const script = readFileSync(join(root, 'scripts/e2e/android-bible-audio.sh'), 'utf8');
    for (const name of ['verse-follows-audio', 'scroll-by-hand', 'scroll-while-paused', 'follow-after-screen-off']) {
      expect(script).toMatch(new RegExp(`^run ${name} scenario_`, 'm'));
    }
  });
});
