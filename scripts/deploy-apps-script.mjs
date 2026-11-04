import {
  appendFileSync,
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { relative, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';

const projectRoot = resolve(import.meta.dirname, '..');
const appsScriptRoot = resolve(projectRoot, 'google-apps-script');
const deploymentConfigPath = resolve(appsScriptRoot, '.clasp-deployment.json');
const pushOnly = process.argv.includes('--push-only');
const require = createRequire(import.meta.url);
const claspBinary = process.platform === 'win32' ? 'clasp.cmd' : 'clasp';
// CI installs clasp from tools/apps-script's lockfile, so none of its
// dependencies can change between releases unreviewed. A local deploy falls
// back to a clasp on the PATH.
const lockedClasp = resolve(projectRoot, 'tools/apps-script/node_modules/.bin', claspBinary);
const claspCommand = existsSync(lockedClasp) ? lockedClasp : claspBinary;
// The commit the last deploy came from. When it's set, the live project is
// compared with it before the push (scripts/apps-script-live-check.cjs).
const previousRef = process.env.APPS_SCRIPT_PREVIOUS_REF?.trim();

const writeJson = (path, value) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
};

const generatePinyinAppsScriptFile = () => {
  const pinyinSourcePath = resolve(projectRoot, 'node_modules/pinyin-pro/dist/index.js');
  if (!existsSync(pinyinSourcePath)) {
    throw new Error(
      'Missing pinyin-pro. Run npm install before deploying the Apps Script project.',
    );
  }
  const pinyinSource = readFileSync(pinyinSourcePath, 'utf8').replace(
    'setTimeout(G,0);',
    'G();',
  );
  writeFileSync(
    resolve(appsScriptRoot, 'PinyinPro.gs'),
    `// Generated from the pinned pinyin-pro dependency for Apps Script V8.\n// Do not edit this generated file directly.\n${pinyinSource}\n`,
  );
};

// The app's hymnal titles, number maps and Hymn Bank rows (#619), made from
// features/hymnal/ on every push so the deployed copy never falls behind.
const generateHymnalAppsScriptFile = () => {
  const { buildHymnalAppsScript } = require('./build-hymnal-apps-script.cjs');
  writeFileSync(resolve(appsScriptRoot, 'HymnalData.gs'), buildHymnalAppsScript());
};

const configureFromEnvironment = () => {
  const projectId = process.env.APPS_SCRIPT_PROJECT_ID?.trim();
  const deploymentId = process.env.APPS_SCRIPT_DEPLOYMENT_ID?.trim();
  const deploymentDescription =
    process.env.APPS_SCRIPT_DEPLOYMENT_DESCRIPTION?.trim() ||
    process.env.DEPLOYMENT_DESCRIPTION?.trim() ||
    'Bulletin Apps Script update';

  if (projectId) {
    writeJson(resolve(appsScriptRoot, '.clasp.json'), {
      scriptId: projectId,
      rootDir: '.',
    });
  }

  if (deploymentId) {
    writeJson(deploymentConfigPath, {
      deploymentId,
      description: deploymentDescription,
    });
  }

  // This is useful for CI or an explicitly configured shell environment. A
  // normal local `clasp login` does not need this variable.
  if (process.env.CLASPRC_JSON) {
    const claspConfigPath = resolve(homedir(), '.clasprc.json');
    const claspConfig = JSON.parse(process.env.CLASPRC_JSON);
    writeJson(claspConfigPath, claspConfig);
    chmodSync(claspConfigPath, 0o600);
  }
};

const runClasp = (args, cwd = appsScriptRoot) => {
  const result = spawnSync(claspCommand, args, {
    cwd,
    stdio: 'inherit',
  });
  if (result.error) {
    if (result.error.code === 'ENOENT') {
      throw new Error(
        'clasp is not installed. Install it with `npm install --global @google/clasp`, then run `clasp login`.',
      );
    }
    throw result.error;
  }
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
};

// The files clasp pushes or pulls: every script plus the manifest, by path
// inside the project, so a file added in a folder is seen too.
const readProjectFiles = (root) =>
  Object.fromEntries(
    readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /(\.gs|\.js|^appsscript\.json)$/.test(entry.name))
      .map((entry) => {
        const path = resolve(entry.parentPath, entry.name);
        return [relative(root, path).split('\\').join('/'), readFileSync(path, 'utf8')];
      }),
  );

const readPreviousRelease = (names) =>
  Object.fromEntries(
    names.flatMap((name) => {
      const result = spawnSync('git', ['show', `${previousRef}:google-apps-script/${name}`], {
        cwd: projectRoot,
        encoding: 'utf8',
      });
      return result.status === 0 ? [[name, result.stdout]] : [];
    }),
  );

const report = (lines) => {
  for (const line of lines) {
    console.log(
      process.env.GITHUB_ACTIONS ? `::warning title=Apps Script edited outside git::${line}` : line,
    );
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      `### Apps Script edited outside git\n\n${lines.map((line) => `- ${line}`).join('\n')}\n\n` +
        'This deploy replaces the live code with main. If nobody on the technology team ' +
        'made the change, see "Apps Script edited outside git" in docs/operations/admin-runbook.md.\n',
    );
  }
};

// Pulls the live project into a scratch folder and reports any file that
// matches neither the last release nor this one. It never stops the deploy,
// which puts main's code back.
const checkLiveProject = () => {
  const { scriptId } = JSON.parse(readFileSync(resolve(appsScriptRoot, '.clasp.json'), 'utf8'));
  const scratch = mkdtempSync(resolve(tmpdir(), 'apps-script-live-'));
  try {
    writeJson(resolve(scratch, '.clasp.json'), { scriptId, rootDir: '.', scriptExtensions: ['.gs'] });
    const pulled = spawnSync(claspCommand, ['pull'], { cwd: scratch, stdio: 'inherit' });
    if (pulled.error || pulled.status !== 0) {
      report(['Could not read the live Apps Script project to compare it with main.']);
      return;
    }
    const live = readProjectFiles(scratch);
    const { describeLiveEdits, findLiveEdits } = require('./apps-script-live-check.cjs');
    const edits = findLiveEdits({
      live,
      previous: readPreviousRelease(Object.keys(live)),
      next: readProjectFiles(appsScriptRoot),
    });
    if (edits.length) {
      report(describeLiveEdits(edits));
    } else {
      console.log('The live Apps Script project matches main.');
    }
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
};

try {
  configureFromEnvironment();
  generatePinyinAppsScriptFile();
  generateHymnalAppsScriptFile();
  if (previousRef) {
    checkLiveProject();
  }
  runClasp(['push', '--force']);
  if (pushOnly) {
    process.exit(0);
  }

  if (!existsSync(deploymentConfigPath)) {
    throw new Error(
      'Missing google-apps-script/.clasp-deployment.json. Copy the .example file and add the existing web-app deployment ID.',
    );
  }

  const deployment = JSON.parse(readFileSync(deploymentConfigPath, 'utf8'));
  if (!deployment.deploymentId || deployment.deploymentId.includes('PASTE_')) {
    throw new Error(
      'google-apps-script/.clasp-deployment.json must contain the existing web-app deployment ID.',
    );
  }

  runClasp([
    'create-deployment',
    '--deploymentId',
    deployment.deploymentId,
    '--description',
    deployment.description || 'Bulletin Apps Script update',
  ]);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
