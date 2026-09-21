import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';

const projectRoot = resolve(import.meta.dirname, '..');
const appsScriptRoot = resolve(projectRoot, 'google-apps-script');
const deploymentConfigPath = resolve(appsScriptRoot, '.clasp-deployment.json');
const pushOnly = process.argv.includes('--push-only');
const claspCommand = process.platform === 'win32' ? 'clasp.cmd' : 'clasp';

const writeJson = (path, value) => {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
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

const runClasp = (args) => {
  const result = spawnSync(claspCommand, args, {
    cwd: appsScriptRoot,
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

try {
  configureFromEnvironment();
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
