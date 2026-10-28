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

  it('opens only popups the screen can open from its path (#372)', () => {
    const screenFiles: Record<string, string> = {
      bible: 'app/(tabs)/bible/index.tsx',
      'sabbath-school': 'app/(tabs)/explore/sabbath-school.tsx',
      you: 'app/(tabs)/you/index.tsx',
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

  it('runs one runner per group, each capturing and checking only its group', () => {
    const groups = /\n\s+group: \[([a-z, -]+)\]\n/.exec(workflow)![1].split(', ');
    expect(groups).toEqual(Object.keys(config.groups));
    expect(workflow).toMatch(/capture-ios-screens\.cjs --out [^\n]+\n\s+--group \$\{\{ matrix\.group \}\}\n/);
    expect(workflow).toMatch(/check-screens\.cjs --dir [^\n]+\n\s+--group \$\{\{ matrix\.group \}\}\n/);
  });

  it('compiles the app once, on the lightest group\'s runner, and the others wait for it', () => {
    const builder = /- \{ group: ([a-z-]+), batch: \d+, builds: true \}\n/.exec(workflow)![1];
    expect(workflow.match(/builds: true/g)).toHaveLength(1);
    // The builder also takes its own shots after compiling, so it gets the
    // lightest group.
    const cost = (group: string) =>
      takeGroup(shots, group, config).reduce((sum: number, shot: any) => sum + shotCost(shot), 0);
    for (const group of Object.keys(config.groups)) expect(cost(builder)).toBeLessThanOrEqual(cost(group));
    const guard = (step: string) => new RegExp(`- name: ${step}\n(?:\\s+#.*\n)*\\s+if: (.+)\n`).exec(workflow)?.[1];
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
      /if \[ "\$BOOT_NOW" = true \]; then\n\s+nohup xcrun simctl bootstatus "\$DEVICE_ID" -b [^\n]+&\n\s+fi\n/,
    );
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
    expect(merge).toContain('node scripts/merge-key-screens.cjs --platform ios --out');
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
    const comment = workflow.slice(workflow.indexOf('\n  review-comment:\n'), workflow.indexOf('\n  screenshots-reviewed:\n'));
    expect(comment).toContain(
      `download="$(screenshots "$RUN_ID" '.name | test("^ios-key-screens-(manual|[0-9]+)-[0-9]+$")' 'the iPhone screenshots')"`,
    );
    expect(comment).toContain(`app="$(screenshots "$RUN_ID" '.name | endswith("-arm64")' 'the iPhone Simulator app')"`);
  });

  it('re-checks an earlier run from its screenshots, or from the app download of runs before the split', () => {
    const earlier = workflow.slice(workflow.indexOf('\n  earlier-screens:\n'));
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

  it('recognizes the launch splash, which the logo keeps from looking blank', async () => {
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
    expect(meta).toMatchObject({ width: 40, height: 80, channels: 3, hasAlpha: false });
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
    expect(commentJob).toContain('<!-- key-screens-review sha=$SHA -->');
    expect(commentJob).toContain('**Review deployments**');
    // It replaces its own earlier comments only.
    expect(commentJob).toContain('select(.user.login == "github-actions[bot]"');
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
  } = require('../scripts/capture-android-screens.cjs');
  const { mkdtempSync } = require('node:fs');
  const { tmpdir } = require('node:os');
  const { join } = require('node:path');

  it('takes the same screens, named android/<screen>-<variant>.png', () => {
    expect(new Set(android.map((shot: { screen: string }) => shot.screen))).toEqual(
      new Set(config.screens.map((screen: { name: string }) => screen.name)),
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
    expect(workflow.match(/runs-on: ubuntu-24\.04/g)!.length).toBe(4);
    expect(preview).not.toMatch(/android-build|android-capture|capture-android-screens/);
  });

  it('runs where the iPhone capture runs: the release PR, or by hand', () => {
    for (const text of [build, capture, join]) {
      expect(text).toContain("github.head_ref == 'release-candidate'");
      expect(text).toContain('github.event.pull_request.head.repo.full_name == github.repository');
      expect(text).toContain("github.event_name != 'pull_request' && inputs.screens_from_run == ''");
    }
  });

  it('builds the preview APK for the emulator with the key-screen route, and shares it once', () => {
    expect(build).toContain('npm run build:android:apk:debug:intel');
    expect(build).toMatch(/env:\n(?:\s+#.*\n)*\s+EXPO_PUBLIC_KEY_SCREENS: '1'\n/);
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
    expect(capture).toContain("PART: ${{ matrix.store && '--store' || format('--group {0}', matrix.group) }}");
    expect(capture).toMatch(/capture-android-screens\.cjs --out [^\n]+ \$PART\n/);
    // The sixth runner takes the Google Play shots, and has no group to check.
    expect(capture).toContain('- { group: google-play, batch: 6, store: true }');
    expect(capture.match(/if: \$\{\{ !cancelled\(\) && !matrix\.store \}\}/g)).toHaveLength(2);
    expect(capture).toContain("process.env.STORE === 'true' ? googlePlay : phone");
    expect(capture).toMatch(/check-screens\.cjs --dir [^\n]+\n\s+--platform android --group \$\{\{ matrix\.group \}\}\n/);
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
    const comment = jobOf(preview, 'review-comment');
    expect(comment).toContain('actions/workflows/android-key-screens.yml/runs?head_sha=$SHA&event=pull_request');
    expect(comment).toContain('test("^android-key-screens-(manual|[0-9]+)-[0-9]+$")');
    expect(comment).toContain('ANDROID_CHECKS: ${{ steps.android.outputs.conclusion }}');
    expect(jobOf(preview, 'screenshots-reviewed')).toContain('needs: review-comment');
  });

  it('says how long each run took, until its join job uploaded the screenshots', () => {
    // took() finds the join job by name, so renaming one would drop its time quietly.
    expect(jobOf(preview, 'simulator')).toContain('name: iOS key screens join');
    expect(jobOf(workflow, 'screens')).toContain('name: Android key screens join');
    const comment = jobOf(preview, 'review-comment');
    expect(comment).toContain(`ios_took="$(took "$RUN_ID" 'iOS key screens join')" || ios_took=""`);
    expect(comment).toContain(`android_took="$(took "$ANDROID_RUN_ID" 'Android key screens join')" || android_took=""`);
    expect(comment).toMatch(/\n\s+\$checks\n\n\s+\$timing\n/);
  });

  it('re-checks an earlier run on Linux', () => {
    const earlier = jobOf(workflow, 'earlier-screens');
    expect(earlier).toContain('runs-on: ubuntu-24.04');
    expect(earlier).toContain('check-screens.cjs --dir "$SCREENS" --platform android');
  });

  it('keeps pull request code away from credentials', () => {
    expect(workflow).not.toMatch(/secrets\.|environment:|pull_request_target/);
    expect(workflow.match(/^\s+[a-z-]+:\s*write\b/gm)).toBeNull();
    for (const text of [build, capture, join]) expect(text).toContain('persist-credentials: false');
  });
});
