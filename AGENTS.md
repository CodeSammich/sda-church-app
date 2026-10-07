# Agent instructions

These rules apply to every AI coding agent working in this repository (Claude
Code, Codex, Gemini, and others). The full contributor guide is
[docs/CONTRIBUTING.md](docs/CONTRIBUTING.md).

## Pull requests

- Branch from `release-candidate` and open the PR into `release-candidate`.
  Never target `main`; only a maintainer's release PR does.
- Title the PR with what it changes, with no version. Only the release PR
  from `release-candidate` into `main` is titled `Release/x.y.z: …`; that
  title names the release version, and CI checks the version files match it.
- Write the PR description however suits the change, but it **must** name
  its issues. Use a line `Closes #123` for each issue it finishes. Use
  `Part of #123` or `Related to #123` for an issue it only advances or
  touches, so that issue stays open. The **PR Linked Issue** check fails
  without one, and it reruns when you edit the description. The line goes in
  the description, not only in a commit message or the title.
- The release PR into `main` must repeat every `Closes #…` line from the
  feature PRs it includes. GitHub only closes issues when the reference
  reaches `main`.
- Say what you tested, with the command and result (for example `npm test`,
  1039 passing). Mention any Android or iOS build you ran.
- If the change affects what a screen shows or how it's laid out, update the
  key screens in `test/screens/screens.json`, for every platform that captures
  them: the iPhone today, and Android once #372 adds its screenshots. Add the
  screen or variant that shows the change, and text checks (`mustShowLines`,
  `mustNotShowLines`, `variantRules`) that fail if it breaks. Don't overdo it:
  each shot lengthens every release PR's run, so prefer a check on an existing
  shot, and replace checks that no longer earn their place. See
  [Key screens](docs/operations/native-builds.md#key-screens). The PR template
  asks about this too.

## Safety

- Never commit secrets, private keys, certificates, passwords, `.env` files,
  or generated signing artifacts. Workflow changes must not print secrets,
  dump environments, or upload secret-bearing files.
- This is a public repository. Keep personal names, personal email addresses,
  account IDs, and descriptions of unfixed security gaps out of code, commits,
  PRs, and issues.
- Use made-up names in tests, fixtures, examples, and docs. Never copy names or
  other details from real rosters, spreadsheets, bulletins, or screenshots.
- Strip hidden metadata (author names, account IDs, GPS locations) from images
  before committing them: `node scripts/strip-image-metadata.cjs <file>`.
  `test/image-metadata.test.ts` fails if a committed image still has any.
- Never set Android `versionCode` or iOS `buildNumber` in `app.json`. Both are
  computed from the version; see
  [Version numbers](docs/operations/version-numbers.md).
