import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { mergeResults } = require('../scripts/merge-key-screens.cjs');
const {
  shotCost,
  takeGroup,
  settledAfter,
  SETTING_KEYS,
  loadConfig,
  planCaptures,
  buildManifest,
  planAppStore,
  planStoreCopies,
  writeAppStoreCopy,
  manifestPath,
  statusBarClear,
  looksBlank,
  looksLikeSplash,
  takeFinalShot,
  differingFraction,
  relaunchLines,
  LAUNCHES,
  STILL_FRACTION,
  STILL_RETRIES,
} = require('../scripts/capture-ios-screens.cjs');

const repoFile = (path: string) => readFileSync(resolve(__dirname, '..', path), 'utf8');
const config = loadConfig();
const shots = planCaptures(config);

describe('key screen list (test/screens/screens.json)', () => {
  it('names every screen once, with at least one known variant', () => {
    const names = config.screens.map((screen: { name: string }) => screen.name);
    expect(new Set(names).size).toBe(names.length);
    for (const screen of config.screens) {
      expect(screen.name).toMatch(/^[a-z0-9-]+$/);
      expect(screen.variants.length).toBeGreaterThan(0);
      for (const variant of screen.variants) expect(config.variants).toHaveProperty(variant);
    }
  });

  it('leaves out screens that show members’ names or photos', () => {
    // The repository and its pull requests are public.
    for (const screen of config.screens) {
      expect(screen.path).not.toMatch(/bulletin|team|fellowship|worship/);
    }
  });

  it('reproduces the iPhone bugs fixed in 0.42.0', () => {
    const names = shots.map((shot: { name: string }) => shot.name);
    // Three-digit verse numbers at the largest text size, text scrolled under
    // the status bar, and the header with two translations and a back arrow.
    expect(names).toEqual(
      expect.arrayContaining(['bible-long-chapter-xl', 'bible-scrolled-default', 'bible-dual-back-large']),
    );
    const scrolled = shots.find((shot: { name: string }) => shot.name === 'bible-scrolled-default');
    expect(scrolled.checks).toContain('statusBarClear');
    expect(scrolled.url).toContain('verseStart=14');
  });

  it('only uses checks the script knows', () => {
    for (const shot of shots) for (const check of shot.checks) expect(check).toBe('statusBarClear');
  });

  it('gives every shot a stable, unique file name', () => {
    const files = shots.map((shot: { file: string }) => shot.file);
    expect(new Set(files).size).toBe(files.length);
    expect(files).toContain('ios/home-default.png');
    expect(files).toContain('ios/bible-dual-large.png');
    expect(files).toContain('ios/library-es.png');
  });

  it('opens each screen with the app’s deep link scheme', () => {
    const scheme = JSON.parse(repoFile('app.json')).expo.scheme;
    for (const shot of shots) expect(shot.url.startsWith(`${scheme}://`)).toBe(true);
    expect(shots.find((shot: { file: string }) => shot.file === 'ios/explore-default.png').url).toBe(
      'sdachurchapp://explore',
    );
  });

  it('checks Bible audio and Quick Look on the iPhone only, in worship-and-you, with records the capture knows (#551)', () => {
    const { RECORDS } = require('../scripts/key-screen-records.cjs');
    const recorded = config.screens.filter((screen: { record?: string }) => screen.record);
    expect(recorded.map((screen: { name: string }) => screen.name).sort()).toEqual([
      'bible-audio-playing',
      'sabbath-school-lesson-viewer',
    ]);
    for (const screen of recorded) {
      expect(RECORDS).toHaveProperty(screen.record);
      // Android checks its audio in android-audio-e2e.yml.
      expect(screen.platforms).toEqual(['ios']);
      expect(screen.group).toBe('worship-and-you');
    }
    const playing = config.screens.find((screen: { name: string }) => screen.name === 'bible-audio-playing');
    expect(playing.path).toMatch(/^bible\?.*&play=1$/);
    expect(planCaptures(config, 'android').some((shot: { record?: string }) => shot.record)).toBe(false);
    // Its later shot, and the time it usually takes to start, count in its group's time.
    const shot = shots.find((each: { name: string }) => each.name === 'bible-audio-playing-default');
    expect(shotCost(shot)).toBe(shot.wait + RECORDS[shot.record].typical + 10 + 5);
    const lesson = shots.find((each: { name: string }) => each.name === 'sabbath-school-lesson-viewer-default');
    expect(shotCost(lesson)).toBe(lesson.wait + RECORDS[lesson.record].typical + 5);
  });

  it('opens only popups the screen can open from its path (#372)', () => {
    const screenFiles: Record<string, string> = {
      bible: 'app/(tabs)/bible/index.tsx',
      'home/give': 'app/(tabs)/home/give.tsx',
      'sabbath-school': 'app/(tabs)/explore/sabbath-school.tsx',
      you: 'app/(tabs)/you/index.tsx',
      // The route shows the component, which reads the path.
      'you/audio-downloads': 'components/OfflineBibleAudio.tsx',
    };
    const popups = config.screens.filter((screen: { path: string }) => /[?&]popup=/.test(screen.path));
    expect(popups.length).toBeGreaterThan(0);
    for (const screen of popups) {
      const [route, query] = screen.path.split('?');
      const popup = new URLSearchParams(query).get('popup');
      const source = repoFile(screenFiles[route]);
      expect({ path: screen.path, opens: new RegExp(`getScreenshotPopup\\([^)]*'${popup}'`).test(source) }).toEqual({
        path: screen.path,
        opens: true,
      });
    }
  });
});

describe('App Store shots', () => {
  const copies = planAppStore(config);

  it('numbers each language’s shots in upload order', () => {
    // Home first: the first three show on the App Store's install sheets.
    expect(copies[0]).toEqual({
      name: 'home-default',
      platform: 'ios',
      source: 'ios/home-default.png',
      file: 'app-store/en-US/01-home-default.png',
    });
    expect(copies.map((copy: { file: string }) => copy.file)).toContain('app-store/zh-Hant/01-home-zh.png');
    // Chinese hears Cantonese right after Home, with pinyin still in the first three,
    // then Mandarin in Simplified characters and its own dark-mode shot.
    expect(copies.filter((copy: { file: string }) => copy.file.startsWith('app-store/zh-Hant/')).map(
      (copy: { file: string }) => copy.file.replace('app-store/zh-Hant/', ''),
    )).toEqual([
      '01-home-zh.png',
      '02-bible-cuv-cantonese-zh.png',
      '03-bible-pinyin-zh.png',
      '04-explore-zh.png',
      '05-library-zh.png',
      '06-bible-cuvs-zh-cn.png',
      '07-bible-cuv-zh-dark.png',
    ]);
  });

  it('only names shots that are captured, up to the App Store’s ten', () => {
    const names = new Set(shots.map((shot: { name: string }) => shot.name));
    for (const copy of copies) expect(names.has(copy.name)).toBe(true);
    for (const list of Object.values(config.appStore) as string[][]) {
      expect(list.length).toBeGreaterThanOrEqual(3);
      expect(list.length).toBeLessThanOrEqual(10);
    }
  });
});

describe('saved settings', () => {
  it('uses storage keys the app still reads', () => {
    const sources = [
      'app/_layout.tsx',
      'app/(tabs)/bible/index.tsx',
      'services/BibleAudioSources.ts',
      'services/BibleService.ts',
      'constants/Themes.ts',
      'constants/AppPreferences.ts',
    ]
      .map(repoFile)
      .join('\n');
    for (const key of Object.values(SETTING_KEYS)) expect(sources).toContain(`'${key}'`);
  });

  it('saves the screen to open, where the app looks for it, except for Home', () => {
    const { SCREENSHOT_ROUTE_KEY } = require('../services/ScreenshotRoute');
    const explore = shots.find((shot: { name: string }) => shot.name === 'explore-default');
    expect(buildManifest(explore.settings, explore.route)[SCREENSHOT_ROUTE_KEY]).toBe('explore');
    const home = shots.find((shot: { name: string }) => shot.name === 'home-default');
    expect(buildManifest(home.settings, home.route)).not.toHaveProperty(SCREENSHOT_ROUTE_KEY);
    expect(repoFile('app/_layout.tsx')).toContain('takeScreenshotRoute()');
  });

  it('skips setup, except on its own shots, and fixes the language, theme, and text size for every shot', () => {
    for (const shot of shots) {
      const manifest = buildManifest(shot.settings);
      // First-launch setup's own shots (#523) leave it to show.
      const setupShot = /\/setup-[^/]+\.png$/.test(shot.file);
      expect([shot.file, manifest['has-completed-setup']]).toEqual([shot.file, setupShot ? 'false' : 'true']);
      expect(manifest['user-language']).toMatch(/^(en|zh|zh-cn|es)$/);
      expect(manifest['user-theme']).toMatch(/^(light|dark)$/);
      expect(Number(manifest['user-text-scale'])).toBeGreaterThanOrEqual(1);
    }
  });

  it('applies the variant on top of the screen’s own settings', () => {
    const shot = shots.find((candidate: { file: string }) => candidate.file === 'ios/bible-pinyin-zh.png');
    expect(buildManifest(shot.settings)).toEqual({
      'has-completed-setup': 'true',
      'user-language': 'zh',
      'user-theme': 'light',
      'user-text-scale': '1',
      'user-bible-dual-language': 'true',
      'user-bible-supporting-translation': 'BSB',
      'user-bible-show-pinyin': 'true',
    });
    const large = shots.find((candidate: { file: string }) => candidate.file === 'ios/bible-dual-large.png');
    expect(buildManifest(large.settings)['user-text-scale']).toBe('1.5');
  });

  it('turns off dual-language reading and pinyin for the single-translation shot', () => {
    // The Bible reader treats a missing value as on.
    const shot = shots.find((candidate: { file: string }) => candidate.file === 'ios/bible-default.png');
    const manifest = buildManifest(shot.settings);
    expect(manifest['user-bible-dual-language']).toBe('false');
    expect(manifest['user-bible-show-pinyin']).toBe('false');
  });

  it('keeps the iPhone’s own text size out of the app’s storage', () => {
    const shot = shots.find((candidate: { name: string }) => candidate.name === 'bible-dual-ios-large-text');
    expect(shot.settings.iosTextSize).toBe('accessibility-large');
    expect(Object.values(buildManifest(shot.settings))).not.toContain('accessibility-large');
  });

  it('saves a chosen narrator the way the Bible reader reads it', () => {
    const { CANTONESE_CUV_READER, getAudioReaderPreferenceKey } = require('../services/BibleAudioSources');
    const shot = shots.find((candidate: { name: string }) => candidate.name === 'bible-cuv-cantonese-zh');
    expect(JSON.parse(buildManifest(shot.settings)['user-bible-audio-readers'])).toEqual({
      [getAudioReaderPreferenceKey('cmn_cuv')]: CANTONESE_CUV_READER,
    });
  });

  it('rejects a setting it has no storage key for', () => {
    expect(() => buildManifest({ fontSize: 2 })).toThrow('Unknown setting "fontSize"');
  });

  it('writes where AsyncStorage keeps short values on iOS', () => {
    expect(manifestPath('/data', 'org.nyccsda.app')).toBe(
      '/data/Library/Application Support/org.nyccsda.app/RCTAsyncLocalStorage_V1/manifest.json',
    );
  });
});

