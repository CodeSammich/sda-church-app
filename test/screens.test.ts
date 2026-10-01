import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const {
  SETTING_KEYS,
  loadConfig,
  planCaptures,
  buildManifest,
  planAppStore,
  writeAppStoreCopy,
  manifestPath,
  statusBarClear,
  looksBlank,
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
});

describe('App Store shots', () => {
  const copies = planAppStore(config);

  it('numbers each language’s shots in upload order', () => {
    // Home first: the first three show on the App Store's install sheets.
    expect(copies[0]).toEqual({ name: 'home-default', file: 'app-store/en-US/01-home-default.png' });
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

  it('skips setup and fixes the language, theme, and text size for every shot', () => {
    for (const shot of shots) {
      const manifest = buildManifest(shot.settings);
      expect(manifest['has-completed-setup']).toBe('true');
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

describe('iOS PR preview', () => {
  const workflow = repoFile('.github/workflows/ios-pr-preview.yml');

  it('captures the key screens once, on the Apple Silicon build', () => {
    expect(workflow).toContain('node scripts/capture-ios-screens.cjs --out');
    expect(workflow).toMatch(/Capture the key screens\n(?:\s+#.*\n)*\s+if: matrix\.arch == 'arm64'/);
  });

  it('reads no secrets and keeps a read-only token', () => {
    expect(workflow).not.toMatch(/secrets\./);
    expect(workflow).toMatch(/permissions:\n\s+contents: read\n/);
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
  const preview = repoFile('.github/workflows/ios-pr-preview.yml');
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
    "startsWith(github.head_ref, 'release/')",
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
    expect(announce).toContain('about 50 minutes');
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
