const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const increment = args.includes('--increment');
const quiet = args.includes('--quiet') && !args.includes('--verbose');
const publish = args.includes('--publish');
const projectRoot = path.resolve(__dirname, '..');
const npxCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

if (args.includes('--help')) {
  console.log('Usage: npm run deploy -- [--increment] [--verbose]');
  console.log('Builds dist locally without publishing; --verbose shows tool output.');
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
  if (publish) {
    const isCanonicalGitHubAction =
      process.env.GITHUB_ACTIONS === 'true' &&
      process.env.GITHUB_REPOSITORY ===
        'New-York-Chinese-Seventh-day-Adventist/sda-church-app' &&
      process.env.GITHUB_REF === 'refs/heads/main';

    if (!isCanonicalGitHubAction) {
      throw new Error(
        'Production publishing is restricted to the canonical repository main-branch GitHub workflow.',
      );
    }
  }

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
  if (publish) {
    runStep('Publishing GitHub Pages', npxCommand, [
      'gh-pages',
      '-d',
      'dist',
      '--dotfiles',
    ]);
    console.log('Production deployment completed successfully.');
  } else {
    console.log('Local web build completed. No remote publishing was performed.');
  }
} catch (error) {
  console.error(`Deployment failed: ${error.message}`);
  process.exit(1);
}