describe('iOS key screens', () => {
  const workflow = repoFile('.github/workflows/ios-key-screens.yml');

  it('runs one runner per group, each capturing and checking only its group, on the iPhone and then the iPad', () => {
    const groups = /\n\s+group: \[([a-z, -]+)\]\n/.exec(workflow)![1].split(', ');
    expect(groups).toEqual(Object.keys(config.groups));
    // Five jobs for five Macs, so none waits for one while the others wait
    // for the compiling runner's app; no sixth runner for the iPad (#324).
    expect(groups).toHaveLength(5);
    expect(workflow).not.toContain('ipad: true');
    expect(workflow).toMatch(/strategy:\n\s+fail-fast: false\n(?:\s+#.*\n)*\s+max-parallel: 5\n/);
    expect(workflow).toMatch(/capture-ios-screens\.cjs --out [^\n]+\n\s+--group \$\{\{ matrix\.group \}\}\n/);
    expect(workflow).toMatch(/check-screens\.cjs --dir [^\n]+\n\s+--group \$\{\{ matrix\.group \}\}\n/);
    // Then the group's iPad shots, into a part of their own, checked against
    // the iPad's positions and layout, and uploaded beside the iPhone's.
    expect(workflow).toContain('capture-ios-screens.cjs --platform ipad --group ${{ matrix.group }}');
    expect(workflow).toMatch(/check-screens\.cjs --dir "\$RUNNER_TEMP\/ipad-part\/screens"\n\s+--platform ipad --group \$\{\{ matrix\.group \}\}\n/);
    expect(workflow).toContain('name: key-screens-${{ github.run_id }}-${{ matrix.group }}-ipad');
    expect(workflow).toContain('pattern: key-screens-${{ github.run_id }}-*');
    // The iPhone shuts down first, so the iPad has its memory.
    const ipadStep = workflow.slice(workflow.indexOf('- name: Capture the key screens on the iPad'));
    expect(ipadStep.indexOf('xcrun simctl shutdown "$DEVICE_ID"')).toBeLessThan(ipadStep.indexOf('capture-ios-screens.cjs'));
    expect(workflow.indexOf('- name: Capture the key screens on the iPad')).toBeGreaterThan(
      workflow.indexOf('- name: Upload this group\n'),
    );
    expect(workflow).toContain('capture-ios-screens.cjs --platform ipad --pick-device');
  });

  it('compiles the app once, on the lightest group\'s runner, and the others wait for it', () => {
    const builder = /- \{ group: ([a-z-]+), batch: \d+, builds: true \}\n/.exec(workflow)![1];
    expect(workflow.match(/builds: true/g)).toHaveLength(1);
    // The builder also takes its own shots after compiling, so it gets the
    // lightest group.
    const cost = (group: string) =>
      takeGroup(shots, group, config).reduce((sum: number, shot: any) => sum + shotCost(shot), 0);
    for (const group of Object.keys(config.groups)) expect(cost(builder)).toBeLessThanOrEqual(cost(group));
    const guard = (step: string) => new RegExp(`- name: ${step}\n(?: +#.*\n)* +if: (.+)\n`).exec(workflow)?.[1];
    for (const step of [
      'Set up the compile cache',
      'Restore the compile cache from main',
      "Count only this build's compile-cache hits",
      'Generate iOS project',
      'Install CocoaPods dependencies',
      'Build for the Simulator without signing',
      'Zip the app to share',
      'Share the app with the other runners',
    ]) {
      expect({ step, guard: guard(step) }).toEqual({ step, guard: '${{ matrix.builds }}' });
    }
    for (const step of ['Wait for the shared app', 'Download the shared app', 'Unpack the shared app']) {
      expect({ step, guard: guard(step) }).toEqual({ step, guard: '${{ !matrix.builds }}' });
    }
    // The others stop waiting as soon as the builder's job ends without the app.
    const batch = Object.keys(config.groups).indexOf(builder) + 1;
    expect(workflow).toContain(`select(.name == "iOS key screens batch ${batch} (${builder})")`);
    expect(workflow.match(/ios-simulator-app-\$\{\{ github\.run_id \}\}/g)).toHaveLength(2);
  });

  it('boots the compiling runner\'s iPhone after its build when it restored a compile cache', () => {
    const boot = workflow.slice(workflow.indexOf('- name: Boot the simulated iPhone in the background'));
    // Every other runner boots while it waits; the compiling one boots
    // alongside its build only when there was no cache to restore.
    expect(boot).toContain(
      "BOOT_NOW: ${{ !matrix.builds || steps.compile-cache.outputs.cache-matched-key == '' }}\n",
    );
    expect(workflow).toMatch(/- name: Restore the compile cache from main\n\s+if: .+\n\s+id: compile-cache\n/);
    expect(workflow.indexOf('id: compile-cache')).toBeLessThan(workflow.indexOf('BOOT_NOW:'));
    expect(boot).toMatch(
      /if \[ "\$BOOT_NOW" = true \]; then\n\s+nohup xcrun simctl bootstatus "\$DEVICE_ID" -b [^\n]+&\n/,
    );
    // The iPhone, and the iPad for the group's iPad shots, boot together.
    // Not on the compiling runner, which boots its iPad after its iPhone shots.
    expect(boot).toContain('BOOT_IPAD: ${{ !matrix.builds }}\n');
    // Its first boot, slow, while the runner waits, then off until its shots,
    // so it doesn't slow the iPhone's: the launch step waits for that.
    expect(boot).toContain(
      `nohup sh -c 'xcrun simctl bootstatus "$1" -b && xcrun simctl shutdown "$1"' sh "$IPAD_ID"`,
    );
    expect(boot).toContain('echo "$!" > "$RUNNER_TEMP/ipad-boot.pid"');
    const launchStep = workflow.slice(workflow.indexOf('- name: Launch on a simulated iPhone'));
    expect(launchStep.indexOf('while kill -0 "$(cat "$RUNNER_TEMP/ipad-boot.pid")"')).toBeGreaterThan(-1);
    expect(launchStep.indexOf('while kill -0')).toBeLessThan(launchStep.indexOf('xcrun simctl launch'));
    expect(workflow.match(/nohup xcrun simctl bootstatus/g)).toHaveLength(1);
    // The launch step, after the build, boots it or waits for it.
    const launch = workflow.slice(workflow.indexOf('- name: Launch on a simulated iPhone'));
    expect(launch.indexOf('xcrun simctl bootstatus "$DEVICE_ID" -b\n')).toBeGreaterThan(-1);
    expect(workflow.indexOf('- name: Launch on a simulated iPhone')).toBeGreaterThan(
      workflow.indexOf('- name: Build for the Simulator without signing'),
    );
  });

  it('joins the groups in the required job, which fails rather than skips when a group fails', () => {
    const merge = workflow.slice(workflow.indexOf('\n  simulator:\n'), workflow.indexOf('\n  announce:\n'));
    expect(merge).toContain('name: iOS key screens join');
    expect(merge).toContain('needs: capture');
    // A skipped required check counts as passed, so this job must still run
    // after a failed part, and then fail.
    expect(merge).toMatch(/if: >-\n\s+!cancelled\(\) && \(/);
    expect(merge).toContain("needs.capture.result != 'success'");
    expect(merge).toContain('node scripts/merge-key-screens.cjs --platform ios,ipad --out');
    // Two downloads: the screenshots alone, which the review comment links,
    // and the Simulator app. Chrome's Safe Browsing blocked the screenshots
    // while they shared a zip with the unsigned app.
    expect(merge).toContain(
      "name: ios-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}\n",
    );
    expect(merge).toMatch(/name: ios-pr-preview-.*-arm64\n/);
    expect(merge).toContain('--out "$SCREENS_OUT/screens"');
    expect(merge).toMatch(/-name '\*-simulator\.zip' .*\n\s+-exec cp \{\} "\$APP_OUT\/"/);
  });

  it('links only the screenshots in the review comment, and offers the app separately', () => {
    // key-screens-review.yml writes the comment for this workflow.
    const comment = repoFile('.github/workflows/key-screens-review.yml');
    expect(comment).toContain(
      `download="$(screenshots "$ios_run" "$ios_attempt" '.name | test("^ios-key-screens-(manual|[0-9]+)-[0-9]+$")' 'the iPhone screenshots')"`,
    );
    expect(comment).toContain(`app="$(screenshots "$ios_run" "$ios_attempt" '.name | endswith("-arm64")' 'the iPhone Simulator app')"`);
  });

  it('re-checks an earlier run from its screenshots, or from the app download of runs before the split', () => {
    // In its own workflow, started only by hand, so it never shows on pull
    // requests as a skipped check.
    const recheck = repoFile('.github/workflows/key-screens-recheck.yml');
    const earlier = recheck.slice(recheck.indexOf('\n  ios:\n'));
    expect(earlier).toContain("if: inputs.platform == 'ios'");
    expect(earlier).toContain('runs-on: macos-26');
    expect(earlier).toContain('node scripts/check-screens.cjs --dir "$SCREENS"\n');
    expect(workflow).not.toMatch(/screens_from_run|earlier-screens/);
    expect(earlier).toMatch(
      /--pattern 'ios-key-screens-\*' --dir "\$RUNNER_TEMP\/earlier" \|\|\n\s+gh run download [^\n]+--pattern 'ios-pr-preview-\*-arm64'/,
    );
  });

  it('reads no secrets and keeps a read-only token', () => {
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).toMatch(/permissions:\n\s+contents: read\n/);
  });
});

describe('key-screen groups', () => {
  it('puts every screen in a group that says what it holds, at most five groups', () => {
    // GitHub's free plan runs five Mac jobs at once, one per group.
    expect(Object.keys(config.groups).length).toBeLessThanOrEqual(5);
    for (const [group, holds] of Object.entries(config.groups)) {
      expect(holds).toMatch(/^[A-Z].{20,}\.$/);
      expect(shots.some((shot: { group: string }) => shot.group === group)).toBe(true);
    }
    for (const screen of config.screens) {
      expect({ screen: screen.name, known: Object.hasOwn(config.groups, screen.group) }).toEqual({
        screen: screen.name,
        known: true,
      });
    }
  });

  it('flags a group over 6 minutes of capture, as a reminder to prune its screenshots', () => {
    // The 6-minute limit is a reminder, not a rule. When a group passes it,
    // first prune: drop variants that repeat what another shot already shows
    // (say, a dark or Chinese copy of a screen whose layout doesn't change),
    // and screens no longer worth a check. Then spend the time saved on what
    // the key screens miss: screens, popups, and states no shot covers yet
    // (#456). Only then move some related screens to a lighter group,
    // or split one. If a group is still over after that, raise the limit;
    // don't cut useful screenshots to fit it.
    for (const group of Object.keys(config.groups)) {
      const seconds = takeGroup(shots, group, config).reduce((sum: number, shot: any) => sum + shotCost(shot), 0);
      expect({ group, minutes: Math.round(seconds / 6) / 10, over: seconds > 360 }).toMatchObject({ group, over: false });
    }
  });

  it('takes one group, every shot without one, and rejects an unknown group', () => {
    expect(takeGroup(shots, 'bible-reading', config).every((shot: { group: string }) => shot.group === 'bible-reading')).toBe(true);
    expect(takeGroup(shots, undefined, config)).toBe(shots);
    expect(() => takeGroup(shots, 'bibel', config)).toThrow('No group "bibel"');
  });

  it('joins the groups\' results in list order, flagging a shot no group checked', () => {
    const [a, b, c] = shots;
    const merged = mergeResults(
      [a, b, c],
      [
        {
          checks: [{ file: c.file, problems: [] }, { file: a.file, problems: ['x'] }],
          timings: [{ shot: c.name, file: c.file, settledAfter: 4 }],
          ocr: { [`/Users/runner/work/_temp/ios-pr-preview/screens/${a.file}`]: [{ text: 'A' }] },
        },
        { checks: [], timings: [{ shot: a.name, file: a.file, settledAfter: 2 }], ocr: {} },
      ],
    );
    expect(merged.checks).toEqual([
      { file: a.file, problems: ['x'] },
      { file: b.file, problems: ['no group checked it'] },
      { file: c.file, problems: [] },
    ]);
    expect(merged.timings.map((timing: { shot: string }) => timing.shot)).toEqual([a.name, c.name]);
    expect(merged.ocr).toEqual({ [a.file]: [{ text: 'A' }] });
  });
});

describe('settle times', () => {
  const samples = (sames: boolean[]) => sames.map((same, index) => ({ seconds: index + 1, same }));

  it('is the earliest sample from which every later one matched the final shot', () => {
    expect(settledAfter(samples([false, false, true, true, true]), 6)).toBe(3);
    expect(settledAfter(samples([true, true, true]), 4)).toBe(1);
  });

  it('ignores a sample that matched only before the screen changed again', () => {
    expect(settledAfter(samples([true, false, true, true]), 5)).toBe(3);
  });

  it('is the final shot when even the last sample differed', () => {
    expect(settledAfter(samples([false, true, false]), 10)).toBe(10);
    expect(settledAfter([], 10)).toBe(10);
  });
});

describe('status bar check', () => {
  const sharp = require('sharp');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'screens-'));

  // A 1320 × 2868 screenshot with the given overlays: a clock and status icons
  // always, and optionally the Dynamic Island or text behind the status bar.
  const screenshot = async (name: string, extras: { island?: boolean; textAt?: number }) => {
    const file = join(dir, `${name}.png`);
    const box = (left: number, top: number, width: number, height: number, fill = '#111') => ({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`),
      left,
      top,
    });
    const overlays = [box(196, 60, 104, 60), box(940, 70, 260, 50)];
    if (extras.island) overlays.push(box(472, 42, 380, 110, '#000'));
    // A line of text 30 px tall, broken into words, starting at textAt.
    if (extras.textAt !== undefined) {
      for (let left = 80; left < 1240; left += 140) overlays.push(box(left, extras.textAt, 100, 30, '#222'));
    }
    await sharp({ create: { width: 1320, height: 2868, channels: 3, background: '#f3e6df' } })
      .composite(overlays)
      .png()
      .toFile(file);
    return file;
  };

  it('passes with only the clock, icons, and Dynamic Island on a plain backdrop', async () => {
    expect(await statusBarClear(await screenshot('island', { island: true }))).toBe(true);
  });

  it('fails when text shows through behind the status bar', async () => {
    expect(await statusBarClear(await screenshot('under-icons', { island: true, textAt: 158 }))).toBe(false);
    expect(await statusBarClear(await screenshot('beside-clock', { island: true, textAt: 80 }))).toBe(false);
  });

  it('ignores text that starts below the status bar', async () => {
    expect(await statusBarClear(await screenshot('below', { island: true, textAt: 190 }))).toBe(true);
  });
});

describe('splash check', () => {
  const sharp = require('sharp');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'splash-'));

  // A 1320 × 2868 screenshot: a background, a status bar, and a centred logo,
  // plus optional bands of content.
  const screenshot = async (name: string, background: string, contentBands: number[] = []) => {
    const file = join(dir, `${name}.png`);
    const box = (left: number, top: number, width: number, height: number, fill: string) => ({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`),
      left,
      top,
    });
    const overlays = [box(196, 60, 104, 60, '#fff'), box(560, 1320, 220, 200, '#fff')];
    for (const top of contentBands) overlays.push(box(80, top, 1160, 60, '#222'));
    await sharp({ create: { width: 1320, height: 2868, channels: 3, background } })
      .composite(overlays)
      .png()
      .toFile(file);
    return file;
  };

  it('recognizes the splash blue with the church symbol in its middle', async () => {
    const file = await screenshot('splash', '#00405C');
    expect(await looksBlank(file)).toBe(false);
    expect(await looksLikeSplash(file)).toBe(true);
  });

  it("doesn't mistake an app screen for the splash", async () => {
    expect(await looksLikeSplash(await screenshot('light', '#f3e6df'))).toBe(false);
    expect(await looksLikeSplash(await screenshot('dark', '#171b1c'))).toBe(false);
    // The splash colour with content in it, such as a header in the same blue.
    expect(await looksLikeSplash(await screenshot('content', '#00405C', [700, 2200]))).toBe(false);
  });
});

