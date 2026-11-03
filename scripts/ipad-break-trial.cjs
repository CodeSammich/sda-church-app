#!/usr/bin/env node
/**
 * TRIAL-ONLY (#324): never merged. Shows that the iPad's layout checks fail a
 * broken layout. A key-screens build given trialBreak=1 in its saved route
 * drops the content column and gives popups the percentage width that filled
 * 90% of the iPad (constants/LayoutTrial.ts). This captures the You page and
 * its Text size popup that way and as they are, on the iPad in landscape,
 * checks them, and passes only if the broken ones fail the column and popup
 * checks and the others pass them.
 *
 *   node scripts/ipad-break-trial.cjs <folder>
 */
const { execFileSync, spawnSync } = require('node:child_process');
const { mkdirSync, readFileSync, writeFileSync, appendFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const dir = resolve(process.argv[2] || 'ipad-trial');
mkdirSync(join(dir, 'screens'), { recursive: true });
const config = JSON.parse(readFileSync(join(__dirname, '..', 'test/screens/screens.json'), 'utf8'));
const screen = (name, path) => ({ name, group: 'trial', path, variants: [], ipadVariants: ['landscape'] });
const trial = {
  ...config,
  groups: { trial: 'The deliberate-failure trial of the iPad checks.' },
  appStore: {},
  appStoreIpad: {},
  googlePlay: {},
  screens: [
    screen('trial-you-broken', 'you?trialBreak=1'),
    screen('trial-text-size-broken', 'you?popup=text-size&trialBreak=1'),
    screen('trial-you', 'you'),
    screen('trial-text-size', 'you?popup=text-size'),
  ],
};
const configFile = join(dir, 'trial-screens.json');
writeFileSync(configFile, JSON.stringify(trial, null, 2));
const env = { ...process.env, KEY_SCREENS_CONFIG: configFile };
execFileSync('node', [join(__dirname, 'capture-ios-screens.cjs'), '--platform', 'ipad', '--out', join(dir, 'screens')], { env, stdio: 'inherit' });
const checked = spawnSync('node', [join(__dirname, 'check-screens.cjs'), '--platform', 'ipad', '--dir', join(dir, 'screens')], { env, stdio: 'inherit' });
const results = JSON.parse(readFileSync(join(dir, 'screens', 'checks.json'), 'utf8'));
const problemsOf = (name) => results.find((result) => result.file === `ipad/${name}-landscape.png`)?.problems || ['not checked'];
const column = /^text outside the content column/;
const popup = /^the popup is about \d+ points wide, more than 560$/;
const expectations = [
  ['the You page without its column fails the column check', problemsOf('trial-you-broken').some((p) => column.test(p))],
  ['the Text size popup at 90% fails the popup check', problemsOf('trial-text-size-broken').some((p) => popup.test(p))],
  ['the You page as it is passes the column check', !problemsOf('trial-you').some((p) => column.test(p))],
  ['the Text size popup as it is passes the popup check', !problemsOf('trial-text-size').some((p) => popup.test(p))],
];
const summary = [
  '### Deliberate-failure trial of the iPad checks (#324, trial only)',
  '',
  `check-screens.cjs exited ${checked.status}.`,
  ...results.map((result) => `- ${result.file}: ${result.problems.join('; ') || 'passed'}`),
  '',
  ...expectations.map(([what, held]) => `- ${held ? '✅' : '❌'} ${what}`),
  '',
].join('\n');
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary);
if (!expectations.every(([, held]) => held)) process.exit(1);
