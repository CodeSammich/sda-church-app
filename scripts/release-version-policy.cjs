// Feature PRs go into the organization's release-candidate branch with any
// title. Only the release PR, from release-candidate into main, names a
// version, in its title: "Release/x.y.z: Summary". That title sets the
// release's version, which the sync job checks against the version files.
const RELEASE_TITLE_PATTERN = /^Release\/(\d+)\.(\d+)\.(\d+)(:|\s|$)/;

/**
 * The version a pull request releases: the one in its title for a PR into
 * main, or an empty string for any other PR, which releases nothing itself.
 */
const resolveReleaseVersion = ({ title, baseRef }) => {
  if (baseRef !== 'main') return '';

  const titleMatch = RELEASE_TITLE_PATTERN.exec(title || '');
  if (!titleMatch) {
    throw new Error(
      'A release PR into main must be titled Release/<major>.<minor>.<patch>: Summary (for example: Release/1.2.0: Describe the release). The title sets the version.',
    );
  }
  return `${titleMatch[1]}.${titleMatch[2]}.${titleMatch[3]}`;
};

if (require.main === module) {
  try {
    process.stdout.write(
      resolveReleaseVersion({
        title: process.env.PR_TITLE,
        baseRef: process.env.BASE_REF,
      }),
    );
  } catch (error) {
    console.error(`Release version validation failed: ${error.message}`);
    process.exit(1);
  }
}

module.exports = {
  resolveReleaseVersion,
};