describe('iPad layout checks (#324)', () => {
  const {
    CONTENT_MAX_WIDTH,
    DEFAULT_TEXT_SCALE,
    POPUP_MAX_WIDTH,
    POPUP_SURFACE,
    TABLET_TEXT_SCALE,
    checkIpadLayout,
    checkPopupWidth,
    columnEdges,
    planChecks,
    surfaceWidth,
  } = require('../scripts/check-screens.cjs');
  const { IPAD_APP_STORE_SIZE } = require('../scripts/capture-ios-screens.cjs');
  const ipadChecks = planChecks(config, 'ipad');
  const shot = (name: string) => ipadChecks.find((each: { name: string }) => each.name === name);
  const line = (text: string, left: number, right: number, top: number) => ({ text, box: [left, top, right - left, 0.02] });

  it("expects the app's own sizes: the column, a tablet's text, a popup's width, and its surface", () => {
    expect(CONTENT_MAX_WIDTH).toBe(require('../constants/Layout').CONTENT_MAX_WIDTH);
    const preferences = require('../constants/AppPreferences');
    expect(DEFAULT_TEXT_SCALE).toBe(preferences.DEFAULT_TEXT_SCALE);
    expect(TABLET_TEXT_SCALE).toBe(preferences.TABLET_DEFAULT_TEXT_SCALE);
    expect(POPUP_MAX_WIDTH).toBe(require('../styles/PopupStyles').POPUP_MAX_WIDTH);
    // The light theme's canvas, which every popup's surface is (getPopupSurfaceStyle).
    const canvas = require('../constants/Themes').customLightTheme.colors.background.slice(1);
    expect(POPUP_SURFACE).toEqual([0, 2, 4].map((at) => parseInt(canvas.slice(at, at + 2), 16)));
    // The 13-inch iPad's points, at 2 pixels each, are its screenshots' size.
    expect([config.ipad.points.width * 2, config.ipad.points.height * 2]).toEqual([
      IPAD_APP_STORE_SIZE.width,
      IPAD_APP_STORE_SIZE.height,
    ]);
  });

  it('expects the column 864 points wide at 150%, wider at 200%, and skips a larger iPad text size', () => {
    const [left, right] = columnEdges(shot('home-landscape'));
    expect(right - left).toBeCloseTo(864 / 1376, 3);
    expect(left).toBeCloseTo((1 - 864 / 1376) / 2, 3);
    expect(columnEdges(shot('home-default'))[1] - columnEdges(shot('home-default'))[0]).toBeCloseTo(864 / 1032, 3);
    const [wideLeft, wideRight] = columnEdges(shot('home-landscape-xl'));
    expect(wideRight - wideLeft).toBeCloseTo(1152 / 1376, 3);
    expect(columnEdges(shot('bible-dual-ios-large-text'))).toBeNull();
  });

  it('fails text outside the column below the header, and text at the edge, but not the header or tab bar', () => {
    const home = shot('home-landscape');
    const ok = [
      line('Today\'s Verse', 0.2, 0.6, 0.4),
      // The Bible's header buttons and the tab bar span the screen.
      line('BSB', 0.85, 0.98, 0.04),
      line('Home', 0.1, 0.2, 0.95),
    ];
    expect(checkIpadLayout(home, ok)).toEqual([]);
    const outside = checkIpadLayout(home, [...ok, line('Read Verse', 0.1, 0.3, 0.5)]);
    expect(outside).toHaveLength(1);
    expect(outside[0]).toMatch(/^text outside the content column, 19% to 81% of the way across: "Read Verse" at 10% to 30%/);
    expect(checkIpadLayout(home, [line('Psalm 23', 0.001, 0.2, 0.5)])).toEqual(
      expect.arrayContaining([expect.stringMatching(/^text at the screen's edge, likely cut off: "Psalm 23"/)]),
    );
    // Not the status bar's clock, near the edge on purpose, nor the window's
    // resize grip in the corner, which Vision reads as "/".
    expect(checkIpadLayout(home, [line('9:41 AM', 0.002, 0.1, 0.007)])).toEqual([]);
    expect(checkIpadLayout(home, [line('/', 0.98, 0.999, 0.973)])).toEqual([]);
    // Nor a screen that shows a web page or Quick Look, wide on purpose.
    expect(checkIpadLayout(shot('sabbath-school-lesson-viewer-landscape'), [line('Beginner', 0.001, 0.9, 0.5)])).toEqual([]);
    // Nor an iPhone shot.
    expect(checkIpadLayout(shots[0], [line('Welcome', 0.001, 0.999, 0.5)])).toEqual([]);
  });

  // A screen of the dimmed page's colour with a popup's surface, `wide` of
  // its width, centred, and a line of text across it.
  const popupImage = async (file: string, wide: number, size = { width: 688, height: 516 }) => {
    const sharp = require('sharp');
    const surface = Math.round(size.width * wide);
    const text = await sharp({ create: { width: Math.round(surface * 0.6), height: 8, channels: 3, background: { r: 30, g: 30, b: 30 } } }).png().toBuffer();
    const popup = await sharp({ create: { width: surface, height: Math.round(size.height * 0.4), channels: 3, background: { r: POPUP_SURFACE[0], g: POPUP_SURFACE[1], b: POPUP_SURFACE[2] } } })
      .composite([{ input: text, top: 40, left: Math.round(surface * 0.2) }])
      .png()
      .toBuffer();
    await sharp({ create: { ...size, channels: 3, background: { r: 166, g: 158, b: 154 } } })
      .composite([{ input: popup, top: Math.round(size.height * 0.3), left: Math.round((size.width - surface) / 2) }])
      .png()
      .toFile(file);
  };

  it("measures a popup's surface, and fails one wider than 560 points, as a percentage width made it", async () => {
    const { mkdtempSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const dir = mkdtempSync(resolve(tmpdir(), 'popup-'));
    const right = resolve(dir, 'right.png');
    const wide = resolve(dir, 'wide.png');
    await popupImage(right, 560 / 1376);
    await popupImage(wide, 0.9);
    expect(await surfaceWidth(right)).toBeCloseTo(560 / 1376, 2);
    expect(await surfaceWidth(wide)).toBeCloseTo(0.9, 2);
    const textSize = shot('text-size-landscape');
    expect(await checkPopupWidth(textSize, right)).toEqual([]);
    expect(await checkPopupWidth(textSize, wide)).toEqual(['the popup is about 1238 points wide, more than 560']);
    // A page with no popup is one colour edge to edge.
    expect(await checkPopupWidth(shot('home-landscape'), wide)).toEqual([]);
    // Setup's popup has no popup= in its path, so the list marks it.
    expect(await checkPopupWidth(shot('setup-landscape'), wide)).toHaveLength(1);
    expect(await checkPopupWidth(shot('offline-bible-audio-narrator-landscape'), wide)).toHaveLength(1);
  });
});

describe("Android shots at an iPad's split windows (#324)", () => {
  const { planSplitCaptures } = require('../scripts/capture-ios-screens.cjs');
  const { checkIpadLayout, checkShot, planSplitChecks, splitRegions } = require('../scripts/check-screens.cjs');
  const { deviceFor } = require('../scripts/capture-android-screens.cjs');
  const widths = config.android.splitWindows.map((window: { width: number }) => window.width);

  it('takes the screens a wide screen changes most, at 150%, at Slide Over and Split View widths', () => {
    expect(widths).toEqual([320, 504, 678, 981]);
    const portrait = config.screens.filter((screen: { ipadVariants: string[] }) => screen.ipadVariants.includes('default'));
    for (const width of widths) {
      const split = planSplitCaptures(config, width);
      expect(split.map((shot: { screen: string }) => shot.screen)).toEqual(portrait.map((screen: { name: string }) => screen.name));
      for (const shot of split) {
        expect(shot.file).toBe(`android/${shot.screen}-w${width}.png`);
        expect(shot.settings.textScale).toBe(1.5);
      }
      // An emulator that size, in points at 2x.
      const window = config.android.splitWindows.find((each: { width: number }) => each.width === width);
      expect(deviceFor(config, { split: width })).toMatchObject({ width: width * 2, height: window.height * 2, density: 320 });
    }
    expect(() => planSplitCaptures(config, 700)).toThrow('No split window 700 points wide');
    expect(deviceFor(config, {})).toBe(config.android.phone);
  });

  it('checks the tab labels where a split window puts them, and the column only where the window is wider', () => {
    const home = planSplitChecks(config, 981).find((shot: { screen: string }) => shot.screen === 'home');
    const tabs = splitRegions(home.split).tabs;
    // The tab labels sit about 58 points up from the bottom.
    expect(tabs[0]).toBeLessThan(1 - 58 / 1024);
    expect(tabs[1]).toBeGreaterThan(1 - 58 / 1024);
    const labels = ['Home', 'Bible', 'Explore', 'You'].map((text, index) => ({ text, box: [0.1 + index * 0.2, 1 - 66 / 1024, 0.08, 0.02] }));
    expect(checkShot(home, labels)).toEqual([]);
    // Text past the 864-point column, 6% in from each side at 981.
    expect(checkIpadLayout(home, [{ text: 'Read Verse', box: [0.02, 0.5, 0.2, 0.02] }])).toHaveLength(1);
    // At 504 the column fills the window.
    const narrow = planSplitChecks(config, 504).find((shot: { screen: string }) => shot.screen === 'home');
    expect(checkIpadLayout(narrow, [{ text: 'Read Verse', box: [0.02, 0.5, 0.96, 0.02] }])).toEqual([]);
    // Its mustShowLines are the phone's, so they're left out.
    expect(planSplitChecks(config, 504).every((shot: { mustShowLines?: unknown }) => shot.mustShowLines === undefined)).toBe(true);
  });
});

describe('iPad key screens (#324)', () => {
  const ipad = planCaptures(config, 'ipad');
  const ipadNames = ipad.map((shot: { name: string }) => shot.name);
  const { IPAD_APP_STORE_SIZE, SERVE_SIM, variantsOn, writeIpadAppStoreCopy } = require('../scripts/capture-ios-screens.cjs');
  const { planChecks, regionsFor } = require('../scripts/check-screens.cjs');

  it('takes only the screens that list ipadVariants, named ipad/<screen>-<variant>.png', () => {
    const listed = config.screens.filter((screen: { ipadVariants?: string[] }) => screen.ipadVariants);
    expect(new Set(ipad.map((shot: { screen: string }) => shot.screen))).toEqual(
      new Set(listed.map((screen: { name: string }) => screen.name)),
    );
    for (const shot of ipad) expect(shot.file).toBe(`ipad/${shot.name}.png`);
    // The iPhone and Android lists don't change.
    expect(shots.map((shot: { name: string }) => shot.name)).not.toContain('home-landscape');
    expect(variantsOn({ variants: ['default'], ipadVariants: ['landscape'] }, 'ios')).toEqual(['default']);
    expect(variantsOn({ variants: ['default'] }, 'ipad')).toEqual([]);
  });

  it("covers what a wide screen changes: the column, landscape, the library's grid, and a dialog", () => {
    expect(ipadNames).toEqual(
      expect.arrayContaining([
        'home-default',
        'home-landscape',
        'bible-dual-default',
        'bible-dual-landscape',
        // The iPad's own large text: the column widens with it, so lines don't
        // wrap phrase by phrase.
        'bible-dual-ios-large-text',
        'library-default',
        'library-children-default',
        // A Paper dialog: on iOS, a percentage width filled 90% of the iPad.
        'text-size-default',
      ]),
    );
  });

  it('turns the iPad only once, taking the portrait shots first', () => {
    const turned = ipad.map((shot: { settings: { orientation: string } }) => shot.settings.orientation);
    expect(turned.indexOf('landscape')).toBeGreaterThan(0);
    expect(turned.slice(turned.indexOf('landscape')).every((value: string) => value === 'landscape')).toBe(true);
  });

  it("keeps the iPad's orientation out of the app's storage, and off the iPhone and Android", () => {
    const landscape = ipad.find((shot: { name: string }) => shot.name === 'home-landscape');
    expect(landscape.settings).toMatchObject({ orientation: 'landscape', iosTextSize: 'large' });
    expect(Object.values(buildManifest(landscape.settings, landscape.route))).not.toContain('landscape');
    for (const shot of [...shots, ...planCaptures(config, 'android')]) {
      expect(shot.settings).not.toHaveProperty('orientation');
    }
  });

  it("saves no text size on the iPad, so its shots show a tablet's own 150%, which the Text size dialog confirms", () => {
    // Every iPad shot but the 200% ones (landscape-xl).
    for (const shot of ipad.filter((each: { settings: { textScale: unknown } }) => each.settings.textScale !== 2)) {
      expect(buildManifest(shot.settings)).not.toHaveProperty('user-text-scale');
    }
    // A variant that sets a size still saves it.
    expect(buildManifest({ ...ipad[0].settings, textScale: 2 })['user-text-scale']).toBe('2');
    const lines = (rules: Array<string | { line: string }>) =>
      rules.map((rule) => (typeof rule === 'string' ? rule : rule.line));
    const forOne = (platform: string) => {
      const shot = planChecks(config, platform).find((each: { name: string }) => each.name === 'text-size-default');
      return lines(
        shot.mustShowLines.filter(
          (rule: string | { platforms?: string[] }) =>
            typeof rule === 'string' || !rule.platforms || rule.platforms.includes(platform),
        ),
      );
    };
    expect(forOne('ipad')).toEqual(expect.arrayContaining(['^Reset to 150%', '^Current selection: 150%']));
    expect(forOne('ipad')).not.toContain('^Reset to 125%');
    expect(forOne('ios')).toContain('^Reset to 125%');
    expect(forOne('ios')).not.toContain('^Current selection: 150%');
  });

  it('takes every key screen in landscape, and portrait and 200% where a wide screen changes most', () => {
    for (const screen of config.screens) {
      expect({ screen: screen.name, landscape: screen.ipadVariants.some((variant: string) => /^landscape/.test(variant)) })
        .toEqual({ screen: screen.name, landscape: true });
    }
    expect(ipadNames).toEqual(
      expect.arrayContaining(['home-landscape-xl', 'bible-scrolled-landscape-xl', 'library-landscape-xl', 'text-size-landscape-xl']),
    );
    // A screen whose checks read Chinese or Spanish takes its landscape shot
    // in that language.
    expect(ipadNames).toEqual(expect.arrayContaining(['bible-cuv-landscape-zh', 'bible-cuvs-landscape-zh-cn', 'bible-spanish-landscape-es']));
  });

  it("flags a group's iPad shots over 7 minutes of capture, the same reminder to prune", () => {
    // Measured 20 seconds a shot on the 13-inch iPad, against the iPhone's 14
    // (#324), which shotCost counts. Each runner takes them after its iPhone
    // shots, so the slowest group's total sets the release PR's wait.
    for (const group of Object.keys(config.groups)) {
      const seconds = takeGroup(ipad, group, config).reduce((sum: number, shot: any) => sum + shotCost(shot), 0);
      expect({ group, minutes: Math.round(seconds / 6) / 10, over: seconds > 420 }).toMatchObject({ group, over: false });
    }
    expect(shotCost(ipad[0])).toBe(shotCost({ ...ipad[0], platform: 'ios' }) + 5);
  });

  it('lists App Store iPad shots for the uploaded listing, at most 10, all captured on the iPad', () => {
    expect(Object.keys(config.appStoreIpad)).toEqual(['en-US']);
    const list = config.appStoreIpad['en-US'];
    expect(list.length).toBeGreaterThan(0);
    expect(list.length).toBeLessThanOrEqual(10);
    for (const name of list) expect(ipadNames).toContain(name);
    for (const copy of planStoreCopies(config, 'ipad')) {
      expect(copy.file).toMatch(/^app-store-ipad\/en-US\/\d\d-.+\.png$/);
      expect(copy.source).toBe(`ipad/${copy.name}.png`);
    }
  });

  it("checks each shot with its screen's rules, against the iPad's regions for its orientation", () => {
    const checks = planChecks(config, 'ipad');
    expect(checks.map((shot: { name: string }) => shot.name)).toEqual(ipadNames);
    const bible = checks.find((shot: { name: string }) => shot.name === 'bible-dual-default');
    expect(bible.mustShowLines).toEqual(expect.arrayContaining(['BSB', 'CUV']));
    const portrait = checks.find((shot: { name: string }) => shot.name === 'home-default');
    const landscape = checks.find((shot: { name: string }) => shot.name === 'home-landscape');
    expect(regionsFor(portrait).tabs).toBeDefined();
    expect(regionsFor(landscape)).not.toBe(regionsFor(portrait));
  });

  it("saves App Store copies at the 13-inch iPad's size, either way up, and refuses another size", async () => {
    const sharp = require('sharp');
    const { mkdtempSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { join } = require('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'app-store-ipad-'));
    const make = async (name: string, width: number, height: number) => {
      const file = join(dir, name);
      await sharp({ create: { width, height, channels: 4, background: { r: 30, g: 90, b: 150, alpha: 1 } } })
        .png()
        .toFile(file);
      return file;
    };
    const { width, height } = IPAD_APP_STORE_SIZE;
    for (const [name, w, h] of [['portrait.png', width, height], ['landscape.png', height, width]] as const) {
      const copy = join(dir, `copy-${name}`);
      await writeIpadAppStoreCopy(await make(name, w, h), copy);
      expect(await sharp(copy).metadata()).toMatchObject({ width: w, height: h, channels: 3, hasAlpha: false });
    }
    await expect(writeIpadAppStoreCopy(await make('iphone.png', 1320, 2868), join(dir, 'copy.png'))).rejects.toThrow(
      'not the 13-inch iPad',
    );
  });

  it('pins serve-sim, which turns the Simulator through private interfaces', () => {
    expect(SERVE_SIM).toMatch(/^serve-sim@\d+\.\d+\.\d+$/);
  });

  describe('status bar and orientation', () => {
    const sharp = require('sharp');
    const { mkdtempSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { join } = require('node:path');
    const { STATUS_BAR_REGIONS_BY_SCREEN, screenOf, turnUpright } = require('../scripts/capture-ios-screens.cjs');
    const dir = mkdtempSync(join(tmpdir(), 'ipad-status-'));
    const box = (left: number, top: number, width: number, height: number, fill = '#111') => ({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`),
      left,
      top,
    });

    // A 13-inch iPad screenshot: the clock and date on the left of the 48-pixel
    // status bar, the icons on the right, and a line of text at textAt.
    const ipadShot = async (name: string, width: number, height: number, textAt?: number) => {
      const file = join(dir, `${name}.png`);
      const overlays = [box(48, 19, 270, 26), box(width - 200, 19, 140, 26)];
      if (textAt !== undefined) {
        for (let left = 60; left < width - 200; left += 160) overlays.push(box(left, textAt, 120, 22, '#222'));
      }
      await sharp({ create: { width, height, channels: 3, background: '#f3e6df' } }).composite(overlays).png().toFile(file);
      return file;
    };

    it.each([
      { screen: 'ipad', width: 2064, height: 2752 },
      { screen: 'ipad-landscape', width: 2752, height: 2064 },
    ])("catches text behind the $screen's status bar, but not its clock and icons", async ({ screen, width, height }) => {
      const regions = STATUS_BAR_REGIONS_BY_SCREEN[screen];
      expect(await statusBarClear(await ipadShot(`${screen}-clear`, width, height), regions)).toBe(true);
      expect(await statusBarClear(await ipadShot(`${screen}-behind`, width, height, 16), regions)).toBe(false);
      // Text just below the status bar, as the Bible shows when scrolled.
      expect(await statusBarClear(await ipadShot(`${screen}-below`, width, height, 52), regions)).toBe(true);
    });

    it('checks each shot against its own screen and orientation', () => {
      expect(screenOf(ipad.find((shot: { name: string }) => shot.name === 'home-default'))).toBe('ipad');
      expect(screenOf(ipad.find((shot: { name: string }) => shot.name === 'bible-dual-landscape'))).toBe('ipad-landscape');
      expect(screenOf(shots[0])).toBe('ios');
    });

    it('turns a landscape screenshot upright, its left edge to the top', async () => {
      // simctl saves the landscape screen sideways: the app's top on the left.
      const file = join(dir, 'sideways.png');
      await sharp({ create: { width: 30, height: 40, channels: 3, background: '#ffffff' } })
        .composite([box(0, 0, 5, 40, '#000')])
        .png()
        .toFile(file);
      await turnUpright(file);
      const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
      expect([info.width, info.height]).toEqual([40, 30]);
      // The dark strip is now along the top.
      expect(data[0]).toBeLessThan(50);
      expect(data[(info.height - 1) * info.width * info.channels]).toBeGreaterThan(200);
    });
  });
});

describe('App Store copies', () => {
  it('have no alpha channel, which App Store Connect rejects, and otherwise match', async () => {
    const sharp = require('sharp');
    const { mkdtempSync } = require('node:fs');
    const { tmpdir } = require('node:os');
    const { join } = require('node:path');
    const dir = mkdtempSync(join(tmpdir(), 'app-store-'));
    const source = join(dir, 'shot.png');
    const copy = join(dir, 'copy.png');
    // Like a Simulator screenshot: RGBA, every pixel opaque.
    await sharp({ create: { width: 40, height: 80, channels: 4, background: { r: 200, g: 120, b: 40, alpha: 1 } } })
      .png()
      .toFile(source);
    expect((await sharp(source).metadata()).hasAlpha).toBe(true);

    await writeAppStoreCopy(source, copy);
    const meta = await sharp(copy).metadata();
    // At the size App Store Connect's iPhone slot takes (1206 × 2622).
    expect(meta).toMatchObject({ width: 1206, height: 2622, channels: 3, hasAlpha: false });
    const { data } = await sharp(copy).raw().toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([200, 120, 40]);
  });
});

describe('Screenshot review', () => {
  const preview = repoFile('.github/workflows/ios-key-screens.yml');
  /** One job of the iOS preview, up to the next job. */
  const job = (id: string) => {
    const start = preview.indexOf(`\n  ${id}:\n`);
    const next = preview.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
    return next === -1 ? preview.slice(start) : preview.slice(start, start + 1 + next);
  };
  const announce = job('announce');
  const commentJob = job('review-comment');
  // The comment itself, which the job above calls, as Android's run does.
  const commentWorkflow = repoFile('.github/workflows/key-screens-review.yml');
  const approvalJob = job('screenshots-reviewed');
  const releaseOnly = [
    "github.head_ref == 'release-candidate'",
    'github.event.pull_request.head.repo.full_name == github.repository',
  ];

  it('waits for an approver in the screenshot-review environment, after the screenshots are posted', () => {
    // The "Main protection" ruleset requires this name.
    expect(approvalJob).toContain('name: Screenshots reviewed');
    expect(approvalJob).toContain('environment: screenshot-review');
    expect(approvalJob).toContain('needs: review-comment');
    for (const condition of releaseOnly) expect(approvalJob).toContain(condition);
  });

  it('fails rather than passing unreviewed if the environment has no required reviewers', () => {
    expect(approvalJob).toContain('gh api "repos/$REPO/environments/screenshot-review"');
    expect(approvalJob).toContain('select(.type == "required_reviewers")');
    expect(approvalJob).toContain('if [ "$reviewers" -lt 1 ]; then');
  });

  it('has no label or comment approvals left', () => {
    expect(existsSync(resolve(__dirname, '..', '.github/workflows/screenshot-review.yml'))).toBe(false);
    expect(existsSync(resolve(__dirname, '..', '.github/workflows/screenshot-approval.yml'))).toBe(false);
    expect(preview).not.toContain('screenshots reviewed** label');
  });

  it('posts the screenshots, and how to approve them, after the builds', () => {
    expect(commentJob).toContain('needs: simulator');
    for (const condition of releaseOnly) expect(commentJob).toContain(condition);
    expect(commentJob).toContain('uses: ./.github/workflows/key-screens-review.yml');
    expect(commentWorkflow).toContain('<!-- key-screens-review sha=$SHA -->');
    expect(commentWorkflow).toContain('**Review deployments**');
    // It replaces its own earlier comments only.
    expect(commentWorkflow).toContain('select(.user.login == "github-actions[bot]"');
  });

  it('says the screenshots are on the way after each push, and clears out-of-date ones', () => {
    for (const condition of releaseOnly) expect(announce).toContain(condition);
    expect(announce).toContain('github.run_attempt == 1');
    expect(announce).toContain('<!-- key-screens-review pending sha=$SHA -->');
    expect(announce).toContain('gh api -X DELETE "repos/$REPO/issues/comments/$id"');
    expect(announce).toContain('takes 30 to 40 minutes');
  });

  it.each([
    ['the notice', announce],
    ['the review comment', commentJob],
    ['the review comment workflow', commentWorkflow],
    ['the approval', approvalJob],
  ])('%s never runs pull request code or reads a secret', (_name, text) => {
    expect(text).not.toMatch(/actions\/checkout|secrets\./);
    // Pull request text reaches the script only through environment variables.
    // Each script runs from `run: |` to the next step.
    for (const script of text.split('run: |').slice(1).map((rest) => rest.split(/\n\s*- (?:name|uses):/)[0])) {
      expect(script).not.toMatch(/\$\{\{/);
    }
  });
});

describe('blank screen check', () => {
  const sharp = require('sharp');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'blank-'));
  const box = (left: number, top: number, width: number, height: number, fill: string) => ({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`),
    left,
    top,
  });

  it('calls a black screen blank even though the status bar shows', async () => {
    // A slow dark-mode launch once captured only the clock and icons.
    const file = join(dir, 'black.png');
    await sharp({ create: { width: 1320, height: 2868, channels: 3, background: '#000' } })
      .composite([box(196, 60, 104, 60, '#fff'), box(940, 70, 260, 50, '#fff')])
      .png()
      .toFile(file);
    expect(await looksBlank(file)).toBe(true);
  });

  it('doesn’t call a drawn screen blank', async () => {
    const file = join(dir, 'drawn.png');
    await sharp({ create: { width: 1320, height: 2868, channels: 3, background: '#000' } })
      .composite([box(196, 60, 104, 60, '#fff'), box(80, 900, 1100, 300, '#333'), box(80, 2700, 1160, 80, '#888')])
      .png()
      .toFile(file);
    expect(await looksBlank(file)).toBe(false);
  });
});

describe('waiting for a screen to finish loading', () => {
  const sharp = require('sharp');
  const { copyFileSync, mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'still-'));
  const box = (left: number, top: number, width: number, height: number, fill: string) => ({
    input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="${fill}"/></svg>`),
    left,
    top,
  });
  // A 1320 × 2868 screen: the status bar, plus boxes of "text".
  const screen = async (name: string, boxes: ReturnType<typeof box>[] = []) => {
    const file = join(dir, `${name}.png`);
    await sharp({ create: { width: 1320, height: 2868, channels: 3, background: '#f3e6df' } })
      .composite([box(196, 60, 104, 60, '#222'), ...boxes])
      .png()
      .toFile(file);
    return file;
  };
  let blank: string, verseOne: string, scrolled: string, countdownA: string, countdownB: string;
  beforeAll(async () => {
    blank = await screen('blank');
    // One translation at the top of the chapter, then both, scrolled down.
    verseOne = await screen('verse-one', [box(80, 500, 1160, 1400, '#333')]);
    scrolled = await screen('scrolled', [box(80, 300, 1160, 600, '#333'), box(80, 1000, 1160, 600, '#666')]);
    // Home with its countdown on two different seconds.
    countdownA = await screen('countdown-a', [box(80, 500, 1160, 800, '#333'), box(1100, 1100, 40, 50, '#000')]);
    countdownB = await screen('countdown-b', [box(80, 500, 1160, 800, '#333'), box(1150, 1100, 40, 50, '#000')]);
  });

  // takeFinalShot with a screenshot() that shows these screens in turn, the last one from then on.
  const take = async (screens: string[], lastSample?: string) => {
    const file = join(dir, 'final.png');
    let next = 0;
    const screenshot = () => copyFileSync(screens[Math.min(next++, screens.length - 1)], file);
    const taken = await takeFinalShot(screenshot, file, { lastSample, pause: 0 });
    return { taken, same: (await differingFraction(file, screens[Math.min(taken, screens.length) - 1])) === 0 };
  };

  it('measures how much of the screen changed', async () => {
    expect(await differingFraction(verseOne, verseOne)).toBe(0);
    expect(await differingFraction(countdownA, countdownB)).toBeLessThan(STILL_FRACTION);
    expect(await differingFraction(verseOne, scrolled)).toBeGreaterThan(0.2);
  });

  it('takes one shot of a screen that had already stopped changing', async () => {
    expect((await take([scrolled], scrolled)).taken).toBe(1);
  });

  it("doesn't wait for Home's countdown", async () => {
    expect((await take([countdownB], countdownA)).taken).toBe(1);
  });

  it('waits for a screen still loading at the end of its wait, as on 2026-10-20', async () => {
    // The sample before showed the screen still blank; the shot caught verse 1,
    // and the next two show the chapter scrolled to the verse.
    const result = await take([verseOne, scrolled, scrolled], blank);
    expect(result).toEqual({ taken: 3, same: true });
  });

  it('waits for a blank screen to draw, then to finish loading', async () => {
    expect(await take([blank, blank, verseOne, scrolled, scrolled], blank)).toEqual({ taken: 5, same: true });
  });

  it('gives up on a screen that never stops changing', async () => {
    const flicker = Array.from({ length: 20 }, (_, i) => (i % 2 ? verseOne : scrolled));
    expect((await take(flicker, verseOne)).taken).toBe(1 + STILL_RETRIES);
  });

  it('only waits for a blank screen when there was no sample to compare with', async () => {
    expect((await take([blank, verseOne, scrolled])).taken).toBe(2);
  });
});

describe('launching again after a stuck launch', () => {
  it('launches a shot once more, on the iPhone and Android, before it counts as failed', () => {
    // On 2026-10-21 one Home launch stayed on the splash for 41 seconds.
    expect(LAUNCHES).toBe(2);
    for (const script of ['scripts/capture-ios-screens.cjs', 'scripts/capture-android-screens.cjs']) {
      const source = repoFile(script);
      expect([script, source]).toEqual([script, expect.stringContaining('for (let launch = 1; launch <= LAUNCHES; launch++) {')]);
      // Only launch problems relaunch; the shot's own checks, such as statusBarClear, come after.
      const relaunch = source.indexOf('if (problems.length && launch < LAUNCHES) {');
      expect(relaunch).toBeGreaterThan(source.indexOf("problems.push('the app still shows its splash screen')"));
      expect(relaunch).toBeLessThan(source.indexOf('for (const check of shot.checks) {'));
    }
  });

  it('lists each relaunch in the summary, and warns on the run', () => {
    const log = jest.spyOn(console, 'log').mockImplementation(() => {});
    expect(relaunchLines([])).toEqual([]);
    expect(relaunchLines(['ios/home-dark.png: the app still shows its splash screen, after 41s'])).toEqual([
      '',
      'Launched again after a stuck launch (1):',
      '- ⚠️ ios/home-dark.png: the app still shows its splash screen, after 41s',
    ]);
    expect(log).toHaveBeenCalledWith(
      '::warning::Launched again: ios/home-dark.png: the app still shows its splash screen, after 41s',
    );
  });
});

describe('Android key screens (#372)', () => {
  const android = planCaptures(config, 'android');
  const names = (list: { name: string }[]) => list.map((shot) => shot.name);
  const {
    writeStorage,
    readStorageValue,
    installStorageCommands,
    deviceSettings,
    writePlayCopy,
    previewPackage,
    planShots,
    checkScreenSize,
    STORAGE_DATABASE,
    becomeRoot,
  } = require('../scripts/capture-android-screens.cjs');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');

  it('takes the same screens, named android/<screen>-<variant>.png', () => {
    // All but the iPhone's own checks, such as its audio (#551), which
    // android-audio-e2e.yml covers on Android.
    const shared = config.screens.filter((screen: { platforms?: string[] }) => !screen.platforms?.length || screen.platforms.includes('android'));
    expect(shared.length).toBe(config.screens.length - 2);
    expect(new Set(android.map((shot: { screen: string }) => shot.screen))).toEqual(
      new Set(shared.map((screen: { name: string }) => screen.name)),
    );
    for (const shot of android) expect(shot.file).toBe(`android/${shot.name}.png`);
    expect(names(android)).toEqual(expect.arrayContaining(['home-default', 'home-dark', 'home-large', 'bible-dual-xl']));
  });

  it("leaves each platform's own variants to that platform", () => {
    expect(names(android)).not.toContain('home-ios-large-text');
    expect(names(android)).not.toContain('explore-max');
    expect(names(android)).toEqual(
      expect.arrayContaining(['home-xl-android-font-max', 'bible-dual-android-font-max', 'home-android-display-large']),
    );
    expect(names(shots)).not.toContain('home-xl-android-font-max');
    expect(names(shots)).toContain('home-ios-large-text');
    for (const shot of android) expect(shot.settings).not.toHaveProperty('iosTextSize');
    for (const shot of shots) expect(shot.settings).not.toHaveProperty('fontScale');
  });

  it('gives the Android-only variants the rules of their iPhone counterparts', () => {
    const home = config.screens.find((screen: { name: string }) => screen.name === 'home');
    // Except that the phone's narrower screen may wrap the heading between its words.
    expect(home.variantRules['xl-android-font-max'].mustNotShowLines).toEqual(
      home.variantRules['xl-ios-large-text'].mustNotShowLines,
    );
    expect(home.variantRules['xl-android-font-max'].mustShowLines).toEqual(['^Today.s( Verse)?$']);
    expect(home.variantRules['es-xl-android-font-max']).toEqual(home.variantRules['es-xl-ios-large-text']);
  });

  it("keeps Android's font and display size out of the app's storage", () => {
    const shot = android.find((candidate: { name: string }) => candidate.name === 'home-xl-android-font-max');
    expect(shot.settings).toMatchObject({ fontScale: 2, textScale: 2, displayScale: 1 });
    expect(buildManifest(shot.settings)).toEqual({
      'has-completed-setup': 'true',
      'user-language': 'en',
      'user-theme': 'light',
      'user-text-scale': '2',
    });
  });

  it('takes a screen with platforms only there', () => {
    const only = { ...config, screens: [{ ...config.screens[0], platforms: ['ios'] }] };
    expect(planCaptures(only, 'android')).toEqual([]);
    expect(planCaptures(only, 'ios').length).toBeGreaterThan(0);
    expect(() => planCaptures(config, 'windows')).toThrow('No platform "windows"');
  });

  it('keeps every Android group within the same reminder to prune', () => {
    for (const group of Object.keys(config.groups)) {
      const seconds = takeGroup(android, group, config).reduce((sum: number, shot: any) => sum + shotCost(shot), 0);
      expect({ group, over: seconds > 360 }).toEqual({ group, over: false });
    }
  });

  it('tries adb root again when the connection drops, as it did on release PRs', async () => {
    const calls: string[] = [];
    let roots = 0;
    const run = (command: string) => {
      calls.push(command);
      if (command === 'root' && (roots += 1) < 3) throw new Error('adb: unable to connect for root: closed');
      return '';
    };
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await expect(becomeRoot({ run, pause: async () => {} })).resolves.toBe(3);
      expect(calls).toEqual(['root', 'wait-for-device', 'root', 'wait-for-device', 'root', 'wait-for-device']);
      // It gives up after five tries, with adb's own error.
      await expect(becomeRoot({ run: () => { throw new Error('adb: device offline'); }, pause: async () => {} }))
        .rejects.toThrow('adb: device offline');
    } finally {
      warn.mockRestore();
    }
  });

  it('runs on an emulator image that allows adb root, the size of the best-selling Android phone', () => {
    expect(config.android.systemImage).toMatch(/;google_apis;x86_64$/);
    // The Galaxy A07 4G: 720 × 1600 at 300 dpi, 384 dp wide like most Samsung phones.
    expect(config.android.phone).toMatchObject({ width: 720, height: 1600, density: 300 });
    expect((config.android.phone.width * 160) / config.android.phone.density).toBe(384);
    // Google Play takes no screenshot taller than 2:1, which the phone's is, so
    // its shots get an emulator of their own.
    expect(config.android.phone.height / config.android.phone.width).toBeGreaterThan(2);
    expect(config.android.googlePlay.height / config.android.googlePlay.width).toBeLessThanOrEqual(2);
  });

  it("refuses to capture on an emulator that isn't the phone's size", () => {
    const { phone } = config.android;
    expect(() => checkScreenSize(phone, 'Physical size: 720x1600')).not.toThrow();
    expect(() => checkScreenSize(phone, 'Physical size: 1080x1920')).toThrow('not 720 × 1600');
  });

  it('takes each Google Play shot once, on its own runner, and no group shot there', () => {
    const store = planShots(config, { store: true });
    const names = [...new Set(planStoreCopies(config, 'android').map((copy: { name: string }) => copy.name))];
    expect(store.map((shot: { name: string }) => shot.name).sort()).toEqual(names.sort());
    expect(planShots(config, { group: 'library' })).toEqual(takeGroup(android, 'library', config));
  });

  it('saves settings where the Android app reads them, and reads them back', () => {
    const dir = mkdtempSync(join(tmpdir(), 'android-storage-'));
    const explore = android.find((shot: { name: string }) => shot.name === 'explore-default');
    writeStorage(join(dir, STORAGE_DATABASE), buildManifest(explore.settings, explore.route));
    expect(readStorageValue(dir, 'screenshot-route')).toBe('explore');
    expect(readStorageValue(dir, 'has-completed-setup')).toBe('true');
    expect(readStorageValue(dir, 'user-bible-translation')).toBeNull();
    // ReactDatabaseSupplier opens version 1 and wipes any other.
    const { DatabaseSync } = require('node:sqlite');
    const database = new DatabaseSync(join(dir, STORAGE_DATABASE));
    expect(database.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 });
    database.close();
    const source = repoFile(
      'node_modules/@react-native-async-storage/async-storage/android/src/main/java/com/reactnativecommunity/asyncstorage/ReactDatabaseSupplier.java',
    );
    expect(source).toContain('DATABASE_NAME = "RKStorage"');
    expect(source).toContain('DATABASE_VERSION = 1');
    expect(source).toContain('TABLE_CATALYST = "catalystLocalStorage"');
  });

  it("puts the database in the preview app's folder, owned and labelled like the folder", () => {
    expect(previewPackage()).toBe(`${JSON.parse(repoFile('app.json')).expo.android.package}.preview`);
    const commands = installStorageCommands('org.example.preview', '/data/local/tmp/storage');
    expect(commands).toContain('cp /data/local/tmp/storage /data/data/org.example.preview/databases/RKStorage');
    // An old write-ahead log would replay the last shot's settings.
    expect(commands).toContain('rm -f /data/data/org.example.preview/databases/RKStorage /data/data/org.example.preview/databases/RKStorage-*');
    expect(commands).toContain('chown "$(stat -c %u:%g /data/data/org.example.preview)"');
    expect(commands).toContain('chcon "$(stat -c %C /data/data/org.example.preview)"');
  });

  it("sets the theme, font size, and display size on the emulator, from the phone's density", () => {
    expect(deviceSettings({ theme: 'dark', fontScale: 2, displayScale: 1 }, 300)).toEqual({
      night: 'yes',
      fontScale: '2',
      density: '300',
    });
    expect(deviceSettings({ theme: 'light', fontScale: 1, displayScale: 1.2 }, 300).density).toBe('360');
    // Android's largest display size keeps the screen at least 320 dp wide.
    const { phone } = config.android;
    const display = config.variants['android-display-large'].displayScale;
    expect(phone.width / ((phone.density * display) / 160)).toBeGreaterThanOrEqual(320);
  });

  it('lists Google Play shots in both store languages, at most 8 each, all captured on Android', () => {
    const copies = planStoreCopies(config, 'android');
    expect(Object.keys(config.googlePlay)).toEqual(['en-US', 'zh-TW']);
    for (const list of Object.values(config.googlePlay) as string[][]) expect(list.length).toBeLessThanOrEqual(8);
    for (const copy of copies) {
      expect(names(android)).toContain(copy.name);
      expect(copy.source).toBe(`android/${copy.name}.png`);
      expect(copy.file).toMatch(/^google-play\/(en-US|zh-TW)\/\d{2}-/);
    }
    expect(copies[0].file).toBe('google-play/en-US/01-home-default.png');
  });

  it("saves Play copies at Google Play's size without transparency, and refuses another size", async () => {
    const sharp = require('sharp');
    const dir = mkdtempSync(join(tmpdir(), 'google-play-'));
    const make = async (name: string, width: number, height: number) => {
      const file = join(dir, name);
      await sharp({ create: { width, height, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } } })
        .png()
        .toFile(file);
      return file;
    };
    const size = config.android.googlePlay;
    expect(size).toMatchObject({ width: 1080, height: 1920 });
    await writePlayCopy(await make('right.png', 1080, 1920), join(dir, 'copy.png'), size);
    expect(await sharp(join(dir, 'copy.png')).metadata()).toMatchObject({ width: 1080, height: 1920, hasAlpha: false });
    await expect(writePlayCopy(await make('tall.png', 720, 1600), join(dir, 'no.png'), size)).rejects.toThrow(
      "not Google Play's 1080 × 1920",
    );
  });

  it("catches text behind Android's status bar, but not its clock and icons", async () => {
    const sharp = require('sharp');
    const { STATUS_BAR_REGIONS } = require('../scripts/capture-android-screens.cjs');
    const dir = mkdtempSync(join(tmpdir(), 'android-status-'));
    const box = (left: number, top: number, width: number, height: number) => ({
      input: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="${width}" height="${height}" fill="#222"/></svg>`),
      left,
      top,
    });
    // At Android's largest font: the clock to x 180 and the icons from 670.
    const statusBar = [box(40, 4, 140, 56), box(670, 4, 360, 56)];
    const shot = async (name: string, extra: object[]) => {
      const file = join(dir, `${name}.png`);
      await sharp({ create: { width: 1080, height: 1920, channels: 3, background: '#f3e6df' } })
        .composite([...statusBar, ...extra])
        .png()
        .toFile(file);
      return file;
    };
    expect(await statusBarClear(await shot('clear', []), STATUS_BAR_REGIONS)).toBe(true);
    const words = [300, 420, 540].map((left) => box(left, 30, 90, 30));
    expect(await statusBarClear(await shot('text', words), STATUS_BAR_REGIONS)).toBe(false);
  });

  it("joins both platforms' results, telling a shot's two copies apart", () => {
    const iosShot = shots.find((shot: { name: string }) => shot.name === 'home-default');
    const androidShot = android.find((shot: { name: string }) => shot.name === 'home-default');
    const merged = mergeResults(
      [iosShot, androidShot],
      [
        {
          checks: [{ file: iosShot.file, problems: [] }],
          timings: [{ shot: 'home-default', file: iosShot.file, settledAfter: 3 }],
          ocr: { [`/Users/runner/work/_temp/parts/key-screens-1-home/screens/${iosShot.file}`]: [{ text: 'A' }] },
        },
        {
          checks: [{ file: androidShot.file, problems: ['x'] }],
          timings: [{ shot: 'home-default', file: androidShot.file, settledAfter: 7 }],
          ocr: { [`/Users/runner/work/_temp/parts/key-screens-1-android-home/screens/${androidShot.file}`]: [{ text: 'B' }] },
        },
      ],
    );
    expect(merged.checks).toEqual([
      { file: 'ios/home-default.png', problems: [] },
      { file: 'android/home-default.png', problems: ['x'] },
    ]);
    expect(merged.timings.map((timing: { settledAfter: number }) => timing.settledAfter)).toEqual([3, 7]);
    expect(merged.ocr).toEqual({ 'ios/home-default.png': [{ text: 'A' }], 'android/home-default.png': [{ text: 'B' }] });
  });
});

describe('Android key screens workflow (#372)', () => {
  const workflow = repoFile('.github/workflows/android-key-screens.yml');
  const preview = repoFile('.github/workflows/ios-key-screens.yml');
  const jobOf = (text: string, id: string) => {
    const start = text.indexOf(`\n  ${id}:\n`);
    expect(start).toBeGreaterThan(-1);
    const next = text.slice(start + 1).search(/\n {2}[a-z-]+:\n/);
    return next === -1 ? text.slice(start) : text.slice(start, start + 1 + next);
  };
  const build = jobOf(workflow, 'android-build');
  const capture = jobOf(workflow, 'android-capture');
  const join = jobOf(workflow, 'screens');

  it('runs every Android job on Linux, apart from the iPhone workflow and its Macs', () => {
    expect(workflow).not.toMatch(/runs-on: macos/);
    expect(workflow.match(/runs-on: ubuntu-24\.04/g)!.length).toBe(3);
    expect(preview).not.toMatch(/android-build|android-capture|capture-android-screens/);
  });

  it('runs where the iPhone capture runs: the release PR, or by hand', () => {
    for (const text of [build, capture, join]) {
      expect(text).toContain("github.head_ref == 'release-candidate'");
      expect(text).toContain('github.event.pull_request.head.repo.full_name == github.repository');
      expect(text).toContain("github.event_name != 'pull_request' ||\n");
    }
  });

  it('builds the preview APK for the emulator with the key-screen route, and shares it once', () => {
    expect(build).toContain('npm run build:android:apk:debug:intel');
    expect(build).toMatch(/env:\n(?: +#.*\n)* +EXPO_PUBLIC_KEY_SCREENS: '1'\n/);
    expect(build).toContain('name: android-emulator-app-${{ github.run_id }}');
    expect(capture).toContain('name: android-emulator-app-${{ github.run_id }}');
    expect(capture).toContain('select(.name == "Build the Android key-screens app")');
  });

  it("numbers each platform's batches 1 to 5 in the groups' order, and names jobs by them", () => {
    const ios = repoFile('.github/workflows/ios-key-screens.yml');
    for (const text of [ios, workflow]) {
      Object.keys(config.groups).forEach((group, index) => {
        expect(text).toMatch(new RegExp(`- \\{ group: ${group}, batch: ${index + 1}[,} ]`));
      });
    }
    expect(ios).toContain('name: iOS key screens batch ${{ matrix.batch }} (${{ matrix.group }})');
    expect(workflow).toContain('name: Android key screens batch ${{ matrix.batch }} (${{ matrix.group }})');
  });

  it('captures and checks each group on its own emulator runner, from the list in screens.json', () => {
    const groups = /\n\s+group: \[([a-z, -]+)\]\n/.exec(capture)![1].split(', ');
    expect(groups).toEqual(Object.keys(config.groups));
    expect(capture).toContain(
      "PART: ${{ matrix.split && format('--split {0}', matrix.split) || (matrix.store && '--store' || format('--group {0}', matrix.group)) }}",
    );
    expect(capture).toMatch(/capture-android-screens\.cjs --out [^\n]+ \$PART\n/);
    // The sixth runner takes the Google Play shots, and has no group to check.
    expect(capture).toContain('- { group: google-play, batch: 6, store: true }');
    expect(capture.match(/if: \$\{\{ !cancelled\(\) && !matrix\.store \}\}/g)).toHaveLength(2);
    expect(capture).toContain("process.env.STORE === 'true' ? googlePlay : phone");
    expect(capture).toContain(
      "PART: ${{ matrix.split && format('--split {0}', matrix.split) || format('--platform android --group {0}', matrix.group) }}",
    );
    expect(capture).toMatch(/check-screens\.cjs --dir [^\n]+\n\s+\$PART\n/);
    // Batches 7 to 10: an iPad's split windows (#324), one each.
    const widths = config.android.splitWindows.map((window: { width: number }) => window.width);
    widths.forEach((width: number, index: number) => {
      expect(capture).toContain(`- { group: split-${width}, batch: ${index + 7}, split: ${width} }`);
    });
    expect(capture).toContain('pip" install --quiet -r scripts/ocr-requirements.txt');
    expect(capture.indexOf('capture-android-screens.cjs')).toBeLessThan(capture.indexOf('--platform android'));
    expect(capture).toContain('name: android-key-screens-${{ github.run_id }}-${{ matrix.group }}');
    expect(repoFile('scripts/ocr-requirements.txt')).toMatch(/^rapidocr==\d+\.\d+\.\d+$/m);
  });

  it('joins the groups in a required job that fails rather than skips when one fails', () => {
    // The "Main protection" ruleset requires this name.
    expect(join).toContain('\n    name: Android key screens join\n');
    expect(join).toContain('needs: [android-build, android-capture]');
    expect(join).toMatch(/if: >-\n\s+!cancelled\(\) && \(/);
    expect(join).toContain("needs.android-capture.result != 'success'");
    expect(join).toContain('merge-key-screens.cjs --platform android --out');
    // The iPhone workflow's review comment finds the joined artifact by this name.
    expect(join).toContain("name: android-key-screens-${{ github.event.pull_request.number || 'manual' }}-${{ github.run_id }}");
  });

  it("links the Android run's screenshots in the one review comment, before the one approval", () => {
    // key-screens-review.yml writes the comment; test/key-screens-review.test.ts runs it.
    const comment = repoFile('.github/workflows/key-screens-review.yml');
    expect(comment).toContain('actions/workflows/android-key-screens.yml/runs?head_sha=$SHA&event=pull_request');
    expect(comment).toContain('test("^android-key-screens-(manual|[0-9]+)-[0-9]+$")');
    expect(jobOf(preview, 'screenshots-reviewed')).toContain('needs: review-comment');
  });

  it('re-checks an earlier run on Linux, by hand only, never as a check on pull requests', () => {
    const recheck = repoFile('.github/workflows/key-screens-recheck.yml');
    // Its only trigger is workflow_dispatch: the lines under `on:` indented
    // by exactly two spaces name the triggers. (Plain line checks, not one
    // regular expression over the whole block, which CodeQL flagged as
    // exponential backtracking.)
    const on = recheck.slice(recheck.indexOf('\non:\n') + 1, recheck.indexOf('\npermissions:'));
    const triggers = on.split('\n').filter((line) => line.startsWith('  ') && !line.startsWith('   '));
    expect(triggers).toEqual(['  workflow_dispatch:']);
    expect(workflow).not.toMatch(/screens_from_run|earlier-screens/);
    const earlier = jobOf(recheck, 'android');
    expect(earlier).toContain("if: inputs.platform == 'android'");
    expect(earlier).toContain('runs-on: ubuntu-24.04');
    expect(earlier).toContain('check-screens.cjs --dir "$SCREENS" --platform android');
    // A run's downloads are its joined screenshots and each group's own, each
    // with a screens folder. Every one's shots are checked, not the first
    // folder's alone (#632).
    expect(earlier).toContain(`find "$RUNNER_TEMP/earlier" -path '*/screens/android/*.png' -exec cp {} "$screens/android/" \\;`);
    expect(earlier).not.toContain('-print -quit');
  });

  it('keeps pull request code away from credentials', () => {
    expect(workflow).not.toMatch(/secrets\.|environment:|pull_request_target/);
    // Only the job that refreshes the review comment can write, and it runs
    // no steps: key-screens-review.yml never checks out or runs code.
    const refresh = jobOf(workflow, 'review-comment');
    expect(workflow.replace(refresh, '').match(/^\s+[a-z-]+:\s*write\b/gm)).toBeNull();
    expect(refresh.match(/^\s+[a-z-]+:\s*write\b/gm)).toEqual(['      pull-requests: write']);
    expect(refresh).toContain('uses: ./.github/workflows/key-screens-review.yml');
    expect(refresh).not.toContain('steps:');
    for (const text of [build, capture, join]) expect(text).toContain('persist-credentials: false');
  });
});
