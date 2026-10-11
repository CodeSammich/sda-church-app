# Contributing & Release Workflow

How to set up, run, and test the app is in
[Development setup and testing](README.md).

## Two-stage release process

Changes reach production through two distinct pull requests. Do not open a feature PR
directly against `main`.

- **Any contributor** may fork the repository, branch from `release-candidate`, and open
  the first PR, the feature PR, from their fork into `release-candidate`.
- **Code maintainers only** create and merge the second PR, the release PR, from the
  primary repository's `release-candidate` into `main`. Contributors do not need write
  access to `main` or permission to perform this release step.

```
main (stable)
  ↑
  └─ release-candidate (the next release)
       ↑
       └─ feature/awesome-feature (work in progress)
```

`release-candidate` is the one release branch. It has no version in its name: a
maintainer creates it from `main` when a release cycle starts, and it is deleted when the
release PR merges. Name your work branch with a prefix such as `feature/`, `bugfix/`,
`chore/`, or `docs/`. The rulesets that protect `main` and `release-candidate`, and the
checks a pull request must pass, are under
[Branch rules](operations/admin-runbook.md#branch-rules) in the admin runbook.

## Contributing a change

1. Check that the primary repository has a `release-candidate` branch. If it does not,
   ask a maintainer to create it.
2. Create the feature branch from it, then push it to your fork:

   ```bash
   git fetch upstream
   git switch -c feature/your-feature upstream/release-candidate
   git push -u origin feature/your-feature
   ```

3. Make and verify the changes; see [Testing](README.md#testing).
4. Open the feature PR from the fork's feature branch into the primary repository's
   `release-candidate`, following the format below, and wait for all checks and
   reviews. Don't retarget it to `main`. If a release merges first, GitHub moves the PR
   to `main`; change it back once `release-candidate` is recreated, then update the
   branch (**Update branch**, or merge `upstream/release-candidate` into it).
5. A maintainer merges it once its checks and review pass. Its issues stay open until
   the release reaches `main`.

### Pull request format and issue closing

The PR template (`.github/pull_request_template.md`) starts each description with a
`Closes #` line and has sections for what changed, key screens, and what was tested.
Write the description however suits the change, but every feature and release PR must:

- Title a feature PR with what it changes, for example `Add bulletin navigation`, with no
  version. Only the release PR is titled `Release/x.y.z: Summary`, with the concrete
  version; that title is the source of truth for the release version.
- Describe the user-visible and technical changes.
- Include one line per resolved issue in the description (not only in a commit message
  or the title), using a closing keyword such as `Closes #133` (`Fixes` and `Resolves`
  also work). For an issue the PR only advances or touches, use `Part of #133`,
  `Related to #133`, or `Refs #133`; those issues stay open and do not get the
  `pending release` label. The `PR Linked Issue` check fails without one. When a PR
  truly has no issue, a maintainer can apply the `no linked issue` label.
- Say what was tested, with the command and result. Only claim an Android or iOS build
  that was actually run.
- If the change affects what a screen shows or how it's laid out, update the key screens
  in `test/screens/screens.json`, for every platform that captures them: the iPhone today,
  and Android once #372 adds its screenshots. Add the screen or variant that shows the
  change, and text checks (`mustShowLines`, `mustNotShowLines`, `variantRules`) that fail
  if it breaks. Each shot lengthens every release PR's run, so prefer a check on an
  existing shot, and replace checks that no longer earn their place. See
  [Key screens](operations/native-builds.md#key-screens).
- Include no secrets, private keys, certificates, passwords, `.env` files, or generated
  signing artifacts. Workflow changes must not print secrets, dump environments, or
  upload secret-bearing files.

This is a public repository, so also:

- Keep personal names, personal email addresses, account IDs, and descriptions of unfixed
  security gaps out of code, commits, PRs, and issues.
- Use made-up names in tests, fixtures, examples, and docs. Never copy names or other
  details from real rosters, spreadsheets, bulletins, or screenshots.
- Strip hidden metadata (author names, account IDs, GPS locations) from images before
  committing them: `node scripts/strip-image-metadata.cjs <file>`.
  `test/image-metadata.test.ts` fails if a committed image still has any.
- Never set Android `versionCode` or iOS `buildNumber` in `app.json`. Both are computed
  from the version; see [Version numbers](operations/version-numbers.md).

AI coding agents read these rules from [`AGENTS.md`](../AGENTS.md), which `CLAUDE.md` and
`GEMINI.md` import. Keep them in sync with this section.

GitHub closes linked issues only when the closing reference reaches the default branch.
Therefore, `Closes #133` in a feature PR to `release-candidate` links the work but does
not close the issue when that feature PR merges. Release automation adds the
`pending release` label to show that the fix is merged and awaiting the production
release. The issue closes when the release PR carries the reference into `main`.

## Releasing (code maintainers only)

This project uses **Semantic Versioning**
([npm SemVer Guide](https://docs.npmjs.com/about-semantic-versioning)). The version files,
`package.json`, `package-lock.json`, `app.json`, and `public/sw.js`, must all hold the
release version. CI checks them but doesn't change them: if they disagree, the check
fails with the `npm run sync-version` command to run, and you commit its changes through
a pull request. Each release must also raise the version, because the store build
numbers are computed from it; see [Version numbers](operations/version-numbers.md).

Creating `release-candidate` and choosing the version are manual, code-maintainer
actions; no workflow does either. The version is chosen last, once the release's contents
are settled, because only then is it clear whether the release is a patch, minor, or
major. The click-by-click steps are in
[Shipping a release to `main`](operations/admin-runbook.md#shipping-a-release-to-main).

1. When a release cycle starts, a maintainer creates `release-candidate` from the primary
   repository's `main` (for example `git fetch upstream` then
   `git push upstream upstream/main:refs/heads/release-candidate`), and feature PRs merge
   into it.
2. Once the release's contents are settled, a maintainer picks the version and merges a
   version PR into `release-candidate` that runs `npm run sync-version -- --version x.y.z`
   and commits the generated files. Like any PR, it needs a `Part of #…` line or the
   `no linked issue` label.
3. A code maintainer opens the release PR from `release-candidate` into `main`, titled
   `Release/x.y.z: Summary` with that version, and copies every closing reference from the
   included feature PRs into its description. This is the code maintainer's
   responsibility, not the fork contributor's. Do not rely on a reviewer to repair the
   merge commit message at the last moment.
4. The release PR runs the slow checks below (the slowest, **iOS PR preview**, takes
   about 40 minutes), and **Screenshots reviewed** waits for a `release-approvers`
   member to approve the screenshots. Merge it once every check and the review pass.
   Merging it into `main` closes the issues and deletes `release-candidate`.
5. The merge to `main` checks the version files, tags the release, publishes the website,
   and starts the signed Android and iOS builds. The builds wait for a `release-approvers`
   member to approve the `production` environment, then upload to Google Play internal
   testing and TestFlight. Nothing reaches the public until a maintainer checks it on
   real phones and submits it in each store; see
   [Uploading to the stores](operations/admin-runbook.md#uploading-to-the-stores) and
   [Automatic store uploads](operations/native-builds.md#automatic-store-uploads).

### Future release automation

If choosing the version is automated later, begin with a maintainer-run local helper that
validates the requested version, confirms its tag does not already exist, starts from the
current primary-repository `release-candidate`, synchronizes the version files, and stops
before committing or pushing so the maintainer can review the result. Only consider a
manually dispatched GitHub Actions workflow after that helper has worked for several
releases; the workflow must validate the release itself, because pushes made with the
standard `GITHUB_TOKEN` generally do not trigger another workflow run. Do not choose
versions or create `release-candidate` automatically from dates, issue activity, or
feature merges.

## Automated checks

Each workflow is listed by the name the Actions tab shows, with its file and its check
names. Which checks are required on `main` and on `release-candidate` is in
[Required checks](operations/admin-runbook.md#required-checks). A feature PR into
`release-candidate` runs only the first three workflows below (and **Issues - Pending
Release Label** when it merges); the slower ones run once per release, on the release PR
into `main`. Other PRs into `main`, such as Dependabot's, skip the slow ones, because the
source gate stops them from merging anyway. `main` also requires the `CodeQL`,
`Analyze (actions)`, and `Analyze (javascript-typescript)` checks, which come from
GitHub's code scanning default setup and have no workflow file.

### `PR Unit Tests` (`.github/workflows/pr-tests.yml`)

- Check: `Jest unit tests`. Runs on every pull request.
- Runs `npm test -- --ci`, then `npm run check:text-scale`. It doesn't typecheck or build
  the web app; run `npm run check` for those.

### `Release - PR Version Sync` (`.github/workflows/release-validation.yml`)

- **Validate PR title** (check `validate-pr`, on every pull request): On a PR into
  `main`, requires a title starting `Release/x.y.z` with a concrete version. Any title
  passes on other PRs.
- **Verify the version files** (check `sync`): On the release PR from the primary
  repository's `release-candidate`, runs `npm run sync-version -- --version <version>`
  with the title's version and fails if that changes `package.json`,
  `package-lock.json`, `app.json`, or `public/sw.js`. The error gives that command to run
  and commit; the check never changes the branch. Other PRs skip it, so it usually shows
  as skipped.

### `PR Linked Issue` (`.github/workflows/pr-linked-issue.yml`)

- Check: `require-linked-issue`.
- Fails a PR into `main` or `release-candidate` whose description has no `Closes #…`
  (or `Fixes`/`Resolves`) line and no `Part of #…`, `Related to #…`, or `Refs #…`
  line. The error says exactly what to add.
- Reruns when the description is edited, so fixing the description clears it without a
  new commit.
- Skips Dependabot PRs and PRs labeled `no linked issue`.

### `PR Version Check` (`.github/workflows/pr-check.yml`)

- Check: `enforce-version`. Runs on PRs into `main`.
- Fails unless the version in `package.json` is higher than `main`'s, so each release
  gets a new version and a higher store build number. The one exception is a PR from
  `release-candidate` whose unchanged version has no tag yet, which allows a release to
  be retried; it still fails if that version is already tagged.

### `Main Release Source Gate` (`.github/workflows/main-release-source-gate.yml`)

- Check: `ensure_pr_to_main_from_release_branch`. Runs on PRs into `main`.
- Fails unless the PR comes from the `release-candidate` branch in the primary
  repository. It runs from `main`'s copy of the workflow, so a PR can't edit it to pass.

### `Bulletin API Integration` (`.github/workflows/bulletin-integration.yml`)

- Check: `verify-bulletin-api`. Runs on the release PR into `main`, and by hand.
- Runs `npm run test:integration:bulletin` against the production bulletin API. It calls
  the deployed Apps Script, not the PR's code.

### `Android PR preview` (`.github/workflows/android-pr-preview.yml`)

- Check: `Build Android debug APK (ARM)`. Runs on the release PR into `main`.
- Builds a debug-signed APK. After a `release-approvers` member approves `production`,
  it uploads the APK to Google Drive. See
  [Android PR preview APKs](operations/admin-runbook.md#android-pr-preview-apks).

### `iOS PR preview` (`.github/workflows/ios-pr-preview.yml`)

- Checks: `Build iOS Simulator app (Apple Silicon Mac)` and `Screenshots reviewed`. Runs on the release PR into `main`, and by hand on
  any branch.
- Builds the app for the iOS Simulator without signing and launches it. The Apple Silicon
  job also screenshots the key screens in `test/screens/screens.json` and checks their
  text.
- **Screenshots reviewed** waits until a `release-approvers` member approves the
  screenshots in the `screenshot-review` environment; see
  [Approving the screenshots](operations/admin-runbook.md#approving-the-screenshots).

### `Android audio e2e` (`.github/workflows/android-audio-e2e.yml`)

- Check: `Bible audio on an Android emulator`. Runs on the release PR into `main`, and by
  hand.
- Plays real Bible chapters on an Android emulator to test audio host failover and
  playback with the screen off. See
  [Bible audio emulator test](operations/admin-runbook.md#bible-audio-emulator-test).

### `Issues - Pending Release Label` (`.github/workflows/pending-release-label.yml`)

- Adds `pending release` to issues referenced with `Closes #<issue>` (or `Fixes`/`Resolves`) when a PR merges
  into `release-candidate`, including PRs submitted from forks.
- Removes the label when the issue closes after the final release reaches `main`.

### `Deploy Website and Tag` (`.github/workflows/deploy.yml`)

- **Final Validation**: Runs `npm run sync-version` and fails if the version files are
  out of sync. Version uniqueness is enforced earlier, by **PR Version Check**.
- **Automated Tagging**: Creates a new Git tag (e.g., `v1.0.0`) matching the `package.json`
  version, or skips tagging if that tag already exists.
- **Website**: Publishes `https://app.nyccsda.org`, a production deployment: the store
  listings link to its privacy policy and support pages, and QR codes point at its
  download page. The browser build of the app is published with it, for testing and
  demos. See [The app website](operations/admin-runbook.md#the-app-website-appnyccsdaorg).

### `Native Android build` and `Native iOS build` (`native-android-build.yml`, `native-ios-build.yml`)

- Start on every merge into `main`, and wait for `production` approval before building
  the signed AAB, APK, and IPA.
- Upload to Google Play internal testing and TestFlight with the `store-upload`
  environment, and attach the binaries to the version's GitHub Release. See
  [Native mobile binary builds](operations/native-builds.md).

The other workflows never run on pull requests. **External Dependency Monitor**, **Store
Toolchain Monitor**, **Apple Signing Monitor**, **Yearly Checkup**, and **Due-Date
Reminders** run on a schedule;
**Deploy Bulletin Apps Script** starts on every merge into `main` and waits for
`production` approval; and **Generate physical bulletin QR codes**
runs when a merge into `main` changes the QR code list or its script. The
[admin runbook](operations/admin-runbook.md) explains each.
