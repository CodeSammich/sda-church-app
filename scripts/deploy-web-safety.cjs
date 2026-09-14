const CANONICAL_REPOSITORY =
  'New-York-Chinese-Seventh-day-Adventist/sda-church-app';

const normalizePath = (value) => value.replace(/\/+$/, '') || '/';

const normalizeRepository = (repository) =>
  repository
    .replace(/^https:\/\/github\.com\//, '')
    .replace(/^git@github\.com:/, '')
    .replace(/^ssh:\/\/git@github\.com\//, '')
    .replace(/\.git\/?$/, '')
    .replace(/\/$/, '');

const isCanonicalMainWorkflow = (environment) =>
  environment.GITHUB_ACTIONS === 'true' &&
  environment.GITHUB_REPOSITORY === CANONICAL_REPOSITORY &&
  environment.GITHUB_REF === 'refs/heads/main';

/**
 * Validate every remote publishing request before any build or git command.
 * This module intentionally has no side effects so its fail-closed rules can
 * be covered without invoking Expo or touching a remote repository.
 */
function validateDeploymentRequest({
  env = process.env,
  preview = false,
  previewRepository,
  previewSiteUrl,
  configuredBasePath = '/',
  publish = false,
}) {
  if (publish && preview) {
    throw new Error('Choose either production publishing or preview publishing, not both.');
  }

  if (publish && !isCanonicalMainWorkflow(env)) {
    throw new Error(
      'Production publishing is restricted to the canonical repository main-branch GitHub workflow.',
    );
  }

  if (!preview) return;

  if (!previewRepository || !previewSiteUrl) {
    throw new Error(
      'Preview publishing requires both --repo <github-repo-url> and --site-url <github-pages-url>.',
    );
  }

  const isGitHubRepository = /^(https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)/.test(
    previewRepository,
  );
  const isCanonicalRepository =
    normalizeRepository(previewRepository).toLowerCase() ===
    CANONICAL_REPOSITORY.toLowerCase();
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

  if (
    parsedPreviewUrl.protocol !== 'https:' ||
    !parsedPreviewUrl.hostname.endsWith('.github.io') ||
    normalizePath(parsedPreviewUrl.pathname) !== normalizePath(configuredBasePath)
  ) {
    throw new Error(
      `Preview --site-url must be an HTTPS *.github.io URL using the configured base path ${configuredBasePath}; the church custom domain is production-only.`,
    );
  }
}

module.exports = {
  CANONICAL_REPOSITORY,
  validateDeploymentRequest,
};
