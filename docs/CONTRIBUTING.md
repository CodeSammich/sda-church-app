# Contributing & Release Workflow

How to set up, run, and test the app is in
[Development setup and testing](README.md).

## Release & Versioning

This project uses **Semantic Versioning**
([npm SemVer Guide](https://docs.npmjs.com/about-semantic-versioning)). For release pull
requests, the major and minor release line in the PR title is the source of truth.
Titles may use either a concrete patch (`Release/1.1.0: ...`) or an `x` patch wildcard
(`Release/1.1.x: ...`). With the wildcard form, Release CI takes the concrete patch
from the checked-in `package.json`.

The version files, `package.json`, `package-lock.json`, `app.json`, and `public/sw.js`,
must all hold that version. CI checks them but doesn't change them: if they disagree,
the check fails with the `npm run sync-version` command to run, and you commit its
changes through a pull request. Each release must also raise the version, because the
store build numbers are computed from it; see [Version numbers](operations/version-numbers.md).

### Two-stage release process

Changes reach production through two distinct pull requests. Do not open a feature PR
directly against `main`.

- **Any contributor** may fork the repository, branch from the active release branch, and
  open the first PR from their fork into that release branch.
- **Code maintainers only** create and merge the second PR from the primary repository's
  release branch into `main`. Contributors do not need write access to `main` or permission
  to perform this release step.

Release branch creation is currently a manual, code-maintainer action. No workflow creates
`release/x.y.(patch|x)` automatically. This is intentional: starting a release chooses the version
and production scope and should remain an explicit decision.

1. A maintainer creates `release/x.y.(patch|x)` from the primary repository's `main` branch. If
   the release branch does not exist, ask a maintainer to create it.
2. Create the feature branch from that release branch, then push it to your fork:

   ```bash
   git fetch upstream
   git switch -c feature/your-feature upstream/release/1.1.0
   git push -u origin feature/your-feature
   ```

3. Open the feature PR from the fork's feature branch into the primary repository's
   matching `release/x.y.(patch|x)` branch. Start its title with the release line in the
   form `Release/x.y.<patch-or-x>: Brief description`, include a `Closes #…` line in the
   description, and wait for all checks and reviews. The branch and title must share the same major and minor;
   their patch values may differ.
4. After all planned feature PRs are merged, a code maintainer opens the release PR from
   `release/x.y.(patch|x)` into `main`. Only maintainers perform this second stage; contributors
   should not retarget their feature PRs to `main`.
5. The merge to `main` checks the version files, tags the release, publishes the website,
   and starts the signed Android and iOS builds. The builds wait for a `release-approvers`
   member to approve the `production` environment, then upload to Google Play internal
   testing and TestFlight. Nothing reaches the public until a maintainer submits it in each
   store; see [Automatic store uploads](operations/native-builds.md#automatic-store-uploads).

### Future release-branch automation

If release creation is automated later, begin with a maintainer-run local helper that:

1. validates the requested semantic version;
2. confirms the release branch and version tag do not already exist;
3. starts from the current primary-repository `main` branch;
4. creates the release branch and synchronizes all version files; and
5. stops before committing or pushing so the maintainer can review the result.

Only consider a manually dispatched GitHub Actions workflow after that helper has been used
successfully for multiple releases. The workflow must perform release validation itself:
pushes made with the standard `GITHUB_TOKEN` generally do not trigger another workflow run.
Do not create release branches automatically from dates, issue activity, or feature merges.

### Pull request format and issue closing

The PR template (`.github/pull_request_template.md`) starts each description with a
`Closes #` line and has sections for what changed, key screens, and what was tested.
Write the description however suits the change, but every feature and release PR must:

- Start the PR title with a release line, for example
  `Release/1.1.0: Add bulletin navigation` or `Release/1.1.x: Add bulletin navigation`.
  When the destination branch is named `release/x.y.(patch|x)`, the title must use the
  same major and minor; the patch may be concrete or `x`.
- Describe the user-visible and technical changes.
- Include one line per resolved issue in the description, using a closing keyword such as
  `Closes #133` (`Fixes` and `Resolves` also work). For an issue the PR only advances or
  touches, use `Part of #133`, `Related to #133`, or `Refs #133`; those issues stay open
  and do not get the `pending release` label. The `PR Linked Issue` check fails without one. When a PR truly has
  no issue, a maintainer can apply the `no linked issue` label.
- Say what was tested, with the command and result. Only claim an Android or iOS build
  that was actually run.
- If the change affects what a screen shows or how it's laid out, update the key screens
  in `test/screens/screens.json`, for every platform that captures them: the iPhone today,
  and Android once #372 adds its screenshots. Add the screen or variant that shows the
  change, and text checks (`mustShowLines`, `mustNotShowLines`, `variantRules`) that fail
  if it breaks. Each shot lengthens every release PR's run, so prefer a check on an
  existing shot, and replace checks that no longer earn their place. See **Key screens**
  in [iOS PR preview](operations/native-builds.md#ios-pr-preview-unsigned-simulator-builds).
- Include no secrets, private keys, certificates, passwords, `.env` files, or generated
  signing artifacts. Workflow changes must not print secrets, dump environments, or
  upload secret-bearing files.

This is a public repository, so also:

- Keep personal names, personal email addresses, account IDs, and descriptions of unfixed
  security gaps out of code, commits, PRs, and issues.
- Use made-up names in tests, fixtures, examples, and docs. Never copy names or other
  details from real rosters, spreadsheets, bulletins, or screenshots.
- Strip hidden metadata from images before committing them:
  `node scripts/strip-image-metadata.cjs <file>`. `test/image-metadata.test.ts` fails if
  a committed image still has any.
- Never set Android `versionCode` or iOS `buildNumber` in `app.json`. Both are computed
  from the version; see [Version numbers](operations/version-numbers.md).

AI coding agents read these rules from [`AGENTS.md`](../AGENTS.md), which `CLAUDE.md` and
`GEMINI.md` import. Keep them in sync with this section.

The checks a pull request must pass, and the other branch rules, are listed under
[Branch rules](operations/admin-runbook.md#branch-rules) in the admin runbook.

GitHub closes linked issues only when the closing reference reaches the default branch.
Therefore, `Closes #133` in a feature PR to `release/x.y.(patch|x)` links the work but does not
close the issue when that feature PR merges. Release automation adds the `pending release`
label to show that the fix is merged and awaiting the production release. The maintainer
must copy all closing references from the included feature PRs into the final
`release/x.y.(patch|x)` → `main` PR.
This is the code maintainer's responsibility, not the fork contributor's. Merging that
final PR into `main` closes the issues. Do not rely on a reviewer to repair the merge
commit message at the last moment.

## Branch Protection & Workflow

```
main (stable)
  ↑
  └─ release/1.1.0 (release candidate)
       ↑
       └─ feature/awesome-feature (work in progress)
```

### Branch Rules

#### `main` Branch

- **Protected branch** — Cannot push directly
- **Requires PR** — All changes must come through a pull request
- **Requires PR reviews** — Pull requests must be approved before merge
- **Requires checks to pass** — CI/CD checks must pass
- **Source**: Only from `release/**` branches in the primary repository
- **Auto-tag on merge** — Automatically creates semantic version tags

#### `release/*` Branches

- **Source**: Created from `main` for each release
- **Naming convention**: `release/<major>.<minor>.<patch-or-x>` (e.g., `release/1.0.1` or `release/1.0.x`)
- **Purpose**: Prepare the release and validate the version bump
- **PR validation**:
  - Requires a `Release/x.y.<patch-or-x>` PR title. It compares the major and minor
    release line with a `release/x.y.<patch-or-x>` destination branch or
    primary-repository source branch when applicable; patch values may differ.
  - For a PR whose source is a release branch in the primary repository, checks that
    `package.json`, `package-lock.json`, `app.json`, and `public/sw.js` hold the validated
    version. If they don't, it fails with the `npm run sync-version -- --version <version>`
    command to run. It never changes the branch, and PRs from forks skip it.

#### Feature/Work Branches

- **Naming convention**: `feature/`, `bugfix/`, `chore/`, `docs/`, etc.
- **Source**: Branch from the active `release/*` branch
- **PR target**: The matching release branch in the primary repository
- **Never target `main` directly**: Only the final release PR targets `main`

### Pull Request Workflow

1. Branch from the active `release/x.y.<patch-or-x>` branch.
2. Make and verify the changes, then commit them clearly.
3. Push to the fork and open a PR into the matching primary-repository release branch.
4. Include a `Closes #…` line and what was tested in the PR description.
5. Merge the feature PR after checks and review pass; its issues remain open at this stage.
6. A code maintainer aggregates the feature PRs and their closing references in the final
   release PR to `main`.
7. Merge the release PR after its checks and review pass. GitHub closes the referenced
   issues, and the deployment workflow creates the release tag.

### Automated Checks

Each workflow is listed by the name the Actions tab shows, with its file and its check
names. Which checks are required on `main` and on `release/*` is in
[Required checks](operations/admin-runbook.md#required-checks). A feature PR into a
release branch runs only the first three workflows below; the slower ones run once per
release, on the release PR into `main`. Other PRs into `main`, such as Dependabot's,
skip the slow ones, because the source gate stops them from merging anyway.

#### `PR Unit Tests` (`.github/workflows/pr-tests.yml`)

- Check: `Jest unit tests`. Runs on every pull request.
- Runs `npm test -- --ci`, then `npm run check:text-scale`. It doesn't typecheck or build
  the web app; run `npm run check` for those.

#### `Release - PR Version Sync` (`.github/workflows/release-validation.yml`)

- **Validate PR title** (check `validate-pr`, on every pull request): Requires
  `Release/x.y.<patch-or-x>` and ensures its major and minor match an applicable
  `release/x.y.<patch-or-x>` destination branch or primary-repository source branch.
  An `x` patch uses the concrete patch in `package.json`.
- **Verify the version files** (check `sync`): For a release branch in the primary
  repository, runs `npm run sync-version` with the validated version and fails if that
  changes `package.json`, `package-lock.json`, `app.json`, or `public/sw.js`. The error
  gives the command to run and commit. It does not run for fork source branches, and it
  usually shows as skipped.

#### `PR Linked Issue` (`.github/workflows/pr-linked-issue.yml`)

- Check: `require-linked-issue`.
- Fails a PR into `main` or a release branch whose description has no `Closes #…`
  (or `Fixes`/`Resolves`) line and no `Part of #…`, `Related to #…`, or `Refs #…`
  line. The error says exactly what to add.
- Reruns when the description is edited, so fixing the description clears it without a
  new commit.
- Skips Dependabot PRs and PRs labeled `no linked issue`.

#### `PR Version Check` (`.github/workflows/pr-check.yml`)

- Check: `enforce-version`. Runs on PRs into `main`.
- Fails unless the version in `package.json` is higher than `main`'s, so each release
  gets a new version and a higher store build number. The one exception is a
  `release/<version>` branch whose unchanged version has no tag yet, which allows a
  release to be retried; it still fails if that version is already tagged.

#### `Main Release Source Gate` (`.github/workflows/main-release-source-gate.yml`)

- Check: `ensure_pr_to_main_from_release_branch`. Runs on PRs into `main`.
- Fails unless the PR comes from a `release/x.y.(patch|x)` branch in the primary
  repository. It runs from `main`'s copy of the workflow, so a PR can't edit it to pass.

#### `Bulletin API Integration` (`.github/workflows/bulletin-integration.yml`)

- Check: `verify-bulletin-api`. Runs on the release PR into `main`, and by hand.
- Runs `npm run test:integration:bulletin` against the production bulletin API. It calls
  the deployed Apps Script, not the PR's code.

#### `Android PR preview` (`.github/workflows/android-pr-preview.yml`)

- Check: `Build Android debug APK (ARM)`. Runs on the release PR into `main`.
- Builds a debug-signed APK. After a `release-approvers` member approves `production`,
  it uploads the APK to Google Drive. See
  [Android PR preview APKs](operations/admin-runbook.md#android-pr-preview-apks).

#### `iOS PR preview` (`.github/workflows/ios-pr-preview.yml`)

- Checks: `Build iOS Simulator app (Apple Silicon Mac)`, `Build iOS Simulator app (Intel
  Mac)`, and `Screenshots reviewed`. Runs on the release PR into `main`, and by hand on
  any branch.
- Builds the app for the iOS Simulator without signing and launches it. The Apple Silicon
  job also screenshots the key screens in `test/screens/screens.json` and checks their
  text.
- **Screenshots reviewed** waits until a `release-approvers` member approves the
  screenshots in the `screenshot-review` environment; see
  [Approving the screenshots](operations/admin-runbook.md#approving-the-screenshots).

#### `Android audio e2e` (`.github/workflows/android-audio-e2e.yml`)

- Check: `Bible audio on an Android emulator`. Runs on the release PR into `main`, and by
  hand.
- Plays real Bible chapters on an Android emulator to test audio host failover and
  playback with the screen off. See
  [Bible audio emulator test](operations/admin-runbook.md#bible-audio-emulator-test).

#### `Issues - Pending Release Label` (`.github/workflows/pending-release-label.yml`)

- Adds `pending release` to issues referenced with `Closes #<issue>` (or `Fixes`/`Resolves`) when a PR merges
  into a `release/x.y.<patch-or-x>` branch, including PRs submitted from forks.
- Removes the label when the issue closes after the final release reaches `main`.

#### `Deploy Website and Tag` (`.github/workflows/deploy.yml`)

- **Final Validation**: Runs `npm run sync-version` and fails if the version files are
  out of sync. Version uniqueness is enforced earlier, by **PR Version Check**.
- **Automated Tagging**: Creates a new Git tag (e.g., `v1.0.0`) matching the `package.json`
  version, or skips tagging if that tag already exists.
- **Website**: Publishes `https://app.nyccsda.org`, a production deployment: the store
  listings link to its privacy policy and support pages, and QR codes point at its
  download page. The browser build of the app is published with it, for testing and
  demos. See [The app website](operations/admin-runbook.md#the-app-website-appnyccsdaorg).

#### `Native Android build` and `Native iOS build` (`native-android-build.yml`, `native-ios-build.yml`)

- Start on every merge into `main`, and wait for `production` approval before building
  the signed AAB, APK, and IPA.
- Upload to Google Play internal testing and TestFlight with the `store-upload`
  environment, and attach the binaries to the version's GitHub Release. See
  [Native mobile binary builds](operations/native-builds.md).

The other workflows never run on pull requests. **External Dependency Monitor**, **Store
Toolchain Monitor**, **Apple Signing Monitor**, and **Yearly Checkup** run on a schedule;
**Deploy Bulletin Apps Script** runs by hand; and **Generate physical bulletin QR codes**
runs when a merge into `main` changes the QR code list or its script. The
[admin runbook](operations/admin-runbook.md) explains each.

### Example feature workflow

```bash
# Start from the active release branch in the primary repository
git fetch upstream
git switch -c feature/bulletin-navigation upstream/release/1.1.0

# After implementation and verification, push to the fork
git push -u origin feature/bulletin-navigation
```

Then open the feature PR into `upstream/release/1.1.0` with a title beginning
`Release/1.1.0:`. A maintainer later opens the
separate `release/1.1.0` → `main` PR and repeats its closing issue references there.
