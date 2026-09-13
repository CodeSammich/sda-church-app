const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

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
  if (publish && preview) {
    throw new Error('Choose either production publishing or preview publishing, not both.');
  }

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

  if (preview) {
    if (!previewRepository || !previewSiteUrl) {
      throw new Error(
        'Preview publishing requires both --repo <github-repo-url> and --site-url <github-pages-url>.',
      );
    }

    const normalizedRepository = previewRepository
      .replace(/^https:\/\/github\.com\//, '')
      .replace(/^git@github\.com:/, '')
      .replace(/^ssh:\/\/git@github\.com\//, '')
      .replace(/\.git\/?$/, '')
      .replace(/\/$/, '');
    const isGitHubRepository = /^(https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)/.test(
      previewRepository,
    );
    const isCanonicalRepository =
      normalizedRepository ===
      'New-York-Chinese-Seventh-day-Adventist/sda-church-app';
    if (!isGitHubRepository || isCanonicalRepository) {
      throw new Error(
        'Preview publishing requires a non-canonical GitHub repository; production publishing uses the protected workflow.',
      );
    }

    let parsedPreviewUrl;
    try {
      parsedPreviewUrl = new URL(previewSiteUrl);
    } catch {
      throw new Error('Preview --site-url must be a valid HTTPS GitHub Pages URL.');
    }

    const configuredBasePath = require(path.resolve(projectRoot, 'app.json')).expo.experiments
      ?.baseUrl;
    const normalizePath = (value) => value.replace(/\/+$/, '') || '/';
    if (
      parsedPreviewUrl.protocol !== 'https:' ||
      !parsedPreviewUrl.hostname.endsWith('.github.io') ||
      normalizePath(parsedPreviewUrl.pathname) !== normalizePath(configuredBasePath || '/')
    ) {
      throw new Error(
        `Preview --site-url must be an HTTPS *.github.io URL using the configured base path ${configuredBasePath || '/'}; the church custom domain is production-only.`,
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
