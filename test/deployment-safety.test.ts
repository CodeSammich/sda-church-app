const {
  CANONICAL_REPOSITORY,
  validateDeploymentRequest,
} = require('../scripts/deploy-web-safety.cjs');

describe('web deployment safety gates', () => {
  it('rejects production publishing outside the canonical main workflow', () => {
    expect(() =>
      validateDeploymentRequest({ publish: true, env: {} }),
    ).toThrow(
      'Production publishing is restricted to the canonical repository main-branch GitHub workflow',
    );
  });

  it('rejects ambiguous production and preview publishing requests', () => {
    expect(() =>
      validateDeploymentRequest({ preview: true, publish: true, env: {} }),
    ).toThrow('Choose either production publishing or preview publishing, not both');
  });

  it('requires explicit preview repository and site URL values', () => {
    expect(() => validateDeploymentRequest({ preview: true, env: {} })).toThrow(
      'Preview publishing requires both --repo <github-repo-url> and --site-url <github-pages-url>',
    );
  });

  it('does not allow the canonical repository to use preview publishing', () => {
    expect(() =>
      validateDeploymentRequest({
        env: {},
        preview: true,
        previewRepository: `https://github.com/${CANONICAL_REPOSITORY}.git`,
        previewSiteUrl: 'https://codesammich.github.io/sda-church-app',
        configuredBasePath: '/sda-church-app',
      }),
    ).toThrow('requires a non-canonical GitHub repository');
  });

  it('does not allow the church custom domain as a preview destination', () => {
    expect(() =>
      validateDeploymentRequest({
        env: {},
        preview: true,
        previewRepository: 'https://github.com/example/sda-church-app.git',
        previewSiteUrl: 'https://app.nyccsda.org',
        configuredBasePath: '/sda-church-app',
      }),
    ).toThrow('must be an HTTPS *.github.io URL');
  });

  it('allows an explicitly configured fork preview destination', () => {
    expect(() =>
      validateDeploymentRequest({
        env: {},
        preview: true,
        previewRepository: 'https://github.com/example/sda-church-app.git',
        previewSiteUrl: 'https://example.github.io/sda-church-app',
        configuredBasePath: '/sda-church-app',
      }),
    ).not.toThrow();
  });
});
