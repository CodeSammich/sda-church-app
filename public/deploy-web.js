const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const { validateDeploymentRequest } = require('../scripts/deploy-web-safety.cjs');

const args = process.argv.slice(2);
const increment = args.includes('--increment');
const quiet = args.includes('--quiet') && !args.includes('--verbose');
const publish = args.includes('--publish');
const preview = args.includes('--preview');
const projectRoot = path.resolve(__dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const getOption = (name) => {
  const inlinePrefix = `${name}=`;
  const inline = args.find((arg) => arg.startsWith(inlinePrefix));
  if (inline) return inline.slice(inlinePrefix.length);

  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};

const previewRepository = getOption('--repo');
const previewSiteUrl = getOption('--site-url');

if (args.includes('--help')) {
  console.log('Usage: npm run deploy -- [--increment] [--verbose]');
  console.log('Builds dist locally without publishing; --verbose shows tool output.');
  console.log(
    'Preview: npm run deploy:dev -- --repo <github-repo-url> --site-url <github-pages-url>',
  );
  console.log('Production publishing is restricted to the GitHub workflow.');
  process.exit(0);
}

const tail = (value, lines = 30) =>
  String(value || '')
    .trim()
    .split('\n')
    .slice(-lines)
    .join('\n');

const runStep = (label, command, commandArgs) => {
  console.log(`${label}...`);
  const result = childProcess.spawnSync(command, commandArgs, {
    cwd: projectRoot,
    encoding: quiet ? 'utf8' : undefined,
    maxBuffer: 20 * 1024 * 1024,
    stdio: quiet ? 'pipe' : 'inherit',
  });

  if (result.error || result.status !== 0) {
    if (quiet) {
      const diagnostic = tail(`${result.stdout || ''}\n${result.stderr || ''}`);
      if (diagnostic) console.error(diagnostic);
    }
    throw result.error || new Error(`${label} exited with status ${result.status}`);
  }

  console.log(`${label} complete.`);
};

try {
  const configuredBasePath = preview
    ? require(path.resolve(projectRoot, 'app.json')).expo.experiments?.baseUrl
    : undefined;
  validateDeploymentRequest({
    configuredBasePath,
    env: process.env,
    preview,
    previewRepository,
    previewSiteUrl,
    publish,
  });

  runStep('Syncing version', process.execPath, [
    path.resolve(__dirname, 'sync-version.js'),
    ...(increment ? ['--increment'] : []),
  ]);
  fs.rmSync(path.resolve(projectRoot, 'dist'), { force: true, recursive: true });
  runStep('Building web app', npxCommand, [
    'expo',
    'export',
    '--platform',
    'web',
    '--clear',
  ]);
  if (publish || preview) {
    const publishArgs = [
      'gh-pages',
      '-d',
      'dist',
      '--dotfiles',
    ];
    if (preview) {
      publishArgs.push('--repo', previewRepository);
    }
    runStep(
      preview ? 'Publishing preview GitHub Pages' : 'Publishing GitHub Pages',
      npxCommand,
      publishArgs,
    );
    console.log(
      preview
        ? 'Preview deployment completed successfully.'
        : 'Production deployment completed successfully.',
    );
  } else {
    console.log('Local web build completed. No remote publishing was performed.');
  }
} catch (error) {
  console.error(`Deployment failed: ${error.message}`);
  process.exit(1);
}
